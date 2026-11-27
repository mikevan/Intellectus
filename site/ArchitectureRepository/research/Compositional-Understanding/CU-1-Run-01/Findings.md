# CU-1 initial condition

The experiment tested whether relationships spanning computational activities could predict outcomes across fresh workflows (H1), and whether Colibri added a verified relationship beyond the deterministic baseline (H2). KeepSafe and MVS were investigated independently using three repeats each.

## Results

| Subject | H1 deterministic | H1 Colibri | H2 incremental Colibri |
| --- | --- | --- | --- |
| KeepSafe | Met | Met | Not met |
| MVS | Met | Not met | Not met |

## Repeat-level evidence

| Subject / repeat | Oracle | Verified baseline predicates | Omission candidates | Colibri claims (V/U/C) | Structured output | Finish | Inference (s) | Tokens |
| --- | --- | ---: | ---: | --- | --- | --- | ---: | ---: |
| [KeepSafe 1](KeepSafe/1/) | Met | 82 | 5 | 1/2/0 | Met | stop | 633.3 | 3125 |
| [KeepSafe 2](KeepSafe/2/) | Met | 82 | 5 | 1/2/0 | Met | stop | 634.8 | 3125 |
| [KeepSafe 3](KeepSafe/3/) | Met | 82 | 5 | 1/2/0 | Met | stop | 695.3 | 3125 |
| [MVS 1](MVS/1/) | Met | 70 | 9 | 0/3/0 | Met | stop | 550.8 | 2881 |
| [MVS 2](MVS/2/) | Met | 70 | 9 | 0/3/0 | Met | stop | 393.8 | 2881 |
| [MVS 3](MVS/3/) | Met | 70 | 9 | 0/3/0 | Met | stop | 379.3 | 2881 |

V = verified, U = unsupported, C = contradicted. Baseline counts are predicate counts, which include equivalent observations at different activity boundaries. Omission effects are candidates. They are reported separately.

## Scientific conclusions

- **KeepSafe.** The deterministic threshold was met. The Colibri H1 threshold was met. All oracle checks passed across repeats: True.
- **MVS.** The deterministic threshold was met. The Colibri H1 threshold was not met. All oracle checks passed across repeats: True.
- **Compositional relationships (H1).** Subjects meeting the acceptance criterion: KeepSafe, MVS.
- **Incremental Colibri contribution (H2).** Subjects meeting the acceptance criterion: none.

## Scope and limitations

The checked workflow variations bound the conclusions. Exact equality and inequality predicates sample a narrow class of compositional claims. The baseline uses aligned observations and matched omissions. The Colibri arm uses a compact structured response protocol and exact normalized repeat matching. Variation in how a prediction is encoded can therefore affect repeat matching. Scope and novelty are evaluated on the available observable obligations. The experiment did not qualify end-to-end emergent capabilities or inferred purpose. Model identity is the serving alias recorded by the freeze.

See the [freeze manifest](Freeze.json) and [complete scores](Scores.json). The repeat directories contain acquisition records, visible discovery requests, raw SSE streams, assembled responses and held-out checks.

## What the workflows showed

In both applications, the intact workflow restored the earlier file bytes and preserved the visible history identifiers. Omitting the second recording activity exposed a difference. KeepSafe restored the previously recorded file and left the never-recorded extra file in place. MVS refused restoration while the workspace had pending changes and left both files in place. The matched omission is evidence of a dependency under these conditions and motivates a capability-level test in CU-2.

Colibri's repeated KeepSafe claim correctly predicted original note contents after restore and persistence of the extra-file state across the subsequent listing. The baseline already entailed those predictions. On MVS, Colibri correctly noticed in prose that the restore exit status changed after the omission. Its predictions referenced steps unavailable in that scope and combined conditions in a single conjunction. All nine MVS claims were therefore unsupported by the frozen scoring rules. The baseline also flagged the exit-status change in the matched omission. The result leaves open whether a richer conditional prediction language would capture additional contributions.

All 18 held-out workflows passed the oracle and all six SSE responses completed with valid structured output. The calls used 18,018 total tokens and 54.8 minutes of inference. Acquiring the 36 visible and held-out workflows took 131 seconds in aggregate. There were zero independently verified incremental contributions, so cost per contribution is undefined.

The frozen scorer initially stopped on a missing comparison step. The [scoring amendment](Scoring-Amendment.md) records the narrow recovery applied to existing evidence. The original remains pinned in the freeze manifest.
