# Understanding through reconstruction

This is a proposed future synthesis and verification protocol, not the result of RT-1–4. Those experiments used structural IR and did not demonstrate acquisition of a temporal ontology.

Consider an inventory application written in Python that accepts a reservation, checks stock, updates the reserved quantity, and rejects requests exceeding availability. Its semantics include the successful transition, failed-request behavior, stock invariants and ordering of effects.

[Round-trip experiment](round-trip.svg)

1. Acquire ontology A from the original Python application.
2. Generate TypeScript from ontology A alone.
3. In a fresh acquisition context, independently acquire ontology B from TypeScript.
4. Generate Python exclusively from ontology B, without access to the original Python or ontology A.
5. Give an independent verifier both implementations and the separately authored acceptance oracle.

## What constitutes an exact copy?
A successful reconstructed application must fulfill the same declared observable contract: outputs, business rules, state transitions, relevant timing, effects, exceptions and public interfaces. Byte-identical source, comments and internal implementation details are a separate objective. Require evidence for the covered domain; no finite test suite proves unrestricted equivalence.

## Example acceptance cases (illustrative, not experiment results)
| Initial stock | Request | Expected result | Remaining stock |
|---|---|---|---|
| 10 | 3 | Accepted | 7 |
| 7 | 7 | Accepted | 0 |
| 0 | 1 | Rejected | 0 |
| 7 | 8 | Rejected | 7 |

Also test invalid quantities, repeated requests, ordered state changes, and any concurrency or persistence guarantees in the declared contract. Prevent source, oracle and previous ontology leakage into generation. The verifier may access them after reconstruction.
