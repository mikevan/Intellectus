# Intellectus — Architecture and Implementation Plan
## Evidence-grounded computational cognition, supported by Colibri

**Prepared for:** Michael Van Geertruy, Project Revive Solutions, LLC  
**Date:** November 25, 2026 (Central time)  
**Status:** Architecture proposal for review; roadmap not yet executed. Internal research.

## Executive summary

RT-1–4 demonstrated cross-language structural reconstruction, controlled optimization, and, in RT-2–4, OSGi service lifecycle and independent snapshot persistence. However, the existing IR retains implementation details even when they do not influence the required outcomes. The central finding was language independence without implementation independence.

Intellectus will investigate a different model: a committee of heterogeneous specialists that observes computation, discovers and tests relationships, considers domain context, and retains qualified collective knowledge. Deterministic algorithms provide repeatable evidence; specialized AI supplies interpretation and hypothesis generation; neither a model's confidence nor a committee vote establishes truth. Colibri supplies self-managed SLM inference capacity, initially locally and potentially on a rented NeoCloud host. This replaces reliance on metered external API inference with measured compute scheduling. No cloud purchase, hosting migration, or production implementation is authorized by this document.

Design principle: **Discover what is being accomplished before deciding how to implement it.**

## 1. Architecture at a glance

~~~mermaid
flowchart TD
  A[Source and declared requirements] --> B[Intellectus investigation coordinator]
  B --> C[Deterministic specialists]
  B --> D[AI-supported specialists]
  D <-->|Inference requests| E[Colibri]
  C --> F[Evidence reconciliation]
  D --> F
  F --> G[Understanding knowledge journal]
  G --> H[Verified semantic views]
  H --> I[Implementation synthesis]
  I --> J[Language-specific expression]
  J --> K[Independent verification]
  K -->|New evidence| G
  G -->|Relevant prior knowledge| B
~~~

The architecture separates the phenomenon being investigated, its representations, the claims derived from it, and any subsequent implementation. The original structural IR remains useful but is not the authoritative identity of computational meaning.

## 2. Architectural responsibilities

| Component | Role | Status |
|---|---|---|
| Intellectus / Karaf | Capability discovery, service lifecycle, investigation scheduling and coordination | Karaf service proof demonstrated; new coordinator proposed |
| Understanding | Evidence, qualified claims, relationships, revisions, provenance, knowledge reuse | Existing journal and IR baseline; redesigned semantic layer proposed |
| Linguistic adapters | Language-specific interpretation and expression; legacy IR retained as structural evidence | Python/TypeScript experiments demonstrated on narrow fragments |
| Witness | Instrumentation and runtime evidence | Existing component; integration scope to qualify |
| DeepTest | Exercise declared behaviors and produce test-attributed evidence | Existing component; new integration proposed |
| Complexity | Analyze generated or existing implementation structure | Existing measurements used in RT-1–4 |
| UntangleIt | Potential consumer of verified semantic knowledge for refactoring | Existing product; later integration |
| Lexicon&lt;Domain&gt; / Lexicon&lt;Framework&gt; | Versioned reference knowledge supplied to investigators | Proposed provisioning boundaries; do not claim all packs exist |
| Colibri | Model-serving and inference boundary for local or hosted SLMs | Existing architecture referenced by owner; concrete interfaces and capabilities require inspection |
| NeoCloud | Optional rented infrastructure for Colibri | Provider, CPU/GPU and budget not selected |

## 3. The committee of Understanding

~~~mermaid
flowchart TD
  A[Investigation contract] --> B[Independent evidence gathering]
  B --> C[Structural and behavioral]
  B --> D[Causal and mathematical]
  B --> E[Conceptual and domain]
  C --> F[Claim reconciliation]
  D --> F
  E --> F
  F --> G[Skeptic and verification]
  G -->|Counterexample| B
  G -->|Qualified conclusion| H[Understanding]
~~~

Specialists differ in their *method of knowing*, not merely in role prompts. Each publishes an independent evidence packet before deliberation when practical. They can share prior factual context without seeing one another's initial conjectures. Shared model weights and common evidence create correlated failure, so independence is explicitly measured rather than assumed.

