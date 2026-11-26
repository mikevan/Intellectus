// The semantic intermediate representation (founding design, section 6). Language-neutral; no identifiers, comments,
// message text, or formatting. Literals are canonical. Strings enter only where they take part in predicates, state,
// protocols, identity, or externally observable effects.
import { createHash } from "node:crypto";

export const IR_SCHEMA = 5; // 5: statements are classified semantic, non-semantic or metadata (IR-9). // 4: a member call keeps the receiver it acts on (IR-7 Receiver). // 2: bindings as named values (IR-1). 3: normalised opaque categories and canonical
// single-use inlining (IR-2).

/** What an unrepresented construct is, in language-neutral terms. An adapter maps its own node types onto this list
 * and the grammar's own vocabulary never reaches the IR: two grammars must not disagree merely because they use
 * different words for what neither of them can yet represent. */
export const OPAQUE_CATEGORIES = ["loop", "multi-branch", "exception-handling", "concurrency", "declaration",
  // C-2: a suspension that hands a value to a consumer, and a suspension that hands a resource to a caller's scope
  // and resumes to release it. Both were "other", which is a failure to understand rather than a category.
  "value-stream-emission", "scoped-resource-handoff",
  // C-3: the consumer side of the same protocol. A scope acquires a resource, runs under its lifetime, and
  // releases it on every exit. Kept separate from scoped-resource-handoff on purpose: one is the implementer
  // handing a resource into a caller's scope, the other is the scope that holds it, and merging them would erase
  // the direction and the lifecycle role. Their correspondence is a relationship to record later, not a merge.
  "scoped-resource",
  // C-4: execution constructs a function value and binds it within an enclosing executable scope. That is what the
  // syntax proves and no more. Whether the constructed callable captures an enclosing binding is a property of the
  // callable and its environment, not of the statement, and three of radon's six nested defs capture nothing; a
  // closure category would therefore have been a false claim about half of them. Capture is derivable from source
  // syntax but NOT from this IR, which keeps no identifiers, so it belongs to a later representation step.
  "local-function-construction",
  // C-5: a standalone awaited expression whose operand the adapter cannot otherwise represent as a semantic
  // statement, where normal continuation depends on completion of the awaited computation. Narrow on purpose: a
  // standalone `await foo()` stays a represented call effect with its await ERASED, as do `x = await foo()` and
  // `return await foo()`. Naming the dependency never costs a represented fact. Those three erasures are the
  // evidence R-1 opens on: await is not yet a composable property of an expression in this IR.
  "completion-dependency",
  "other"] as const;
export type OpaqueCategory = (typeof OPAQUE_CATEGORIES)[number];
// C-2 widened this list without changing the structure of the IR, so ir_schema stays 5 and this vocabulary is
// frozen separately (frozen-c2). A consumer that hard-codes the schema-5 category list can therefore reject a
// valid schema-5 document: ir_schema alone does not identify the vocabulary revision. Recorded as a finding in
// docs/experiment-log.md; a separate vocabulary version may be the answer, and is not decided here.

/** IR-9. What kind of statement this is, decided on execution semantics and nothing else.
 *
 *  SEMANTIC      execution behaviour: an assignment, a call, a yield, a raise, a loop, a branch, a with, a try.
 *                Only an unrepresented SEMANTIC statement counts toward opacity.
 *  NON_SEMANTIC  no execution semantics at all: a docstring, a bare string statement, `pass`, a comment. That a
 *                docstring is readable at runtime as __doc__ does not make the statement execution behaviour; a
 *                program that reads __doc__ does so through an attribute access, which is semantic in its own right.
 *  METADATA      binds or annotates without being execution behaviour: an import, a bare type annotation,
 *                `global`, `nonlocal`. Counted separately and outside the opacity numerator and denominator.
 *
 *  The boundaries were decided before the measurement; see docs/experiment-log.md, IR-9. */
export const STATEMENT_CLASSES = ["SEMANTIC", "NON_SEMANTIC", "METADATA"] as const;
export type StatementClass = (typeof STATEMENT_CLASSES)[number];

export type CanonLiteral =
  | { type: "number"; value: string }          // decimal string, normalised: "25000"
  | { type: "string"; value: string }          // a protocol, state, or identity value
  | { type: "boolean"; value: boolean }
  | { type: "absent" };                        // None, null, undefined, is_none()

export type CompareOp = "EQ" | "NE" | "GT" | "GE" | "LT" | "LE";
export type Operand =
  | { kind: "input"; index: number }
  | { kind: "literal"; literal: CanonLiteral }
  | { kind: "value"; id: number }              // a value bound earlier in this function, by position, never by name
  | { kind: "negated"; operand: Operand }      // -x, whatever each grammar calls the node
  | { kind: "read"; object: Operand; property: string }  // a named place read from something
  | { kind: "computed"; expr: Expr }           // a value used once where it is computed, after inlining
  | { kind: "behaviour"; inputs: number; body: Stmt[] }  // a function passed as a value: behaviour as data
  | { kind: "unknown"; reason: string };

