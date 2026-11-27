# P3 and P4 research record

To reproduce these runs, complete the [shared environment setup](../ProjectDocumentation/experiment-setup.md), then follow the [P3 commands](P3/Run.md) or [P4 commands](P4/Run.md).

## P3 — Deliberative correction

[Aim and protocol](P3/Protocol.md) · [Windows reproduction](P3/Colibri-Runbook.md)

P3 tested whether a specialist can revise a claim after a counterexample without discarding a valid claim. Each run used 12 bounded integer cases: four repairable affine claims, four boundary exceptions requiring withdrawal, and four correct retention controls. The model and deterministic control received the same seeded claims and disclosed observations. Verification used the complete 25-point oracle for each case. The deterministic control achieved all 12 expected outcomes, and fixture execution agreed with the oracle on all 300 input pairs.

| Run | Verified repairs | Justified withdrawals | Correct retentions | Request time |
| --- | ---: | ---: | ---: | ---: |
| [Run 01](P3/Run-01-Findings.md) | 1/4 | 0/4 | 0/4 | 278.196 s |
| [Run 02](P3/Run-02-Findings.md) | 0/4 | 3/4 | 2/4 | 735.702 s |
| Qualification threshold | 3/4 | 3/4 | 4/4 | — |

Run 01 chose repair in all 12 cases. The [Run 02 amendment](P3/Run-02-Amendment.md) made retain, repair, and withdraw equally explicit while preserving the case packets, verifier, and request limits. Withdrawals and retentions improved, while verified repairs fell to zero. Neither run qualified. No false formula passed the verifier. The deterministic method sets the correctness ceiling for these cases.

Raw evidence: [Run 01](P3/run-01.jsonl), [Run 02](P3/run-02.jsonl), [checkpoint and runtime provenance](P3/run-01-provenance.json).

## P4 — Contribution of domain context

[Protocol](P4/Protocol.md) · [Fixtures](P4/fixtures.json) · [Oracle](P4/oracle.json) · [Scoring rubric](P4/Scoring-Rubric.md)

P4 tested whether domain documents add a verifiable business interpretation to an otherwise ambiguous computation. Four calculations each had two supported meanings and one misleading control. The code and observations were identical within each calculation. Each pilot attempted 24 requests, with and without context for each case. Preflight checked 60 behavioral observations, including held-out examples. The deterministic baseline establishes the arithmetic and leaves domain meaning unknown. It does not interpret the context documents.

| Pilot | No-context abstentions | Intended supported interpretations | Strict verified claims | Correct misleading-control abstentions | Request time |
| --- | ---: | ---: | ---: | ---: | ---: |
| [Pilot 01](P4/Pilot-01-Findings.md) | 12/12 | 7/8 | 0/8 | 2/4 | 770.433 s |
| [Pilot 02](P4/Pilot-02-Findings.md) | 12/12 | 8/8 | 0/8 | 3/4 | 1,627.273 s |

The [follow-up amendment](P4/Follow-Up-Amendment.md) clarified the entity, unit, and applicability fields in Pilot 02. Both pilots retained the same cases and scoring rules. The response-level interpretations improved, but in every supported case the entity field still named a formula, flag, or result instead of the business item or record. The intended-interpretation count is a diagnostic reading of the complete response. The strict score is the qualification measure. Both pilots were exploratory and lacked independent review. P4 remains unqualified.

Raw evidence: [Pilot 01](P4/pilot-01.jsonl), [Pilot 02](P4/pilot-02.jsonl).

## Changes and open decisions

- Implemented the P3 verification runner, Colibri reproduction runbook, P4 paired-condition runner, and pilot evidence capture. Retained original artifacts and scored both follow-ups separately.
- Tested the P3 action-instruction change and P4 field-definition change. Both improved some outcomes without passing their qualification gates.
- Proposed replacing P4's ambiguous entity field with a business-record field and requiring a literal quote plus a document ID. A deterministic check would verify the quotation, and the scorer would judge whether it supports the claim. This schema and check have yet to be implemented or tested.
- Proposed clarifying C09's shared flag mapping before independent review. The original control remains in both pilot records.
- Any future fine-tuning comparison should train on separate examples and evaluate base and tuned models against the same unseen cases, including misleading context and abstention. No fine-tuning has been performed for these trials.
