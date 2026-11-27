# Intellectus Style Manual

**Edition:** Initial working edition — November 25, 2026
**Audience:** Intellectus contributors, experiment designers, and AI collaborators.
**Status:** Standing guidance; distinguish established decisions from proposed implementation details.

## 1. Naming and terminology

| Use | Meaning |
|---|---|
| Intellectus | The overall semantic computing platform and runtime |
| Understanding | The authoritative semantic knowledge and evidence model; not a parser or generic utility library |
| Linguistic adapter | A language-specific interpreter and expression capability |
| LinguisticPython | Python linguistic adapter |
| LinguisticJavaScript | JavaScript linguistic adapter |
| LinguisticTypeScript | TypeScript linguistic adapter |
| LinguisticJava | Java linguistic adapter |
| LexiconAngular, LexiconReact, LexiconVue, LexiconSvelte | Framework-specific reusable knowledge modules |
| LexiconSpringDM, LexiconHibernate | Framework-specific knowledge modules for future development |
| Lexicon<Domain> | A separately scoped domain knowledge module |

Use PascalCase names for named modules. Do not invent an alternative brand, pluralize a module name, or describe Understanding as a language adapter. Use the exact language or framework name after the prefix. Distinguish actual module names from descriptive phrases and experimental shims. Do not claim future modules already exist.

## 2. Architectural style

- Keep libraries small, independently versioned and independently testable, with explicit service contracts and dependencies.
- Use OSGi dynamic composition; Apache Karaf is the agreed runtime direction. Reuse compatible host containers where lifecycle ownership is clear. Do not make the IDE the owner of semantic knowledge.
- Discover and provision only capabilities needed for a project. Distinguish provisioning, service activation, deactivation, and knowledge persistence.
- Linguistic adapters interpret native source into Understanding and express supported semantic knowledge in native languages. Report gaps rather than inventing semantics. Do not rely on original source as a template during reconstruction.
- Lexicons supply reusable framework or domain knowledge, including versioned conventions, lifecycle and relationships. Keep those facts distinguishable from observed application evidence. A framework is not a programming language.
- Understanding retains semantic evidence independently of any adapter, lexicon, or service instance. Unloading a provider must not remove knowledge already retained.
- Shared semantic interpretation belongs behind explicit contracts, not in duplicated parsers scattered through consuming products.
- Preserve verified implementations while migrating incrementally. A Node bridge may be transitional infrastructure but is not proof of native OSGi composition.
- VS Code is a client of an IDE-independent runtime; a transport choice alone does not prove a working integration.

## 3. Semantic and measurement style

- Separate observed evidence, declared knowledge, inferred relationships, and unsupported or unknown semantics. Preserve provenance without treating provenance as intrinsic meaning.
- Preserve represented facts when improving classifications. Test monotonicity at the projection level.
- A matching fingerprint supports structural correspondence within the applicable schema; it is not universal behavioral equivalence. A changed fingerprint is not automatically changed behavior.
- Version the semantic schema when structure or semantics change; version individual adapters for changes in their behavior. A vocabulary extension is not necessarily a schema change.
- Use established Complexity definitions. Default thresholds: cyclomatic 15, Campbell cognitive 12, MikeVan's Better Cognitive Complexity (MBCC) 15. MBCC and cyclomatic share the threshold; do not lower it to make an experiment appear successful.
- Distinguish source structure, runtime behavior, business obligations, performance, semantic coverage, and operational lifecycle. Each needs its own evidence.

## 4. Research style

Do not create Git branches for tests or research experiments. Work on main and keep each research experiment in a dedicated directory within the research area.

1. State the question, domain and limitations, independent obligations, predictions, controls, falsifiers, and acceptance criteria before the run.
2. Freeze the approved protocol and baseline; do not build experiment implementation before protocol approval.
3. A completed experiment is an immutable research record. Never retrospectively repair it to fit later decisions. Record defects, limitations, and their proposed remedy in the next experiment.
4. Score predictions as originally stated. Log failures and unpredicted findings before proposing changes.
5. No source or script changes between a measured run and recording its matching expected result. Record versions, build identifiers, commands, environments and hashes.
6. Use independent requirements and genuine execution of original, intermediate, and reconstructed programs. Include negative controls that would detect plausible semantic regressions.
7. Keep generated code, input models, transformations, test evidence and results separately inspectable. Reproduce deterministic artifacts in a separate run.
8. Check runtime and persistence claims in the actual runtime. A direct harness is not evidence of dynamic Karaf provisioning; a separate persistence trial is not proof of a persisted round trip.
9. Distinguish a deliberately narrow programmed rewrite from autonomous discovery or general-purpose optimization. Explicitly account for what comes from the fixture, adapter, lexicon, or experiment harness.
10. Report results in bounded language: what was measured, what was established, what failed, and what remains unproven.

## 5. Documentation and decision discipline

- Use clear module names, numbered experiment identifiers, precise units and exact paths or artifact identifiers.
- Distinguish user rulings, agreed architectural direction, proposed implementation choices, and observed results. Do not silently convert an assistant proposal into a user decision.
- Record the reason for each meaningful change and the evidence supporting it.
- Maintain a claim-to-evidence register, known limitations, reproduction instructions and evidence manifest for each experiment.
- Do not change historical artifacts when revising this manual. Amend this manual prospectively; record the date and reason for substantive decisions.
- Keep research evidence internal unless expressly authorized for release.

## 6. Decision register

| Date | Decision | Source |
|---|---|---|
| 2026-09-17 | Freeze predictions, preserve evidence and measured baseline; semantic and provenance distinctions | SemanticUnderstanding_1.md handoff |
| 2026-11-25 | Understanding, Linguistic<Language>, Lexicon<Framework/Domain>, small runtime-provisioned modules and independent knowledge lifetime | ADR-001 and project discussion |
| 2026-11-25 | Preserve RT-1 unchanged; record and remedy issues prospectively in RT-2 | Explicit user direction |
| 2026-11-25 | Full round-trip research should start with a working inefficient implementation and return an improved implementation | User direction; RT-1 report |

Read this manual alongside the architecture ADR and the current approved experimental protocol. In conflict, the user's current explicit decisions govern; document any amendment rather than silently rewriting history.

## 7. Prospective semantic-model decision — RT-1 through RT-4

**Owner ruling, November 25, 2026:** The target Understanding model describes what software accomplishes independently of how code implements it. Implementation choices come after semantic model construction. The existing representation is useful translation IR but fails the target implementation-independence criterion for the tested fixtures. Redesign the semantic model before RT-5; preserve prior experimental work and reports. Do not confuse language-neutral structural fingerprints with implementation-independent semantic identity. Structural and lexical evidence may be retained separately; observable effects and contractual ordering must not be discarded merely because they appear in code. Optional implementation optimization remains distinct from modeling meaning. See Intellectus-RT-1-4-Research-Summary.md for evidence and candidate redesign criteria; specific redesign architecture and RT-5 protocol remain unapproved.

## 8. Naming reservation and architecture repository — November 26, 2026

**Owner decision:** Reserve the name **Cognition** for later use as a candidate library or family name. Do not assign it to documentation, a separate project, or an implementation yet. When discussion turns to naming families of libraries, explicitly remind Michael of this reservation before choosing names. The actual responsibility and family membership remain to be decided.

The canonical documentation and research artifacts belong in `ArchitectureRepository/` within the existing Intellectus monorepo. The former `Intellectus-Cognition` directory is temporary staging only. Use established TOGAF Architecture Repository terminology, tailored to open research; preserve frozen experiment records.

