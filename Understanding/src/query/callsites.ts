// P0: call occurrences in the IR, statement-level call sites, projected call sites, and stored call invocations,
// reconciled site by site (docs/p0-protocol-frozen.md).
//
// R-1B1 draft 1 counted 120 call sites in radon's walk against 121 call invocations in the store. This module names
// the cause of every difference at the level of one key in one executable, and never adjusts a count to make two
// agree. It is an instrument: it reads the IR and the store and changes neither.
//
// Independence. The projected population re-implements ingestion's grouping rule here, from the protocol's text, and
// shares no code with src/ingest/index.ts, so the instrument can disagree with ingestion. The occurrence walk is a
// second, separate derivation from the IR, matched to the projection by key.
import type { Journal } from "../journal/index.js";
import { canonicalise, effectProjection, normalise, type Expr, type FunctionIR, type Operand, type Predicate, type Stmt } from "../ir/index.js";

export type Carrier = "effect" | "bind" | "evaluate" | "return" | "throw" | "argument" | "receiver" | "predicate" | "expression";
export type UnmatchedReason = "nested-argument" | "receiver" | "predicate" | "expression-operand" | "behaviour" | "unreachable" | "no-operation";
export type RowClass = "wrapper" | "grouping-merge" | "grouping-duplication" | "ingestion-discrepancy" | "other";
export type Mapping = "unique" | "multiplicity" | "ambiguous" | "coarse-ambiguous";

/** One call expression or CALL_EXTERNAL effect statement in the canonicalised IR. */
export interface Occurrence {
  path: string;                 // structural IR location; source lines are not in the IR by design
  carrier: Carrier;
  wrapper: string[];            // computed, negated, read, awaited between the carrier and the call, outermost first
  operation: string | null;
  args: Operand[];
  receiver?: Operand;
  under: Predicate | null;      // the projection's live condition at this statement; null when unreachable or unconditional
  reachable: boolean;
  inBehaviour: boolean;
  key: string | null;           // fine key, for reachable occurrences with an operation
  coarse: string | null;
  statementLevel: boolean;      // S: the draft 1 probe's rule
  inRule: boolean;              // O-pp: a position ingestion's rule reaches
  returned: boolean;            // carried by a return or throw value
  reason?: UnmatchedReason;     // set when not inRule
}

/** One projected site key, with the outcomes that fell in each group of the effect/bind rule. */
export interface ProjectedKey {
  key: string; coarse: string; operation: string; count: number; pseudo: boolean;
  effects: string[]; binds: string[]; kept: "effects" | "binds"; dropped: number;
}

export interface Step { kind: "call" | "write" | "emit" | "opaque"; match: string; returned: boolean; path: string }

export interface ExecutableReport {
  file: string; name: string; ordinal: number;
  counts: { O: number; Opp: number; S: number; P: number; T: number; pseudoP: number; pseudoT: number };
  visibility: { valuelessThrows: number; opaqueStatements: number };
  rows: Row[];
  mappings: Mapping[];          // one per key with at least one site or invocation
  keysByMapping: Record<Mapping, number>;
  unmatched: { path: string; operation: string | null; carrier: Carrier; wrapper: string[]; reason: UnmatchedReason }[];
  a1: A1Report;
}

export interface Row {
  key: string; coarse: string; operation: string | null;
  Opp: number; S: number; P: number; T: number | null; Tcoarse: number; Pcoarse: number;
  classes: RowClass[]; mapping: Mapping;
  occurrences: { path: string; carrier: Carrier; wrapper: string[]; reachable: boolean; statementLevel: boolean }[];
  contributing: { effects: string[]; binds: string[]; kept: string; dropped: number } | null;
}

export interface A1Report {
  callSteps: number; callEffects: number; writeSteps: number; writeEffects: number; emitSteps: number; emitEffects: number;
  opaqueSteps: number; opaqueEffects: number;
  /** Counts only. Steps and effects are compared per matching group (kind, operation, argument count, conditional),
   * because those fields can match several distinct occurrences; traversal order never decides which one is unmatched. */
  unmatchedSteps: number;
  unmatchedEffects: number;
  returnedCallSteps: number;
  /** Every group whose counts differ, with all candidate step paths. */
  groups: A1Group[];
  /** Unmatched steps named individually, only from groups where every step is unmatched. */
  attributed: { path: string; returned: boolean; match: string }[];
}

