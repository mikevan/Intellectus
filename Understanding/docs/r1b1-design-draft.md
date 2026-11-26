# R-1B1: occurrence identity, path membership, and the order-relation experiment

Michael Van Geertruy, with Claude. INTERNAL. Drafted 2026-11-02. **Draft for review. Not frozen. No implementation.**

This draft answers Michael's six-point brief of 2026-11-02. It changes nothing already recorded: the R-1A entries and their prediction misses stand as written, and R-1B0 stays closed on the evidence logged on Linux and Windows.

## 0. Two distinctions this draft keeps explicit throughout

1. **Occurrence identity enables relationships. It does not establish path membership.** An identity gives an order fact something to point at. Whether two occurrences can ever run in the same execution is a separate fact, carried by a separate relation (section 2), and nothing here derives one from the other.
2. **The 96 pairs are a diagnostic population, not 96 proven ordering gaps.** R-1B0 counted every pair of observable effects in one executable because the store could not tell them apart. That population includes pairs on mutually exclusive branches, which need no order at all. Section 2 splits it.

## 1. Baseline this draft starts from

Measured at build `a93a98cead33`, confirmed on Linux and Windows (`docs/experiment-log.md`, R-1B0 entries):

| Corpus | Executables with 2+ observable effects | Pairs | Fixed |
|---|---|---|---|
| `ir0-typescript` | 18 | 96 | 0 |
| `toml-python` | 22 | 303 | 0 |
| `radon-python` | 44 | 274 | 0 |

`ORDER_UNSPECIFIED` is 3 on the `encodeFunctions` thread and 2 on `operand`. `HAS_PREDICATE` is 96 in `ir0-typescript`, kept by ruling.

**What the current store cannot do, read from the source:**

- **Effects have no identity.** `src/ingest/index.ts` asserts `HAS_EFFECT` as a literal `{operation, args, under}` on the executable. Two identical effects are two identical literals, and an order fact has nothing to name.
- **Invocations are rebuilt from the sorted projection.** Ingestion regroups projected outcomes by `(operation, args, path condition, receiver)` and keeps the larger of the effect and bind counts per key. The `site` number in the evidence is a position in that sorted list, not in the source. Repeated identical calls get the right count but no stable position.
- **Conditions are detached from occurrences.** The projection already pairs every outcome with its full path condition (`under`), but ingestion writes that condition as a separate `HAS_PREDICATE` literal on the executable and keeps only `under: true or false` on the effect. The link between an occurrence and its condition is lost at ingestion.
- **Order is discarded by design.** `project()` sorts outcomes so two spellings of one logic project identically. That is correct for fingerprints and is why order must live somewhere else.

**A measured discrepancy found while preparing this draft** (a probe outside the repository, walking the canonical IR of every function the way `project()` does, top-level calls only):

| Corpus | Call sites in the walk | Call invocations in the store (I-0 accounting) | Difference |
|---|---|---|---|
| `ir0-typescript` | 65 | 65 (80 invocations minus 15 pseudo, after R-1A) | 0 |
| `toml-python` | 65 | 65 (99 minus 34 pseudo) | 0 |
| `radon-python` | 120 | 121 (202 minus 81 pseudo) | 1 |

The probe also found no unnamed calls, no dead code after an exit, and no repeated identical call keys that would explain the radon difference. **The cause of radon's single extra invocation is not known.** It is recorded here, not explained away, and prerequisite P0 exists to name it.

## 2. The design

### 2.1 Occurrence identity (brief point 1)

**What gets an identity.** Every statement-level occurrence the projection already walks becomes a **step**: a top-level call, each `awaited` level, a branch, a semantic opaque statement, a `WRITE` or `EMIT` effect, and a `return` or `throw` exit. Steps are the units order facts point at.

**Why a new concept kind, `step`.** The existing kinds do not fit without changing what they mean. `event` already participates in threads and traces (`PARTICIPATES_IN`) and is reserved for application events. `invocation` is a call site built from the projection, and awaits, branches, and exits are not invocations.

