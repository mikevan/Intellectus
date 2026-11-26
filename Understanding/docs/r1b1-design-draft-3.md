# R-1B1, draft 3: event rules, classification evidence, validator, affected answers

Michael Van Geertruy, with Claude. INTERNAL. Drafted 2026-11-02 in answer to Michael's review of draft 2. **Not frozen. No implementation.**

Drafts 1 and 2 stay in the repository unedited. The two errors draft 2 introduced, false precedence in R-FULFIL and R-AWAIT and a cycle rule that refused a valid awaited call, are recorded in the experiment log. Every part of draft 2 not replaced here stands: ownership and identity, condition propagation (section 2.4), the K4 correction, the separate predicate counts (section 3.4), and the prerequisite boundaries.

## A. Event rules (replaces draft 2's section 2.3)

### A.1 What the languages guarantee, sourced

**JavaScript:**

- A value that is not a promise is converted to a resolved promise and awaited. A non-thenable value is not treated as a promise: "An already-fulfilled `Promise` is constructed and used."
- Execution still pauses "even when the used promise is already fulfilled". So an already-settled operand is normal, and continuation is still deferred.
- On rejection, "the `await` expression throws the rejected value."

All three: ([MDN, await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await)).

**Python:**

- "`await` only accepts an *awaitable*", that is, a native coroutine, a generator-based coroutine, or an object with `__await__`.
- "It is a `TypeError` to pass anything other than an *awaitable* object to an `await` expression."