export interface A1Group {
  match: string; steps: number; effects: number; unmatchedSteps: number; unmatchedEffects: number;
  returnedSteps: number; candidates: { path: string; returned: boolean }[];
  attribution: "unique" | "ambiguous";
}

export interface CallSiteReport {
  executables: ExecutableReport[];
  totals: { O: number; Opp: number; S: number; P: number; T: number; Tmatched: number; TstoreOnly: number; pseudoP: number; pseudoT: number; rows: number; byClass: Record<RowClass, number>; byMapping: Record<Mapping, number>; keysByMapping: Record<Mapping, number>; unmatchedByReason: Record<string, number>; valuelessThrows: number; opaqueStatements: number };
  a1: { executablesCompared: number; executablesEqual: number; returnedCallSteps: number; stepPairs: number; effectPairs: number; unmatchedSteps: number; unmatchedEffects: number; groups: number; groupsAmbiguous: number; attributedReturned: number; attributedOther: number; groupsWhereUnmatchedEqualsReturned: number; kindMismatches: string[] };
  unpaired: { inIrOnly: string[]; inStoreOnly: string[] };
  limits: string[];
}

// ---- keys ----

const fineKey = (operation: string, args: Operand[], under: Predicate | null, receiver: Operand | undefined): string =>
  JSON.stringify([operation, args, under]) + JSON.stringify(receiver ?? null);
const coarseKey = (operation: string, argKinds: string[], receiverKind: string | null): string =>
  JSON.stringify([operation, argKinds, receiverKind]);
const coarseOf = (operation: string, args: Operand[], receiver: Operand | undefined): string =>
  coarseKey(operation, args.map((a) => a.kind), receiver?.kind ?? null);

function exits(stmts: Stmt[]): boolean {
  const last = stmts[stmts.length - 1];
  if (!last) return false;
  if (last.kind === "return" || last.kind === "throw") return true;
  if (last.kind === "branch") return exits(last.then) && exits(last.else);
  return false;
}
const condition = (path: Predicate[]): Predicate | null => (path.length ? normalise({ kind: "and", operands: path }) : null);
const strip = (e: Expr): { inner: Expr; levels: number } => { let inner = e, levels = 0; while (inner.kind === "awaited") { inner = inner.of; levels++; } return { inner, levels }; };

// ---- O, O-pp, S, and the statement-level steps, from one walk of the canonicalised IR ----

export interface Walked { occurrences: Occurrence[]; steps: Step[]; valuelessThrows: number; opaqueStatements: number }

