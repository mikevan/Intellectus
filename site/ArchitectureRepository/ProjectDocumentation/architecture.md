# Architecture: complementary methods of knowing

Think of a group examining an unfamiliar machine. Some inspect the parts, some watch it work, some propose explanations, and others test whether those explanations hold up. Intellectus combines these different methods rather than trusting one person's answer.

[Specialist architecture](architecture.svg)

The research architecture separates evidence acquisition, candidate interpretation, independent verification and persistent knowledge. The proposed seven-specialist architecture is not a claim that every role is fully integrated or necessary.

| Specialist | Execution | Contribution |
|---|---|---|
| Structural | Deterministic | AST, call graphs, control flow, MBCC and reachable relationships |
| Behavioral | Deterministic | Instrumentation, Witness and DeepTest where qualified; observed state and outcomes |
| Mathematical | Deterministic | Exact calculation, symbolic relations and formal checks |
| Causal | Hybrid | Propose dependencies and test them with controlled variation |
| Skeptic | Hybrid | Challenge claims, propose disconfirming observations and verify evidence |
| Conceptual | AI-driven | Candidate abstractions, compositional relationships and emergent capabilities |
| Domain | AI-driven | Interpret independently supplied context and declared obligations |

Three deterministic, two hybrid and two AI-driven roles. Colibri supplies local inference when needed. Purpose-trained SLMs and adapters remain research options; no successful training is asserted. Measure contribution and ablate before consolidating.

## Evidence over agreement

A model may propose a claim but cannot verify it merely by reporting confidence or agreement. Preserve independent evidence, contradictions, assumptions, restrictions and revisions. Separate structural identity from behavioral identity and independently established purpose.

## Knowledge independent of the investigator

Understanding retains qualified knowledge separately from the model or adapter that discovered it. Multiple views may represent a relationship: mathematical, behavioral, causal, structural or ontological. No universal representation is assumed. Karaf/OSGi lifecycle was demonstrated on restricted historical experiments; complete production orchestration remains unqualified.

[Semantic model](semantic-model.md) · [Software modules](projects.md) · [Research vision](vision.md)
