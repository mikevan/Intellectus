// R-1A. The first representational change since IR-9: a completion dependency as a composable expression modifier.
// Every assertion here is one of the frozen protocol's controls (docs/experiment-log.md, "R-1A ... frozen before the
// work"): N1 to N6, the positive control with its condition, X1 to X3, and monotonicity at the projection level
// against the C-5 projections recorded in golden-c5-await.json BEFORE the encoder changed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { encodeFunctions as py } from "../../src/adapters/python/index.js";
import { encodeFunctions as ts } from "../../src/adapters/typescript/index.js";
import { effectProjection, fingerprint, withoutProvenance, IR_SCHEMA, OPAQUE_CATEGORIES } from "../../src/ir/index.js";
import { Journal } from "../../src/journal/index.js";
import { ingest } from "../../src/ingest/index.js";
import { classifyLoss } from "../../src/query/loss.js";
const GOLDEN = JSON.parse(readFileSync("test/ir/golden-c5-await.json", "utf8"));
const fn = async (l, src) => (await (l === "ts" ? ts : py)(src)).get("f");
const fp = async (l, src) => fingerprint(await fn(l, src));
const proj = async (l, src) => effectProjection(await fn(l, src));
const FORMS = {
    ts_standalone_name: ["ts", "async function f(ready) { await ready; }"],
    ts_standalone_call: ["ts", "async function f(x) { await foo(x); }"],
    ts_bound: ["ts", "async function f(x) { const y = await foo(x); return y; }"],
    ts_return: ["ts", "async function f(x) { return await foo(x); }"],
    py_standalone_name: ["py", "async def f(ready):\n    await ready\n"],
    py_standalone_call: ["py", "async def f(x):\n    await foo(x)\n"],
    py_bound: ["py", "async def f(x):\n    y = await foo(x)\n    return y\n"],
    py_return: ["py", "async def f(x):\n    return await foo(x)\n"],
};
/** Remove every `awaited` wrapper and every COMPLETION_DEPENDENCY outcome: what must be left is exactly C-5. */
function strip(x) {
    if (Array.isArray(x))
        return x.filter((o) => !(o?.what?.kind === "COMPLETION_DEPENDENCY")).map(strip);
    if (x && typeof x === "object") {
        const o = x;
        if (o.kind === "awaited")
            return strip(o.of);
        return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, strip(v)]));
    }
    return x;
}
test("schema 6, and the legacy schema-5 category is readable but never emitted", async () => {
    assert.equal(IR_SCHEMA, 6);
    assert.ok(OPAQUE_CATEGORIES.includes("completion-dependency"), "kept for schema-5 readers");
    for (const [, [l, src]] of Object.entries(FORMS)) {
        const body = (await fn(l, src)).body;
        assert.ok(!body.some((s) => s.kind === "opaque" && s.category === "completion-dependency"), `a schema-6 adapter emitted the legacy category for ${src}`);
    }
});
test("all four forms carry the dependency in both languages, and the standalone forms use the scoped carrier", async () => {
    for (const [name, [l, src]] of Object.entries(FORMS)) {
        const p = await proj(l, src);
        assert.ok(p.some((o) => o.what.kind === "COMPLETION_DEPENDENCY"), `${name}: no completion dependency projected`);
        const body = (await fn(l, src)).body;
        if (name.includes("standalone"))
            assert.equal(body[0].kind, "evaluate", `${name}: standalone awaited expression uses evaluate`);
    }
});
test("the tagged target: outcome when the awaited evaluation produces one, evaluation when it does not, never manufactured", async () => {
    const name = (await proj("ts", FORMS.ts_standalone_name[1])).find((o) => o.what.kind === "COMPLETION_DEPENDENCY").what;
    const call = (await proj("ts", FORMS.ts_standalone_call[1])).find((o) => o.what.kind === "COMPLETION_DEPENDENCY").what;
    assert.ok(name.kind === "COMPLETION_DEPENDENCY" && name.on.kind === "evaluation", "await ready depends on an evaluation with no outcome of its own");
    assert.ok(call.kind === "COMPLETION_DEPENDENCY" && call.on.kind === "outcome" && call.on.outcome.what.kind === "CALL_EXTERNAL", "await foo() depends on the call's own outcome");
    const outcomes = (await proj("ts", FORMS.ts_standalone_name[1])).filter((o) => o.what.kind !== "COMPLETION_DEPENDENCY");
    assert.equal(outcomes.length, 0, "no call or effect was manufactured for `ready` to give the dependency an outcome");
    for (const w of [name, call])
        assert.ok(w.kind === "COMPLETION_DEPENDENCY" && w.at.form && w.at.statement >= 1, "provenance to the await point in both forms");
});
test("N5 monotonicity at the projection level: strip the wrapper and the dependency, and C-5's projection is what remains", async () => {
    for (const [name, [l, src]] of Object.entries(FORMS)) {
        const now = strip(await proj(l, src));
        // The Python bound and returned forms are the deliberate exception: C-5 lost the call there, and R-1A must
        // match the TypeScript C-5 shape rather than preserve the loss.
        const golden = name === "py_bound" ? GOLDEN.ts_bound.projection : name === "py_return" ? GOLDEN.ts_return.projection : GOLDEN[name].projection;
        // The C-5 standalone-name form projected a pseudo-effect for the opaque statement; R-1A represents the statement
        // and emits no pseudo-effect, so what remains after stripping is nothing, and that is the improvement, not a loss.
        const expected = name.endsWith("standalone_name") ? [] : golden;
        assert.deepEqual(JSON.parse(JSON.stringify(now)), expected, `${name}: an operand fact C-5 represented is missing or changed`);
    }
});
test("N5 for a call: operation, arguments, receiver, path condition and outcome unchanged, plus exactly one dependency", async () => {
    const before = await proj("ts", "async function f(a, b) { if (a) { b.publish(a); } }");
    const after = await proj("ts", "async function f(a, b) { if (a) { await b.publish(a); } }");
    const calls = (p) => p.filter((o) => o.what.kind === "CALL_EXTERNAL");
    assert.deepEqual(calls(after), calls(before), "the call outcome is byte-identical: operation, args, receiver, path condition");
    assert.equal(after.filter((o) => o.what.kind === "COMPLETION_DEPENDENCY").length, 1);
    assert.equal(after.length, before.length + 1, "exactly one outcome was added and none removed");
});
test("N1: an awaited call statement is no longer identical to the unawaited one", async () => {
    assert.notEqual(await fp("ts", "async function f(x) { await foo(x); bar(x); }"), await fp("ts", "async function f(x) { foo(x); bar(x); }"));
    assert.notEqual(await fp("py", "async def f(x):\n    await foo(x)\n    bar(x)\n"), await fp("py", "async def f(x):\n    foo(x)\n    bar(x)\n"));
});
test("N2: a bound await is no longer identical to the unawaited binding", async () => {
    assert.notEqual(await fp("ts", FORMS.ts_bound[1]), await fp("ts", "async function f(x) { const y = foo(x); return y; }"));
    assert.notEqual(await fp("py", FORMS.py_bound[1]), await fp("py", "async def f(x):\n    y = foo(x)\n    return y\n"));
});
test("N3: a returned await is no longer identical to the unawaited return", async () => {
    assert.notEqual(await fp("ts", FORMS.ts_return[1]), await fp("ts", "async function f(x) { return foo(x); }"));
    assert.notEqual(await fp("py", FORMS.py_return[1]), await fp("py", "async def f(x):\n    return foo(x)\n"));
});
test("N4: async context alone changes nothing", async () => {
    assert.equal(await fp("ts", "async function f(x) { foo(x); return x; }"), await fp("ts", "function f(x) { foo(x); return x; }"));
    assert.equal(await fp("py", "async def f(x):\n    foo(x)\n    return x\n"), await fp("py", "def f(x):\n    foo(x)\n    return x\n"));
});
test("N6: nesting is preserved, never canonicalised: await await foo() is two dependencies", async () => {
    for (const [l, src] of [["ts", "async function f(x) { await await foo(x); }"], ["py", "async def f(x):\n    await await foo(x)\n"]]) {
        const body = (await fn(l, src)).body;
        const e = body[0].kind === "evaluate" ? body[0].expr : undefined;
        assert.ok(e && e.kind === "awaited" && e.of.kind === "awaited" && e.of.of.kind === "call", `${l}: two nested awaited modifiers around the call`);
        const deps = (await proj(l, src)).filter((o) => o.what.kind === "COMPLETION_DEPENDENCY");
        assert.equal(deps.length, 2, `${l}: two completion dependencies`);
        assert.notEqual(await fp(l, src), await fp(l, l === "ts" ? "async function f(x) { await foo(x); }" : "async def f(x):\n    await foo(x)\n"), `${l}: not collapsed to a single await`);
    }
});
test("the positive control, conditional on existing IR-2 behaviour, recorded as a finding", async () => {
    // The frozen condition: the awaited forms must converge IF single-use binding normalisation already makes the
    // UNAWAITED forms `y = foo(); return y` and `return foo()` equivalent. It does not: IR-2 never inlines a call,
    // because moving an effect moves when it happens. So the condition is not met, the awaited forms are not required
    // to converge, and neither IR-2 nor R-1A is tuned to make them. This test pins the finding, both halves.
    const unawaitedConverge = (await fp("ts", "async function f(x) { const y = foo(x); return y; }")) === (await fp("ts", "async function f(x) { return foo(x); }"));
    assert.equal(unawaitedConverge, false, "IR-2 does not make the unawaited forms equivalent (the condition)");
    const awaitedConverge = (await fp("ts", FORMS.ts_bound[1])) === (await fp("ts", FORMS.ts_return[1]));
    assert.equal(awaitedConverge, unawaitedConverge, "the awaited forms behave exactly as the unawaited ones do under normalisation: spelling is treated the same with or without the dependency");
});
test("X1 and X3: the Python asymmetry closes, and all four forms project identically across languages", async () => {
    const pairs = [["ts_standalone_name", "py_standalone_name"], ["ts_standalone_call", "py_standalone_call"], ["ts_bound", "py_bound"], ["ts_return", "py_return"]];
    for (const [t, p] of pairs) {
        assert.deepEqual(withoutProvenance(await proj(FORMS[p][0], FORMS[p][1])), withoutProvenance(await proj(FORMS[t][0], FORMS[t][1])), `${t} and ${p} project differently`);
        assert.equal(await fp(FORMS[p][0], FORMS[p][1]), await fp(FORMS[t][0], FORMS[t][1]));
    }
    const bound = (await fn(FORMS.py_bound[0], FORMS.py_bound[1])).body[0];
    assert.ok(bound.kind === "bind" && bound.expr.kind === "awaited" && bound.expr.of.kind === "call", "X1: Python keeps the call under the dependency, matching TypeScript");
});
test("X2: the section-16 pair with an awaited publish converges because the await is represented on both sides", async () => {
    const p = await fp("py", 'async def f(amount, status):\n    if amount > Decimal("25000.00") and status == "APPROVED":\n        await publish(amount)\n');
    const t = await fp("ts", 'async function f(amount, status) { if (amount <= 25_000) return; if (status !== "APPROVED") return; await publish(amount); }');
    assert.equal(p, t);
    const tPlain = await fp("ts", 'async function f(amount, status) { if (amount <= 25_000) return; if (status !== "APPROVED") return; publish(amount); }');
    assert.notEqual(t, tPlain, "and the awaited pair is distinguishable from the unawaited pair: the convergence is on represented awaits, not on erasure");
});
// The corpus predictions are derived from the representation rules, not from hard-coded totals.
function walk(dir, out = []) {
    for (const e of readdirSync(dir).sort()) {
        const p = join(dir, e);
        if (statSync(p).isDirectory())
            walk(p, out);
        else if (p.endsWith(".ts") && !p.endsWith(".d.ts"))
            out.push(p);
    }
    return out;
}
const countOpaqueSemantic = (body) => body.reduce((n, s) => n + (s.kind === "opaque" && s.statementClass === "SEMANTIC" ? 1 : 0) + (s.kind === "branch" ? countOpaqueSemantic(s.then) + countOpaqueSemantic(s.else) : 0), 0);
test("ir0-typescript: every await is represented, REPRESENTATION_LOSS equals the opaque semantic statements, and the legacy category is gone", async () => {
    const files = walk("corpora/ir0-typescript/src");
    let opaque = 0, evaluates = 0, awaited = 0;
    for (const f of files)
        for (const [, ir] of await ts(readFileSync(f, "utf8"))) {
            opaque += countOpaqueSemantic(ir.body);
            for (const s of ir.body)
                if (s.kind === "evaluate")
                    evaluates++;
            awaited += effectProjection(ir).filter((o) => o.what.kind === "COMPLETION_DEPENDENCY").length;
            assert.ok(!JSON.stringify(ir).includes("completion-dependency"), `${f}: legacy category emitted`);
        }
    assert.equal(evaluates, 1, "one standalone awaited expression in the corpus: await ready");
    assert.equal(awaited, 5, "five measured awaits, all represented");
    const j = new Journal();
    j.begin("r1a");
    await ingest(j, files, "corpora/ir0-typescript/src");
    j.commit();
    const loss = classifyLoss(j);
    assert.equal(loss.byCategory.REPRESENTATION_LOSS.occurrences, opaque, "one pseudo-invocation per opaque semantic statement, and the represented await produces none");
});
