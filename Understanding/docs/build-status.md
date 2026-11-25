# Understanding: build status

Michael Van Geertruy, with Claude. Project Revive Solutions, LLC.

## 2026-09-13, first move (no version number yet)

Built in Claude's Linux harness against the frozen draft 4, in the review's order. 16 tests, all passing.

- **Concepts** (`src/concepts`): opaque ids, the kind list from section 5 plus `scope` and `checkpoint`.
- **Journal** (`src/journal`): ASSERT, RETRACT, CONCEPT, BEGIN, COMMIT as one write per transaction to an NDJSON file; replay drops any trailing uncommitted transaction (the crash rule, tested by appending a half transaction by hand); supersession and retraction both keep history; `derived_from` dependents are retracted in the same transaction as their base (one rule, applied by the store); one open transaction at a time.
- **Schema** (`src/schema`): the relation table from section 5 as data, with subject and object kinds, layer, inverse, symmetry, and required attributes; `checkAssertion` names the rule it rejects on. Enforced: unknown relation, kind on either side, lineage same-kind, required attributes, confidence range, DECLARED needs authority, verification only on INFERRED, derived needs `derived_from`, authority scope must be a scope concept.
- **Scopes** (`src/scopes`): scopes are concepts with RENDERS_AS; AUTHORITATIVE_OVER is explicit; `hasStanding` walks declared relations only, so a root scope is not a superuser (tested).
- **IR** (`src/ir`): predicates (compare, absent, truthy, and, or, not, opaque), effects, branch, return, throw; canonical numbers (`25_000`, `25000.00`, `Decimal("25000.00")` all `"25000"`); normalisation pushes negation to the atoms and puts inputs on the left; the semantic projection is every effect and return with the path condition it is reached under, which makes an early-return chain and a nested conditional project the same; the fingerprint hashes the projection.
- **Adapters** (`src/adapters/python`, `src/adapters/typescript`) over tree-sitter through WebAssembly (`web-tree-sitter` 0.27, grammar `.wasm` files shipped by the grammar packages; no native module). Inputs are positional, never named. The TypeScript adapter resolves enum members to their values. `x is None`, `x === null || x === undefined`, and `x !== null && x !== undefined` are one predicate.
- **Adversarial corpus** (`test/adversarial`): the pair from section 16 (Python conjunction with `Decimal` and a status string against a TypeScript early-return chain with enums and an awaited publish) projects identically and fingerprints identically from both adapters; five spellings of one constant; None against null-or-undefined with the guard inverted; nested against flat; and two negative controls (a changed threshold and a changed effect must differ).

One bug found and fixed while building: `web-tree-sitter` refuses to construct a `Parser` before `Parser.init()` resolves, so the language must be loaded before the parser is made.

Not built: the IR beyond the minimum (loops, try, async forks, transforms, reads and writes of state), effects other than CALL_EXTERNAL, threads, traces, obligations, `why`, indexes, the grid. Not dogfooded yet: the TypeScript adapter has not been run over this repository's own source; when it is, every `opaque` node it reports is the honest measure of how far the IR is from representing Understanding.

## Run it (PowerShell, Node 22 or later on PATH)

```powershell
cd <where you unzipped>\Understanding
npm install
npm test
```

Expect 16 passing.

## Next

1. Dogfood: run the TypeScript adapter over `src/` and count `opaque` statements per file; that list is the IR's backlog, in order of count.
2. Seed what a person must declare: the authority scopes for this repository, and draft 4 as its first DECLARED intent, into `understanding/`.
3. Loops, try, and state reads and writes in the IR, driven by the dogfood counts.

## 2026-09-13, later: dogfood, seed, self-encode, and E4 in miniature

Run in Claude's harness, on this repository, through the ordinary adapter with no privileged path.

**Dogfood (the IR's backlog).** The TypeScript adapter over `src/**/*.ts`: 10 files, 56 functions found, 230 statements, **79 opaque (34.3 percent)**. Opaque reasons, worst first: `lexical_declaration` 52, `assignment_expression` 12, `for_in_statement` 6, `switch_statement` 6, `identifier` 1, `for_statement` 1, `while_statement` 1. Worst files: `src/journal/index.ts` 21 of 63, `src/adapters/typescript/index.ts` 18 of 52, `src/adapters/python/index.ts` 11 of 15. That list is the IR's work queue in priority order, and it is a real number rather than an estimate: local bindings and assignment are two thirds of it, loops and switch are the rest.

**Seed.** Five authority scopes declared by the owner (application, ontology, journal-integrity, ir-normalisation, provenance), each a concept with a rendering and a description. The frozen founding design is the repository's first DECLARED intent, and four of its decisions are invariants, each IN_SCOPE and CONSTRAINS the intent with a modality (two REQUIRED, two PROHIBITED). 33 events, 23 live assertions. `hasStanding(OWNER/application, ontology)` is false, as designed: no superuser.

**Self-encode.** 56 functions and 10 modules from `src/`, with module membership, renderings, intrinsic fingerprints (each `derived_from` its name assertion, carrying `ir_schema` and `encoder`), and effects with their path conditions. Sequence 33 to 378, 302 live assertions, journal 382 lines, 136 KB.

First thing the store could answer that a grep cannot: **six groups of functions share an intrinsic fingerprint under different names**, which are the candidates for SUBSTITUTABLE_UNDER. Two are real and useful (`block` in the Python and TypeScript adapters; `effectOf` in both), and four are the honest consequence of a 34 percent opaque rate: functions whose bodies are mostly local bindings currently project to the same thing. That is not a false positive in the design, it is the IR's backlog showing up as loss of resolution, and it is the reason `match` proposes and never declares.

**E4 in miniature.** On the pair-1 function: reformatting the file (braces added, a comment, parameters split across lines, `25_000` written `25000.00`, spacing changed, 17 lines differing) reports **no semantic change**, same fingerprint. Changing `25_000` to `50_000`, one token, reports an **implementation change** with both fingerprints named. Putting the threshold back reports no change against the original, and the journal retains every fingerprint ever asserted. Eight events, four live assertions.

**Honest note on method.** The first E4 run compared the reformatted file against the threshold version, so the change it reported was the threshold reverting, not the formatting. It was re-run with formatting as the only difference before the result above was recorded.

## 2026-09-13, crash hardening

20 tests. Replay is hardened against a torn final line (see docs/experiment-log.md). The numbers in this document are now kept in that log, which is the evidence beside the frozen design.

## Next

1. `lexical_declaration` and `assignment_expression` in the IR: a local binding becomes a named value in the data flow, not an opaque statement. That alone should take the opaque rate from 34 percent to about 11 percent and will dissolve four of the six fingerprint collisions.
2. Then `for_in_statement`, `switch_statement`, `for_statement`, `while_statement`.
3. Re-run the dogfood after each and record the opaque rate here; it is the measure of how far the IR is from representing this repository.
