# Developer guide

## Contribution workflow
Select a scoped issue, identify affected service contracts and add a reproducible test. Keep modules independently versioned and independently testable. Use existing PascalCase naming: Understanding, Linguistic<Language>, Lexicon<Domain> or Lexicon<Framework>. Do not invent names for reserved components.

## Karaf and OSGi services
Document service capabilities, inputs/outputs, wiring, activation/deactivation, version compatibility and failure behavior. Verify dynamic provisioning in the real runtime rather than a direct harness alone. State the exact feature descriptors and build commands of the validated revision.

## Claims and data
Preserve immutable evidence references; distinguish structural fingerprint from scoped semantic identity. Do not overwrite historical assertions when retracting a claim: append a revision. Keep lexical details separate from meaning unless they affect the contract.

## Local development setup

Use the [experiment environment setup](experiment-setup.md) to install Java, Python, Node.js, Karaf, and Colibri. Then follow the [run instructions for your experiment](experiment-runs.md).

## Reproduce the P3 experiment

1. Open the [P3 research directory](https://github.com/mikevan/Intellectus/tree/main/site/ArchitectureRepository/research/P3) and use the commit recorded for the run you want to reproduce. The [P3 runbook](https://github.com/mikevan/Intellectus/blob/main/site/ArchitectureRepository/research/P3/Colibri-Runbook.md) contains the trial commands.
2. Run the deterministic preflight with Python 3.10 or later. It needs no model server and should pass all 12 cases and 300 oracle checks. Stop if any check fails.
3. Complete the shared Colibri setup with the checkpoint and runtime settings recorded for the trial.
4. Use a fresh output file for each live run. Compare the disposition for each case with the deterministic control and review the explanation for each withdrawal.

Match the checkpoint revision or weight hashes, runtime build, effective backend and engine settings, prompts, and scoring rules. The model alias identifies the API target. The checkpoint provenance identifies the weights used. Exact Phase I runtime settings were not recorded, so use the settings recorded for the specific P3 run.

## Reproduce the P4 pilots

1. Open the [P4 research directory](https://github.com/mikevan/Intellectus/tree/main/site/ArchitectureRepository/research/P4). Run preflight.py from the P4 directory or use run.py without an output path to prepare the 24 requests without inference.
2. Use the shared Colibri setup and the recorded checkpoint to verify the local model endpoint. The P4 runner requires a model, a provenance file, and a fresh output path. Select pilot mode for an exploratory repeat. Formal mode requires recorded independent review of the exact artifact hashes.
3. For Pilot 02, append the instruction in the follow-up amendment to the system prompt. Use the prompt and condition order in the raw manifest to confirm what was sent. Score against the rubric and preserve the raw responses and both diagnostic and strict scores.

## Review checklist
- Tests cover supported and unsupported inputs.
- Adapters do not rely on original-source templates at reconstruction.
- Specialist claims identify evidence and limitations.
- Documentation matches the module and schema version.
- Changes include migration and reproducibility evidence where applicable.