| Specialist | Method | Typical execution | Produces |
|---|---|---|---|
| Structural Analyst | Language-aware static analysis | Deterministic | Control-flow evidence, call/def-use relationships, known limitations |
| Behavioral Observer | Runtime observation | Deterministic Witness/DeepTest | Inputs, outputs, side effects, trace attribution |
| Causal Investigator | Controlled variation of inputs and environment | Deterministic experiment selection with optional SLM interpretation | Intervention evidence, conditional dependencies, counterexamples |
| Mathematical Analyst | Denotational relations, symbolic regression, algebraic verification | Deterministic solvers, optional SLM conjectures | Candidate relations, assumptions and proof/test evidence |
| Conceptual Analyst | Abstraction and transfer | Colibri-hosted SLM | Candidate concept clusters, analogies, alternative descriptions |
| Domain Analyst | Business context and obligation interpretation | Colibri SLM + versioned Lexicons | Domain hypotheses, relevant obligations, ambiguities, questions |
| Skeptic | Falsification, independent tests, bounded formal reasoning | Deterministic first, SLM as hypothesis generator | Counterexamples, coverage limitations, qualified status |

A committee is assembled for a question, not permanently activated for every function. The deterministic specialists may be sufficient. No agent gets to declare its own claim verified merely because it produced it.

## 4. Grounding and knowledge acquisition

~~~mermaid
flowchart TD
  A[Observe phenomenon] --> B[Record evidence]
  B --> C[Form competing hypotheses]
  C --> D[Select discriminating experiment]
  D --> E[Observe result]
  E --> F{Contradiction?}
  F -->|Yes| G[Revise or reject hypothesis]
  G --> C
  F -->|No| H[Verify scope and limitations]
  H --> I[Retain qualified claim]
  I --> J[Reuse with applicability check]
~~~

The research draws on symbol grounding, developmental robotics, causal discovery, comparative cognition, cognitive architectures, symbolic regression and denotational semantics. Its distinctive hypothesis is that heterogeneous, evidence-producing methods can converge on reusable relationships that survive changes of implementation and representation.

Initial experiments are deliberately limited to pure functions and finite declared input domains. No claim of universal understanding or full equivalence for arbitrary programs is warranted. Observation alone cannot identify inaccessible states or human intentions. New beliefs retain explicit limitations and unknowns.

### Multiple ways to represent knowledge

~~~mermaid
flowchart TD
  A[Scoped phenomenon identity] --> B[Evidence and provenance]
  A --> C[Input-output relation]
  A --> D[State or causal view]
  A --> E[Domain concept view]
  A --> F[Structural implementation view]
  B --> G[Claims and applicability]
  C --> G
  D --> G
  E --> G
  F --> G
~~~

A mathematical function, set relationship, state-transition system, temporal constraint or probabilistic claim may each be appropriate for different phenomena. We do not require one universal executable representation. A typed claim envelope makes these views interoperable without asserting that they are identical. The initial finite-domain relation is an experimental semantic view, not a universal schema.

## 5. Evidence and consensus protocol

### Knowledge record (conceptual contract, not final schema)

| Field | Purpose |
|---|---|
| Investigation ID, subject and scope | Identify the phenomenon, version, domain and observations considered |
| Evidence reference | Immutable artifact ID/hash, producer, acquisition method, timestamp |
| Assertion ID and type | Observation, inferred relationship, declared obligation, domain expectation, structural fact |
| Representation and schema version | Mathematical relation, graph, structural IR, or other registered view |
| Assumptions and observability | Input domain, effects, termination, ordering, environment, API contract |
| Support and contradiction references | Link the claim to evidence; retain opposing interpretations |
| Status and justification | Proposed, observed, supported, verified within scope, contradicted, unknown |
| Derivation and revision links | Trace inference, retraction, supersession and relevant evidence |
| Identity | Separate structural fingerprint, behavioral identity scoped to contract, and source provenance |

A hash of a representation is not a proof of equivalence. A canonical encoding is only meaningful within a specified equivalence relation and schema. For the first finite-domain experiment an ordered mapping from all allowed inputs to observable results can provide a reproducible behavioral identity; later domains require other techniques.

### Deliberation sequence

~~~mermaid
sequenceDiagram
  participant C as Coordinator
  participant S as Specialists
  participant R as Reconciler
  participant V as Verifier
  participant U as Understanding
  C->>S: Scoped question and evidence
  S-->>R: Independent claims and evidence
  R->>V: Conflicts and proposed conclusions
  alt Valid counterexample
    V-->>R: Contradiction with evidence
    R->>S: Targeted follow-up question
  else Checks satisfied
    V-->>R: Qualified verification result
    R->>U: Append claim and provenance
  else Insufficient evidence
    V-->>R: Named limitations
    R->>U: Record unresolved claim
  end
