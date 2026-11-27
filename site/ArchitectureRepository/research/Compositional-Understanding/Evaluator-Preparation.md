# CU-1 evaluator preparation

Investigator-only. Keep this document and the eventual oracle outside both discovery packets.

Use UTF-8 bytes without a BOM and LF endings. Every case starts from a fresh workspace. The intact workflow is specified in the protocol. For the second visible run, substitute first and second contents with distinct values while preserving file paths, commands and target selection. Include a matched visible omission pair that skips the second recording activity, still selects the first record and observes listing, restore and the resulting bytes. Record absence of a second identifier as an observation and skip commands that would require it. For the three withheld families, use fresh content substitutions, an independently repeated second-record omission and an unknown valid-format target with a clean working state. Freeze exact payloads and case IDs in a machine-readable evaluator manifest.

For each workflow, the independent verifier captures exit code, observed history identifiers, artifact presence and exact fixture bytes at every boundary. Resolve identifiers from the observed listings. Treat timestamps, internal metadata bytes and host paths as provenance. Independently check whether successful restoration returns the expected bytes and preserves the observed history identifiers. Keep an unknown target distinct from a dirty workspace or a structurally invalid argument. When the second recording activity is omitted, verify KeepSafe and MVS individually. The MVS restoration code checks workspace status before restoring unless force is requested. The CU-1 default condition omits force. Equivalence must follow the per-subject measurements.

The rubric grades a claim as verified if all preregistered outcomes and scope controls pass, contradicted if an in-scope prediction fails, or unsupported if scope or expected outcomes are insufficient to test. Compare normalized claims by their testable obligations across the same cases. Record dependency, composition and exploratory capability separately. Apply the protocol H1 and H2 thresholds independently.

The freeze gate requires the acquisition runner, visible and held-out manifest, per-subject executable oracle, and exact Colibri model and SSE generation settings. Record their digests alongside the source, baseline, frozen skill and protocol digests. Seal the choices before formal execution. Environment and synthetic baseline qualification records may precede the freeze.

## Prepared artifacts and freeze status

- [Exact case inputs](fixtures.json) specify visible and withheld inputs, unknown targets and repeat count.
- [Acquisition runner](acquire.py) invokes each application in a disposable workspace and captures file bytes, process outcomes, history and package call sites. The current command-line entry point runs only the separate smoke case.
- The [executable oracle](oracle.py) checks independent byte, history and exit obligations. Its expectations for withheld cases are investigator-side predictions. Those branches have not been exercised on the research cases.
- Proposed inference settings continue the zero-temperature SSE configuration used in the qualification series. Use `intellectus-qwen36`, temperature 0, `stream: true`, usage reporting and a fixed 3072 completion-token budget. The budget is a candidate carried forward from the longer Hello World correction condition. Record model identity, truncation and usage reporting in the sealed configuration.
- Remaining freeze work includes the formal run driver, explicit conversion of acquisition records into isolated discovery packets and aligned baseline observations, the exact inference prompt and model configuration, instrumentation parity and the signed-off digest manifest.
