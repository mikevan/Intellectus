# Intellectus Research Experiment RT-1

**Title:** Cross-language semantic reconstruction and decision-tree optimization  
**Date:** 2026-11-25 (America/Chicago)  
**Status:** Passed within the declared experimental domain; independently reproduced.  
**Classification:** Internal research evidence.  
**Scope:** Python -> Understanding -> TypeScript -> Understanding -> Python.

## 1. Abstract

RT-1 investigates whether a working but deliberately redundant business rule can be encoded by Understanding, reconstructed as TypeScript, encoded again, improved at the semantic representation level, and expressed back in Python without using the original Python source as a reconstruction template. The original Python, generated TypeScript and reconstructed Python each satisfy the same independent business-rule oracle on 40,004 input pairs. The final Python has lower cyclomatic complexity, Campbell cognitive complexity and MikeVan's Better Cognitive Complexity (MBCC). A controlled threshold mutation was detected by both the behavioral oracle and the semantic fingerprint. A second execution of the installed experiment produced byte-identical deterministic evidence files.

The result establishes a restricted feasibility demonstration, not general-purpose translation, complete semantic sufficiency, or automatic improvement of arbitrary software.

## 2. Research question and hypothesis

**Question:** Can semantic reconstruction across languages preserve a business obligation while allowing a verified improvement in the original language?

**Prediction (defined before the run):**

1. Python and generated TypeScript will have identical intrinsic fingerprints.
2. The re-encoded TypeScript IR will be sufficient for the restricted renderer to produce Python without the original source as an input to reconstruction.
3. Eliminating pure conditional nodes whose two terminating arms are identical will preserve output behavior in the declared domain.
4. All three existing complexity measurements will decrease.
5. Changing the effective threshold from 10,000 to 10,001 will cause observable disagreement with the independent requirements and a different fingerprint.

A runtime timing measurement is descriptive, not an acceptance gate.

## 3. Experimental materials and environment

- Understanding IR schema: 6.
- Python encoder: python-adapter/0.9.
- TypeScript encoder: typescript-adapter/0.5.
- Bridge contract: 0.1, explicitly reports partial semantic representation.
- Understanding baseline: November 2 P0, previously qualified as build d7efd55eb399 with 181 passing tests.
- Complexity: @projectrevivesolutions/complexity 1.0.21, unmodified established metrics.
- Reproduction environment observed: Windows, Node v22.23.2, Python 3.14.2.
- Execution: direct Node bridge, independent Python and Node subprocesses. It was **not** an OSGi/Karaf service lifecycle experiment.
- Fixture and renderer are intentionally small, deterministic and inspectable.

No Understanding source, frozen corpus, or Complexity threshold was changed for RT-1. This experiment does not imply that the whole November baseline was requalified on each invocation.

## 4. Independent business requirements

Inputs are integer total cents in [0, 1,000,000,000], and membership 0 or 1. Output is an integer discount percentage, not a discounted price or a monetary rounding computation.

| Total purchase | Membership | Required return |
|---|---:|---:|
| Below 10,000 cents | 0 | 0 |
| Below 10,000 cents | 1 | 5 |
| At least 10,000 cents | 0 | 5 |
| At least 10,000 cents | 1 | 15 |

The independent oracle is implemented in the experiment harness as a separate expression of these requirements, not as a call to the original implementation:

    total >= 10000 ? (member === 1 ? 15 : 5) : (member === 1 ? 5 : 0)

No conclusions apply to floating point inputs, negative amounts, membership other than 0/1, exceptions, side effects, external systems, or identity of parameter names.

## 5. Original Python: experimental control

~~~python
# Intentionally redundant implementation; returns integer discount percentage.
def discount(total, member):
    if total >= 10000:
        if member == 1:
            if total >= 10000:
                return 15
            else:
                return 15
        else:
            if total >= 10000:
                return 5
            else:
                return 5
    else:
        if member == 1:
            return 5
        else:
            return 0

~~~

