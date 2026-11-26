// P0. The frozen controls of docs/p0-controls.json, run through the real encoders and real ingestion, plus the IR and
// classifier controls. A failure here is a miss of the frozen expectation, recorded as such; nothing is tuned.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Journal } from "../../src/journal/index.js";
import { ingest } from "../../src/ingest/index.js";
import { canonicalise, type FunctionIR } from "../../src/ir/index.js";
import { classify, reconcileCallSites, reconcileExecutable, type ExecutableReport } from "../../src/query/callsites.js";
import { encodeFunctions as encPy } from "../../src/adapters/python/index.js";
import { encodeFunctions as encTs } from "../../src/adapters/typescript/index.js";

function repositoryRoot(from: string): string {
  let dir = from;
  for (;;) { if (existsSync(join(dir, "package.json"))) return dir; const up = dirname(dir); if (up === dir) throw new Error("no root"); dir = up; }
}
const ROOT = repositoryRoot(dirname(fileURLToPath(import.meta.url)));
const CONTROLS = JSON.parse(readFileSync(join(ROOT, "docs/p0-controls.json"), "utf8"));
const CONTROLS2 = JSON.parse(readFileSync(join(ROOT, "docs/p0-controls-2.json"), "utf8"));

interface Expected { O: number; Opp: number; S: number; P: number; T: number; classes: string[]; mapping: string[];
  a1: { callSteps: number; callEffects: number; opaqueSteps: number; opaqueEffects: number; unmatchedSteps: number; unmatchedEffects: number };
  irShape?: string[]; visibility?: { valuelessThrows: number; opaqueStatements: number }; unmatched?: { operation: string; reason: string }[] }

// Reports and shapes are keyed by file and name, so two languages can never collide on a function name.
async function runControls(): Promise<{ reports: Map<string, ExecutableReport>; shapes: Map<string, string[]>; files: Record<string, string> }> {
  const dir = mkdtempSync(join(tmpdir(), "p0-controls-"));
  const files: string[] = [];
  for (const lang of ["python", "typescript"]) {
    const s = CONTROLS.sources[lang];
    const p = join(dir, s.path); writeFileSync(p, s.text); files.push(p);
  }
  const j = new Journal(); j.begin("p0 controls");
  await ingest(j, files, dir);
  j.commit();
  const fns: { file: string; name: string; fn: FunctionIR }[] = [];
  const shapes = new Map<string, string[]>();
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const rel = f.slice(dir.length).replace(/^[\\/]+/, "");
    for (const [n, ir] of f.endsWith(".py") ? await encPy(src) : await encTs(src)) {
      fns.push({ file: rel, name: n, fn: ir });
      shapes.set(`${rel}::${n}`, canonicalise(ir).body.map((s) => JSON.stringify(s)));
    }
  }
  const report = reconcileCallSites(j, fns);
  return { reports: new Map(report.executables.map((e) => [`${e.file}::${e.name}`, e])), shapes,
    files: { python: CONTROLS.sources.python.path, typescript: CONTROLS.sources.typescript.path } };
}

const controls = runControls();

for (const lang of ["python", "typescript"])
  for (const [name, exp] of Object.entries(CONTROLS.expected[lang]) as [string, Expected][])
    test(`P0 control ${lang} ${name}`, async () => {
      const { reports, shapes, files } = await controls;
      const id = `${files[lang]}::${name}`;
      const r = reports.get(id);
      assert.ok(r, `${id} was not encoded`);
      if (exp.irShape) assert.deepEqual(shapes.get(id), exp.irShape, "the encoder's IR shape differs from the one observed at freeze");
      const { O, Opp, S, P, T } = r.counts;
      assert.deepEqual({ O, Opp, S, P, T }, { O: exp.O, Opp: exp.Opp, S: exp.S, P: exp.P, T: exp.T });
      assert.deepEqual([...new Set(r.rows.flatMap((x) => x.classes))].sort(), [...exp.classes].sort());
      assert.deepEqual(r.mappings, [...exp.mapping].sort());
      assert.deepEqual({ callSteps: r.a1.callSteps, callEffects: r.a1.callEffects, opaqueSteps: r.a1.opaqueSteps, opaqueEffects: r.a1.opaqueEffects,
        unmatchedSteps: r.a1.unmatchedSteps, unmatchedEffects: r.a1.unmatchedEffects }, exp.a1);
      if (exp.visibility) assert.deepEqual(r.visibility, exp.visibility);
      if (exp.unmatched) assert.deepEqual(r.unmatched.map((u) => ({ operation: u.operation, reason: u.reason })), exp.unmatched);
    });