export function walkOccurrences(input: FunctionIR): Walked {
  const fn = canonicalise(input);
  const occurrences: Occurrence[] = [];
  const steps: Step[] = [];
  let valuelessThrows = 0, opaqueStatements = 0;
  interface Ctx { carrier: Carrier; under: Predicate | null; reachable: boolean; top: boolean; behaviour: boolean; returned: boolean }

  const record = (call: { operation?: string; args: Operand[]; receiver?: Operand }, path: string, wrapper: string[], c: Ctx): void => {
    const operation = call.operation ?? null;
    const awaitedOnly = wrapper.every((w) => w === "awaited");
    const valueChainS = wrapper[0] === "computed" && wrapper.slice(1).every((w) => w === "awaited");
    const valueChainRule = /^((negated|read),)*computed(,awaited)*$/.test(wrapper.join(","));
    const statementCarrier = c.carrier === "effect" || c.carrier === "bind" || c.carrier === "evaluate";
    const valueCarrier = c.carrier === "return" || c.carrier === "throw";
    const positioned = c.reachable && c.top && !c.behaviour;
    const statementLevel = positioned && ((statementCarrier && awaitedOnly) || (valueCarrier && valueChainS));
    const inRule = positioned && operation !== null && ((statementCarrier && awaitedOnly) || (valueCarrier && valueChainRule));
    let reason: UnmatchedReason | undefined;
    if (!inRule) {
      if (c.behaviour) reason = "behaviour";
      else if (!c.reachable) reason = "unreachable";
      else if (operation === null) reason = "no-operation";
      else if (c.carrier === "argument") reason = "nested-argument";
      else if (c.carrier === "receiver") reason = "receiver";
      else if (c.carrier === "predicate") reason = "predicate";
      else reason = "expression-operand";
    }
    const keyed = c.reachable && !c.behaviour && operation !== null;
    occurrences.push({ path, carrier: c.carrier, wrapper, operation, args: call.args, receiver: call.receiver, under: c.under, reachable: c.reachable, inBehaviour: c.behaviour,
      key: keyed ? fineKey(operation, call.args, c.under, call.receiver) : null, coarse: operation !== null ? coarseOf(operation, call.args, call.receiver) : null,
      statementLevel, inRule, returned: c.returned, reason });
    if (statementLevel)
      steps.push({ kind: "call", match: `call|${operation ?? ""}|${call.args.length}|${c.under !== null}`, returned: c.returned, path });
    // what a call contains is never at statement level
    const nested: Ctx = { ...c, top: false };
    call.args.forEach((a, i) => operand(a, `${path}.args[${i}]`, [], { ...nested, carrier: "argument" }));
    if (call.receiver) operand(call.receiver, `${path}.receiver`, [], { ...nested, carrier: "receiver" });
  };

  const expr = (e: Expr, path: string, wrapper: string[], c: Ctx): void => {
    const inner: Ctx = { ...c, top: false, carrier: c.carrier === "argument" || c.carrier === "receiver" || c.carrier === "predicate" ? c.carrier : "expression" };
    switch (e.kind) {
      case "awaited": expr(e.of, `${path}.of`, [...wrapper, "awaited"], c); break;
      case "call": record(e, path, wrapper, c); break;
      case "operand": operand(e.operand, `${path}.operand`, [], inner); break;
      case "member": operand(e.object, `${path}.object`, [], inner); break;
      case "index": operand(e.object, `${path}.object`, [], inner); operand(e.at, `${path}.at`, [], inner); break;
      case "arith": operand(e.left, `${path}.left`, [], inner); operand(e.right, `${path}.right`, [], inner); break;
      case "test": predicate(e.predicate, `${path}.predicate`, inner); break;
      case "choose": predicate(e.predicate, `${path}.predicate`, inner); operand(e.whenTrue, `${path}.whenTrue`, [], inner); operand(e.whenFalse, `${path}.whenFalse`, [], inner); break;
      default: break;
    }
  };

  const operand = (o: Operand, path: string, wrapper: string[], c: Ctx): void => {
    switch (o.kind) {
      case "computed": expr(o.expr, `${path}.expr`, [...wrapper, "computed"], c); break;
      case "negated": operand(o.operand, `${path}.operand`, [...wrapper, "negated"], c); break;
      case "read": operand(o.object, `${path}.object`, [...wrapper, "read"], c); break;
      case "behaviour": body(o.body, `${path}.body`, [], c.reachable, true); break;
      default: break;
    }
  };

  const predicate = (p: Predicate, path: string, c: Ctx): void => {
    const pc: Ctx = { ...c, top: false, carrier: "predicate" };
    switch (p.kind) {
      case "compare": operand(p.left, `${path}.left`, [], pc); operand(p.right, `${path}.right`, [], pc); break;
      case "absent": case "truthy": operand(p.operand, `${path}.operand`, [], pc); break;
      case "and": case "or": p.operands.forEach((q, i) => predicate(q, `${path}.operands[${i}]`, c)); break;
      case "not": predicate(p.operand, `${path}.operand`, c); break;
      default: break;
    }
  };

  const body = (stmts: Stmt[], base: string, live: Predicate[], reachable: boolean, behaviour: boolean): void => {
    let cur = live; let dead = !reachable;
    stmts.forEach((s, i) => {
      const path = `${base}[${i}]`;
      const r = !dead;
      const under = r && !behaviour ? condition(cur) : null;
      const c: Ctx = { carrier: "expression", under, reachable: r, top: true, behaviour, returned: false };
      switch (s.kind) {
        case "branch": {
          predicate(s.predicate, `${path}.predicate`, c);
          const t = [...cur, s.predicate];
          const e = [...cur, { kind: "not", operand: s.predicate } as Predicate];
          body(s.then, `${path}.then`, t, r, behaviour);
          body(s.else, `${path}.else`, e, r, behaviour);
          if (exits(s.then) && !exits(s.else)) cur = e;
          else if (exits(s.else) && !exits(s.then)) cur = t;
          else if (exits(s.then) && exits(s.else)) dead = true;
          break;
        }
        case "return": case "throw":
          if (s.value) operand(s.value, `${path}.value`, [], { ...c, carrier: s.kind, returned: true });
          else if (s.kind === "throw" && !behaviour) valuelessThrows++;
          dead = true;
          break;
        case "bind": case "evaluate":
          expr(s.expr, `${path}.expr`, [], { ...c, carrier: s.kind });
          break;
        case "effect":
          if (s.effect.kind === "CALL_EXTERNAL") record(s.effect, `${path}.effect`, [], { ...c, carrier: "effect" });
          else {
            s.effect.args.forEach((a, k) => operand(a, `${path}.effect.args[${k}]`, [], { ...c, carrier: "argument", top: false }));
            if (s.effect.receiver) operand(s.effect.receiver, `${path}.effect.receiver`, [], { ...c, carrier: "receiver", top: false });
            if (r && !behaviour && (s.effect.kind === "WRITE" || s.effect.kind === "EMIT"))
              steps.push({ kind: s.effect.kind === "WRITE" ? "write" : "emit", match: `${s.effect.kind === "WRITE" ? "write" : "emit"}|${s.effect.operation ?? ""}|${s.effect.args.length}|${under !== null}`, returned: false, path });
          }
          break;
        case "opaque":
          if (s.statementClass === "SEMANTIC" && !behaviour) {
            opaqueStatements++;
            if (r) steps.push({ kind: "opaque", match: `opaque|opaque:${s.category}|0|${under !== null}`, returned: false, path });
          }
          break;
      }
    });
  };

  body(fn.body, "body", [], true, false);
  return { occurrences, steps, valuelessThrows, opaqueStatements };
}

