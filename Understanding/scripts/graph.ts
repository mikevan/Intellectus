// Step 3 of E3: ingest a corpus and measure the graph, before any path apparatus exists.
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Journal } from "../src/journal/index.js";
import { ingest } from "../src/ingest/index.js";
import { classifyLoss } from "../src/query/loss.js";
import { classifyReceiverOrigins } from "../src/query/origin.js";
import { classifyProducers } from "../src/query/producer.js";
import { reconcile } from "../src/query/reconcile.js";
import { reconcileCallSites } from "../src/query/callsites.js";
import { canonPath } from "../src/ir/index.js";
import { encodeFunctions as encPy } from "../src/adapters/python/index.js";
import { encodeFunctions as encTs } from "../src/adapters/typescript/index.js";

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
j.begin("E3 ingestion");
const report = await ingest(j, walk(CORPUS), CORPUS);
j.commit();

console.log(`corpus            ${CORPUS}`);
console.log(`files             ${report.files}`);
console.log(`concepts          ${report.modules + report.executables}  (${report.modules} modules, ${report.executables} executables)`);
console.log(`assertions        ${report.assertions}`);
console.log("");
console.log("assertions by relation:");
for (const [r, n] of Object.entries(report.byRelation).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${r}`);

// ---- the question step 3 exists to answer ----
const live = j.liveAssertions();
const executables = new Set<string>(live.filter((a) => a.relation === "MEMBER_OF").map((a) => String(a.subject)));
const calls = live.filter((a) => a.relation === "CALLS");
const out = new Map<string, Set<string>>(); const inn = new Map<string, Set<string>>();
const add = (m: Map<string, Set<string>>, k: string, v: string): void => { const s = m.get(k) ?? new Set<string>(); s.add(v); m.set(k, s); };
for (const c of calls) { add(out, c.subject, String(c.object)); add(inn, String(c.object), c.subject); }
const isolated = [...executables].filter((e) => !out.has(e) && !inn.has(e));

// connected components over CALLS, treated as undirected
const seen = new Set<string>(); let components = 0; let largest = 0;
for (const e of executables) {
  if (seen.has(e)) continue;
  components++; let size = 0; const stack = [e];
  while (stack.length) {
    const n = stack.pop()!; if (seen.has(n)) continue; seen.add(n); size++;
    for (const m of out.get(n) ?? []) if (!seen.has(m)) stack.push(m);
    for (const m of inn.get(n) ?? []) if (!seen.has(m)) stack.push(m);
  }
  largest = Math.max(largest, size);
}

// longest directed CALLS chain, which is the crudest form of "is there a path at all"
const depth = new Map<string, number>();
const longest = (n: string, onStack = new Set<string>()): number => {
  if (depth.has(n)) return depth.get(n)!;
  if (onStack.has(n)) return 0; // a cycle contributes nothing further
  onStack.add(n);
  let best = 0;
  for (const m of out.get(n) ?? []) best = Math.max(best, 1 + longest(m, onStack));
  onStack.delete(n);
  depth.set(n, best);
  return best;
};
let deepest = 0; for (const e of executables) deepest = Math.max(deepest, longest(e));

console.log("");
console.log("interprocedural structure:");
console.log(`  executables               ${executables.size}`);
console.log(`  CALLS edges               ${calls.length}   (resolved ${report.resolvedCalls})`);
console.log(`  isolated executables      ${isolated.length}  (no call in or out)`);
console.log(`  connected components      ${components}   largest ${largest}`);
console.log(`  longest directed chain    ${deepest} call${deepest === 1 ? "" : "s"} deep`);
console.log("");
const unresolved = Object.entries(report.unresolvedCalls).sort((a, b) => b[1] - a[1]);
console.log(`call operations with no callee  ${unresolved.length} distinct, ${unresolved.reduce((s, [, n]) => s + n, 0)} occurrences  (unresolved + ambiguous invocations; opaque: entries are pseudo-operations, not calls)`);
for (const [op, n] of unresolved.slice(0, 12)) console.log(`  ${String(n).padStart(4)}  ${op}`);
console.log("");
console.log("boundary composition:");
console.log(`  invocations               ${report.invocations}   (resolved ${report.resolvedCalls}, unresolved ${report.unresolvedInvocations}, ambiguous ${report.ambiguousInvocations}, self ${report.selfInvocations})`);
console.log(`  boundary values           ${report.values}`);
console.log(`  FLOWS_TO edges            ${report.flows}`);

// value-level connectivity: how far can a value actually travel?
const values = new Set<string>(live.filter((a) => ["HAS_PARAMETER", "HAS_ARGUMENT", "HAS_OUTCOME", "HAS_RETURN"].includes(a.relation)).map((a) => String(a.object)));
const fout = new Map<string, string[]>();
for (const f of live.filter((a) => a.relation === "FLOWS_TO")) { const l = fout.get(f.subject) ?? []; l.push(String(f.object)); fout.set(f.subject, l); }
const reach = (v: string): number => {
  const seenV = new Set<string>([v]); const stack = [v]; let n = 0;
  while (stack.length) { const x = stack.pop()!; for (const y of fout.get(x) ?? []) if (!seenV.has(y)) { seenV.add(y); n++; stack.push(y); } }
  return n;
};
let longestFlow = 0; let flowing = 0;
for (const v of values) { const r = reach(v); if (r > 0) flowing++; longestFlow = Math.max(longestFlow, r); }
console.log(`  values that flow anywhere  ${flowing} of ${values.size}`);
console.log(`  largest value reachability ${longestFlow} value${longestFlow === 1 ? "" : "s"}`);

// ---- E3-loss: what each unresolved invocation cost, and why ----
const loss = classifyLoss(j);
console.log("");
console.log(`what the ${loss.classified} invocations with no CALLS edge cost, by cause (occurrences, not distinct names):`);
console.log("  category               occ    args   lost flows");
const rows = Object.entries(loss.byCategory).filter(([, v]) => v.occurrences > 0).sort((a, b) => b[1].lostFlows - a[1].lostFlows);
for (const [cat, v] of rows)
  console.log(`  ${cat.padEnd(20)} ${String(v.occurrences).padStart(4)}  ${String(v.arguments).padStart(6)}  ${String(v.lostFlows).padStart(11)}`);
const totalLost = rows.reduce((s, [, v]) => s + v.lostFlows, 0);
const written = j.liveAssertions().filter((a) => a.relation === "FLOWS_TO").length;
console.log(`  ${"TOTAL".padEnd(20)} ${String(loss.classified).padStart(4)}  ${String(rows.reduce((s, [, v]) => s + v.arguments, 0)).padStart(6)}  ${String(totalLost).padStart(11)}`);
console.log(`  flows written ${written}; flows prevented ${totalLost}; so ${(100 * written / (written + totalLost)).toFixed(1)}% of the composition this corpus offers was captured.`);
console.log("");
console.log("  ranked by cost, the operations in each cause:");
for (const [cat, v] of rows) console.log(`    ${cat.padEnd(20)} ${v.operations.slice(0, 8).join(", ")}${v.operations.length > 8 ? `, and ${v.operations.length - 8} more` : ""}`);
console.log("");
console.log(`  external knowledge used: ${loss.externalKnowledge.operations.length} operation names and ${loss.declaredClasses.names.length} class names, both ${loss.externalKnowledge.status}.`);
console.log(`    ${loss.externalKnowledge.source}`);
console.log(`    ${loss.declaredClasses.source}`);
console.log("");
console.log("  what this instrument cannot measure:");
for (const l of loss.limits) console.log(`    - ${l}`);

// ---- E3-origin: where does a preserved receiver come from? ----
const origins = classifyReceiverOrigins(j);
console.log("");
console.log(`where the ${origins.receivers} receiver arguments in the store come from (origin, not type):`);
console.log("  origin                   occ   in a flow");
for (const [o, v] of Object.entries(origins.byOrigin).filter(([, v]) => v.occurrences > 0).sort((a, b) => b[1].occurrences - a[1].occurrences))
  console.log(`  ${o.padEnd(24)} ${String(v.occurrences).padStart(3)}  ${String(v.inFlow).padStart(9)}`);
console.log(`  traceable origins        ${origins.traceable} of ${origins.receivers}`);
const steps = origins.records.map((r) => r.traceableSteps);
console.log(`  backward steps followed  max ${Math.max(0, ...steps)}, total ${steps.reduce((a, b) => a + b, 0)}`);
console.log("");
console.log("  what this instrument cannot establish:");
for (const l of origins.limits) console.log(`    - ${l}`);

// ---- E3-origin-producer: is the producer of a non-parameter receiver identifiable in IR-7? ----
const allFns = new Map<string, import("../src/ir/index.js").FunctionIR>();
for (const f of walk(CORPUS)) {
  const src = readFileSync(f, "utf8");
  for (const [n, ir] of f.endsWith(".py") ? await encPy(src) : await encTs(src)) allFns.set(`${f}:${n}`, ir);
}
const prod = classifyProducers(allFns);
console.log("");
console.log(`producers of the ${prod.receivers} receiver occurrences in the IR, by group (measurement only, no flow written):`);
console.log("  group           total  identifiable  ambiguous  unavailable   of which invocation / other");
for (const [g, v] of Object.entries(prod.groups))
  console.log(`  ${g.padEnd(14)} ${String(v.total).padStart(5)}  ${String(v.identifiable).padStart(12)}  ${String(v.ambiguous).padStart(9)}  ${String(v.unavailable).padStart(11)}   ${v.invocationProducers} / ${v.otherProducers}`);
console.log("");
console.log("  what a producer is not:");
for (const l of prod.limits) console.log(`    - ${l}`);

console.log("");
console.log("channels still written by nobody:");
for (const rel of ["PARTICIPATES_IN", "FOLLOWS", "OBSERVED_IN", "TESTED_BY", "SATISFIES"])
  console.log(`  ${rel.padEnd(16)} ${live.filter((a) => a.relation === rel).length}`);

// ---- I-0: the counting definitions, and the arithmetic that must follow from them ----
const recon = reconcile(report, loss, origins, prod);
console.log("");
console.log("what each total counts (I-0):");
for (const p of recon.populations) console.log(`  ${String(p.count).padStart(5)}  ${p.name}
         ${p.definition}`);
console.log("");
console.log("the totals reconcile (I-0):");
for (const i of recon.identities) console.log(`  ${i.holds ? "ok      " : "MISMATCH"}  ${i.name}
            ${i.arithmetic}`);
console.log(`  ${recon.reconciles ? "every identity holds" : "AT LEAST ONE IDENTITY FAILS: the report is not trustworthy until it does"}`);

// ---- P0: call occurrences, walked call sites, projected call sites, and stored invocations, site by site ----
const siteFns: { file: string; name: string; fn: import("../src/ir/index.js").FunctionIR }[] = [];
for (const f of walk(CORPUS)) {
  const rel = canonPath(f.startsWith(CORPUS) ? f.slice(CORPUS.length).replace(/^[\\/]+/, "") : f);
  const src = readFileSync(f, "utf8");
  for (const [n, ir] of f.endsWith(".py") ? await encPy(src) : await encTs(src)) siteFns.push({ file: rel, name: n, fn: ir });
}
const sites = reconcileCallSites(j, siteFns);
const st = sites.totals;
console.log("");
console.log("call sites, site by site (P0; the full reconciliation is `node dist/scripts/callsites.js <corpus>`):");
console.log(`  ${String(st.O).padStart(5)}  IR call occurrences, at any depth (O)`);
console.log(`  ${String(st.Opp).padStart(5)}  of those, in positions ingestion's rule reaches (O-pp)`);
console.log(`  ${String(st.S).padStart(5)}  statement-level call sites, the R-1B1 draft 1 probe's rule (S)`);
console.log(`  ${String(st.P).padStart(5)}  projected call sites, ingestion's rule re-implemented (P); plus ${st.pseudoP} pseudo`);
console.log(`  ${String(st.T).padStart(5)}  stored call invocations in the store (T): ${st.Tmatched} in executables paired with the IR, ${st.TstoreOnly} store-only; plus ${st.pseudoT} pseudo`);
console.log(`  rows ${st.rows}: ${Object.entries(st.byClass).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`  mapping of every key with a site or invocation: ${Object.entries(st.keysByMapping).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`  occurrences outside the rule: ${Object.entries(st.unmatchedByReason).sort().map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`);
console.log(`  visibility bound: ${st.opaqueStatements} semantic opaque statements, ${st.valuelessThrows} value-less throws`);
for (const e of sites.executables)
  for (const r of e.rows)
    console.log(`    ${e.file}::${e.name}#${e.ordinal}  ${r.operation}  O-pp ${r.Opp} S ${r.S} P ${r.P} T ${r.T ?? `coarse ${r.Tcoarse}/${r.Pcoarse}`}  [${r.classes.join(", ") || "-"}] ${r.mapping}  ${r.occurrences.map((o) => `${o.path} (${o.carrier}${o.wrapper.length ? ` ${o.wrapper.join(">")}` : ""})`).join("; ")}`);
const a = sites.a1;
console.log(`  A1, steps against HAS_EFFECT: ${a.executablesEqual} of ${a.executablesCompared} executables equal; unmatched steps ${a.unmatchedSteps} in ${a.groups} matching groups (${a.groupsAmbiguous} ambiguous; ${a.groupsWhereUnmatchedEqualsReturned} whose unmatched count equals their returned or thrown call steps; ${a.attributedReturned} returned and ${a.attributedOther} other steps uniquely attributed; ${a.returnedCallSteps} returned or thrown call steps in all), unmatched effects ${a.unmatchedEffects}; write, emit, or opaque kind mismatches ${a.kindMismatches.length}`);
console.log(`  pairs over the expanded step population ${a.stepPairs}; over the legacy HAS_EFFECT population (R-1B0) ${a.effectPairs}`);
if (sites.unpaired.inIrOnly.length || sites.unpaired.inStoreOnly.length) console.log(`  UNPAIRED executables: IR only ${sites.unpaired.inIrOnly.join(", ") || "-"}; store only ${sites.unpaired.inStoreOnly.join(", ") || "-"}`);
for (const l of sites.limits) console.log(`    - ${l}`);
