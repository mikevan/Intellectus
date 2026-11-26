// The semantic intermediate representation (founding design, section 6). Language-neutral; no identifiers, comments,
// message text, or formatting. Literals are canonical. Strings enter only where they take part in predicates, state,
// protocols, identity, or externally observable effects.
import { createHash } from "node:crypto";
export const IR_SCHEMA = 6; // 6: completion dependency as a composable expression modifier `awaited`, and the `evaluate` statement carrier (R-1A). // 5: statements are classified semantic, non-semantic or metadata (IR-9). // 4: a member call keeps the receiver it acts on (IR-7 Receiver). // 2: bindings as named values (IR-1). 3: normalised opaque categories and canonical
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
    "other"];
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
export const STATEMENT_CLASSES = ["SEMANTIC", "NON_SEMANTIC", "METADATA"];
// ---- canonical form ----
/** Count how many times each bound value is read anywhere in a body. */
function readCounts(body, counts = new Map()) {
    const bump = (o) => {
        if (!o)
            return;
        if (o.kind === "value")
            counts.set(o.id, (counts.get(o.id) ?? 0) + 1);
        else if (o.kind === "negated")
            bump(o.operand);
        else if (o.kind === "read")
            bump(o.object);
        else if (o.kind === "computed")
            inExprRef.fn(o.expr);
    };
    const inExprRef = { fn: () => { } };
    const inPred = (p) => {
        switch (p.kind) {
            case "compare":
                bump(p.left);
                bump(p.right);
                break;
            case "absent":
            case "truthy":
                bump(p.operand);
                break;
            case "and":
            case "or":
                p.operands.forEach(inPred);
                break;
            case "not":
                inPred(p.operand);
                break;
            default: break;
        }
    };
    const inExpr = (e) => {
        switch (e.kind) {
            case "operand":
                bump(e.operand);
                break;
            case "call":
                e.args.forEach(bump);
                bump(e.receiver);
                break;
            case "member":
                bump(e.object);
                break;
            case "index":
                bump(e.object);
                bump(e.at);
                break;
            case "arith":
                bump(e.left);
                bump(e.right);
                break;
            case "test":
                inPred(e.predicate);
                break;
            case "choose":
                inPred(e.predicate);
                bump(e.whenTrue);
                bump(e.whenFalse);
                break;
            case "awaited":
                inExpr(e.of);
                break;
            default: break;
        }
    };
    inExprRef.fn = inExpr;
    for (const s of body) {
        if (s.kind === "bind" || s.kind === "evaluate")
            inExpr(s.expr);
        else if (s.kind === "branch") {
            inPred(s.predicate);
            readCounts(s.then, counts);
            readCounts(s.else, counts);
        }
        else if (s.kind === "return" || s.kind === "throw")
            bump(s.value);
        else if (s.kind === "effect")
            s.effect.args.forEach(bump);
    }
    return counts;
}
/** A value bound once and read once is a name the author chose, not a step in the computation: inline it at its use,
 * so `x = a.b; if (x >= y)` and `if (a.b >= y)` are one shape. A value read more than once, or never, stays: the
 * first because sharing is part of the meaning, the second because a dead binding is a fact about the code. A call
 * is never inlined, because moving an effect moves when it happens. */