// ---- P: ingestion's grouping rule, re-implemented from the protocol's text ----

export function projectedSites(fn: FunctionIR): ProjectedKey[] {
  const groups = new Map<string, { operation: string; coarse: string; effects: string[]; binds: string[] }>();
  const put = (side: "effects" | "binds", operation: string | undefined, args: Operand[], under: Predicate | null, receiver: Operand | undefined, label: string): void => {
    if (operation === undefined) return;
    const k = fineKey(operation, args, under, receiver);
    const g = groups.get(k) ?? { operation, coarse: coarseOf(operation, args, receiver), effects: [], binds: [] };
    g[side].push(label);
    groups.set(k, g);
  };
  const fromValue = (o: Operand | undefined, under: Predicate | null, label: string, chain: string[]): void => {
    if (!o) return;
    if (o.kind === "computed") { const { inner, levels } = strip(o.expr); if (inner.kind === "call") put("binds", inner.operation, inner.args, under, inner.receiver, `${label}(${[...chain, "computed", ...Array(levels).fill("awaited")].join(">")})`); }
    else if (o.kind === "negated") fromValue(o.operand, under, label, [...chain, "negated"]);
    else if (o.kind === "read") fromValue(o.object, under, label, [...chain, "read"]);
  };
  for (const o of effectProjection(fn)) {
    const w = o.what;
    if (w.kind === "CALL_EXTERNAL") put("effects", w.operation, w.args, o.under, w.receiver, "CALL_EXTERNAL");
    else if (w.kind === "bind") { const { inner } = strip(w.expr); if (inner.kind === "call") put("binds", inner.operation, inner.args, o.under, inner.receiver, "bind"); }
    else if (w.kind === "return" || w.kind === "throw") fromValue(w.value, o.under, w.kind, []);
  }
  return [...groups].map(([key, g]) => {
    const kept = g.effects.length >= g.binds.length ? "effects" : "binds";
    return { key, coarse: g.coarse, operation: g.operation, count: Math.max(g.effects.length, g.binds.length), pseudo: g.operation.startsWith("opaque:"),
      effects: g.effects, binds: g.binds, kept, dropped: kept === "effects" ? g.binds.length : g.effects.length } as ProjectedKey;
  });
}

// ---- classification, pure so the K controls can drive it directly ----

export function classify(c: { Opp: number; S: number; P: number; T: number | null; wrapperOnlyInRule?: number }): RowClass[] {
  const out: RowClass[] = [];
  const w = c.wrapperOnlyInRule ?? 0;
  if (w > 0 && c.S + w === c.Opp) out.push("wrapper");
  else if (c.S !== c.Opp) out.push("other");
  if (c.P < c.Opp) out.push("grouping-merge");
  if (c.P > c.Opp) out.push("grouping-duplication");
  if (c.T !== null && c.T !== c.P) out.push("ingestion-discrepancy");
  return out;
}

