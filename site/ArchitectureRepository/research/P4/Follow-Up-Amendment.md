# P4 follow-up amendment

**Status:** Draft for approval and independent review.

## 1. Test the response field instruction

The pilot produced the intended interpretation in seven supported cases, but all eight responses used the formula or result type as the entity. Test whether a more precise instruction fixes this. Add the following to the system prompt while keeping the existing response schema:

> The entity field names the real-world item or record that the result describes. The unit field names what the output measures or how it is represented. The applicability field states the condition under which the rule applies, including any prerequisites from the documents.

Repeat the paired 24-request run using the same pilot fixtures, ordering, checkpoint, and decoding budget. Score against the same rubric. Treat the repeat as exploratory because the prompt change is informed by this case set. Report verified claims, field errors, misleading-control outcomes, and no-context abstentions. Estimated runtime is 10–25 minutes based on the 13-minute pilot.

## 2. Repair the C09 control before formal qualification

Give both documents the same explicit mapping from the threshold calculation to the replenishment flag. Preserve the direct conflict: one equally authoritative rule requires opening a replenishment request on a true flag, and the other requires suppressing it. Neither rule supersedes the other. The expected response identifies the two conflicting actions and abstains from claiming either as authoritative.

Keep the original C09 in the pilot record. A separate reviewer should verify that the revised control has the intended conflict and that both documents are necessary where the oracle requires them. Freeze the reviewed cases, prompts, and scoring before any formal run. Score the formal run against the existing thresholds.
