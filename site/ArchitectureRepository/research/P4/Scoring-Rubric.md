# P4 scoring rubric

**Status:** Implementation for independent review before freezing.

A supported claim earns credit when its entity, unit, result meaning, and applicability match the reference in oracle.json and both cited documents support it. Accept equivalent wording. A correct claim without the needed evidence IDs remains unverified. Check the claim against the held-out examples for the case's calculation. Record the first reason for rejecting a claim and retain the original response.

For a conflict, award abstention credit if the response identifies the conflicting input roles or prescribed actions and explains why the documents do not resolve them. For a behavioral contradiction, require the response to identify a disclosed witness and explain how the proposed rule predicts a different result. A generic statement of uncertainty does not earn credit for a misleading-context control. In the no-context condition, a domain-neutral explanation with explicit abstention is valid.

Score each response once as verified claim, unsupported claim, valid abstention, unnecessary abstention, or invalid response. An alleged abstention that still asserts an unsupported domain interpretation is an unsupported claim. A malformed or missing reply is invalid. Report each category and all 12 planned responses per condition.

Before collecting replies, have a separate reviewer verify each expected claim and control witness, record accepted paraphrases, and freeze the oracle, fixtures, prompts, randomized order, model and runner. The reviewer should not see condition labels when assessing claim wording where possible. Use the protocol thresholds without changing them after seeing results.
