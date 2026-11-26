# Future spike: linguistic sharding

Status: planned research; not part of RT-3 or RT-4.

Question: Can independently provisionable shards localize programming-language expressions of shared semantic concepts while preserving language-specific distinctions and enabling composable encoding and expression?

Hypothesis: language-specific knowledge can be decomposed by semantic capability (control flow, arithmetic, types, resource lifetime, concurrency), with versioned mapping contracts linking to language-independent Understanding concepts. Linguistic adapters compose these capabilities; Lexicons remain separate framework/domain knowledge. Comparable constructs must not be assumed equivalent (e.g. Python with, TypeScript using, Java try-with-resources differ in timing, error and resource semantics).

Proposed spike: choose two languages and two independently testable semantic capabilities. Freeze a reference corpus with positive, negative and unsupported cases. Provision only required shards using Karaf; test independent versioning, activation/deactivation, missing-shard behavior and persistent knowledge. Compare emitted IR and reconstructed executions against the existing adapter baseline. Measure dependency count, activation cost, representation coverage, semantic fidelity, and whether cross-shard relationships require an explicit contract. Identify where syntax, compiler semantics, runtime details and framework knowledge belong. No rewrite or default sharding until results reviewed.

Acceptance: unchanged supported semantic fingerprints and independent execution obligations; explicit failure for unsupported constructs; no silent loss of distinctions; reproducible lifecycle and measurable composition benefit. This is a research hypothesis, not an approved implementation design.

Sequence: after RT-3 and RT-4 fidelity experiments, which must not introduce sharding.
