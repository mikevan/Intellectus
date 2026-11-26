# P0 protocol, frozen: reconcile call occurrences, walked call sites, and stored call invocations

Michael Van Geertruy, with Claude. INTERNAL. Frozen 2026-11-02, before any instrument code.

**Status:** frozen under Michael's authorization of 2026-11-02, which approved the draft (`docs/p0-protocol-draft.md`, `a93f87d4ac3824d9d055f30acee0cc1f7b86a67bac3e28a7b515d8b9a0a570d9`, preserved unedited) with the corrections recorded in section 11, and required no further approval for those exact amendments. Machine-readable control expectations are frozen alongside it in `docs/p0-controls.json`; its sha256 is recorded in the experiment log entry that freezes both.

## 1. What P0 must establish

R-1B1 draft 1 recorded a measured discrepancy from a probe outside the repository:

| Corpus | Call sites in the walk (draft 1 probe) | Call invocations in the store (I-0 accounting) |
|---|---|---|
| `ir0-typescript` | 65 | 65 (80 invocations minus 15 pseudo) |
| `toml-python` | 65 | 65 (99 minus 34 pseudo) |
| `radon-python` | **120** | **121** (202 minus 81 pseudo) |

P0 names the cause of every difference, **site by site**, before P1 is frozen. It never adjusts any count to make two agree. Both original observations stay as recorded. If the cause is the probe rather than the store, that is logged as a miss of the draft 1 probe. Totals are reported, but no conclusion is drawn from totals: every hypothesis is decided by site-level evidence.

## 2. Scope

An **instrument only**, in the I-0 tradition.

- A new module, `src/query/callsites.ts`, computes the populations below and the site-level reconciliation. A section is added to the `graph` report, and a script, `scripts/callsites.ts`, writes the complete site-level reconciliation as JSON. A test, `test/e3/callsites.test.ts`, runs the frozen controls from `docs/p0-controls.json`.
- No change to the IR, the encoders, `ir_schema` (6), ingestion, the store, or `src/query/reconcile.ts`.
- The build id moves, because `src` and `scripts` change. No `EXPECTED.json` row is appended, as at I-0 and R-1B0.
- The run is made on a copy of the repository outside the connected folder, as R-1B0 was; Michael confirms on Windows.

## 3. Populations, frozen with the protocol

All IR is read after `canonicalise`, which is what the projection and the draft 1 probe both read. Every population is computed per executable.

- **O, IR call occurrences.** Every `call` expression and every `CALL_EXTERNAL` effect statement in the canonicalised IR, at any depth: statement carriers, call arguments, receivers, branch predicates, other expressions, behaviour (function-valued) operands, and unreachable code after an element that always exits. Each occurrence carries its executable, its **IR location** (a structural path such as `body[2].then[0].value.object.expr`), its carrier, its **wrapper shape** (the chain of `computed`, `negated`, `read`, and `awaited` between the carrier and the call), its operation, its path condition computed by the projection's own live-condition rule, and whether it is reachable.
- **O-pp, occurrences in positions the ingestion rule reaches.** The reachable members of O that are: a `CALL_EXTERNAL` effect statement; a `bind` or `evaluate` expression that is a call after removing `awaited`; or a call reached from a `return` or `throw` value through any chain of `negated` and `read`, ending in `computed`, then any number of `awaited`. Operation defined.
- **S, statement-level call sites (the draft 1 probe).** Reachable `CALL_EXTERNAL` effect statements; `bind` and `evaluate` expressions that are calls after removing `awaited`; and `return` or `throw` values that are `computed` with a call after removing `awaited`. Kept **only** to reproduce the draft 1 figures. This is the probe's rule as preserved in `$HOME/und-probe/steps.mjs`.
- **P, projected call sites.** A **separate re-implementation** of ingestion's rule (`src/ingest/index.ts`, pass 2), applied to `effectProjection`, sharing no code with ingestion. It takes `CALL_EXTERNAL` outcomes into an effect group; binding outcomes whose expression, without `awaited`, is a call into a binding group; and calls reached from `return` and `throw` values through `computed`, `negated`, and `read` into the binding group. It keys each by `(operation, arguments, path condition)` plus receiver, and counts each key as `max(effects, binds)`. `opaque:` pseudo-operations are counted and then excluded from P, as from T. Every P site records its **contributing outcomes**: which projection outcomes fell in each group, and which were dropped by the merge.
- **T, stored call invocations.** Read back from the store after ingestion: `HAS_INVOCATION` assertions whose operation is not `opaque:`, with their `HAS_ARGUMENT` positions, argument kinds, and receiver kind.

