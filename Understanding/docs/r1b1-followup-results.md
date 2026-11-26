# R-1B1 follow-up results (addendum 2)

Michael Van Geertruy, with Claude. INTERNAL. Run 2026-11-02 on Linux, outside the repository, against `r1b1-manifest.json` `072b5101...` and `r1b1-followup.json` `df3ae73b...`. Both hashes are verified by the runner before it runs. Raw output: `r1b1-followup-results.json` `c3779b12c574c3c7ab1d45f8dca58b36314934886ea0c61b125fd3459e0b6bb0`. The reproducible bundle is in `r1b1-bundle/`.

These results are reported **separately** from the original run. The original run, its expectation {R13} for the R13 controls, and that miss stand unedited in `r1b1-results.md` and `r1b1-results.json`.

## Checker revisions

| Revision | sha256 | What it is |
|---|---|---|
| r0 | reconstructed, `a4caae27...` | List comparison. It reproduces the first-run outcome: 5 misses per combination, R18 counted twice. |
| r1 | `f6749afa...` | Set comparison. **Produced the final original results** (`0ba232f2...`). |
| r2 | `0df935df...` | Diagnostic roles and exports. Its chain derivation is byte-identical to r1 (`derive`, `armsOf`, `stepOfEv`, and `canon` were compared as source text before running), and its main run reproduces `0ba232f2...` exactly. |

## 1. Diagnostic roles (all four combinations)

| Control | A/H1 | A/H2 | B/H1 | B/H2 |
|---|---|---|---|---|
| Role-annotated controls (R13 ×4, R12 ×2, R18 ×4) | 10/10 | 10/10 | 10/10 | 10/10 |
| All other refusal controls: primary equals the frozen set, consequent empty | 28/28 | 28/28 | 27/27 | 27/27 |

**Results as frozen:**

- All four R13 alternatives gave primary {R13} and consequent {R12 <- R13}.
- Both R12 controls gave primary {R12} with no consequent.
- Three R18 controls gave primary {R18} with no consequent. The cross-executable entry gave primary {R18} and consequent {R18 <- R18}.

No independent violation was suppressed. Every control's primary set equals its predicted set.

## 2. Conflicting-arm coverage, through the chain-derivation code itself

**Prediction confirmed: validated stores can reach the case.** CA1 and CA2 pass every refusal rule (R1 to R23) in all four combinations, although their `IN_ARM` membership contradicts their arm-labelled program facts.

| Fixture | Correct derivation (all combinations) | Sabotaged derivation, conflicting-arm check removed (all combinations) |
|---|---|---|
| CA0 (consistent) | Pass: x.return < u.invoke = {(B,then)}; x.return < v.invoke = {(B,else)} or {(B,then)} | **Pass** (the control is not vacuous: valid chains are unaffected) |
| CA1 (u in the else arm, reached by the then edge) | Pass: x.return < u.invoke not derived; x.return < v.invoke = exactly {(B,else)} | **Fail:** derives x.return < u.invoke under {(B,else),(B,then)}, and adds that contradictory set to x.return < v.invoke |
| CA2 (contradictory endpoints) | Pass: u.return < v.invoke not derived | **Fail:** derives u.return < v.invoke under {(B,else),(B,then)} |

**What this establishes:** the conflicting-arm check in the actual chain-derivation code is now experimentally validated. A test reaches it, the correct code rejects the contradictory precedence, and removing the check makes the test fail. It is no longer only a defensive check.

## 3. Finding for ruling, not fixed

**The validator accepts stores whose membership contradicts their edges.** No rule checks `IN_ARM` against the arm labels on program facts. The order checker's conflicting-arm rule keeps such a store from producing false precedences. But the classification rules read `IN_ARM` directly: CA2's pair (u, v) is classified Exclusive by rule 1 while a program fact runs from u to v.

A consistency rule would refuse such stores at validation. For example: every step reachable from a branch only through arm p must carry that branch's `(B, p)` in its arm set, and no step may carry an arm it is not reached through. Adding one is a change to the agreed rules, so it is reported here for Michael's ruling. Encoders that write both facts from the same walk should never produce the contradiction. The rule would guard hand-written or damaged stores.

## Status

The diagnostic follow-up and the conflicting-arm evidence are complete. The R-1B1 design selection was already accepted. **Validation closure is now Michael's call, together with the consistency-rule finding.**