The two redundant comparisons under the high-total branch have identical outcomes. The original is deliberately inefficient, not an example of a defect in an external application.

## 6. Method

1. Read original.py and call the existing Python encoder through bridge.mjs. Store its output as semantic-1.json, including source SHA-256, encoder, IR schema, executable and fingerprint.
2. Reload semantic-1.json. Render only the function IR to TypeScript. The renderer has a fixed function name/API for this fixture and synthesizes positional parameter names p0 and p1. It does not use source text or original lexical names to reproduce implementation structure.
3. Execute the generated TypeScript independently and feed its actual generated source to the existing TypeScript encoder. Save semantic-2.json. Require one executable and the same intrinsic fingerprint as the original.
4. Reload semantic-2.json. Recursively visit branch arms bottom-up and replace a branch with its arm only when the two transformed arms are structurally identical. Record the two actual transformations. The restricted validator permits only terminating decision trees, comparisons of positional inputs against integer literals, and integer returns. It rejects unsupported or opaque statements in that tree.
5. Persist the optimized IR to semantic-optimized.json. Reload it and render Python. Re-encode the reconstructed Python into semantic-3.json and require that its fingerprint matches the optimized IR.
6. Build a negative control from the optimized IR by changing the outer threshold, render it to Python, and re-encode it.
7. Independently execute original.py, generated.ts, improved.py and negative.py in separate subprocesses. Each process receives the same JSON array of input pairs. Compare genuine execution outputs with the independent oracle. Complexity uses the actual source of each implementation and the existing Tree-sitter based Complexity library, not a hand count.
8. Retain the models, source files, transformation trace, result JSON, and timing evidence. Run the installed version a second time in a separate directory and compare deterministic artifacts by SHA-256.

The transformation is a deliberately narrow, explicitly programmed rule over semantic IR. No LLM selected a rewrite; Understanding did not autonomously discover arbitrary optimization rules. The renderer and optimizer are external experiment-harness code, not a general Understanding emitter.

## 7. Generated TypeScript (unoptimized)

~~~typescript
export function discount(p0: number, p1: number): number {
    if (p0 >= 10000) {
        if (p1 === 1) {
            if (p0 >= 10000) {
                return 15;
            } else {
                return 15;
            }
        } else {
            if (p0 >= 10000) {
                return 5;
            } else {
                return 5;
            }
        }
    } else {
        if (p1 === 1) {
            return 5;
        } else {
            return 0;
        }
    }
}
~~~

## 8. Semantic optimization and final Python

The first transformed node is body.then.then and the second is body.then.else. Both compare input 0 using GE against literal 10000. In each case the two arms return the same constant, so evaluating the comparison cannot change the result for the declared, pure integer domain. The optimizer replaces each branch by its identical arm; it does not change the effective outer threshold, membership test, or output values.

The final Python is:

~~~python
def discount(p0, p1):
    if p0 >= 10000:
        if p1 == 1:
            return 15
        else:
            return 5
    else:
        if p1 == 1:
            return 5
        else:
            return 0
~~~

## 9. Results

### 9.1 Behavioral test design

The harness tests every integer amount from 0 through 20,000 inclusive with both membership values (40,002 pairs), plus the declared domain maximum of 1,000,000,000 with both memberships (2 pairs). It collects threshold neighbors from all four semantic trees. The two thresholds in this experiment, 10,000 and 10,001, and their neighbors are already included. Total: 40,004 distinct pairs per implementation, not 40,004 separately named test functions.

For this restricted family of constant-return decision trees, there are no arithmetic transformations or hidden effects in the validated IR. The comparisons divide the integer domain into constant-output cells. The samples include representatives of all such cells; this supports the declared-domain result subject to the restricted-source and encoder assumptions. It is not brute-force enumeration of all 2,000,000,002 possible pairs, nor proof of general semantic equivalence.

