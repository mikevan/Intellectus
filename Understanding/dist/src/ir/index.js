// The semantic intermediate representation (founding design, section 6). Language-neutral; no identifiers, comments,
// message text, or formatting. Literals are canonical. Strings enter only where they take part in predicates, state,
// protocols, identity, or externally observable effects.
import { createHash } from "node:crypto";
export const IR_SCHEMA = 3; // 2: bindings as named values (IR-1). 3: normalised opaque categories and canonical
// single-use inlining (IR-2).
/** What an unrepresented construct is, in language-neutral terms. An adapter maps its own node types onto this list
 * and the grammar's own vocabulary never reaches the IR: two grammars must not disagree merely because they use
 * different words for what neither of them can yet represent. */
export const OPAQUE_CATEGORIES = ["loop", "multi-branch", "exception-handling", "concurrency", "declaration", "other"];
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
            default: break;
        }
    };
    inExprRef.fn = inExpr;
    for (const s of body) {
        if (s.kind === "bind")
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
            if (s.kind === "bind" && counts.get(s.id) === 1 && s.expr.kind !== "call" && s.expr.kind !== "unknown")
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
            case "call": return { ...e, args: e.args.map((a) => sub(a)) };
            case "member": return { ...e, object: sub(e.object) };
            case "index": return { ...e, object: sub(e.object), at: sub(e.at) };
            case "arith": return { ...e, left: sub(e.left), right: sub(e.right) };
            case "test": return { kind: "test", predicate: subPred(e.predicate) };
            case "choose": return { kind: "choose", predicate: subPred(e.predicate), whenTrue: sub(e.whenTrue), whenFalse: sub(e.whenFalse) };
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
export function project(input) {
    const fn = canonicalise(input);
    const outcomes = [];
    const walk = (stmts, path) => {
        let live = path; // conditions accumulated by early returns above
        for (const s of stmts) {
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
                return;
            }
            else if (s.kind === "bind") {
                // A binding is part of the data flow, and a call inside it is still an effect the reader must account for.
                if (s.expr.kind === "call")
                    outcomes.push({ under: cond(live), what: { kind: "CALL_EXTERNAL", operation: s.expr.operation, args: s.expr.args } });
                outcomes.push({ under: cond(live), what: { kind: "bind", id: s.id, expr: s.expr } });
            }
            else if (s.kind === "effect")
                outcomes.push({ under: cond(live), what: s.effect });
            else
                outcomes.push({ under: cond(live), what: { kind: "CALL_EXTERNAL", operation: `opaque:${s.category}`, args: [] } });
        }
    };
    walk(fn.body, []);
    outcomes.sort((a, b) => key(a).localeCompare(key(b)));
    return { inputs: fn.inputs, outcomes };
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
export function fingerprint(fn) {
    return createHash("sha256").update(JSON.stringify({ ir: IR_SCHEMA, inputs: fn.inputs, outcomes: effectProjection(fn) })).digest("hex").slice(0, 24);
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