/** What a binding computes. Kept complete enough that a future emitter could render it back; nothing lexical except
 * names that are externally observable (a called operation, a property that names state or protocol). */
export type Expr =
  | { kind: "operand"; operand: Operand }
  | { kind: "call"; operation?: string; args: Operand[]; receiver?: Operand }   // IR-7: the entity the operation acts on
  | { kind: "member"; object: Operand; property: string }
  | { kind: "index"; object: Operand; at: Operand }
  | { kind: "arith"; op: "ADD" | "SUB" | "MUL" | "DIV" | "MOD" | "CONCAT"; left: Operand; right: Operand }
  | { kind: "test"; predicate: Predicate }     // a condition used as a value
  | { kind: "choose"; predicate: Predicate; whenTrue: Operand; whenFalse: Operand }
  | { kind: "unknown"; reason: string };

export type Predicate =
  | { kind: "compare"; op: CompareOp; left: Operand; right: Operand }
  | { kind: "absent"; operand: Operand; negated: boolean }
  | { kind: "and"; operands: Predicate[] }
  | { kind: "or"; operands: Predicate[] }
  | { kind: "not"; operand: Predicate }
  | { kind: "truthy"; operand: Operand; negated: boolean }
  | { kind: "opaque"; category: OpaqueCategory }
  | { kind: "opaque"; category: OpaqueCategory };

export type EffectKind = "READ" | "WRITE" | "EMIT" | "CALL_EXTERNAL" | "THROW" | "RETURN";
export interface Effect { kind: EffectKind; operation?: string; args: Operand[]; receiver?: Operand }

export type Stmt =
  | { kind: "branch"; predicate: Predicate; then: Stmt[]; else: Stmt[] }
  | { kind: "bind"; id: number; expr: Expr }   // a local binding or an assignment to a local: a value, positionally identified
  | { kind: "return"; value?: Operand }
  | { kind: "throw"; value?: Operand }
  | { kind: "effect"; effect: Effect }
  | { kind: "opaque"; category: OpaqueCategory; statementClass: StatementClass };

export interface FunctionIR { inputs: number; body: Stmt[] }

// ---- canonical form ----

/** Count how many times each bound value is read anywhere in a body. */
function readCounts(body: Stmt[], counts = new Map<number, number>()): Map<number, number> {
  const bump = (o: Operand | undefined): void => {
    if (!o) return;
    if (o.kind === "value") counts.set(o.id, (counts.get(o.id) ?? 0) + 1);
    else if (o.kind === "negated") bump(o.operand);
    else if (o.kind === "read") bump(o.object);
    else if (o.kind === "computed") inExprRef.fn(o.expr);
  };
  const inExprRef: { fn: (e: Expr) => void } = { fn: () => {} };
  const inPred = (p: Predicate): void => {
    switch (p.kind) {
      case "compare": bump(p.left); bump(p.right); break;
      case "absent": case "truthy": bump(p.operand); break;
      case "and": case "or": p.operands.forEach(inPred); break;
      case "not": inPred(p.operand); break;
      default: break;
    }
  };
  const inExpr = (e: Expr): void => {
    switch (e.kind) {
      case "operand": bump(e.operand); break;
      case "call": e.args.forEach(bump); bump(e.receiver); break;
      case "member": bump(e.object); break;
      case "index": bump(e.object); bump(e.at); break;
      case "arith": bump(e.left); bump(e.right); break;
      case "test": inPred(e.predicate); break;
      case "choose": inPred(e.predicate); bump(e.whenTrue); bump(e.whenFalse); break;
      default: break;
    }
  };
  inExprRef.fn = inExpr;
  for (const s of body) {
    if (s.kind === "bind") inExpr(s.expr);
    else if (s.kind === "branch") { inPred(s.predicate); readCounts(s.then, counts); readCounts(s.else, counts); }
    else if (s.kind === "return" || s.kind === "throw") bump(s.value);
    else if (s.kind === "effect") s.effect.args.forEach(bump);
  }
  return counts;
}

/** A value bound once and read once is a name the author chose, not a step in the computation: inline it at its use,
 * so `x = a.b; if (x >= y)` and `if (a.b >= y)` are one shape. A value read more than once, or never, stays: the
 * first because sharing is part of the meaning, the second because a dead binding is a fact about the code. A call
 * is never inlined, because moving an effect moves when it happens. */
