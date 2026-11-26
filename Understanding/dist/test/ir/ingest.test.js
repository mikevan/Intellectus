// Ingestion writes PARSED assertions only, and every one is auditable back to a rule and a location. If this test
// ever fails, an E3 result derived from the store is void, because something entered the evidence channel without
// having been mechanically derived.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Journal } from "../../src/journal/index.js";
import { ingest } from "../../src/ingest/index.js";
const RULES = new Set([
    "module-from-file", "executable-from-function", "name-from-declaration", "member-from-enclosing-module",
    "fingerprint-from-ir", "effect-from-projection", "predicate-from-projection", "calls-from-resolved-callee",
    // IR-6 Composition
    "parameter-from-arity", "return-from-projection", "invocation-from-call-in-projection", "argument-from-call-operand",
    "outcome-from-call-site", "flow-argument-to-parameter", "flow-return-to-outcome", "flow-outcome-to-return",
    // IR-7 Receiver
    "receiver-from-member-call", "flow-receiver-to-argument",
    // IR-8 Value Continuity
    "flow-binding-to-receiver", "flow-invocation-outcome-to-receiver",
]);
async function ingested() {
    const j = new Journal();
    j.begin("test ingestion");
    const report = await ingest(j, ["corpora/toml-python/src/tz.py", "corpora/toml-python/src/ordered.py"], "corpora/toml-python/src");
    j.commit();
    return { j, report };
}
test("every ingested assertion is PARSED, unverified, and names the rule that produced it", async () => {
    const { j } = await ingested();
    const live = j.liveAssertions();
    assert.ok(live.length > 0);
    for (const a of live) {
        assert.equal(a.source, "PARSED", `${a.relation} entered as ${a.source}; ingestion may write nothing else`);
        assert.equal(a.verification, "NONE");
        assert.equal(a.confidence, 1, "a parsed fact is not a probability");
        assert.equal(a.authority, undefined, "ingestion has no authority to declare anything");
        const rule = a.evidence?.rule;
        assert.ok(rule && RULES.has(rule), `${a.relation} carries no known rule (${String(rule)})`);
    }
});
test("every ingested assertion can be audited back to a source location", async () => {
    const { j } = await ingested();
    for (const a of j.liveAssertions()) {
        const e = a.evidence;
        assert.ok(e?.file, `${a.relation} does not say which file it came from`);
        assert.ok(/\.(py|ts)$/.test(e.file), `${a.relation} names a file that is not source: ${e.file}`);
    }
});
test("a call becomes an edge only when it resolves to exactly one declared name; otherwise it is reported, not guessed", async () => {
    const { j, report } = await ingested();
    const calls = j.liveAssertions().filter((a) => a.relation === "CALLS");
    assert.equal(calls.length, report.resolvedCalls);
    for (const c of calls)
        assert.ok(c.evidence.operation, "an edge says which operation resolved");
    assert.ok(Object.keys(report.unresolvedCalls).length > 0, "unresolved operations are counted rather than dropped");
    // __init__ appears in both classes of ordered.py, so it is ambiguous and must NOT become an edge
    assert.ok("__init__" in report.unresolvedCalls, "an ambiguous name must be reported as unresolved");
});
test("ingestion writes no relation the E3 protocol forbids", async () => {
    const { j } = await ingested();
    const forbidden = ["SATISFIES", "SUPPORTS", "SERVES", "EXPLAINS", "SUBSTITUTABLE_UNDER", "SIMILAR_TO", "CAUSES", "TRIGGERS", "VIOLATES", "FOLLOWS", "PARTICIPATES_IN"];
    const used = new Set(j.liveAssertions().map((a) => a.relation));
    for (const f of forbidden)
        assert.equal(used.has(f), false, `ingestion wrote ${f}, which is an inference or an unimplemented channel`);
});
