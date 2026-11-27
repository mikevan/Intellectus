# Qualification 01 follow-up findings

**Status:** Exploratory. The original qualification remains failed under its original criteria. The frozen skill and original evidence were preserved. Both follow-up model requests used Colibri SSE.

## Experiment selection

Both selectors independently chose an explicitly empty string as their first unseen probe. Colibri named it as its first concrete open input question in the original response. The deterministic boundary generator skipped omission because it was already observed, then selected the minimum-length string. One probe evaluated against both implementations discriminated them. A returned Hello, World! and B returned Hello, !. This was the only discriminating input among six withheld observations. Colibri matched the conventional boundary generator on this case and did not reduce the observation cost. The original response did not rank a general experiment plan.

## Hypothesis correction and truncation

| Measure | Concise protocol | Larger completion budget |
| --- | --- | --- |
| Completion ceiling | 1,536 | 3,072 |
| Stream finished without budget truncation | Yes | Yes |
| Valid JSON | Yes | No, unescaped quotation marks in an open question |
| Reported prompt / completion tokens | 1,000 / 266 | 971 / 2,093 |
| Request time | 235.01 s | 931.52 s |
| Literal rule matches across supplied cases | 10/18 | 18/18 |
| Explains different empty-input results | No | Yes |

The concise reply says B falls back to World on an explicitly empty value, contradicting W1. Its rule for A also omits the exclamation mark for nonempty arguments. Applying the written rules literally gives 2/9 for A and 8/9 for B. It completed as valid JSON but failed substantive correction.

The larger-budget reply explicitly revised the conditional hypothesis. It distinguished omission, explicit empty input, and nonempty input. A and B both greet World on omission. A also greets World on an explicitly empty input. B preserves that empty input. Both preserve nonempty text and add the greeting punctuation. The revised relationship matched all 18 supplied outcomes, and its substantive correction passed. It incorrectly said the prior rule failed for B, although the prior rule's empty-string prediction matched B and failed for A. The response completed without truncation, but unescaped quotation marks broke JSON parsing. The revision was reviewed as text. No automated ingestion or promotion was performed.

The 18 outcomes were supplied to both revision requests. Agreement checks use independent exact outputs, but this stage measures fitting the disclosed evidence after revision. It does not establish prediction on fresh cases.

## Concept discovery and conclusion

The larger-budget response specialized argument presence into three states after seeing the evidence that distinguished them. That is a supported refinement of the earlier concept. The results do not establish a new independent dimension, whole-scope equivalence, or additional qualified knowledge beyond the verified observations. The experiment-selection result and the hypothesis-correction result are separate.

The concise format fit inside the original budget but lost semantic accuracy. The larger budget accommodated the useful revision while still yielding invalid JSON. With one run per condition and differences in prompt format as well as budget, the comparison does not isolate which change caused the result. The runs took about 19 minutes 27 seconds combined and used 4,330 reported total tokens.

- [Protocol](Protocol.md)
- [Exploratory finding](Exploratory-Finding.md)
- [Frozen inputs and probe comparison](frozen-inputs.json)
- [Concise response](concise.json)
- [Larger-budget response](larger-budget.json)
