# CU-1 protocol

**Primary hypothesis (H1).** For each subject, at least one investigation arm can independently verify a relationship spanning distinct computational activities and use it to predict outcomes across workflows.

**Incremental AI hypothesis (H2).** Given the same visible evidence, Colibri repeatedly contributes a verified relationship beyond the deterministic baseline. Score H1 and H2 separately per subject. Either arm can satisfy H1.

| Finding | Evidence required |
| --- | --- |
| Dependency | A controlled change to an upstream activity changes a downstream observation under specified conditions. An ordered trace alone establishes sequence. |
| Compositional relationship | A scoped relation spanning distinct activities predicts independently observed outcomes in multiple workflows, including a withheld variation. Record causal claims only when an intervention supports them. |
| Emergent functional capability | Multiple verified relationships jointly support an end-to-end outcome under independently established obligations. Record as exploratory evidence for CU-2. |


## Reproduction and isolation

Use the [qualified isolated environment](Environment-Qualification.md) with CPython 3.14.2 and pathspec 0.12.1. Import from each recorded source tree without modifying it or generating caches there. Use fresh disposable directories inside the Intellectus research workspace. Use no real files, credentials, symlinks or network resources. Set MVS_HOME to a separate disposable directory outside the synthetic workspace and confirm that the MVS repository root resolves to the fixture before restoration. Keep evidence and tracing outputs outside the fixture. Retain stdout, stderr, exit status, before and after file bytes or hashes, history observations, and executed source locations for every step. Keep instrumentation identical across arms and check one uninstrumented repeat for comparable observable outcomes.

| Step | KeepSafe | MVS |
| --- | --- | --- |
| Prepare | Set the fixture as cwd and pass its absolute path with global `--root`. Invoke `python -B -m keepsafe` with that checkout's `src` on PYTHONPATH. | Set the fixture as cwd. Expose `src` on PYTHONPATH and invoke `mvs.cli:main` via `python -B -c "from mvs.cli import main; main()"`. Run `init`. |
| Record first state | Write `note.txt` with bytes `alpha\n`, then run `checkpoint first` and `list`. | Write the same bytes, run `create checkpoint first` and `list`. |
| Record second state | Replace the bytes with `beta\n`, add `extra.txt` with `extra\n`, run `checkpoint second` and `list`. | Make the same changes, run `create checkpoint second` and `list`. |
| Compare | Run `diff <first-id> <second-id>` using observed IDs. | Run `diff <first-revision> <second-revision>` using observed revisions. |
| Return and inspect | Run `restore <first-id>` then `list`. Capture before and after bytes and visible history. | Run `restore <first-revision>` then `list`. Capture the same observations. |

The table is for investigators only. Create separate, neutral evidence packets with opaque step and subject IDs. Supply relevant executable evidence and observed transitions. Exclude README prose, declared purpose, rubric, expected labels, hidden workflow data, and the other subject's materials. Preserve each exact packet and its digest. Verify KeepSafe source reachability by tracing executed package files for each workflow, including whether `core.py` appears.

## Arms and verification

1. Deterministic baseline aligns transitions by activity, observed inputs and state fields across fresh runs. It compares an intact workflow, a content substitution and a targeted activity omission. The [baseline implementation](baseline.py) generates exact-equality predicates across activity boundaries where values vary across visible runs. Persistence is detectable when the same varying field matches across boundaries. Matched omission pairs identify changed downstream fields for investigation. An omission effect is a candidate dependency until replicated under the frozen workflow controls. Replay candidate predictions against withheld workflows only after sealing the baseline output. The baseline operates over observed fields and the variations exercised. It cannot establish invariance outside those conditions, identify a dependency from uncontrolled co-variation, or establish purpose. The preparation check exercises a known equality, an unrelated constant and a matched omission. The implementation supports exact equality and omission contrasts over aligned observations. It lacks automated step alignment, general causal inference and predicate discovery beyond those rules.

2. AI-assisted arm receives the same visible evidence with the existing frozen ontology method, SHA-256 `cba959e67692dc0c422f30059fe78d027c8f3f84a630f8685e4ff2e9683ee2b8`. Use streaming SSE exclusively for inference. Request scoped relationships, evidence IDs, falsifiers and predictions across steps without supplying an operation taxonomy. Capture raw events, completion status, tokens and elapsed time. Freeze each initial response before withholding is lifted.
3. Independent verifier scores both arms against identical sealed cases. Normalize equivalent claims by observable obligations and predictions. Compare duplicates against the baseline and score inferred purpose separately. Preserve contradictions and request targeted revisions only after primary scoring.

Include three fresh-workspace repeats per subject. Proposed withheld variants include altered fixture contents with the same sequence, omission of the second recording action, and an unknown target identifier as a negative control. The evaluation bundle must specify exact variants and independently check file bytes, artifact presence, exit outcome, and visible history at each relevant boundary. Establish the oracle from executable evidence and independent state checks before discovery. Record discrepancies between the oracle and documented expectations for later context experiments.

## Quantitative criteria

- **H1, per subject.** At least one arm must reproduce the same qualified relationship in at least two of three fresh-workspace repeats. The relationship must span at least two distinct activities and predict at least two observable outcomes across at least two different workflows, including at least one withheld variant. All preregistered obligations for the claim must hold and the negative control must respect its stated scope. Count a verified dependency under H1 only when it also meets the compositional relationship criteria.
- **H2, per subject.** At least one H1-eligible relationship must appear independently in at least two of three model runs and be absent from the sealed baseline by observable obligations and predictions. Different labels for an equivalent baseline prediction add zero. Score H2 independently even if both arms satisfy H1.
- Record dependencies, compositional relationships, and exploratory capabilities separately. Report verified, unsupported and contradicted claims, workflow coverage, repeatability, setup, acquisition and verification times, inference latency, tokens, transcript validity, and cost per verified incremental contribution. Report a zero denominator as undefined with zero verified contributions.
- Publish four separate conclusions covering KeepSafe, MVS, H1 across the two subjects, and H2 across the two subjects. Report split outcomes as such. Preserve negative findings, limitations, raw evidence and comparative plots.

Before formal execution, seal the exact visible and withheld fixtures, repeat schedule, oracle, scoring rubric, source and skill digests, qualified runtime, baseline version, model settings, and acceptance criteria in a run manifest. Keep the oracle and withheld observations outside discovery inputs. Establish tool and environment readiness independently of those cases. Publish a runtime estimate before the formal run.

The independent Hello World comparison remains its own research item and is outside the CU-1 readiness gate.


## Initial frozen condition

The driver seals all inputs before execution. Each subject runs three fresh-workspace repeats. The discovery packet exposes aligned observed state with opaque activity identifiers and stays isolated from the other subject and from held-out cases. Colibri uses the frozen skill with a compact equality and inequality prediction response protocol. The initial condition uses 3,072 completion tokens, temperature zero, SSE streaming and usage reporting. The model alias is recorded. The response protocol bounds the measured contribution to predictions expressible through these comparisons. Missing or malformed responses yield no scoreable model claims and are reported separately from scientific contradictions. The unknown-target variant acts as a run-level prerequisite oracle check.
