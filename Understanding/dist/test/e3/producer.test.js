// E3-origin-producer: measurement only. Nothing is written, no flow edge is added, and no producer is guessed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyProducers } from "../../src/query/producer.js";
import { encodeFunctions as py } from "../../src/adapters/python/index.js";
import { encodeFunctions as ts } from "../../src/adapters/typescript/index.js";
async function corpus(files, isPython) {
    const all = new Map();
    for (const f of files)
        for (const [n, ir] of isPython ? await py(readFileSync(f, "utf8")) : await ts(readFileSync(f, "utf8")))
            all.set(`${f}:${n}`, ir);
    return classifyProducers(all);
}
const PYTHON = ["decoder.py", "encoder.py", "tz.py", "ordered.py", "__init__.py"].map((f) => `corpora/toml-python/src/${f}`);
const TYPESCRIPT = ["ir/index.ts", "journal/index.ts", "adapters/python/index.ts", "adapters/typescript/index.ts", "query/loss.ts", "query/origin.ts", "query/derive.ts", "query/producer.ts", "ingest/index.ts", "schema/index.ts", "scopes/index.ts", "concepts/index.ts"].map((f) => `src/${f}`);
test("the prediction: at least one non-parameter receiver in each corpus has an identifiable producer", async () => {
    for (const [name, r] of [["python", await corpus(PYTHON, true)], ["typescript", await corpus(TYPESCRIPT, false)]]) {
        const identifiable = Object.values(r.groups).reduce((s, g) => s + g.identifiable, 0);
        assert.ok(identifiable >= 1, `${name}: if this is zero, "origin" was weaker than the classifier's structure suggested and IR-8 must not be built`);
    }
});
test("every record's outcome is one of the three, and the group totals reconcile", async () => {
    const r = await corpus(PYTHON, true);
    for (const rec of r.records)
        assert.ok(["IDENTIFIABLE", "AMBIGUOUS", "UNAVAILABLE"].includes(rec.outcome));
    for (const [g, v] of Object.entries(r.groups)) {
        assert.equal(v.identifiable + v.ambiguous + v.unavailable, v.total, `${g} does not reconcile`);
        assert.equal(v.invocationProducers + v.otherProducers, v.identifiable, `${g}: an identifiable producer is either an invocation or something else`);
    }
});
test("a member-read producer is identified as an expression and explicitly not as an entity", async () => {
    const r = await corpus(TYPESCRIPT, false);
    const members = r.records.filter((x) => x.group === "MEMBER_VALUE");
    assert.ok(members.length > 0);
    for (const m of members) {
        assert.equal(m.producerKind, "member-read");
        assert.ok(/the entity stored in that place is not/.test(m.because), "the distinction between producer expression and produced entity must be in the record itself");
    }
    assert.ok(r.limits.some((l) => /A producer is an expression, not an entity/.test(l)));
});
test("a binding bound more than once is AMBIGUOUS, and one with no binding is UNAVAILABLE; neither is guessed", async () => {
    const fns = new Map();
    // two bindings of the same value id cannot arise from one adapter run, so this is constructed directly
    fns.set("synthetic:twice", { inputs: 0, body: [
            { kind: "bind", id: 0, expr: { kind: "call", operation: "makeA", args: [] } },
            { kind: "bind", id: 0, expr: { kind: "call", operation: "makeB", args: [] } },
            { kind: "effect", effect: { kind: "CALL_EXTERNAL", operation: "run", args: [], receiver: { kind: "value", id: 0 } } },
        ] });
    fns.set("synthetic:missing", { inputs: 0, body: [
            { kind: "effect", effect: { kind: "CALL_EXTERNAL", operation: "run", args: [], receiver: { kind: "value", id: 7 } } },
        ] });
    const r = classifyProducers(fns);
    assert.equal(r.groups.LOCAL_BINDING.ambiguous, 1, "two bindings of one value: no single producer may be named");
    assert.equal(r.groups.LOCAL_BINDING.unavailable, 1, "no binding at all: the producer is not present");
    assert.equal(r.groups.LOCAL_BINDING.identifiable, 0);
});
test("the instrument reads the IR rather than the store, and says why", async () => {
    const r = await corpus(PYTHON, true);
    assert.ok(r.limits.some((l) => /the store holds no assertion joining a binding/.test(l)), "the absence this round measures is the thing IR-8 would write");
    assert.ok(r.limits.some((l) => /free name/.test(l)), "a receiver with no producer in the function is outside these groups, not counted as unavailable");
});
