# Intellectus research foundation — Phase I
**26 November 2026; internal; design for review.**

## Decision
Build the expansive research backend; qualify, ablate, consolidate, then productize. VS Code packaging is deliberately deferred. Ontology uses the established meaning of structured conceptual knowledge; it is one view of semantic knowledge, not the sole representation. Candor and falsification take precedence over agreement. No claim of general understanding is established.

## Inventory and baseline
- Understanding checkout C:\workspace-Intellectus\Understanding: existing built test suite 181/181 passed, log baseline-understanding.log. This is a run of compiled tests, not a fresh source build. Journal supports one writer, transactions, replay and derived-assertion retraction. Existing schema admits PARSED, OBSERVED, DECLARED, RECORDED, INFERRED and NONE/HUMAN/REPLAY/PROOF verification. Its relation vocabulary is closed. Do not silently repurpose it.
- Witness 1.0.21 exposes boundary recording, comparison, instrumentation and governance/verification interfaces. DeepTest 1.0.21 is a VS Code-oriented consumer; its headless integration is to be qualified, not assumed. Complexity 1.0.21 is available; existing metric definitions preserved.
- RT-2 OSGi bundles provide an actual language-service and snapshot-store proof, not a production journal integration. Karaf lifecycle can be reused under local-only settings.
- Colibri checkout C:\workspace\colibri is version 2.1.0, upstream JustVugg Apache-2.0 runtime. Local docs/api.md describes one loaded model process, OpenAI-compatible GET /v1/models and POST /v1/chat/completions, GET /health, usage counts, temperature and completion budgets; docs/cluster.md describes specific routed-expert cluster modes, not a generic committee scheduler. Local qwen36-35b directory contains 41 safetensors totaling 23,018,430,392 bytes. Presence is not proof of usable weights or inference performance. No executable was found directly in c or runtime. No server started, no model downloaded, no external inference sent. Hardware CIM queries denied; capacity remains unverified. Java 17.0.20.1, Node 22.23.2, Python 3.14.2 present.
- Current source roots read only; design and future prototypes use C:\workspace\Intellectus-Cognition. historical-manifest.json records current hashes for selected prior artifacts; it is a prospective preservation check, not proof every artifact matches its original frozen manifest.

## Architecture contracts (proposal)
~~~mermaid
flowchart TD
 A[Investigation contract] --> B[Coordinator]
 B --> C[Seven independently provisioned specialists]
 C --> D[Evidence and candidate claims]
 D --> E[Reconciliation and verification]
 E --> F[Understanding journal]
 F --> G[Ontology and other semantic views]
 F --> B
~~~

### Observation contract
A contract identifies the phenomenon, allowed inputs and environment, observable outputs/effects, termination and ordering expectations, and explicitly unobserved details. It is not the oracle. A deterministic finite-domain pure-function contract is the first supported case, not the universal model. An independent oracle remains sequestered from discovery.

### Claim envelope
- claim ID, schema version, subject ID, contract ID, kind (observation / structural fact / inferred relation / declared requirement / domain expectation), representation type/version and payload.
- immutable artifact references, producer and method version, evidence scope, assumptions, dependencies and counterexample links.
- status (proposed / supported / verified within scope / contradicted / unresolved), verification record with checker identity/version, scope, result and evidence. No confidence value can substitute for verification.
- revision/supersession links; append history rather than overwrite. Claim identity and evidence identity are distinct; repeated claims do not manufacture independence.

Separate behavioral identity (observable mapping under contract), structural identity (existing IR fingerprint), and domain identity (documented concept, context, applicability). Compare the same scope only. An exact ordered finite mapping can be a reference identity, but a discovered compact relationship is a distinct representation whose equivalence must be checked. A universal canonical semantic fingerprint is not assumed.

### Specialist boundary
Interface: capability descriptor (methods, version, supported scopes, resource profile), investigate(question, evidence references, budget) -> evidence packets and proposed claims. Every specialist independently testable and switchable. Structural, Behavioral, Causal, Mathematical, Conceptual, Domain, Skeptic all included in full architecture, with deterministic algorithms where appropriate. Colibri inference is behind an explicitly configured port; no automatic external fallback.

### Reconciliation
~~~mermaid
sequenceDiagram
 participant C as Coordinator
 participant S as Specialists
 participant V as Independent verifier
 participant U as Understanding
 C->>S: Scoped question
 S-->>C: Independent evidence and claims
 C->>V: Candidate and conflicts
 V-->>C: Verified, contradicted or unresolved
 C->>U: Append result and dissent
~~~
Compatible evidence can be combined; valid counterexamples defeat consensus. Model outputs remain hypotheses without independent support. An authoritative business requirement and contrary observed behavior coexist; neither erases the other. No automated changes to software from a proposed claim.

### Colibri
Reuse actual HTTP endpoint, model/version configuration, completion budget and usage metadata. Add an Intellectus-side bounded job queue and telemetry if needed. One resident model first, role-specific contexts, then compare independently hosted models and adapters. Measure time, memory, CPU/GPU, disk I/O, queue wait, cost per newly verified relationship and knowledge reuse. No cloud purchase until local benchmark and explicit provider selection.

## Experiments and reduction
RT-5 equivalent implementation convergence; RT-6 blind discovery; RT-7 committee comparison; RT-8 contextual domain contribution; RT-9 false consensus rejection; RT-10 reuse; RT-11 synthesis; RT-12 cross-representation equivalence; RT-13 sharding; RT-14 scale. These are candidate sequence labels, not frozen protocols. Each requires a narrow question, independent oracle, negative controls, preregistered metrics, held-out cases, and preserved artifacts. Compare full and ablated configurations after qualification; test interactions rather than assuming one-at-a-time removal establishes necessity. Product packaging follows consolidation.

## Draft RT-5 protocol for owner review
Question: Can structurally distinct implementations of the same finite, pure behavior converge on a shared semantic identity? Use independently written redundant and direct implementations over randomly assigned opaque IDs, plus different-obligation and late-difference controls. Exact fixtures, expected results and random seed must be frozen before execution. Discovery receives the declared input domain and observations, not target formula or independent oracle. Independent verifier evaluates full domain against frozen oracle. Record exact representation, canonical behavioral identity, structural fingerprints, unresolved claims, counterexamples and time/resources. All equivalent controls must match behavioral identity; differing controls must not; no incorrect claim may be elevated to verified. Include a comparison of deterministic-only and full committee, with full qualification in RT-7; retain evidence even if AI adds nothing. No RT-5 execution until concrete protocol reviewed and frozen. No existing report or implementation modified.

## Next
1. Review this foundation and finalize specific RT-5 fixtures and protocol.
2. Implement separately versioned claim contract and persistence compatibility tests.
3. Implement seven modular specialist adapters and coordinator; test independently and in combination, including Colibri serving qualification.
4. Run frozen experiments; ablate only after full architecture results are measured.
