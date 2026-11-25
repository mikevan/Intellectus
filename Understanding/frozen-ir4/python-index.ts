// The Python adapter: the only code that knows Python. Produces FunctionIR; nothing lexical survives it.
import type { Node } from "web-tree-sitter";
import { parse, children } from "../treeSitter.js";
import { canonNumber, canonString, type Expr, type FunctionIR, type Operand, type Predicate, type OpaqueCategory, type Stmt } from "../../ir/index.js";

export const ENCODER = "python-adapter/0.1";

/** This grammar's node types, mapped to the IR's language-neutral categories. */
const CATEGORY: Record<string, OpaqueCategory> = {
  for_statement: "loop", while_statement: "loop",
  match_statement: "multi-branch",
  try_statement: "exception-handling", with_statement: "exception-handling",
  class_definition: "declaration", function_definition: "declaration", import_statement: "declaration",
  import_from_statement: "declaration", global_statement: "declaration", nonlocal_statement: "declaration",
  decorated_definition: "declaration",
  pass_statement: "other", delete_statement: "other", assert_statement: "other",
};
function categoryOf(nodeType: string): OpaqueCategory { return CATEGORY[nodeType] ?? "other"; }

export async function encodeFunctions(source: string): Promise<Map<string, FunctionIR>> {
  const root = await parse("python", source);
  const out = new Map<string, FunctionIR>();
  for (const n of children(root)) if (n.type === "function_definition") out.set(n.childForFieldName("name")!.text, encodeFunction(n));
  return out;
}

function encodeFunction(fn: Node): FunctionIR {
  const params = children(fn.childForFieldName("parameters")!).filter((p) => p.type !== "keyword_separator").map((p) => p.type === "identifier" ? p.text : p.childForFieldName("name")?.text ?? p.text).filter((p) => p !== "self");
  const ctx: Ctx = { inputs: new Map(params.map((p, i) => [p, i])), locals: new Map(), next: { id: 0 } };
  return { inputs: params.length, body: block(fn.childForFieldName("body")!, ctx) };
}

interface Ctx {
  inputs: Map<string, number>;
  /** name -> value id. A local's name lives only here, in the adapter, and never reaches the IR. */
  locals: Map<string, number>;
  next: { id: number };
}

function block(b: Node, ctx: Ctx): Stmt[] { return children(b).map((s) => stmt(s, ctx)).filter((s): s is Stmt => s !== undefined); }

function stmt(s: Node, ctx: Ctx): Stmt | undefined {
  switch (s.type) {
    case "if_statement": {
      const cond = predicate(s.childForFieldName("condition")!, ctx);
      const then = block(s.childForFieldName("consequence")!, ctx);
      const alt = children(s).find((c) => c.type === "else_clause" || c.type === "elif_clause");
      const els: Stmt[] = alt ? (alt.type === "else_clause" ? block(alt.childForFieldName("body")!, ctx) : [{ kind: "branch", predicate: predicate(alt.childForFieldName("condition")!, ctx), then: block(alt.childForFieldName("consequence")!, ctx), else: [] }]) : [];
      return { kind: "branch", predicate: cond, then, else: els };
    }
    case "return_statement": { const v = children(s)[0]; return { kind: "return", value: v ? operand(v, ctx) : undefined }; }
    case "raise_statement": return { kind: "throw" };
    case "expression_statement": {
      const e = children(s)[0];
      if (e?.type === "call") return { kind: "effect", effect: effectOf(e, ctx) };
      if (e?.type === "assignment" || e?.type === "augmented_assignment") return assignment(e, ctx);
      return { kind: "opaque", category: categoryOf(e?.type ?? "empty") };
    }
    case "assignment": case "augmented_assignment": return assignment(s, ctx);
    case "comment": return undefined;
    default: return { kind: "opaque", category: categoryOf(s.type) };
  }
}