function mappingOf(Opp: number, P: number, T: number | null): Mapping {
  if (T === null) return "coarse-ambiguous";
  if (Opp === P && P === T) return Opp === 1 ? "unique" : "multiplicity";
  return "ambiguous";
}

// ---- T: the store, read back ----

interface StoredExecutable { file: string; name: string; ordinal: number; invocations: { operation: string; coarse: string }[]; effects: string[] }

function readStore(j: Journal): Map<string, StoredExecutable> {
  const live = [...j.liveAssertions()].sort((a, b) => a.id - b.id);
  const lit = (o: unknown): { type?: string; value?: unknown } => (o && typeof o === "object" ? (o as { type?: string; value?: unknown }) : {});
  const ident = new Map<string, { file: string; name: string; id: number }>();
  for (const a of live)
    if (a.relation === "RENDERS_AS" && lit(a.object).type === "identifier")
      ident.set(a.subject, { file: String((a.evidence as { file?: string } | undefined)?.file ?? ""), name: String(lit(a.object).value), id: a.id });
  const ordinal = new Map<string, number>();
  const seen = new Map<string, number>();
  for (const [subject, v] of [...ident].sort((x, y) => x[1].id - y[1].id)) {
    const k = `${v.file}::${v.name}`; const n = seen.get(k) ?? 0; seen.set(k, n + 1); ordinal.set(subject, n);
  }
  const args = new Map<string, { position: number; from: string; role?: string }[]>();
  for (const a of live)
    if (a.relation === "HAS_ARGUMENT") {
      const at = (a.attributes ?? {}) as { position?: number; from?: string; role?: string };
      const l = args.get(a.subject) ?? []; l.push({ position: Number(at.position), from: String(at.from), role: at.role }); args.set(a.subject, l);
    }
  const out = new Map<string, StoredExecutable>();
  const get = (subject: string): StoredExecutable => {
    const id = ident.get(subject)!;
    const k = `${id.file}::${id.name}::${ordinal.get(subject)}`;
    const e = out.get(k) ?? { file: id.file, name: id.name, ordinal: ordinal.get(subject)!, invocations: [], effects: [] };
    out.set(k, e); return e;
  };
  // every declared executable, including those with no invocation and no effect, so pairing is judged on all of them
  for (const subject of ident.keys()) get(subject);
  for (const a of live) {
    if (!ident.has(a.subject)) continue;
    if (a.relation === "HAS_INVOCATION") {
      const operation = String((a.evidence as { operation?: string } | undefined)?.operation ?? "");
      const as = args.get(String(a.object)) ?? [];
      const positional = as.filter((x) => x.role !== "receiver").sort((x, y) => x.position - y.position).map((x) => x.from);
      const receiver = as.find((x) => x.role === "receiver")?.from ?? null;
      get(a.subject).invocations.push({ operation, coarse: coarseKey(operation, positional, receiver) });
    } else if (a.relation === "HAS_EFFECT") {
      const kind = String((a.attributes as { kind?: string } | undefined)?.kind ?? "");
      if (kind !== "CALL_EXTERNAL" && kind !== "WRITE" && kind !== "EMIT") continue;
      const v = (lit(a.object).value ?? {}) as { operation?: string; args?: number; under?: boolean };
      const op = v.operation ?? "";
      const k = kind === "CALL_EXTERNAL" ? (op.startsWith("opaque:") ? "opaque" : "call") : kind === "WRITE" ? "write" : "emit";
      get(a.subject).effects.push(`${k}|${op}|${v.args ?? 0}|${v.under === true}`);
    }
  }
  return out;
}

// ---- one executable ----

