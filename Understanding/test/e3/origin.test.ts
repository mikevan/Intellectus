// E3-origin: apparatus only. Origins were frozen before any occurrence was read, and UNRESOLVED is a legitimate
// answer. These tests pin the properties that make the output a measurement.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Journal } from "../../src/journal/index.js";
import { ingest } from "../../src/ingest/index.js";
import { classifyReceiverOrigins, ORIGIN_DEFINITIONS } from "../../src/query/origin.js";

async function origins(files: string[], root: string) {
  const j = new Journal();
  j.begin("origin");
  await ingest(j, files, root);
  j.commit();
  return classifyReceiverOrigins(j);
}

const PYTHON = ["decoder.py", "encoder.py", "tz.py", "ordered.py", "__init__.py"].map((f) => `corpora/toml-python/src/${f}`);

test("every receiver is classified into a frozen origin, and the totals reconcile", async () => {
  const r = await origins(PYTHON, "corpora/toml-python/src");
  assert.equal(r.records.length, r.receivers);
  const sum = Object.values(r.byOrigin).reduce((s, v) => s + v.occurrences, 0);
  assert.equal(sum, r.receivers, "the origins partition the receivers");
  for (const rec of r.records) assert.ok(ORIGIN_DEFINITIONS[rec.origin], `${rec.origin} has no frozen definition`);
  assert.equal(Object.keys(ORIGIN_DEFINITIONS).length, 7);
});

test("the prediction: a non-zero subset of receivers has a mechanically traceable origin", async () => {
  const r = await origins(PYTHON, "corpora/toml-python/src");
  assert.ok(r.traceable > 0, "if this is zero, receiver identity is a terminal label and the next job is much larger");
  assert.ok(r.traceable < r.receivers, "and it is not all of them, which is the finding the round exists to size");
});

test("a receiver traced to a parameter rests on the flow assertions that carried it", async () => {
  const r = await origins(PYTHON, "corpora/toml-python/src");
  const param = r.records.filter((x) => x.origin === "PARAMETER");
  assert.ok(param.length > 0);
  for (const p of param) {
    assert.ok(p.supporting.length >= 1, "a traced origin names what it rests on");
    assert.ok(p.because.length > 30);
  }
});

test("UNRESOLVED stays legitimate and says what the encoder recorded instead", async () => {
  const r = await origins(PYTHON, "corpora/toml-python/src");
  const un = r.records.filter((x) => x.origin === "UNRESOLVED");
  assert.ok(un.length > 0, "this corpus has receivers whose origin IR-7 cannot establish");
  for (const u of un) assert.ok(/recorded the receiver as/.test(u.because), "and it says what was recorded rather than guessing");
});

test("the instrument states that an origin is not a type, and that module identity is unavailable", async () => {
  const r = await origins(PYTHON, "corpora/toml-python/src");
  assert.ok(r.limits.some((l) => /An origin is not a type/.test(l)));
  assert.ok(r.limits.some((l) => /MODULE_OR_IMPORTED cannot be populated/.test(l)));
  assert.equal(r.byOrigin.MODULE_OR_IMPORTED.occurrences, 0, "a category the evidence cannot support stays empty");
});

test("classifying origins changes nothing in the store: measurement only", async () => {
  const j = new Journal();
  j.begin("origin, no writes");
  await ingest(j, PYTHON, "corpora/toml-python/src");
  j.commit();
  const before = j.sequence;
  const liveBefore = j.liveAssertions().length;
  classifyReceiverOrigins(j);
  assert.equal(j.sequence, before, "the classifier appended nothing");
  assert.equal(j.liveAssertions().length, liveBefore);
});
