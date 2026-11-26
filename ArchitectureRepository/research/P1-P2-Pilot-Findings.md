# P1/P2 engineering pilot: invariance and discrimination

Date: 2026-11-26. Status: passed in two separate runner invocations. This is not RT-5.

## Objective and method

Qualify the deterministic observation, canonicalization and verification baseline on six fixed arithmetic subjects in Python and TypeScript. Discovery receives eight of ten possible inputs per subject; independent subprocess execution supplies all ten to verification. The authored oracle checks all outcomes. This is an engineering fixture, not a blinded scientific trial. The fixtures and oracle were authored together and may share assumptions.

| Subject | Expected behavior | Result |
|---|---|---|
| Python branch | a + 3 + 2b | Verified in scope |
| Python iteration | Same | Verified in scope |
| TypeScript direct | Same | Verified in scope |
| TypeScript lookup | Same | Verified in scope |
| TypeScript shift | a + 4 + 2b | Verified distinct |
| TypeScript late | Same except (4,1) returns 10 | Distinct; initial affine claim contradicted |

The contract covers integer a=0..4 and b=0..1, normal integer return, with purity declared. All 60 verification cases matched the authored oracle per run. All four equivalent subjects produced identical canonical bytes and digest. Three distinct behavioral identities were produced. The late control predicted 9 at (4,1) but returned 10; verification rejected the candidate. Both runs produced byte-identical JSON evidence.

## Conclusions

1. Complete finite behavioral mappings can converge across these four implementation styles and two languages.
2. Similar discovery samples are not sufficient for equivalence: the held-out late control distinguishes the superficially equivalent program.
3. Deterministic affine discovery, canonicalization and verification form a working baseline for measuring incremental AI contribution.
4. These results establish neither general equivalence nor conceptual or business understanding. No structural fingerprint comparison, live AI, causal induction beyond unit interventions, or formal proof of purity was performed.
5. The next qualification is P3, correction or explicit withdrawal of contradicted claims, followed by P4, measurable domain contribution using independently provided context. RT-5 remains unexecuted.

## Reproduction

Run the installed pilot using Node with TypeScript stripping and Python available. The two evidence records preserve all observations, candidate statuses and canonical mappings. The result is deterministic; no local model or external API was invoked.