export function canonicalise(fn) {
    const counts = readCounts(fn.body);
    const inlinable = new Map();
    const collect = (body) => {
        for (const s of body) {
            if (s.kind === "bind" && counts.get(s.id) === 1 && s.expr.kind !== "call" && s.expr.kind !== "unknown" && s.expr.kind !== "awaited")
                inlinable.set(s.id, s.expr);
            else if (s.kind === "branch") {
                collect(s.then);
                collect(s.else);
            }
        }
    };
    collect(fn.body);
    if (inlinable.size === 0)
        return fn;
    const asOperand = (e) => {
        if (e.kind === "operand")
            return e.operand;
        if (e.kind === "member")
            return { kind: "read", object: e.object, property: e.property };
        if (e.kind === "arith" || e.kind === "index" || e.kind === "test" || e.kind === "choose")
            return { kind: "computed", expr: e };
        return undefined;
    };
    const sub = (o) => {
        if (!o)
            return o;
        if (o.kind === "value") {
            const e = inlinable.get(o.id);
            const as = e && asOperand(e);
            return as ? sub(as) : o;
        }
        if (o.kind === "negated")
            return { kind: "negated", operand: sub(o.operand) };
        if (o.kind === "read")
            return { kind: "read", object: sub(o.object), property: o.property };
        if (o.kind === "computed")
            return { kind: "computed", expr: subExprShallow(o.expr) };
        return o;
    };
    const subExprShallow = (e) => subExpr(e);
    const subPred = (p) => {
        switch (p.kind) {
            case "compare": return { ...p, left: sub(p.left), right: sub(p.right) };
            case "absent":
            case "truthy": return { ...p, operand: sub(p.operand) };
            case "and":
            case "or": return { ...p, operands: p.operands.map(subPred) };
            case "not": return { kind: "not", operand: subPred(p.operand) };
            default: return p;
        }
    };
    const subExpr = (e) => {
        switch (e.kind) {
            case "operand": return { kind: "operand", operand: sub(e.operand) };
            case "call": return { ...e, args: e.args.map((a) => sub(a)), receiver: e.receiver ? sub(e.receiver) : undefined };
            case "member": return { ...e, object: sub(e.object) };
            case "index": return { ...e, object: sub(e.object), at: sub(e.at) };
            case "arith": return { ...e, left: sub(e.left), right: sub(e.right) };
            case "test": return { kind: "test", predicate: subPred(e.predicate) };
            case "choose": return { kind: "choose", predicate: subPred(e.predicate), whenTrue: sub(e.whenTrue), whenFalse: sub(e.whenFalse) };
            case "awaited": return { kind: "awaited", of: subExpr(e.of) };
            default: return e;
        }
    };
    const rewrite = (body) => body.flatMap((s) => {
        if (s.kind === "bind")
            return inlinable.has(s.id) && asOperand(s.expr) ? [] : [{ ...s, expr: subExpr(s.expr) }];
        if (s.kind === "branch")
            return [{ kind: "branch", predicate: subPred(s.predicate), then: rewrite(s.then), else: rewrite(s.else) }];
        if (s.kind === "return" || s.kind === "throw")
            return [{ ...s, value: sub(s.value) }];
        if (s.kind === "effect")
            return [{ kind: "effect", effect: { ...s.effect, args: s.effect.args.map((a) => sub(a)) } }];
        if (s.kind === "evaluate")
            return [{ kind: "evaluate", expr: subExpr(s.expr) }];
        return [s];
    });
    return { inputs: fn.inputs, body: rewrite(fn.body) };
}
// ---- normalisation ----
const FLIP = { EQ: "NE", NE: "EQ", GT: "LE", LE: "GT", GE: "LT", LT: "GE" };
const MIRROR = { EQ: "EQ", NE: "NE", GT: "LT", LT: "GT", GE: "LE", LE: "GE" };
/** Push negations to the atoms and put inputs on the left of comparisons. */
export function normalise(p, negate = false) {
    switch (p.kind) {
        case "not": return normalise(p.operand, !negate);
        case "and":
        case "or": {
            const kind = negate ? (p.kind === "and" ? "or" : "and") : p.kind;
            const operands = p.operands.flatMap((o) => { const n = normalise(o, negate); return n.kind === kind ? n.operands : [n]; });
            operands.sort((a, b) => key(a).localeCompare(key(b)));
            return operands.length === 1 ? operands[0] : { kind, operands };
        }
        case "compare": {
            let { op, left, right } = p;
            if (left.kind === "literal" && right.kind !== "literal") {
                [left, right] = [right, left];
                op = MIRROR[op];
            }
            return { kind: "compare", op: negate ? FLIP[op] : op, left, right };
        }
        case "absent": return { ...p, negated: negate ? !p.negated : p.negated };
        case "truthy": return { ...p, negated: negate ? !p.negated : p.negated };
        case "opaque": return p; // an unrepresented condition cannot be negated meaningfully; the category is what is known
    }
}
function key(x) { return JSON.stringify(x); }
/** Strip every `awaited` wrapper. What remains is the evaluation whose facts must be unchanged by R-1A. */
export function unwrapAwaited(e) {
    let depth = 0;
    let inner = e;
    while (inner.kind === "awaited") {
        inner = inner.of;
        depth++;
    }
    return { inner, depth };
}
export function project(input) {
    const fn = canonicalise(input);
    const outcomes = [];
    let ordinal = 0; // the walk order of statements: formatting-invariant provenance for an await point
    const walk = (stmts, path) => {
        let live = path; // conditions accumulated by early returns above
        for (const s of stmts) {
            ordinal++;
            if (s.kind === "branch") {
                const t = [...live, s.predicate];
                const e = [...live, { kind: "not", operand: s.predicate }];
                walk(s.then, t);
                walk(s.else, e);
                // if the then-branch always exits, the rest of the sequence runs under the negation (the early-return shape)
                if (alwaysExits(s.then) && !alwaysExits(s.else))
                    live = e;
                else if (alwaysExits(s.else) && !alwaysExits(s.then))
                    live = t;
                else if (alwaysExits(s.then) && alwaysExits(s.else))
                    return;
            }
            else if (s.kind === "return" || s.kind === "throw") {
                outcomes.push({ under: cond(live), what: { kind: s.kind, value: s.value } });
                // R-1A: an await inside the returned value is a completion dependency of the return.
                if (s.value?.kind === "computed")
                    dependencies(s.value.expr, cond(live), s.kind, ordinal, outcomes);
                return;
            }
            else if (s.kind === "bind") {
                // A binding is part of the data flow, and a call inside it is still an effect the reader must account for.
                // the effect half of a bound call must carry the same receiver as the binding half, or ingestion sees two
                // different call sites where the source has one. Found by the receiver count after IR-7.
                // R-1A: the call's outcome is emitted exactly as before whether or not the binding awaits it (monotonicity);
                // the dependency is a separate outcome that references it.
                const { inner } = unwrapAwaited(s.expr);
                if (inner.kind === "call")
                    outcomes.push({ under: cond(live), what: { kind: "CALL_EXTERNAL", operation: inner.operation, args: inner.args, receiver: inner.receiver } });
                outcomes.push({ under: cond(live), what: { kind: "bind", id: s.id, expr: s.expr } });
                dependencies(s.expr, cond(live), "bind", ordinal, outcomes);
            }
            else if (s.kind === "effect")
                outcomes.push({ under: cond(live), what: s.effect });
            else if (s.kind === "evaluate") {
                // R-1A: a standalone awaited expression. Its inner call, if any, is the same CALL_EXTERNAL outcome a plain
                // call statement produces (monotonicity); a non-call operand gets no manufactured outcome.
                const { inner } = unwrapAwaited(s.expr);
                if (inner.kind === "call")
                    outcomes.push({ under: cond(live), what: { kind: "CALL_EXTERNAL", operation: inner.operation, args: inner.args, receiver: inner.receiver } });
                dependencies(s.expr, cond(live), "evaluate", ordinal, outcomes);
            }
            else if (s.kind === "opaque" && s.statementClass === "SEMANTIC")
                outcomes.push({ under: cond(live), what: { kind: "CALL_EXTERNAL", operation: `opaque:${s.category}`, args: [] } });
        }
    };
    walk(fn.body, []);
    outcomes.sort((a, b) => key(a).localeCompare(key(b)));
    return { inputs: fn.inputs, outcomes };
}
/** R-1A. One COMPLETION_DEPENDENCY outcome per `awaited` level in `e`, outermost first. The target is the inner
 * evaluation's projected call outcome when it has one, otherwise the inner operand; nothing is manufactured. */
