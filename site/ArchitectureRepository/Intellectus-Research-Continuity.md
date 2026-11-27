# Intellectus — Research continuity and succession charter

**Research originator and director:** Michael Van Geertruy (MikeVan)
**Prepared:** November 26, 2026, with AI-assisted drafting and engineering.
**Purpose:** Preserve the intellectual vision, experimental record and practical instructions for independent continuation. This charter is research guidance, not a legal appointment or transfer of ownership.

## 1. Original hypothesis and intellectual vision

Intellectus began with a deceptively simple distinction: understanding what a computational system does is different from describing how it was implemented. A semantic representation should capture meaning independently of the programming language used to express it. Implementation and optimization should follow understanding, rather than constrain it.

The project emerged from work on computational representations, ontological mapping and software analysis. Michael challenged the assumption that translating source into another formal language constitutes understanding. The research therefore asks whether complementary analytical methods can discover, challenge and establish knowledge that survives changes in implementation.

The motivation is not simply better code translation. It is to investigate a general methodology for understanding systems through evidence.

## 2. Semantic understanding versus intermediate-language translation

An intermediate representation can accurately retain operations, branches, loops and data flow while still describing implementation. Such representations have engineering value; they are not necessarily semantic models in the sense intended here.

A language-independent representation should distinguish essential behavioral relationships, constraints, domain meaning and causal relationships from incidental implementation choices. Different programs implementing the same relationship should converge where the evidence establishes equivalence; superficially similar programs producing materially different outcomes should remain distinct.

A semantic model is not automatically semantic because it is represented as an ontology, graph or formal notation. An ontology is one means of representing knowledge. The research must establish whether the contents genuinely capture meaning. Optimization, synthesis and translation are downstream applications; they are not proof of understanding.

## 3. Long-term vision: understanding across time

Michael's broader vision is composite understanding: an evolving, evidence-informed representation of a system at a moment in time, integrated with historical evidence and capable of reasoning forward.

The future research horizon includes historical understanding, current state, causal explanation, forecasts, alternative futures, counterfactuals and strategic choices. Extrapolation alone is insufficient: prospective understanding must distinguish likely continuations from possibilities requiring intervention, and distinguish hypotheses from verified observations.

A candidate application is examining years of corporate accounting records to understand the economic system producing financial results, forecast withheld future periods and evaluate alternative decisions. Financial forecasting and strategic reasoning are deferred research hypotheses, not established capabilities.

**Current scope decision:** strengthen understanding of the present before attempting to predict the future. No prospective reasoning engine is required for the current qualification.

## 4. Architecture and rationale

The architecture deliberately combines deterministic algorithms and AI specialists rather than relying on one model or one analytical worldview.

| Specialist | Contribution |
|---|---|
| Structural | Source and structural evidence, limitations explicitly recorded. |
| Behavioral | Observations of actual execution under a declared contract. |
| Causal | Interventions and relationships supported by evidence. |
| Mathematical | Exact candidate relationships and verification where possible. |
| Conceptual | Hypotheses about implementation-independent meaning. |
| Domain | Business context, constraints and explanations when evidence exists. |
| Skeptic | Independent checks, rejection of contradictions, preservation of uncertainty. |

The committee produces evidence-linked, typed claims. Reconciliation does not equate consensus with truth; a verifiable counterexample invalidates a claim regardless of agreement. Unknown contextual knowledge must remain unknown. Maintain provenance, scope and verification status.

Local Colibri inference is the provisional AI research environment. The Qwen model used in Phase I is general-purpose, not a dedicated purpose-trained SLM. Numerical computation should remain deterministic where possible. Investigate specialized models only where controlled experiments justify their value. Local inference still consumes compute.

Build an expansive backend to establish feasibility, then measure component contributions through ablation and reduce it to the necessary components. A future VS Code extension should be designed from those findings, rather than prematurely constraining research. Linguistic sharding remains a deferred spike. Cognition is reserved as a potential library family name; do not create a second monorepo.

## 5. Experimental record and conclusions

| Stage | Conclusion |
|---|---|
| RT-1 through RT-4 | Restricted round-trip reconstruction was demonstrated, but results did not establish the intended semantic abstraction. Improved Python fingerprints and unmodified reconstruction variants remain distinct historical experiments. |
| Phase I initial live committee | Both AI specialists responded; the conceptual claim was incorrect and domain context was unknown. |
| Phase I live deliberation | Typed qualification failed; no revision rounds. |
| Phase I typed deliberation | Both responses were incomplete at the completion ceiling; neither qualified. |
| Phase I concise deliberation | Operational qualification passed. Deterministic affine behavior was verified across 25 input pairs in Python and TypeScript. The conceptual specialist repeated a contradicted candidate through two revision rounds; domain specialist abstained. No demonstrated AI self-correction or verified incremental conceptual knowledge. |
| P1/P2 pilot | Four implementations shared a finite behavioral identity; two controls remained distinct. A held-out input disproved an initial affine candidate. Two repeat runs matched byte-for-byte with 60 verification cases each; installed monorepo reproduced the results. No AI was used. |
| RT-5 | Draft protocol only; not executed. |

Phase I used four local model calls totaling 1,029 tokens and 130.068 seconds of cumulative inference time. The central conclusion is that operational feasibility is not evidence of semantic understanding. Preserve the failures: the research is stronger for recording them rather than obscuring them.

The deterministic baseline demonstrates bounded behavioral equivalence, not universal program equivalence, autonomous concept formation, or business intent. No financial or temporal prediction capability has been demonstrated.

## 6. Outstanding questions and experimental roadmap

