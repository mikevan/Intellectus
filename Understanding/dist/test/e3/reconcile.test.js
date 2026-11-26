// I-0. The graph report printed totals that did not agree with each other. These tests hold it to its own
// definitions: every population is defined, every printed total derives from those definitions, and the identities
// between them hold on all three corpora. A report whose arithmetic does not close is not evidence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Journal } from "../../src/journal/index.js";
import { ingest } from "../../src/ingest/index.js";
import { classifyLoss } from "../../src/query/loss.js";
import { classifyReceiverOrigins } from "../../src/query/origin.js";
import { classifyProducers } from "../../src/query/producer.js";
import { reconcile } from "../../src/query/reconcile.js";
import { encodeFunctions as encPy } from "../../src/adapters/python/index.js";
import { encodeFunctions as encTs } from "../../src/adapters/typescript/index.js";
function walk(dir, out = []) {
    for (const e of readdirSync(dir).sort()) {
        const p = join(dir, e);
        if (statSync(p).isDirectory())
            walk(p, out);
        else if (p.endsWith(".py") || (p.endsWith(".ts") && !p.endsWith(".d.ts")))
            out.push(p);
    }
    return out;
}
async function reportFor(corpus) {
    const files = walk(corpus);
    const j = new Journal();
    j.begin("reconcile");
    const report = await ingest(j, files, corpus);
    j.commit();
    const fns = new Map();
    for (const f of files) {
        const src = readFileSync(f, "utf8");
        for (const [n, ir] of f.endsWith(".py") ? await encPy(src) : await encTs(src))
            fns.set(`${f}:${n}`, ir);
    }
    return { report, recon: reconcile(report, classifyLoss(j), classifyReceiverOrigins(j), classifyProducers(fns)) };
}
const CORPORA = ["corpora/radon-python/src", "corpora/toml-python/src", "corpora/ir0-typescript/src"];
for (const corpus of CORPORA)
    test(`every total in the graph report derives from a defined population: ${corpus}`, async () => {
        const { recon } = await reportFor(corpus);
        for (const p of recon.populations)
            assert.ok(p.definition.length > 20, `${p.name} is printed without a definition`);
        for (const i of recon.identities)
            assert.ok(i.holds, `${i.name} does not hold: ${i.arithmetic}`);
        assert.ok(recon.reconciles);
    });
test("the identity that used to fail: a self-call is counted, not silently dropped", async () => {
    const { report, recon } = await reportFor("corpora/radon-python/src");
    assert.ok(report.selfInvocations >= 1, "radon contains at least one directly recursive call");
    assert.equal(report.invocations, report.resolvedCalls + report.unresolvedInvocations + report.ambiguousInvocations + report.selfInvocations);
    const identity = recon.identities.find((i) => i.name === "invocations account for every call site");
    assert.ok(identity?.holds);
});
test("the two receiver populations are named separately and differ only by the merge", async () => {
    const { report, recon } = await reportFor("corpora/radon-python/src");
    const store = recon.populations.find((p) => p.name === "receiver arguments in the store");
    const ir = recon.populations.find((p) => p.name === "receiver occurrences in the IR");
    assert.equal(ir.count, report.receiverSitesFromProjection, "the producer instrument counts the projection's receiver sites");
    assert.equal(store.count, report.receiverSitesFromProjection + report.receiverSitesFromOperand - report.sitesMergedWithReceiver, "the store's receiver arguments are the sites seen, less those merged");
});
test("pseudo-invocations are separated from calls, because an opaque statement is not a call", async () => {
    const { recon } = await reportFor("corpora/radon-python/src");
    const pseudo = recon.populations.find((p) => p.name === "of those, pseudo-invocations");
    const calls = recon.populations.find((p) => p.name === "of those, calls");
    const all = recon.populations.find((p) => p.name === "invocations with no CALLS edge");
    assert.ok(pseudo.count > 0 && calls.count > 0);
    assert.equal(pseudo.count + calls.count, all.count);
});
