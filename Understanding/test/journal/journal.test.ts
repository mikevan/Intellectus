import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Journal, literal, JournalError } from "../../src/index.js";

function tmp(): string { return join(mkdtempSync(join(tmpdir(), "und-")), "journal.ndjson"); }

test("assertions live inside transactions and survive a reload", () => {
  const p = tmp();
  const j = new Journal(p);
  j.begin("first");
  const f = j.concept("executable"); const g = j.concept("executable");
  const id = j.assert({ subject: f.id, relation: "CALLS", object: g.id, source: "PARSED", asserter: "test-adapter/0", confidence: 1 });
  j.commit();
  const j2 = new Journal(p);
  assert.equal(j2.liveAssertions().length, 1);
  assert.equal(j2.liveAssertions()[0].id, id);
  assert.equal(j2.getConcept(f.id)?.kind, "executable");
});

test("an uncommitted transaction is ignored on replay: the crash rule", () => {
  const p = tmp();
  const j = new Journal(p);
  j.begin(); const a = j.concept("executable"); const b = j.concept("executable");
  j.assert({ subject: a.id, relation: "CALLS", object: b.id, source: "PARSED", asserter: "t", confidence: 1 });
  j.commit();
  // simulate a crash: a BEGIN and events with no COMMIT appended by hand
  const text = readFileSync(p, "utf8");
  writeFileSync(p, text + JSON.stringify({ kind: "BEGIN", tx: 2, schema: 1, at: "x" }) + "\n" + JSON.stringify({ kind: "ASSERT", id: 99, tx: 2, schema: 1, at: "x", subject: a.id, relation: "CALLS", object: a.id, source: "PARSED", asserter: "t", confidence: 1, verification: "NONE" }) + "\n");
  const j2 = new Journal(p);
  assert.equal(j2.liveAssertions().length, 1, "the half-written transaction must not be live");
});

test("supersession replaces; retraction ceases; history keeps both", () => {
  const j = new Journal();
  j.begin(); const f = j.concept("executable");
  const p1 = j.assert({ subject: f.id, relation: "HAS_PREDICATE", object: literal("predicate", { op: "GT", value: 25000 }), source: "PARSED", asserter: "t", confidence: 1 });
  j.commit();
  j.begin();
  const p2 = j.assert({ subject: f.id, relation: "HAS_PREDICATE", object: literal("predicate", { op: "GT", value: 50000 }), source: "PARSED", asserter: "t", confidence: 1, supersedes: p1 });
  j.commit();
  assert.deepEqual(j.liveAssertions().map((a) => a.id), [p2]);
  j.begin(); j.retract(p2, { source: "PARSED", asserter: "t" }); j.commit();
  assert.equal(j.liveAssertions().length, 0);
  assert.equal(j.history().filter((e) => e.kind === "ASSERT").length, 2, "history keeps every assertion");
  assert.equal(j.history().filter((e) => e.kind === "RETRACT").length, 1);
});

test("retracting a base fact retracts what was derived from it, in the same transaction", () => {
  const j = new Journal();
  j.begin(); const f = j.concept("executable"); const g = j.concept("executable");
  const call = j.assert({ subject: f.id, relation: "CALLS", object: g.id, source: "PARSED", asserter: "t", confidence: 1 });
  const fp = j.assert({ subject: f.id, relation: "HAS_FINGERPRINT", object: literal("fingerprint", "abc"), attributes: { kind: "intrinsic", valid_from: 1 }, source: "INFERRED", asserter: "t", confidence: 1, derived_from: [call] });
  j.commit();
  j.begin(); const gone = j.retract(call, { source: "PARSED", asserter: "t" }); j.commit();
  assert.deepEqual(new Set(gone), new Set([call, fp]));
  assert.equal(j.liveAssertions().length, 0);
});

test("one writer: a second begin() while one is open is refused", () => {
  const j = new Journal(); j.begin();
  assert.throws(() => j.begin(), JournalError);
});
