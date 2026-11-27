# Transfer 01 findings

The original qualification and follow-up retain their prior dispositions. The larger-budget follow-up exhibited evidence-driven correction after disclosure. This separate verification tests the frozen corrected rule on new inputs and leaves the revised skill and past records unchanged.

| Comparison | Fresh inputs | Previously observed boundary controls |
| --- | ---: | ---: |
| Python A versus its frozen rule | 12/12 | 2/2 |
| Python B versus its frozen rule | 12/12 | 2/2 |
| TypeScript C versus the A rule | 12/12 | 2/2 |
| TypeScript C versus the B rule | 12/12 | 1/2 |

The fresh cases verify the shared nonempty-text rule on additional whitespace, punctuation, digits and Unicode examples. All 12 new inputs are nonempty, so they provide no new discrimination between A and B. The distinct empty-input behavior and the omitted-argument match were checked again as explicitly reused controls. C matched A at the empty boundary and differed from B there. The TypeScript port predates the experiment and was not generated from the candidate hypothesis. The repository documents that its HelloWorld ports intentionally mirror each other, so independent authorship is unconfirmed. This is an exploratory transfer check, not a formal invariance result.

## Concept quality and value relative to deterministic analysis

| Proposed distinction | Evidentiary assessment | Value beyond a deterministic check |
| --- | --- | --- |
| Subject A and Subject B | Identifiers for the subjects of investigation | None as domain concepts. They locate contrasting observations. |
| Omitted, explicitly empty, and nonempty | Supported observations about which argument was supplied and its length | Reusable as input distinctions. A deterministic presence and length check yields the same partition. |
| Output equality under omission and divergence on explicit empty input | Supported relationship between observations within this scope | Useful for selecting a comparison or checking transfer. Direct deterministic comparison yields the same result when both outcomes are available. |
| Empty input validity | The evidence shows that A and B both return text on empty input | No validity or intent conclusion is supported. |
| Fallback mechanism | For A, the omitted and empty inputs return the same text. B differs. | The evidence supports a conditional relationship between input and output. It gives no independent proof of internal mechanism. |

The model's useful exploratory contribution was revising a broader rule when the discriminating result became available. The original experiment-selection comparison was a tie. The new checks confirm the shared rule on the selected fresh cases. No independent dimension or new domain concept was verified.

The historical larger-budget correction cost 931.52 seconds and 3,064 reported tokens for one candidate rule set. The frozen rule set's fresh checks subsequently passed. This is a measured cost for that one scoped correction, not a general cost estimate. There is no defined inference cost per independently verified novel concept because no such concept was admitted. This transfer check required no new model requests and took 0.269 seconds.

The next controlled comparisons are separately specified in the [protocol](Protocol.md): targeted revision versus full response with the same output protocol, and constrained versus free-form output with the same task and budget. They await an independently authored third fixture and frozen inference conditions. Carry claim IDs forward, preserve provenance, and compare semantic scoring independently of parsing.

- [Frozen hypothesis](Frozen-Hypothesis.json)
- [Frozen inputs and hashes](Frozen-Inputs.json)
- [Verification record](verification.json)
- [Prior exploratory follow-up](../Follow-Up/Findings.md)
