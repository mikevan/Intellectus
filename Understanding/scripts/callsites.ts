// P0: the complete site-level reconciliation for one corpus, as JSON on stdout (docs/p0-protocol-frozen.md).
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Journal } from "../src/journal/index.js";
import { ingest } from "../src/ingest/index.js";
import { canonPath, type FunctionIR } from "../src/ir/index.js";
import { reconcileCallSites } from "../src/query/callsites.js";
import { encodeFunctions as encPy } from "../src/adapters/python/index.js";
import { encodeFunctions as encTs } from "../src/adapters/typescript/index.js";

const CORPUS = process.argv[2];
if (!CORPUS) throw new Error("usage: callsites <corpus src directory>");
function walk(d: string, o: string[] = []): string[] {
  for (const e of readdirSync(d).sort()) { const p = join(d, e); statSync(p).isDirectory() ? walk(p, o) : ((p.endsWith(".py") || (p.endsWith(".ts") && !p.endsWith(".d.ts"))) && o.push(p)); }
  return o;
}
const files = walk(CORPUS);
const j = new Journal();
j.begin("P0 call sites");
await ingest(j, files, CORPUS);
j.commit();
const fns: { file: string; name: string; fn: FunctionIR }[] = [];
for (const f of files) {
  const rel = canonPath(f.startsWith(CORPUS) ? f.slice(CORPUS.length).replace(/^[\\/]+/, "") : f);
  const src = readFileSync(f, "utf8");
  for (const [n, ir] of f.endsWith(".py") ? await encPy(src) : await encTs(src)) fns.push({ file: rel, name: n, fn: ir });
}
process.stdout.write(JSON.stringify(reconcileCallSites(j, fns), null, 1) + "\n");
