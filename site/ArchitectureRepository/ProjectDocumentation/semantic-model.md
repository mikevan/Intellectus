# Flow-based semantics and temporal ontology

## Research status
RT-1 through RT-4 used a language-neutral intermediate representation that retained implementation structure. Those experiments demonstrated reconstruction within their declared obligations and motivated the move toward implementation-independent semantics.

The flow-based model and temporal ontology below describe the proposed research direction after RT-4. RT-5 remains a draft experiment designed to test whether implementations with equivalent behavior converge on the same semantic representation under a declared contract.

## Meaning before implementation
A flow-based semantic model describes what happens, why it happens, under what conditions, and in what temporal relationship to other events. A temporal ontology represents concepts and relationships whose applicability or truth may depend on state, events, time or ordering.

## Proposed conceptual vocabulary
| Concept | Example |
|---|---|
| Purpose | Reserve stock for an accepted order |
| Actor or entity | Customer, order, inventory item |
| Event | Reservation requested |
| State | Available, reserved, fulfilled |
| Temporal relationship | Reservation precedes fulfillment |
| Guard | Requested quantity is available |
| Effect | Available quantity decreases |
| Invariant | Stock cannot fall below zero |
| Obligation | Rejected requests leave inventory unchanged |
| Evidence | Test result or observed trace with provenance |

A flow may be expressed through a state machine, mathematical relation, causal graph or temporal constraints. The ontology relates these views without requiring one universal executable notation. An implementation's internal loop or temporary variable is not necessarily part of semantic identity; observable ordering, timing and side effects may be.

## Claims and provenance
Each claim identifies its subject, contract, representation version, assumptions, evidence, counterexamples, status and revision history. Distinguish observed behavior, declared requirements, inferred intent and domain expectations. Verified claims require independently reproducible evidence. A hash is not proof of unrestricted equivalence.
