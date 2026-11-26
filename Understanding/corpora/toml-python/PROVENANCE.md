# Corpus: toml-python

Michael Van Geertruy, with Claude. Project Revive Solutions, LLC.

## What this is

The five source files of the `toml` package, version 0.10.2, vendored unchanged as the first Python corpus. It exists because the IR's central claim is that meaning survives the language it is written in, and until now the Python adapter had been measured against four hand-written pairs and nothing else. Half the claim was untested.

## Why this project

It is pure Python with no dependencies, it is a real parser and serialiser rather than a toy, and it is small enough to vendor whole (1,425 lines, five files) so that anyone can reproduce a measurement from the exact bytes rather than from a download that may have moved. Parser code is also the right kind of hard: loops, nested conditionals, exception handling, and string state machines, which is where the IR's gaps are.

## Where it came from

`pip download --no-deps --no-binary :all: toml`, which produced `toml-0.10.2.tar.gz`, fetched 2026-09-14. The five files under `src/` are `toml/__init__.py`, `toml/decoder.py`, `toml/encoder.py`, `toml/ordered.py`, and `toml/tz.py` from that archive, unmodified. `MANIFEST.json` records a SHA256 per file so a copy can be checked against the one measured.

## Licence

MIT, copyright 2013-2019 William Pearson and others; the full text is in `LICENSE` beside this file. MIT permits redistribution with the notice retained, so vendoring it inside this repository (GPL-3.0-only) is allowed and the notice travels with it. Nothing in `src/` is our code, and nothing in it may be edited.

## How to use it

```
npm run measure -- corpora/toml-python/src
```

The instrument verifies every file against `MANIFEST.json` before measuring and compares the result with `EXPECTED.json`.

## Rules

Identical to the other corpora. Never edit a file in `src/`. Never add or remove one. A new encoder version adds a row to `EXPECTED.json` and never changes an existing one. A correction is a new row with a note.
