// The semantic intermediate representation (founding design, section 6). Language-neutral; no identifiers, comments,
// message text, or formatting. Literals are canonical. Strings enter only where they take part in predicates, state,
// protocols, identity, or externally observable effects.
import { createHash } from "node:crypto";

export const IR_SCHEMA = 1;

export type CanonLiteral =
  | { type: "number"; value: string }          // decimal string, normalised: "25000"
  | { type: "string"; value: string }          // a protocol, state, or identity value
  | { type: "boolean"; value: boolean }
  | { type: "absent" };                        // None, null, undefined, is_none()

export type CompareOp = "EQ" | "NE" | "GT" | "GE" | "LT" | "LE";
export type Operand = { kind: "input"; index: number } | { kind: "literal"; literal: CanonLiteral } | { kind: "unknown"; reason: string };

export type Predicate =
  | { kind: "compare"; op: CompareOp; left: Operand; right: Operand }
  | { kind: "absent"; operand: Operand; negated: boolean }
  | { kind: "and"; operands: Predicate[] }
  | { kind: "or"; operands: Predicate[] }
  | { kind: "not"; operand: Predicate }
  | { kind: "truthy"; operand: Operand; negated: boolean }
  | { kind: "opaque"; reason: string };

export type EffectKind = "READ" | "WRITE" | "EMIT" | "CALL_EXTERNAL" | "THROW" | "RETURN";
export interface Effect { kind: EffectKind; operation?: string; args: Operand[] }

export type Stmt =
  | { kind: "branch"; predicate: Predicate; then: Stmt[]; else: Stmt[] }
  | { kind: "return"; value?: Operand }
  | { kind: "throw"; value?: Operand }
  | { kind: "effect"; effect: Effect }
  | { kind: "opaque"; reason: string };

export interface FunctionIR { inputs: number; body: Stmt[] }

// ---- normalisation ----

const FLIP: Record<CompareOp, CompareOp> = { EQ: "NE", NE: "EQ", GT: "LE", LE: "GT", GE: "LT", LT: "GE" };
const MIRROR: Record<CompareOp, CompareOp> = { EQ: "EQ", NE: "NE", GT: "LT", LT: "GT", GE: "LE", LE: "GE" };

/** Push negations to the atoms and put inputs on the left of comparisons. */
export function normalise(p: Predicate, negate = false): Predicate {
  switch (p.kind) {
    case "not": return normalise(p.operand, !negate);
    case "and": case "or": {
      const kind = negate ? (p.kind === "and" ? "or" : "and") : p.kind;
      const operands = p.operands.flatMap((o) => { const n = normalise(o, negate); return n.kind === kind ? n.operands : [n]; });
      operands.sort((a, b) => key(a).localeCompare(key(b)));
      return operands.length === 1 ? operands[0] : { kind, operands };
    }
    case "compare": {
      let { op, left, right } = p;
      if (left.kind === "literal" && right.kind !== "literal") { [left, right] = [right, left]; op = MIRROR[op]; }
      return { kind: "compare", op: negate ? FLIP[op] : op, left, right };
    }
    case "absent": return { ...p, negated: negate ? !p.negated : p.negated };
    case "truthy": return { ...p, negated: negate ? !p.negated : p.negated };
    case "opaque": return negate ? { kind: "opaque", reason: `not(${p.reason})` } : p;
  }
}

function key(x: unknown): string { return JSON.stringify(x); }

/** The semantic projection of a function: every effect and return with the path condition under which it is reached. */
export interface Projection { inputs: number; outcomes: { under: Predicate | null; what: Effect | { kind: "return"; value?: Operand } | { kind: "throw"; value?: Operand } }[] }

export function project(fn: FunctionIR): Projection {
  const outcomes: Projection["outcomes"] = [];
  const walk = (stmts: Stmt[], path: Predicate[]) => {
    let live: Predicate[] = path; // conditions accumulated by early returns above
    for (const s of stmts) {
      if (s.kind === "branch") {
        const t = [...live, s.predicate]; const e = [...live, { kind: "not", operand: s.predicate } as Predicate];
        walk(s.then, t); walk(s.else, e);
        // if the then-branch always exits, the rest of the sequence runs under the negation (the early-return shape)
        if (alwaysExits(s.then) && !alwaysExits(s.else)) live = e;
        else if (alwaysExits(s.else) && !alwaysExits(s.then)) live = t;
        else if (alwaysExits(s.then) && alwaysExits(s.else)) return;
      } else if (s.kind === "return" || s.kind === "throw") { outcomes.push({ under: cond(live), what: { kind: s.kind, value: s.value } }); return; }
      else if (s.kind === "effect") outcomes.push({ under: cond(live), what: s.effect });
      else outcomes.push({ under: cond(live), what: { kind: "CALL_EXTERNAL", operation: `opaque:${s.reason}`, args: [] } });
    }
  };
  walk(fn.body, []);
  outcomes.sort((a, b) => key(a).localeCompare(key(b)));
  return { inputs: fn.inputs, outcomes };
}

function alwaysExits(stmts: Stmt[]): boolean {
  const last = stmts[stmts.length - 1];
  if (!last) return false;
  if (last.kind === "return" || last.kind === "throw") return true;
  if (last.kind === "branch") return alwaysExits(last.then) && alwaysExits(last.else);
  return false;
}
function cond(path: Predicate[]): Predicate | null { return path.length ? normalise({ kind: "and", operands: path }) : null; }

/** Effects only, dropping bare returns with no value: the part E1 compares first. */
export function effectProjection(fn: FunctionIR): Projection["outcomes"] {
  return project(fn).outcomes.filter((o) => !(o.what.kind === "return" && o.what.value === undefined));
}

export function fingerprint(fn: FunctionIR): string {
  return createHash("sha256").update(JSON.stringify({ ir: IR_SCHEMA, inputs: fn.inputs, outcomes: effectProjection(fn) })).digest("hex").slice(0, 24);
}

// ---- canonical literals ----
export function canonNumber(text: string): CanonLiteral {
  const cleaned = text.replace(/[_,$\s]/g, "").replace(/^["']|["']$/g, "");
  const m = /^-?\d+(?:\.\d+)?$/.exec(cleaned);
  if (!m) return { type: "string", value: cleaned };
  let v = cleaned;
  if (v.includes(".")) v = v.replace(/\.?0+$/, "");
  if (v === "-0" || v === "") v = "0";
  return { type: "number", value: v };
}
export function canonString(text: string): CanonLiteral { return { type: "string", value: text.replace(/^(["'`])(.*)\1$/s, "$2") }; }

/** A path literal is stored one way on every platform: forward slashes, no drive letter case surprises, no leading "./". */
export function canonPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^([A-Za-z]):\//, (_m, d: string) => `${d.toUpperCase()}:/`);
}