**Mapping limits, stated before measuring.** IR carries no source lines by design, so the location reported is the file, the executable, and the IR path. Calls the encoder does not represent (inside an opaque construct, or a thrown value the encoder drops) are outside every population; P0 counts per executable the semantic opaque statements and the value-less `throw` statements that may hide such calls, as a visibility bound, and claims nothing about them. A stored invocation carries no path condition and no operand content beyond kind, so T is matched to P only at a **coarse key** `(operation, argument kinds, receiver kind)`; where two P keys share one coarse key, the stored invocations are reported as coarse-ambiguous rather than assigned. Executables are identified by file, declared name, and ordinal among same-named declarations in that file, in declaration order.

## 4. Site-level reconciliation

For every executable and every key where O-pp, S, P, and T do not all agree, the instrument reports a row with:

- the executable (file, name, ordinal);
- the key and its counts in O-pp, S, P, and T;
- every occurrence at that key, with IR location, carrier, wrapper shape, and reachability;
- the contributing projection outcomes, and which were dropped by the merge;
- one classification from the list below, and the mapping status.

**Classifications:**

| Class | Definition |
|---|---|
| `wrapper` | S and O-pp differ because a call is reached through `negated` or `read` in a `return` or `throw` value. The H1 class. |
| `grouping-merge` | P and T agree, and P is below O-pp: the grouping rule merged distinct occurrences into fewer sites. |
| `grouping-duplication` | P and T agree, and P is above O-pp: the grouping rule produced more sites than occurrences. |
| `ingestion-discrepancy` | P and T disagree at the coarse key: ingestion did not do what its own rule says. |
| `other` | Any difference none of the above explains. Named construct required before P1. |

A row may carry more than one class; each is reported.

**Mapping status, never resolved by choice:**

- `unique`: one occurrence, one site, one invocation.
- `multiplicity`: n identical occurrences, n sites, n invocations. Multiplicity is preserved; which invocation is which occurrence is **not** determined, and is reported as such.
- `ambiguous`: the counts differ, so at least one invocation or occurrence cannot be mapped to a single counterpart; every candidate occurrence is listed.
- `coarse-ambiguous`: as above, caused by two or more P keys sharing a coarse key.

**Unmatched occurrences:** every member of O outside O-pp is listed with its location, carrier, wrapper shape, and reason (`nested-argument`, `receiver`, `predicate`, `expression-operand`, `behaviour`, `unreachable`, `no-operation`). These are not differences between S, P, and T, but P1 must account for them (section 9).

## 5. Hypotheses, stated before measuring

| | Hypothesis | Site-level evidence that decides it |
|---|---|---|
| **H1, probe scope** (the stated prediction) | The draft 1 probe counted a call in a `return` or `throw` value only when it was the whole `computed` value. Ingestion also descends through `negated` and `read`. | Rows classed `wrapper`, each naming its occurrence and wrapper shape. |
| **H2a, grouping-rule divergence** | The grouping rule itself makes the site count differ from the occurrences, while projected and stored agree. Projected and stored may both be 121 while the occurrences are 120. | Rows classed `grouping-merge` or `grouping-duplication`, each with its occurrences and the contributing outcomes the merge kept and dropped. |
| **H2b, ingestion implementation discrepancy** | Ingestion's code does not implement its own rule: projected and stored disagree. | Rows classed `ingestion-discrepancy` at a coarse key. |
| **H3, other** | None of the above. | Rows classed `other`. P0 must name the construct before P1. |

The hypotheses are not exclusive. A total that matches is not evidence for any of them; only rows are.

## 6. Predictions, frozen with the protocol

