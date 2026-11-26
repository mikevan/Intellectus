import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
const D = process.env.HOME + "/und-check/dist/src";
const { canonicalise } = await import(D + "/ir/index.js");
const ts = await import(D + "/adapters/typescript/index.js");
const py = await import(D + "/adapters/python/index.js");
const walk = (d) => readdirSync(d).sort().flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : (p.endsWith(".py") || (p.endsWith(".ts") && !p.endsWith(".d.ts"))) ? [p] : []; });
const unwrap = (e) => { let d = 0; while (e && e.kind === "awaited") { e = e.of; d++; } return { inner: e, depth: d }; };
for (const c of process.argv.slice(2)) {
  const root = process.env.HOME + "/und-check/corpora/" + c + "/src";
  const t = { noop: 0, dead: 0, functions: 0, call: 0, await: 0, branch: 0, opaque: 0, write_emit: 0, exits: 0 }; let target = null;
  for (const file of walk(root)) {
    const enc = file.endsWith(".py") ? py : ts;
    for (const [name, fn0] of await enc.encodeFunctions(readFileSync(file, "utf8"))) {
      t.functions++; const fn = canonicalise(fn0); const local = { dead: 0, call: 0, await: 0, branch: 0, opaque: 0, write_emit: 0, exits: 0 };
      const keys = new Map(); const kk = (o,a,r) => { const k = JSON.stringify([o,a,r??null]); keys.set(k,(keys.get(k)||0)+1); };
      const expr = (e) => { const { inner, depth } = unwrap(e); local.await += depth; if (inner && inner.kind === "call") { local.call++; kk(inner.operation, inner.args, inner.receiver); if (!inner.operation) local.noop = (local.noop||0)+1; } };
      const exits = (b) => { const l = b[b.length-1]; if (!l) return false; if (l.kind==="return"||l.kind==="throw") return true; if (l.kind==="branch") return exits(l.then)&&exits(l.else); return false; };
      const go = (stmts) => { let i = 0; for (const s of stmts) { i++;
        if (s.kind === "branch") { local.branch++; go(s.then); go(s.else); if (exits(s.then) && exits(s.else)) { local.dead += stmts.length - i; return; } }
        else if (s.kind === "return" || s.kind === "throw") { local.exits++; if (s.value?.kind === "computed") expr(s.value.expr); local.dead += stmts.length - i; return; }
        else if (s.kind === "bind" || s.kind === "evaluate") expr(s.expr);
        else if (s.kind === "effect") { if (s.effect.kind === "CALL_EXTERNAL") { local.call++; kk(s.effect.operation, s.effect.args, s.effect.receiver); if (!s.effect.operation) local.noop=(local.noop||0)+1; } else if (s.effect.kind === "WRITE" || s.effect.kind === "EMIT") local.write_emit++; }
        else if (s.kind === "opaque" && s.statementClass === "SEMANTIC") local.opaque++;
      } };
      go(fn.body); local.dupes = 0; for (const n of keys.values()) local.dupes += n - 1; for (const k in local) t[k] = (t[k]||0) + local[k];
      if (name === "loadLanguage") target = { file: file.split("/src/")[1], ...local };
    }
  }
  console.log(c, JSON.stringify(t), target ? "loadLanguage " + JSON.stringify(target) : "");
}
