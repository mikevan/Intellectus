# P3 deliberative correction

**Status:** Draft. Freeze fixtures, oracle, model identity, and the runner before collecting formal evidence.

## Research question

When a specialist sees a concrete counterexample to a bounded behavioral claim, can it repair the claim or explain why it should be withdrawn? Does it recover more usable claims than a deterministic control given the same evidence?

Phase I showed that the verification layer can reject a false claim. In the concise live run, the conceptual specialist repeated the contradicted claim through two revisions. P3 measures the specialist's response to that evidence separately from the verifier's protection against false promotion.

## Proposed cases and controls

- Use twelve synthetic, side-effect-free integer cases with explicit finite input bounds. Seed eight false affine claims, split evenly between cases with an affine repair and boundary exceptions outside the supported claim form. Seed four correct affine claims as retention controls.
- Use the same initial claim, observations, and revealed counterexample in both conditions. Supply counterexamples only for false claims. For correct claims, both arms receive a review request with no contrary observation.
- Run both arms on every case. The deterministic arm refits the supported affine form using the supplied observations and counterexample, retains a consistent correct claim, or withdraws when the supplied evidence rules out the form. The AI arm receives the same information and has one response to retain, revise, or withdraw. The seeded claims isolate revision from initial discovery.
- Reserve additional verification inputs beyond the disclosed counterexample. Require an independently authored oracle to agree with fixture execution over the full finite domain before scoring any case. Keep the oracle, hidden outputs, and other arm's responses out of the prompt.

## Fixture construction

Use two integer inputs over a finite grid. For a repair case, reveal the origin and one unit intervention as initial observations. Seed a candidate whose coefficient on the other input is wrong. The counterexample is the missing unit intervention, so the combined evidence uniquely identifies the repaired affine form. Alternate which coefficient is initially wrong. Keep the rest of the grid hidden for independent verification.

For a boundary case, reveal the origin and both unit interventions. These uniquely identify the seeded affine claim. Reveal one discrepant boundary point to show that no affine form fits the supplied evidence. Keep other grid points hidden. For a retention control, reveal the same three identifying observations and request review without a counterexample.

Before any live run, the fixture preflight must establish that initial observations agree with each seeded claim, every disclosed counterexample actually contradicts it, all case splits leave held-out inputs, and the deterministic control reaches the expected outcome using only disclosed evidence. Cross-check the oracle against fixture execution on the entire grid.

## Proposed case manifest

Use the grid x = 0 through 4 and y = 0 through 4, inclusive. The affine coefficients below are ordered as intercept, x coefficient, y coefficient. Execute cases in table order. Give the AI a fresh context for each case and omit the case ID, type, expected outcome, and fixture source from its prompt.

| Case | Fixture behavior | Seed coefficients | Disclosed counterexample | Expected disposition |
| --- | --- | --- | --- | --- |
| 01 | 7 + 3x - 2y | (7, 2, -2) | (1, 0) predicts 9, observes 10 | Repair x coefficient to 3 |
| 02 | 2 + x + y, plus 1 at (4, 4) | (2, 1, 1) | (4, 4) predicts 10, observes 11 | Withdraw |
| 03 | 4 - 2x + y | (4, -2, 1) | None | Retain |
| 04 | -3 + 2x + 5y | (-3, 2, 3) | (0, 1) predicts 0, observes 2 | Repair y coefficient to 5 |
| 05 | 6 + 2x - y, minus 2 at (4, 0) | (6, 2, -1) | (4, 0) predicts 14, observes 12 | Withdraw |
| 06 | -5 + 3y | (-5, 0, 3) | None | Retain |
| 07 | 4 - 5x + 3y | (4, -2, 3) | (1, 0) predicts 2, observes -1 | Repair x coefficient to -5 |
| 08 | -1 - x + 3y, plus 3 at (0, 4) | (-1, -1, 3) | (0, 4) predicts 11, observes 14 | Withdraw |
| 09 | 2 + 4x - 2y | (2, 4, -2) | None | Retain |
| 10 | 6 + 4x - 3y | (6, 4, 1) | (0, 1) predicts 7, observes 3 | Repair y coefficient to -3 |
| 11 | 8 - 2x, minus 1 at (3, 4) | (8, -2, 0) | (3, 4) predicts 2, observes 1 | Withdraw |
| 12 | 9 | (9, 0, 0) | None | Retain |

The deterministic control should reach all twelve expected outcomes given the disclosed evidence. That sets a ceiling for this fixture set. P3 can show whether the specialist reaches the qualification threshold and how it compares with the control. A claim of improvement in correctness would require a follow-up where the deterministic control has room to improve.

## Scoring

Record verified repairs, justified withdrawals, correct retentions, unnecessary withdrawals, invalid or missing responses, and contradicted candidates separately. A verified repair must pass all independent checks. For a justified withdrawal, the response must identify the disclosed contradiction and explain why the existing claim should be withdrawn. A valid response format or verifier rejection alone earns no correction credit.

Proposed AI qualification requires at least three of four verified repairs, three of four justified withdrawals on boundary exceptions, and retention of all four correct controls. A false promotion invalidates the run. Report paired counts for each outcome and distinguish an operational qualification from any incremental benefit over the deterministic arm. This sample supports a bounded engineering qualification.

## Evidence to freeze and retain

Before inference, record the fixture and oracle hashes, ordered case manifest, exact prompts, model and Colibri versions, decoding settings, one-response budget, timeout, scoring rules, and runner commit. Keep raw responses, telemetry, disclosed and hidden observations, verification outcomes, and per-case scores. Count timeouts and malformed responses against the planned case denominator. Record any rehearsal separately from the formal run.

The existing P1/P2 late-boundary case is a rehearsal candidate. A formal P3 result cannot be inferred from the P1/P2 pilot or the prior Phase I run.