export function reconcileExecutable(file: string, name: string, ordinal: number, fn: FunctionIR, stored: StoredExecutable | null): ExecutableReport {
  const walked = walkOccurrences(fn);
  const projected = projectedSites(fn);
  const occ = walked.occurrences;
  const real = projected.filter((p) => !p.pseudo);

  const fine = new Set<string>([...occ.filter((o) => (o.inRule || o.statementLevel) && o.key).map((o) => o.key!), ...real.map((p) => p.key)]);
  const pBy = new Map(real.map((p) => [p.key, p]));
  const coarseOfKey = (k: string): string => pBy.get(k)?.coarse ?? occ.find((o) => o.key === k)!.coarse!;

  // T at the coarse key; a coarse key covering more than one fine key with sites cannot be split
  const tCoarse = new Map<string, number>();
  for (const inv of stored?.invocations ?? []) if (!inv.operation.startsWith("opaque:")) tCoarse.set(inv.coarse, (tCoarse.get(inv.coarse) ?? 0) + 1);
  const pCoarse = new Map<string, number>(); const finesPerCoarse = new Map<string, string[]>();
  for (const k of fine) {
    const c = coarseOfKey(k);
    pCoarse.set(c, (pCoarse.get(c) ?? 0) + (pBy.get(k)?.count ?? 0));
    const l = finesPerCoarse.get(c) ?? []; l.push(k); finesPerCoarse.set(c, l);
  }

  const rows: Row[] = []; const mappings: Mapping[] = [];
  const keysByMapping: Record<Mapping, number> = { "unique": 0, "multiplicity": 0, "ambiguous": 0, "coarse-ambiguous": 0 };
  for (const k of [...fine].sort()) {
    const at = occ.filter((o) => o.key === k);
    const Opp = at.filter((o) => o.inRule).length;
    const S = at.filter((o) => o.statementLevel).length;
    const p = pBy.get(k); const P = p?.count ?? 0;
    const c = coarseOfKey(k);
    const T = stored === null ? null : (finesPerCoarse.get(c)!.length === 1 ? (tCoarse.get(c) ?? 0) : null);
    const wrapperOnlyInRule = at.filter((o) => o.inRule && !o.statementLevel && o.returned && o.wrapper.some((w) => w === "negated" || w === "read")).length;
    const classes = classify({ Opp, S, P, T, wrapperOnlyInRule });
    const coarseDisagrees = stored !== null && T === null && (pCoarse.get(c) ?? 0) !== (tCoarse.get(c) ?? 0);
    if (coarseDisagrees && !classes.includes("ingestion-discrepancy")) classes.push("ingestion-discrepancy");
    const mapping = stored === null ? mappingOf(Opp, P, P) : mappingOf(Opp, P, T);
    if (P > 0 || (T ?? 0) > 0) { mappings.push(mapping); keysByMapping[mapping]++; }
    if (classes.length || mapping === "ambiguous" || mapping === "coarse-ambiguous")
      rows.push({ key: k, coarse: c, operation: p?.operation ?? at[0]?.operation ?? null, Opp, S, P, T, Tcoarse: tCoarse.get(c) ?? 0, Pcoarse: pCoarse.get(c) ?? 0, classes, mapping,
        occurrences: at.map((o) => ({ path: o.path, carrier: o.carrier, wrapper: o.wrapper, reachable: o.reachable, statementLevel: o.statementLevel })),
        contributing: p ? { effects: p.effects, binds: p.binds, kept: p.kept, dropped: p.dropped } : null });
  }
  // stored invocations at a coarse key the projection never produced
  for (const [c, n] of tCoarse)
    if (!pCoarse.has(c)) {
      rows.push({ key: "(none)", coarse: c, operation: JSON.parse(c)[0], Opp: 0, S: 0, P: 0, T: n, Tcoarse: n, Pcoarse: 0, classes: ["ingestion-discrepancy"], mapping: "ambiguous", occurrences: [], contributing: null });
      mappings.push("ambiguous"); keysByMapping.ambiguous++;
    }

  // A1: steps against HAS_EFFECT, by kind and multiplicity, matched on what HAS_EFFECT records
  const groupMap = new Map<string, { steps: Step[]; effects: number }>();
  for (const s of walked.steps) { const g = groupMap.get(s.match) ?? { steps: [], effects: 0 }; g.steps.push(s); groupMap.set(s.match, g); }
  for (const e of stored?.effects ?? []) { const g = groupMap.get(e) ?? { steps: [], effects: 0 }; g.effects++; groupMap.set(e, g); }
  const groups: A1Group[] = []; const attributed: A1Report["attributed"] = [];
  let unmatchedSteps = 0, unmatchedEffects = 0;
  for (const [match, g] of [...groupMap].sort((x, y) => x[0].localeCompare(y[0]))) {
    const us = Math.max(0, g.steps.length - g.effects), ue = Math.max(0, g.effects - g.steps.length);
    if (us === 0 && ue === 0) continue;
    unmatchedSteps += us; unmatchedEffects += ue;
    // a specific step is named only when every step in the group is unmatched; otherwise the group is reported whole
    const unique = ue > 0 ? g.steps.length === 0 : us === g.steps.length;
    groups.push({ match, steps: g.steps.length, effects: g.effects, unmatchedSteps: us, unmatchedEffects: ue,
      returnedSteps: g.steps.filter((s) => s.returned).length, candidates: g.steps.map((s) => ({ path: s.path, returned: s.returned })),
      attribution: unique ? "unique" : "ambiguous" });
    if (unique) for (const s of g.steps) attributed.push({ path: s.path, returned: s.returned, match });
  }
  const countKind = (l: string[], k: string): number => l.filter((x) => x.startsWith(`${k}|`)).length;
  const allEffects = stored?.effects ?? [];
  const a1: A1Report = {
    callSteps: walked.steps.filter((s) => s.kind === "call").length, callEffects: countKind(allEffects, "call"),
    writeSteps: walked.steps.filter((s) => s.kind === "write").length, writeEffects: countKind(allEffects, "write"),
    emitSteps: walked.steps.filter((s) => s.kind === "emit").length, emitEffects: countKind(allEffects, "emit"),
    opaqueSteps: walked.steps.filter((s) => s.kind === "opaque").length, opaqueEffects: countKind(allEffects, "opaque"),
    unmatchedSteps, unmatchedEffects, groups, attributed,
    returnedCallSteps: walked.steps.filter((s) => s.kind === "call" && s.returned).length,
  };

  return {
    file, name, ordinal,
    counts: { O: occ.length, Opp: occ.filter((o) => o.inRule).length, S: occ.filter((o) => o.statementLevel).length,
      P: real.reduce((s, p) => s + p.count, 0), T: (stored?.invocations ?? []).filter((i) => !i.operation.startsWith("opaque:")).length,
      pseudoP: projected.filter((p) => p.pseudo).reduce((s, p) => s + p.count, 0), pseudoT: (stored?.invocations ?? []).filter((i) => i.operation.startsWith("opaque:")).length },
    visibility: { valuelessThrows: walked.valuelessThrows, opaqueStatements: walked.opaqueStatements },
    rows, mappings: [...new Set(mappings)].sort() as Mapping[], keysByMapping,
    unmatched: occ.filter((o) => !o.inRule).map((o) => ({ path: o.path, operation: o.operation, carrier: o.carrier, wrapper: o.wrapper, reason: o.reason! })),
    a1,
  };
}