**Repeated identical occurrences stay distinct.** A step is minted from the walk, not from the sorted projection, so `a.x(); a.x();` gives two steps with two positions, whether or not their literals match. A bound call that the projection reports twice, once as an effect and once as a binding, is still one statement, so it is one step.

**Each step belongs to exactly one executable.** A step is created inside the walk of one function and asserted with `CONTAINS_STEP` from that executable. A call step links to its invocation with `STEP_INVOKES`, so arguments, receivers, and flows attached to invocations today stay where they are.

**Position is provenance, never identity, never semantics.** Each step carries its structural position, the path of block indexes and branch arms from the function body to the statement (`body/3/then/1`). That position survives reformatting, because it counts statements, not lines. It lives in the assertion's evidence and attributes, the way R-1A kept the await point's `at`. It never enters `fingerprint()`, which hashes the projection with provenance removed, and the projection does not change.

**Identities do not survive re-ingestion, and that is stated, not hidden.** Concept ids are minted fresh by `Journal.concept()` on every ingestion. That is already true of executables and invocations: today the store has no persistent identity for anything ingested. The founding design assigns persistence to lineage (identity carried, never computed), and that is separate work. A step's position is a candidate piece of lineage evidence later. It is never treated as identity here.

### 2.2 Path membership (brief point 2)

**The connection.** Each branch is itself a step. Every step inside a branch arm asserts `IN_ARM` to its **immediately** enclosing branch step, with `arm` of `then` or `else`. Deeper nesting is derived by following `IN_ARM` upward. The predicate stays attached to its branch step, so a condition is reached through the branch that tests it, never matched by its text.

**Why branch identity, not predicate text.** `if (c) a(); else b();` makes `a` and `b` exclusive. `if (c) a(); if (c) b();` does not, even though the predicate text is identical, and `if (x > 0) a(); if (x < 0) b();` is not proven exclusive either, even though the conditions look contradictory. Only the identity of the branch and the arm can tell these apart without deciding satisfiability, which this design never attempts.

**The continuation after an arm that exits** (the early-return shape) is handled by order facts, not by `IN_ARM`. In `if (c) { a(); return; } b();` the step `b` is outside any arm, and it is reachable only through the arm that does not exit.

**Three classes for any pair of steps in one executable, decided from structure alone:**

| Class | Rule | Example |
|---|---|---|
| **Together** | Every arm enclosing one step also encloses the other, or one step's arms are a subset of the other's. Whenever the deeper one runs, the shallower one ran or will run (normal completion assumed; see 2.3). | `if (c) a(); b();` |
| **Exclusive** | The two steps lie in opposite arms of one branch step, or one lies inside an arm that always exits and the other lies only on the continuation after that branch. | `if (c) a(); else b();` and `if (c) { a(); return; } b();` |
| **Unknown** | Anything else, chiefly steps under two independent branches. Whether both can run depends on whether both conditions can hold together, and that is never inferred, in either direction, from the conditions differing or matching. | `if (p) a(); if (q) b();` |

**What the classes do to the diagnostic.** Exclusive pairs leave the gap count, because they need no order. Together and unknown pairs still need one, read as "if both occur, this one first". The 96 split into these three classes only after P2 exists. The split is predicted per corpus when P2's protocol is frozen.

### 2.3 Event meaning (brief point 3)

Every order fact connects two **events**. Each step kind has a fixed set of events:

| Step | Events | Meaning |
|---|---|---|
| Call | `invoke`, `return` | Control enters the callee, and the call expression yields its value normally. For an asynchronous callee, `return` yields the pending result. It says nothing about when the asynchronous work completes. |
| Await | `suspend`, `resume` | The operand has been evaluated and the continuation is suspended; then the continuation resumes **because the awaited value fulfilled**. |
| Branch | `decide` | The predicate is evaluated and one arm is entered. |
| Exit | `exit` | `return` or `throw` leaves the function. |
| Opaque, write, emit | `start`, `end` | The whole construct as one unit. Its insides are not represented. |

**Exactly two kinds of order fact.**

