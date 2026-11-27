# Research analytics

## Historical evidence — prepublication review
The following measurements are transcribed from the internal RT-1–4 Research Summary and RT-4 Experiment Report dated November 25, 2026. These are historical reported results, not a new execution or independently audited rerun. This draft is for owner review before public release. Individual case counts are not unit-test counts.

[Complexity comparison chart](complexity.svg)

| Trial | Cyclomatic before → after | Campbell before → after | MBCC before → after | Oracle cases per implementation | Matching deterministic artifacts |
|---|---|---|---|---|---|
| RT-1 | 6 → 4 | 16 → 8 | 21 → 7 | 40,004 | 9 |
| RT-2 | 3 → 2 | 5 → 2 | 6 → 1 | 202 | 11 |
| RT-3 | 6 → 6 | 16 → 16 | 21 → 21 | 40,004 | 6 |
| RT-4 | 3 → 3 | 5 → 5 | 6 → 6 | 202 | 6 |

RT-1/2 explicitly optimized duplicate branches. RT-3/4 disabled optimization and retained structure. RT-1/3 and RT-2/4 used different fixtures and domains; compare within each fixture pair, not as a chronological performance trend. RT-2/4 covered all 202 declared pairs; RT-1/3 sampled representatives of a larger domain. Default metric thresholds remain cyclomatic 15, Campbell 12, MBCC 15.

## Interpretation
The reported operational gates passed within their restricted scope, but the target implementation-independent semantic identity was not achieved. Equal behavior did not guarantee equal structural fingerprints. The historical intermediate representation remains useful; RT-5 must test convergence instead of another structural round trip.

## P3 and P4 local inference

| Run | Requests | Cumulative request time |
| --- | ---: | ---: |
| P3 Run 01 | 12 | 278.196 seconds |
| P3 Run 02 | 12 | 735.702 seconds |
| P4 Pilot 01 | 24 | 770.433 seconds |
| P4 Pilot 02 | 24 | 1,627.273 seconds |

These are sums of request durations for the recorded runs. See the [research record](https://github.com/mikevan/Intellectus/blob/main/site/ArchitectureRepository/research/P3-P4-Research-Record.md) for scope and outcomes.

## Dashboard measures not yet established
| Measure | Definition | Status |
|---|---|---|
| Semantic convergence | Equivalent pairs sharing verified identity / eligible equivalent pairs | Not measured |
| False convergence | Non-equivalent pairs falsely sharing identity / negative pairs | Not measured |
| Claim precision | Independently verified correct claims / evaluated claims | Not measured |
| Behavioral fidelity | Passing oracle cases / executed cases, with scope | Historical limited fixtures only |
| Inference latency | Median and p95 measured under named configuration | Not measured |
| Compute cost | Measured amortized cost per newly verified relationship | Not measured |

Data: [historical metrics CSV](historical-metrics.csv). Do not fill missing data with zeros, claim production readiness or infer causality from these charts.
