# Developer guide

## Contribution workflow
Select a scoped issue, identify affected service contracts and add a reproducible test. Keep modules independently versioned and independently testable. Use existing PascalCase naming: Understanding, Linguistic<Language>, Lexicon<Domain> or Lexicon<Framework>. Do not invent names for reserved components.

## Karaf and OSGi services
Document service capabilities, inputs/outputs, wiring, activation/deactivation, version compatibility and failure behavior. Verify dynamic provisioning in the real runtime rather than a direct harness alone. State the exact feature descriptors and build commands of the validated revision.

## Claims and data
Preserve immutable evidence references; distinguish structural fingerprint from scoped semantic identity. Do not overwrite historical assertions when retracting a claim: append a revision. Keep lexical details separate from meaning unless they affect the contract.

## Reproduce the P3 experiment

1. Open the [P3 research directory](https://github.com/mikevan/Intellectus/tree/main/site/ArchitectureRepository/research/P3) and use the commit recorded for the run you want to reproduce. The Colibri runbook contains copyable PowerShell commands.
2. Run the deterministic preflight with Python 3.10 or later. It needs no model server and should pass all 12 cases and 300 oracle checks. Stop if any check fails.
3. Start Colibri v2.1.0 with the recorded Qwen3.6-35B-A3B checkpoint and runtime settings. Check that the local models endpoint lists intellectus-qwen36 before running the live arm.
4. Use a fresh output file for each live run. Compare the disposition for each case with the deterministic control and review the explanation for each withdrawal.

Match the checkpoint revision or weight hashes, runtime build, effective backend and engine settings, prompts, and scoring rules. The model alias identifies the API target. The checkpoint provenance identifies the weights used. Exact Phase I runtime settings were not recorded, so the P3 runbook describes the current setup.

## Review checklist
- Tests cover supported and unsupported inputs.
- Adapters do not rely on original-source templates at reconstruction.
- Specialist claims identify evidence and limitations.
- Documentation matches the module and schema version.
- Changes include migration and reproducibility evidence where applicable.
