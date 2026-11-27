# P4 business-record pilot

This exploratory run tests the revised response schema on four previously seen fixtures. C04 (expense claim) and C02 (training plan) are supported cases. C12 supplies a misleading rounding rule. C07 is presented without context. Use the source documents only where the case calls for them. Reuse the existing model alias, temperature, token budget, and timeout. Preserve Pilot 01 and Pilot 02 unchanged.

For each supported case, require the intended business record, result meaning, output unit, applicability, and both supporting document IDs. Require an exact source substring that identifies the named business record. Check the text match mechanically and assess what it supports separately. For C12, require abstention and a disclosed input and output that contradict the draft rule. For C07, require abstention without a domain claim. Report the outcome for each case. This reused sample measures feasibility and cannot establish qualification or generalization.
