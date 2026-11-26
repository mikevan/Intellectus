# R-1B1 freeze candidate: occurrence identity, path membership, and the order-relation experiment

Michael Van Geertruy, with Claude. INTERNAL. Drafted 2026-11-02. **Freeze candidate for review. Not frozen. No production implementation.**

## 0. Lineage and what this document replaces

This document consolidates drafts 1, 2, and 3 into one self-contained protocol. Where they differ, this one governs. The drafts stay in `docs/` unedited:

| Draft | sha256 |
|---|---|
| `r1b1-design-draft.md` | `0d74706a...` |
| `r1b1-design-draft-2.md` | `27f4df90...` |
| `r1b1-design-draft-3.md` | `89a143eb...` |

**Historical misses, preserved in `docs/experiment-log.md` and not corrected in place:**

- Draft 1: the K4 prediction, and the overlap between Together and Exclusive.
- Draft 2: false precedence in R-FULFIL and R-AWAIT, and a cycle rule that refused a valid awaited call.
- Draft 3: the last-statement fall-through rule, the missing entry fact, and inherited fixtures that omitted facts draft 3 itself required.

**Accepted by Michael and carried here unchanged in substance:**

- the step concept and ownership;
- the event model and settlement guarantees;
- condition propagation;
- normalised event-graph validation;
- the K4 correction;
- the separate predicate counts;
- K9b;
- the prerequisite boundaries and sequence.

**New in this candidate:**

- block-composed `ARM_STATUS` (2.5);
- the entry fact (2.3);
- the conservative implicit exit (2.4);
- reachability and completeness boundaries (5.2);
- the full validator (7.3);
- the consolidated fixture manifest (8);
- the ablation (10);
- the corrected X2 contract (11).

## 1. Scope and boundary

**What R-1B1 tests:** representation and inference only, on facts written **by hand** into a scratch store outside the repository, with a scratch copy of the relation schema. Specifically, it tests whether the candidates can hold the facts, whether the validator refuses what it must, and whether the checker derives exactly the expected answers.

**What it does not test:**

- encoder agreement between TypeScript and Python, which comes in P1 and R-1B2;
- whether ingestion captures every source occurrence.

**Baseline left untouched:** build `a93a98cead33`; R-1B0 pairs 96, 303, 274 with 0 fixed; `ORDER_UNSPECIFIED` 3 and 2; executable-level `HAS_PREDICATE` 96. **The 96 pairs are a diagnostic population that includes mutually exclusive pairs, not 96 proven ordering gaps.**

## 2. Representation (what a store holds)

### 2.1 Steps and ownership

- A `step` is a new concept kind.
- `CONTAINS_STEP`, from executable to step, is ownership. The step's concept id is its identity.
- A required `stepKind` is one of `call`, `await`, `branch`, `exit`, `opaque`, `write`, or `emit`.
- An `exit` may carry `implicit: true`.

**What gets a step:** each top-level call, each `awaited` level, each branch, each semantic opaque statement, each `WRITE` or `EMIT` effect, each explicit `return` or `throw`, and the implicit exit (2.4). Steps follow the projection's walk: no step is created for code after an element that always exits.

**What stays true of steps:**

- Repeated identical occurrences are distinct steps.
- Fresh identities on every ingestion are accepted for this increment.
- Structural positions are provenance only.
- Calls nested in another call's arguments, and anything inside an opaque construct, are not steps. Sufficiency reporting names both per executable.

### 2.2 Membership

`IN_ARM` runs from a step to its **immediately** enclosing branch step, with `arm: then | else`. A step's arm set is the `IN_ARM` chain followed upward. Its validation is in 7.3.

### 2.3 Entry (new)

**`ENTRY_STEP`** runs from an executable to exactly one step it owns: the first step of the body walk. A body with no other steps has its implicit exit as its entry. It is written by ingestion from the walk in production, and by hand here. The dominance proof starts only from this fact. Positions never supply it.

### 2.4 The implicit exit (conservative; new)

An executable gets one `exit` step with `implicit: true` **unless its body status (2.5) is `always-exits`**. Program facts into it obey the ordinary meaning: "if the predecessor completes normally, this starts after it".

Its existence claims only that the represented structure has an end point. It **does not claim that execution reaches it**. Where the body status is `unknown`, for example because the body ends in an opaque loop, nothing about reaching the exit is derived. It exists so that every non-exit step has a successor, which makes local edge completeness checkable.

### 2.5 `ARM_STATUS`, composed over the whole block (corrected)

**What `falls-through` means, used consistently everywhere:** the represented block contains at least one *structurally possible* normal path from its start to its end. That path passes no exit, and every step on it is a represented kind that can complete normally: `call`, `await`, `write`, `emit`, or a branch through a `falls-through` arm.

It is **not** a guaranteed normal path, since any call may throw. It matches Together, which also claims only structural compatibility.

