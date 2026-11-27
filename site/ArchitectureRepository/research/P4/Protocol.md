# P4 domain contribution

**Status:** Draft for approval. Freeze artifacts and scoring before inference.

## Research question

Can a specialist combine observed behavior and independently authored domain evidence into an accurate claim about what a computation means? The same arithmetic can represent different business rules. P4 measures whether context resolves that ambiguity and whether the specialist abstains when the evidence is insufficient or inconsistent.

## Cases

Use 12 synthetic cases built from four behavioral forms. Candidate forms include a bounded difference, a capped amount, a threshold flag, and a rounded allocation. Give each form three domain scenarios with identical code and input/output observations within the form. Use two scenarios with authoritative context that supports distinct interpretations and one control with plausible misleading context. Across the four controls, use two unresolved conflicts and two contradicted interpretations. No real business or personal data is required.

For supported cases, split evidence across two documents. A data dictionary maps input labels and units to domain entities. A domain rule specifies when the result applies. Require the interpretation to connect both documents to observed behavior. For misleading controls, require abstention from the proposed interpretation and identification of the missing link, conflict, or counterexample.

Write the context independently of the implementation. Have a separate reviewer freeze the expected structured claim, permitted evidence IDs, and verification examples before collecting model responses. Keep expected answers out of prompts.

## Proposed case matrix

Use the same implementation and evidence of behavior for all three scenarios in each row. Expose neutral labels x and y. Author a separate data dictionary and rule document for each scenario. Keep the names below in the review material.

| Shared calculation | Supported scenario A | Supported scenario B | Misleading control |
| --- | --- | --- | --- |
| max(0, x - y) | Warehouse units still owed after fulfillment | Training hours still required after completed hours | Conflicting approved dictionaries reverse the roles of x and y |
| min(x, y) | Eligible reimbursement capped at a policy limit, in cents | Shipment quantity limited by available units | A plausible draft rule specifies the larger amount, contradicted when x differs from y |
| 1 when x is at least y, otherwise 0 | Training assessment meets the passing score | Inventory reaches the replenishment trigger | Two equally authoritative documents disagree about the action a true result triggers |
| Round down x multiplied by y divided by 100 | Whole cents allocated from an eligible balance at an integer percentage | Whole units reserved from planned production at an integer percentage | A plausible rule claims rounding to nearest, contradicted by a fractional result above one half |

Include observed inputs that exercise each decision boundary. For the threshold, include x equal to y. For allocation, include a result below one half and one above one half. Reserve additional nontrivial inputs for verification. For unsupported controls, scoring must require the relevant conflict or contradiction and abstention from the unsupported interpretation.

## Independent review

Before seeing model responses, the reviewer checks that each supported claim requires both documents, that identical computations admit both intended domain meanings, and that each misleading control has its documented flaw. Freeze the exact entity, units, result, and applicability expected for each supported case. Record acceptable paraphrases and the evidence identifiers that support them. Freeze the response-scoring rubric and resolve any ambiguity before the run.

## Paired conditions

| Condition | Evidence | Output |
| --- | --- | --- |
| Deterministic behavior baseline | Code and observations | Verified behavior and unknown domain meaning |
| AI without context | Same code and observations | Domain claim or abstention |
| AI with context | Same code and observations plus the case documents | Domain claim with evidence IDs or abstention with reason |

Use fresh context per case and one response per AI condition. Use the same model, decoding budget, and response format in both AI conditions. Shuffle independently with frozen order. Use opaque IDs for cases and evidence.

## Scoring

A verified domain claim must get the entity, unit, meaning of the result, and applicability condition right. The cited evidence must support the claim and the claim must agree with held-out behavioral checks. Paraphrase is allowed. Score supported claims, unsupported claims, valid abstentions, unnecessary abstentions, and invalid responses separately. Blind the reviewer to the condition where feasible. Count every planned response in its denominator.

Proposed qualification requires at least six of eight verified claims in supported cases with context, correct abstention on all four misleading controls, and at least four additional verified claims over the paired AI condition without context. No unsupported domain claim may be promoted as verified. Report results for both AI conditions and the deterministic baseline.

The baseline measures what execution alone establishes. This design measures the contribution of supplying domain evidence to the specialist. It does not compare AI with a deterministic system capable of interpreting the same domain documents.

## Reproduction record

Freeze code, observations, context documents, oracle, evidence IDs, prompts, order, model checkpoint, runtime, and request limits. Save exact artifact hashes and raw responses. Report disagreements and negative findings with per-case evidence. Keep P4 separate from P3 and formal RT-5.
