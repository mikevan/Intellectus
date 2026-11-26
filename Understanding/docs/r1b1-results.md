# R-1B1 results: the scratch-store experiment

Michael Van Geertruy, with Claude. INTERNAL. Run 2026-11-02 on Linux, in a scratch directory outside the repository, against the frozen protocol and manifest. No production code, schema, or encoder changed.

## Provenance

| Artifact | sha256 |
|---|---|
| `docs/r1b1-protocol-frozen.md` | `cf118c69056f2ede6996ed28d043a7d51ae4f105dda525becc9e4bdc0acead9b` |
| `docs/r1b1-manifest.json` (read by the checker; the checker verifies and prints this hash) | `072b51013d2b85eae9d3c15954a3388cb398f94f94b8b7fdb662b319a2b33ecf` |
| Scratch checker `checker.mjs` (outside the repository, final version) | `f6749afaae98945cbb3600f59a7ec7cd8c6f5b18740b775ca75362f7a058eae6` |
| `docs/r1b1-results.json` (raw output; byte-identical on a second run) | `0ba232f2651e75a1032f2ee3ae57d9a32ece7abbfcb38e541e68fa79914ae81a` |

The checker normalises every store into the semantic event graph, derives every precedence by enumerating chains with condition sets, classifies pairs by section 5, computes `ARM_STATUS` from each fixture's body by section 2.5 and compares it with the stored facts, and runs every refusal alternative under every applicable candidate.

## Results by combination

| | A/H1 | A/H2 | B/H1 | B/H2 |
|---|---|---|---|---|
| Required and forbidden queries | 172 of 172 | 172 of 172 | 172 of 172 | 172 of 172 |
| Refusal controls passed | 34 of 38 | 34 of 38 | 33 of 37 | 33 of 37 |
| Refusal misses (all R13, see below) | 4 | 4 | 4 | 4 |
| Unexpected refusals on valid fixtures, L1 included | 0 | 0 | 0 | 0 |
| Completeness warnings matching the manifest | all | all | all | all |
| Computed `ARM_STATUS` and implicit exits matching the stored facts | all | all | all | all |
| Assertions, all fixtures | 396 | 396 | 396 | 396 |
| Attribute values on those assertions | 574 | 574 | 340 | 340 |
| Derivation cost: facts inspected | 396 | 396 | 396 | 396 |
| Derivation cost: attribute reads during normalisation | 171 | 171 | 54 | 54 |
| Derivation cost: edge expansions | 688 | 688 | 688 | 688 |
| Ablation: queries lost or changed | 0 | 0 | 0 | 0 |

B runs 37 refusal controls rather than 38 because one R2 alternative ("within names another executable") exists only under A.

**What the identical rows mean:** after normalisation, all four combinations hold the same event graph, so every query answer, every class, and every edge expansion is identical. The candidates differ only in what they store to get there.

## Ablation (amendment A5 prediction: no required query lost)

**The prediction held in all four combinations.** For K4a, K5, K7, K13, and K14, removing the completion fact while keeping `AWAIT_TARGET` changed no query answer and produced no refusal. It removed exactly one assertion per fixture: K4a 10 to 9, K5 18 to 17, K7 33 to 32, K13 12 to 11, K14 12 to 11. **Neither candidate's completion relation carries information that `AWAIT_TARGET` plus R-SETTLE do not already supply.**

The K4 delta matches the manifest exactly. K4a stores 4 steps, 3 program facts, 1 completion, and 1 `AWAIT_TARGET`. K4b stores 3 steps, 2 program facts, and neither of the other two.

## Prediction misses and unexplained results

1. **R13 refusal controls, all four alternatives, all four combinations: expected {R13}, got {R13, R12}.**
   - Section 15.1 claimed that "one bad fact produces one code". That claim fails here.
   - Excluding a refused `AWAIT_TARGET` leaves its await with zero accepted targets, which the store-level R12 then reports. One bad fact therefore produces two codes, by cascade.
   - This is a prediction miss in the frozen manifest and in the section 15.1 wording. It is not corrected.
   - The checker reads R12 as counting **accepted** `AWAIT_TARGET` facts. Counting stored facts instead would have produced {R13}. Which reading production should use is a ruling for Michael.