~~~

Rules:
- Agreement is not proof; a valid counterexample outweighs any number of votes.
- Reconcile only claims with compatible scopes and observation contracts.
- Separate actual behavior, inferred intent, independently declared requirements, and domain expectations. Contradictions are findings, not instructions to change code.
- Preserve independent evidence and dissent. Repeated AI opinions are not independent observations.
- Bounded investigative rounds and compute limits end with an explicit unresolved result, not an invented consensus.
- Only a deterministic verifier or a reproducible evidence check can elevate a claim to the corresponding verified status. Human review resolves business intent that cannot be inferred.
- No unauthorized code modification follows from a claim.

## 6. Business context and the Domain Analyst

~~~mermaid
flowchart TD
  A[Source names, evidence, documents] --> B[Domain Analyst]
  B --> C[Candidate business domains]
  C --> D[Selected Lexicons]
  D --> E[Domain obligations and questions]
  E --> F[Committee investigation]
  F --> G[Behavior and declared intent]
  G --> H[Agreement or discrepancy]
  H --> I[Understanding]
~~~

Accounting, legal, construction and project-management contexts are concrete examples. More than one domain may be relevant. The domain specialist retrieves only relevant, approved reference material; knowledge bundles record version, jurisdiction, effective date where applicable, provenance and applicability. For sensitive or regulated conclusions, the underlying business owner or qualified expert remains the authority.

For example, an observed multiplication by 0.05 may represent interest, tax, reserve or commission. The numeric relation does not by itself establish the business interpretation. A Domain Analyst proposes possibilities, identifies missing context, and asks the committee to examine rounding, eligibility, timing, and externally documented requirements. It cannot declare a guessed legal obligation to be part of the existing program.

The sharding research remains a separate spike; capability-specific Lexicons are not proof of a successful linguistic-sharding implementation.

## 7. Colibri as inference infrastructure

~~~mermaid
flowchart TD
  A[Intellectus coordinator] --> B[Inference service port]
  B --> C[Colibri gateway]
  C --> D[Queue and resource scheduler]
  D --> E[Model workers]
  E --> F[Local SLM weights]
  E --> G[Optional domain-specific adapters]
  C --> H[Telemetry]
  H --> A
~~~

Intellectus orchestrates investigations; Colibri serves model inference. The actual Colibri interfaces, runtime engines, model format support, authentication and existing scheduler capabilities must be inventoried before implementation. The gateway, queue, worker model and telemetry shown are required target capabilities if not already present, not assertions about today's implementation.

Design the inference port to accept an explicitly selected model/configuration and bounded prompt, evidence references, deadline, maximum output and correlation ID. Return structured response, model version, elapsed time, input/output tokens if available, compute measurements, and status. A local mock or actual Colibri endpoint can be selected by configuration. Do not permit automatic external API fallback. Reuse a base SLM with role-specific prompts or optional adapters initially; separate fine-tuning only when evaluation justifies it.

Candidates should return structured claims, evidence references and questions rather than long free-form transcripts. Validate outputs against the evidence envelope. Model output is not evidence of program behavior by itself.

## 8. Deployment topology and economics

~~~mermaid
flowchart TD
  A[Developer workstations] --> B[Local Intellectus]
  B --> C[Local Understanding]
  B --> D[Authenticated Colibri endpoint]
  D --> E[NeoCloud compute host]
  E --> F[Queued SLM workers]
  E --> G[Model storage]
  E --> H[Resource metrics]
  I[Other authorized PRS applications] --> D
~~~

Keep source execution, Witness and private evidence collections local initially. Send only the scoped material needed by an approved inference request. The rented server hosts the inference service, not arbitrary project execution. Authentication, encrypted transport, restricted network exposure, per-client quotas, isolation of request state and documented retention are deployment requirements. Do not expose anonymous model endpoints. No standing requirement for a public-facing Karaf SSH service.