/** name = e rebinds a local; anything else is a write to state the function does not own. */
function assignment(a: Node, ctx: Ctx): Stmt {
  const target = a.childForFieldName("left")!;
  const value = a.childForFieldName("right");
  const expr: Expr = value ? expression(value, ctx) : { kind: "unknown", reason: "annotation-only" };
  if (target.type === "identifier") { const id = ctx.next.id++; ctx.locals.set(target.text, id); return { kind: "bind", id, expr }; }
  if (target.type === "pattern_list" || target.type === "tuple_pattern") {
    const whole = ctx.next.id++;
    const out: Stmt[] = [{ kind: "bind", id: whole, expr }];
    for (const [i, el] of children(target).entries()) {
      const id = ctx.next.id++;
      out.push({ kind: "bind", id, expr: { kind: "index", object: { kind: "value", id: whole }, at: { kind: "literal", literal: canonNumber(String(i)) } } });
      if (el.type === "identifier") ctx.locals.set(el.text, id);
    }
    return { kind: "branch", predicate: { kind: "truthy", operand: { kind: "literal", literal: { type: "boolean", value: true } }, negated: false }, then: out, else: [] };
  }
  return { kind: "effect", effect: { kind: "WRITE", operation: target.type === "attribute" ? target.childForFieldName("attribute")!.text : undefined, args: [] } };
}

/** The value an expression computes. */
function expression(n: Node, ctx: Ctx): Expr {
  if (n.type === "parenthesized_expression") return expression(children(n)[0], ctx);
  switch (n.type) {
    case "call": {
      const f = n.childForFieldName("function")!.text;
      const a0 = children(n.childForFieldName("arguments")!)[0];
      if (["Decimal", "int", "float", "Fraction"].includes(f) && a0) return { kind: "operand", operand: { kind: "literal", literal: canonNumber(a0.text) } };
      const e = effectOf(n, ctx); return { kind: "call", operation: e.operation, args: e.args };
    }
    case "attribute": return { kind: "member", object: operand(n.childForFieldName("object")!, ctx), property: n.childForFieldName("attribute")!.text };
    case "subscript": return { kind: "index", object: operand(n.childForFieldName("value")!, ctx), at: operand(n.childForFieldName("subscript")!, ctx) };
    case "binary_operator": {
      const op = n.childForFieldName("operator")!.text;
      const arith: Record<string, "ADD" | "SUB" | "MUL" | "DIV" | "MOD"> = { "+": "ADD", "-": "SUB", "*": "MUL", "/": "DIV", "%": "MOD" };
      if (arith[op]) return { kind: "arith", op: arith[op], left: operand(n.childForFieldName("left")!, ctx), right: operand(n.childForFieldName("right")!, ctx) };
      return { kind: "unknown", reason: `binary ${op}` };
    }
    case "comparison_operator": case "boolean_operator": case "not_operator": return { kind: "test", predicate: predicate(n, ctx) };
    case "unary_operator": {
      const op = n.child(0)?.text;
      if (op === "-") return { kind: "operand", operand: operand(n, ctx) };
      if (op === "+") return expression(children(n)[0], ctx);
      return { kind: "unknown", reason: "unary" };
    }
    case "conditional_expression": {
      const kids = children(n); // value if cond else other
      return { kind: "choose", predicate: predicate(kids[1], ctx), whenTrue: operand(kids[0], ctx), whenFalse: operand(kids[2], ctx) };
    }
    default: { const o = operand(n, ctx); return o.kind === "unknown" ? { kind: "unknown", reason: n.type } : { kind: "operand", operand: o }; }
  }
}

function effectOf(call: Node, ctx: Ctx) {
  const fnNode = call.childForFieldName("function")!;
  const name = fnNode.type === "attribute" ? fnNode.childForFieldName("attribute")!.text : fnNode.text;
  const args = children(call.childForFieldName("arguments")!).map((a) => operand(a, ctx));
  return { kind: "CALL_EXTERNAL" as const, operation: name, args };
}

