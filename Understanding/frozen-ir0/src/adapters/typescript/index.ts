// The TypeScript adapter: the only code that knows TypeScript. Resolves enum members to their values so that
// Status.Approved and "APPROVED" are one canonical state value.
import type { Node } from "web-tree-sitter";
import { parse, children } from "../treeSitter.js";
import { canonNumber, canonString, type CanonLiteral, type FunctionIR, type Operand, type Predicate, type Stmt } from "../../ir/index.js";

export const ENCODER = "typescript-adapter/0.1";

interface Ctx { inputs: Map<string, number>; enums: Map<string, CanonLiteral> }

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
      const ctx: Ctx = { inputs: new Map(params.map((p, i) => [p, i])), enums };
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
      return { kind: "opaque", reason: e?.type ?? "empty" };
    }
    case "comment": return undefined;
    default: return { kind: "opaque", reason: s.type };
  }
}

function unparen(n: Node): Node { return n.type === "parenthesized_expression" ? unparen(children(n)[0]) : n; }

function effectOf(call: Node, ctx: Ctx) {
  const fnNode = call.childForFieldName("function")!;
  const name = fnNode.type === "member_expression" ? fnNode.childForFieldName("property")!.text : fnNode.text;
  const args = children(call.childForFieldName("arguments")!).map((a) => operand(a, ctx));
  return { kind: "CALL_EXTERNAL" as const, operation: name, args };
}

function operand(n: Node, ctx: Ctx): Operand {
  n = unparen(n);
  const lit = litOf(n); if (lit) return { kind: "literal", literal: lit };
  if (n.type === "identifier") { const i = ctx.inputs.get(n.text); return i === undefined ? { kind: "unknown", reason: "free-name" } : { kind: "input", index: i }; }
  if (n.type === "member_expression") { const e = ctx.enums.get(n.text); if (e) return { kind: "literal", literal: e }; return { kind: "unknown", reason: "member" }; }
  if (n.type === "unary_expression" && n.child(0)?.text === "-" ) { const inner = operand(children(n)[0], ctx); if (inner.kind === "literal" && inner.literal.type === "number") return { kind: "literal", literal: canonNumber("-" + inner.literal.value) }; }
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
      const cop = OPS[op]; if (!cop) return { kind: "opaque", reason: `binary ${op}` };
      const lo = operand(l, ctx), ro = operand(r, ctx);
      const absentSide = lo.kind === "literal" && lo.literal.type === "absent" ? ro : ro.kind === "literal" && ro.literal.type === "absent" ? lo : undefined;
      if (absentSide && (cop === "EQ" || cop === "NE")) return { kind: "absent", operand: absentSide, negated: cop === "NE" };
      return { kind: "compare", op: cop, left: lo, right: ro };
    }
    case "unary_expression": if (n.child(0)?.text === "!") return { kind: "not", operand: predicate(children(n)[0], ctx) }; return { kind: "opaque", reason: "unary" };
    case "identifier": case "member_expression": return { kind: "truthy", operand: operand(n, ctx), negated: false };
    default: return { kind: "opaque", reason: n.type };
  }
}

/** Two absent-checks on the same operand joined by || (or their negations by &&) are one absent predicate. */
function mergeAbsent(a: Predicate, b: Predicate, op: string): Predicate | undefined {
  if (a.kind === "absent" && b.kind === "absent" && JSON.stringify(a.operand) === JSON.stringify(b.operand) && a.negated === b.negated) {
    if ((op === "||" && !a.negated) || (op === "&&" && a.negated)) return a;
  }
  return undefined;
}
