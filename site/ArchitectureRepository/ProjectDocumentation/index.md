# Intellectus

# Our mission
The mission of Intellectus is to develop and maintain an open-source Semantic Software Engineering Platform that enables artificial intelligence systems to understand the purpose, behavior, and methods of software systems by applying a flow-based semantic model represented through a temporal ontology.

Through independently operating specialist models, deterministic analysis, LoRA training, and Colibri-based inference, Intellectus seeks to acquire, verify, preserve, and apply that understanding independently of the original implementation.

## Why Intellectus?
Software contains knowledge about how to accomplish tasks, but that knowledge is usually bound to source code, frameworks and runtime assumptions. Intellectus investigates whether an AI system can acquire the meaning of a software system, retain it independently, and use it to construct a new implementation. The goal is understanding, not translation.

## Explore the project
- [Projects and modules](projects.md) — the modular runtime and research components.
- [Get started](get-started.md) — begin with the research model and reproduction prerequisites.
- [Documentation](documentation.md) — user, developer and architecture guides.
- [Research](research.md) — questions, methods, results and future work.
- [Analytics](analytics.md) — measured historical results and their interpretation.
- [Downloads](downloads.md) — releases, compatibility and verification.
- [Community](community.md) — contribute and participate.

## Understanding through reconstruction
[The round-trip experiment](round-trip.md) starts with Python, acquires a temporal ontology, generates TypeScript, then independently acquires a new ontology from TypeScript and reconstructs Python without the original source. Independent verification compares the two Python applications.

## Semantic-first development
[The semantic-first workflow](semantic-first.md) starts with a developer-authored semantic model rather than existing source. The model expresses required behavior; languages become implementation choices.
