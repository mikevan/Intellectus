// The corpus is a published dataset, so its integrity is tested, not trusted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { canonPath } from "../../src/ir/index.js";

const ROOT = "corpora/ir0-typescript";

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir).sort()) { const p = join(dir, e); statSync(p).isDirectory() ? walk(p, out) : out.push(p); }
  return out;
}

test("the ir0-typescript corpus matches its manifest, file for file", () => {
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

test("the corpus carries its provenance and its expected results, and the rows are append-only in shape", () => {
  assert.ok(existsSync(join(ROOT, "PROVENANCE.md")), "a dataset without provenance cannot be reproduced by anyone else");
  const e = JSON.parse(readFileSync(join(ROOT, "EXPECTED.json"), "utf8"));
  const m = JSON.parse(readFileSync(join(ROOT, "MANIFEST.json"), "utf8"));
  assert.equal(e.corpusHash, m.corpusHash, "the expected results must be tied to this exact corpus");
  assert.deepEqual(e.rows.map((r: { ir: number }) => r.ir), [0, 1, 2, 3, 4], "one row per encoder version, in order, none removed");
  assert.equal(e.rows.filter((r: { current?: boolean }) => r.current).length, 1, "exactly one row is current");
  for (const r of e.rows) {
    assert.equal(r.statements, 240, "every row measures the same corpus, so the statement count cannot vary");
    assert.ok(r.confirmed.length >= 1 && r.note, "every row says where it was confirmed and what it means");
  }
});
