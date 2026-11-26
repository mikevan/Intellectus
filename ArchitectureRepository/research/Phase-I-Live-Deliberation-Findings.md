# Phase I â€” Live committee deliberation findings

Date: 2026-11-26. Status: operational qualification passed; semantic understanding hypothesis remains unproven. RT-5 has not been executed.

## Research question

Can heterogeneous specialists construct implementation-independent knowledge, challenge one another using evidence, and distinguish verified claims from unsupported interpretation?

## Experimental record

| Trial | Outcome | Finding |
|---|---|---|
| [Initial live committee](../evidence/phase-I/live-committee-20261126-011149-7d31dc66.json) | Operational pass | Both local specialists responded; conceptual equation was incorrect and domain specialist abstained. |
| [Live deliberation](../evidence/phase-I/live-deliberation-20261126-012738-70723710.json) | Failed typed gate | Prose hypotheses did not qualify as typed candidates; no revision rounds. |
| [Typed deliberation](../evidence/phase-I/live-typed-deliberation-20261126-013954-3ed44904.json) | Failed typed gate | Both responses exhausted the 256-token completion budget; incomplete envelopes were rejected. |
| [Concise deliberation](../evidence/phase-I/live-concise-deliberation-20261126-015216-dc8477f1.json) | Operational pass | Valid structured hypothesis, independent verification, two revision rounds, one unresolved contradiction. |

All four records remain intact. The final qualification used concise candidate-first output with a 512-token completion ceiling.

## What the specialists actually established

| Specialist | Recorded contribution | Assessment |
|---|---|---|
| Structural | Python encoder 0.9/schema 6 identified transform, binding, opaque loop and return. | Partial structural coverage; implementation evidence, not intent. |
| Behavioral | Actual execution: (0,-2) â†’ 11; (1,-2) â†’ 14; (0,-1) â†’ 9. | Observed facts. |
| Causal | Unit-input interventions on the same fixture. | Useful variation, not independent evidence from a separate source. |
| Mathematical | 7 + 3x âˆ’ 2y. | Independently checked across all 25 specified input pairs in Python and TypeScript. |
| Conceptual | 11 + 3x âˆ’ 2y. | Contradicted: predicted 15 at (0,-2), observed 11. |
| Domain | Business context unknown. | Appropriate abstention; no business intent established. |
| Reconciliation / verification | Retained verified mathematical behavior and preserved the contradiction. | Verified in scope; not unanimous agreement. |

The conceptual specialist repeated its incorrect candidate in both revision rounds and asserted that its previous model matched all observations. The verifier rejected that assertion. No demonstrated learning or correction occurred. The unresolved contradiction is d15651d4be6343b13e40941cac67221519cde6f8af2cd71bce22e0620c06de0b.

The verified behavioral identity is 6791e4aa85cb407cda45c7e6e91268010414e2ff7310f975fe93e48820f980fe. The verification domain is x=0..4 and y=-2..2; it is not a proof of all possible inputs or implementations.

## Local inference measurements

| Invocation | Prompt tokens | Completion tokens | Elapsed ms |
|---|---:|---:|---:|
| Conceptual initial | 182 | 79 | 47017 |
| Domain initial | 180 | 14 | 21354 |
| Conceptual revision 1 | 229 | 58 | 31260 |
| Conceptual revision 2 | 229 | 58 | 30437 |
| Total | 820 | 209 | 130068 |

1,029 model tokens were processed locally through Colibri using intellectus-qwen36. These are local inference tokens, not billable external API tokens; compute still has a cost. This general-purpose model is a provisional research instrument, not a purpose-trained specialist.

## Conclusions

1. **The heterogeneous committee is operationally feasible (supported).** Local model inference, deterministic specialists, typed claims, verification and bounded revision can participate in one pipeline. This establishes integration feasibility, not cognitive capability.
2. **Evidence-based reconciliation is more reliable than specialist agreement for this fixture (supported).** The deterministic mathematical result matched all 25 tested input pairs in both target languages, while the conceptual model's candidate failed an observed counterexample. Rejecting the incorrect candidate preserved the verified result even without unanimity.
3. **Implementation-independent behavior can be represented for this restricted case (supported in scope).** The equation 7 + 3x - 2y captures the observed transformation without prescribing a loop, statement sequence or programming language. This is evidence of behavioral abstraction, but not evidence that the overall representation is a genuinely semantic model for arbitrary programs.
4. **AI-assisted conceptual understanding has not been demonstrated (not established).** The conceptual specialist supplied a wrong intercept and repeated it after two opportunities to revise. It produced no verified incremental understanding beyond the deterministic specialists. The experiment does not establish that all AI models would fail.
5. **Committee deliberation has not demonstrated self-correction (not established).** Two revision rounds preserved rather than resolved the contradiction. The architecture successfully detected disagreement; it did not successfully teach the specialist to correct its claim.
6. **Business-purpose understanding remains untested (inconclusive).** The domain specialist appropriately abstained because the fixture lacked business context. Neither its usefulness nor its inability to reason about a real business domain can be concluded from this trial.
7. **Deterministic quantification should remain the authority for verifiable numerical behavior (architectural decision).** The trial favors retaining exact computation and independent verification over relying on learned arithmetic. AI specialists should add conceptual or contextual hypotheses where justified by evidence.
8. **Local inference is feasible but its value must be justified (supported in scope).** Four local invocations processed 1,029 tokens in 130.068 seconds of cumulative inference time, without a paid external inference API. No verified incremental conceptual or domain knowledge resulted in this trial; therefore neither cost-effectiveness nor scalability has been demonstrated.
9. **Phase I has qualified the research apparatus, not the intended semantic model (overall conclusion).** There is sufficient evidence to continue investigating a heterogeneous architecture. There is insufficient evidence to claim semantic understanding, automatic optimization, generalized equivalence, successful AI collaboration, or readiness to execute RT-5 as a conclusive validation of those capabilities.

The immediate research priority is to demonstrate measurable added value from conceptual and domain specialists, including correction or explicit withdrawal of contradicted hypotheses, before treating their outputs as an advance over deterministic behavioral abstraction.


## Interpretation and decisions

- A passing operational gate establishes that the pipeline executed and a structured claim reached independent verification. It does not prove that AI understood the program.
- Keep mathematical inference and numerical verification deterministic where possible. AI proposals can be useful but do not outrank observed evidence.
- Preserve abstentions, counterexamples, rejected claims, revisions, and unresolved contradictions rather than collapsing them into a success flag.
- Distinguish semantic behavior from business intent; an equation does not identify an accounting, legal, or other business purpose.
- Do not describe replaying a rejected hypothesis as learning. Do not equate agreement on a finite domain with general equivalence.
- Retain recorded claims and their evidence as the auditable decision trail; do not claim access to private model reasoning.
- Before RT-5, require readable specialist-by-specialist evidence, test the ability to revise a contradicted hypothesis, and separately measure whether a domain specialist adds useful contextual knowledge when context is actually available.

The next research gate should assess genuinely different implementations with equivalent behavior, negative controls with different behavior, and independently supplied business context. Phase I is a feasibility milestone, not the completion of the semantic model redesign.

Use the [decision-trail reporter](../../Understanding/research/knowledge/Show-IntellectusDeliberation.ps1) to inspect the recorded claims and checks.