CARES currently consumes Render resources without revenue, per Michael. Treat that spend as a candidate funding envelope, not a verified amount or commitment to cancel CARES. Before changing hosting, inventory Render costs, storage, remaining obligations, backup/export and restoration options. Compare CPU-only, GPU-on-demand and fixed-capacity offers against measured Colibri workloads; choose only after actual latency, throughput, RAM/VRAM and total monthly compute/storage/network cost are known.

A CPU-hosted SLM may be suitable for some roles, but inference performance depends on model size, quantization, workload and hardware; GPU may be more economical at higher throughput. Do not assume CPU is always the optimal choice.

~~~mermaid
flowchart TD
  A[New investigation] --> B{Applicable qualified knowledge?}
  B -->|Yes| C[Check assumptions]
  B -->|No| D[Deterministic specialists]
  C -->|Applicable| E[Return evidence-backed result]
  C -->|Not applicable| D
  D --> F{Unresolved question?}
  F -->|No| G[Verify and retain]
  F -->|Yes| H[Colibri SLM work queue]
  H --> G
  G --> E
~~~

### Scheduling and measurement

- Queue only unresolved or materially changed questions; deduplicate equivalent queued work.
- Allocate concurrent slots using available RAM/VRAM and measured throughput, not arbitrary agent count.
- Share model residency where compatible. Use batching where the inference engine supports it.
- Use job deadlines, cancellation, bounded retries and queue backpressure.
- Cache exact inference artifacts by model version, role configuration, evidence scope and input hash. Reuse verified claims only after applicability checks; distinguish inference caching from reusable knowledge.
- Track wall time, CPU-seconds, GPU-seconds, peak memory, queue wait, throughput, model-load overhead, storage and actual hosting bill. Tokens remain useful diagnostic counts, not necessarily billed units.
- Primary economics metric: total amortized compute dollars per newly verified relationship; also report number of useful reused relationships, coverage, unresolved rate and verification quality. A result with zero new verified claims has an undefined per-claim cost, not zero.

No provider prices or hardware capacity have been selected. Benchmark before spending. Reuse Colibri for other products only after isolation and resource contention tests; VIXEN or unrelated product features are outside the scope of this implementation plan.

## 9. Expression after understanding

~~~mermaid
flowchart TD
  A[Verified semantic view] --> B[Declared implementation constraints]
  B --> C[Select synthesis strategy]
  C --> D[LinguisticPython]
  C --> E[LinguisticTypeScript]
  D --> F[Generated implementations]
  E --> F
  F --> G[Independent behavioral verification]
  G --> H[Complexity and quality assessment]
  G -->|Counterexample| A
~~~

The expression stage consumes the verified contract, not a rewritten copy of the original executable tree. In a finite pure domain, different source implementations can share the same behavioral identity and still have distinct structural fingerprints. A suitable generator may select a simple implementation directly from the verified relation. Implementation optimization remains optional and separate; it does not change the stable semantic identity when the contract is preserved. A globally minimal implementation is not guaranteed. Exact-source reproduction is a separate capability requiring lexical/structural information.

## 10. Implementation roadmap

The proposed sequence is deliberately incremental. RT-1–4 artifacts and baseline schemas remain frozen. Do not change the existing Understanding IR contract in place without compatibility and migration evidence.

| Phase | Deliverable | Exit evidence | Indicative effort |
|---|---|---|---|
| 0 — Inventory and freeze | Existing component inventory; architecture review; Colibri contract/host inventory; frozen RT-1–4 hashes | Known interfaces, build IDs, dependencies and gaps; confirmed baseline | 1–3 engineering days |
| 1 — Evidence foundation | Versioned observation/claim envelope; separate structural/behavioral identities; persistent append/revise/query behavior | Round-trip storage, provenance and contradiction tests; legacy IR unchanged | 3–6 days |
| 2 — Deterministic committee | Coordinator, Structural/Behavioral/Causal/Mathematical/Skeptic capabilities over pure bounded fixtures | Independent evidence packets, counterexample handling, no-LLM baseline | 5–10 days |
| 3 — Colibri bridge and AI specialists | Configured model port, structured responses, Conceptual/Domain specialists, queue limits, telemetry | Local inference actual run, schema validation, timeout behavior and cost metrics | 4–8 days |
| 4 — RT-5 | Reviewed and frozen protocol, blinded discovery, independent validation and expression | Equivalent implementations converge; negative controls distinguish; reproduce fresh runs | 3–6 days |
| 5 — Domain and persistence qualification | Domain Lexicon pilot, scope/ambiguity cases, journal recovery and dynamic provision | External requirements vs actual behavior separation; restart and recovery evidence | 5–10 days |
| 6 — NeoCloud qualification | Host selection from measured workload, private Colibri service, workload and cost benchmark | Throughput/memory/cost/availability measured; local operation still works | 3–7 days |
| 7 — Controlled expansion | Additional representation types, effects, asynchronous behavior, consumer integration, future sharding spike | Each expansion has frozen research gates and qualified evidence | Separate research increments |

