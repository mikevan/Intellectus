// E5-sufficiency: measurement only, criteria pre-registered, checklist frozen. These tests pin the properties that
// make the verdict trustworthy, including that the checker cannot be talked into declaring a thread sufficient.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Journal } from "../../src/journal/index.js";
import { ingest } from "../../src/ingest/index.js";
import { checkSufficiency, EMITTER_NEEDS, MISSING_FACT_DEFINITIONS } from "../../src/query/sufficiency.js";
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function checked(files: string[], root: string) {
  const j = new Journal();
  j.begin("sufficiency");
  await ingest(j, files, root);
  j.commit();
  return { j, report: checkSufficiency(j) };
}
const PYTHON = ["decoder.py", "encoder.py", "tz.py", "ordered.py", "__init__.py"].map((f) => `corpora/toml-python/src/${f}`);

test("the checker writes nothing: measurement only", async () => {
  const { j } = await checked(PYTHON, "corpora/toml-python/src");
  const before = j.sequence, live = j.liveAssertions().length;
  checkSufficiency(j);
  assert.equal(j.sequence, before);
  assert.equal(j.liveAssertions().length, live);
});

test("the emitter's checklist and the fact definitions travel with every report", async () => {
  const { report } = await checked(PYTHON, "corpora/toml-python/src");
  assert.equal(report.emitterNeeds, EMITTER_NEEDS);
  assert.equal(EMITTER_NEEDS.length, 8, "the checklist is frozen; adding to it is a new log entry");
  assert.ok(EMITTER_NEEDS.some((n) => /operation's identity and semantics/.test(n) && /externally observable behaviour/.test(n)),
    "effect sufficiency must require the effect's semantics, not merely its invocation");
  assert.ok(EMITTER_NEEDS.some((n) => /NOT a programming-language type/.test(n)),
    "semantic entity identity must stay distinct from type information");
  assert.equal(Object.keys(MISSING_FACT_DEFINITIONS).length, 8);
});

test("prediction 1: no thread in the Python corpus is sufficient", async () => {
  const { report } = await checked(PYTHON, "corpora/toml-python/src");
  assert.equal(report.sufficientThreads, 0, "if this is not zero, the store is further along than the log claims and the thread is the E4 candidate");
});

test("a thread with an observable effect always reports EFFECT_UNDERSPECIFIED, because the store holds only its invocation", async () => {
  const dir = mkdtempSync(join(tmpdir(), "suff-"));
  writeFileSync(join(dir, "a.py"), "def inner(x):\n    if x > 1:\n        emit('E')\n    return x\n\ndef middle(y):\n    return inner(y)\n\ndef outer(z):\n    return middle(z)\n");
  const { report } = await checked([join(dir, "a.py")], dir);
  const t = report.threads.find((x) => x.entry === "outer")!;
  assert.ok(t, "outer is an entry: nothing calls it");
  assert.ok(t.occurrences.some((o) => o.fact === "EFFECT_UNDERSPECIFIED"),
    "an effect the store knows only as an operation and an argument count is not enough to reproduce it");
  assert.ok(t.occurrences.find((o) => o.fact === "EFFECT_UNDERSPECIFIED")!.because.includes("no semantics for the operation"));
});

test("TYPE_REQUIRED is never populated by this checker, and the limit says why", async () => {
  const { report } = await checked(PYTHON, "corpora/toml-python/src");
  assert.equal(report.ranked.some((r) => r.fact === "TYPE_REQUIRED"), false);
  assert.ok(report.limits.some((l) => /TYPE_REQUIRED is not populated/.test(l) && /Convenience does not count/.test(l)),
    "counting convenience would manufacture evidence for needing a type system");
});

test("the qualification criteria are applied as written, and a trivial thread fails four of five", async () => {
  const dir = mkdtempSync(join(tmpdir(), "suff-triv-"));
  writeFileSync(join(dir, "t.py"), "def double(x):\n    return x * 2\n");
  const { report } = await checked([join(dir, "t.py")], dir);
  const t = report.threads.find((x) => x.entry === "double")!;
  assert.equal(t.qualification.qualifies, false);
  assert.ok(t.qualification.failed.length >= 4, `return x * 2 must fail most criteria, failed ${JSON.stringify(t.qualification.failed)}`);
});

test("the checker states that a thread understates the work, because it follows resolved calls only", async () => {
  const { report } = await checked(PYTHON, "corpora/toml-python/src");
  assert.ok(report.limits.some((l) => /RESOLVED calls/.test(l) && /understate/.test(l)));
});