**Per element:**

| Element | Status |
|---|---|
| `call`, `await`, `write`, `emit` | PASS |
| `exit` | ALWAYS |
| `opaque` | UNKNOWN (it may complete, never complete, or leave abruptly) |
| `branch` | ALWAYS if both arms are `always-exits`; PASS if either arm is `falls-through`; otherwise UNKNOWN |

**Per block (sequence), in this precedence:**

1. ALWAYS if **any** element is ALWAYS, since no path reaches the block's end without passing it.
2. Otherwise UNKNOWN if any element is UNKNOWN.
3. Otherwise PASS. An empty block is PASS.

**Mapping to the stored facts:**

- ALWAYS is written `always-exits`.
- PASS is written `falls-through`.
- UNKNOWN is written `unknown`.

`ARM_STATUS` is written for both arms of every branch step. The same composition over the function body decides the implicit exit (2.4).

**This closes draft 3's gaps:**

- An opaque loop followed by a call is UNKNOWN, not `falls-through` (K17).
- A final branch is decided by its own rule, never as a plain "represented step" (K18, K19).
- An opaque construct followed by a `return` is `always-exits`, because the opaque step cannot make the block reach its end (K21).

### 2.6 Await targets

**`AWAIT_TARGET`** (exactly one per `await` step) is written from the R-1A `DependencyTarget`:

| R-1A target | `AWAIT_TARGET` object | `operandClass` |
|---|---|---|
| `outcome` (the awaited expression is a call) | that call step | `call-result` |
| `evaluation` of a local value whose binding expression is exactly one call, with no `awaited` wrapper | that call step, linked by the IR binding id | `call-result` |
| `evaluation` of a literal | literal `{operand}` | `plain-value` |
| `evaluation` of anything else, including module-level names | literal `{operand}` | `unresolved` |

### 2.7 Predicate facts (H dimension)

- **H1:** a new `TESTS_PREDICATE` relation, from a branch step to a `predicate` literal holding that branch's own normalised predicate.
- **H2:** `HAS_PREDICATE` widened so its subject can be a branch step, with the same payload.

In both, the executable-level `HAS_PREDICATE` stays exactly as it is and is always reported on its own line. For `ir0-typescript` that is 96, with branch-level facts reported separately; under H2 the total reads 148. Classification never reads any predicate fact.

## 3. Event model (accepted; restated)

| Step | Events |
|---|---|
| `call` | `invoke`, `return` |
| `await` | `enter`, `continue`, and `settle` where it exists (table below) |
| `branch` | `decide` |
| `exit` | `exit` |
| `opaque`, `write`, `emit` | `start`, `end` |

**Event meanings:**

- `enter`: evaluation reaches the await with its operand evaluated. It does not claim a runtime suspension.
- `continue`: the code after the await runs because the await completed successfully.
- `settle`: the awaited operand completed successfully. Its existence follows the table below.

