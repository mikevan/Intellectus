# P3 run 01 findings

The live AI arm did not qualify. The deterministic control reached all 12 expected dispositions and the fixture matched its oracle on all 300 input pairs.

| Disposition | Qualification target | AI result | Deterministic control |
| --- | ---: | ---: | ---: |
| Verified repair | 3 of 4 | 1 of 4 | 4 of 4 |
| Justified withdrawal | 3 of 4 | 0 of 4 | 4 of 4 |
| Correct retention | 4 of 4 | 0 of 4 | 4 of 4 |

The model selected repair on all 12 cases. In the four retention controls it returned the original correct coefficients with a repair label. These were invalid dispositions under the runner's rules. On three boundary cases it also returned the unchanged, contradicted seed as a repair. The verifier rejected the other four incorrect candidate formulas. No false candidate passed verification. One repair, case 01, passed on all 25 inputs.

The live calls took 278.196 seconds cumulatively and used 3018 total tokens. The run used Colibri v2.1.0 and the local intellectus-qwen36 model alias. The checkpoint installer flag read incomplete, while all 47 manifest entries were present at the expected lengths before inference. File hashes identify the observed checkpoint. The run used uncommitted research files, as directed for testing before check-in. The run manifest records the exact input file hashes and the provenance records the base commit.

This result measures one response per case for this model, prompt, and affine claim scope. It shows a consistent preference for the repair action in this setup. It does not establish why the model selected that action or how a different prompt would perform.

- [Raw evidence](run-01.jsonl)
- [Checkpoint and runtime provenance](run-01-provenance.json)
