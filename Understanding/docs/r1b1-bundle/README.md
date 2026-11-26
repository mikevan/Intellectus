# R-1B1 experiment bundle

The scratch experiment, made reproducible. INTERNAL. Nothing here is product code, and nothing here is imported by `src`, `scripts`, or `test`.

## Contents and sha256

| File | sha256 | Role |
|---|---|---|
| `checker.mjs` | `f6749afaae98945cbb3600f59a7ec7cd8c6f5b18740b775ca75362f7a058eae6` | Revision r1. Produced the final results, `../r1b1-results.json` `0ba232f2...`. |
| `checker-r2.mjs` | `0df935df316e21c42a03208d49814d01a04b6ced7adadb633756f51b18fc33ec` | Revision r2. Adds diagnostic roles and exports. Its chain derivation is byte-identical to r1, which the follow-up proves before running. Its main run reproduces r1's `results.json` byte for byte. |
| `history/checker-r0-reconstructed.mjs` | `a4caae272efb761c52dee6c609b4d8f73260aff109a9e4b96d01b93a497aeaf3` | Revision r0, **reconstructed**. r0 was edited in place and its hash was not recorded at the time; this file is r1 with the one comparison line reverted. It reproduces r0's reported outcome: 5 refusal misses per combination, R18 counted twice. |
| `make_manifest.py` | `117e155fc6530af16f46db18296dd5a41d70bb8c3e1acedd20ea72cd76ea5501` | Generator for `../r1b1-manifest.json` `072b5101...`. |
| `followup/make_followup.py` | `781417e0d64b24e0cd094f26a8fca5951e56eb9686921deb6e0a58c369b8f4a7` | Generator for `../r1b1-followup.json` `df3ae73b...`. |
| `followup/followup.mjs` | `79403bd9b1ce6fbf875eeb45c061e931b64e21a2f87a4451d34ac16ba2e278cb` | The addendum 2 runner. It writes `followup-results.json` (`c3779b12...`), and it generates the sabotaged copy `checker-r2-sabotage.mjs` (`edb120bd...`) by removing only the conflicting-arm check. |

## How to reproduce (Node 22, no install needed)

1. Copy this folder to a scratch directory.
2. Put `../r1b1-manifest.json` beside `checker.mjs` as `manifest.json`.
3. Put `../r1b1-followup.json` in `followup/` as `followup.json`.
4. Run `node checker.mjs manifest.json`. It writes `results.json`, which must hash to `0ba232f2651e75a1032f2ee3ae57d9a32ece7abbfcb38e541e68fa79914ae81a`.
5. Run `node followup/followup.mjs`. It writes `followup/followup-results.json`.
