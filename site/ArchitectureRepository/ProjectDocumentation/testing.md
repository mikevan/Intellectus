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

## RT-5 draft gate
Use independently written equivalent and non-equivalent finite-domain implementations, including structurally redundant and direct forms. Freeze the domain, cases, oracle, predictions, controls and acceptance criteria before implementation. Discovery receives observations and permitted scope, not the oracle. Equivalent controls must converge under the defined semantic identity; negative controls must diverge. No unsupported claim may be marked verified. Report unresolved cases and resource use.

## Run record
Record run ID, UTC date, commit, environment, dependency and model versions, fixture/dataset IDs, commands, expected and actual results, metrics and units, evidence hashes, status, limitations and reviewer. Preserve failed predictions, negative results and immutable raw evidence. Repeat in a fresh run directory and compare deterministic artifacts. Distinguish experimental evidence from source coverage or production readiness.