1. **The figures reproduce.** S totals are 65, 65, and 120, and T totals are 65, 65, and 121, for `ir0-typescript`, `toml-python`, and `radon-python`.
2. **H1 holds.** In radon, exactly one row is classed `wrapper`, at a call under `read` or `negated` in a `return` or `throw` value. toml and ir0 have none.
3. **No grouping-rule divergence and no ingestion discrepancy.** Zero rows classed `grouping-merge`, `grouping-duplication`, `ingestion-discrepancy`, or `other` in all three corpora. Consequently P equals T at every coarse key, and P equals O-pp at every key. **This is a prediction, not a certainty:** code reading shows that `f(a)` followed by `return f(a)` under one path condition is merged into one site by `max(effects, binds)` (control C7), so a `grouping-merge` row in a corpus would be a real finding about the rule, recorded as a miss of this prediction.
4. **Nothing else moves.** Every existing `measure`, `graph`, and `sufficiency` figure is identical apart from the build id and the new section, including R-1B0's 96, 303, and 274 with 0 fixed, `ORDER_UNSPECIFIED` 3 and 2, and `HAS_PREDICATE` 96. Every corpus still reproduces its R-1A row. Checked by diffing complete outputs before and after.
5. **The A1 correspondence, by kinds and multiplicities per executable.** For every executable, the instrument compares R-1B1's statement-level steps of kind `call`, `write`, `emit`, and `opaque` with R-1B0's observable-effect population, `HAS_EFFECT` of kind `CALL_EXTERNAL` (with `opaque:` operations counted as `opaque`), `WRITE`, or `EMIT`. It matches them by kind, operation, argument count, and whether conditional, which is all `HAS_EFFECT` records, and lists every unmatched step or effect.
   - **Revised before freezing, from code reading; the draft's prediction is preserved in the draft.** The draft predicted equality in every executable. `project()` emits no `CALL_EXTERNAL` outcome for a call that is a `return` or `throw` value, so such a call is a `call` step with no `HAS_EFFECT`. **Prediction:** `write`, `emit`, and `opaque` match exactly in every executable; `call` steps equal matched `CALL_EXTERNAL` effects plus exactly the call steps carried by a `return` or `throw` value, each listed as unmatched; no unmatched effect exists.
   - **Consequence predicted, not corrected:** in any corpus with a returned or thrown call step, R-1B1's pair population is larger than R-1B0's 96, 303, or 274, so amendment A1's claim that the step population "preserves R-1B0's population" is false as a count. P0 reports the per-corpus step-population pair counts beside the baseline; the ruling on what A1 should say is Michael's.

## 7. Controls, frozen with expected answers

The control sources and expected answers are frozen in `docs/p0-controls.json`, which is the authoritative copy; this table summarizes it. Source controls are run through the real encoders and real ingestion. The IR shapes the encoders give these sources were observed with the existing build before freezing, and are part of the frozen expectation, so an encoder change shows as a control failure. A control failure is scored as a miss; nothing is tuned.

| Control | Source | O | O-pp | S | P | T | Expected class and mapping | A1 |
|---|---|---|---|---|---|---|---|---|
| C1 H1 positive (py, ts) | `return f(a).x` | 1 | 1 | 0 | 1 | 1 | `wrapper` (read), unique | 0 call steps, 0 effects |
| C2 negated return (py, ts) | `return -f(a)` | 1 | 1 | 0 | 1 | 1 | `wrapper` (negated), unique | 0, 0 |
| C3 wrapper in thrown value (py, ts) | `raise g(a).err`, `throw g(a).err` | 0 | 0 | 0 | 0 | 0 | none; visibility bound: 1 value-less throw. The encoder drops the thrown value. | 0, 0 |
| C3b wrapper in thrown value (IR) | `throw` of `read(computed(call g))`, hand-written IR | 1 | 1 | 0 | 1 | n/a | `wrapper` (read); no store, since ingestion has no IR entry point and adding one is out of scope | n/a |
| C4 H2 negative (py) | `x = f(a)` then `return x` | 1 | 1 | 1 | 1 | 1 | none; one merged contributing outcome (effect and binding halves share a key) | 1, 1 |
| C5 repeated identical calls (py) | `f(a)` twice | 2 | 2 | 2 | 2 | 2 | none; `multiplicity` | 2, 2 |
| C6 pseudo-invocation (py) | a `for` loop calling `h(i)` | 0 | 0 | 0 | 0 | 0 | none; visibility bound: 1 opaque statement | 1 opaque step, 1 opaque effect |
| C7 controlled grouping merge (py) | `f(a)` then `return f(a)` | 2 | 2 | 2 | 1 | 1 | `grouping-merge`, `ambiguous`: one stored invocation for two occurrences, both listed | 2 call steps, 1 effect, 1 unmatched step (returned) |
| C8 nested call (py) | `h(g(a))` | 2 | 1 | 1 | 1 | 1 | none; `g` unmatched as `nested-argument` | 1, 1 |
| C9 returned call (py, ts) | `return f(a)` | 1 | 1 | 1 | 1 | 1 | none; unique | 1 call step, 0 effects, 1 unmatched step (returned) |

