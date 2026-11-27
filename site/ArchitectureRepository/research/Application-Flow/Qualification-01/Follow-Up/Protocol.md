# Qualification 01 follow-up — selecting checks and correcting a hypothesis

The original qualification failed under its frozen criteria. This exploratory follow-up uses the frozen skill without amendment. It has no effect on the prior verdict and does not qualify the next experiment.

## Questions

1. Can Colibri use the withheld observations to revise its conditional rule for the two subjects?
2. Does its proposed probe distinguish the two subjects at a lower observation cost than a deterministic boundary generator?
3. Do different output conditions permit a complete, correct revision?

## Inputs and controls

Both revision requests use fresh conversations and receive the same frozen skill, first replicate's conditional hypothesis, first unresolved question with a concrete input, discovery observations, and all six withheld observations. The prompt identifies no preferred concept or correct rule. The checker keeps the expected classification and the two source implementations outside the requests. The larger-budget condition preserves the skill's ordinary output protocol and raises the completion ceiling to 3,072. The concise condition uses the original 1,536-token ceiling and supplies a short revision format capped at 220 words. Temperature is zero. Record the two conditions separately. Each condition gets one attempt, so differences are descriptive and do not isolate the effects of format and budget.

For experiment selection, count one probe as evaluating the same input against both subjects. Recover Colibri's first explicit unresolved input from its saved initial response. The earlier response did not rank all possible tests, so use this as the declared extraction rule. The deterministic generator proposes omission, the shortest possible text, then a one-character whitespace value and a one-character non-whitespace value. Skip cases already observed and compare both approaches at a one-probe budget. Check outcomes independently against the original oracle. Score discrimination and probes required separately from model claim accuracy. This is a retrospective comparison on one fixture.

## Scoring

- Selection succeeds when the selected input returns different outputs from the two subjects. Record success and probes required. Neither side gets credit for semantic knowledge just for selecting a useful probe.
- Correction passes only if the completed response substantively revises the original rule, predicts both subjects' observations under their stated scope, and explicitly accounts for the difference on an identical input. Compare the rule's unambiguous predictions across all 18 subject outcomes. Report scope, coverage, contradictions and independent review. Do not count repeated observations as new predictions.
- Concept discovery is a separate review. Record any distinct, evidence-backed behavioral concept beyond the original response. Score proposed tests or hypothesis correction separately. Do not credit independent dimensions or generalized equivalence from the same finite observations.
- Truncation is assessed independently of semantic correctness. Record finish reason, valid or invalid JSON, reported tokens, response length, latency, and whether the required fields survived. A partial response is preserved and may be discussed diagnostically.

Freeze and hash the protocol, skill, original artifacts, runner, and request packets before inference. Preserve raw outcomes and identify which findings are exploratory. Do not alter the original skill, reports, or evidence.