| Implementation | Cases | Oracle matches |
|---|---:|---:|
| Original Python | 40,004 | 40,004 |
| Generated TypeScript | 40,004 | 40,004 |
| Improved Python | 40,004 | 40,004 |
| Negative Python | 40,004 | 40,002 |

Total successful business-rule comparisons for the three intended implementations: 120,012. The experiment reports one successful qualification, not 120,012 separately authored unit tests.

### 9.2 Complexity

| Metric | Original Python | TypeScript | Improved Python | Change |
|---|---:|---:|---:|---:|
| Cyclomatic | 6 | 6 | 4 | -33.3% |
| Campbell cognitive | 16 | 16 | 8 | -50.0% |
| MBCC | 21 | 21 | 7 | -66.7% |

Default thresholds 15/12/15 are unchanged. Original exceeds Campbell and MBCC defaults, improved is below all three. Complexity measurements describe source structure, not an independent semantic equivalence claim.

### 9.3 Fingerprints

| Stage | Fingerprint |
|---|---|
| Original Python | 3d87c9d70f031ae2b5603ac6 |
| TypeScript | 3d87c9d70f031ae2b5603ac6 |
| Improved Python | 9eb28f76ba70803e2120d9a8 |
| Negative control | 7030dd76cf3cdbae25cdcf9e |

The optimized fingerprint differs from the original because redundant decisions have been removed. Matching fingerprints can support structural correspondence; changed fingerprints do not automatically imply changed business behavior. This experiment qualifies optimization using the independent obligations, not equality of original and optimized fingerprints.

### 9.4 Negative control

The outer threshold is changed from 10,000 to 10,001. At total 10,000 and member 0 the requirement is 5 but the mutant returns 0; at total 10,000 and member 1 the requirement is 15 but the mutant returns 5. The independent oracle detects both counterexamples and the negative fingerprint differs. The control tests whether the experiment can identify a plausible incorrect simplification.

### 9.5 Timing

Separate Python benchmark, nine alternating samples per implementation, 200,010 function calls per sample. Same input order and workload; a checksum of return values is compared during warm-up. Medians:

- Original: 26.4085 ms.
- Improved: 21.4468 ms.
- Observed reduction: 18.79%.

Raw samples are in run-01/benchmark.json and show variability and overlap. This measurement includes the loop and Python function invocation overhead, is not calibrated for CPU frequency or machine load, and was not timing-reproduced in the deterministic rerun. No universal performance improvement is claimed.

## 10. Reproduction and audit

Primary evidence: C:\workspace-Intellectus\IntellectusRuntime\roundtrip\run-01.

Independent execution of the installed harness: C:\workspace\Intellectus-roundtrip\verification-20261125-220021. All nine deterministic artifacts (generated.ts, improved.py, negative.py, results.json, semantic-1.json, semantic-2.json, semantic-3.json, semantic-optimized.json, transformations.json) were compared byte-for-byte using SHA-256; all matched. Benchmark is deliberately excluded because timing is noisy and was not rerun.

To reproduce from an existing Intellectus working tree, build Understanding and Complexity if necessary. Run Node 22 and Python on PATH:

~~~powershell
cd C:\workspace-Intellectus
node IntellectusRuntime/roundtrip/roundtrip.mjs C:\workspace-Intellectus
~~~

A new results directory is created under the roundtrip directory. The harness refuses an existing output directory. For timing, pass the new improved.py path to benchmark.py.

Inspect roundtrip.mjs for validation, rendering, optimizer, independent oracle, subprocess runners, metric invocation and the result assertions. Inspect the JSON models to follow individual predicates and returns through the complete trip. The source and its provenance are separate from the intrinsic fingerprint.

## 11. Claim-to-evidence register

