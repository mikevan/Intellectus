# Research analytics

Numbers matter when they help us decide what to believe. Each set of measurements below explains what we tested, what the results tell us, and what they do not establish.

## CU-1 — compositional relationships

| Subject | Deterministic H1 | Colibri H1 | Incremental AI H2 |
|---|---|---|---|
| KeepSafe | Met | Met | Not met |
| MVS | Met | Not met | Not met |

All 18 held-out workflows passed the oracle; all six SSE replies completed with valid structured output. 18,018 tokens, 54.8 minutes of inference; 131.0 seconds of acquisition. No independently verified incremental contribution; cost per incremental contribution is undefined.

[AI claim dispositions](cu1-claims.svg)

[Acquisition versus inference duration](cu1-time.svg)

Finding: deterministic analysis supported scoped relationships across both applications. Colibri's verified KeepSafe relationship was already entailed by the baseline; the MVS claims were unsupported under the scoring rules. Emergent capability and purpose were not qualified. Consequence: evaluate capability-level abstractions rather than merely increasing inference.

[Full CU-1 findings](ArchitectureRepository/research/Compositional-Understanding/CU-1-Run-01/Findings.md) · [Scores](ArchitectureRepository/research/Compositional-Understanding/CU-1-Run-01/Scores.json)

## RT-1–4: why the representation changed

[Historical complexity comparison](complexity.svg)

| Trial | Cyclomatic | Campbell | MBCC | Oracle cases per implementation |
|---|---|---|---|---:|
| RT-1 | 6 → 4 | 16 → 8 | 21 → 7 | 40,004 |
| RT-2 | 3 → 2 | 5 → 2 | 6 → 1 | 202 |
| RT-3 | 6 → 6 | 16 → 16 | 21 → 21 | 40,004 |
| RT-4 | 3 → 3 | 5 → 5 | 6 → 6 | 202 |

Finding: explicit optimization changed implementation fingerprints; unoptimized reconstruction preserved redundancy. Compare paired fixtures, not a chronological trend. RT-1/3 sampled a large domain; RT-2/4 exercised every declared pair. Consequence: redesign semantic identity. Metric thresholds remain 15/12/15.

## Hello World — bounded prediction and knowledge reuse

The large-budget revised hypothesis matched 24/24 fresh Python outcomes, all nonempty strings. The pre-existing TypeScript port matched A on 12 fresh inputs and both boundary controls; independent authorship unconfirmed. Correction took 931.52 seconds and 3,064 tokens; subsequent deterministic verification took 0.269 seconds with no inference. These are different tasks, not a like-for-like speed benchmark.

Finding: knowledge acquisition and verification can be separated. No new domain concept or incremental AI distinction qualified.

[Transfer evidence](ArchitectureRepository/research/Application-Flow/Qualification-01/Transfer-01/Findings.md)

## Earlier local-model experiments

| Trial | Requests | Cumulative request seconds |
|---|---:|---:|
| P3 Run 01 | 12 | 278.196 |
| P3 Run 02 | 12 | 735.702 |
| P4 Pilot 01 | 24 | 770.433 |
| P4 Pilot 02 | 24 | 1,627.273 |

Neither P3 nor P4 qualified. [Research record](ArchitectureRepository/research/P3-P4-Research-Record.md). Missing measurements remain unavailable; do not invent them.

[Historical data and reproducible charts](ArchitectureRepository/analytics/README.md) · [Research program](research.md)
