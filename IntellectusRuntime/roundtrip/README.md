# Experiment RT-1: Python -> Understanding -> TypeScript -> Understanding -> Python

Question: can a restricted semantic model reconstruct a working business algorithm in a different language, re-encode it, remove redundant decisions, and express the improved implementation back in the original language?

Domain: total in integer cents, 0 to 1,000,000,000 inclusive; membership is integer 0 or 1. Output is integer discount percentage, not money or rounding. Independent requirements: at >=10000 cents member 15%, non-member 5%; below threshold member 5%, non-member 0%.

Prediction: actual Understanding encoders preserve the original fingerprint through TypeScript; eliminating equal arms preserves required outputs over the declared domain and reduces all three established source complexity measurements. Negative control moves the threshold to 10001 and must fail the obligation oracle.

Results: run-01/results.json records 40,004 cases per implementation (all amounts 0..20000, both memberships, plus 1e9; boundary representatives cover the constant-output decision partitions of this restricted tree). Original, generated TypeScript and reconstructed improved Python independently executed in separate processes and agreed with the requirement oracle. Negative Python differs at 10000 for both membership states; its fingerprint differs. Two bottom-up identical-arm eliminations reduce scores from 6/16/21 to 4/8/7 (cyclomatic/Campbell/MBCC). The optimized fingerprint differs from the original deliberately; fingerprint equality is not the equivalence criterion for an optimization. The benchmark is local, nine alternating samples of 200,010 calls per implementation, medians 26.4085 ms and 21.4468 ms; noisy timing is not a guarantee.

Generation uses serialized semantic IR, not original source, and separate language renderers with canonical parameter names. The first generated TypeScript uses unoptimized IR; Python is regenerated only from re-ingested TypeScript after transformation. This is a direct Node bridge experiment, not an OSGi service qualification. Renderer refuses everything except pure terminating integer decision trees; no general-purpose reconstruction, arbitrary source optimization, or proof beyond the declared domain is claimed. No changes to frozen Understanding or Complexity.

Run from the Intellectus repo:
  node IntellectusRuntime/roundtrip/roundtrip.mjs C:\workspace-Intellectus
A fresh output directory is generated. Python and Node 22 with TypeScript stripping must be available; Understanding and Complexity must already be built. Optional INTELLECTUS_PYTHON and INTELLECTUS_COMPLEXITY override their paths.
