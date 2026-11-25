// measure: the experiment's measuring instrument, in the repository so any machine can reproduce a log entry.
// (Named `dogfood` until 2026-09-14; the old script name is kept as an alias so older log entries stay runnable.)
//
// Given a corpus, it reports how much of it the encoder can represent and which functions collide. When the corpus
// folder carries a MANIFEST.json it verifies every file's hash first, and when it carries an EXPECTED.json it
// compares this run with the recorded rows and says whether the run reproduces them. A measurement over a corpus
// that is not the recorded one is not a measurement of anything, so a hash mismatch stops the run.
// Same corpus, same ordinary adapter, no privileged path, no src/ change. It reports; it does not classify.
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { encodeFunctions, ENCODER } from "../src/adapters/typescript/index.js";
import { canonPath, fingerprint, IR_SCHEMA, type Stmt } from "../src/ir/index.js";
import { createHash } from "node:crypto";

// The compiled script runs from dist/scripts, so the root is found by walking up to the package.json, not by
// counting "..". Getting this wrong once made the instrument measure dist/src/*.d.ts and report 0 of 0 with
// complete confidence, which is the same failure as counting .test() and calling it a test.
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

function repositoryRoot(from: string): string {
  let dir = from;
  for (;;) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const up = dirname(dir);
    if (up === dir) throw new Error("Could not find the repository root: no package.json above the script.");
    dir = up;
  }
}

const ROOT = repositoryRoot(dirname(fileURLToPath(import.meta.url)));
// The corpus is overridable so a new encoder can be measured against a frozen corpus: without that, a change that
// adds source to this repository changes the corpus and the comparison with the previous entry is not controlled.
const CORPUS = process.argv[2] ? process.argv[2] : join(ROOT, "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts") && !p.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

function countStmts(body: Stmt[], acc: { stmts: number; opaque: number; reasons: Map<string, number> }): void {
  for (const s of body) {
    acc.stmts++;
    if (s.kind === "opaque") { acc.opaque++; acc.reasons.set(s.category, (acc.reasons.get(s.category) ?? 0) + 1); }
    if (s.kind === "branch") { countStmts(s.then, acc); countStmts(s.else, acc); }
  }
}

// The build id: a content hash of the code that is doing the measuring, so a number can never be mistaken for one
// produced by a different build. Three stale-artifact confusions in two days earned this line.
function buildId(): string {
  const h = createHash("sha256");
  for (const f of [...walk(join(ROOT, "src")), ...walk(join(ROOT, "scripts"))].sort())
    h.update(canonPath(relative(ROOT, f))).update(readFileSync(f));
  return h.digest("hex").slice(0, 12);
}

// ---- corpus verification, before anything is measured ----
interface Manifest { name: string; language: string; fileCount: number; totalBytes: number; corpusHash: string; files: { path: string; bytes: number; sha256: string }[] }
interface ExpectedRow { ir: number; measured: string; buildId: string | null; files: number; functions: number; statements: number; opaque: number; opaquePct: number; categories: Record<string, number> | null; collisionGroups: number; collisionFingerprints?: string[]; confirmed: string[]; current?: boolean; note?: string }
interface Expected { corpus: string; corpusHash: string; rows: ExpectedRow[] }

const corpusRoot = CORPUS.replace(/[\\/]src[\\/]?$/, "");
const manifestPath = join(corpusRoot, "MANIFEST.json");
const expectedPath = join(corpusRoot, "EXPECTED.json");
const manifest: Manifest | undefined = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : undefined;
const expected: Expected | undefined = existsSync(expectedPath) ? JSON.parse(readFileSync(expectedPath, "utf8")) : undefined;

if (manifest) {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const f of manifest.files) {
    const p = join(CORPUS, f.path);
    if (!existsSync(p)) { problems.push(`missing: ${f.path}`); continue; }
    seen.add(canonPath(f.path));
    const got = createHash("sha256").update(readFileSync(p)).digest("hex");
    if (got !== f.sha256) problems.push(`changed: ${f.path} (manifest ${f.sha256.slice(0, 12)}, on disk ${got.slice(0, 12)})`);
  }
  for (const p of walk(CORPUS)) {
    const rel = canonPath(relative(CORPUS, p));
    if (!seen.has(rel)) problems.push(`not in the manifest: ${rel}`);
  }
  if (problems.length > 0)
    throw new Error(`The corpus does not match ${manifestPath}:\n  ${problems.join("\n  ")}\nA measurement over a corpus that is not the recorded one is not a measurement of anything.`);
}

