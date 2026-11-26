// The loss classifier is measurement apparatus. These tests pin the properties that make its output a measurement
// rather than an opinion: it classifies occurrences, it never guesses, it declares the knowledge it borrows, and
// its numbers add up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Journal } from "../../src/journal/index.js";
import { ingest } from "../../src/ingest/index.js";
import { classifyLoss, CATEGORY_DEFINITIONS, DECLARED_CLASSES, EXTERNAL_KNOWLEDGE } from "../../src/query/loss.js";
async function classified(files, root) {
    const j = new Journal();
    j.begin("loss");
    const report = await ingest(j, files, root);
    j.commit();
    return { loss: classifyLoss(j), report };
}
test("every unresolved invocation is classified, and the totals reconcile with ingestion", async () => {
    const { loss, report } = await classified(["corpora/toml-python/src/decoder.py", "corpora/toml-python/src/encoder.py", "corpora/toml-python/src/tz.py", "corpora/toml-python/src/ordered.py", "corpora/toml-python/src/__init__.py"], "corpora/toml-python/src");
    assert.equal(loss.invocations, report.invocations);
    assert.equal(loss.resolved, report.resolvedCalls);
    assert.equal(loss.classified, report.unresolvedInvocations + report.ambiguousInvocations + report.selfInvocations, "every invocation is either resolved or classified as a loss; I-0 added the self-call term, which is zero in this corpus");
    const sum = Object.values(loss.byCategory).reduce((s, v) => s + v.occurrences, 0);
    assert.equal(sum, loss.classified, "the categories partition the losses; none is counted twice or dropped");
    assert.equal(loss.records.length, loss.classified);
});
test("lost flows are counted per occurrence, and every record says why it was classified", async () => {
    const { loss } = await classified(["corpora/toml-python/src/decoder.py"], "corpora/toml-python/src");
    for (const r of loss.records) {
        assert.equal(r.lostFlows, r.arguments + 1, "one flow per argument, plus the return that never arrived");
        assert.ok(r.because.length > 30, `a classification must state its reason: ${r.category} ${r.operation}`);
        assert.ok(r.caller && r.invocation, "and be auditable to a call site");
    }
    const byCat = Object.entries(loss.byCategory).reduce((s, [, v]) => s + v.lostFlows, 0);
    assert.equal(byCat, loss.records.reduce((s, r) => s + r.lostFlows, 0));
});
test("EXTERNAL_UNMODELED rests on declared knowledge and says so; nothing else borrows anything", async () => {
    const { loss } = await classified(["corpora/toml-python/src/decoder.py"], "corpora/toml-python/src");
    assert.equal(EXTERNAL_KNOWLEDGE.status, "DECLARED_BY_AUTHOR");
    assert.ok(EXTERNAL_KNOWLEDGE.source.length > 20 && EXTERNAL_KNOWLEDGE.note.length > 40, "borrowed knowledge carries its source and its limits");
    for (const r of loss.records) {
        if (r.category === "EXTERNAL_UNMODELED")
            assert.equal(r.restsOn, EXTERNAL_KNOWLEDGE.source, "an external classification names what it rests on");
        else if (r.category === "INTERNAL_NONEXECUTABLE")
            assert.equal(r.restsOn, DECLARED_CLASSES.source, "the class list is the second declared source, and it is named too");
        else
            assert.equal(r.restsOn, undefined, `${r.category} must rest on the corpus alone`);
    }
});
test("an operation the corpus does not declare and the list does not contain is UNKNOWN, never guessed", async () => {
    const { loss } = await classified(["corpora/toml-python/src/decoder.py"], "corpora/toml-python/src");
    const unknown = loss.records.filter((r) => r.category === "UNKNOWN");
    assert.ok(unknown.length > 0, "this corpus calls names it does not declare");
    for (const r of unknown) {
        assert.ok(!EXTERNAL_KNOWLEDGE.operations.includes(r.operation), "an operation in the declared list is not UNKNOWN");
        assert.ok(/names nothing in this corpus/.test(r.because));
    }
});
test("the ambiguous stay ambiguous: a name declared twice is never resolved to one of them", async () => {
    const { loss } = await classified(["corpora/toml-python/src/ordered.py"], "corpora/toml-python/src");
    const ambiguous = loss.records.filter((r) => r.category === "INTERNAL_AMBIGUOUS");
    assert.ok(ambiguous.every((r) => /will not choose between them/.test(r.because)));
});
// ---- E3-loss-2: the UNKNOWN split. Categories were frozen before any occurrence was read. ----
test("every frozen category has a definition, and every record's category is one of them", async () => {
    const { loss } = await classified(["corpora/toml-python/src/decoder.py", "corpora/toml-python/src/tz.py"], "corpora/toml-python/src");
    for (const r of loss.records)
        assert.ok(CATEGORY_DEFINITIONS[r.category], `${r.category} has no frozen definition`);
    assert.equal(Object.keys(CATEGORY_DEFINITIONS).length, 8);
});
test("INTERNAL_NONEXECUTABLE rests on the declared class list and names it", async () => {
    const { loss } = await classified(["corpora/toml-python/src/decoder.py", "corpora/toml-python/src/encoder.py", "corpora/toml-python/src/ordered.py", "corpora/toml-python/src/tz.py", "corpora/toml-python/src/__init__.py"], "corpora/toml-python/src");
    const ne = loss.records.filter((r) => r.category === "INTERNAL_NONEXECUTABLE");
    assert.ok(ne.length > 0, "this corpus constructs classes it declares");
    for (const r of ne) {
        assert.equal(r.restsOn, DECLARED_CLASSES.source);
        assert.ok(DECLARED_CLASSES.names.includes(r.operation));
        assert.ok(/a class is not an executable in the store/.test(r.because));
    }
});
test("the instrument states what it cannot measure, and does not populate those categories", async () => {
    const { loss } = await classified(["corpora/toml-python/src/decoder.py"], "corpora/toml-python/src");
    assert.ok(loss.limits.length >= 3, "the limits travel with the measurement");
    assert.ok(loss.limits.some((l) => /RECEIVER_UNRESOLVED is now populated/.test(l)), "the limit that was stated at IR-6 is now a different limit, and it says what it is");
    assert.ok(loss.byCategory.RECEIVER_UNRESOLVED.occurrences > 0, "IR-7 preserves the receiver, so the category the evidence could not support at IR-6 is now populated from parsed evidence");
    assert.equal(loss.byCategory.DYNAMIC.occurrences, 0, "DYNAMIC still cannot be populated: no adapter records a callee that came from a value");
});
test("the split reduced UNKNOWN without changing any total", async () => {
    const { loss } = await classified(["corpora/toml-python/src/decoder.py", "corpora/toml-python/src/encoder.py", "corpora/toml-python/src/ordered.py", "corpora/toml-python/src/tz.py", "corpora/toml-python/src/__init__.py"], "corpora/toml-python/src");
    // IR-7 measured 102 losses and 156 lost flows here. IR-9 removed 15 pseudo-invocations that were docstrings and
    // metadata counted as opaque call sites, so the totals legitimately fell to 87 and 141. What must hold across a
    // RECLASSIFICATION is that occurrences move between categories and none are created or lost, so the invariant is
    // asserted against ingestion's own count rather than against a number from an earlier encoder.
    const total = Object.values(loss.byCategory).reduce((s, v) => s + v.occurrences, 0);
    assert.equal(total, loss.classified, "a reclassification moves occurrences between categories and creates none");
    const lost = Object.values(loss.byCategory).reduce((s, v) => s + v.lostFlows, 0);
    assert.equal(lost, loss.records.reduce((s, r) => s + r.lostFlows, 0), "and the cost reconciles with the records");
    assert.ok(total < 102, `IR-9 must remove the docstring pseudo-invocations: was 102 at IR-7, now ${total}`);
    assert.ok(loss.byCategory.UNKNOWN.occurrences < 15, `UNKNOWN was 15 before the split, and is now ${loss.byCategory.UNKNOWN.occurrences}`);
    assert.ok(loss.byCategory.UNKNOWN.occurrences > 0, "and it does not reach zero, which was the prediction");
    assert.ok(loss.invocations < 114, `IR-9 removes invocations that were never calls: 114 at IR-7, now ${loss.invocations}`);
});
