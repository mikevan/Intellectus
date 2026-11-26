// R-1B1 follow-up runner (addendum 2). Outside the repository.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
process.env.R1B1_MAIN = "0"; process.env.R1B1_MANIFEST = new URL("../manifest.json", import.meta.url).pathname;
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const out = { hashes: {}, deriveIdentity: {}, diagnostics: {}, otherRefusals: {}, conflictingArm: {}, sabotage: {} };
out.hashes.manifest = sha(process.env.R1B1_MANIFEST); out.hashes.followup = sha(new URL("followup.json", import.meta.url).pathname);
out.hashes.r1 = sha(new URL("../checker.mjs", import.meta.url).pathname); out.hashes.r2 = sha(new URL("../checker-r2.mjs", import.meta.url).pathname);
const F = JSON.parse(readFileSync(new URL("followup.json", import.meta.url)));
// derive identity: the chain-derivation code and the helpers it calls, r1 against r2
const fnText = (src, name) => { const m = src.match(new RegExp(`(?:export )?function ${name}\\([\\s\\S]*?\\n}\\n`)); return m ? m[0].replace(/^export /, "") : null; };
const lineText = (src, start) => src.split("\n").find((l) => l.startsWith(start));
const r1 = readFileSync(new URL("../checker.mjs", import.meta.url), "utf8"), r2 = readFileSync(new URL("../checker-r2.mjs", import.meta.url), "utf8");
out.deriveIdentity.derive = fnText(r1, "derive") !== null && fnText(r1, "derive") === fnText(r2, "derive");
// armsOf, stepOfEv and canon are one-line definitions: compared line for line, with only a leading "export " removed
for (const n of ["function armsOf", "const stepOfEv", "function canon"]) { const a = lineText(r1, n), b = (lineText(r2, n) ?? lineText(r2, `export ${n}`))?.replace(/^export /, ""); out.deriveIdentity[n] = a !== undefined && a === b; }
// sabotaged copy: only the conflicting-arm check removed
const sabSrc = r2.replace("for (const [b, a] of all) { if (m.has(b) && m.get(b) !== a) return; m.set(b, a); }", "for (const [b, a] of all) { m.set(b, a); }");
out.sabotage.patched = sabSrc !== r2; writeFileSync(new URL("../checker-r2-sabotage.mjs", import.meta.url), sabSrc);
const C = await import("../checker-r2.mjs"); const S = await import("../checker-r2-sabotage.mjs");
const M = C.MANIFEST; if (C.MANIFEST_SHA256 !== F.baseManifestSha256) throw new Error("manifest hash mismatch");
const roleSets = (refs) => ({ primary: [...new Set(refs.filter((r) => r.role === "primary").map((r) => r.code))].sort(), consequent: refs.filter((r) => r.role === "consequent").map((r) => [r.code, ...(r.cause ?? [])]).sort() });
for (const [cand, H] of M.combinations) {
  const key = `${cand}/${H}`; out.diagnostics[key] = []; out.otherRefusals[key] = [];
  for (const rc of M.refusals) {
    if (!rc.candidates.includes(cand)) continue;
    const ev = C.evaluate(C.mutate(C.byIdExport(rc.base), rc.mutate), cand, H); const got = roleSets(ev.refusalDetail);
    const d = F.diagnosticControls.find((x) => x.rule === rc.rule && x.alt === rc.alt);
    if (d) { const ok = JSON.stringify(got.primary) === JSON.stringify([...d.primary].sort()) && JSON.stringify(got.consequent) === JSON.stringify(d.consequent.map((c) => [...c]).sort());
      out.diagnostics[key].push({ rule: rc.rule, alt: rc.alt, expected: { primary: d.primary, consequent: d.consequent }, got, ok }); }
    else { const ok = JSON.stringify(got.primary) === JSON.stringify([...new Set(rc.expect)].sort()) && got.consequent.length === 0; out.otherRefusals[key].push({ rule: rc.rule, alt: rc.alt, got, ok }); }
  }
  for (const [label, mod] of [["correct", C], ["sabotage", S]]) {
    const res = [];
    for (const fx of F.conflictingArm) {
      const store = mod.buildStore(fx, cand, H); const V = mod.validate(store, cand, H); const cost = { edgeExpansions: 0 };
      const q = (u, v) => [...mod.derive(V, `f:${u}`, `f:${v}`, cost)].sort();
      const canonExp = (sets) => sets.map((s) => JSON.stringify({ arms: [...new Set(s.arms.map(([b, a]) => `f:${b}/${a}`))].sort(), th: [] })).sort();
      const checks = [];
      checks.push({ q: "no refusals", ok: V.refusals.length === 0, got: V.refusals.map((r) => r.code) });
      for (const [u, v, sets] of fx.expect.required) { const got = q(u, v), want = canonExp(sets); checks.push({ q: `${u} < ${v}`, ok: JSON.stringify(got) === JSON.stringify(want), got, want }); }
      for (const [u, v] of fx.expect.forbidden) { const got = q(u, v); checks.push({ q: `not ${u} < ${v}`, ok: got.length === 0, got }); }
      res.push({ fixture: fx.id, pass: checks.every((c) => c.ok), checks });
    }
    (label === "correct" ? out.conflictingArm : out.sabotage)[key] = res;
  }
}
writeFileSync(new URL("followup-results.json", import.meta.url), JSON.stringify(out, null, 1));
console.log("hashes", JSON.stringify(out.hashes)); console.log("derive identity r1 vs r2", JSON.stringify(out.deriveIdentity), "sabotage patched", out.sabotage.patched);
for (const key of Object.keys(out.diagnostics)) {
  const d = out.diagnostics[key], o = out.otherRefusals[key];
  console.log(`${key}: role-annotated diagnostics ${d.filter((x) => x.ok).length}/${d.length}; other refusal controls ${o.filter((x) => x.ok).length}/${o.length}; conflicting-arm correct ${out.conflictingArm[key].map((r) => r.fixture + ":" + r.pass).join(" ")}; sabotage ${out.sabotage[key].map((r) => r.fixture + ":" + r.pass).join(" ")}`);
  for (const x of d.filter((x) => !x.ok)) console.log("   DIAG MISS", x.rule, x.alt, JSON.stringify(x.got));
  for (const x of o.filter((x) => !x.ok)) console.log("   OTHER MISS", x.rule, x.alt, JSON.stringify(x.got));
  for (const r of [...out.conflictingArm[key]]) for (const c of r.checks.filter((c) => !c.ok)) console.log("   CA MISS", r.fixture, JSON.stringify(c));
}