// ---- a corpus ----

export function reconcileCallSites(j: Journal, fns: { file: string; name: string; fn: FunctionIR }[]): CallSiteReport {
  const store = readStore(j);
  const seen = new Map<string, number>();
  const executables: ExecutableReport[] = [];
  const inIrOnly: string[] = [];
  const paired = new Set<string>();
  for (const { file, name, fn } of fns) {
    const k = `${file}::${name}`; const ordinal = seen.get(k) ?? 0; seen.set(k, ordinal + 1);
    const sk = `${k}::${ordinal}`;
    const stored = store.get(sk) ?? null;
    if (!stored) inIrOnly.push(sk); else paired.add(sk);
    executables.push(reconcileExecutable(file, name, ordinal, fn, stored ?? { file, name, ordinal, invocations: [], effects: [] }));
  }
  const inStoreOnly = [...store.keys()].filter((k) => !paired.has(k));
  // the stored total comes from the store itself, so an unpaired executable cannot make it incomplete
  const realInv = (e: StoredExecutable): number => e.invocations.filter((i) => !i.operation.startsWith("opaque:")).length;
  const pseudoInv = (e: StoredExecutable): number => e.invocations.length - realInv(e);
  const storeT = [...store.values()].reduce((s, e) => s + realInv(e), 0);
  const storePseudoT = [...store.values()].reduce((s, e) => s + pseudoInv(e), 0);
  const storeOnlyT = inStoreOnly.reduce((s, k) => s + realInv(store.get(k)!), 0);

  const sum = (f: (e: ExecutableReport) => number): number => executables.reduce((s, e) => s + f(e), 0);
  const byClass = { "wrapper": 0, "grouping-merge": 0, "grouping-duplication": 0, "ingestion-discrepancy": 0, "other": 0 } as Record<RowClass, number>;
  const byMapping = { "unique": 0, "multiplicity": 0, "ambiguous": 0, "coarse-ambiguous": 0 } as Record<Mapping, number>;
  const unmatchedByReason: Record<string, number> = {};
  const keysByMapping = { "unique": 0, "multiplicity": 0, "ambiguous": 0, "coarse-ambiguous": 0 } as Record<Mapping, number>;
  for (const e of executables) {
    for (const m of Object.keys(keysByMapping) as Mapping[]) keysByMapping[m] += e.keysByMapping[m];
    for (const r of e.rows) for (const c of r.classes) byClass[c]++;
    for (const r of e.rows) byMapping[r.mapping]++;
    for (const u of e.unmatched) unmatchedByReason[u.reason] = (unmatchedByReason[u.reason] ?? 0) + 1;
  }
  const pairs = (n: number): number => (n * (n - 1)) / 2;
  const kindMismatches: string[] = [];
  for (const e of executables) {
    const a = e.a1;
    if (a.writeSteps !== a.writeEffects || a.emitSteps !== a.emitEffects || a.opaqueSteps !== a.opaqueEffects) kindMismatches.push(`${e.file}::${e.name}::${e.ordinal}`);
  }
  return {
    executables,
    totals: { O: sum((e) => e.counts.O), Opp: sum((e) => e.counts.Opp), S: sum((e) => e.counts.S), P: sum((e) => e.counts.P), T: storeT, Tmatched: sum((e) => e.counts.T), TstoreOnly: storeOnlyT,
      pseudoP: sum((e) => e.counts.pseudoP), pseudoT: storePseudoT, rows: sum((e) => e.rows.length), byClass, byMapping, keysByMapping, unmatchedByReason,
      valuelessThrows: sum((e) => e.visibility.valuelessThrows), opaqueStatements: sum((e) => e.visibility.opaqueStatements) },
    a1: {
      executablesCompared: executables.length,
      executablesEqual: executables.filter((e) => e.a1.unmatchedSteps === 0 && e.a1.unmatchedEffects === 0).length,
      returnedCallSteps: sum((e) => e.a1.returnedCallSteps),
      stepPairs: sum((e) => pairs(e.a1.callSteps + e.a1.writeSteps + e.a1.emitSteps + e.a1.opaqueSteps)),
      effectPairs: sum((e) => pairs(e.a1.callEffects + e.a1.writeEffects + e.a1.emitEffects + e.a1.opaqueEffects)),
      unmatchedSteps: sum((e) => e.a1.unmatchedSteps),
      unmatchedEffects: sum((e) => e.a1.unmatchedEffects),
      groups: sum((e) => e.a1.groups.length),
      groupsAmbiguous: sum((e) => e.a1.groups.filter((g) => g.attribution === "ambiguous").length),
      attributedReturned: sum((e) => e.a1.attributed.filter((s) => s.returned).length),
      attributedOther: sum((e) => e.a1.attributed.filter((s) => !s.returned).length),
      // consistent with the frozen prediction: every unmatched step count equals the returned steps in its group
      groupsWhereUnmatchedEqualsReturned: sum((e) => e.a1.groups.filter((g) => g.unmatchedEffects === 0 && g.unmatchedSteps === g.returnedSteps).length),
      kindMismatches,
    },
    unpaired: { inIrOnly, inStoreOnly },
    limits: [
      "Locations are file, executable, and IR path. The IR keeps no source lines by design.",
      "Calls the encoder does not represent, inside opaque constructs or in a thrown value it drops, are in no population. The visibility bound counts the statements that may hide them; it claims nothing about them.",
      "A stored invocation records operation, argument kinds, and receiver kind only. It is matched to projected sites at that coarse key; a coarse key covering several projected keys is reported, never split.",
      "Identical occurrences are matched by multiplicity. Which stored invocation is which occurrence is not determined.",
      "HAS_EFFECT records kind, operation, argument count, and whether conditional. A1 compares steps and effects per group of that signature; a step is named as unmatched only when its whole group is unmatched, otherwise the group is reported with every candidate.",
      "T counts every stored call invocation in the store; Tmatched is the part in executables paired with the IR, TstoreOnly the part in executables the IR list lacks.",
    ],
  };
}