P1 and P2 engineering pilots passed. Two P3 runs missed qualification. Two exploratory P4 pilots found that supplied context improved explanations, while no supported claim met the strict rubric. See the [P3 and P4 research record](research/P3-P4-Research-Record.md) for methods, evidence, and follow-up changes.

1. **P3 — Deliberative correction:** Freeze benign synthetic cases, independently verified counterexamples and held-out inputs. Compare deterministic-only controls with AI-assisted analysis. Record initial claims, counterexamples, revised claims or explicit withdrawals and verification results. A passing result requires actual correction or justified withdrawal, not merely valid formatting.
2. **P4 — Domain contribution:** Provide independently authored business context for otherwise ambiguous computations. Compare results with and without context and with deterministic-only controls. Test whether domain knowledge contributes independently verifiable meaning. Allow abstention.
3. **RT-5 — Formal behavioral convergence:** Review and freeze the draft protocol, fixtures, independent oracle, model/runtime versions and data boundaries. Execute separate trials with complete verification. Do not retrospectively relabel engineering pilots as RT-5.
4. **Later experiments:** Blind discovery, specialist contribution and ablation, richer knowledge representations and eventually synthesis and optimization. Extend the architecture only where experimental evidence supports extension.
5. **Deferred future research:** Temporal knowledge, causal forecasting, counterfactual generation and strategic analysis. Financial records are a possible future domain with independent historical holdouts.

Open questions include how to represent concepts not reducible to finite mappings, infer context without overclaiming, identify uncertainty, enable substantive revision, and quantify the incremental value of each specialist.

## 7. Reproduction and repository map

Canonical public repository: https://github.com/mikevan/Intellectus

Canonical local Windows clone: C:/workspace-Intellectus

Last confirmed published checkpoint when this document was drafted: 439d3a6759a9c338c3849661c48e1625bbdbb634. P1/P2 was separately installed and reproduced locally; publication of this charter and that increment is the next checkpoint.

| Repository path | Purpose |
|---|---|
| ArchitectureRepository/README.md | Documentation entry point |
| ArchitectureRepository/research/Intellectus-RT-1-4-Research-Summary.md | Early research conclusions |
| ArchitectureRepository/architecture/Intellectus-Architecture-and-Implementation-Plan.md | Architecture and roadmap |
| ArchitectureRepository/architecture/Research-Direction.md | Owner decisions |
| ArchitectureRepository/architecture/Semantic-Knowledge-Contract.md | Evidence and claim contracts |
| ArchitectureRepository/research/Phase-I-Research-Foundation.md | Phase I research foundation |
| ArchitectureRepository/research/Phase-I-Live-Deliberation-Findings.md | Results and explicit conclusions |
| ArchitectureRepository/research/Current-Research-Scope.md | Present versus future research |
| ArchitectureRepository/research/P1-P2-Pilot-Findings.md | Deterministic baseline |
| ArchitectureRepository/evidence/phase-I/ | Raw experimental evidence |
| ArchitectureRepository/experiments/RT-5/RT-5-Draft-Protocol.md | Unexecuted protocol |
| ArchitectureRepository/standards/Intellectus-Style-Manual.md | Engineering and documentation conventions |
| Understanding/research/knowledge/ | Research implementation, tests, fixtures and reporter |

Use a compatible Node.js and Python environment with project dependencies installed. From the Understanding directory:

    npm test
    node --test research/knowledge/*.test.mjs
    node research/knowledge/run-pilot.mjs

On Windows, if the shell or Node version does not expand test globs, explicitly enumerate the eight Phase I .test.mjs files. The baseline at the published checkpoint was 181 passing tests. The pilot accepts an optional new evidence filename; it refuses to overwrite existing evidence.

For live trials, match the model and local Colibri runtime to the documented evidence. The PowerShell reporter Understanding/research/knowledge/Show-IntellectusDeliberation.ps1 accepts an explicit evidence path and reports recorded claims and verification decisions, not hidden model reasoning. Do not require a paid external API for deterministic tests.

## 8. Authorship, licensing and governance

The original research direction and intellectual vision belong to Michael Van Geertruy. Preserve accurate attribution to Michael, other contributors and AI-assisted drafting and engineering. Do not imply that an AI served as an independent human author or that an untested hypothesis was an established discovery.

Michael explicitly directed that the research and source be published openly. Respect the licenses accompanying each component and third-party dependency. The Understanding package declares GPL-3.0-only; that declaration must not be assumed to establish the licensing of every other monorepo asset or this charter. Retain existing copyright and licensing notices. Seek appropriate authorization for material without clear licensing.

A future maintainer can clone or fork the public repository under applicable licenses without access to Michael's account. Preserve commit history, evidence, attribution and reproducible instructions. Michael or his authorized representative may appoint a trusted maintainer and arrange account or estate access through authorized processes. This document does not appoint anyone, transfer rights or grant credentials. Never publish passwords, tokens or recovery codes.

## 9. Instructions to future researchers

Challenge the research hypotheses, including Michael's. Publish failures alongside successful results. Distinguish observation, inference, verification, uncertainty, and speculation. Freeze protocols before formal trials; preserve original artifacts and document amendments separately.

Do not add complexity merely because the architecture can accommodate it. Measure whether each specialist contributes evidence that would otherwise be unavailable. Do not confuse consensus with truth, arithmetic with intent, or extrapolation with understanding.

The project is successful if it establishes a reliable method for discovering what a system does independently of incidental implementation choices. The wider vision is understanding systems as they exist, evolve and could become. The foundation comes first.

Continue the research, not merely the code.