| Claim | Evidence | Status |
|---|---|---|
| Python -> TypeScript is reconstructed using serialized IR | semantic-1.json, roundtrip.mjs, generated.ts | Established for fixture |
| TypeScript can be re-encoded | semantic-2.json, results.json | Established |
| Python can be generated from the re-encoded, transformed IR | semantic-optimized.json, improved.py, semantic-3.json | Established for fixture |
| Business obligations preserved | results.json, independent runners and oracle | Established within declared scope |
| Complexity reduced | results.json, actual Complexity library invocation | Established |
| Test detects wrong threshold | negative.py, results.json, counterexamples | Established |
| Deterministic output reproducible | independent rerun and identical hashes | Established |
| Persistent journal can hold entire semantic model | Not exercised in RT-1; previous separate persistence trial only | Not established in RT-1 |
| Dynamic Karaf service lifecycle during round trip | Direct bridge only | Not established |
| Arbitrary software can be reconstructed and optimized | Restricted fixture and renderer | Not established |
| Broad cross-language equivalence or general improvement rules | No arbitrary effects, loops, concurrency, objects, calls, data flow or unrestricted input semantics | Not established |

## 12. Known limitations and follow-up

The IR bridge still identifies its output as partial, and the proof does not show source-level identifiers, complete spans, application-level composition or all semantic relationships are recoverable. The harness supplies the fixture function name, type/domain contract and required oracle; it is not an automatic inference of a business domain. It does not validate an independently implemented renderer against an independently authored semantic specification beyond the oracle. The fixture and experimental optimizer were deliberately designed together. The negative control is one mutation, not a comprehensive mutation battery. No claim is made that Karaf or a persistent semantic journal executed this round trip.

RT-2 may extend this controlled method to arithmetic, intermediate values and multiple cooperating functions, but only after this record is reviewed. It should use a frozen protocol and an obligation oracle independent of the target implementations.

## 13. SHA-256 evidence manifest

Paths are relative to the installed roundtrip directory. These hashes establish the exact research artifacts inspected for this report, not the authenticity of an external publisher.

~~~text
AAFFE964F896F3BBCD63FAAC9BE9FD884943FF58A1E0D264775E6668FA9B7F9D  benchmark.py
AB2B99F3BFDA82F1F3103C7D4564126E8CEF05224067CEF4C0EC473F5DC89177  original.py
B12D863642E59E5375805417A45F2AEB82E742C54605C5138FEDE1BECEE355D5  README.md
E77ED511597FCA9E9AC9810506AEFA08314A94E6A9E1517980533189EC29AF95  roundtrip.mjs
2B19CC7EB4AEF2B7A6188450BE35B54812DAE3AD8AC269BC8CA48D4B64CF80E2  run-python.py
9E92210EE4FC3C8F13EFEC9C31BE9736E029B9AB3425C1D60B73A2D0E1C8E420  run-typescript.mjs
92F8E34F56A8BDE20028154E1B8CE601355F4FBBA87EA490B33C4720BD9801AB  run-01\benchmark.json
7DD21F2E2C5B0D80B5B9621D32539479F6B02ED47A0AAC55AD55C84FCB93282E  run-01\generated.ts
0A88BCBAFA7F3D1103C83EC00BB86ABAA8015FC2750EA0B769A11F4F00451053  run-01\improved.py
D65B341C95CAFC3DAC2FCA3AA36CBEB25DE88D111B13064804F692D325E5078A  run-01\negative.py
1478F0922994711F89796F040F427AD603E391CFD924C472AFC6DC760123A2A6  run-01\results.json
8F70CD4AADA12A9B80765A05DE07ED164E41123B0A0500E726AA254FB2113E32  run-01\semantic-1.json
A025B2D032112E45836F253F84D181FA36EB9ECBDADB8601F8AA767DD724F373  run-01\semantic-2.json
F721CABB51ADC1F2E8A4E1B4C063020EDA27366DE269F6B85224C272E6D7C8FD  run-01\semantic-3.json
28095B9E3ACC3C3708A0E67031E3BE3CC3AA4C83A87BA1E1460A474C55C2DB3B  run-01\semantic-optimized.json
F31E96D2475770442381A3BF2425AEE929A1538D7FEE0E22AF67F8C7E57BA398  run-01\transformations.json
~~~