for (const c of CONTROLS.irControls)
  test(`P0 IR control ${c.name}`, () => {
    const r = reconcileExecutable("(ir)", c.name, 0, c.fn as FunctionIR, null);
    assert.deepEqual({ O: r.counts.O, Opp: r.counts.Opp, S: r.counts.S, P: r.counts.P }, { O: c.expected.O, Opp: c.expected.Opp, S: c.expected.S, P: c.expected.P });
    assert.deepEqual([...new Set(r.rows.flatMap((x) => x.classes))].sort(), [...c.expected.classesWithoutStore].sort());
  });

for (const k of CONTROLS.classifierControls)
  test(`P0 classifier control ${k.name}`, () => {
    assert.deepEqual(classify({ Opp: k.Opp, S: k.S, P: k.P, T: k.T }).sort(), [...k.expected].sort());
  });

test("P0 control names are distinct across languages", () => {
  const names = [...Object.keys(CONTROLS.expected.python), ...Object.keys(CONTROLS.expected.typescript)];
  assert.equal(new Set(names).size, names.length);
});

// p0-controls-2: added after the first runs, under the P0 source review. The frozen controls above are unchanged.
test("P0 control 2: an empty executable is paired, and a stored-only executable still counts in the stored total", async () => {
  const c = CONTROLS2.pairing;
  const dir = mkdtempSync(join(tmpdir(), "p0-controls-2-"));
  const file = join(dir, c.source.path); writeFileSync(file, c.source.text);
  const j = new Journal(); j.begin("p0 controls 2"); await ingest(j, [file], dir); j.commit();
  const fns: { file: string; name: string; fn: FunctionIR }[] = [];
  for (const [n, ir] of await encPy(c.source.text)) if (!c.omitFromIr.includes(n)) fns.push({ file: c.source.path, name: n, fn: ir });
  const r = reconcileCallSites(j, fns);
  assert.deepEqual(r.unpaired, { inIrOnly: c.expected.inIrOnly, inStoreOnly: c.expected.inStoreOnly });
  assert.deepEqual({ T: r.totals.T, Tmatched: r.totals.Tmatched, TstoreOnly: r.totals.TstoreOnly }, { T: c.expected.T, Tmatched: c.expected.Tmatched, TstoreOnly: c.expected.TstoreOnly });
  const empty = r.executables.find((e) => e.name === c.expected.emptyExecutable.name)!;
  assert.deepEqual({ T: empty.counts.T, rows: empty.rows.length }, { T: c.expected.emptyExecutable.T, rows: c.expected.emptyExecutable.rows });
});

for (const [name, exp] of Object.entries(CONTROLS2.a1Attribution.python) as [string, { groups: { match: string; steps: number; effects: number; unmatchedSteps: number; returnedSteps: number; candidates: number; attribution: string }[]; attributed: number }][])
  test(`P0 control 2: A1 attribution ${name}`, async () => {
    const { reports, files } = await controls;
    const r = reports.get(`${files.python}::${name}`)!;
    assert.deepEqual(r.a1.groups.map((g) => ({ match: g.match, steps: g.steps, effects: g.effects, unmatchedSteps: g.unmatchedSteps, returnedSteps: g.returnedSteps, candidates: g.candidates.length, attribution: g.attribution })), exp.groups);
    assert.equal(r.a1.attributed.length, exp.attributed);
  });
