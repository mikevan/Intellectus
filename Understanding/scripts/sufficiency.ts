// E5-sufficiency: for every thread that meets the pre-registered criteria, what would an emitter have to invent?
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Journal } from "../src/journal/index.js";
import { ingest } from "../src/ingest/index.js";
import { checkSufficiency, MISSING_FACT_DEFINITIONS } from "../src/query/sufficiency.js";

function repositoryRoot(from: string): string {
  let dir = from;
  for (;;) { if (existsSync(join(dir, "package.json"))) return dir; const up = dirname(dir); if (up === dir) throw new Error("no root"); dir = up; }
}
const ROOT = repositoryRoot(dirname(fileURLToPath(import.meta.url)));
const CORPUS = process.argv[2] ?? join(ROOT, "corpora/toml-python/src");
function walk(d: string, o: string[] = []): string[] {
  for (const e of readdirSync(d).sort()) { const p = join(d, e); statSync(p).isDirectory() ? walk(p, o) : ((p.endsWith(".py") || (p.endsWith(".ts") && !p.endsWith(".d.ts"))) && o.push(p)); }
  return o;
}

const j = new Journal();
j.begin("E5 sufficiency");
await ingest(j, walk(CORPUS), CORPUS);
j.commit();
const r = checkSufficiency(j);

console.log(`corpus            ${CORPUS}`);
console.log(`threads walked    ${r.threads.length}   (an entry executable and everything reachable through resolved calls)`);
console.log(`qualifying        ${r.qualifying}   (>=3 executables, >=1 branch, >=1 observable effect, >=1 boundary crossing, 0 opacity)`);
console.log(`SUFFICIENT        ${r.sufficientThreads}`);
console.log("");
console.log("why threads fail to qualify, worst first:");
const reasons = new Map<string, number>();
for (const t of r.threads) for (const f of t.qualification.failed) {
  const key = f.replace(/^only \d+ executable\(s\)/, "fewer than 3 executables").replace(/^\d+ opaque/, "opaque");
  reasons.set(key, (reasons.get(key) ?? 0) + 1);
}
for (const [why, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${why}`);

console.log("");
if (r.qualifying === 0) console.log("no thread qualifies, so no sufficiency verdict is possible on this corpus.");
else {
  console.log("qualifying threads:");
  for (const t of r.threads.filter((x) => x.qualification.qualifies)) {
    console.log(`  ${t.entry}  (${t.qualification.executables} executables, ${t.qualification.branches} predicates, ${t.qualification.observableEffects} effects)  ${t.sufficient ? "SUFFICIENT" : `${t.occurrences.length} missing facts`}`);
    for (const m of t.missing) console.log(`      ${String(m.count).padStart(3)}  ${m.fact}   ${m.where.slice(0, 3).join(", ")}`);
  }
  console.log("");
  console.log("ranked missing facts across qualifying threads (occurrences, then threads affected):");
  for (const x of r.ranked) console.log(`  ${String(x.occurrences).padStart(4)}  ${String(x.threads).padStart(3)} thr   ${x.fact}`);
  console.log("");
  console.log("what each means:");
  for (const x of r.ranked) console.log(`  ${x.fact}: ${MISSING_FACT_DEFINITIONS[x.fact]}`);
}

console.log("");
console.log("the emitter's needs, frozen before measuring:");
for (const n of r.emitterNeeds) console.log(`  - ${n}`);
console.log("");
console.log("limits of this checker:");
for (const l of r.limits) console.log(`  - ${l}`);

// R-1B0: order accounting, added after every earlier section so nothing above it moves.
console.log("");
console.log("order of observable effects (R-1B0, instrument only):");
console.log(`  definition: ${r.order.definition}`);
console.log(`  order relations designated: ${r.order.orderRelations.length === 0 ? "none" : r.order.orderRelations.join(", ")}`);
console.log(`  executables with two or more observable effects: ${r.order.executables}`);
console.log(`  pairs: ${r.order.pairs}, fixed by the store: ${r.order.fixed}, unordered: ${r.order.unordered}`);
for (const t of r.threads.filter((x) => x.qualification.qualifies))
  console.log(`  qualifying thread ${t.entry}: ${t.order.pairs} pairs, ${t.order.unordered} unordered`);
console.log("  limits:");
for (const l of r.order.limits) console.log(`  - ${l}`);