function dependencies(e, under, form, statement, outcomes) {
    let depth = 0;
    for (let cur = e; cur.kind === "awaited"; cur = cur.of) {
        depth++;
        const { inner } = unwrapAwaited(cur.of);
        const on = cur.of.kind !== "awaited" && inner.kind === "call"
            ? { kind: "outcome", outcome: { under, what: { kind: "CALL_EXTERNAL", operation: inner.operation, args: inner.args, receiver: inner.receiver } } }
            : { kind: "evaluation", operand: cur.of.kind === "operand" ? cur.of.operand : { kind: "computed", expr: cur.of } };
        outcomes.push({ under, what: { kind: "COMPLETION_DEPENDENCY", on, at: { form, statement }, depth } });
    }
}
function alwaysExits(stmts) {
    const last = stmts[stmts.length - 1];
    if (!last)
        return false;
    if (last.kind === "return" || last.kind === "throw")
        return true;
    if (last.kind === "branch")
        return alwaysExits(last.then) && alwaysExits(last.else);
    return false;
}
function cond(path) { return path.length ? normalise({ kind: "and", operands: path }) : null; }
/** Effects and bindings, dropping bare returns with no value: the part E1 compares first. */
export function effectProjection(fn) {
    return project(fn).outcomes.filter((o) => !(o.what.kind === "return" && o.what.value === undefined));
}
/** R-1A. Provenance is not semantics. The await point's \`at\` is kept on the projected outcome for auditing and left
 * out of the fingerprint, because the walk ordinal of a statement differs between a nested-if spelling and an
 * early-return chain of the same logic. X2 caught exactly that: the section-16 pair diverged on \`at.statement\` alone. */
export function withoutProvenance(outcomes) {
    return outcomes.map((o) => (o.what.kind === "COMPLETION_DEPENDENCY" ? { under: o.under, what: { kind: o.what.kind, on: o.what.on, depth: o.what.depth } } : o));
}
export function fingerprint(fn) {
    return createHash("sha256").update(JSON.stringify({ ir: IR_SCHEMA, inputs: fn.inputs, outcomes: withoutProvenance(effectProjection(fn)) })).digest("hex").slice(0, 24);
}
// ---- canonical literals ----
export function canonNumber(text) {
    const cleaned = text.replace(/[_,$\s]/g, "").replace(/^["']|["']$/g, "");
    const m = /^-?\d+(?:\.\d+)?$/.exec(cleaned);
    if (!m)
        return { type: "string", value: cleaned };
    let v = cleaned;
    if (v.includes("."))
        v = v.replace(/\.?0+$/, "");
    if (v === "-0" || v === "")
        v = "0";
    return { type: "number", value: v };
}
export function canonString(text) { return { type: "string", value: text.replace(/^(["'`])(.*)\1$/s, "$2") }; }
/** A path literal is stored one way on every platform: forward slashes, no drive letter case surprises, no leading "./". */
export function canonPath(p) {
    return p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^([A-Za-z]):\//, (_m, d) => `${d.toUpperCase()}:/`);
}