Effort ranges are planning estimates, not commitments, and assume one engineer with working dependencies. Phases 0–6 total roughly 24–50 engineering days if performed sequentially; host selection can be researched in parallel without provisioning. Preserve the ability to stop after a failed hypothesis, not push on to production.

~~~mermaid
flowchart TD
  A[0 Inventory] --> B[1 Evidence foundation]
  B --> C[2 Deterministic committee]
  C --> D[3 Local Colibri integration]
  D --> E[4 RT-5]
  E --> F{Research gate passed?}
  F -->|No| G[Record failure and redesign]
  G --> D
  F -->|Yes| H[5 Domain and persistence]
  H --> I[6 NeoCloud qualification]
  I --> J[7 Controlled expansion]
~~~

## 11. Detailed first implementation increments

### Phase 0: establish known interfaces
1. Read the active Intellectus architecture and style manual; record RT-1–4 research result. Snapshot existing test and evidence manifests.
2. Inventory real Understanding, Witness, Complexity, DeepTest, Linguistic and Colibri interfaces. Identify versioned module boundaries; do not infer functionality from names.
3. Identify available local SLM model(s), quantization, runtime, CPU/RAM and optional GPU. Confirm licensing and actual inference compatibility.
4. Draft the new claim/observation contracts and RT-5 protocol for owner review before experiment implementation.

### Phase 1: evidence first
1. Implement a new versioned research namespace adjacent to legacy IR.
2. Introduce immutable evidence references, scoped subject IDs, typed claims, assumptions, provenance and status changes.
3. Implement append-only persistence with separate materialized views; qualify read/recovery, contradiction handling, revision, and unknown outcomes.
4. Implement finite-domain behavioral identity as an initial testable representation: ordered input/output mapping under a declared observable contract, separate from structural hash.
5. Confirm compatible behavior of existing journal consumers; preserve old artifacts.

### Phase 2: deterministic committee
1. Implement a narrow coordinator with explicit specialist discovery, capability descriptors and typed evidence packets.
2. Adapt existing static interpretation and runtime observation; use controlled, harmless pure-function fixtures only.
3. Implement finite-domain experiment selection, relation discovery and exact verification within the supported domain.
4. Add skeptical checks, conflict routing and explicit unresolved states. Compare results against a deterministic-only baseline.
5. Qualify OSGi service activation and knowledge survival independently.

### Phase 3: add AI and Colibri
1. Inspect and adapt Colibri's actual serving contract; use a configurable local endpoint first.
2. Implement two role configurations (Conceptual and Domain) on one available SLM initially.
3. Use structured output, cross-check evidence IDs and retain model/version/configuration. Test malformed replies, hallucinated references and unavailable endpoints.
4. Implement queue limits, resource telemetry, cancellation and exact-request deduplication if not supplied by Colibri.
5. Compare against deterministic-only results; quantify added verified claims, new conjectures, contradiction rate and compute overhead. AI remains a contributor, not a verifier.

### Phase 4: RT-5 discriminating experiment

Draft experiment for review (not frozen). The test must answer a new research question rather than repeat translation.

- Prepare independently authored equivalent implementations of RT-1/RT-2-style pure relations, including deliberately redundant and structurally different versions.
- Blind the discovery specialists to the independent oracle and target relation. The verifier alone receives frozen obligations and held-out challenges. Distinguish observed behavior from source-level evidence.
- Include a variant with different outcomes and one with the same observed samples but differing on an undisclosed allowed input; require discovery or explicit uncertainty. If exact finite enumeration is available, verify all allowed pairs.
- Allow names and opaque IDs to be randomized; compare semantic identity with and without source structure and with different views.
- Compare deterministic-only and hybrid committee arms on the same fixtures, using fixed evidence and compute budgets; measure which genuinely new verified relationships AI contributes.
- Generate two implementations from verified semantic views, not original structural IR. Re-encode/evaluate independently; hold the semantic identity stable while allowing structural fingerprints and Complexity scores to differ.
- Repeat fresh runs and preserve manifests; LLM outputs may vary, so compare verified conclusions and evidence, not necessarily identical model prose.
- Reject forced agreement; uncertainty or a contradiction is an honest outcome. If no semantic convergence is achieved, redesign again before RT-6.

