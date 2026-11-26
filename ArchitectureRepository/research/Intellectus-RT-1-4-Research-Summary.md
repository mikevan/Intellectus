# Intellectus — RT-1 through RT-4 Research Summary
## Finding: language independence is not implementation independence

**Author:** Michael Van Geertruy, with ChatGPT  
**Date:** November 25, 2026 (Central time)  
**Classification:** Internal research evidence  
**Disposition:** RT-1 through RT-4 complete. Semantic-model redesign required before RT-5.

## 1. Executive conclusion

The four round-trip experiments successfully established restricted cross-language reconstruction, behavior preservation, controlled optimization, repeatability, and, from RT-2 onward, dynamic OSGi service activation with independent semantic snapshot persistence. They also revealed that the present representation does not meet the central objective of Intellectus.

The current representation is language-neutral but remains implementation-dependent. It preserves the original program's control-flow and binding structure, including decisions that do not affect the declared obligations. It can function as an intermediate representation for translation, but it does not yet demonstrate an implementation-independent model of what the software accomplishes.

This is a research finding, not a reason to invalidate or rewrite the earlier experimental records. The experiments passed their declared operational gates; collectively, they exposed a failure to achieve the broader research objective.

**Decision:** Redesign the semantic model before conducting RT-5. Retain the current intermediate representation and the runtime work as useful evidence and infrastructure, not as proof that the desired semantic model has been achieved.

## 2. Michael's research finding

The project owner stated:

> I thought that the use of the semantic model would implicitly optimize the code because the semantic model is only concerned with what is being done, not how it is implemented. Remember, in this new methodology, how code is written isn't considered until after the actual semantic model is created. So, the question is whether the current semantic model is just another programming language in different clothing. If that's the case, then we haven't created a semantic model at all, we've simply written an intermediate language that is used to move from one language to many others. While that has value, it isn't our current goal.

This finding changes the interpretation of the experiment series: reconstructing deliberately bad code faithfully proves structural preservation, not the desired separation of meaning from implementation. A semantic model should describe the software's required outcomes and constraints before code is selected or generated. The method by which those outcomes are realized belongs to a subsequent implementation decision.

## 3. Experiment comparison

All trials used Python → Understanding → TypeScript → Understanding → Python. Optimization in RT-1 and RT-2 was an explicit programmed equal-arm elimination, not an emergent consequence of semantic representation.

| Experiment | Fixture | Runtime | Explicit optimization | Result |
|---|---|---|---|---|
| RT-1 | One function; redundant threshold checks | Direct Node bridge | Yes; two duplicate-arm branches removed | Behavioral obligations hold; structural fingerprint changes after optimization |
| RT-2 | Two cooperating functions; arithmetic, local binding, redundant decision | Karaf / OSGi services, independent snapshot store | Yes; one duplicate-arm branch removed | Behavioral obligations hold; discount fingerprint changes, base unchanged |
| RT-3 | Exact RT-1 fixture | RT-2 architecture; local-only Karaf configuration | None | Original redundant branches, fingerprint, and entire encoded IR preserved |
| RT-4 | Exact RT-2 fixture | Same RT-3 orchestration and RT-2 bundles | None | Both executable IR objects, calls, arithmetic, binding, redundancy and fingerprints preserved |

| Experiment | Cyclomatic (discount) | Campbell cognitive (discount) | MBCC (discount) | Oracle cases passed per implementation | Deterministic artifacts matched across runs |
|---|---:|---:|---:|---:|---:|
| RT-1 | 6 → 4 | 16 → 8 | 21 → 7 | 40,004 | 9 |
| RT-2 | 3 → 2 | 5 → 2 | 6 → 1 | 202 | 11 |
| RT-3 | 6 → 6 | 16 → 16 | 21 → 21 | 40,004 | 6 |
| RT-4 | 3 → 3 | 5 → 5 | 6 → 6 | 202 | 6 |

The existing complexity definitions and default thresholds (15 / 12 / 15) remained unchanged. The counts refer to cases executed per intended implementation, not separately authored unit tests. RT-1/RT-3 sampled representatives of the decision partitions; RT-2/RT-4 exhaustively exercised the 202 declared input pairs. The RT-1 timing observation was descriptive only and did not establish general performance improvement.

## 4. Why the finding is supported

### 4.1 RT-1 and RT-3: identical outputs do not imply identical current fingerprints

The original single-function fixture implements this business obligation:

| Total cents | Member | Discount percentage |
|---|---:|---:|
| Below 10,000 | 0 | 0 |
| Below 10,000 | 1 | 5 |
| At least 10,000 | 0 | 5 |
| At least 10,000 | 1 | 15 |

Declared domain: integer totals 0..1,000,000,000 and member 0 or 1. The two nested redundant threshold checks do not change any result in this pure decision tree.

- Original Python, generated TypeScript and unoptimized reconstructed Python: fingerprint 3d87c9d70f031ae2b5603ac6.
- Explicitly optimized Python: fingerprint 9eb28f76ba70803e2120d9a8.
- Negative threshold mutation (10,000 → 10,001): fingerprint 7030dd76cf3cdbae25cdcf9e; two oracle counterexamples.

The current hash distinguishes both implementation changes that preserve the obligation and an actual obligation change. Thus it is a useful structural fingerprint, but not an identity of implementation-independent meaning under this domain contract.

RT-3 provides the decisive control: without explicitly transforming the intermediate representation, the redundant decisions reappear in reconstructed Python.

