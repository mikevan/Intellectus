# RT-2 — Proposed experimental protocol and RT-1 correction register

**Status:** Draft for review; not executed. November 25, 2026.

RT-1 remains unchanged, including its source, report, results, and manifest. Its limited direct-bridge result stands on its own evidence. RT-2 is a new experiment rather than a replacement for RT-1.

## Corrections to carry forward

| RT-1 limitation or style issue | RT-2 required remedy | Evidence required |
|---|---|---|
| Experimental renderer/harness acts as language adapter | Locate interpretation and expression behind distinct LinguisticPython and LinguisticTypeScript service contracts; use fixture-independent interfaces | Service descriptors, adapter-specific tests and actual invocation trace |
| Direct Node bridge instead of real Karaf lifecycle | Execute the round trip through dynamically discovered OSGi services, provision only required capabilities | Actual Karaf service registry and lifecycle logs, including provider identity |
| Persistence not exercised in the round trip | Store the complete supported Understanding evidence, unload the originating adapter, reload knowledge and continue reconstruction | Persisted model, hashes, lifecycle trace and reconstructed source generated without original source |
| Fixture supplies function names, domain and oracle | Clearly separate declared API and business obligations from observed semantics; retain declared metadata explicitly rather than implying it was inferred | Provenance and declaration register |
| Framework/domain facts not exercised | Preserve Lexicon<Framework> and Lexicon<Domain> naming and boundaries; do not manufacture framework dependency for a plain-language fixture | Explicit scope statement and module inventory; if used, separate lexicon provenance |
| Narrow constant-return decision tree | Extend to arithmetic, intermediate values and multiple cooperating functions within explicitly defined semantics | Independent execution, supported semantic coverage and negative controls |
| One negative control | Add wrong arithmetic, incorrect threshold and altered cooperating-function behavior controls | Expected counterexamples detected by independent oracle |
| Optimization was programmed, not autonomously inferred | State exactly which independently testable transformation rules run and why each is valid | Transformation trace and preconditions; avoid unsupported general claims |
| Deterministic rerun not a lifecycle rerun | Reproduce the actual service-mediated experiment separately; compare deterministic artifacts | Repeat run, manifest, and independently checked registry events |

## Proposed sequence

1. Specify a small independently authored business rule with a deliberately redundant two-function Python implementation. Define integer bounds and arithmetic semantics; avoid ambiguous cross-language coercion, overflow, or rounding.
2. Freeze the independent business obligation oracle, exact fixture, target representation coverage, supported language contracts, transformation rules, and predictions before implementation.
3. Provision LinguisticPython in Karaf; encode the fixture into Understanding. Persist the supported model and report any unsupported semantics. Unload the source adapter and establish that knowledge survives.
4. Provision LinguisticTypeScript and reconstruct from persisted knowledge only. Execute generated TypeScript against the independent oracle. Re-encode it into Understanding.
5. Apply approved, explicitly recorded semantics-preserving transformation rules to the reconstructed model. Persist and independently reload the result.
6. Reprovision LinguisticPython. Express the transformed model as improved Python without using original source as a template; re-encode and independently execute it.
7. Compare the original, TypeScript and improved Python against the independent oracle, including boundary and representative cases. Measure established Complexity metrics using the real library; report timing separately if performed.
8. Verify negative controls and unsupported-construct behavior; repeat the test in a new run directory and preserve the evidence.

## Proposed acceptance gates

- Correct service names and module boundaries; real dynamic discovery and selective activation are demonstrated.
- Persisted Understanding evidence is available after unloading and reloading adapters; no hidden source-template dependency.
- All independently specified business obligations hold for the intended implementations within the declared domain.
- Each claimed optimization is evidenced by a specific transformation and a measured improvement; all named regressions are detected.
- Declared evidence covers arithmetic, intermediate values and cooperating functions; unsupported semantics are visible, not silently fabricated.
- Reports identify every failed prediction without rewriting the protocol. No claim of universal semantic sufficiency or automatic optimization.

## Before implementation

Freeze the exact fixture, oracle, runtime service and persistence contracts, transformation rules, predictions, and measurable acceptance criteria for review. This draft records the correction direction; none of its gates has yet been executed. Use a new RT-2 directory and leave RT-1 untouched.
