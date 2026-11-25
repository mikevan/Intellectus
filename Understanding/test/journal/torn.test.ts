// A torn final line is a crash, not corruption: the store loads, and the transaction it belonged to is discarded whole.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Journal, JournalError } from "../../src/index.js";

function seeded(): { path: string; calls: number } {
  const path = join(mkdtempSync(join(tmpdir(), "und-torn-")), "journal.ndjson");
  const j = new Journal(path);
  j.begin("good");
  const a = j.concept("executable"); const b = j.concept("executable");
  j.assert({ subject: a.id, relation: "CALLS", object: b.id, source: "PARSED", asserter: "t", confidence: 1 });
  j.commit();
  return { path, calls: 1 };
}

test("a torn final line is discarded with its whole transaction, and the store still loads", () => {
  const { path } = seeded();
  const text = readFileSync(path, "utf8");
  // a crash mid-append: BEGIN, one complete event, then a half-written object with no newline
  writeFileSync(path, text
    + JSON.stringify({ kind: "BEGIN", tx: 2, schema: 1, at: "2026-09-13T00:00:00.000Z" }) + "\n"
    + JSON.stringify({ kind: "CONCEPT", id: 4, tx: 2, schema: 1, at: "2026-09-13T00:00:00.000Z", concept: { id: "C-AAAAAAAAAAAA", kind: "executable" } }) + "\n"
    + '{"kind":"ASSERT","id":5,"tx":2,');
  const j = new Journal(path);
  assert.equal(j.hadTornTail, true, "the tail must be reported as torn");
  assert.equal(j.liveAssertions().length, 1, "only the committed transaction is live");
  assert.equal(j.getConcept("C-AAAAAAAAAAAA" as never), undefined, "the discarded transaction's concept is not in the projection");
});

test("a torn line that is not the last line is corruption and is refused", () => {
  const { path } = seeded();
  const lines = readFileSync(path, "utf8").split("\n").filter((l) => l.length > 0);
  lines.splice(1, 0, '{"kind":"ASSERT","id":9,"tx":');
  writeFileSync(path, lines.join("\n") + "\n");
  assert.throws(() => new Journal(path), (e: unknown) => e instanceof JournalError && /corrupt, not torn/.test((e as Error).message));
});

test("a complete but truncated transaction (no COMMIT, clean lines) is also discarded", () => {
  const { path } = seeded();
  const text = readFileSync(path, "utf8");
  writeFileSync(path, text + JSON.stringify({ kind: "BEGIN", tx: 2, schema: 1, at: "x" }) + "\n"
    + JSON.stringify({ kind: "CONCEPT", id: 4, tx: 2, schema: 1, at: "x", concept: { id: "C-BBBBBBBBBBBB", kind: "executable" } }) + "\n");
  const j = new Journal(path);
  assert.equal(j.hadTornTail, false, "nothing was torn; the transaction simply never committed");
  assert.equal(j.liveAssertions().length, 1);
});

test("a store with a torn tail can be written to again, and the new transaction commits cleanly", () => {
  const { path } = seeded();
  writeFileSync(path, readFileSync(path, "utf8") + JSON.stringify({ kind: "BEGIN", tx: 2, schema: 1, at: "x" }) + "\n" + '{"kind":"CONCEPT","id":4,');
  const j = new Journal(path);
  j.begin("after the crash");
  const c = j.concept("executable");
  j.assert({ subject: c.id, relation: "HAS_PREDICATE", object: { type: "predicate", value: { op: "GT" } }, source: "PARSED", asserter: "t", confidence: 1 });
  j.commit();
  const again = new Journal(path);
  assert.equal(again.liveAssertions().length, 2, "the pre-crash assertion and the post-crash one");
  assert.equal(again.hadTornTail, false, "the incomplete bytes were truncated on the load that found them");
  for (const [i, line] of readFileSync(path, "utf8").split("\n").filter((l) => l.length > 0).entries())
    assert.doesNotThrow(() => JSON.parse(line), `line ${i + 1} must be parseable after recovery`);
});