1. **Program order, X then Y.** If X completes normally (call `return`, await `resume`, branch `decide` into Y's arm, opaque `end`), then Y starts (`invoke`, `suspend`, `decide`, `start`) after it. Written only between immediate successors on one path.
2. **Completion order, W awaits C.** The **fulfilment** of the value returned by call step C precedes W's `resume`. Written only when the awaited operand is a call step in the same function.

**Rejection is never ordered.** Both facts describe successful continuation only. If an awaited value rejects, W does not resume normally: control raises at the await point. Nothing here says the continuation runs after a rejection, and nothing says where the failure goes. That is R-1C. The same holds for a call that throws: program order is conditional on normal completion, and every order fact carries that condition implicitly by definition.

**The unawaited case falls out without type information.** `const p = load(); use(p);` gives `load` then `use` by program order: the call returned before `use` started. No completion fact is written, so the store says nothing about whether `load`'s asynchronous work finishes before `use`. That is the truth, because it is genuinely unordered, and the checker must not count it as a gap: a completion is not an effect.

**`await ready` keeps its R-1A meaning.** Its operand is not a call step in the function, so there is no completion fact to write. The await step still has its events, and its `resume` still means "the operand fulfilled". The operand stays the R-1A `evaluation` target, with `ready` unidentified.

### 2.4 Continuation (brief point 4)

**Only the frontier is written.** An await step gets one program-order fact to the next step on its path, plus its completion fact when the operand is a call step. No fact runs from an await to each later step. Everything later is derived by following the chain. Each derived fact keeps the condition of the deeper step, read through `IN_ARM`.

**Worked example: `loadLanguage`** (`corpora/ir0-typescript/src/adapters/treeSitter.ts`, lines 9 to 19). The canonical IR has 9 steps, matching the probe: 4 calls, 2 awaits, 2 branches, 1 exit. `readFileSync` and the `require.resolve` calls are nested inside `Language.load`'s argument, so they are not steps (see section 5).

```
b1  branch !ready
c1    Parser.init()              IN_ARM b1 then        (bound to ready, never awaited here)
w1  await ready                  operand is not a step: no completion fact
c2  languages.get(name)
b2  branch !lang
c3    Language.load(...)         IN_ARM b2 then
w2    await                      IN_ARM b2 then, AWAITS c3
c4    languages.set(name, lang)  IN_ARM b2 then
x1  return lang
```

**Facts written (program order unless marked):** b1 then-arm to c1; c1 to w1; b1 else-arm to w1; w1 to c2; c2 to b2; b2 then-arm to c3; c3 to w2; w2 to c4; c4 to x1; b2 else-arm to x1; and the completion fact **w2 awaits c3**. That is 10 program-order facts and 1 completion fact.

**Facts derived, not written:**

- `Language.load` fulfilled before `languages.set` started, under `!lang`. This follows from c3's completion to w2's resume, then w2 to c4.
- `Parser.init` returned before `languages.get` started, under `!ready` for the `Parser.init` end. This follows from c1 to w1, then w1 to c2.
- No fact says `Parser.init`'s work completed before anything, because nothing in this function awaits the call step. The `await ready` awaits the variable, not the call. That is exactly what the source says.

**The 6 observable-effect pairs in `loadLanguage` (c1 to c4), expected answers:**

| Pair | Class | Order |
|---|---|---|
| c1, c2 | Together | c1 first |
| c1, c3 | Unknown (`!ready` and `!lang` are independent branches) | If both occur, c1 first |
| c1, c4 | Unknown | If both occur, c1 first |
| c2, c3 | Together | c2 first |
| c2, c4 | Together | c2 first |
| c3, c4 | Together | c3 fulfilled first |

Fixed: 6 of 6. Exclusive: 0. Unfixed: 0. So `loadLanguage`'s `ORDER_UNSPECIFIED` reaches 0 once R-1B2 writes these facts. That is a prediction for R-1B2, not for this experiment.

## 3. The relation experiment (brief point 5)

**Where it runs.** In a scratch copy outside the repository, with a scratch copy of `src/schema/relations.ts` extended per candidate. The journal enforces the relation table, so neither candidate can be written to the real schema without a production change. The facts are written **by hand** from section 2, never by an encoder. A scratch checker extends R-1B0's `pairsOf` with the three classes and transitive derivation. The expected answers are frozen in this document before the first run.

**The candidates, each asked for the same facts:**

| | Candidate A: `FOLLOWS` widened | Candidate B: new relations |
|---|---|---|
| Program order | `FOLLOWS` between steps, `control: "program"`, `within: <executable>` | `NEXT_STEP` between steps |
| Completion order | `FOLLOWS` from call step to await step, `control: "completion"` | `AWAITS` from await step to call step |
| Schema change | `FOLLOWS` subject and object gain `step`; executable-to-executable thread order stays in the same relation | Two new relations with step-only endpoints; `FOLLOWS` untouched |
| Existing guard | `test/ir/ingest.test.ts` line 64 forbids ingestion writing `FOLLOWS`, and must be revisited | No conflict |

**The `HAS_PREDICATE` dimension (carried from today's ruling), crossed with both candidates:**

- **H1.** Executable-level `HAS_PREDICATE` stays exactly as it is, including the R-1A +1, and conditions are reached through `IN_ARM` to branch steps that carry their own predicate fact.
- **H2.** `HAS_PREDICATE` is widened so its subject can be a branch step. The executable-level assertions stay in the experiment, so the baseline count of 96 is untouched, and the question is only which subject the checker reads.

**Scoring, in this order:**

1. Every expected answer in section 4 derived from store facts alone, with no positions and no provenance read.
2. Initiation and completion distinguishable in every control.
3. Wrong endpoints unrepresentable: the schema refuses a program-order fact between a step and an executable, and a completion fact whose source is not a call step.
4. No ambiguity with existing meanings, chiefly thread-level `FOLLOWS`.
5. Assertion count for the same answers.
6. Derivation cost: what the checker must do to get transitive facts and classes.

Michael picks a candidate and an H option from the scored results. Nothing in production changes because of the experiment itself.

## 4. Controls and expected answers (brief point 6)

Each control is written in TypeScript and Python. Both spellings must produce identical facts (X1). The section-16 pair must produce identical facts with provenance excluded (X2).

| # | Control | Steps | Expected facts | Expected classes and answers |
|---|---|---|---|---|
| K1 | Repeated identical calls: `a.x(); a.x();` | 2 call steps, distinct ids, different positions | 1 program-order fact | Together, ordered. Today the store holds two identical invocations with no stable order. |
| K2 | Synchronous calls: `f(); g();` | 2 calls | 1 program-order fact | Together; `f` returned before `g` was invoked. |
| K3 | Unawaited asynchronous call: `const p = load(); use(p);` | 2 calls | 1 program-order fact, **no completion fact** | Together; `load` returned before `use`. Its asynchronous completion is unordered against `use`, and that is **not** counted as a gap. |
| K4 | Awaited call: `await load(); use();` | call, await, call | 2 program-order facts, 1 completion fact | `use` started after `load` **fulfilled**. On rejection, no fact. Changing `await load()` to `load()` must remove exactly the completion fact (initiation against completion, N1 from the R-1B protocol). |
| K5 | Conditional await: `if (c) { await load(); } use();` | branch, call, await, call | Then-arm to `load`, `load` to await, await to `use`, else-arm to `use`, completion fact | `load` and `use` together; derived "`use` after `load` fulfilled" carries condition `c`. On the else path, no completion fact applies. |
| K6a | Exclusive: `if (c) a(); else b();` | branch, 2 calls | Then-arm to `a`, else-arm to `b` | **Exclusive**, no order needed, not a gap. |
| K6b | Same predicate twice: `if (c) a(); if (c) b();` | 2 branches, 2 calls | Chain through both branches | **Unknown**, not "together" from matching text. Ordered if both occur. |
| K6c | Contradictory-looking: `if (x > 0) a(); if (x < 0) b();` | 2 branches, 2 calls | Chain through both branches | **Unknown**, not "exclusive" from differing conditions. Ordered if both occur. |
| K6d | Early return: `if (c) { a(); return; } b();` | branch, call, exit, call | Then-arm to `a`, `a` to exit, else-arm to `b` | **Exclusive**. |
| K7 | `loadLanguage` | 9 steps (section 2.4) | 10 program-order facts, 1 completion fact | 6 pairs: 6 fixed, 0 exclusive, 0 unfixed; 4 together, 2 unknown. |

## 5. Prerequisites that change production, kept separate from the experiment

The experiment needs none of these: it runs on hand-written facts in a scratch store. R-1B2 needs all of them. Each gets its own protocol entry, frozen before code, with these predictions.

### P0, instrument: reconcile walked call sites against stored invocations

**Scope.** Report walked call sites and stored call invocations side by side, with a written definition of each, and name every difference. No store change.

**Predictions.**
- `ir0-typescript` 65 = 65.
- `toml-python` 65 = 65.
- `radon-python` 120 against 121: one difference, cause unknown at the time of writing.

P0 passes only if it names that one difference. The radon count must not be adjusted to match.

### P1, representation in ingestion: steps

**Scope.**
- New concept kind `step`.
- `CONTAINS_STEP` from executable to step, carrying the structural position as provenance.
- `STEP_INVOKES` from call step to invocation.

No IR change and no encoder change. **One decision P1's protocol must settle before code:** whether invocations keep being rebuilt from the sorted projection, which leaves identical-key steps without a unique invocation to point at, or are minted from the walk. Minting from the walk is cleaner and moves I-0's merge accounting, so it needs P0's answer first.

**Predictions.**
- **New step concepts**, from the probe at build `a93a98cead33`:
  - `ir0-typescript` 226 (65 calls, 5 awaits, 52 branches, 15 opaque, 9 writes or emits, 80 exits).
  - `toml-python` 267 (65, 0, 67, 34, 32, 69).
  - `radon-python` 402 (120, 0, 51, 81, 32, 118).
  - Radon's figure rests on P0.
- **Nothing existing moves.**
  - Every existing relation count is unchanged, including `HAS_PREDICATE` 96.
  - `ir_schema` stays 6.
  - Every fingerprint value and every collision-group membership is unchanged.
  - Every corpus still reproduces its R-1A row, and the R-1B0 order section is unchanged (96, 303, 274).
- **Controls.**
  - Reformatting changes no step and no position (N3).
  - K1 yields two steps.

### P2, representation in ingestion: path membership

**Scope.** `IN_ARM` from step to its immediately enclosing branch step, with `arm`. Plus, depending on the H ruling, `HAS_PREDICATE` on branch steps.

**Predictions.**
- One `IN_ARM` per step inside an arm.
- The R-1B0 instrument gains the three classes.
- Fixed pairs stay 0, because no order relation exists yet.
- Numeric splits of 96, 303, and 274 into together, exclusive, and unknown are frozen with P2's protocol, computed from the walk before code, the way P1's counts were.

### Limits carried forward, not solved here

- Calls nested inside another call's arguments are not steps (`readFileSync` inside `Language.load`). Their order within argument evaluation is not represented.
- Loops, `try`, and `with` remain opaque single steps. Nothing inside them is ordered.
- Module-level names (`ready`) remain unidentified.
- Shared state is not modelled. That is why program order, not dependency order, is the default (R-1B protocol, section 2.4).

## 6. Order of work proposed

1. **R-1B1 experiment**, scratch only. Freeze sections 3 and 4 as the protocol, run, score, and rule A or B and H1 or H2.
2. **P0**, freeze and run.
3. **P1**, freeze (including the invocation decision) and run.
4. **P2**, freeze with numeric class predictions and run.
5. **R-1B2**, the chosen order relation written by ingestion. `loadLanguage` and the controls are its first predictions.

## 7. Rulings requested before anything is frozen

1. The step concept kind and what counts as a step (section 2.1).
2. The three pair classes and their structural rules, with "unknown" never resolved by comparing conditions (section 2.2).
3. The event table and the two kinds of order fact, with rejection never ordered (section 2.3).
4. Frontier-only writing with transitive derivation (section 2.4).
5. The experiment design, candidates, H dimension, and scoring order (section 3).
6. The controls and their expected answers (section 4).
7. The prerequisite split and order (sections 5 and 6), including that radon's one-invocation difference must be explained by P0 before P1 is frozen.
