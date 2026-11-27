# P4 business-record and source-quote pilot findings

All four requests completed in 347.18 cumulative request seconds, about 5 minutes 47 seconds. The model and request budget matched the prior P4 pilots. This exploratory subset reused known fixtures and changed both the response fields and the quote requirement.

| Case | Result | Evidence check |
| --- | --- | --- |
| C04, reimbursement | Pass | Named approved expense claims as the business record. The verbatim quote from C04-B identifies that record. The amount, cents, applicability, and both citations match the expected interpretation. |
| C02, training | Fail | The quote appears verbatim in C02-B and includes the expected record, current training plan. The business_record field instead names the output, hours still required after completed training. |
| C12, misleading rounding rule | Fail under the control rule | The model abstained and recognized the difference between floor and nearest rounding. Its examples agree under both rules. It did not cite the disclosed witness (7, 10), which returns zero under floor and one under nearest rounding. |
| C07, no context | Pass | The model abstained, cited no documents, and made no business claim. |

Both source quotes passed mechanical substring verification, but only one supported response paired its quote with the correct business record. The misleading control improved from an unsupported claim to abstention compared with Pilot 02, while still missing its required witness. This pilot passed two of four cases and does not establish P4 qualification. No model weights or adapters were changed.

- [Pilot design and scoring](Business-Record-Pilot.md)
- [Raw pilot evidence](business-record-pilot-01.jsonl)
- [Runner](run-business-record-pilot.py)
