# RT-5 draft protocol â€” implementation-independent behavioral convergence
**Status:** Proposed for owner review; not frozen, not executed.

## Primary question
Can independently structured benign programs with the same observable relationship converge on one scoped behavioral identity while programs with materially different outcomes remain distinguishable? Secondary exploratory question: can the specialists derive a compact representation without being supplied the expected formula? No claim of universal understanding, nor is exhaustive enumeration evidence of autonomous concept formation.

## Declared observation contract
A pure deterministic function takes two mathematical integers a in [0,30] and b in [0,1]. Only normal termination and returned integer are observed, with no external state, effects or I/O. Inputs are positional and no business terminology is supplied. 62 input tuples. Python and TypeScript use exact integers in this range. The verifier checks all 62 values per implementation. Unexpected exceptions or observable effects violate the contract; they must not be normalized into a successful mapping.

## Fixture design (verifier-only proposed truth)
Use a separately authored fixture package and independent oracle; details below are protocol metadata, not inputs to discovery workers. Six subjects with opaque randomized identifiers using fixed seed 261126; the mapping from IDs to fixture truth is retained by verifier only.
- A: Python, redundant branches and temporary binding, returns a + 3 + 2*b.
- B: TypeScript, direct arithmetic expression, same relationship.
- C: Python, loop-based addition using bounded iteration, same relationship.
- D: TypeScript, lookup of premium by binary input followed by base offset, same relationship.
- E: Python, base offset +4 instead of +3; different for every input.
- F: TypeScript, same relationship except a=30,b=1 returns one more; late-difference control.
The exact source bytes, oracle bytes, seed, contract and test configuration must be frozen and hashed separately before execution. Do not expose oracle source or this fixture-truth section to discovery. The structural specialist may see corresponding source; all others receive only their allowed evidence; record information flow. RT-5 does not establish business intent from arithmetic.

## Procedure
1. Build and qualify the full modular seven-specialist architecture and local Colibri inference first; do not assume it is already functional. Record each method and model version.
2. Acquire observations through controlled execution of authored fixtures only. Start with discovery subset a in [0,1,5,10,15,20,29], b in [0,1] (14 pairs per subject). Remaining 48 pairs are held back for independent verification; the late control is among them. If discovery needs more evidence, request a bounded observation batch and log it. The held-back verifier may reveal counterexamples after an initial claim but must retain the original claim and first-pass result.
3. Collect independent specialist packets, reconcile candidate representations, and capture status before verification. The domain specialist may report unknown or not applicable; no forced business hypothesis.
4. Independently execute all 62 inputs for each subject and compare with the frozen oracle. Verify proposed representations over the full scope. Create canonical complete mappings only from verified observations, not the supplied expected formula. Compare canonical bytes and digest.
5. Compare Aâ€“D against one another; distinguish E and F from the equivalent group and each other. Evaluate counterexample handling and unresolved claims. A valid counterexample invalidates a contradicted hypothesis regardless of committee agreement.
6. Repeat from clean data directories with independently started services and no reuse of prior conclusions. Compare verified conclusions and canonical mappings, not nondeterministic model prose. Record artifacts and runtime/service evidence. RT-6 isolates blind discovery; RT-7 examines committee contribution and ablation. RT-5 must not conflate behavioral convergence with those later hypotheses.

## Predictions and acceptance
| Gate | Prediction / criterion |
|---|---|
| Equivalent group | Aâ€“D all share exact canonical bytes and behavioral identity under declared contract |
| Negative controls | E and F differ from the group and each other; F's first-pass ambiguity is recorded, not concealed |
| Independent obligations | All observed mappings match their own independently frozen oracle across 62 tuples |
| Verification integrity | No contradicted, incomplete or out-of-scope claim receives verified status |
| Structural distinction | Record legacy structural fingerprints where supported; unsupported loop or lookup is reported, not treated as matching evidence |
| Reproduction | Same verified mapping and decisions on the declared equivalence partition across both complete runs |
| Compact representation | Exploratory: classify discovered relationship as exact, contradicted, or unresolved; do not make enumeration masquerade as discovery |

Measure six subjects Ã— 62 = 372 independent execution cases per complete run, initial candidate correctness, counterexample count, verified and unresolved claims, distinct identities, time and CPU/GPU/memory where available. Record actual counts, not just predicted ones. No source generation or optimization gate in this experiment; RT-11 targets synthesis after knowledge acquisition. Preserve every failed prediction. No RT-5 execution until reviewed protocol and concrete artifacts are frozen.
