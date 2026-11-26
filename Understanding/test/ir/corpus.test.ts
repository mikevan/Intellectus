// The corpus is a published dataset, so its integrity is tested, not trusted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { canonPath } from "../../src/ir/index.js";

const CORPORA = ["corpora/ir0-typescript", "corpora/toml-python", "corpora/radon-python"];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir).sort()) { const p = join(dir, e); statSync(p).isDirectory() ? walk(p, out) : out.push(p); }
  return out;
}

for (const ROOT of CORPORA) test(`the ${ROOT.split("/")[1]} corpus matches its manifest, file for file`, () => {
  const m = JSON.parse(readFileSync(join(ROOT, "MANIFEST.json"), "utf8"));
  const src = join(ROOT, "src");
  assert.equal(m.fileCount, m.files.length);
  assert.equal(walk(src).length, m.fileCount, "no file added to or removed from the corpus");
  for (const f of m.files) {
    const p = join(src, f.path);
    assert.ok(existsSync(p), `${f.path} is missing from the corpus`);
    assert.equal(createHash("sha256").update(readFileSync(p)).digest("hex"), f.sha256, `${f.path} has been edited`);
    assert.equal(statSync(p).size, f.bytes);
  }
  const all = createHash("sha256");
  for (const f of m.files) all.update(f.path).update(f.sha256);
  assert.equal(all.digest("hex").slice(0, 16), m.corpusHash, "the corpus hash must be reproducible from the file hashes");
  for (const p of walk(src)) assert.ok(m.files.some((f: { path: string }) => f.path === canonPath(relative(src, p))), `${p} is not in the manifest`);
});

for (const ROOT of CORPORA) test(`the ${ROOT.split("/")[1]} corpus carries its provenance and its expected results`, () => {
  assert.ok(existsSync(join(ROOT, "PROVENANCE.md")), "a dataset without provenance cannot be reproduced by anyone else");
  const e = JSON.parse(readFileSync(join(ROOT, "EXPECTED.json"), "utf8"));
  const m = JSON.parse(readFileSync(join(ROOT, "MANIFEST.json"), "utf8"));
  assert.equal(e.corpusHash, m.corpusHash, "the expected results must be tied to this exact corpus");
  const irs = e.rows.map((r: { ir: number }) => r.ir);
  assert.deepEqual([...irs].sort((a, b) => a - b), irs, "rows are in encoder order, none removed or reordered");
  assert.equal(e.rows.filter((r: { current?: boolean }) => r.current).length, 1, "exactly one row is current");
  // The corpus is fixed; the measurement of it is not. A statement count is a property of the corpus AND the
  // encoder, so a better encoder can legitimately find more statements in the same files. What may not vary is the
  // corpus itself, and a row whose count differs from the row before it must say why. (This assertion replaced one
  // that required the statement count never to change; IR-5 proved that assumption false. See the log.)
  for (const r of e.rows) assert.equal(r.files, m.fileCount, "every row measures the same files");
  for (let i = 1; i < e.rows.length; i++) {
    const prev = e.rows[i - 1], row = e.rows[i];
    if (row.statements !== prev.statements)
      assert.ok(row.note && row.note.length > 40, `IR-${row.ir} changed the statement count and must explain why in its note`);
  }
  for (const r of e.rows) assert.ok(r.confirmed.length >= 1 && r.note, "every row says where it was confirmed and what it means");
  if (ROOT.endsWith("toml-python")) assert.ok(/56 functions/.test(e.rows[0].note), "the Python row must carry the adapter blind spot in its own note");
  if (ROOT.endsWith("radon-python")) assert.ok(/docstrings/.test(e.rows[0].note), "the application row must carry the docstring caveat, or its opacity will be compared with the libraries' and mean nothing");
});

// Was: "KNOWN DEFECT: the Python adapter misses methods that the TypeScript adapter finds". Fixed in IR-5; the test
// is inverted rather than deleted, so the fix is pinned the way the defect was.
test("the two adapters find the same things: a method inside a class is a function in both", async () => {
  const { encodeFunctions: py } = await import("../../src/adapters/python/index.js");
  const { encodeFunctions: ts } = await import("../../src/adapters/typescript/index.js");
  const found = await py("class A:\n    def m(self, x):\n        return x\n\ndef top(y):\n    return y\n");
  const tsFound = await ts("class A { m(x: number) { return x; } }\nfunction top(y: number) { return y; }\n");
  assert.deepEqual([...found.keys()].sort(), ["m", "top"], "Python must find the method inside the class");
  assert.deepEqual([...tsFound.keys()].sort(), ["m", "top"], "TypeScript finds it, and did before");
  const nested = await py("def outer(a):\n    def inner(b):\n        return b\n    return inner(a)\n");
  assert.deepEqual([...nested.keys()].sort(), ["inner", "outer"], "and a function inside a function");
});

// IR-9: the classification is a correction to a measurement, so the correction must be visible rather than a
// number quietly shrinking, and a non-semantic statement must never reach any downstream instrument as an effect.
test("a docstring is non-semantic, is excluded from the opacity denominator, and produces no effect", async () => {
  const { encodeFunctions } = await import("../../src/adapters/python/index.js");
  const { effectProjection } = await import("../../src/ir/index.js");
  const fn = (await encodeFunctions('def f(x):\n    """A docstring."""\n    if x > 1:\n        emit("E")\n    return x\n')).get("f")!;
  const classes = fn.body.filter((s) => s.kind === "opaque").map((s) => s.statementClass);
  assert.ok(classes.includes("NON_SEMANTIC"), "the docstring is classified non-semantic");
  const json = JSON.stringify(effectProjection(fn));
  assert.equal(json.includes("opaque:"), false, "a non-semantic statement must not appear downstream as a pseudo-effect");
});

test("an import is metadata, and a yield is semantic and opaque", async () => {
  const { encodeFunctions } = await import("../../src/adapters/python/index.js");
  const fn = (await encodeFunctions("def f(xs):\n    import os\n    for x in xs:\n        yield x\n")).get("f")!;
  const opaque = fn.body.filter((s) => s.kind === "opaque");
  assert.ok(opaque.some((s) => s.statementClass === "METADATA"), "the import is metadata");
  assert.ok(opaque.some((s) => s.statementClass === "SEMANTIC" && s.category === "loop"), "the loop is semantic and unrepresented");
});

test("every corpus row from IR-9 onward records what left the denominator", () => {
  for (const ROOT of CORPORA) {
    const e = JSON.parse(readFileSync(join(ROOT, "EXPECTED.json"), "utf8"));
    const row = e.rows.find((r: { ir: number }) => r.ir === 9);
    assert.ok(row, `${ROOT} has no IR-9 row`);
    assert.equal(typeof row.nonSemanticExcluded, "number", "the correction must be visible in the row");
    assert.equal(typeof row.metadataExcluded, "number");
    assert.ok(/non-semantic and \d+ metadata statements left the denominator/.test(row.note));
  }
});