~~~mermaid
flowchart TD
  A[Equivalent programs with different structures] --> B[Blinded committee]
  C[Different-obligation controls] --> B
  B --> D[Candidate semantic views]
  D --> E[Independent holdout and exhaustive checks]
  E --> F{Equivalent views converge?}
  F -->|Yes| G[Generate Python and TypeScript]
  F -->|No| H[Record failed hypothesis]
  G --> I[Verify outcomes independently]
~~~

### Phases 5–7: scale only after the result is understood
Pilot accounting or project-management context using synthetic records and independently declared requirements. Test ambiguity, conflicting domain evidence and versioned Lexicons. Then qualify persistence across Understanding and container restarts. Benchmark Colibri on local CPU before testing a rented compute instance; compare actual total cost and capacity. Migrate neither CARES nor other PRS systems until there is backup/recovery evidence, a workload match and an owner decision. Extend semantic coverage one class at a time; keep linguistic sharding as a separate spike.

## 12. Acceptance register and risk management

| Risk | Design response | Evidence |
|---|---|---|
| Another intermediate language masquerades as semantics | Separate semantic and structural identities | Equivalent divergent implementations converge; negatives distinguish |
| Committee echo chamber | Independent methods, controlled evidence, counterexample priority | Inject false majority claim and require rejection |
| False confidence from sparse samples | Scoped verification, held-out challenge and abstention | Unobserved counterexample detected or uncertainty retained |
| Domain interpretation mistaken for facts | Typed claims and source provenance | Conflicting business hypotheses remain distinct |
| Expensive inference | Reuse, local SLMs, bounded scheduling, benchmark | CPU/GPU seconds and cost per accepted relationship |
| Storage loses knowledge | Append-only records, recovery and versioned migration | Restart/recovery and reproducibility evidence |
| External dependency or network exposure | Configured private endpoint, local-first runtime | Local and hosted isolation tests; no silent external fallback |
| Unbounded or poor-quality model replies | Validated response schema, evidence checks and deadlines | Invalid claims rejected, deterministic operation remains available |

## 13. Decision log and next deliverables

Established direction from conversation:
- Implementation-independent understanding, before implementation choices.
- Hybrid specialist committee, deterministic algorithms plus AI; business Domain Analyst and Lexicons.
- Colibri-hosted SLMs; explore redirecting existing infrastructure expenditure rather than per-token API dependence.
- Preserve completed round-trip experiments; redesign before RT-5.

Proposed, not yet established:
- Claim envelope, initial finite-domain behavioral view, exact consensus protocol, role configuration, inference queue mechanics, deployment and hosting choice.
- RT-5 protocol and acceptance criteria above.
- Later sharding and expansion.

Next review deliverables: component and Colibri inventory, contract design, and revised frozen RT-5 protocol. **Do not order cloud capacity or execute RT-5 yet.** This architecture and plan are design artifacts, not completed engineering work.

## References
- Intellectus-Style-Manual.md, prospective semantic-model decision.
- Intellectus-RT-1-4-Research-Summary.md and original RT-1–4 reports.
- Intellectus-Linguistic-Sharding-Spike.md.
- Harnad (1990), The Symbol Grounding Problem: https://doi.org/10.1016/0167-2789(90)90087-6
- Steels, The Talking Heads Experiment: https://langsci-press.org/LangSci-Press/catalog/book/49
- Spelke and Kinzler, Core Knowledge: https://doi.org/10.1111/j.1467-7687.2007.00569.x
- Soar architecture: https://soar.eecs.umich.edu/soar_manual/02_TheSoarArchitecture/
- ACT-R: https://act-r.psy.cmu.edu/
- Causal models and interventions: https://plato.stanford.edu/entries/causal-models/
- AI Feynman: https://arxiv.org/abs/1905.11481
- Syntax-guided synthesis: https://sygus-org.github.io/
- Meta V-JEPA 2: https://ai.meta.com/vjepa/

