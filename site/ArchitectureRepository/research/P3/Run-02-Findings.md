# P3 Run 02 findings

The prompt-only follow-up did not qualify. All 12 cases were attempted with the same disclosed evidence, deterministic baseline, verification rules, requested model and runtime version, and request budget as Run 01. The same running Colibri instance served both runs. Checkpoint byte hashes were captured before Run 01.

| Outcome | Required | Run 01 | Run 02 |
| --- | ---: | ---: | ---: |
| Verified repairs | 3 of 4 | 1 of 4 | 0 of 4 |
| Justified withdrawals | 3 of 4 | 0 of 4 | 3 of 4 |
| Correct retentions | 4 of 4 | 0 of 4 | 2 of 4 |

Cases 02, 08, and 11 justified withdrawal by explaining why the three identifying observations fixed a formula that failed the disclosed boundary point. Case 05 did not withdraw. Cases 09 and 12 correctly retained their formulas.

The model withdrew repairable cases 01 and 04. Case 01 even identified a formula that fit the evidence inside its withdrawal explanation. The responses for repairable cases 07 and 10 could not be parsed as single JSON objects. No false candidate passed verification.

The changed prompt was associated with better withdrawal and retention scores on these cases and a lower repair score. Reusing the same twelve cases limits the conclusion to this comparison. Cumulative request time was 735.702 seconds, compared with 278.196 seconds in Run 01.

- [Approved prompt amendment](Run-02-Amendment.md)
- [Raw Run 02 evidence](run-02.jsonl)
- [Run 01 findings](Run-01-Findings.md)
