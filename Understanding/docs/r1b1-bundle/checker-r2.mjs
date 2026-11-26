// R-1B1 scratch checker. Reads the frozen manifest; never writes to it. Outside the repository.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const MPATH = process.env.R1B1_MANIFEST ?? process.argv[2] ?? "manifest.json";
const raw = readFileSync(MPATH); const M = JSON.parse(raw);
const MHASH = createHash("sha256").update(raw).digest("hex");
const STEP_KINDS = new Set(["call", "await", "branch", "exit", "opaque", "write", "emit"]);
const EFFECT = new Set(["call", "write", "emit", "opaque"]);
const clone = (x) => JSON.parse(JSON.stringify(x));
const byId = (id) => [...M.fixtures, ...M.mini].find((f) => f.id === id);

// ---------- store building per candidate ----------
function ref(exe, r) { if (r === null || r === undefined) return null; if (r.startsWith("@")) return r; return r.includes(":") ? r : `${exe}:${r}`; }
export function buildStore(fx, cand, H, opts = {}) {
  const facts = []; const nodes = new Map();
  for (const e of fx.executables) {
    nodes.set(`@${e.id}`, { kind: "executable", exe: e.id });
    for (const [s, k, imp] of e.steps) nodes.set(`${e.id}:${s}`, { kind: "step", exe: e.id, stepKind: k, implicit: imp === "implicit" });
  }
  for (const e of fx.executables) {
    for (const [s, k, imp] of e.steps) facts.push({ rel: "CONTAINS_STEP", s: `@${e.id}`, o: `${e.id}:${s}`, attrs: imp ? { stepKind: k, implicit: true } : { stepKind: k } });
    for (const s of e.entry) facts.push({ rel: "ENTRY_STEP", s: `@${e.id}`, o: ref(e.id, s), attrs: {} });
    for (const [s, b, arm] of e.inArm) facts.push({ rel: "IN_ARM", s: ref(e.id, s), o: ref(e.id, b), attrs: { arm } });
    for (const [b, arm, status] of e.armStatus) facts.push({ rel: "ARM_STATUS", s: ref(e.id, b), o: "literal", attrs: { arm, status } });
    for (const [w, t, cls, lit] of e.awaitTarget) facts.push({ rel: "AWAIT_TARGET", s: ref(e.id, w), o: t === null ? "literal" : ref(e.id, t), attrs: { operandClass: cls }, literal: lit });
    for (const [b, p] of e.predicates) facts.push({ rel: H === "H1" ? "TESTS_PREDICATE" : "HAS_PREDICATE", s: ref(e.id, b), o: "literal", attrs: {}, payload: p });
    for (const [x, y, arm] of e.program) {
      const X = ref(e.id, x), Y = ref(e.id, y);
      const attrs = arm ? { arm } : {};
      if (cand === "A") facts.push({ rel: "FOLLOWS", s: Y, o: X, attrs: { control: "program", within: e.id, ...attrs } });
      else facts.push({ rel: "NEXT_STEP", s: X, o: Y, attrs });
    }
    if (!opts.ablate) for (const [w, c] of e.completion) {
      const W = ref(e.id, w), C = ref(e.id, c);
      if (cand === "A") facts.push({ rel: "FOLLOWS", s: W, o: C, attrs: { control: "completion", within: e.id } });
      else facts.push({ rel: "AWAITS", s: W, o: C, attrs: {} });
    }
  }
  if (fx.legacy) {
    for (const [s, o, control, within] of fx.legacy.followsExecutable) facts.push({ rel: "FOLLOWS", s: `@${s}`, o: `@${o}`, attrs: { control, within } });
    for (const [s, p] of fx.legacy.hasPredicateExecutable) facts.push({ rel: "HAS_PREDICATE", s: `@${s}`, o: "literal", attrs: {}, payload: p, legacy: true });
  }
  return { facts, nodes, language: fx.language };
}
// apply a refusal mutation to a fixture (before building)
export function mutate(fx0, m) {
  const fx = clone(fx0); const e = fx.executables.find((x) => x.id === (m.exe ?? fx.executables[0].id));
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const rm = (list, items) => { for (const it of items ?? []) { const i = list.findIndex((x) => eq(x, it)); if (i < 0) throw new Error(`mutation: ${JSON.stringify(it)} not found`); list.splice(i, 1); } };
  rm(e.program, m.removeProgram); rm(e.completion, m.removeCompletion); rm(e.inArm, m.removeInArm);
  for (const w of m.removeAwaitTarget ?? []) { const i = e.awaitTarget.findIndex((x) => x[0] === w); e.awaitTarget.splice(i, 1); }
  e.program.push(...(m.addProgram ?? [])); e.completion.push(...(m.addCompletion ?? [])); e.inArm.push(...(m.addInArm ?? []));
  e.awaitTarget.push(...(m.addAwaitTarget ?? [])); e.armStatus.push(...(m.addStatus ?? [])); e.predicates.push(...(m.addPredicate ?? []));
  if (m.setEntry) e.entry = m.setEntry;
  for (const s of m.setImplicit ?? []) { const st = e.steps.find((x) => x[0] === s); st[2] = "implicit"; }
  fx._setWithin = m.setWithin; fx._exe = e.id;
  return fx;
}