Both: ([PEP 492](https://peps.python.org/pep-0492/)). So a Python `await` that continues successfully proves its operand was awaitable. A JavaScript one proves nothing about the operand's type.

### A.2 Events

| Step kind | Event | Meaning |
|---|---|---|
| `call` | `invoke` | Control enters the callee. |
| `call` | `return` | The call expression yields its value normally. Nothing is claimed about any later settlement of that value. |
| `await` | `enter` | Evaluation reaches the await with its operand already evaluated. **It does not claim the runtime actually suspended.** |
| `await` | `continue` | The code after the await runs because the await completed successfully. |
| `await` | `settle` | The awaited operand completed successfully: a promise or thenable fulfilled (JavaScript), or an awaitable completed (Python). **This event exists only under the existence rules in A.3.** |
| `branch` | `decide` | The predicate is evaluated and one arm is taken. |
| `exit` | `exit` | Explicit `return` or `throw`, or the implicit end of the function body (see C.4). |
| `opaque`, `write`, `emit` | `start`, `end` | The construct as one unit. Its inside is not represented. |

**Draft 2's `call.fulfil` is removed.** Settlement belongs to the awaited operand at the await that observes it, not to the call that produced the value. A value can be fulfilled before the call that returns it was ever invoked.

### A.3 When `settle` exists

The await step records its operand class through `AWAIT_TARGET` (section B.2). The language comes from the owning module.

| Language | Operand class | `settle` |
|---|---|---|
| JavaScript or TypeScript | `call-result` or `unresolved` | **Conditional.** It exists only if the operand is a thenable, which the store cannot tell. Every derived fact through it carries the qualifier `thenable(w)`. |
| JavaScript or TypeScript | `plain-value` (the operand is a literal) | **Never exists.** No settlement event is invented. |
| Python | any class | Exists **on every successful continuation**, because a successful `await` proves the operand was awaitable. A non-awaitable operand raises `TypeError` at the await, so there is no successful continuation, and that failure is R-1C. |

**JavaScript's rule that a plain value is accepted is never applied to Python, and Python's rule that the operand must be awaitable is never applied to JavaScript.**

### A.4 Internal rules, the only orderings a step imposes on itself

| Rule | Ordering | Condition |
|---|---|---|
| R-CALL | `invoke` < `return` | The call returns normally. |
| R-AWAIT | `enter` < `continue` | Successful continuation. |
| R-SETTLE | `settle` < `continue` | `settle` exists (A.3) and continuation is successful. |
| R-UNIT | `start` < `end` | The construct completes normally. |

**Deliberately absent, because the languages do not guarantee them:**

- No order between `settle` and `enter`. The operand may already be settled when the await is reached.
- No order between `settle` and the producing call's `invoke` or `return`. The value may have been settled before the call was invoked.

**`settle` has no incoming edge of any kind.** It precedes `continue` and nothing precedes it, so no derivation can place anything before a settlement.

### A.5 Program and completion facts as event edges

**Program order, X to Y** (with arm a when X is a branch) connects `end(X)` to `start(Y)`:

- `end(call)` is `return`, `end(await)` is `continue`, `end(branch, a)` is `decide` on arm a, and `end(opaque, write, emit)` is `end`.
- `start(call)` is `invoke`, `start(await)` is `enter`, `start(branch)` is `decide`, `start(exit)` is `exit`, and `start(opaque, write, emit)` is `start`.

**A completion fact between await W and call C means only this:** W's `settle` is the settlement of the value C returned. It adds no edge of its own. Its ordering content is R-SETTLE, carrying `thenable(W)` where A.3 requires it. What it does add is identity: a derived fact can now say *whose* result settled before the continuation.

**What can be derived about a call's result,** on a successful run:

- `C.return` < `W.enter` < `W.continue` < everything after W. This follows from program order and R-AWAIT.
- `W.settle` < `W.continue` < everything after W. This follows from R-SETTLE.
- **Nothing orders `W.settle` against `C.return`, `W.enter`, or any step between C and W.**

## B. Evidence contract (replaces draft 2's section 2.1 bullet, "Positions never reach the checker as evidence")

### B.1 What the checker and validator may read

**Relations:**

- `CONTAINS_STEP` (ownership).
- `MEMBER_OF` and the module's `RENDERS_AS` (language only).
- `IN_ARM` and `ARM_STATUS` (section C).
- `AWAIT_TARGET` (B.2).
- The candidate's program-order and completion facts: `FOLLOWS` under A; `NEXT_STEP` and `AWAITS` under B.
- `TESTS_PREDICATE` or `HAS_PREDICATE`, for reporting only. Classification never reads predicate text.

**Attributes:**

| Attribute | On | Values |
|---|---|---|
| `stepKind` | `CONTAINS_STEP` | `call`, `await`, `branch`, `exit`, `opaque`, `write`, `emit` |
| `implicit` | `CONTAINS_STEP` of an `exit` | `true` for the implicit end of the body |
| `arm` | `IN_ARM`; any program fact leaving a branch | `then`, `else` |
| `status` | `ARM_STATUS` | `always-exits`, `falls-through`, `unknown` |
| `operandClass` | `AWAIT_TARGET` | `call-result`, `unresolved`, `plain-value` |
| `control`, `within` | Candidate A's `FOLLOWS` | `program` or `completion`; the owning executable |
| `language` | the module's `RENDERS_AS` | `python`, `typescript` |

**Never read:** structural positions, the R-1A `at` field, walk ordinals, evidence records, source hashes, assertion sequence numbers, or predicate text. Control K12 pins this.

### B.2 The stored link for an await's dependency target

**`AWAIT_TARGET`**, from an `await` step, is written by ingestion from the R-1A `DependencyTarget` already in the projection. It is a P1 graph-contract addition, hand-written in the experiment. The object is either a `call` step or a literal:

| R-1A target | `AWAIT_TARGET` object | `operandClass` |
|---|---|---|
| `outcome` (the awaited expression is a call) | that call step | `call-result` |
| `evaluation` of a local value whose binding expression is exactly one call, no `awaited` wrapper | that call step, linked through the binding | `call-result` |
| `evaluation` of a literal | literal `{operand}` | `plain-value` |
| `evaluation` of anything else, including module-level names such as `ready` | literal `{operand}` | `unresolved` |

The second row reads only the IR's binding id, which is positional within one function. No name matching is involved. **The validator refuses a completion fact unless it names exactly the call step that `AWAIT_TARGET` names for that await.** Under Candidate B, `AWAITS` would then duplicate `AWAIT_TARGET`, and the experiment reports that redundancy as a scoring item.

## C. Classification evidence and completeness (replaces draft 2's section 2.2 rules)

### C.1 Arm status as a positive fact for every arm

P2 writes **`ARM_STATUS` for both arms of every branch step**, each from the IR alone:

| Status | Written when |
|---|---|
| `always-exits` | The IR's `alwaysExits()` holds for the arm. |
| `falls-through` | The arm is empty; or its last statement is a represented step other than `exit` or `opaque`; or its last statement is a branch with at least one `falls-through` arm. |
| `unknown` | Anything else, chiefly an arm ending in an opaque construct. A loop that always returns is not provable from the IR, so its arm is never written as `falls-through`. |

`ARM_STATUS` replaces draft 2's `ARM_TERMINATES`. **No status is ever inferred from a missing fact.**

### C.2 Completeness is checked, not assumed

Before any classification that relies on absence, the checker verifies two things for the executable:

1. **Arm completeness:** every branch step carries exactly two `ARM_STATUS` facts, one per arm.
2. **Edge completeness** (from R-1B2, and in the experiment): every step has exactly the outgoing program facts its kind requires.
   - `call`, `await`, `opaque`, `write`, `emit`: one.
   - `branch`: one per arm.
   - `exit`: none.

   This is a local count per step, possible because the implicit end of the body is an `exit` step (C.4), so every other step has a successor.

If either check fails, rules that rely on absence (rule 2, and the precedence clause in rule 4) are not applied. The report names the incomplete executable and the missing facts.

### C.3 Disjoint classes, applied in this order; the first rule that holds decides

1. **Exclusive by arms.** Some branch B has x in arm p and y in arm q of B, with p ≠ q, by `IN_ARM` chains. A positive proof that needs no completeness.
2. **Exclusive by termination.** Requires edge completeness. Some branch B has `ARM_STATUS(B, p) = always-exits`. One step, x, lies inside arm p. The other, y, lies outside arm p, and **every** path from the executable's first step to y passes through B's other arm. With complete edges, that is a positive dominance proof over a finite graph. It does not rely on any edge being missing.
3. **Together (structurally compatible).**
   - The arm sets are nested: `arms(x) ⊆ arms(y)` or the reverse.
   - And for every arm (B, p) containing exactly one of the two steps, either `ARM_STATUS(B, p) = falls-through`, or (with edge completeness) the outside step precedes B by a chain of program facts.
   - Together still claims only compatibility within the represented model, never that both execute.
4. **Unknown.** Everything else. This includes every case where termination is `unknown`, where completeness fails, or where the two steps lie under independent branches. Predicate text is never consulted.

**This closes draft 2's gap.** A pair separated by an arm with no proven `falls-through` status can no longer reach Together. Without edge completeness, K6d is Unknown by rule 4, never Together by default.

### C.4 The implicit end

P1 adds one `exit` step with `implicit: true` per function whose body can fall off its end. That way edge completeness can be checked locally. It changes P1's provisional step counts, which are recomputed when P1's protocol is frozen.

## D. Validator (replaces draft 2's section 3.3)

### D.1 The graph that is checked

Every candidate's facts are **normalised into one semantic event graph** before any precedence check. Nodes are events (A.2). Edges come from four sources:

- the internal rules R-CALL, R-AWAIT, and R-UNIT;
- R-SETTLE, wherever `settle` exists or is conditional;
- program facts, as `end(X)` to `start(Y)`;
- nothing from the completion fact itself, which supplies identity only (A.5).

**Cycle detection runs on this event graph, never on raw relation directions.** Candidate B's program fact `load NEXT_STEP w` and its `w AWAITS load` normalise to `load.return → w.enter → w.continue` and `w.settle → w.continue`. That is acyclic, so a valid awaited call passes both candidates (control K4a, run under each).

### D.2 Refusal rules, identical for both candidates

A fact is refused if:

1. An endpoint is not a `step`.
2. The two endpoints are owned by different executables. Under A, `within` must also name the owner.
3. Both endpoints are the same step.
4. **Program order:**
   - it leaves an `exit`;
   - it leaves a `branch` without an `arm`;
   - it carries an `arm` but does not leave a `branch`;
   - it duplicates a step's required outgoing fact for the same arm.
5. **Completion:**
   - its endpoints are not one `await` and one `call` (direction as each candidate spells it);
   - the call is not the one `AWAIT_TARGET` names for that await;
   - `operandClass` is not `call-result`;
   - it is the second completion fact for the same await.
6. **Status and membership:**
   - an `ARM_STATUS` on a non-branch;
   - a third `ARM_STATUS` on one branch, or two for the same arm;
   - an `IN_ARM` pointing at a non-branch.
7. **The normalised event graph acquires a cycle** (D.1).
8. **Predicate facts (H1 or H2):**
   - one on a non-branch;
   - a second one on the same branch;
   - one whose payload is the path conjunction rather than the branch's own predicate.

Every rule has one deliberately invalid fact in the run, per candidate.

## E. Affected expected answers (replace the matching rows of draft 2's section 4)

### E.1 Notation

Draft 2's notation, plus:

- `S(w)` is w's `settle`.
- `[thenable(w)]` is the JavaScript qualifier from A.3.
- "Not derived" means the checker must **fail to derive** that precedence, and the run asserts the absence.

### E.2 Changed rows

| # | Source | Required precedences | Must NOT be derived |
|---|---|---|---|
| K4a | `await load(); use();` (TS) | load.invoke < load.return < w.enter < w.continue < use.invoke; S(w) < w.continue < use.invoke [thenable(w)]; `AWAIT_TARGET(w) = load, call-result`. Passes validation under **both** candidates. | load.return < S(w); w.enter < S(w) |
| K5 | `if (c) { await load(); } use();` | As K4a inside (b,then); S(w) < use.invoke carries {(b,then)} [thenable(w)]. `ARM_STATUS(b,then) = falls-through`, so (load, use) is Together. | S(w) < anything on the else path |
| K7 | `loadLanguage` (pairs table below) | Unchanged program and condition answers. w1: `AWAIT_TARGET` unresolved; w1.enter < w1.continue < c2.invoke; settlement conditional [thenable(w1)], with no identified producer. w2: `AWAIT_TARGET(w2) = c3, call-result`; S(w2) < c4.invoke {(b2,then)} [thenable(w2)]. Both arms of b1 and b2: `falls-through`. Implicit end: none, because the body ends in `return lang`. | c3.return < S(w2); w2.enter < S(w2); any precedence involving c1's result settling |
| K6d | `if (c) { a(); return; } b();` | `ARM_STATUS(B,then) = always-exits`, `(B,else) = falls-through`. With edge completeness: **X** by rule 2. | Together, under any evidence |
| K6d-i | K6d with all program facts withheld | Edge completeness fails, so rule 2 is not applied: **U**. | X (exclusivity from missing edges); T |
| K6e | `if (c) { a(); loopForever(); } b();` with the loop opaque | `ARM_STATUS(B,then) = unknown`: **U** | T; X |
| K11 | `await ready; use();` (TS) | w.enter < w.continue < use.invoke; `AWAIT_TARGET(w)` unresolved; settlement conditional [thenable(w)], no producer. Reported as "producer unidentified", not as a gap. | w.enter < S(w); any S(w) precedence named to a producer |
| K13 | Pending promise: `const p = load(); work(); await p; use();` | `AWAIT_TARGET(w) = load` via the binding (B.2 row 2). load.return < work.invoke < w.enter < w.continue < use.invoke; S(w) < w.continue [thenable(w)] | S(w) < work.invoke; w.enter < S(w); load.return < S(w) |
| K14 | Already-fulfilled promise returned by a call: `function cached() { return done; }` then `await cached(); use();` | `AWAIT_TARGET(w) = cached`. cached.return < w.enter < w.continue < use.invoke; S(w) < w.continue [thenable(w)] | cached.return < S(w); w.enter < S(w); cached.invoke < S(w) |
| K15 | Already-fulfilled unresolved variable: `await ready; use();` with `ready` fulfilled long before | As K11. The fixture states `ready` was fulfilled earlier; the store cannot see that, and must not contradict it. | w.enter < S(w) |
| K16 | Ordinary JavaScript value: `await 42; use();` | `AWAIT_TARGET(w)` plain-value. w.enter < w.continue < use.invoke. **No `settle` event exists.** | Any precedence naming S(w) |
| K16-py | `await 42` followed by `use()`, in Python | Same step facts. A successful continuation is impossible (`TypeError`), so no `settle` rule is applied on the JavaScript basis. Program facts stay valid, but they are vacuous because w never continues successfully. | Any settlement derived from the JavaScript plain-value rule |
| K9 | `if (c) a(); else b(); d();` | Unchanged: a and b X; a < d {(B,then)}; b < d {(B,else)}. Kept as a branch-and-join control. | any a/b precedence |
| K9b | **Closure-engine control, not a source program.** Two derived facts injected directly: x < m with {(B,then)}, and m < y with {(B,else)}. | The correct engine derives **nothing** between x and y. A deliberately condition-blind closure, built for this test, derives x < y and must therefore fail. | x < y |

### E.3 K7 pairs (unchanged in class and condition; the settlement wording corrected)

| Pair | Class | Order | Condition |
|---|---|---|---|
| c1, c2 | T | c1.return < c2.invoke | {(b1,then)} |
| c1, c3 | U | c1.return < c3.invoke | {(b1,then),(b2,then)} |
| c1, c4 | U | c1.return < c4.invoke | {(b1,then),(b2,then)} |
| c2, c3 | T | c2.return < c3.invoke | {(b2,then)} |
| c2, c4 | T | c2.return < c4.invoke | {(b2,then)} |
| c3, c4 | T | c3.return < c4.invoke; S(w2) < c4.invoke [thenable(w2)] | {(b2,then)} |

**What moved from draft 2:** "c3.fulfil < c4.invoke" is now the settlement of w2's operand, identified as c3's result and qualified by `thenable(w2)`. Rows K1 to K3, K4b, the K4 delta, K6a to K6c, K8, K10, and K12 are unchanged. The refusal controls are now the D.2 list.

## F. X2, narrowed (replaces draft 2's section 3.5 claim)

**Already established, and kept:** the section-16 pair (`test/ir/r1a-await.test.ts`, X2) has equal effect projections and fingerprints. That is projection equivalence, and nothing here touches it.

**What R-1B's pair checks do not establish:** with one observable effect on each side, there are no pairs, so pair-order agreement is vacuous. That says nothing about agreement on the await's dependency or its conditions.

**What the later encoder test (P1 and R-1B2) must verify for this pair:**

1. **Dependency identity.**
   - Each side has exactly one `call` step for `publish` and one `await` step.
   - The await's `AWAIT_TARGET` names that call step, with `operandClass: call-result`.
   - Exactly one completion fact exists, and it matches `AWAIT_TARGET`.
2. **Effective conditions.** The effective condition of the `publish` call and of its await is the conjunction of arm labels on every path from the first step.
   - Python reaches them through one branch's `then` arm.
   - TypeScript reaches them through two branches' `else` edges, whose `then` arms have `ARM_STATUS: always-exits`.
   - The test must show the two effective conditions are the same predicate after the projection's existing normalisation. Equality of raw step facts is not expected, because the shapes differ by design.
3. **The language rule is applied per side, and the two sides are expected to differ:**
   - Python's settlement exists on every successful continuation.
   - TypeScript's is qualified by `thenable(w)`.

   This is a correct difference, not a disagreement, and the test must assert it rather than flatten it.

## Rulings requested on this draft

1. Event rules A.2 to A.5, including `settle` as the awaited operand's event, the per-language existence table, and the removal of `call.fulfil`.
2. The evidence contract B.1 and `AWAIT_TARGET` B.2 as a P1 graph-contract addition.
3. `ARM_STATUS` with three positive values, the completeness checks, the implicit end exit, and the reordered class rules (C).
4. Normalised event-graph validation and the refusal list (D).
5. The changed and added expected answers, K4a, K5, K6d, K6d-i, K6e, K7, K9b, K11, and K13 to K16-py, and the narrowed X2 (E and F).
