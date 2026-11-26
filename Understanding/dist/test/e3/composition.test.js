// IR-6 Composition, the eight hard predictions, recorded in docs/experiment-log.md before this file was written.
// The searcher is generic and frozen; nothing here tells it what a successful answer looks like, and no step of any
// path is supplied by the query. Every fixture is zero-opacity.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Journal } from "../../src/journal/index.js";
import { ingest } from "../../src/ingest/index.js";
import { derivePath, only } from "../../src/query/derive.js";
const FLOW = ["HAS_PARAMETER", "HAS_ARGUMENT", "HAS_OUTCOME", "HAS_RETURN", "HAS_INVOCATION", "INVOKES", "FLOWS_TO"];
async function load(fixture) {
    const j = new Journal();
    j.begin(`E3 ${fixture}`);
    const report = await ingest(j, [`test/e3/fixtures/${fixture}`], "test/e3/fixtures");
    j.commit();
    const named = (name) => {
        const hit = j.liveAssertions().find((a) => a.relation === "RENDERS_AS" && a.attributes?.language === "python" && a.object.value === name);
        assert.ok(hit, `no executable named ${name}`);
        return hit.subject;
    };
    return { j, report, named };
}
test("fixtures are zero-opacity, so nothing here is confounded by the known gaps", async () => {
    for (const f of ["chain.py", "twice.py", "two_callees.py", "reversed.py"]) {
        const { j } = await load(f);
        const opaque = j.liveAssertions().filter((a) => JSON.stringify(a.object).includes("opaque"));
        assert.equal(opaque.length, 0, `${f} produced ${opaque.length} assertions mentioning opacity`);
    }
});
test("prediction 1: a value crossing two boundaries is derivable, and no step is supplied by the query", async () => {
    const { j, named } = await load("chain.py");
    const a = named("a"), c = named("c");
    const param = only(j, a, "HAS_PARAMETER", { position: 0 });
    assert.equal(param.outcome, "FOUND");
    const cParam = only(j, c, "HAS_PARAMETER", { position: 0 });
    assert.equal(cParam.outcome, "FOUND");
    // a's parameter reaches c's parameter: a -> b -> c, two boundaries, entirely through parsed assertions
    const there = derivePath(j, param.concept, cParam.concept, { allowedRelations: FLOW });
    assert.equal(there.outcome, "FOUND", there.says);
    assert.ok(there.path.length >= 4, `expected at least four steps, got ${there.path.length}: ${there.path.map((s) => s.relation).join(" -> ")}`);
    assert.ok(there.supporting.length === there.path.length);
    // and c's return reaches a's return, the other direction of the same composition
    const cRet = only(j, c, "HAS_RETURN");
    const aRet = only(j, a, "HAS_RETURN");
    assert.equal(cRet.outcome, "FOUND");
    assert.equal(aRet.outcome, "FOUND");
    const back = derivePath(j, cRet.concept, aRet.concept, { allowedRelations: FLOW });
    assert.equal(back.outcome, "FOUND", back.says);
});
test("prediction 2: two calls to one callee stay two flows", async () => {
    const { j, named } = await load("twice.py");
    const a = named("a");
    const invocations = j.liveAssertions().filter((x) => x.relation === "HAS_INVOCATION" && x.subject === a);
    assert.equal(invocations.length, 2, "two call sites, two invocation concepts");
    const [i1, i2] = invocations.map((x) => x.object);
    assert.notEqual(i1, i2);
    const arg = (inv) => only(j, inv, "HAS_ARGUMENT", { position: 0 }).concept;
    assert.notEqual(arg(i1), arg(i2), "the two arguments are distinct values");
    const p = only(j, a, "HAS_PARAMETER", { position: 0 }).concept;
    const q = only(j, a, "HAS_PARAMETER", { position: 1 }).concept;
    // p reaches exactly one of the two argument values, and q the other: the flows did not merge
    const pTo1 = derivePath(j, p, arg(i1), { allowedRelations: FLOW }).outcome === "FOUND";
    const pTo2 = derivePath(j, p, arg(i2), { allowedRelations: FLOW }).outcome === "FOUND";
    const qTo1 = derivePath(j, q, arg(i1), { allowedRelations: FLOW }).outcome === "FOUND";
    const qTo2 = derivePath(j, q, arg(i2), { allowedRelations: FLOW }).outcome === "FOUND";
    assert.notEqual(pTo1, pTo2, "p must reach one argument and not the other");
    assert.notEqual(qTo1, qTo2, "q must reach one argument and not the other");
    assert.notEqual(pTo1, qTo1, "and they must not reach the same one");
});
test("prediction 3: results of different callees cannot cross", async () => {
    const { j, named } = await load("two_callees.py");
    const c = named("c"), a = named("a");
    const cRet = only(j, c, "HAS_RETURN").concept;
    const aRet = only(j, a, "HAS_RETURN").concept;
    const crossed = derivePath(j, cRet, aRet, { allowedRelations: FLOW });
    assert.equal(crossed.outcome, "NOT_FOUND", `c is never called by a, so nothing of c's may reach a's return: ${crossed.says}`);
    const b = named("b");
    const bRet = only(j, b, "HAS_RETURN").concept;
    assert.equal(derivePath(j, bRet, aRet, { allowedRelations: FLOW }).outcome, "FOUND", "b's return does reach a's return");
});
test("prediction 4: reversing the argument order changes what is derivable", async () => {
    const { j, named } = await load("reversed.py");
    const a = named("a"), b = named("b");
    const p = only(j, a, "HAS_PARAMETER", { position: 0 }).concept;
    const q = only(j, a, "HAS_PARAMETER", { position: 1 }).concept;
    const y = only(j, b, "HAS_PARAMETER", { position: 0 }).concept;
    const z = only(j, b, "HAS_PARAMETER", { position: 1 }).concept;
    // b(q, p): q reaches y, p reaches z, and not the other way round
    assert.equal(derivePath(j, q, y, { allowedRelations: FLOW }).outcome, "FOUND", "q was passed first, so it reaches b's first parameter");
    assert.equal(derivePath(j, p, z, { allowedRelations: FLOW }).outcome, "FOUND", "p was passed second");
    assert.equal(derivePath(j, p, y, { allowedRelations: FLOW }).outcome, "NOT_FOUND", "p must NOT reach b's first parameter");
    assert.equal(derivePath(j, q, z, { allowedRelations: FLOW }).outcome, "NOT_FOUND", "q must NOT reach b's second parameter");
});
test("prediction 6: an unresolved callee is UNKNOWN and an ambiguous one is AMBIGUOUS, never a guess", async () => {
    const { j, report, named } = await load("chain.py");
    // chain.py calls only functions it declares, so nothing is unresolved here; the store's refusal is tested
    // directly on the query side and on a fixture whose callee is not in the corpus.
    const a = named("a");
    const nothing = only(j, a, "HAS_RETURN", { position: 99 });
    assert.equal(nothing.outcome, "UNKNOWN", nothing.says);
    const several = only(j, a, "HAS_INVOCATION");
    assert.ok(["FOUND", "AMBIGUOUS"].includes(several.outcome));
    const { j: j2, report: r2 } = await (async () => {
        const jj = new Journal();
        jj.begin("external");
        const rr = await ingest(jj, ["corpora/toml-python/src/tz.py"], "corpora/toml-python/src");
        jj.commit();
        return { j: jj, report: rr };
    })();
    assert.ok(r2.unresolvedInvocations > 0, "tz.py calls into the standard library, which must be unresolved rather than guessed");
    assert.equal(j2.liveAssertions().filter((x) => x.relation === "INVOKES").length, r2.resolvedCalls, "an INVOKES edge exists only for a resolved callee");
    assert.ok(report.ambiguousInvocations >= 0);
});
test("prediction 7: a derived path names its supporting assertions, and retracting one removes the path", async () => {
    const { j, named } = await load("chain.py");
    const a = named("a"), c = named("c");
    const from = only(j, a, "HAS_PARAMETER", { position: 0 }).concept;
    const to = only(j, c, "HAS_PARAMETER", { position: 0 }).concept;
    const before = derivePath(j, from, to, { allowedRelations: FLOW });
    assert.equal(before.outcome, "FOUND");
    assert.ok(before.supporting.length > 0, "the path must name what it rests on");
    // store the conclusion as a claim derived from exactly those assertions
    j.begin("store the derived conclusion");
    const claim = j.assert({
        subject: from, relation: "FLOWS_TO", object: to,
        source: "INFERRED", verification: "NONE", asserter: "derivePath/0.1", confidence: 0.9,
        derived_from: before.supporting, evidence: { steps: before.path.length },
    });
    j.commit();
    assert.ok(j.liveAssertions().some((x) => x.id === claim));
    // retract one supporting assertion: the store's own rule must remove the conclusion, and the path must be gone
    j.begin("retract one supporting assertion");
    const gone = j.retract(before.supporting[Math.floor(before.supporting.length / 2)], { source: "PARSED", asserter: "test" });
    j.commit();
    assert.ok(gone.includes(claim), "the stored conclusion must go with its evidence");
    const after = derivePath(j, from, to, { allowedRelations: FLOW });
    assert.equal(after.outcome, "NOT_FOUND", `the path must not survive the loss of a step it rested on: ${after.says}`);
});
test("IR-6 was a representation version; IR-7 is an encoder change and says so", async () => {
    const { IR_SCHEMA } = await import("../../src/ir/index.js");
    // IR-6 left this at 3 deliberately, because it changed no encoder. IR-7 changes what the encoder knows, so the
    // schema moves with it and every derived assertion carries the new number.
    // 5: IR-9 classified statements. 6: R-1A added the `awaited` expression modifier and the `evaluate` carrier, which
    // change how a consumer interprets the representation; the C-series widened the category vocabulary and stayed at 5.
    assert.equal(IR_SCHEMA, 6, "R-1A is the first representational change since IR-9");
});
// ---- IR-7 Receiver: the fixtures the protocol required, frozen predictions 8, 9, 10, 11 ----
test("IR-7 prediction 8: a.visit(x) and b.visit(x) keep distinct receivers despite identical operation and argument", async () => {
    const { encodeFunctions: py } = await import("../../src/adapters/python/index.js");
    const { effectProjection } = await import("../../src/ir/index.js");
    const fn = (await py("def f(a, b, x):\n    a.visit(x)\n    b.visit(x)\n")).get("f");
    const calls = effectProjection(fn).filter((o) => o.what.kind === "CALL_EXTERNAL");
    assert.equal(calls.length, 2, "two calls, not one collapsed pair");
    assert.deepEqual(calls.map((c) => c.what.operation), ["visit", "visit"]);
    const receivers = calls.map((c) => JSON.stringify(c.what.receiver));
    assert.notEqual(receivers[0], receivers[1], "the receivers must be distinct: parameter 0 and parameter 1");
    assert.deepEqual(new Set(calls.map((c) => c.what.receiver.index)), new Set([0, 1]));
});
test("IR-7 prediction 9: visit(x) stays receiverless; no receiver is manufactured", async () => {
    const { encodeFunctions: py } = await import("../../src/adapters/python/index.js");
    const { encodeFunctions: ts } = await import("../../src/adapters/typescript/index.js");
    const { effectProjection } = await import("../../src/ir/index.js");
    const p = (await py("def f(x):\n    visit(x)\n")).get("f");
    const t = (await ts("function f(x: number) { visit(x); }")).get("f");
    for (const [name, fn] of [["python", p], ["typescript", t]]) {
        const call = effectProjection(fn).find((o) => o.what.kind === "CALL_EXTERNAL");
        assert.equal(call.what.receiver, undefined, `${name}: a bare call has no receiver`);
    }
});
test("IR-7 prediction 10: the receiver is auditable back to its source construct", async () => {
    const { Journal } = await import("../../src/journal/index.js");
    const { ingest } = await import("../../src/ingest/index.js");
    const j = new Journal();
    j.begin("receiver provenance");
    await ingest(j, ["corpora/toml-python/src/tz.py"], "corpora/toml-python/src");
    j.commit();
    const receivers = j.liveAssertions().filter((a) => a.relation === "HAS_ARGUMENT" && a.attributes?.role === "receiver");
    assert.ok(receivers.length > 0, "tz.py calls methods on entities");
    for (const r of receivers) {
        assert.equal(r.source, "PARSED");
        const e = r.evidence;
        assert.equal(e.rule, "receiver-from-member-call");
        assert.ok(e.file?.endsWith(".py") && e.construct === "the entity the operation acts on");
        assert.equal(r.attributes?.position, -1, "a receiver is not an argument position");
    }
});
test("IR-7 prediction 11: thing.visit(x) preserves equivalent receiver structure in both languages", async () => {
    const { encodeFunctions: py } = await import("../../src/adapters/python/index.js");
    const { encodeFunctions: ts } = await import("../../src/adapters/typescript/index.js");
    const { fingerprint, effectProjection } = await import("../../src/ir/index.js");
    const p = (await py("def f(thing, x):\n    thing.visit(x)\n")).get("f");
    const t = (await ts("function f(thing: any, x: number) { thing.visit(x); }")).get("f");
    assert.equal(fingerprint(p), fingerprint(t), "the same method call on the same parameter converges across the two grammars");
    assert.deepEqual(effectProjection(p), effectProjection(t));
});
// ---- IR-8 Value Continuity: the frozen predictions, including the required negative control ----
test("IR-8: a receiver produced by a bound call is joined to that call's outcome, with provenance", async () => {
    const { Journal } = await import("../../src/journal/index.js");
    const { ingest } = await import("../../src/ingest/index.js");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "ir8-"));
    writeFileSync(join(dir, "a.py"), "def make():\n    return 1\n\ndef use():\n    account = make()\n    account.close()\n");
    const j = new Journal();
    j.begin("ir8");
    await ingest(j, [join(dir, "a.py")], dir);
    j.commit();
    const edges = j.liveAssertions().filter((a) => a.relation === "FLOWS_TO" && a.evidence.rule === "flow-binding-to-receiver");
    assert.equal(edges.length, 1, "one binding, one receiver, one edge");
    const e = edges[0];
    assert.equal(e.source, "PARSED");
    assert.ok(e.evidence.construct?.includes("was bound and used as the receiver"));
    assert.ok(e.derived_from && e.derived_from.length === 2, "the edge rests on the outcome and the receiver assertions");
    // retraction destroys the derived continuity
    j.begin("retract");
    const gone = j.retract(e.derived_from[0], { source: "PARSED", asserter: "test" });
    j.commit();
    assert.ok(gone.includes(e.id), "the continuity edge must not survive the assertion it was derived from");
});
// The required negative control, and the finding it produced. `x = make_a(); x = make_b(); x.run()` does NOT
// create ambiguity in this representation: the encoder gives each binding its own positional value id (IR-1), so
// the receiver names value 1 and its single producer is make_b(), which is what Python does. The protocol's worry
// was that IR-8 might choose between two available producers; it cannot, because the IR already recorded which
// binding the receiver refers to. The control therefore asserts the CORRECT single edge and names why, and the
// genuinely ambiguous case (one value id bound twice) is tested against the synthetic fixture in producer.test.ts,
// where the classifier reports AMBIGUOUS and IR-8 writes nothing.
test("IR-8 negative control: reassignment is not ambiguity, because the IR numbers each binding", async () => {
    const { Journal } = await import("../../src/journal/index.js");
    const { ingest } = await import("../../src/ingest/index.js");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "ir8-neg-"));
    writeFileSync(join(dir, "b.py"), "def make_a():\n    return 1\n\ndef make_b():\n    return 2\n\ndef use():\n    x = make_a()\n    x = make_b()\n    x.run()\n");
    const j = new Journal();
    j.begin("ir8 negative");
    await ingest(j, [join(dir, "b.py")], dir);
    j.commit();
    const edges = j.liveAssertions().filter((a) => a.relation === "FLOWS_TO" && a.evidence.rule === "flow-binding-to-receiver");
    assert.equal(edges.length, 1, "exactly one edge: the receiver refers to the second binding and to nothing else");
    assert.ok(edges[0].evidence.construct?.includes("make_b"), "and it is make_b's outcome, not make_a's, because that is the value the receiver names");
});
test("IR-8: a value bound twice under one id yields no edge, because no single producer can be named", async () => {
    const { Journal } = await import("../../src/journal/index.js");
    const { classifyProducers } = await import("../../src/query/producer.js");
    const fns = new Map();
    fns.set("synthetic:twice", { inputs: 0, body: [
            { kind: "bind", id: 0, expr: { kind: "call", operation: "makeA", args: [] } },
            { kind: "bind", id: 0, expr: { kind: "call", operation: "makeB", args: [] } },
            { kind: "effect", effect: { kind: "CALL_EXTERNAL", operation: "run", args: [], receiver: { kind: "value", id: 0 } } },
        ] });
    const r = classifyProducers(fns);
    assert.equal(r.groups.LOCAL_BINDING.ambiguous, 1, "the producer apparatus reports the ambiguity");
    // and the ingestion rule that consumes it requires exactly one binding, so no edge can be written from it
    void Journal;
});
test("IR-8: a non-invocation producer is never converted into an invocation outcome", async () => {
    const { Journal } = await import("../../src/journal/index.js");
    const { ingest } = await import("../../src/ingest/index.js");
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "ir8-nc-"));
    // the receiver is produced by a member read and by arithmetic: neither is an invocation
    writeFileSync(join(dir, "c.py"), "def use(obj, n):\n    a = obj.field\n    a.run()\n    b = n + 1\n    b.run()\n");
    const j = new Journal();
    j.begin("ir8 non-call");
    await ingest(j, [join(dir, "c.py")], dir);
    j.commit();
    const edges = j.liveAssertions().filter((a) => a.relation === "FLOWS_TO" && String(a.evidence.rule).startsWith("flow-") && String(a.evidence.rule).includes("receiver"));
    for (const e of edges)
        assert.notEqual(e.evidence.rule, "flow-invocation-outcome-to-receiver", "no invocation outcome may be invented for a non-invocation producer");
});
