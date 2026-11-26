# Phase I finite knowledge contract prototype

Status: independently tested engineering increment; not RT-5, not a general semantic model.

Implements a bounded pure integer input/output contract and canonical complete observation mapping. Claim and artifact IDs differ from behavioral identity. The independent mapping checker rejects incomplete or invalid observations, yields concrete counterexamples, and ties evidence references to the supplied observation bytes. A journal preserves evidence and assessment events, restores its projection upon replay, and marks dependent claims unresolved when a dependency is contradicted.

Nine component tests passed in the isolated delivery workspace. The existing Understanding IR and journal are unchanged. The prototype is deliberately separate under Understanding/research/knowledge, not a new library. The journal assumes a trusted single writer and trusted local journal; it does not authenticate producers or prove that observations came from genuine execution, establish purity, implement crash-safe transactional recovery, or protect against arbitrary process-level mutation. Those are integration requirements, not proven properties. It currently checks complete mappings, not compact mathematical relationships. No committee, Colibri inference, ontology, or RT-5 execution is claimed.

Run from monorepo: node --test Understanding/research/knowledge/knowledge.test.mjs

Next: qualify genuine observation acquisition, adapter service contracts, compact claim verification and committee integration. Preserve historical records.
