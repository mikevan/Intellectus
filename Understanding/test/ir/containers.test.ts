// I-1. The container instrument is observational: it reads the source again and counts what an opaque container
// conceals. These tests hold it to the definition frozen in the protocol: a hidden statement lies beneath an opaque
// container, is counted exactly once whatever its depth, carries enough provenance to audit, and is never mixed
// with the statements the IR represents.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { measureContainers, type Language } from "../../src/query/containers.js";

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".py") || (p.endsWith(".ts") && !p.endsWith(".d.ts"))) out.push(p);
  }
  return out;
}
const report = (corpus: string) => measureContainers(walk(corpus).map((p) => ({ path: p, source: readFileSync(p, "utf8"), language: (p.endsWith(".py") ? "python" : "typescript") as Language })));

const CORPORA = ["corpora/radon-python/src", "corpora/toml-python/src", "corpora/ir0-typescript/src"];

test("the prediction frozen before the work: radon conceals 33 yields", async () => {
  const r = await report("corpora/radon-python/src");
  assert.equal(r.byConstruct["yield"], 33, "predicted 33 hidden yields: 56 in the source, 23 counted by the measure");
});

for (const corpus of CORPORA)
  test(`every hidden statement is counted once and carries its provenance: ${corpus}`, async () => {
    const r = await report(corpus);
    assert.ok(r.hidden.length > 0, "every corpus conceals something");
    const keys = r.hidden.map((h) => `${h.file}:${h.line}:${h.column}`);
    assert.equal(new Set(keys).size, keys.length, "a statement under several containers is still one statement");
    for (const h of r.hidden) {
      assert.ok(h.file && h.line > 0 && h.nodeType && h.construct, "source location, node type and construct");
      assert.ok(["SEMANTIC", "NON_SEMANTIC", "METADATA"].includes(h.classification));
      assert.ok(h.nearestContainer && h.nearestContainerLine > 0 && h.depth >= 1, "nearest opaque ancestor and depth");
    }
    const byContainer = Object.values(r.byNearestContainer).reduce((s, v) => s + v.total, 0);
    const byClass = Object.values(r.byClassification).reduce((s, v) => s + v, 0);
    const byConstruct = Object.values(r.byConstruct).reduce((s, v) => s + v, 0);
    assert.equal(byContainer, r.hidden.length, "the container breakdown partitions the population");
    assert.equal(byClass, r.hidden.length, "the classification breakdown partitions the same population");
    assert.equal(byConstruct, r.hidden.length, "and so does the construct breakdown");
  });

test("a statement under three containers is attributed to the nearest one, and counted once", async () => {
  const source = "def f(xs):\n    for x in xs:\n        with open(x) as fh:\n            try:\n                yield fh\n            except OSError:\n                pass\n";
  const r = await measureContainers([{ path: "fixture.py", source, language: "python" }]);
  const y = r.hidden.filter((h) => h.construct === "yield");
  assert.equal(y.length, 1, "one yield in the source is one hidden statement");
  assert.equal(y[0]!.nearestContainer, "try_statement", "attributed to the container immediately above it");
  assert.equal(y[0]!.depth, 3, "three opaque containers stand above it");
});

test("a statement inside a nested function is represented there, so it is not hidden", async () => {
  const source = "def outer(xs):\n    for x in xs:\n        def inner(y):\n            return y + 1\n        yield inner(x)\n";
  const r = await measureContainers([{ path: "fixture.py", source, language: "python" }]);
  assert.ok(r.hidden.some((h) => h.construct === "yield"), "the yield under the loop is hidden");
  assert.ok(r.hidden.some((h) => h.nodeType === "function_definition"), "the nested def itself is a hidden statement");
  assert.ok(!r.hidden.some((h) => h.nodeType === "return_statement"), "the nested function's body is its own executable, so it is not hidden");
});

test("the instrument classifies statements the way the adapters do", async () => {
  const source = "def f(x):\n    'a docstring'\n    import os\n    for i in x:\n        'a bare string'\n        import sys\n        yield i\n";
  const r = await measureContainers([{ path: "fixture.py", source, language: "python" }]);
  const inside = Object.fromEntries(r.hidden.map((h) => [h.construct, h.classification]));
  assert.equal(inside["string"], "NON_SEMANTIC", "a bare string carries no execution semantics");
  assert.equal(inside["import_statement"], "METADATA");
  assert.equal(inside["yield"], "SEMANTIC");
  assert.equal(r.sourceStatementsRepresented.NON_SEMANTIC, 1, "the docstring is represented and non-semantic");
  assert.equal(r.sourceStatementsRepresented.METADATA, 1, "the import is represented and metadata");
});

test("a hidden count is a source-statement count, and the instrument says so with its output", async () => {
  const r = await report("corpora/radon-python/src");
  assert.ok(r.limits.some((l) => l.includes("never a number to add")), "the limit travels with the report");
});
