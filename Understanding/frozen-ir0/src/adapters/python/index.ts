// The Python adapter: the only code that knows Python. Produces FunctionIR; nothing lexical survives it.
import type { Node } from "web-tree-sitter";
import { parse, children } from "../treeSitter.js";
import { canonNumber, canonString, type FunctionIR, type Operand, type Predicate, type Stmt } from "../../ir/index.js";

export const ENCODER = "python-adapter/0.1";

export async function encodeFunctions(source: string): Promise<Map<string, FunctionIR>> {
  const root = await parse("python", source);
  const out = new Map<string, FunctionIR>();
  for (const n of children(root)) if (n.type === "function_definition") out.set(n.childForFieldName("name")!.text, encodeFunction(n));
  return out;
}

function encodeFunction(fn: Node): FunctionIR {
  const params = children(fn.childForFieldName("parameters")!).filter((p) => p.type !== "keyword_separator").map((p) => p.type === "identifier" ? p.text : p.childForFieldName("name")?.text ?? p.text).filter((p) => p !== "self");
  const ctx = { inputs: new Map(params.map((p, i) => [p, i])) };
  return { inputs: params.length, body: block(fn.childForFieldName("body")!, ctx) };
}

interface Ctx { inputs: Map<string, number> }

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
    case "expression_statement": { const e = children(s)[0]; if (e?.type === "call") return { kind: "effect", effect: effectOf(e, ctx) }; return { kind: "opaque", reason: e?.type ?? "empty" }; }
    case "comment": return undefined;
    default: return { kind: "opaque", reason: s.type };
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
    case "identifier": { const i = ctx.inputs.get(n.text); return i === undefined ? { kind: "unknown", reason: "free-name" } : { kind: "input", index: i }; }
    case "integer": case "float": return { kind: "literal", literal: canonNumber(n.text) };
    case "string": return { kind: "literal", literal: canonString(n.text) };
    case "true": return { kind: "literal", literal: { type: "boolean", value: true } };
    case "false": return { kind: "literal", literal: { type: "boolean", value: false } };
    case "none": return { kind: "literal", literal: { type: "absent" } };
    case "call": { // Decimal("25000.00"), int("5"): a numeric constructor over a literal is the literal
      const f = n.childForFieldName("function")!.text; const a = children(n.childForFieldName("arguments")!)[0];
      if (["Decimal", "int", "float", "Fraction"].includes(f) && a) return { kind: "literal", literal: canonNumber(a.text) };
      return { kind: "unknown", reason: "call" };
    }
    case "parenthesized_expression": return operand(children(n)[0], ctx);
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
      const op = OPS[opText]; if (!op) return { kind: "opaque", reason: `comparison ${opText}` };
      return { kind: "compare", op, left: operand(kids[0], ctx), right: operand(kids[1], ctx) };
    }
    case "call": { // x.is_none() style helpers are not Python; a bare call in a condition is opaque
      return { kind: "opaque", reason: "call-in-condition" };
    }
    case "identifier": return { kind: "truthy", operand: operand(n, ctx), negated: false };
    default: return { kind: "opaque", reason: n.type };
  }
}