function operand(n: Node, ctx: Ctx): Operand {
  switch (n.type) {
    case "identifier": {
      const v = ctx.locals.get(n.text); if (v !== undefined) return { kind: "value", id: v };
      const i = ctx.inputs.get(n.text); return i === undefined ? { kind: "unknown", reason: "free-name" } : { kind: "input", index: i };
    }
    case "integer": case "float": return { kind: "literal", literal: canonNumber(n.text) };
    case "string": return { kind: "literal", literal: canonString(n.text) };
    case "true": return { kind: "literal", literal: { type: "boolean", value: true } };
    case "false": return { kind: "literal", literal: { type: "boolean", value: false } };
    case "none": return { kind: "literal", literal: { type: "absent" } };
    case "call": { // Decimal("25000.00"), int("5"): a numeric constructor over a literal is the literal
      const f = n.childForFieldName("function")!.text; const a = children(n.childForFieldName("arguments")!)[0];
      if (["Decimal", "int", "float", "Fraction"].includes(f) && a) return { kind: "literal", literal: canonNumber(a.text) };
      const e = expression(n, ctx);
      return e.kind === "operand" ? e.operand : { kind: "computed", expr: e };
    }
    case "subscript": case "binary_operator": case "conditional_expression": {
      const e = expression(n, ctx);
      return e.kind === "operand" ? e.operand : { kind: "computed", expr: e };
    }
    case "parenthesized_expression": return operand(children(n)[0], ctx);
    case "attribute": return { kind: "read", object: operand(n.childForFieldName("object")!, ctx), property: n.childForFieldName("attribute")!.text };
    case "lambda": {
      const paramsNode = n.childForFieldName("parameters");
      const params = paramsNode ? children(paramsNode).map((p) => (p.type === "identifier" ? p.text : p.childForFieldName("name")?.text ?? p.text)) : [];
      const innerCtx: Ctx = { inputs: new Map(params.map((p, i) => [p, i])), locals: new Map(), next: { id: 0 } };
      return { kind: "behaviour", inputs: params.length, body: [{ kind: "return", value: operand(n.childForFieldName("body")!, innerCtx) }] };
    }
    case "unary_operator": {
      const op = n.child(0)?.text;
      if (op === "-") { const inner = operand(children(n)[0], ctx); if (inner.kind === "literal" && inner.literal.type === "number") return { kind: "literal", literal: canonNumber("-" + inner.literal.value) }; return { kind: "negated", operand: inner }; }
      if (op === "+") return operand(children(n)[0], ctx);
      return { kind: "unknown", reason: "unary" };
    }
    default: return { kind: "unknown", reason: n.type };
  }
}

const OPS: Record<string, Predicate extends { op: infer O } ? O : never> = { "==": "EQ", "!=": "NE", ">": "GT", ">=": "GE", "<": "LT", "<=": "LE" } as never;

function predicate(n: Node, ctx: Ctx): Predicate {
  switch (n.type) {
    case "parenthesized_expression": return predicate(children(n)[0], ctx);
    case "boolean_operator": {
      const op = n.childForFieldName("operator")!.text;
      return { kind: op === "and" ? "and" : "or", operands: [predicate(n.childForFieldName("left")!, ctx), predicate(n.childForFieldName("right")!, ctx)] };
    }
    case "not_operator": return { kind: "not", operand: predicate(children(n)[0], ctx) };
    case "comparison_operator": {
      const kids = children(n); const opNode = n.children.find((c) => c && !c.isNamed && c.text.trim() !== "")!;
      const opText = opNode.text;
      if (opText === "is" || opText === "is not") {
        const [l, r] = kids; const absent = r.type === "none" ? l : l.type === "none" ? r : undefined;
        if (absent) return { kind: "absent", operand: operand(absent, ctx), negated: opText === "is not" };
      }
      const op = OPS[opText]; if (!op) return { kind: "opaque", category: "other" };
      return { kind: "compare", op, left: operand(kids[0], ctx), right: operand(kids[1], ctx) };
    }
    case "call": { // x.is_none() style helpers are not Python; a bare call in a condition is opaque
      return { kind: "opaque", category: categoryOf("call-in-condition") };
    }
    case "identifier": return { kind: "truthy", operand: operand(n, ctx), negated: false };
    default: return { kind: "opaque", category: categoryOf(n.type) };
  }
}