**Classifier controls, synthetic counts given directly to the classification function**, which demonstrate the corrected H2 distinction independently of any corpus:

| Control | O-pp | P | T | Expected class |
|---|---|---|---|---|
| K-agree | 1 | 1 | 1 | none |
| K-merge | 2 | 1 | 1 | `grouping-merge` (H2a) |
| K-dup, as in "121 in both" | 1 | 2 | 2 | `grouping-duplication` (H2a) |
| K-ingest | 1 | 1 | 2 | `ingestion-discrepancy` (H2b) |
| K-both | 2 | 1 | 2 | `grouping-merge` and `ingestion-discrepancy` |

C7 is the controlled grouping-key case through real ingestion; K-dup and K-ingest exercise the two branches of the H2 distinction that no real input is known to reach.

## 8. Reporting

The run returns: totals for every population per corpus; every row of section 4 with its occurrences, contributing outcomes, classes, and mapping status; every unmatched occurrence; the visibility bound per corpus; the A1 comparison per executable with every unmatched step or effect and the step-population pair counts; the baseline diff; every prediction scored as held or missed; and the control results. Results are written to `docs/p0-results.json` and `docs/p0-results.md`, each hashed in the experiment log.

## 9. What P0 hands to P1 (corrected)

P0's result is one input to P1's invocation-mapping ruling. P0 reports facts and chooses nothing.

**Minting invocations from the walk is not permission to drop currently represented invocations.** P1 must preserve every fact the store currently represents. Any change to how invocations are constructed must account explicitly for:

- wrapper calls (`read` or `negated` in a `return` or `throw` value), which are stored invocations with no statement-level step under R-1B1's step definition;
- every other occurrence outside the current step population that P0 lists: nested argument calls, receivers, predicates, expression operands, behaviour bodies, and unreachable code, whether or not they are stored today;
- any `grouping-merge` rows, where the store holds fewer invocations than there are occurrences;
- returned and thrown calls that are steps but have no `HAS_EFFECT`, per the A1 comparison.

The P1 options remain: such calls become steps; their invocations stay represented and are reported as unmapped to a step; or invocations are constructed from the walk, **provided** every currently represented invocation is still produced or its removal is separately proposed, justified, and ruled on.

## 10. Order of work

1. This protocol and `docs/p0-controls.json` are frozen and hashed in the experiment log before any instrument code is written.
2. The instrument, script, test, and report section are written.
3. Baseline outputs, already captured at build `a93a98cead33` before any change, are diffed against the new build's outputs.
4. Controls, then all three corpora, are run. Results are written and hashed. No P1 representation change is made.

## 11. Corrections from the draft, as ruled 2026-11-02

1. **Site-level trace required** to executable, IR location, wrapper shape, and contributing outcomes; multiplicity preserved; an invocation that cannot be uniquely mapped is reported as ambiguous, never assigned (sections 3 and 4).
2. **H2 corrected:** grouping-rule divergence, where projected and stored may agree while both differ from the occurrences, is separated from ingestion implementation discrepancy, where projected and stored disagree. H1 remains the stated prediction. Hypotheses are decided by rows, not totals (section 5).
3. **A1:** equality of counts is necessary but insufficient. The comparison is by kind and multiplicity per executable, with unmatched occurrences and mapping limits (section 6, prediction 5). The prediction was revised before freezing on code reading, as recorded there.
4. **Controls added:** a negated return value (C2), a call under a wrapper in a thrown value (C3, C3b), and a controlled grouping-key mismatch demonstrating the corrected H2 distinction (C7 and the K controls). Expected answers frozen before implementation (section 7).
5. **Section 7 of the draft (now section 9) rewritten:** P1 must preserve every existing represented fact and account explicitly for wrapper calls and other occurrences outside the current step population.
6. **A fourth population, O, added** so that "source occurrences" in the ruling has a defined meaning at the IR level, with its limit (calls the encoder drops) stated rather than hidden.
