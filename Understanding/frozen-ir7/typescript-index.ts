// The TypeScript adapter: the only code that knows TypeScript. Resolves enum members to their values so that
// Status.Approved and "APPROVED" are one canonical state value.
import type { Node } from "web-tree-sitter";
import { parse, children } from "../treeSitter.js";
import { canonNumber, canonString, type CanonLiteral, type Expr, type FunctionIR, type Operand, type Predicate, type OpaqueCategory, type Stmt } from "../../ir/index.js";

export const ENCODER = "typescript-adapter/0.2";

/** This grammar's node types, mapped to the IR's language-neutral categories. */
const CATEGORY: Record<string, OpaqueCategory> = {
  for_statement: "loop", for_in_statement: "loop", while_statement: "loop", do_statement: "loop",
  switch_statement: "multi-branch",
  try_statement: "exception-handling",
  labeled_statement: "other", empty_statement: "other",
  class_declaration: "declaration", function_declaration: "declaration", interface_declaration: "declaration",
  type_alias_declaration: "declaration", enum_declaration: "declaration", import_statement: "declaration",
  export_statement: "declaration", ambient_declaration: "declaration",
};
function categoryOf(nodeType: string): OpaqueCategory { return CATEGORY[nodeType] ?? "other"; }

interface Ctx {
  inputs: Map<string, number>;
  enums: Map<string, CanonLiteral>;
  /** name -> value id. A local's name lives only here, in the adapter, and never reaches the IR. */
  locals: Map<string, number>;
  next: { id: number };
}

export async function encodeFunctions(source: string): Promise<Map<string, FunctionIR>> {
  const root = await parse("typescript", source);
  const enums = new Map<string, CanonLiteral>();
  const visit = (n: Node) => { if (n.type === "enum_declaration") collectEnum(n, enums); for (const c of children(n)) visit(c); };
  visit(root);
  const out = new Map<string, FunctionIR>();
  const walk = (n: Node) => {
    if (n.type === "function_declaration" || n.type === "method_definition") {
      const name = n.childForFieldName("name")!.text;
      const params = children(n.childForFieldName("parameters")!).map((p) => (p.childForFieldName("pattern") ?? p).text);
      const ctx: Ctx = { inputs: new Map(params.map((p, i) => [p, i])), enums, locals: new Map(), next: { id: 0 } };
      out.set(name, { inputs: params.length, body: block(n.childForFieldName("body")!, ctx) });
    }
    for (const c of children(n)) walk(c);
  };
  walk(root);
  return out;
}

function collectEnum(n: Node, enums: Map<string, CanonLiteral>) {
  const name = n.childForFieldName("name")!.text;
  for (const m of children(n.childForFieldName("body")!)) {
    if (m.type !== "enum_assignment" && m.type !== "property_identifier") continue;
    const key = m.type === "enum_assignment" ? m.childForFieldName("name")!.text : m.text;
    const v = m.type === "enum_assignment" ? m.childForFieldName("value") : null;
    enums.set(`${name}.${key}`, v ? litOf(v) ?? { type: "string", value: key } : { type: "string", value: key });
  }
}

function litOf(n: Node): CanonLiteral | undefined {
  if (n.type === "number") return canonNumber(n.text);
  if (n.type === "string" || n.type === "template_string") return canonString(n.text);
  if (n.type === "true") return { type: "boolean", value: true };
  if (n.type === "false") return { type: "boolean", value: false };
  if (n.type === "null" || n.type === "undefined") return { type: "absent" };
  return undefined;
}

function block(b: Node, ctx: Ctx): Stmt[] { return children(b).map((s) => stmt(s, ctx)).filter((s): s is Stmt => s !== undefined); }

function bodyOf(n: Node, ctx: Ctx): Stmt[] { return n.type === "statement_block" ? block(n, ctx) : [stmt(n, ctx)].filter((s): s is Stmt => s !== undefined); }

function stmt(s: Node, ctx: Ctx): Stmt | undefined {
  switch (s.type) {
    case "if_statement": {
      const cond = predicate(unparen(s.childForFieldName("condition")!), ctx);
      const then = bodyOf(s.childForFieldName("consequence")!, ctx);
      const alt = s.childForFieldName("alternative");
      const els = alt ? bodyOf(children(alt)[0] ?? alt, ctx) : [];
      return { kind: "branch", predicate: cond, then, else: els };
    }
    case "return_statement": { const v = children(s)[0]; return { kind: "return", value: v ? operand(v, ctx) : undefined }; }
    case "throw_statement": return { kind: "throw" };
    case "expression_statement": {
      let e = children(s)[0]; if (e?.type === "await_expression") e = children(e)[0];
      if (e?.type === "call_expression") return { kind: "effect", effect: effectOf(e, ctx) };
      if (e?.type === "assignment_expression" || e?.type === "augmented_assignment_expression") return assignment(e, ctx);
      return { kind: "opaque", category: categoryOf(e?.type ?? "empty") };
    }
    case "comment": return undefined;
    case "lexical_declaration": case "variable_declaration": return bindings(s, ctx);
    default: return { kind: "opaque", category: categoryOf(s.type) };
  }
}