### 4.2 RT-2 and RT-4: the same finding generalizes to the more complex fixture

For integers total 0..100 and member 0 or 1, the declared outcomes are base(total) = total + 3 and discount(total, member) = total + 3 + 2 × member. The original implementation calls base, assigns its result to an intermediate variable, and tests total >= 10 within the member branch; the two arms are identical.

| Function | Original/TypeScript/RT-4 fingerprint | RT-2 optimized fingerprint |
|---|---|---|
| base | ff1f89439ef6967f15034b25 | ff1f89439ef6967f15034b25 |
| discount | 767d9fd06e6439d4833b0cdd | ba1fcec209501ab1cb9b6ea4 |

RT-4 retained the complete binding/call/branch structure exactly. RT-2 changed the discount fingerprint when a redundant predicate was removed, despite the same outputs for every declared input pair. Negative controls changing base arithmetic, membership logic and premium were detected in 202, 202 and 101 cases respectively.

The current representation is therefore an implementation-shaped intermediate language for this tested slice. It contains semantic facts, but its identity is not sufficiently abstract to qualify as the target semantic model. This conclusion is scoped to the tested representation, not a claim that no part of Understanding represents semantics or that intermediate languages are intrinsically worthless.

## 5. What remains valuable

- Existing language adapters, encoders, renderers and structural fingerprints are a useful acquisition/translation baseline.
- RT-2 through RT-4 demonstrate actual Karaf service provisioning, stopping and restarting Python/TypeScript providers, and recalling persisted models without the originating provider active.
- Independent execution and negative controls distinguish genuine changes in business obligations from structural transformations.
- Reproduction and frozen evidence support research integrity.
- Structural information and lexical provenance may be valuable for diagnostics, traceability, exact-source reproduction, and complexity measurement, provided they do not dictate the identity of the intended semantic model.
- The prototype snapshot store is not the complete Understanding assertion journal, and the supported language fragment is deliberately restricted.

Preserve this infrastructure and all prior evidence. Do not discard the useful IR or rename historical results to make them appear to have tested the new objective.

## 6. Required redesign direction before RT-5

The owner has directed a redesign, not authorized a particular representation or implementation. The following are candidate design considerations for review rather than frozen architecture.

1. Distinguish evidence of implementation (what source actually does, including structure) from a model of required behavior (what must be accomplished).
2. Define the observational contract: domains, inputs, outputs, preconditions, postconditions, effects, ordering, exceptions, and other observable requirements where applicable. Do not erase a condition or ordering that has observable consequences.
3. Define an implementation-independent semantic identity for the supported domain. Meaning-equivalent implementations should converge despite gratuitous branch duplication, alternative control flow, temporary variable names, and nonessential decomposition; use separate structural fingerprints for those differences.
4. Treat behavioral equivalence, inferred intent and independently declared intent as distinct. Source may not reveal the intended business requirement, and uncertainty must remain explicit. An oracle used for verification must not be secretly used as a reconstruction template.
5. Select code generation only after the model exists. The generated implementation may be simpler without an explicit rewrite of the original control-flow tree because the model does not require irrelevant implementation structure. A synthesis strategy may still make tradeoffs; do not equate semantic modeling with a guarantee of globally minimal code.
6. Preserve optional structural/lexical evidence separately where needed for exact reconstruction. Public API names, effect ordering and other observable details may be semantic under a specified contract, even when internal naming is not.

Illustrative candidate for RT-1: a domain-qualified input/output relation represented by the four outcome cases in §4.1, not the source's repeated nested tests. For RT-2, a domain-qualified functional relation capturing the two exported obligations in §4.2, not a required temporary assignment or mandated internal call. These are examples of the target distinction, not a preselected formalism.

## 7. Proposed RT-5 research gate (not an approved or executed protocol)

Before RT-5, review and agree the redesigned representation, its relationship to legacy IR, the meaning of its fingerprint, its supported domain, and the method used to derive it. Freeze a protocol before any experiment implementation.

A discriminating experiment should use independently authored implementations of the same declared obligation with intentionally different control-flow structures, including the redundant and simplified RT fixtures; include an independently authored different-obligation negative control. Under a declared contract, require equivalent implementations to converge to the same semantic model/identity and negative controls to diverge. Verify generated code by independently executing the declared obligations; require that reconstruction is possible from the semantic model without relying on an original implementation-shaped tree or an optimizer that simply rewrites it.

A stronger later test can introduce different language idioms, decomposition, and observable effects to discover where the representation stops being sufficient. If information is unknown or equivalence cannot be established, report it instead of forcing convergence.

RT-5 must not merely demonstrate another successful structural round trip. Its primary question must test implementation independence. No RT-5 run has been performed or represented as complete. The linguistic sharding spike remains a separate research item and must not obscure the current redesign question.

## 8. Source evidence and status

- RT-1: C:\workspace\RT-1-Experiment-Report.md and C:\workspace-Intellectus\IntellectusRuntime\roundtrip\run-01
- RT-2: RT-2-Experiment-Report.md; C:\workspace\Intellectus-RT-2\run-03 and run-04
- RT-3: RT-3-Experiment-Report.md; C:\workspace\Intellectus-RT-3\run-01 and run-02
- RT-4: RT-4-Experiment-Report.md; C:\workspace\Intellectus-RT-4\run-01 and run-02

Historical experiment reports remain as written. This summary is the prospective research interpretation and redesign decision arising from the completed series.
