# Corpus: radon-python

Michael Van Geertruy, with Claude. Project Revive Solutions, LLC.

## What this is

The source of `radon` 6.0.1, a Python command-line application that measures code metrics, vendored unchanged. It is the first corpus in this project selected **without regard to what Understanding can represent**. The earlier two corpora were chosen to develop the instrument; this one points the instrument at software on software's terms.

## How it was selected

The ten selection criteria were written and frozen in `docs/experiment-log.md` before any candidate was examined, and the rule was that the first application meeting all ten is taken. Two candidates were examined in order.

- **wordfreq 3.1.1: rejected.** No entry point and no test suite in its distribution (criteria 2 and 7).
- **radon 6.0.1: accepted.** It meets every criterion, and it was not examined for how Understanding performs against it before being taken.

Against the criteria:

1. Python, independently developed by Michele Lacchia and contributors, nothing to do with this project.
2. A genuine entry point: `console_scripts` declares `radon = radon:main`, and `radon/__main__.py` calls `main()` for `python -m radon`.
3. Twelve modules across three packages (`radon`, `radon/cli`, `radon/contrib`), with calls between them.
4. Data transformed across functions: source text to an AST to visitor results to metrics to formatted output, each stage in a different module.
5. Meaningful branches: the complexity visitor is branch logic by nature.
6. Observable effects: it writes formatted reports to standard output and reads files from disk.
7. An existing automated test suite written by its authors, 13 files and roughly 80 test functions, vendored beside the source in `tests/` and **not** part of the measured corpus. It is behavioural ground truth that was not written to make Understanding look good.
8. 2,595 lines across 12 files, vendorable whole.
9. MIT, copyright 2012-2017 Michele Lacchia, notice retained in `LICENSE` beside this file.
10. Pure Python, no compiled extensions, nothing that must be installed to read the source.

**Not a criterion: zero opacity.** The application is not required to avoid constructs Understanding cannot represent. The qualifying rule for a semantic flow still demands zero opacity, so a corpus that yields few qualifying flows is a product finding rather than a bad corpus.

## Where it came from

`pip download --no-deps --no-binary :all: radon`, which produced `radon-6.0.1.tar.gz`, fetched 2026-09-14. `src/` holds `radon/*.py`, `radon/cli/*.py`, and `radon/contrib/*.py` unmodified. `tests/` holds `radon/tests/*.py` unmodified, for later behavioural comparison; it is outside the measured corpus and outside `MANIFEST.json`.

## Licence

MIT. Redistribution inside this repository (GPL-3.0-only) is permitted with the notice retained, and the notice travels in `LICENSE`. Nothing in `src/` or `tests/` is our code and nothing in either may be edited.

## How to use it

```
npm run measure -- corpora/radon-python/src
npm run graph -- corpora/radon-python/src
npm run sufficiency -- corpora/radon-python/src
```

## Rules

Never edit a file in `src/` or `tests/`. Never add or remove one. A new encoder version appends a row to `EXPECTED.json` and never changes one.