/** const a = x, b = y; becomes one bind per declarator, in source order, each identified by position. */
function bindings(decl: Node, ctx: Ctx): Stmt {
  const out: Stmt[] = [];
  for (const d of children(decl)) {
    if (d.type !== "variable_declarator") continue;
    const name = d.childForFieldName("name")!;
    const init = d.childForFieldName("value");
    const expr: Expr = init ? expression(init, ctx) : { kind: "unknown", reason: "declared-without-value" };
    if (name.type === "identifier") { const id = ctx.next.id++; out.push({ kind: "bind", id, expr }); ctx.locals.set(name.text, id); }
    else {
      // a destructuring pattern: bind the whole value, then one member read per element
      const whole = ctx.next.id++; out.push({ kind: "bind", id: whole, expr });
      for (const el of children(name)) {
        const key = el.type === "shorthand_property_identifier_pattern" ? el.text : el.childForFieldName?.("key")?.text ?? el.text;
        const id = ctx.next.id++;
        out.push({ kind: "bind", id, expr: { kind: "member", object: { kind: "value", id: whole }, property: key } });
        ctx.locals.set(key, id);
      }
    }
  }
  return out.length === 1 ? out[0] : { kind: "branch", predicate: { kind: "truthy", operand: { kind: "literal", literal: { type: "boolean", value: true } }, negated: false }, then: out, else: [] };
}

function unparen(n: Node): Node { return n.type === "parenthesized_expression" ? unparen(children(n)[0]) : n; }

/** x = e rebinds a local to a new value; anything else is a write to state the function does not own. */
function assignment(a: Node, ctx: Ctx): Stmt {
  const target = a.childForFieldName("left")!;
  const value = a.childForFieldName("right")!;
  const expr = expression(value, ctx);
  if (target.type === "identifier" && (ctx.locals.has(target.text) || !ctx.inputs.has(target.text))) {
    const id = ctx.next.id++;
    ctx.locals.set(target.text, id);
    return { kind: "bind", id, expr };
  }
  return { kind: "effect", effect: { kind: "WRITE", operation: target.type === "member_expression" ? target.childForFieldName("property")!.text : undefined, args: [operandOfExpr(expr, ctx)] } };
}

function operandOfExpr(e: Expr, ctx: Ctx): Operand { return e.kind === "operand" ? e.operand : { kind: "unknown", reason: e.kind }; }

/** The value an expression computes. Calls keep their operation name because it is externally observable. */
function expression(n: Node, ctx: Ctx): Expr {
  n = unparen(n);
  if (n.type === "await_expression") return expression(children(n)[0], ctx);
  switch (n.type) {
    case "call_expression": { const e = effectOf(n, ctx); return { kind: "call", operation: e.operation, args: e.args, receiver: e.receiver }; }
    case "member_expression": {
      const asEnum = ctx.enums.get(n.text);
      if (asEnum) return { kind: "operand", operand: { kind: "literal", literal: asEnum } };
      return { kind: "member", object: operand(n.childForFieldName("object")!, ctx), property: n.childForFieldName("property")!.text };
    }
    case "subscript_expression": return { kind: "index", object: operand(n.childForFieldName("object")!, ctx), at: operand(n.childForFieldName("index")!, ctx) };
    case "binary_expression": {
      const op = n.childForFieldName("operator")!.text;
      const arith: Record<string, "ADD" | "SUB" | "MUL" | "DIV" | "MOD"> = { "+": "ADD", "-": "SUB", "*": "MUL", "/": "DIV", "%": "MOD" };
      if (arith[op]) return { kind: "arith", op: arith[op], left: operand(n.childForFieldName("left")!, ctx), right: operand(n.childForFieldName("right")!, ctx) };
      return { kind: "test", predicate: predicate(n, ctx) };
    }
    case "ternary_expression": return { kind: "choose", predicate: predicate(n.childForFieldName("condition")!, ctx), whenTrue: operand(n.childForFieldName("consequence")!, ctx), whenFalse: operand(n.childForFieldName("alternative")!, ctx) };
    case "unary_expression": {
      const op = n.child(0)?.text;
      if (op === "-") return { kind: "operand", operand: operand(n, ctx) };
      if (op === "+") return expression(children(n)[0], ctx);
      return { kind: "test", predicate: predicate(n, ctx) };
    }
    default: { const o = operand(n, ctx); return o.kind === "unknown" ? { kind: "unknown", reason: n.type } : { kind: "operand", operand: o }; }
  }
}

function effectOf(call: Node, ctx: Ctx) {
  const fnNode = call.childForFieldName("function")!;
  const isMember = fnNode.type === "member_expression";
  const name = isMember ? fnNode.childForFieldName("property")!.text : fnNode.text;
  // IR-7: the entity the operation acts on is kept as an operand, exactly as parsed. Its type is NOT inferred and
  // it is NOT used to resolve anything in this round; `thing.visit(x)` is call(receiver=thing, visit, [x]).
  const receiver = isMember ? operand(fnNode.childForFieldName("object")!, ctx) : undefined;
  const args = children(call.childForFieldName("arguments")!).map((a) => operand(a, ctx));
  return { kind: "CALL_EXTERNAL" as const, operation: name, args, receiver };
}

