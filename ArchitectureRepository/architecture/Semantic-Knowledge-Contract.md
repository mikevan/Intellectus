# Intellectus semantic knowledge and specialist contracts
**Status:** Proposed Phase I design for review; not an implemented schema.

## Purpose
RT-1â€“4 showed language neutrality without implementation independence. The redesigned semantic model characterizes observable relationships and obligations; an ontology, mathematical expression, or behavioral table is a representation of such knowledge. The legacy IR remains structural evidence, not the identity of meaning. The seven-specialist research backend is built before ablation or VS Code productization. Cognition remains a reserved candidate library-family name, not an assigned component.

## Distinct identities
- Artifact ID: SHA-256 of exact artifact bytes, for provenance.
- Subject ID: opaque identifier for a specific implementation/version.
- Contract ID: digest of a canonical observation contract (types, admissible inputs, observable channels, termination, effects, environment assumptions). It excludes source syntax and expected results.
- Behavioral identity: digest of contract ID plus canonical, complete ordered observations for a supported finite domain. It is not a universal equivalence test. An incomplete observation set yields evidence only, never a complete behavioral identity.
- Claim ID: stable hash of subject, scope, claim kind, representation and payload; evidence and status events attach separately.
- Domain concept identity: separately grounded in business context; identical behavioral identity does not establish identical intent.

For the initial pure integer domain, serialize a record as UTF-8 JSON with explicit schema/version, normalized decimal integer strings, ordered input tuples and return values. Hash with SHA-256. Sorting is by numeric tuple order; reject duplicates, omissions, out-of-domain values, failures of the observation contract, and noncanonical integers. Source, filenames, language, timestamps and implementation IDs are excluded from behavioral identity. Store canonical bytes and digest; compare bytes as well as hashes. For other scopes, register separate representation and verifier adapters rather than silently extending this rule.

## Proposed exchange contract
| Record | Required contents |
|---|---|
| Investigation | ID, subject, contract, question, allowed evidence, enabled capabilities, budget |
| Artifact | digest, format, origin, producer version, byte size, sensitivity classification |
| Observation | subject, contract, input, outcome/event, run ID, artifact digest, acquisition method |
| Claim | ID, subject, contract, kind, representation type/version, payload, assumptions, dependencies, evidence links |
| Verification | claim ID, checker ID/version, scope, result, evidence and counterexample if any |
| Decision | claim ID, prior event, status, justification, verifier/dependency links |
| Specialist descriptor | capability ID/version, supported scopes, method, input/output schemas, resource limits |
| Specialist response | evidence references, candidate claims, unanswered questions, resource usage, completion status |

Kinds distinguish observed fact, structural fact, inferred relationship, declared obligation and domain expectation. Status is orthogonal: proposed, supported, verified-in-scope, contradicted or unresolved. A declaration can be authoritative as a requirement without proving actual software conforms. An observation is evidence, not an inference. A mathematical claim is verified only against its stated domain and assumptions. No confidence score or majority vote promotes a claim.

## Lifecycle
~~~mermaid
flowchart TD
 A[Observation contract] --> B[Independent evidence]
 B --> C[Candidate claim]
 C --> D{Independent check}
 D -->|Supported within scope| E[Verified claim]
 D -->|Counterexample| F[Contradicted claim]
 D -->|Insufficient| G[Unresolved claim]
 F --> H[New hypothesis]
 G --> H
 H --> C
~~~
Append immutable evidence and status events to a new versioned research namespace. Use a single reconciler/writer; no agent directly modifies the authoritative projection. Preserve both sides of conflicts. If a supporting dependency is contradicted or superseded, mark dependent conclusions for reassessment and remove them from the verified projection until rechecked. Qualify persistence and replay against the existing Understanding journal instead of modifying its closed relation vocabulary prematurely.

## Specialist collaboration
All specialists implement the same exchange boundary but use different methods. Structural and Behavioral acquire distinct evidence; Causal chooses discriminating benign interventions; Mathematical proposes relations; Conceptual proposes abstractions; Domain examines business evidence and Lexicons; Skeptic challenges claims. Record evidence dependencies and shared model identity to prevent double-counting consensus. A model cannot appoint itself verifier. Initial independent packets are sealed before deliberation. Reconciliation combines compatible claims, routes disputes, and preserves unresolved states. Deterministic verification is independent of the discovery path.

Colibri is a configured inference service, not the coordinator or knowledge authority. Inventory documented HTTP serving contract, actual model availability and compute before running. Structured responses contain claims, evidence references and questions; validate all references. Measure time, resource use and added verified knowledge. No automatic external provider substitution. Full research configuration is required for qualification; ablation follows later.

## Scope of implementation
These are proposed contracts, not a new universal vocabulary or proof of representation-independent understanding. The finite mapping is a reference representation, not the desired complete model. The critical next challenge is deriving compact relationships that generalize, then independently validating them. Preserve structural/lexical evidence for exact reconstruction and source attribution. Observable interface names, ordering and effects are semantic if the contract includes them.
