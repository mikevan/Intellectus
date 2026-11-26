# Run it

Needs Node 22.15 or later on PATH.

**Extract into an empty folder, never over an existing tree.** `tar -xf` adds and overwrites but never deletes, so a file that was renamed or removed in this build stays behind, and the build id printed by `npm run measure` will not match the archive's even though every measurement is correct. That is the most misleading combination available: a right answer from a tree that is not the one under discussion.

From this folder:

```powershell
npm install
npm test
npm run measure
npm run measure -- corpora\ir0-typescript\src
npm run measure -- corpora\toml-python\src
npm run graph -- corpora\toml-python\src
```

Expect 94 tests passing, and the last line of each corpus measurement to read:

```
reproduces  IR-5 of ir0-typescript, recorded 2026-09-14 at build db10d41b6016, confirmed on linux.
reproduces  IR-5 of toml-python, recorded 2026-09-14 at build db10d41b6016, confirmed on linux.
```

`npm run graph` ingests a corpus as PARSED assertions and measures the resulting graph; it is E3's step 3 and it
prints 11 CALLS edges, 38 isolated executables, 45 components, and zeroes for every value-flow relation. The build
id printed by measure should be the same for both corpus runs.

The build id printed for the measure runs should be the archive's. If it differs, the tree is not this archive and the
numbers below it do not count.

If it says `DIFFERS`, read which numbers differ. Either the encoder changed, or this is a new encoder version that needs its own row in `corpora/ir0-typescript/EXPECTED.json`. An existing row is never edited.

## What is in here

- `corpora/toml-python/` is the Python corpus: the `toml` package 0.10.2, MIT, vendored unchanged. Its expected row
  carries two rows: IR-4, measured when the Python adapter could not see methods inside classes, and IR-5, the
  first credible measurement, 56 functions and 13.6% opaque. Both rows stay; the IR-4 row's note says what was
  wrong with it.
- `corpora/ir0-typescript/` is the frozen baseline corpus: the source, a manifest of per-file hashes, its provenance, and the recorded result at every encoder version. Never edit a file in it, and never add or remove one.
- `frozen-ir5/` holds a copy of the encoder in force. `frozen-ir4/` is kept because E2-cross's first result belongs
  to that encoder. A test fails if the live encoder differs from it, so no experimental result can come from an encoder tuned to produce it.
- `docs/founding-design.md` is the design, draft 4, frozen. It changes only when the build forces it.
- `docs/experiment-log.md` is the evidence, append-only. No entry is edited; a correction is a new entry.
