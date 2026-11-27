# Testing and validation curriculum

## Engineering qualification
| Gate | Objective | Required evidence |
|---|---|---|
| T0 | Reproducible environment and build | Commit, dependencies, command and exit status |
| T1 | Individual units and specialists | Correct/incorrect/unsupported cases, outcomes and coverage |
| T2 | Component integration | Service contracts, real Karaf provisioning and persistence checks |
| T3 | End-to-end reconstruction | Isolated acquisition, expression, independent oracle and negative controls |
| T4 | Benchmark and regression | Baseline, repetitions, latency, memory and complexity |
| T5 | Scientific validity | Frozen hypothesis, falsifiers, controls, scope and replication |
| T6 | Release qualification | Applicable gates, artifacts, checksums, license review and review decision |

## P3 and P4 outcomes

P3 completed two live revision runs and missed qualification in both. P4 completed two exploratory domain-context pilots. Formal P4 qualification remains pending independent review. See the [research record](https://github.com/mikevan/Intellectus/blob/main/site/ArchitectureRepository/research/P3-P4-Research-Record.md) for the qualification thresholds and per-run outcomes, and the [Developer Guide](developer-guide.md) for reproduction instructions.

## RT-5 draft gate
Use independently written equivalent and non-equivalent finite-domain implementations, including structurally redundant and direct forms. Freeze the domain, cases, oracle, predictions, controls and acceptance criteria before implementation. Discovery receives observations and permitted scope, not the oracle. Equivalent controls must converge under the defined semantic identity; negative controls must diverge. No unsupported claim may be marked verified. Report unresolved cases and resource use.

## Run record
Record run ID, UTC date, commit, environment, dependency and model versions, fixture/dataset IDs, commands, expected and actual results, metrics and units, evidence hashes, status, limitations and reviewer. Preserve failed predictions, negative results and immutable raw evidence. Repeat in a fresh run directory and compare deterministic artifacts. Distinguish experimental evidence from source coverage or production readiness.