2. **A checker defect, found during the run and fixed before the final run.**
   - The first version compared refusal codes as lists, not as the **set** section 15.1 specifies.
   - The cross-executable entry alternative of R18 reported R18 twice: once for the refused fact, and once at store level for the missing entry. As a list it failed; as a set it is {R18}, as expected.
   - The fix changed the comparison only. It is recorded here because it is the same cascade shape as miss 1.
3. **An interpretation applied to R9.** R9 refuses "a completion fact whose call differs from the call `AWAIT_TARGET` names". The checker applies R9 only when `AWAIT_TARGET` names a call. Where the target is a literal, R10 fires instead. This matched the manifest (the R10 alternatives passed), but it is a reading of the frozen wording, not a rule the protocol states.
4. **Untested rule: the derivation's own conflicting-arm check is never exercised.**
   - A sabotaged checker with that check removed passed every fixture. In a structured single executable, no chain can pass through both arms of one branch, so no fixture can reach the check.
   - K9b exercises the composition rule, but it does so through a separate engine function, not the checker's chain derivation.
   - So the condition-validity rule is verified for composition (K9b) and **unverified for chain derivation**. A fixture or unit test that injects a conflicting chain directly is needed before R-1B2 relies on it.
5. **Test power, checked by sabotage:**
   - Keeping only the deeper step's condition (draft 1's rule) failed 23 queries, including K6b, K6c, and K10's both-condition sets.
   - Adding a false enter-before-settle edge (draft 2's rule) failed 32 queries, including every forbidden-settlement query.

   The suite detects both historical errors it was built to catch.
6. **R22: deferred, not passed** (amendment A4). The payload oracle comparison, run outside the order checker, matched every stored predicate.
7. **No unexplained results** beyond the items above. Every class, condition set, completeness warning, computed status, and population check matched the manifest.

## Preservation of existing relation meanings

| | Program order | Predicate |
|---|---|---|
| **A** | `FOLLOWS` gains step endpoints. It now means two things (thread order between executables, and step order), distinguished by endpoint kind and `control`. Legacy executable-level `FOLLOWS` was accepted (L1) only because the validator dispatches on endpoint kind first. `test/ir/ingest.test.ts` line 64, which forbids ingestion from writing `FOLLOWS`, would have to change. | |
| **B** | `FOLLOWS` untouched. `NEXT_STEP` has one meaning. | |
| **H1** | | `HAS_PREDICATE` untouched. `TESTS_PREDICATE` has one meaning. |
| **H2** | | `HAS_PREDICATE` gains a step subject, so one relation holds both the ruled executable-level baseline (96) and branch-level facts. Reports must separate them by subject kind. |

## Recommendation, from the results

- **Program order: Candidate B, `NEXT_STEP`.**
  - Every answer is identical to A: 172 of 172 queries, 688 edge expansions, 396 assertions.
  - It needs 234 fewer attribute values (340 against 574) and 117 fewer attribute reads during normalisation (54 against 171).
  - It leaves `FOLLOWS` and its existing ingestion guard alone.
- **Completion relation: none.** The ablation lost nothing in any combination. Production should store `AWAIT_TARGET` and derive settlement order by R-SETTLE. Refusal rules R8 to R11 then have nothing to apply to. Candidate B's `AWAITS` would be an exact duplicate of `AWAIT_TARGET`.
- **Predicate: H1, `TESTS_PREDICATE`.** Query results are identical, because classification never reads predicate facts. H1 keeps `HAS_PREDICATE`, and its ruled count of 96, meaning exactly what it meant.

**Before P0, P1, P2, and R-1B2, two items from this run need a ruling or a test:**

1. Whether R12 counts accepted or stored `AWAIT_TARGET` facts (miss 1).
2. A direct test of the chain derivation's conflicting-arm rule (item 4).
