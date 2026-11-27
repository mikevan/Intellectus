# P4 exploratory pilot 01

All 24 requests completed in 770.4 cumulative request seconds, about 13 minutes. All 12 no-context responses abstained from assigning business meaning. With context, nine responses asserted domain claims and three abstained.

No supported response met the strict field-level rubric. All eight supported cases used the formula or result datatype in the entity field. Seven nonetheless communicated the intended domain interpretation, output meaning and applicability across the response as a whole. C07 described passing the assessment but omitted the completed-assessment applicability condition. The whole-response observation is diagnostic and receives no qualification credit.

| Case | Context response assessment |
| --- | --- |
| C01 | Correct remaining-order meaning and applicability. Entity field repeats the formula. |
| C02 | Correct remaining-hours meaning and applicability. Entity field repeats the formula. |
| C03 | Valid abstention. Identifies the conflicting mappings and their equal authority. |
| C04 | Correct capped reimbursement and applicability. Entity field repeats the formula. |
| C05 | Correct shipment quantity and applicability. Entity field repeats the formula. |
| C06 | Valid abstention. Identifies the draft rule and inputs that contradict it. |
| C07 | Correct pass interpretation. Entity field says binary flag, and applicability omits completion. |
| C08 | Correct trigger interpretation and applicability. Binary output appears in the entity field and unit is listed as none. |
| C09 | Abstains without identifying the opposing prescribed actions. No control credit. |
| C10 | Correct cents allocation and applicability. Entity field repeats the formula. |
| C11 | Correct reserve allocation and applicability. Entity field repeats the formula. |
| C12 | Asserts a production reserve interpretation without addressing the rounding contradiction. Cites only the data dictionary. |

The context arm correctly handled two of four misleading controls. C09 warrants special review because the control documents omit an explicit mapping from measured stock to the flag. The answer's observation that this link is missing is reasonable, but the current rubric specifically requires identifying the conflict. No unsupported claim was recorded as verified.

This was an exploratory pilot without independent review. The two conditions were run in blocks, with no-context first, and model identity was carried forward from the prior Colibri run. The outcomes do not establish formal P4 qualification. The pilot surfaces two separate issues for a future reviewed trial: whether the model can put the domain entity in the correct field, and whether the control materials make the relevant conflict observable.

- [Raw pilot evidence](pilot-01.jsonl)
- [Scoring rubric](Scoring-Rubric.md)