function operand(n: Node, ctx: Ctx): Operand {
  n = unparen(n);
  const lit = litOf(n); if (lit) return { kind: "literal", literal: lit };
  if (n.type === "identifier") {
    const v = ctx.locals.get(n.text); if (v !== undefined) return { kind: "value", id: v };
    const i = ctx.inputs.get(n.text); return i === undefined ? { kind: "unknown", reason: "free-name" } : { kind: "input", index: i };
  }
  if (n.type === "member_expression") {
    const e = ctx.enums.get(n.text); if (e) return { kind: "literal", literal: e };
    // A member read is part of the data flow, not an unknown: it reads a named place on something.
    return { kind: "read", object: operand(n.childForFieldName("object")!, ctx), property: n.childForFieldName("property")!.text };
  }
  if (n.type === "arrow_function" || n.type === "function_expression") {
    // Behaviour handed to another function. Its parameters are inputs of their own, numbered from zero, and its
    // body is encoded by the same rules as any other body, so two callbacks that do the same thing are one shape.
    const params = children(n.childForFieldName("parameters") ?? n).filter((p) => p.type !== "comment").map((p) => (p.childForFieldName("pattern") ?? p).text);
    const inner: Ctx = { inputs: new Map(params.map((p, i) => [p, i])), enums: ctx.enums, locals: new Map(), next: { id: 0 } };
    const bodyNode = n.childForFieldName("body")!;
    const body = bodyNode.type === "statement_block" ? block(bodyNode, inner) : [{ kind: "return" as const, value: operand(bodyNode, inner) }];
    return { kind: "behaviour", inputs: params.length, body };
  }
  if (n.type === "call_expression" || n.type === "await_expression") {
    const e = expression(n, ctx);
    return e.kind === "operand" ? e.operand : { kind: "computed", expr: e };
  }
  if (n.type === "subscript_expression" || n.type === "binary_expression" || n.type === "ternary_expression") {
    const e = expression(n, ctx);
    return e.kind === "operand" ? e.operand : { kind: "computed", expr: e };
  }
  if (n.type === "unary_expression" && n.child(0)?.text === "-") {
    const inner = operand(children(n)[0], ctx);
    if (inner.kind === "literal" && inner.literal.type === "number") return { kind: "literal", literal: canonNumber("-" + inner.literal.value) };
    return { kind: "negated", operand: inner };
  }
  return { kind: "unknown", reason: n.type };
}

const OPS: Record<string, "EQ" | "NE" | "GT" | "GE" | "LT" | "LE"> = { "===": "EQ", "==": "EQ", "!==": "NE", "!=": "NE", ">": "GT", ">=": "GE", "<": "LT", "<=": "LE" };

function predicate(n: Node, ctx: Ctx): Predicate {
  n = unparen(n);
  switch (n.type) {
    case "binary_expression": {
      const op = n.childForFieldName("operator")!.text; const l = n.childForFieldName("left")!; const r = n.childForFieldName("right")!;
      if (op === "&&" || op === "||") {
        // x === null || x === undefined  ->  absent(x); x !== null && x !== undefined -> not absent(x)
        const lp = predicate(l, ctx), rp = predicate(r, ctx);
        const merged = mergeAbsent(lp, rp, op);
        if (merged) return merged;
        return { kind: op === "&&" ? "and" : "or", operands: [lp, rp] };
      }
      const cop = OPS[op]; if (!cop) return { kind: "opaque", category: "other" };
      const lo = operand(l, ctx), ro = operand(r, ctx);
      const absentSide = lo.kind === "literal" && lo.literal.type === "absent" ? ro : ro.kind === "literal" && ro.literal.type === "absent" ? lo : undefined;
      if (absentSide && (cop === "EQ" || cop === "NE")) return { kind: "absent", operand: absentSide, negated: cop === "NE" };
      return { kind: "compare", op: cop, left: lo, right: ro };
    }
    case "unary_expression": if (n.child(0)?.text === "!") return { kind: "not", operand: predicate(children(n)[0], ctx) }; return { kind: "opaque", category: categoryOf("unary") };
    case "identifier": case "member_expression": return { kind: "truthy", operand: operand(n, ctx), negated: false };
    default: return { kind: "opaque", category: categoryOf(n.type) };
  }
}

/** Two absent-checks on the same operand joined by || (or their negations by &&) are one absent predicate. */
function mergeAbsent(a: Predicate, b: Predicate, op: string): Predicate | undefined {
  if (a.kind === "absent" && b.kind === "absent" && JSON.stringify(a.operand) === JSON.stringify(b.operand) && a.negated === b.negated) {
    if ((op === "||" && !a.negated) || (op === "&&" && a.negated)) return a;
  }
  return undefined;
}