| Language | `operandClass` | `settle` |
|---|---|---|
| TypeScript | `call-result`, `unresolved` | Conditional. Every fact through it carries `thenable(w)`. |
| TypeScript | `plain-value` | Never exists. |
| Python | any | Exists on every successful continuation, because a non-awaitable operand raises `TypeError` ([PEP 492](https://peps.python.org/pep-0492/)). |

**Internal rules, all conditional on success:**

| Rule | Ordering |
|---|---|
| R-CALL | `invoke` < `return` |
| R-AWAIT | `enter` < `continue` |
| R-SETTLE | `settle` < `continue` |
| R-UNIT | `start` < `end` |

**What is deliberately not ordered:**

- `settle` is not ordered against `enter`, or against any call's `invoke` or `return`. JavaScript defers continuation even for an already-fulfilled promise and accepts ordinary values ([MDN, await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await)).
- **`settle` has no incoming edge.** That is this increment's conservative representation limit. It does not claim that no evidence could ever establish an event before a settlement.

**Program order, X to Y** (with an arm when X is a branch) is the edge `end(X)` → `start(Y)`:

- `end`: call `return`, await `continue`, branch `decide` on that arm, unit `end`.
- `start`: call `invoke`, await `enter`, branch `decide`, `exit`, unit `start`.

No program fact leaves an `exit`. Rejection and throws produce no ordering; that is R-1C.

## 4. Derivation (accepted; restated)

A derived precedence is a chain through the normalised event graph (7.2). Each chain carries the conjunction of:

- both endpoints' arm sets,
- every intermediate step's arm set,
- every arm label on program edges leaving branches.

A chain containing both arms of one branch is invalid. Facts are composed only when the union of their condition sets is valid. **A precedence reachable by several chains carries one condition set per chain, as a disjunction. Sets from different chains are never merged into one conjunction.**

## 5. Classification and completeness

### 5.1 Classes, disjoint, applied in order; the first that holds decides

Pairs are taken over the steps R-1B0 counted as observable effects: `call`, `write`, `emit`, and `opaque` (the projection's pseudo-effects).

1. **Exclusive by arms.** x and y lie in opposite arms of one branch, by `IN_ARM` chains.
2. **Exclusive by termination.** Requires the completeness checks in 5.2.
   - Some branch B has `ARM_STATUS(B, p) = always-exits`.
   - x lies inside arm p, and y lies outside it.
   - **Every** path in the program-fact graph from the `ENTRY_STEP` to y passes through B's other arm.
3. **Together (structurally compatible).**
   - The arm sets are nested.
   - For every arm (B, p) containing exactly one of the two steps, either `ARM_STATUS(B, p) = falls-through`, or (with completeness) the outside step precedes B by a chain of program facts.
4. **Unknown.** Everything else. Predicate text is never read.

### 5.2 Completeness checks and their boundary

Before rule 2, or the precedence clause of rule 3, is applied to an executable, the checker requires all four of these:

1. **Entry:** exactly one `ENTRY_STEP`, owned by the executable, with no incoming program fact.
2. **Arms:** every branch step has exactly one `ARM_STATUS` per arm.
3. **Edges:** every step has exactly the outgoing program facts its kind requires. A `branch` needs one per arm, an `exit` none, and every other kind one.
4. **Reachability:** every step the executable owns is reachable from the `ENTRY_STEP` through program facts.

If any check fails, those rules are not applied, the pair falls to rule 3 (without its precedence clause) or rule 4, and the report names the executable and the failing check.

**Boundary, stated plainly:** these checks prove completeness **over the recorded steps only**. They do not prove ingestion captured every source occurrence: nested calls, the insides of opaque constructs, and code outside encoded functions are all outside the recorded steps. Check 4 exists so a disconnected step cannot satisfy dominance vacuously (K22).

## 6. Evidence contract

**The checker and validator may read only:**

- **Ownership and language:** `CONTAINS_STEP`, plus `MEMBER_OF` and the module's `RENDERS_AS` for language.
- **Structure:** `ENTRY_STEP`, `IN_ARM`, `ARM_STATUS`, `AWAIT_TARGET`.
- **Order:** the candidate's program and completion relations.
- **Reporting only:** `TESTS_PREDICATE` or `HAS_PREDICATE`.

**Permitted attributes:** `stepKind`, `implicit`, `arm`, `status`, `operandClass`, `control` and `within` (Candidate A), and `language`.

**Never read:** positions, the R-1A `at` field, walk ordinals, evidence records, hashes, sequence numbers, or predicate text. Predicate normalisation belongs to the later encoder verification (section 11), which is separate from this ban.

## 7. Candidates and validation

### 7.1 Candidates

| | A: `FOLLOWS` widened | B: new relations |
|---|---|---|
| Program order | `Y FOLLOWS X`, `control: program`, `within`, plus `arm` from a branch | `X NEXT_STEP Y`, plus `arm` from a branch |
| Completion | `W FOLLOWS C`, `control: completion`, `within` | `W AWAITS C` |

Section 10 tests whether either completion relation adds anything beyond `AWAIT_TARGET`.

### 7.2 The graph that is checked

All facts are normalised into one semantic **event graph**:

- nodes are the events in section 3;
- edges are the internal rules, R-SETTLE where `settle` exists or is conditional, and program facts as `end(X)` → `start(Y)`;
- completion facts contribute **no edge**.

Cycle detection and derivation run on this graph, never on raw relation directions. K4a is acyclic under both candidates.

### 7.3 Refusal rules, identical for both candidates

A fact or store is refused if any of the following holds. Each rule has one deliberately invalid fact per candidate in the run (manifest R1 to R23).

| # | Refused when |
|---|---|
| R1 | An order-relation endpoint is not a `step`. |
| R2 | Endpoints are owned by different executables, or (A) `within` does not name the owner. |
| R3 | Self-loop. |
| R4 | A program fact leaves an `exit`. |
| R5 | A program fact leaves a `branch` without an `arm`. |
| R6 | A program fact carries an `arm` but does not leave a `branch`. |
| R7 | A second program fact on the same step and arm. |
| R8 | A completion fact whose endpoints are not one `await` and one `call`. |
| R9 | A completion fact whose call differs from the call `AWAIT_TARGET` names. |
| R10 | A completion fact where `operandClass` is not `call-result`. |
| R11 | A second completion fact for one await. |
| R12 | An `await` step with zero, or two or more, `AWAIT_TARGET` facts. |
| R13 | `AWAIT_TARGET` to a step that is not a `call`, or to a step owned by another executable, or `operandClass` inconsistent with its object. |
| R14 | `IN_ARM` to a non-branch, or across executables. |
| R15 | A step with two `IN_ARM` facts. |
| R16 | An `IN_ARM` cycle. Traversal is bounded by the executable's step count, so it terminates even on refused input. |
| R17 | `ARM_STATUS` on a non-branch, or a duplicate for one arm. |
| R18 | `ENTRY_STEP` missing, duplicated, to a step owned by another executable, or to a step with an incoming program fact. |
| R19 | The normalised event graph acquires a cycle. |
| R20 | A predicate fact on a non-branch. |
| R21 | A second predicate fact for one branch. |
| R22 | A predicate fact whose payload is the path conjunction, not the branch's own predicate. |
| R23 | `implicit: true` on a step that is not an `exit`. |

**Completeness failures are not refusals.** They are reported conditions (5.2) that disable rule 2 and the precedence clause of rule 3.

## 8. Consolidated fixture manifest

### 8.1 Conventions

- Each control is one executable unless stated otherwise. TypeScript unless marked Python.
- `→` is a program fact, and `→|then` / `→|else` leaves a branch through that arm.
- `end` is the implicit exit.
- `W⇐C` is the candidate completion fact.
- `AT` is `AWAIT_TARGET`. `ST` is `ARM_STATUS`, written as `B.then=FT` and so on, with FT for `falls-through`, AE for `always-exits`, and U for `unknown`.
- Every fixture is written fully under both candidates.

| # | Source (function body) | Steps (kind) | Entry | `IN_ARM` | `ST` | `AT` (class) | Program facts | Completion |
|---|---|---|---|---|---|---|---|---|
| K1 | `a.x(); a.x();` | s1 call, s2 call, end exit | s1 | none | none | none | s1→s2, s2→end | none |
| K2 | `f(); g();` | f call, g call, end | f | none | none | none | f→g, g→end | none |
| K3 | `const p = load(); use(p);` | load call, use call, end | load | none | none | none | load→use, use→end | none |
| K4a | `await load(); use();` | load call, w await, use call, end | load | none | none | w: load (call-result) | load→w, w→use, use→end | w⇐load |
| K4b | `load(); use();` | load call, use call, end | load | none | none | none | load→use, use→end | none |
| K5 | `if (c) { await load(); } use();` | b branch, load call, w await, use call, end | b | load, w: (b,then) | b.then=FT, b.else=FT | w: load (call-result) | b→load\|then, load→w, w→use, b→use\|else, use→end | w⇐load |
| K6a | `if (c) a(); else b();` | B, a call, b call, end | B | a: (B,then); b: (B,else) | B.then=FT, B.else=FT | none | B→a\|then, B→b\|else, a→end, b→end | none |
| K6b | `if (c) a(); if (c) b();` | B1, a, B2, b, end | B1 | a: (B1,then); b: (B2,then) | all four FT | none | B1→a\|then, B1→B2\|else, a→B2, B2→b\|then, B2→end\|else, b→end | none |
| K6c | `if (x > 0) a(); if (x < 0) b();` | as K6b | B1 | as K6b | as K6b | none | as K6b | none |
| K6d | `if (c) { a(); return; } b();` | B, a call, r exit, b call, end | B | a, r: (B,then) | B.then=AE, B.else=FT | none | B→a\|then, a→r, B→b\|else, b→end | none |
| K6d-i | K6d with every program fact withheld | as K6d | B | as K6d | as K6d | none | **none** | none |
| K6e | `if (c) { a(); loopA(); } b();` with the loop opaque | B, a call, o opaque, b call, end | B | a, o: (B,then) | B.then=U, B.else=FT | none | B→a\|then, a→o, o→b, B→b\|else, b→end | none |
| K7 | `loadLanguage` (treeSitter.ts lines 9 to 19) | b1, c1 call, w1 await, c2 call, b2, c3 call, w2 await, c4 call, x1 exit; **no implicit exit** (the body always exits) | b1 | c1: (b1,then); c3, w2, c4: (b2,then) | all four FT | w1: `{ready}` (unresolved); w2: c3 (call-result) | b1→c1\|then, c1→w1, b1→w1\|else, w1→c2, c2→b2, b2→c3\|then, c3→w2, w2→c4, c4→x1, b2→x1\|else | w2⇐c3 |
| K8 | `if (c) { if (d) a(); b(); } z();` | B1, B2, a, b, z call, end | B1 | B2, b: (B1,then); a: (B2,then) | all four FT | none | B1→B2\|then, B2→a\|then, a→b, B2→b\|else, b→z, B1→z\|else, z→end | none |
| K9 | `if (c) a(); else b(); d();` | B, a, b, d call, end | B | a: (B,then); b: (B,else) | B.then=FT, B.else=FT | none | B→a\|then, B→b\|else, a→d, b→d, d→end | none |
| K9b | **Closure-engine control, no fixture.** Injected derived facts: x < m with {(B,then)}; m < y with {(B,else)}. | | | | | | | |
| K10 | `if (p) a(); if (q) b();` | as K6b | B1 | as K6b | as K6b | none | as K6b | none |
| K11 | `await ready; use();` | w await, use call, end | w | none | none | w: `{ready}` (unresolved) | w→use, use→end | none |
| K12 | K2 with every program fact withheld | f, g, end | f | none | none | none | **none** | none |
| K13 | `const p = load(); work(); await p; use();` | load, work call, w await, use call, end | load | none | none | w: load via binding (call-result) | load→work, work→w, w→use, use→end | w⇐load |
| K14 | Two executables. `function cached() { return done; }` gives x exit, entry x, no facts. `async function g() { await cached(); use(); }` gives the steps listed. | c call, w await, use call, end | c | none | none | w: c (call-result) | c→w, w→use, use→end | w⇐c |
| K15 | `let ready = Promise.resolve();` then `async function g() { await ready; use(); }` | as K11 | w | none | none | as K11 | as K11 | none |
| K16 | `await 42; use();` | w await, use call, end | w | none | none | w: `{42}` (plain-value) | w→use, use→end | none |
| K16-py | Python: `await 42` then `use()` | as K16 | w | none | none | as K16 | as K16 | none |
| K17 | `if (c) { loopA(); a(); } b();` | B, o opaque, a call, b call, end | B | o, a: (B,then) | B.then=U, B.else=FT | none | B→o\|then, o→a, a→b, B→b\|else, b→end | none |
| K18 | `if (c) { a(); if (d) { loopA(); } else { return; } } b();` | B1, a call, B2, o opaque, r exit, b call, end | B1 | a, B2: (B1,then); o: (B2,then); r: (B2,else) | B2.then=U, B2.else=AE, B1.then=U, B1.else=FT | none | B1→a\|then, a→B2, B2→o\|then, B2→r\|else, o→b, B1→b\|else, b→end | none |
| K19 | `if (c) { a(); if (d) { x(); } else { return; } } b();` | B1, a, B2, x call, r exit, b, end | B1 | a, B2: (B1,then); x: (B2,then); r: (B2,else) | B2.then=FT, B2.else=AE, B1.then=FT, B1.else=FT | none | B1→a\|then, a→B2, B2→x\|then, B2→r\|else, x→b, B1→b\|else, b→end | none |
| K21 | `if (c) { loopA(); return; } b();` | B, o opaque, r exit, b call, end | B | o, r: (B,then) | B.then=AE, B.else=FT | none | B→o\|then, o→r, B→b\|else, b→end | none |
| K22 | K2 plus a disconnected call h | f, g, h call, end | f | none | none | none | f→g, g→end, h→end | none |
| R1 to R23 | One invalid fact each (7.3), added to a copy of K4a, K6a, or K7 as the rule requires | | | | | | | |

### 8.2 Recomputed counts

| # | Steps | Entry | Program | Completion | `IN_ARM` | `ARM_STATUS` | `AWAIT_TARGET` |
|---|---|---|---|---|---|---|---|
| K1, K2, K3, K4b | 3 | 1 | 2 | 0 | 0 | 0 | 0 |
| K4a | 4 | 1 | 3 | 1 | 0 | 0 | 1 |
| K5 | 5 | 1 | 5 | 1 | 2 | 2 | 1 |
| K6a | 4 | 1 | 4 | 0 | 2 | 2 | 0 |
| K6b, K6c, K10 | 5 | 1 | 6 | 0 | 2 | 4 | 0 |
| K6d | 5 | 1 | 4 | 0 | 2 | 2 | 0 |
| K6d-i | 5 | 1 | 0 | 0 | 2 | 2 | 0 |
| K6e | 5 | 1 | 5 | 0 | 2 | 2 | 0 |
| K7 | 9 | 1 | 10 | 1 | 4 | 4 | 2 |
| K8 | 6 | 1 | 7 | 0 | 3 | 4 | 0 |
| K9 | 5 | 1 | 5 | 0 | 2 | 2 | 0 |
| K11, K15, K16, K16-py | 3 | 1 | 2 | 0 | 0 | 0 | 1 |
| K12 | 3 | 1 | 0 | 0 | 0 | 0 | 0 |
| K13 | 5 | 1 | 4 | 1 | 0 | 0 | 1 |
| K14 (`g`; `cached` is 1 step, 1 entry, no facts) | 4 | 1 | 3 | 1 | 0 | 0 | 1 |
| K17 | 5 | 1 | 5 | 0 | 2 | 2 | 0 |
| K18 | 7 | 1 | 7 | 0 | 4 | 4 | 0 |
| K19 | 7 | 1 | 7 | 0 | 4 | 4 | 0 |
| K21 | 5 | 1 | 4 | 0 | 2 | 2 | 0 |
| K22 | 4 | 1 | 3 | 0 | 0 | 0 | 0 |

### 8.3 Same answer, different facts

These fixtures changed from earlier drafts while their expected pair answers did not:

| Control | What changed |
|---|---|
| K1, K2, K3, K4a, K4b, K5, K6a, K6b, K6c, K6d, K8, K9, K10, K11, K13, K14 | Each gained an implicit exit, a successor fact into it, and an entry fact. |
| K6b, K6c, K10 | Each also gained the `B2 → end` else fact, which draft 2 left implicit. |
| K8 | The call `e()` is renamed `z()`, so the exit can be called `end`. |
| K7 | Gained only the entry fact and its four `ARM_STATUS` facts. Its body always exits, so it has no implicit exit, and its 10 program facts are unchanged. |

## 9. Expected answers

### 9.1 Notation

- `S(w)` is w's `settle`.
- `[thenable(w)]` is the TypeScript qualifier.
- "Not derived" means the run asserts the precedence is **absent**.
- Classes are T (Together), X (Exclusive), and U (Unknown).

All completeness checks pass unless stated otherwise.

### 9.2 Answers

| # | Pairs: class; order; condition | Other required precedences | Must not be derived |
|---|---|---|---|
| K1 | (s1,s2): T; s1.return < s2.invoke; {} | s1 and s2 are distinct ids | none |
| K2 | (f,g): T; f.return < g.invoke; {} | none | none |
| K3 | (load,use): T; load.return < use.invoke; {} | none | no settlement exists; nothing about load's result is ordered |
| K4a | (load,use): T; load.return < use.invoke; {} | w.enter < w.continue < use.invoke; S(w) < w.continue [thenable(w)]; acyclic under A and B | load.return < S(w); w.enter < S(w) |
| K4b | (load,use): T; load.return < use.invoke; {} | **Delta from K4a:** 1 step, 2 program facts, the completion fact, and `AT` removed; 1 program fact added; S(w) < use.invoke lost | any settlement |
| K5 | (load,use): T; load.return < use.invoke; {(b,then)} | S(w) < use.invoke with {(b,then)} [thenable(w)] | S(w) related to anything on the else path |
| K6a | (a,b): X by rule 1; no order | a < end {(B,then)}; b < end {(B,else)} | any a/b precedence |
| K6b | (a,b): U; a.return < b.invoke; {(B1,then),(B2,then)} | none | T from matching predicate text |
| K6c | (a,b): U; as K6b | none | X from contradictory-looking text |
| K6d | (a,b): X by rule 2 | none | T |
| K6d-i | (a,b): U by rule 4; completeness reports missing edges and unreachable steps | none | X from missing edges; T |
| K6e | (a,o): T; a < o {(B,then)}. (a,b): U; a < b {(B,then)}. (o,b): U; o < b {(B,then)} | none | T for (a,b) or (o,b) |
| K7 | Six pairs, in 9.3 | w1.enter < w1.continue < c2.invoke; S(w1) < w1.continue [thenable(w1)], no producer; S(w2) < c4.invoke {(b2,then)} [thenable(w2)] | c3.return < S(w2); w2.enter < S(w2); anything about c1's result settling |
| K8 | (a,b): T; a < b {(B1,then),(B2,then)}. (a,z): T; a < z {(B1,then),(B2,then)}. (b,z): T; b < z {(B1,then)} | none | none |
| K9 | (a,b): X. (a,d): T; a < d {(B,then)}. (b,d): T; b < d {(B,else)} | none | any a/b precedence |
| K9b | none | none | x < y. A condition-blind closure derives it and must fail. |
| K10 | (a,b): U; a < b with **exactly** {(B1,then),(B2,then)} | none | {(B2,then)} alone; {} |
| K11 | no pairs | w.enter < w.continue < use.invoke; S(w) < w.continue [thenable(w)]; reported as "producer unidentified" | w.enter < S(w); any producer named |
| K12 | (f,g): T; **unordered**; completeness reports missing edges | none | f < g from positions |
| K13 | (load,work): T; load.return < work.invoke. (load,use): T; load.return < use.invoke. (work,use): T; work.return < use.invoke. All {} | S(w) < w.continue < use.invoke [thenable(w)] | S(w) < work.invoke; w.enter < S(w); load.return < S(w) |
| K14 | (c,use): T; c.return < use.invoke; {} | S(w) < use.invoke [thenable(w)] | c.invoke < S(w); c.return < S(w); w.enter < S(w) |
| K15 | as K11 | as K11 | w.enter < S(w) |
| K16 | no pairs | w.enter < w.continue < use.invoke | **any fact naming S(w)**, because none exists |
| K16-py | no pairs | program facts valid, but vacuous (no successful continuation) | any settlement from the TypeScript plain-value rule |
| K17 | (o,a): T; o < a {(B,then)}. (o,b): U; o < b {(B,then)}. (a,b): U; a < b {(B,then)}. B.then=U, **not FT** | none | T for (a,b) or (o,b) |
| K18 | (a,o): T, by rule 3's precedence clause (a precedes B2); a < o {(B1,then),(B2,then)}. (a,b): U; a < b {(B1,then),(B2,then)}. (o,b): U; o < b {(B1,then),(B2,then)}. B1.then=U, **neither AE nor FT** | none | T for (a,b); B1.then as AE or FT |
| K19 | (a,x): T; a < x {(B1,then),(B2,then)}. (a,b): T; a < b {(B1,then),(B2,then)}. (x,b): T; x < b {(B1,then),(B2,then)}. B1.then=FT | none | none |
| K21 | (o,b): X by rule 2. B.then=AE, even though an opaque step precedes the return | none | T |
| K22 | (f,g): T; f < g {}. (f,h), (g,h): T by arms alone (both arm sets empty), **unordered**. Reachability fails for h and is reported; rule 2 and rule 3's precedence clause are disabled for this executable | none | any rule-2 result for this executable; dominance computed with h present; any order involving h |
| R1 to R23 | each refused by name, under both candidates | none | none |

### 9.3 K7 pairs

| Pair | Class | Order | Condition |
|---|---|---|---|
| c1, c2 | T | c1.return < c2.invoke | {(b1,then)} |
| c1, c3 | U | c1.return < c3.invoke | {(b1,then),(b2,then)} |
| c1, c4 | U | c1.return < c4.invoke | {(b1,then),(b2,then)} |
| c2, c3 | T | c2.return < c3.invoke | {(b2,then)} |
| c2, c4 | T | c2.return < c4.invoke | {(b2,then)} |
| c3, c4 | T | c3.return < c4.invoke; S(w2) < c4.invoke [thenable(w2)] | {(b2,then)} |

**Totals:** 6 pairs: 6 ordered, 0 exclusive, 0 unordered; 4 Together, 2 Unknown.

## 10. Ablation: does a completion relation add anything?

For every fixture with a completion fact (K4a, K5, K7, K13, K14), the checker runs twice under each candidate: once with the completion fact, and once with it removed and `AWAIT_TARGET` kept.

**Recorded per run:** every query from section 9 that becomes unanswerable, or changes its answer.

**Prediction, stated before running:** **none.** `AWAIT_TARGET` supplies the identity, R-SETTLE supplies the order, and completion facts contribute no edge (7.2). If the prediction holds for both candidates, that is a valid result. It informs the production ruling that no completion relation is needed. Validation rules R8 to R11 would then become moot, and **no duplicate assertion is kept just to preserve the two-relation premise.**

## 11. X2: what the later encoder test must verify

**Kept as established:** the section-16 pair has equal effect projections and fingerprints. This is the X2 fixture in `test/ir/r1a-await.test.ts`:

- Python: `if amount > Decimal("25000.00") and status == "APPROVED":` then `await publish(amount)`.
- TypeScript: two early-return branches, then `await publish(amount);`.

**Vacuous in R-1B:** pair checks, because each side has one observable effect.

**What the encoder test (P1, R-1B2) must verify:**

1. **Dependency identity.** One `publish` call step and one await step per side, with `AWAIT_TARGET` naming that call, `call-result`.
2. **Effective conditions.** A step's effective condition is the **disjunction, over its paths from the `ENTRY_STEP`, of each path's conjunction of arm choices**. Each side here has exactly one path:
   - Python: {(B,then)};
   - TypeScript: {(B1,else),(B2,else)}.

   The test must show the two are the same predicate, using the projection's existing normalisation of the branches' own predicates. **That normalisation belongs to the encoder test.** The order checker's ban on reading predicate text still holds.
3. **The language rule applies per side, and the sides must differ:**
   - Python's `settle` exists on every successful continuation.
   - TypeScript's is qualified by `thenable(w)`.

   The test asserts that difference rather than flattening it.

## 12. Prerequisites and sequence (accepted; updated counts marked provisional)

1. **This experiment,** frozen from this document and scored. Michael then rules on A or B, H1 or H2, and whether a completion relation is kept (section 10).
2. **P0:** explain radon's 120 call sites against 121 call invocations before P1 is frozen. The original observation stands as recorded. A probe error is logged as a probe miss.
3. **P1:** steps, `CONTAINS_STEP` with `stepKind`, `ENTRY_STEP`, implicit exits, and `AWAIT_TARGET`.
   - These are graph-contract changes, recorded separately from `ir_schema`, which stays 6.
   - The step counts given in draft 1 (226, 267, 402) are **superseded and provisional**. Implicit exits change them, and they will be recomputed from the walk when P1 is frozen.
   - "Nothing existing moves" stays provisional until P0 and the invocation-mapping decision are ruled.
4. **P2:** `IN_ARM` and `ARM_STATUS` by 2.5, with numeric class splits frozen before code. Before order facts exist, rule 2 and rule 3's precedence clause are not available.
5. **R-1B2:** the chosen order relation, with the controls above as its first predictions.

## 13. Limits carried forward

- Nested calls in arguments are not steps.
- Opaque constructs are single steps.
- Module-level names are unidentified.
- Shared state is not modelled; that is why program order is the default.
- `settle` has no incoming edge; that is a conservative limit of this increment.
- Completeness covers recorded steps only.
- Failure paths belong to R-1C.

## 14. Ruling requested

1. Approve this document as the frozen R-1B1 protocol, or name the sections to correct.
2. On approval, the experiment runs in a scratch copy outside the repository. Its fixtures and checker live there, and the results are logged before any ruling on A or B, H1 or H2, or the completion relation.


## 15. Amendments ruled 2026-11-02, frozen with this protocol

Michael approved the freeze candidate (sha256 `430e33cae1e00e0b...`) for the scratch-store experiment with five amendments. Where this section differs from sections 0 to 14, this section governs.

**A1. The diagnostic population includes opaque steps.** Pairs are taken over `call`, `write`, `emit`, and `opaque` steps, which preserves R-1B0's population (96, 303, 274) rather than narrowing it. Draft 2's "call, write, and emit only" definition is recorded as a correction in the experiment log. P0 and the later production checks must verify this correspondence against the actual baseline.

**A2. Together has a narrower meaning.** Together means only that the recorded arm facts do not establish incompatibility under rule 3. It does not prove entry reachability, and it does not prove an executable path through both occurrences. Completeness is reported separately. K12 and K22 keep Together for their unconnected effect pairs without any claim that those pairs are reachable. K22's prohibition is narrowed to **no order between h and f or g**; the recorded `h -> end` precedence stays derivable and is required.

**A3. Always-exits means no normal fall-through.** The stored status `always-exits` means the block has **no normal fall-through to its end**, including possible divergence. It does not prove that every execution eventually returns or throws. An opaque loop followed by `return` is `always-exits` even if the loop never terminates. The spelling is kept for this experiment, and K21's expected classification is preserved: termination-based exclusivity needs only the absence of normal fall-through.

**A4. R22 is deferred.** The validator may not read predicate text, so it cannot tell a branch's own predicate from a path conjunction. R22 moves to the later ingestion and encoder verification, and is reported in this experiment as **deferred, not passed**. Here, predicate facts are validated for subject kind (R20) and cardinality (R21) only, and the harness, outside the order checker, compares each stored payload with the fixture oracle. **Legacy assertions are never refused by step rules:** an executable-level `FOLLOWS` between executables (Candidate A) and executable-level `HAS_PREDICATE`, including several on one executable, remain valid.

**A5. Scoring procedure.** All four combinations run: A with H1, A with H2, B with H1, and B with H2. Each is scored on:

1. Required and forbidden query answers.
2. Applicable refusal controls, running **every alternative named within a rule**, not one representative.
3. Preservation of existing relation meanings.
4. Assertion counts, including the completion-relation ablation.
5. Derivation cost, by a stated repeatable measure.

Validation failures are recorded separately from completeness warnings. The ablation prediction stands: removing the completion fact while `AWAIT_TARGET` remains loses no required query.

### 15.1 Operational definitions frozen with the amendments

- **Refusal codes are exact.** Each refusal control lists the exact set of codes expected. Each fact is checked against its rules in the order R1 to R23, and only its first failing rule is reported. A refused fact is excluded from the event graph before cycle detection (R19) and derivation, so one bad fact produces one code.
- **Condition sets are compared exactly.** A required precedence lists its full disjunction of condition sets, each with its arm choices and its `thenable` qualifiers, and the derived disjunction must equal it, not merely contain it.
- **Exclusive pairs and "unordered" pairs** require that no precedence is derived between any event of one step and any event of the other, in either direction. An ordered pair requires its listed precedence, plus the absence of every precedence in the reverse direction.
- **`ARM_STATUS` is also computed.** Each fixture carries its body structure. The harness computes block statuses by section 2.5 and compares them with the stored `ARM_STATUS` facts and with whether an implicit exit exists. A disagreement is reported as a fixture defect or a rule defect, never silently resolved.
- **Assertion count:** every fact stored for the fixture, by relation, plus the total of attribute values on those facts.
- **Derivation cost:** two counters, recorded per fixture and combination. **Facts inspected** counts every stored fact read while normalising to the event graph. **Edge expansions** counts every edge followed while enumerating chains. Both are deterministic for a given store and are reported as totals.
- **Legacy fixture L1** holds an executable-level `FOLLOWS` (`control` and `within` set) and two executable-level `HAS_PREDICATE` facts on one executable, and must produce no refusal under any combination.
- **Fixture data** is frozen in `docs/r1b1-manifest.json`. Where its data and the prose tables in sections 8 and 9 differ, the manifest is the record that was run, and each difference is reported as a finding.
