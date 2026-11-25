# Corpus: ir0-typescript

Michael Van Geertruy, with Claude. Project Revive Solutions, LLC.

## What this is

The ten TypeScript source files of Understanding as they stood at IR-0, frozen on 2026-09-13 and never edited since. It is the baseline corpus every encoder version is measured against, so that a measurement taken after a change is comparable to one taken before it. If it changed, no two measurements in the experiment log would mean the same thing.

## Where it came from

Taken from the archive `understanding-2026-09-13-ir0-b1a13fc5.zip`, sha256 `b1a13fc516899b1c7a287f8ae42e2d49b765762e506a31c10c425579617af183`, 62,275 bytes, which is the state of this repository before local bindings, member reads, opaque categories, canonical inlining, calls as values, and behaviour as data were represented. That archive predates the build id, so it has none; the encoder that produced the IR-0 numbers is the one inside it.

## Licence and rights

Every file is this project's own source, written by Michael Van Geertruy with Claude, under the repository's licence (GPL-3.0-only). Nothing here is third-party code, so it may be redistributed with the repository without further permission.

## How to use it

```
npm run measure -- corpora/ir0-typescript/src
```

The instrument checks the corpus against `MANIFEST.json` and the result against `EXPECTED.json`, and says plainly whether this run reproduces the recorded numbers. A file whose hash differs is a corrupt or edited corpus and the run stops: a measurement over a corpus that is not the recorded one is not a measurement of anything.

## Rules

- Never edit a file in `src/`. Not to fix a lint, not to update a comment.
- Never add or remove a file. The corpus is ten files and 240 statements by definition.
- A new encoder version adds a row to `EXPECTED.json`; it never changes an existing row.
- If a recorded number turns out to be wrong, the correction is a new row with a note, not an edit. The experiment log's rule applies here too.
