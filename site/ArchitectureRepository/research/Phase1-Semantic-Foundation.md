# Intellectus Phase 1 — Semantic foundation assessment

Date: 2026-11-25. INTERNAL. No changes to measured Understanding source, frozen corpora, or experimental results.

## 1. Baseline correction

The Intellectus monorepo currently contains the September 14 IR-4 tree (IR schema 3, 36 tests). Its corpus reproduces at build cc713846973d. It is not the latest research baseline. The handoff SemanticUnderstanding_1.md identifies C:\workspace\und-ir9\Understanding; the November 2 log in that tree records P0 at d7efd55eb399 (IR schema 6). A copy was built and tested independently: 181/181 tests passed, no skipped tests. TypeScript frozen corpus reproduced R-1A. Graph reconciliation reproduced 65 projected/stored real invocations, zero store-only, 15 pseudo-invocations. The source is the November 2 P0 tree, NOT the older handoff's R-1A build.

| Corpus | Functions | Semantic IR statements | Opaque | Collision groups |
|---|---:|---:|---:|---:|
| ir0-typescript | 58 | 240 | 15 (6.3%) | 2 |
| radon-python | 137 | 435 | 81 (18.6%) | 8 |
| toml-python | 56 | 345 | 34 (9.9%) | 2 |

The TypeScript corpus also has 153 semantic source statements hidden within opaque containers, 117 statements outside encoded functions, and 14 in unencoded function expressions. These are distinct populations, not additive to IR statement counts. Sufficiency walked 48 threads, two qualified, zero sufficient. Qualification and successful encoding are not regeneration. This remains a research prototype.

P0 established the difference between 120 statement-level sites and 121 stored calls in radon: one call nested in a returned member read. P0 also found returned-call steps absent from HAS_EFFECT; do not equalize populations. Preserve the recorded R-1B1 decisions (NEXT_STEP, TESTS_PREDICATE, AWAIT_TARGET with no redundant completion relation) as experimental decisions; they are not yet a production representation migration. Keep the unresolved IN_ARM consistency question visible; preserve primary/consequent diagnostic roles. Retain frozen tests, checksums, corpus manifests, goldens and append-only research logs.

## 2. Existing capabilities and gaps

Understanding currently implements a versioned assertion journal with transaction replay, scoped authority, retraction and derivation invalidation; a language-neutral function IR; Python and TypeScript encoders; ingestion to PARSED assertions; call composition, value flows, receiver evidence, loss/origin/producer analysis, sufficiency and substitutability proposals. It does not implement a complete source emitter or whole-project reconstruction. Its parser loader accepts only Python and TypeScript. JavaScript/JSX, TSX and Vue/Svelte script handling do not yet have dedicated validated semantic adapters. Module-level code, function expressions and stable mapping of symbols/spans need attention. Unknown values, opaque loops/switches, external effects, call identity, throw operands, and ordering remain real gaps; never infer proof from absent opacity.

The original charter's first product proof is Python -> semantic representation -> TypeScript with independent side-by-side UAT. The long-term graduation case is Regalia Python -> Lisp. Keep that proof as the priority over broad language expansion.

## 3. Duplication inventory and migration boundaries

