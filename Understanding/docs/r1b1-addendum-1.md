# R-1B1 addendum 1: rulings on the experiment, and the revised diagnostic contract

Michael Van Geertruy, with Claude. INTERNAL. Ruled 2026-11-02 on `docs/r1b1-results.md` (sha256 `7e08732a27a59ee6c37919d01fb9de3c9ddc12cd69ab3ecff3a2088cbedbbf7b`).

This addendum changes nothing frozen. `docs/r1b1-protocol-frozen.md` (`cf118c69...`), `docs/r1b1-manifest.json` (`072b5101...`), the results, and the original R13 prediction miss all stand exactly as recorded. Where this addendum and the frozen protocol differ, this addendum governs **future** checks. It never rescores the frozen run.

## Rulings

1. **Program order: Candidate B, `NEXT_STEP`.** Its required answers matched Candidate A's. It uses fewer attributes, and it leaves the existing `FOLLOWS` meaning and its ingestion guard (`test/ir/ingest.test.ts` line 64) intact. The measured attribute-read reduction (54 against 171) is an experiment result, **not a production performance claim**.
2. **Keep `AWAIT_TARGET`; omit any separate completion relation.** The ablation supports this within the tested scope. The successful-await rules (R-AWAIT, R-SETTLE, the per-language existence of `settle`) and dependency identity through `AWAIT_TARGET` are preserved. Neither `AWAITS` nor any equivalent duplicate completion assertion is introduced. Refusal rules R8 to R11 therefore have no relation to apply to in production.
3. **Predicates: H1, `TESTS_PREDICATE`.** Branch predicates stay distinct from the existing executable-level `HAS_PREDICATE` assertions, and the preserved 96 continue to be reported separately. The choice rests on clear meaning and compatibility. The experiment showed no performance difference between H1 and H2.
4. **R12 counts accepted, valid `AWAIT_TARGET` facts.** An invalid target cannot satisfy the "exactly one valid target" invariant. R13 rejects the malformed target, and R12 then correctly reports that the await has no valid target. Both diagnostics are kept. No valid diagnostic is suppressed to satisfy the original prediction.

## Revised diagnostic contract (governs future checks)

Every diagnostic carries a **role**:

| Role | Meaning |
|---|---|
| `primary` | The fact itself is refused by a rule (R1 to R23, R22 deferred). |
| `consequent` | A completeness or cardinality failure that exists only because a primary refusal removed a fact. It names the primary diagnostic it follows from. |

**R12 under this contract:**

- **Consequent,** when an await has zero accepted `AWAIT_TARGET` facts because its only stored target was refused by R13. It is reported as the resulting completeness failure and names that R13.
- **Primary,** when the store itself gives an await zero `AWAIT_TARGET` facts, or two or more valid ones. These are the manifest's two R12 alternatives.

**The same rule applies to R18,** where the evidence already shows the identical shape. A refused cross-executable entry leaves the executable with no accepted entry. The fact-level R18 is primary, and the store-level "entry missing" R18 is consequent.

**Expected outcome of the four R13 alternatives under this contract:** primary {R13}, consequent {R12 following that R13}. The frozen expectation {R13} and its miss are not edited. This line states what a future run is checked against.

**Section 15.1's sentence "one bad fact produces one code"** is superseded for future checks by: one bad fact produces exactly one **primary** code, plus any consequent diagnostics that name it.
