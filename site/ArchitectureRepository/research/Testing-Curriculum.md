# Research testing curriculum

Michael Van Geertruy | Intellectus | November 26, 2026

## Scientific objective

Determine whether implementation-independent knowledge can be established from heterogeneous evidence, and whether each specialist contributes measurably to that knowledge. Separate engineering qualification from scientific validation. The sequencing below consolidates existing decisions; future protocols and thresholds are proposed until frozen.

## Track A — Established historical experiments

| Trial | Question | Treatment and control | Measured gate | State |
|---|---|---|---|---|
| RT-1 | Can a redundant decision tree survive a language round trip and explicit optimization? | Original, generated TS, optimized Python; changed threshold | 40,004 oracle cases per intended implementation; mutation detected | Complete |
| RT-2 | Does the approach extend to cooperating functions and OSGi lifecycle? | Explicit optimization; arithmetic, membership and premium mutations | 202 exhaustive input pairs, lifecycle markers, negative controls | Complete |
| RT-3 | Does apparent optimization arise implicitly? | Exact RT-1 fixture; optimization disabled | 40,004 sampled cases; exact IR preserved | Complete |
| RT-4 | Does the same hold for cooperating functions? | Exact RT-2 fixture; optimization disabled | 202 exhaustive cases; exact IR preserved | Complete |

All passed declared operational gates. The paired treatments exposed implementation dependence. See [summary](Intellectus-RT-1-4-Research-Summary.md) and [analytics](../analytics/README.md).

## Track B — Qualification before formal RT-5

| Stage | Hypothesis | Method and controls | Acceptance evidence | Status |
|---|---|---|---|---|
| Phase I | Specialists can contribute independently checkable claims | Local inference, deterministic observer/verifier, typed envelopes | Recorded claims and independent checks; invalid claims never promoted | Operational pass; substantive AI contribution not demonstrated |
| P1 | Equivalent implementations converge | Four branch/loop/direct/lookup implementations over identical finite contract | Exact canonical bytes shared | Pilot passed |
| P2 | Different observable behavior remains distinct | Offset mutation and late difference absent from discovery | Two distinct controls; late candidate contradicted | Pilot passed |
| P3 | Specialists can correct or withdraw false hypotheses | Paired deterministic-only and AI-assisted conditions; held-out counterexamples; correct-claim controls | Verified correction or justified withdrawal; no false promotion; report per-case rates and comparison | [Two live runs did not qualify](P3-P4-Research-Record.md) |
| P4 | Domain context contributes independently verifiable meaning | Same ambiguous fixture with/without independently authored context; deterministic-only control; misleading context control | Verified new domain claims, false claims and abstentions reported separately; measure incremental contribution | [Two exploratory pilots, qualification pending](P3-P4-Research-Record.md) |

P3/P4 are qualifications, not replacements for formal RT-5. Before execution, freeze sample count, fixture bytes, expected outcomes, model versions, budgets and quantitative acceptance thresholds. A failed gate requires a documented finding and redesigned method, not relabeling.

## Track C — Formal research roadmap

| ID | Research question | Required control / acceptance metric | Dependency |
|---|---|---|---|
| RT-5 | Equivalent implementations converge under a declared contract? | Six subjects; 62 input pairs each; four equivalent subjects and two negative controls; complete oracle agreement; identical verified partitions on two runs | P1–P4 and reviewed [draft](../experiments/RT-5/RT-5-Draft-Protocol.md) |
| RT-6 | Can compact knowledge be discovered blindly? | No oracle or target formula to discovery; compare compact candidate with held-out behavior | RT-5 |
| RT-7 | Does the committee exceed deterministic-only analysis? | Full and ablated configurations on identical inputs; incremental verified claims per resource cost | RT-6 |
| RT-8 | Does context improve domain interpretation? | Independent context and no-context controls; accuracy and abstention | P4, RT-7 |
| RT-9 | Can verification defeat false consensus? | Contradicted benign claims; false promotion rate | RT-7 |
| RT-10 | Can verified knowledge be reused? | Fresh versus reused evidence; correctness and cost | RT-7 |
| RT-11 | Can synthesis follow knowledge acquisition? | Independent behavioral oracle; complexity and source-generation metrics | Verified semantic representation |
| RT-12 | Can alternative representations express equivalent knowledge? | Cross-representation checks under stated contract | RT-11 |
| RT-13 | Does linguistic sharding improve localization? | Sharded versus monolithic adapters; fidelity and overhead | Separate spike |
| RT-14 | Which components remain useful at scale? | Resource and correctness measurements; ablation and interaction analysis | Prior qualifications |

All Track C entries are unexecuted proposals. Temporal reasoning, financial forecasting and strategic scenario generation are deferred beyond this foundational curriculum.

## Measurement protocol

- **Behavior:** oracle cases passed / executed cases; exact domain and coverage; report sampled versus exhaustive.
- **Identity:** matching canonical bytes for equivalent controls; distinct groups for different outcomes.
- **Inference:** verified, contradicted and unresolved claims by role; denominator includes all eligible proposals.
- **Correction:** verified revisions / contradicted claims eligible for revision; separately report justified withdrawals, repetitions and unresolved claims.
- **Domain contribution:** new independently verified domain facts with context minus matched no-context control; report false claims and abstentions.
- **Resources:** prompt/completion tokens, cumulative and wall time separately, CPU/GPU/memory when measured; missing values marked unavailable.
- **Reproduction:** compare canonical mappings, decisions, artifact hashes and environment versions; do not require identical nondeterministic prose.

## Required experiment report

Every future report should contain: question and hypothesis; preregistered protocol; fixture and oracle separation; treatments and controls; environment and versions; raw evidence links; quantitative tables and charts; results against gate; explicit conclusions; limitations and alternative explanations; decision and next experiment. Preserve the old reports unchanged. Report zero and missing measurements distinctly.

## Reproduction entry points

Use the [continuity charter](../Intellectus-Research-Continuity.md) and the [technical research directory](../../Understanding/research/knowledge/). Baseline regression tests and engineering pilots are different from formal experimental acceptance. Do not substitute one for the other.
