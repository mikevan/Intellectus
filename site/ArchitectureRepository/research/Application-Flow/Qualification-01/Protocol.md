# Semantic ontology discovery qualification 01 — Simple Hello World

## Question and hypothesis

Can the frozen skill propose a useful behavioral concept or relationship from observed output strings and state how the claim could be disproved? A model-assisted investigation can qualify here if it predicts behavior of the source workflow on withheld inputs beyond the deterministic observation baseline and keeps indistinguishable subjects unresolved.

## Controls and scope

Use the existing Python hello function as subject A and a deliberately different greeting function as subject B. Input scope is the finite cases in oracle.json, with one string or an omitted argument. Only returned text is observable. Both arms receive the same discovery observations, along with the instruction that two opaque subjects were independently executed. Both subjects look identical in the supplied evidence. Neither arm receives source, candidate concepts, expected conclusions, comparison outcomes, or withheld inputs. An observation-only baseline records exact mappings and equality of observed samples, and makes no predictions for unseen values. This tests added value over that baseline. It does not compare against deterministic template induction.

Execute both subjects against a literal separate oracle before asking Colibri anything. Keep results on the verification side. Run the frozen skill twice in fresh conversations with identical discovery packets. Keep the two initial responses separate, with no evidence disclosure between them. Compare semantic claims by their consequences, without requiring common labels. The control difference and other withheld observations are for evaluation. Iterative revision and implementation invariance are later gates.

## Scoring and acceptance criteria

For each replicate count the distinct, grounded behavioral concepts and relationships that are verified in scope, unsupported, contradicted, or unresolved. Score predictive value only when a written candidate gives an unambiguous prediction under a stated condition for an unobserved input. Record coverage and correct predictions on withheld A cases and, separately, on withheld B cases. Do not count a pattern inferred solely by a reviewer.

A successful replicate must contain at least one grounded candidate concept and one independently checked relationship with at least two correct new A predictions and zero contradictions in its stated scope. It must identify at least one concrete observation that could defeat a material hypothesis, and leave whole-scope A/B equivalence unresolved from discovery samples. A prediction identical on sample outcomes alone earns no new credit. If a claim explicitly omits a class of inputs, count that class as uncovered. Report any unsupported assertions separately. Overall qualification requires both replicates to pass and agree on at least one substantive relationship under overlapping scope. Incomplete responses count as attempts and cannot qualify.

This pilot does not require discovery of independent dimensions, generalization across applications, or revision. Record such suggestions as hypotheses. Advance only after results and limitations are understood. Preserve request packets, responses, runtime settings and fingerprints, elapsed time, and reported token usage. The controlled test compares system outputs within a declared finite scope.
