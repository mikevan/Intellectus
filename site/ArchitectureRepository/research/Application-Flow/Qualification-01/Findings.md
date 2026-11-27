# Qualification 01 findings — Simple Hello World

**Outcome:** Did not qualify. The deterministic verifier agreed with all 18 oracle observations. Both independent Colibri responses reached the frozen token limit and were byte-identical. Their partial responses contain a useful proposed test and a behavior rule that the proposed test contradicts.

## Results

| Measure | Deterministic observation baseline | Colibri Run 01 | Colibri Run 02 |
| --- | ---: | ---: | ---: |
| Discovery observations available per subject | 3 | 3 | 3 |
| Verified novel relationships admitted | 0 | 0 | 0 |
| Contradicted material relationships in available output | 0 | 1 | 1 |
| Concrete useful disconfirming probes proposed | N/A | 1 | 1 |
| Whole-scope equivalence asserted from samples | No | No | No |
| Complete model response | N/A | No | No |
| Reported input / output tokens | N/A | 649 / 1,536 | 649 / 1,536 |
| Inference request time | N/A | 792.994 s | 759.250 s |

The one directly grounded candidate concept was a greeting linked to an optional text input. The response identified variation in the name portion and constancy of the observed prefix. It did not establish independent dimensions. The suggested comparison changes both the name and prefix and therefore would not isolate independence.

The proposed conditional relationship says an omitted argument yields the World greeting and a present argument yields the supplied text in the greeting. Interpreted literally over the declared scope, the present-argument rule matches five of six withheld outputs for A and six of six for B. The discrepancy is the explicitly empty string. A returns Hello, World! while B returns Hello, !. The rule also lists empty strings as an open question, so the partial answer does not resolve its own scope consistently. The comparison below is diagnostic and earns no qualification credit.

~~~mermaid
xychart-beta
    title "Literal candidate rule on withheld inputs"
    x-axis ["Subject A", "Subject B"]
    y-axis "Matching predictions out of six" 0 --> 6
    bar [5, 6]
~~~

The two programs agreed on all three discovery cases. Colibri restricted that observation to the supplied cases and identified an explicit empty string as a discriminating probe. The independent verifier confirmed that probe distinguishes the programs. This is useful hypothesis generation beyond the observation-only baseline, while the probe was already in the frozen oracle and the model did not establish the correct rule for A. No additional semantic knowledge was admitted as qualified.

## Interpretation and limits

The frozen criteria require complete responses and a relationship without contradictions in its stated scope. Neither replicate passed. The repeated output under identical zero-temperature settings shows repeatability for this request and runtime, not robustness to new samples or model settings. A familiar greeting pattern could draw on prior model knowledge. The baseline recorded observations and did not attempt deterministic rule induction, so this result does not compare Colibri against a synthesizer. No throughput or energy comparison against other configurations was made.

Combined live request time was about 25 minutes 52 seconds, above the 8–20 minute estimate. The requests used 4,370 reported total tokens. The skill, evidence packets and settings remained frozen. Keep acquisition, candidate generation, and adjudication separate. Do not advance to the parameterized experiment until this failure mode is understood. A follow-up protocol could test a larger response budget or a smaller output scope as an explicit experimental condition, leaving these runs and their criteria intact.

## Reproduce and inspect

Run python -B qualify.py --verify-only from this directory for the deterministic check. In a fresh copy without prior output files, run python -B qualify.py with the recorded Colibri configuration to repeat both requests.

- [Frozen protocol](Protocol.md)
- [Frozen skill](Frozen-Skill.md)
- [Deterministic baseline and verification evidence](baseline.json)
- [Replicate 01](replicate-01.json)
- [Replicate 02](replicate-02.json)