// ---------- validation and normalisation ----------
function startOf(n) { const k = n.stepKind; return k === "call" ? "invoke" : k === "await" ? "enter" : k === "branch" ? "decide" : k === "exit" ? "exit" : "start"; }
function endOf(n) { const k = n.stepKind; return k === "call" ? "return" : k === "await" ? "continue" : k === "branch" ? "decide" : k === "exit" ? null : "end"; }

export function validate(store, cand, H, setWithin) {
  const { facts, nodes } = store; const refusals = []; const accepted = []; const cost = { factsInspected: 0, attributeReads: 0 };
  const node = (id) => nodes.get(id); const isStep = (id) => node(id)?.kind === "step";
  const refuse = (code, f, why) => refusals.push({ code, rel: f.rel, s: f.s, o: f.o, why, role: "primary" });
  // event graph (adjacency) for cycle checks, built incrementally
  const events = new Map(); const edges = [];
  const addEv = (id) => { if (!events.has(id)) events.set(id, []); };
  const addEdge = (u, v, label) => { addEv(u); addEv(v); const e = { u, v, ...label }; events.get(u).push(e); edges.push(e); };
  const reaches = (from, to) => { const seen = new Set([from]); const st = [from]; while (st.length) { const x = st.pop(); if (x === to) return true; for (const e of events.get(x) ?? []) if (!seen.has(e.v)) { seen.add(e.v); st.push(e.v); } } return false; };
  // internal events and rules per step
  const awaitTargets = new Map(); // await id -> accepted AT facts
  const order = ["CONTAINS_STEP", "ENTRY_STEP", "IN_ARM", "ARM_STATUS", "AWAIT_TARGET", "TESTS_PREDICATE", "HAS_PREDICATE"];
  const sorted = [...facts].sort((a, b) => { const ia = order.indexOf(a.rel), ib = order.indexOf(b.rel); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
  const parent = new Map(); const status = new Map(); const entries = new Map(); const preds = new Map();
  const program = []; const completion = []; const outKey = new Set(); const completionByAwait = new Set();
  for (const f of sorted) {
    cost.factsInspected++;
    if (f.rel === "CONTAINS_STEP") {
      const n = node(f.o); if (f.attrs.implicit && n.stepKind !== "exit") { refuse("R23", f, "implicit on a non-exit"); continue; }
      accepted.push(f); const s = f.o;
      const k = n.stepKind;
      if (k === "call") addEdge(`${s}.invoke`, `${s}.return`, { rule: "R-CALL" });
      else if (k === "await") addEdge(`${s}.enter`, `${s}.continue`, { rule: "R-AWAIT" });
      else if (k === "branch") addEv(`${s}.decide`); else if (k === "exit") addEv(`${s}.exit`);
      else addEdge(`${s}.start`, `${s}.end`, { rule: "R-UNIT" });
      continue;
    }
    if (f.rel === "ENTRY_STEP") {
      const n = node(f.o); const exe = f.s.slice(1);
      if (!n || n.kind !== "step" || n.exe !== exe) { refuse("R18", f, "entry not owned by the executable"); continue; }
      if (entries.has(exe)) { refuse("R18", f, "entry duplicated"); continue; }
      entries.set(exe, f.o); accepted.push(f); continue;
    }
    if (f.rel === "IN_ARM") {
      const s = node(f.s), b = node(f.o);
      if (!b || b.kind !== "step" || b.stepKind !== "branch" || b.exe !== s.exe) { refuse("R14", f, "IN_ARM to a non-branch or across executables"); continue; }
      if (parent.has(f.s)) { refuse("R15", f, "second IN_ARM"); continue; }
      let cur = f.o, guard = 0, cyc = false; while (cur && guard++ <= nodes.size) { if (cur === f.s) { cyc = true; break; } cur = parent.get(cur)?.b; }
      if (cyc) { refuse("R16", f, "IN_ARM cycle"); continue; }
      parent.set(f.s, { b: f.o, arm: f.attrs.arm }); accepted.push(f); continue;
    }
    if (f.rel === "ARM_STATUS") {
      const b = node(f.s); cost.attributeReads++;
      if (!b || b.stepKind !== "branch") { refuse("R17", f, "ARM_STATUS on a non-branch"); continue; }
      const k = `${f.s}|${f.attrs.arm}`; if (status.has(k)) { refuse("R17", f, "duplicate ARM_STATUS"); continue; }
      status.set(k, f.attrs.status); accepted.push(f); continue;
    }
    if (f.rel === "AWAIT_TARGET") {
      const w = node(f.s); const cls = f.attrs.operandClass; cost.attributeReads++;
      if (!w || w.stepKind !== "await") { refuse("R13", f, "AWAIT_TARGET from a non-await"); continue; }
      if (f.o === "literal") { if (cls === "call-result") { refuse("R13", f, "literal with class call-result"); continue; } }
      else { const t = node(f.o); if (!t || t.kind !== "step" || t.stepKind !== "call" || t.exe !== w.exe || cls !== "call-result") { refuse("R13", f, "target not a call in the same executable, or class inconsistent"); continue; } }
      const l = awaitTargets.get(f.s) ?? []; l.push(f); awaitTargets.set(f.s, l); accepted.push(f); continue;
    }
    if (f.rel === "TESTS_PREDICATE" || (f.rel === "HAS_PREDICATE" && isStep(f.s))) {
      const b = node(f.s); if (!b || b.stepKind !== "branch") { refuse("R20", f, "predicate on a non-branch"); continue; }
      if (preds.has(f.s)) { refuse("R21", f, "second predicate"); continue; }
      preds.set(f.s, f.payload); accepted.push(f); continue;
    }
    if (f.rel === "HAS_PREDICATE") { accepted.push(f); continue; } // legacy executable-level: never refused by step rules
    // order relations
    let kind, x, y, arm, within;
    if (f.rel === "FOLLOWS") {
      if (!isStep(f.s) && !isStep(f.o) && node(f.s)?.kind === "executable" && node(f.o)?.kind === "executable") { accepted.push(f); continue; } // legacy
      if (cand !== "A") { refuse("R1", f, "FOLLOWS between steps outside candidate A"); continue; }
      cost.attributeReads++; kind = f.attrs.control === "completion" ? "completion" : "program";
      if (kind === "program") { x = f.o; y = f.s; } else { x = f.s; y = f.o; }
      arm = f.attrs.arm ?? null; within = f.attrs.within;
      const sw = (setWithin ?? []).find(([a, b]) => kind === "program" && x.endsWith(`:${a}`) && y.endsWith(`:${b}`)); if (sw) within = sw[2];
    } else if (f.rel === "NEXT_STEP") { kind = "program"; x = f.s; y = f.o; arm = f.attrs.arm ?? null; }
    else if (f.rel === "AWAITS") { kind = "completion"; x = f.s; y = f.o; }
    if (kind === "program") {
      if (!isStep(x) || !isStep(y)) { refuse("R1", f, "endpoint not a step"); continue; }
      const X = node(x), Y = node(y);
      if (X.exe !== Y.exe || (cand === "A" && within !== X.exe)) { refuse("R2", f, "endpoints in different executables, or within mismatch"); continue; }
      if (x === y) { refuse("R3", f, "self-loop"); continue; }
      if (X.stepKind === "exit") { refuse("R4", f, "leaves an exit"); continue; }
      if (X.stepKind === "branch" && !arm) { refuse("R5", f, "branch without arm"); continue; }
      if (X.stepKind !== "branch" && arm) { refuse("R6", f, "arm on a non-branch"); continue; }
      const k = `${x}|${arm ?? ""}`; if (outKey.has(k)) { refuse("R7", f, "second program fact"); continue; }
      const u = `${x}.${endOf(X)}`, v = `${y}.${startOf(Y)}`;
      if (reaches(v, u)) { refuse("R19", f, "event-graph cycle"); continue; }
      outKey.add(k); addEdge(u, v, { arm: arm ? [x, arm] : null }); program.push({ x, y, arm }); accepted.push(f); continue;
    }
    if (kind === "completion") {
      // x = await, y = call for both candidates' spellings as encoded
      const A = node(x), C = node(y);
      const kinds = [A?.stepKind, C?.stepKind].sort().join(",");
      if (!A || !C || A.kind !== "step" || C.kind !== "step" || kinds !== "await,call") { refuse("R8", f, "not one await and one call"); continue; }
      const w = A.stepKind === "await" ? x : y, c = A.stepKind === "await" ? y : x;
      const ats = awaitTargets.get(w) ?? [];
      if (ats.length === 1) {
        const at = ats[0];
        if (at.o !== "literal" && at.o !== c) { refuse("R9", f, "call differs from AWAIT_TARGET"); continue; }
        if (at.attrs.operandClass !== "call-result") { refuse("R10", f, "operandClass not call-result"); continue; }
      }
      if (completionByAwait.has(w)) { refuse("R11", f, "second completion"); continue; }
      completionByAwait.add(w); completion.push({ w, c }); accepted.push(f); continue;
    }
  }
  // store-level checks
  for (const [id, n] of nodes) if (n.kind === "step" && n.stepKind === "await") { const l = awaitTargets.get(id) ?? []; if (l.length !== 1) { const stored = facts.filter((f) => f.rel === "AWAIT_TARGET" && f.s === id).length; const causes = refusals.filter((r) => r.rel === "AWAIT_TARGET" && r.s === id && r.role === "primary").map((r) => r.code); refusals.push({ code: "R12", rel: "AWAIT_TARGET", s: id, why: `${l.length} accepted AWAIT_TARGET facts`, role: l.length === 0 && stored > 0 && causes.length ? "consequent" : "primary", cause: l.length === 0 && stored > 0 && causes.length ? causes : undefined }); } }
  const exes = new Set([...nodes.values()].filter((n) => n.kind === "executable").map((n) => n.exe));
  const incoming = new Set(program.map((p) => p.y));
  for (const e of exes) { const en = entries.get(e); if (!en) { const stored = facts.filter((f) => f.rel === "ENTRY_STEP" && f.s === `@${e}`).length; const causes = refusals.filter((r) => r.rel === "ENTRY_STEP" && r.s === `@${e}` && r.role === "primary").map((r) => r.code); refusals.push({ code: "R18", rel: "ENTRY_STEP", s: `@${e}`, why: "entry missing", role: stored > 0 && causes.length ? "consequent" : "primary", cause: stored > 0 && causes.length ? causes : undefined }); } else if (incoming.has(en)) refusals.push({ code: "R18", rel: "ENTRY_STEP", s: `@${e}`, why: "entry has an incoming program fact", role: "primary" }); }
  // settlement rules (R-SETTLE), from accepted AWAIT_TARGET and language
  for (const [id, n] of nodes) if (n.kind === "step" && n.stepKind === "await") {
    const l = awaitTargets.get(id) ?? []; const cls = l.length === 1 ? l[0].attrs.operandClass : "unresolved";
    if (store.language === "python") addEdge(`${id}.settle`, `${id}.continue`, { rule: "R-SETTLE", thenable: null });
    else if (cls !== "plain-value") addEdge(`${id}.settle`, `${id}.continue`, { rule: "R-SETTLE", thenable: id });
  }
  return { refusals, accepted, events, program, completion, parent, status, entries, preds, awaitTargets, cost };
}

// ---------- derivation ----------
export function armsOf(parent, s) { const out = []; let cur = s, g = 0; while (parent.has(cur) && g++ < 1000) { const p = parent.get(cur); out.push([p.b, p.arm]); cur = p.b; } return out; }
const stepOfEv = (ev) => ev.slice(0, ev.lastIndexOf("."));
function canon(set) { const arms = [...new Set(set.arms.map((a) => a.join("/")))].sort(); const th = [...new Set(set.thenable)].sort(); return JSON.stringify({ arms, th }); }
export function derive(V, u, v, cost) {
  const out = new Set(); if (!V.events.has(u) || !V.events.has(v)) return out;
  const walk = (at, armsAcc, th, visited) => {
    if (at === v) {
      const all = [...armsAcc, ...armsOf(V.parent, stepOfEv(u)), ...armsOf(V.parent, stepOfEv(v))];
      const m = new Map(); for (const [b, a] of all) { if (m.has(b) && m.get(b) !== a) return; m.set(b, a); }
      out.add(canon({ arms: all, thenable: th })); return;
    }
    for (const e of V.events.get(at) ?? []) {
      cost.edgeExpansions++; if (visited.has(e.v)) continue;
      const add = [...armsOf(V.parent, stepOfEv(e.v))]; if (e.arm) add.push(e.arm);
      walk(e.v, [...armsAcc, ...add], e.thenable ? [...th, e.thenable.split(":").pop()] : th, new Set([...visited, e.v]));
    }
  };
  walk(u, [], [], new Set([u])); return out;
}
const expCanon = (sets, exe) => new Set(sets.map((s) => canon({ arms: s.arms.map(([b, a]) => [`${exe}:${b}`, a]), thenable: s.thenable.map((t) => t) })));
const evId = (exe, e) => { const [s, k] = [e.slice(0, e.lastIndexOf(".")), e.slice(e.lastIndexOf(".") + 1)]; return `${exe}:${s}.${k}`; };
const eventsOfStep = (V, s) => [...V.events.keys()].filter((k) => stepOfEv(k) === s);

// ---------- completeness and classification ----------
export function completeness(V, store, exe) {
  const steps = [...store.nodes].filter(([, n]) => n.kind === "step" && n.exe === exe).map(([id]) => id);
  const fails = [];
  const en = V.entries.get(exe); const incoming = new Set(V.program.map((p) => p.y));
  if (!en || incoming.has(en)) fails.push("entry");
  for (const s of steps) if (store.nodes.get(s).stepKind === "branch") for (const arm of ["then", "else"]) if (!V.status.has(`${s}|${arm}`)) { fails.push("arms"); break; }
  for (const s of steps) { const n = store.nodes.get(s); const outs = V.program.filter((p) => p.x === s);
    const ok = n.stepKind === "exit" ? outs.length === 0 : n.stepKind === "branch" ? ["then", "else"].every((a) => outs.filter((p) => p.arm === a).length === 1) && outs.length === 2 : outs.length === 1;
    if (!ok) { fails.push("edges"); break; } }
  if (en) { const seen = new Set([en]); const st = [en]; while (st.length) { const x = st.pop(); for (const p of V.program) if (p.x === x && !seen.has(p.y)) { seen.add(p.y); st.push(p.y); } } if (steps.some((s) => !seen.has(s))) fails.push("reachability"); }
  return [...new Set(fails)];
}
function stepReach(V, from, to, without) { const seen = new Set([from]); const st = [from]; while (st.length) { const x = st.pop(); if (x === to) return true; for (const p of V.program) if (p.x === x && !(without && p.x === without.b && p.arm === without.arm) && !seen.has(p.y)) { seen.add(p.y); st.push(p.y); } } return false; }
export function classify(V, store, exe, x, y, complete) {
  const ax = armsOf(V.parent, x), ay = armsOf(V.parent, y); const key = (a) => a.join("|");
  for (const [b, p] of ax) for (const [b2, q] of ay) if (b === b2 && p !== q) return "X";
  if (complete) {
    const en = V.entries.get(exe);
    for (const [k, st] of V.status) { if (st !== "always-exits") continue; const [b, arm] = k.split("|"); const other = arm === "then" ? "else" : "then";
      for (const [inS, outS, ai, ao] of [[x, y, ax, ay], [y, x, ay, ax]]) {
        if (ai.some((a) => a[0] === b && a[1] === arm) && !ao.some((a) => a[0] === b && a[1] === arm))
          if (stepReach(V, en, outS) && !stepReach(V, en, outS, { b, arm: other })) return "X"; } }
  }
  const sx = new Set(ax.map(key)), sy = new Set(ay.map(key));
  const nested = [...sx].every((k) => sy.has(k)) || [...sy].every((k) => sx.has(k));
  if (nested) {
    const diff = [...ax.filter((a) => !sy.has(key(a))).map((a) => [a, y]), ...ay.filter((a) => !sx.has(key(a))).map((a) => [a, x])];
    const ok = diff.every(([[b, arm], outside]) => V.status.get(`${b}|${arm}`) === "falls-through" || (complete && stepReach(V, outside, b)));
    if (ok) return "T";
  }
  return "U";
}
// ---------- ARM_STATUS composition (section 2.5) ----------
function blockStatus(exe, block, kinds, computed) {
  const el = (x) => { if (typeof x === "string") { const k = kinds.get(`${exe}:${x}`); return k === "exit" ? "ALWAYS" : k === "opaque" ? "UNKNOWN" : "PASS"; }
    const t = blockStatus(exe, x.then, kinds, computed), e = blockStatus(exe, x.else, kinds, computed);
    computed.set(`${exe}:${x.branch}|then`, t); computed.set(`${exe}:${x.branch}|else`, e);
    return t === "ALWAYS" && e === "ALWAYS" ? "ALWAYS" : t === "PASS" || e === "PASS" ? "PASS" : "UNKNOWN"; };
  const s = block.map(el); return s.includes("ALWAYS") ? "ALWAYS" : s.includes("UNKNOWN") ? "UNKNOWN" : "PASS";
}
const STAT = { ALWAYS: "always-exits", PASS: "falls-through", UNKNOWN: "unknown" };

// ---------- evaluate one fixture under one combination ----------
export function evaluate(fx, cand, H, opts = {}) {
  const store = buildStore(fx, cand, H, opts); const V = validate(store, cand, H, fx._setWithin);
  const res = { fixture: fx.id, refusals: V.refusals.map((r) => r.code), refusalDetail: V.refusals, misses: [], warnings: {}, cost: { ...V.cost, edgeExpansions: 0 }, queries: [] };
  const exes = fx.executables.map((e) => e.id); const main = exes[exes.length - 1];
  const exp = fx.expect ?? {};
  // completeness (reported separately)
  for (const e of exes) { res.warnings[e] = completeness(V, store, e); }
  for (const e of exes) { const want = (exp.completeness ?? {})[e] ?? []; if (JSON.stringify([...want].sort()) !== JSON.stringify([...res.warnings[e]].sort())) res.misses.push(`completeness ${e}: expected [${want}] got [${res.warnings[e]}]`); }
  // ARM_STATUS and implicit exit, computed vs stored
  const kinds = new Map([...store.nodes].filter(([, n]) => n.kind === "step").map(([id, n]) => [id, n.stepKind]));
  for (const e of fx.executables) { const computed = new Map(); const body = blockStatus(e.id, e.body, kinds, computed);
    for (const [k, v] of computed) { const stored = V.status.get(k); if (stored !== STAT[v]) res.misses.push(`ARM_STATUS ${k}: stored ${stored}, computed ${STAT[v]}`); }
    const hasImplicit = e.steps.some((s) => s[2] === "implicit"); if (hasImplicit !== (body !== "ALWAYS")) res.misses.push(`implicit exit for ${e.id}: present ${hasImplicit}, body ${body}`); }
  // pair population (A1): every effect pair in each executable must be listed
  for (const e of fx.executables) { const eff = e.steps.filter((s) => EFFECT.has(s[1])).map((s) => s[0]); const listed = new Set((exp.pairs ?? []).map((p) => [p[0], p[1]].sort().join("|")));
    for (let i = 0; i < eff.length; i++) for (let j = i + 1; j < eff.length; j++) if (exes.length === 1 || e.id === main) { const k = [eff[i], eff[j]].sort().join("|"); if (!listed.has(k)) res.misses.push(`pair ${k} not covered by expected answers`); } }
  const complete = res.warnings[main].length === 0;
  const q = (u, v) => derive(V, u, v, res.cost);
  for (const [a, b, cls, ord] of exp.pairs ?? []) {
    const A = `${main}:${a}`, B = `${main}:${b}`; const got = classify(V, store, main, A, B, complete);
    res.queries.push({ q: `class ${a},${b}`, ok: got === cls }); if (got !== cls) res.misses.push(`class (${a},${b}): expected ${cls}, got ${got}`);
    const evA = eventsOfStep(V, A), evB = eventsOfStep(V, B);
    const anyPrec = (xs, ys) => xs.some((u) => ys.some((v) => q(u, v).size > 0));
    if (ord === null) { const bad = anyPrec(evA, evB) || anyPrec(evB, evA); res.queries.push({ q: `no order ${a},${b}`, ok: !bad }); if (bad) res.misses.push(`(${a},${b}): order derived where none expected`); }
    else { const got2 = q(evId(main, ord.before), evId(main, ord.after)); const want = expCanon(ord.conds, main);
      const ok = got2.size === want.size && [...want].every((x) => got2.has(x)); res.queries.push({ q: `${ord.before} < ${ord.after}`, ok });
      if (!ok) res.misses.push(`${ord.before} < ${ord.after}: expected ${[...want]} got ${[...got2]}`);
      const [first, second] = ord.before.startsWith(`${a}.`) ? [A, B] : [B, A]; const rev = anyPrec(eventsOfStep(V, second), eventsOfStep(V, first));
      res.queries.push({ q: `no reverse ${a},${b}`, ok: !rev }); if (rev) res.misses.push(`(${a},${b}): reverse precedence derived`); }
  }
  for (const [u, v, sets] of exp.required ?? []) { const got = q(evId(main, u), evId(main, v)); const want = expCanon(sets, main); const ok = got.size === want.size && [...want].every((x) => got.has(x));
    res.queries.push({ q: `${u} < ${v}`, ok }); if (!ok) res.misses.push(`required ${u} < ${v}: expected ${[...want]} got ${[...got]}`); }
  for (const [u, v] of exp.forbidden ?? []) { const got = q(evId(main, u), evId(main, v)); const ok = got.size === 0; res.queries.push({ q: `not ${u} < ${v}`, ok }); if (!ok) res.misses.push(`forbidden ${u} < ${v} was derived`); }
  for (const ev of exp.noEvent ?? []) { const ok = !V.events.has(evId(main, ev)); res.queries.push({ q: `no event ${ev}`, ok }); if (!ok) res.misses.push(`event ${ev} exists`); }
  // predicate payloads vs oracle (outside the order checker; R22 deferred)
  for (const e of fx.executables) for (const [b, p] of e.predicates) { const got = V.preds.get(`${e.id}:${b}`); if (got !== p) res.misses.push(`predicate oracle ${b}: ${got} vs ${p}`); }
  res.counts = countFacts(V.accepted); res.queryAnswers = res.queries.map((x) => `${x.q}=${x.ok}`);
  return res;
}
export function countFacts(facts) { const byRel = {}; let attrs = 0; for (const f of facts) { byRel[f.rel] = (byRel[f.rel] ?? 0) + 1; attrs += Object.keys(f.attrs ?? {}).length; } return { total: facts.length, byRel, attributeValues: attrs }; }

// ---------- K9b engine control ----------
function engine(ctrl) {
  const compose = (facts, blind) => { const out = [...facts]; let changed = true; while (changed) { changed = false;
    for (const f of out) for (const g of out) if (f.after === g.before) { const arms = [...f.conds.arms, ...g.conds.arms]; const m = new Map(); let ok = true;
      for (const [b, a] of arms) { if (m.has(b) && m.get(b) !== a) ok = false; m.set(b, a); }
      if (!ok && !blind) continue; if (!out.some((h) => h.before === f.before && h.after === g.after)) { out.push({ before: f.before, after: g.after, conds: { arms, thenable: [] } }); changed = true; } } }
    return out; };
  const good = compose(ctrl.facts, false), blind = compose(ctrl.facts, true);
  const has = (s, [a, b]) => s.some((f) => f.before === a && f.after === b);
  return { correctDerivesForbidden: ctrl.forbidden.some((p) => has(good, p)), blindDerives: ctrl.conditionBlindMustDerive.every((p) => has(blind, p)) };
}

export const MANIFEST = M, MANIFEST_SHA256 = MHASH, byIdExport = byId;
if (process.env.R1B1_MAIN !== "0") {
// ---------- run ----------
const results = { manifestSha256: MHASH, combinations: {} };
for (const [cand, H] of M.combinations) {
  const key = `${cand}/${H}`; const C = { fixtures: [], refusalControls: [], ablation: [], misses: [], cost: { factsInspected: 0, attributeReads: 0, edgeExpansions: 0 }, counts: { total: 0, attributeValues: 0 } };
  for (const fx of M.fixtures) {
    const r = evaluate(fx, cand, H); C.fixtures.push({ id: fx.id, misses: r.misses, refusals: r.refusals, warnings: r.warnings, queries: r.queries.length, queriesOk: r.queries.filter((x) => x.ok).length, counts: r.counts, cost: r.cost });
    if (r.refusals.length) C.misses.push(`${fx.id}: unexpected refusals ${r.refusals}`);
    for (const m of r.misses) C.misses.push(`${fx.id}: ${m}`);
    for (const k of ["factsInspected", "attributeReads", "edgeExpansions"]) C.cost[k] += r.cost[k];
    C.counts.total += r.counts.total; C.counts.attributeValues += r.counts.attributeValues;
    if (M.ablation.includes(fx.id)) { const a = evaluate(fx, cand, H, { ablate: true });
      const lost = r.queryAnswers.filter((x, i) => x !== a.queryAnswers[i]);
      C.ablation.push({ id: fx.id, lostOrChanged: lost, refusals: a.refusals, assertionsWith: r.counts.total, assertionsWithout: a.counts.total }); }
  }
  // K4 delta
  const f4a = C.fixtures.find((f) => f.id === "K4a").counts.byRel, f4b = C.fixtures.find((f) => f.id === "K4b").counts.byRel;
  C.k4delta = { a: f4a, b: f4b };
  for (const rc of M.refusals) {
    if (!rc.candidates.includes(cand)) continue;
    const base = byId(rc.base); let got;
    try { got = evaluate(mutate(base, rc.mutate), cand, H).refusals; } catch (e) { got = [`ERROR ${e.message}`]; }
    const ok = JSON.stringify([...new Set(got)].sort()) === JSON.stringify([...new Set(rc.expect)].sort()); // section 15.1: an exact SET of codes
    C.refusalControls.push({ rule: rc.rule, alt: rc.alt, expected: rc.expect, got, ok });
    if (!ok) C.misses.push(`refusal ${rc.rule} (${rc.alt}): expected ${rc.expect} got ${got}`);
  }
  C.engine = M.engine.map((e) => ({ id: e.id, ...engine(e) }));
  for (const e of C.engine) if (e.correctDerivesForbidden || !e.blindDerives) C.misses.push(`${e.id}: correct engine derived forbidden=${e.correctDerivesForbidden}, blind derived=${e.blindDerives}`);
  results.combinations[key] = C;
}
writeFileSync("results.json", JSON.stringify(results, null, 1));
for (const [k, C] of Object.entries(results.combinations)) {
  const q = C.fixtures.reduce((n, f) => n + f.queries, 0), qok = C.fixtures.reduce((n, f) => n + f.queriesOk, 0);
  const rc = C.refusalControls.length, rok = C.refusalControls.filter((r) => r.ok).length;
  console.log(`${k}: queries ${qok}/${q}, refusal controls ${rok}/${rc}, misses ${C.misses.length}, assertions ${C.counts.total} (attribute values ${C.counts.attributeValues}), cost facts ${C.cost.factsInspected} attrReads ${C.cost.attributeReads} edges ${C.cost.edgeExpansions}, ablation lost ${C.ablation.reduce((n, a) => n + a.lostOrChanged.length, 0)}`);
  for (const m of C.misses.slice(0, 40)) console.log("   MISS " + m);
}
console.log("manifest sha256", MHASH);

}