const files = walk(CORPUS);
const acc = { stmts: 0, opaque: 0, reasons: new Map<string, number>() };
const byFingerprint = new Map<string, string[]>();
let functions = 0;
const perFile: { file: string; functions: number; stmts: number; opaque: number }[] = [];

for (const file of files) {
  const rel = canonPath(relative(ROOT, file));
  const before = { ...acc, reasons: acc.reasons };
  const start = { stmts: acc.stmts, opaque: acc.opaque };
  const found = await encodeFunctions(readFileSync(file, "utf8"));
  for (const [name, ir] of found) {
    functions++;
    countStmts(ir.body, acc);
    const fp = fingerprint(ir);
    const g = byFingerprint.get(fp) ?? [];
    g.push(`${rel}:${name}`);
    byFingerprint.set(fp, g);
  }
  perFile.push({ file: rel, functions: found.size, stmts: acc.stmts - start.stmts, opaque: acc.opaque - start.opaque });
  void before;
}

if (functions === 0 || acc.stmts === 0)
  throw new Error(`The instrument found ${files.length} files, ${functions} functions, and ${acc.stmts} statements in ${CORPUS}. A corpus of zero is a broken measurement, not a result.`);

const groups = [...byFingerprint.entries()].filter(([, g]) => g.length > 1).sort((a, b) => b[1].length - a[1].length);
const pct = ((100 * acc.opaque) / Math.max(acc.stmts, 1)).toFixed(1);

console.log(`node       ${process.version}`);
console.log(`platform   ${process.platform} ${process.arch}`);
console.log(`encoder    ${ENCODER}   ir_schema ${IR_SCHEMA}`);
console.log(`build      ${buildId()}`);
console.log(`corpus     ${CORPUS === join(ROOT, "src") ? "src/**/*.ts" : CORPUS}${manifest ? `   verified against MANIFEST.json (${manifest.fileCount} files, corpus ${manifest.corpusHash})` : ""}`);
console.log(`files      ${files.length}`);
console.log(`functions  ${functions}`);
console.log(`statements ${acc.stmts}`);
console.log("");
console.log(`opaque            ${acc.opaque} / ${acc.stmts} statements = ${pct}%`);
console.log(`collision groups  ${groups.length}`);
console.log("");
console.log("opaque categories, worst first:");
for (const [reason, n] of [...acc.reasons].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
  console.log(`  ${String(n).padStart(4)}  ${reason}`);
console.log("");
console.log("collision groups (same intrinsic fingerprint, different names). Classification is a human's job:");
for (const [fp, g] of groups) console.log(`  ${fp}  ${g.sort().join("  |  ")}`);
console.log("");
console.log("per file: opaque / statements, functions:");
for (const f of perFile.sort((a, b) => b.opaque - a.opaque || a.file.localeCompare(b.file)))
  console.log(`  ${String(f.opaque).padStart(4)} / ${String(f.stmts).padStart(4)}   fns ${String(f.functions).padStart(3)}   ${f.file}`);

if (expected) {
  const row = expected.rows.find((r) => r.current) ?? expected.rows[expected.rows.length - 1];
  const got = { files: files.length, functions, statements: acc.stmts, opaque: acc.opaque, collisionGroups: groups.length };
  const diffs: string[] = [];
  for (const k of ["files", "functions", "statements", "opaque", "collisionGroups"] as const)
    if (got[k] !== row[k]) diffs.push(`${k}: recorded ${row[k]}, this run ${got[k]}`);
  if (row.collisionFingerprints) {
    const mine = groups.map(([fp]) => fp).sort().join(",");
    const theirs = [...row.collisionFingerprints].sort().join(",");
    if (mine !== theirs) diffs.push(`collision fingerprints differ from the recorded set for IR-${row.ir}`);
  }
  console.log("");
  if (diffs.length === 0)
    console.log(`reproduces  IR-${row.ir} of ${expected.corpus}, recorded ${row.measured}${row.buildId ? ` at build ${row.buildId}` : ""}, confirmed on ${row.confirmed.join(" and ")}.`);
  else {
    console.log(`DIFFERS from IR-${row.ir} of ${expected.corpus}, recorded ${row.measured}:`);
    for (const d of diffs) console.log(`  ${d}`);
    console.log("  Either the encoder changed, or this is a new encoder version and EXPECTED.json needs a new row. It is never a reason to edit an existing row.");
  }
}
