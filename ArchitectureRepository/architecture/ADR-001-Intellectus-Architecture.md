# Intellectus — Architecture Decision Record 001

**Status:** Proposed architecture, agreed direction; implementation and validation pending.
**Date:** 2026-11-25
**Context:** Project Revive Solutions; continuation of Understanding and Polyglot.

## Decision

Intellectus will be an IDE-independent, dynamically composed semantic computing platform. Apache Karaf (OSGi) is the preferred runtime candidate. Understanding is the authoritative semantic evidence model, not a conventional shared parser library. The existing TypeScript implementation is retained as a baseline until experiments establish the right migration strategy.

## Modules and boundaries

| Module | Responsibility |
|---|---|
| Intellectus runtime | Discovery, provisioning, activation, lifecycle, service registry and orchestration |
| Understanding | Durable evidence about concepts, provenance, relationships and semantic reconstruction |
| LinguisticJavaScript | Bidirectional JavaScript semantic interpretation and expression |
| LinguisticTypeScript | Bidirectional TypeScript semantic interpretation and expression |
| LinguisticPython | Bidirectional Python semantic interpretation and expression |
| LinguisticJava | Future Java adapter; not implemented in Polyglot |
| LexiconAngular, LexiconReact, LexiconVue, LexiconSvelte | Small, version-aware framework knowledge modules |
| LexiconSpringDM, LexiconHibernate | Future framework knowledge modules |
| Complexity | Measure semantic structure while preserving existing metric definitions |
| Witness | Instrumentation, test attribution, runtime observations and behavioral evidence |
| DeepTest, UntangleIt, KeepSafe | Existing user-facing capabilities; migrate behind stable contracts incrementally |
| MADTPackage | Existing distribution baseline; not the Intellectus runtime |

A Linguistic Adapter encodes native source into semantic evidence and reconstructs source in a supported target language. It must expose unknown or unsupported semantics and distinguish lossless reconstruction from a partial projection. Framework Lexicons describe reusable framework facts, lifecycle conventions, relationships and version-specific rules; application evidence must not be overwritten by a priori framework knowledge. Keep modules small, separately testable and explicitly versioned.

## Runtime design

Karaf Features should group compatible bundles and dependencies by capability (e.g. intellectus-angular). The runtime starts a minimal core; project detection selects capabilities, and services are activated when needed. Do not preload every language and framework at startup. Semantic knowledge persists independently of the lifetime of its adapters. Provisioning, service activation, and knowledge persistence are distinct lifecycles.

Use an existing compatible host OSGi runtime where suitable and where lifecycle ownership and dependency isolation are explicit; otherwise use an independently managed Karaf process. VS Code runs a Node.js extension host, so the extension remains a lightweight client communicating with the runtime using JSON-RPC or LSP where appropriate. Native OSGi bundles cannot directly import existing Node/TypeScript packages. Prototype a cross-runtime service boundary first; do not rewrite validated libraries solely for OSGi adoption. For remote development, place the runtime with the workspace and toolchain. Browser-only clients require a reachable server and cannot spawn a local JVM.

## Evidence and migration

The original Polyglot code remains untouched. Before refactoring, qualify the copied baseline. The earlier HelloWorld campaign found all eight complexity implementations agreed (cyclomatic 27, Campbell 73, MBCC 97 for pickGreeting). Six runtime integrations passed; Angular Karma and Node Mocha were environmentally blocked. The coordinated Polyglot 1.0.22 release was proposed, not confirmed.

Identify overlapping parser and structural logic across the copied libraries and Understanding. Establish semantic contracts before removing duplication; do not simply move duplicate AST traversal into a new generic parser library. Preserve thresholds (cyclomatic 15, Campbell 12, MBCC 15), original measurement semantics, provenance and observed behavior. Use canonical HelloWorlds as regression evidence; retain frozen Understanding corpora and append-only research records.

## First architecture experiments

1. Establish one monorepo and reproducible unchanged baseline.
2. Define versioned semantic contracts and adapter/lexicon discovery descriptors.
3. Prototype Karaf feature provisioning and service discovery with one existing TypeScript service behind a narrow interface.
4. Demonstrate activation of only the capabilities required by a project, and unloading without loss of semantic evidence.
5. Compare source-to-semantic-to-source reconstruction with expected evidence on Python and JavaScript/TypeScript fixtures.
6. Migrate shared language interpretation incrementally, verifying metrics, attribution and behavior against the original baseline.
7. Qualify IDE, CLI and remote/container host modes before selecting final packaging.

## References

- https://docs.osgi.org/specification/osgi.core/8.0.0/framework.api.html
- https://karaf.apache.org/
- https://code.visualstudio.com/api/advanced-topics/extension-host
- https://code.visualstudio.com/api/language-extensions/language-server-extension-guide
- https://github.com/eclipse-jdtls/eclipse.jdt.ls

This ADR records an architecture direction, not implemented functionality or a release qualification.