| Source | Actual responsibility | Migration disposition |
|---|---|---|
| DeepTest and UntangleIt languages/python/structure.ts | identical, 566 nonblank lines | unify structural interpretation via LinguisticPython |
| DeepTest and UntangleIt languages/typescript/structure.ts | identical, 546 lines | unify via LinguisticJavaScript / LinguisticTypeScript |
| DeepTest and UntangleIt languages/shared/treeSitter.ts | identical, 61 lines | consolidate parser lifecycle within adapter infrastructure |
| Understanding adapters/treeSitter.ts | independent parser setup/grammar packaging | use same adapter infrastructure after baseline measurements |
| Complexity src/python.ts, typescript.ts, find.ts, sfc.ts | syntax-based function discovery, decision counting and component script extraction | preserve metric semantics; migrate only after matching golden measurements |
| Witness src/treeSitter.ts, instrument.ts, boundary.ts, delivery.ts, behaviour/* | parser, source rewriting, runtime hooks, identity and observations | share discovery/source anchors; retain executable instrumentation and runner integration |
| DeepTest coverage and runner adapters | per-test evidence, coverage and density | consume shared source anchors and observations; remain product-specific |
| UntangleIt gates and loop | governed refactoring and independent behavior verification | remain product-specific; use semantic evidence where sufficient |

1173 identical nonblank lines in three files are directly confirmed by hashes (one redundant copy of each), not a claim that all language-specific code is redundant. Witness instrumentation is not semantic reconstruction. Complexity measures intentionally depend on source expression shape; semantic normalization can erase distinctions (nested vs early return, evaluation order) that those existing measures intentionally count. Keep structural and semantic views side by side, linked by provenance. Do not redefine CC, Campbell or MBCC. Thresholds remain 15/12/15.

## 4. Proposed service contracts

The following is a versioned, transport-neutral interface design; names are proposed, not implemented. DTOs are serializable across Karaf/Node boundaries; no Tree-sitter Node objects, class instances, handles or IDE APIs on the wire. The adapter implementation may reuse the existing encoder internally. Understanding owns durable concept identity and assertion validation; adapters emit candidate evidence, not canonical identity.

    interface ModuleDescriptor {
      id: string; implementationVersion: string;
      contractVersion: string;
      irSchemas: number[];
      languages: string[]; capabilities: string[];
      requires: string[];
    }
    interface SourceDocument {
      uri: string; language: string; content: string;
      sha256: string; revision: string;
    }
    interface SourceAnchor {
      uri: string; sha256: string;
      startByte: number; endByte: number;
      symbolKey: string; syntaxKind: string;
    }
    interface EncodingResult {
      producer: ModuleDescriptor; irSchema: number;
      sourceHash: string;
      executables: Array<{ anchor: SourceAnchor; ir: FunctionIR }>;
      structuralFacts: StructuralFact[];
      assertions: ProposedParsedAssertion[];
      gaps: RepresentationGap[];
    }
    interface ReconstructionResult {
      status: "complete" | "partial" | "unsupported";
      output: SourceDocument[];
      gaps: RepresentationGap[];
      evidenceIds: string[];
    }
    interface LinguisticAdapter {
      describe(): ModuleDescriptor;
      supports(document: SourceDocument): boolean;
      encode(document: SourceDocument): Promise<EncodingResult>;
      reconstruct(request: ReconstructionRequest): Promise<ReconstructionResult>;
    }

FunctionIR is the existing versioned Understanding contract, not a new schema invented here. StructuralFact is an evidence-bearing source-shape observation including decision kind, nesting, function boundary and source span; it is not an assertion of behavioral equivalence. ProposedParsedAssertion is an existing AssertionInput-shaped candidate with rule, evidence, source and producer. RepresentationGap records category, affected anchor, unsupported/ambiguous/unknown status, and impact on requested capability. ReconstructionRequest provides target version, semantic evidence snapshot, obligation set and sufficiency verdict; it cannot include original source text as a fallback. Complete means the required facts are represented for this operation, not untested equivalence. Independent UAT is required to claim equivalent behavior. Byte offsets specify UTF-8, not JS UTF-16 or editor positions; adapters must test conversion.

LinguisticPython, LinguisticJavaScript and LinguisticTypeScript are separate logical services. Shared parser internals can remain small and reused. The first increment wraps the existing Python/TS encoders without modifying their results; JS grammar support is explicitly a future extension, not a renamed TS adapter. One versioned descriptor per service, not a new runtime per language.

## 5. Framework Lexicon

    interface FrameworkLexicon {
      describe(): ModuleDescriptor;
      match(project: ProjectDescriptor): Promise<FrameworkMatch[]>;
      facts(match: FrameworkMatch): Promise<FrameworkFact[]>;
    }

ProjectDescriptor contains declared dependency evidence, versions, relevant source anchors and configuration. FrameworkMatch contains the exact framework/version range, evidence and confidence or an explicit unknown version. FrameworkFact is a version-qualified, sourced semantic rule or assertion template (not an observed fact about the application). A lexicon may propose relationships conditioned on application evidence, never manufacture OBSERVED evidence or overwrite contradictory evidence. Its version and rule identifier accompany every derived assertion. No arbitrary execution or implicit provisioning is necessary for lookup. LexiconAngular, LexiconReact, LexiconVue, LexiconSvelte are separate small modules; LexiconJest/Vitest are runner knowledge, not implementations of the runners. Start with one rule for a known framework version, then measure a positive and a negative control.

## 6. Phase 1 exit and next experiment

Assessment, duplicate inventory, migration mapping and proposed interfaces complete. Restoring the correct baseline into the actual monorepo remains pending until the installation script is executed. The November P0 build has been verified on a copy, not in the target repo. No baseline overwrite should silently discard work; a clean tracked Understanding subtree and backup are required by the installation script.

First experiment after adoption: wrap the existing TypeScript and Python encodeFunctions entry points behind the adapter contract and compare their projections, fingerprints, category populations, corpus identity and test results against the frozen baseline. No IR changes are needed to test discovery or transport. Measure only the smallest useful operation. Next, Karaf feature provisioning can activate a single adapter + a tiny lexicon without loading the rest; test service registration, unload, persistence and independent transport. The actual regeneration proof follows the charter and known sufficiency gaps, not a broad rewrite.
