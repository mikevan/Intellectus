import { test } from "node:test";
import assert from "node:assert/strict";
import { Journal, literal, SchemaViolation, declareScope, declareAuthorityOver, hasStanding } from "../../src/index.js";
function fresh() { const j = new Journal(); j.begin(); return j; }
test("a relation not in the vocabulary is unrepresentable", () => {
    const j = fresh();
    const a = j.concept("executable");
    assert.throws(() => j.assert({ subject: a.id, relation: "LIKES", object: a.id, source: "INFERRED", asserter: "model", confidence: 0.9 }), (e) => e instanceof SchemaViolation && e.rule === "unknown-relation");
});
test("kind rules: a module cannot CALL, a test cannot SATISFY, a requirement cannot be CALLED", () => {
    const j = fresh();
    const m = j.concept("module");
    const f = j.concept("executable");
    const t = j.concept("test");
    const r = j.concept("requirement");
    assert.throws(() => j.assert({ subject: m.id, relation: "CALLS", object: f.id, source: "PARSED", asserter: "p", confidence: 1 }), (e) => e instanceof SchemaViolation && e.rule === "subject-kind");
    assert.throws(() => j.assert({ subject: t.id, relation: "SATISFIES", object: r.id, source: "INFERRED", asserter: "m", confidence: 0.5 }), (e) => e instanceof SchemaViolation && e.rule === "subject-kind");
    assert.throws(() => j.assert({ subject: f.id, relation: "CALLS", object: r.id, source: "PARSED", asserter: "p", confidence: 1 }), (e) => e instanceof SchemaViolation && e.rule === "object-kind");
});
test("required attributes: FOLLOWS needs control and within; CONSTRAINS needs a modality", () => {
    const j = fresh();
    const a = j.concept("executable");
    const b = j.concept("executable");
    const inv = j.concept("invariant");
    assert.throws(() => j.assert({ subject: a.id, relation: "FOLLOWS", object: b.id, source: "PARSED", asserter: "p", confidence: 1 }), (e) => e instanceof SchemaViolation && e.rule === "missing-attribute");
    assert.throws(() => j.assert({ subject: inv.id, relation: "CONSTRAINS", object: a.id, source: "DECLARED", asserter: "owner", authority: { level: "OWNER" }, confidence: 1 }), (e) => e instanceof SchemaViolation && e.rule === "missing-attribute");
});
test("DECLARED needs an authority; only INFERRED carries a verification; derived needs derived_from", () => {
    const j = fresh();
    const a = j.concept("executable");
    assert.throws(() => j.assert({ subject: a.id, relation: "HAS_PREDICATE", object: literal("p", 1), source: "DECLARED", asserter: "x", confidence: 1 }), (e) => e instanceof SchemaViolation && e.rule === "declared-needs-authority");
    assert.throws(() => j.assert({ subject: a.id, relation: "HAS_PREDICATE", object: literal("p", 1), source: "PARSED", verification: "HUMAN", asserter: "x", confidence: 1 }), (e) => e instanceof SchemaViolation && e.rule === "verification-of-nonlinferred");
    assert.throws(() => j.assert({ subject: a.id, relation: "HAS_FINGERPRINT", object: literal("f", "x"), attributes: { kind: "intrinsic", valid_from: 1 }, source: "INFERRED", asserter: "x", confidence: 1 }), (e) => e instanceof SchemaViolation && e.rule === "derived-needs-dependencies");
});
test("scopes are concepts, and a root scope is not a superuser", () => {
    const j = fresh();
    const root = declareScope(j, "application", "michael");
    const acct = declareScope(j, "accounting-policy", "michael", "Rules the CPA answers for.");
    const ui = declareScope(j, "ui-copy", "michael");
    assert.equal(hasStanding(j, { level: "OWNER", scope: root }, acct), false, "root is not implied to cover a child");
    j.commit();
    j.begin();
    declareAuthorityOver(j, root, acct, "michael");
    j.commit();
    assert.equal(hasStanding(j, { level: "OWNER", scope: root }, acct), true, "explicit declaration grants it");
    assert.equal(hasStanding(j, { level: "OWNER", scope: root }, ui), false, "and only for the child declared");
    assert.equal(hasStanding(j, { level: "CONTRIBUTOR", scope: acct }, acct), false, "contributors do not declare intent");
    assert.equal(j.getConcept(acct)?.kind, "scope");
});
