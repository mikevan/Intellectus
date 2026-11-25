# Run it

Needs Node 22.15 or later on PATH.

**Extract into an empty folder, never over an existing tree.** `tar -xf` adds and overwrites but never deletes, so a file that was renamed or removed in this build stays behind, and the build id printed by `npm run measure` will not match the archive's even though every measurement is correct. That is the most misleading combination available: a right answer from a tree that is not the one under discussion.

From this folder:

```powershell
npm install
npm test
npm run measure
npm run measure -- corpora\ir0-typescript\src
```

Expect 36 tests passing, and the last line of the second measure run to read:

```
reproduces  IR-4 of ir0-typescript, recorded 2026-09-14 at build f48949f5caf3, confirmed on linux and windows.
```

If it says `DIFFERS`, read which numbers differ. Either the encoder changed, or this is a new encoder version that needs its own row in `corpora/ir0-typescript/EXPECTED.json`. An existing row is never edited.

## What is in here

- `corpora/ir0-typescript/` is the frozen baseline corpus: the source, a manifest of per-file hashes, its provenance, and the recorded result at every encoder version. Never edit a file in it, and never add or remove one.
- `frozen-ir4/` holds a copy of the encoder as it stood when E2-cross was run. A test fails if the live encoder differs from it, so no experimental result can come from an encoder tuned to produce it.
- `docs/founding-design.md` is the design, draft 4, frozen. It changes only when the build forces it.
- `docs/experiment-log.md` is the evidence, append-only. No entry is edited; a correction is a new entry.
