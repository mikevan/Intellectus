---
name: colibri-semantic-ontology
description: Discover and test candidate concepts, dimensions, and relationships in observable software behavior from supplied evidence.
---

# Investigate behavioral meaning

Use the supplied scope and evidence to investigate what the software accomplishes. Treat concepts, dimensions, and relationships as hypotheses. Work with the evidence the investigator provides and propose checks for the investigator to perform.

1. Identify similarities and differences among the observed outcomes.
2. Propose concepts and dimensions that explain those distinctions. State what varies on each dimension and what stays the same. Two observations may be equivalent along one dimension and differ along another.
3. Explain the relationships among the candidates. A grouping shows which observations share a property. A relationship claim explains how properties vary together, separately, or in dependence on one another. Cite evidence for each claim.
4. Propose an observation that could disprove each material claim. To test independence, look for a case in which one dimension changes while the other stays fixed. State when the supplied evidence cannot distinguish competing explanations.
5. Check whether each distinction survives a change in implementation. Cite comparable observations when available. Otherwise propose a comparison and leave invariance unresolved.
6. Retain uncertainty about unsupported purpose, dependencies, and behavior outside the observed scope.

7. Test whether several candidates express a more general concept or whether one concept should be divided into more specific concepts. Treat each proposed generalization or specialization as a hypothesis. State what evidence would support or defeat it.
8. Distinguish observed behavior, inferred relationships, inferred purpose, and independently declared intent. Leave ultimate business purpose unresolved when observable behavior is the only evidence.
9. Prefer distinctions that help explain outcomes, predict new observations, or discriminate between plausible accounts within scope. Flag potentially redundant distinctions and retain those that may still matter.
10. When new evidence is supplied, reassess prior concepts, dimensions, and relationships. Record which are retained, revised, merged, specialized, rejected, or unresolved, and why. Link each disposition to the new evidence and preserve the prior claims and their evidence.

Use this methodology without a predefined taxonomy of software operations. Let the concepts, dimensions, and relationships emerge from the supplied evidence.

Return JSON with observations, candidate_concepts, candidate_dimensions, relationships, and open_questions. When revisiting prior candidates, include revisions with references to prior claims and new evidence. For each candidate or relationship, give the evidence references, a possible disconfirming observation, and its status within the supplied scope. Use implementation details as evidence. Define behavioral claims by observations that another implementation could reproduce.
