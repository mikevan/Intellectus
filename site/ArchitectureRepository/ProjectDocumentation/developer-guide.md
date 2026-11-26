# Developer guide

## Contribution workflow
Select a scoped issue, identify affected service contracts and add a reproducible test. Keep modules independently versioned and independently testable. Use existing PascalCase naming: Understanding, Linguistic<Language>, Lexicon<Domain> or Lexicon<Framework>. Do not invent names for reserved components.

## Karaf and OSGi services
Document service capabilities, inputs/outputs, wiring, activation/deactivation, version compatibility and failure behavior. Verify dynamic provisioning in the real runtime rather than a direct harness alone. State the exact feature descriptors and build commands of the validated revision.

## Claims and data
Preserve immutable evidence references; distinguish structural fingerprint from scoped semantic identity. Do not overwrite historical assertions when retracting a claim: append a revision. Keep lexical details separate from meaning unless they affect the contract.

## Review checklist
- Tests cover supported and unsupported inputs.
- Adapters do not rely on original-source templates at reconstruction.
- Specialist claims identify evidence and limitations.
- Documentation matches the module and schema version.
- Changes include migration and reproducibility evidence where applicable.