export function canonicalise(fn: FunctionIR): FunctionIR {
  const counts = readCounts(fn.body);
  const inlinable = new Map<number, Expr>();
  const collect = (body: Stmt[]): void => {
    for (const s of body) {
      if (s.kind === "bind" && counts.get(s.id) === 1 && s.expr.kind !== "call" && s.expr.kind !== "unknown") inlinable.set(s.id, s.expr);
      else if (s.kind === "branch") { collect(s.then); collect(s.else); }
    }
  };
  collect(fn.body);
  if (inlinable.size === 0) return fn;

  const asOperand = (e: Expr): Operand | undefined => {
    if (e.kind === "operand") return e.operand;
    if (e.kind === "member") return { kind: "read", object: e.object, property: e.property };
    if (e.kind === "arith" || e.kind === "index" || e.kind === "test" || e.kind === "choose") return { kind: "computed", expr: e };
    return undefined;
  };
  const sub = (o: Operand | undefined): Operand | undefined => {
    if (!o) return o;
    if (o.kind === "value") { const e = inlinable.get(o.id); const as = e && asOperand(e); return as ? sub(as) : o; }
    if (o.kind === "negated") return { kind: "negated", operand: sub(o.operand)! };
    if (o.kind === "read") return { kind: "read", object: sub(o.object)!, property: o.property };
    if (o.kind === "computed") return { kind: "computed", expr: subExprShallow(o.expr) };
    return o;
  };
  const subExprShallow = (e: Expr): Expr => subExpr(e);
  const subPred = (p: Predicate): Predicate => {
    switch (p.kind) {
      case "compare": return { ...p, left: sub(p.left)!, right: sub(p.right)! };
      case "absent": case "truthy": return { ...p, operand: sub(p.operand)! };
      case "and": case "or": return { ...p, operands: p.operands.map(subPred) };
      case "not": return { kind: "not", operand: subPred(p.operand) };
      default: return p;
    }
  };
  const subExpr = (e: Expr): Expr => {
    switch (e.kind) {
      case "operand": return { kind: "operand", operand: sub(e.operand)! };
      case "call": return { ...e, args: e.args.map((a) => sub(a)!), receiver: e.receiver ? sub(e.receiver) : undefined };
      case "member": return { ...e, object: sub(e.object)! };
      case "index": return { ...e, object: sub(e.object)!, at: sub(e.at)! };
      case "arith": return { ...e, left: sub(e.left)!, right: sub(e.right)! };
      case "test": return { kind: "test", predicate: subPred(e.predicate) };
      case "choose": return { kind: "choose", predicate: subPred(e.predicate), whenTrue: sub(e.whenTrue)!, whenFalse: sub(e.whenFalse)! };
      default: return e;
    }
  };
  const rewrite = (body: Stmt[]): Stmt[] => body.flatMap((s): Stmt[] => {
    if (s.kind === "bind") return inlinable.has(s.id) && asOperand(s.expr) ? [] : [{ ...s, expr: subExpr(s.expr) }];
    if (s.kind === "branch") return [{ kind: "branch", predicate: subPred(s.predicate), then: rewrite(s.then), else: rewrite(s.else) }];
    if (s.kind === "return" || s.kind === "throw") return [{ ...s, value: sub(s.value) }];
    if (s.kind === "effect") return [{ kind: "effect", effect: { ...s.effect, args: s.effect.args.map((a) => sub(a)!) } }];
    return [s];
  });
  return { inputs: fn.inputs, body: rewrite(fn.body) };
}

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
    case "opaque": return p; // an unrepresented condition cannot be negated meaningfully; the category is what is known
  }
}

function key(x: unknown): string { return JSON.stringify(x); }

/** The semantic projection of a function: every effect and return with the path condition under which it is reached. */
export interface Projection { inputs: number; outcomes: { under: Predicate | null; what: Effect | { kind: "return"; value?: Operand } | { kind: "throw"; value?: Operand } | { kind: "bind"; id: number; expr: Expr } }[] }

export function project(input: FunctionIR): Projection {
  const fn = canonicalise(input);
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
      else if (s.kind === "bind") {
        // A binding is part of the data flow, and a call inside it is still an effect the reader must account for.
        // the effect half of a bound call must carry the same receiver as the binding half, or ingestion sees two
        // different call sites where the source has one. Found by the receiver count after IR-7.
        if (s.expr.kind === "call") outcomes.push({ under: cond(live), what: { kind: "CALL_EXTERNAL", operation: s.expr.operation, args: s.expr.args, receiver: s.expr.receiver } });
        outcomes.push({ under: cond(live), what: { kind: "bind", id: s.id, expr: s.expr } });
      }
      else if (s.kind === "effect") outcomes.push({ under: cond(live), what: s.effect });
      else if (s.kind === "opaque" && s.statementClass === "SEMANTIC")
        outcomes.push({ under: cond(live), what: { kind: "CALL_EXTERNAL", operation: `opaque:${s.category}`, args: [] } });
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

/** Effects and bindings, dropping bare returns with no value: the part E1 compares first. */
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
