# R-1B1, draft 2: changed sections and the complete expected-answer table

Michael Van Geertruy, with Claude. INTERNAL. Drafted 2026-11-02 in answer to Michael's review of draft 1. **Not frozen. No implementation.**

Draft 1 (`docs/r1b1-design-draft.md`, sha256 `0d74706a...`) stays in the repository unedited. Two errors in it are recorded in the experiment log rather than corrected in place: the K4 prediction, and the overlap between Together and Exclusive. Sections 0, 1, and 6 of draft 1 carry over unchanged. Everything below replaces the matching section of draft 1.

## 2.1 Occurrence identity (changes only)

Added to draft 1's section 2.1:

- **Ownership and identity are separate facts.** `CONTAINS_STEP` from an executable to a step records ownership. The step's concept id is its identity. Neither stands in for the other.
- **Every step records its kind as a fact.** `CONTAINS_STEP` carries a required attribute `stepKind`, one of `call`, `await`, `branch`, `exit`, `opaque`, `write`, or `emit`. Every validation rule in section 3.3 reads this attribute.
- **Positions never reach the checker as evidence.** The structural position (`body/3/then/1`) stays in evidence and attributes for auditing. The checker reads only relations and the `stepKind` attribute. Two steps whose positions suggest an order, but which no order fact connects, are reported as unordered. A test pins this (control K12).
- **Fresh identities on every ingestion are accepted for this increment**, as for every concept in the store today.
- **The limits stay visible.** Sufficiency reporting names, per executable, the calls nested in other calls' arguments and the opaque constructs whose inside is not ordered. They are reported as limits, never as fixed pairs.

## 2.2 Pair classes (replaces draft 1's section 2.2)

### The facts classification may read

| Fact | Written by | What it proves |
|---|---|---|
| `IN_ARM` (step to its immediately enclosing branch step, `arm: then or else`) | P2 | Arm membership. The enclosing set of a step is its `IN_ARM` chain followed upward. |
| `ARM_TERMINATES` (branch step to literal `{arm}`) | P2, new | That arm always leaves the function: every path through it ends at an exit step. Ingestion writes it only where the IR's existing `alwaysExits()` holds: a block whose last statement is `return` or `throw`, or a branch both of whose arms always exit. No other evidence produces it. |
| Program-order and completion facts | R-1B2 (hand-written in the experiment) | Which step can follow which, and through which arm. |

**`IN_ARM` alone does not prove termination,** which is why `ARM_TERMINATES` is a separate fact under P2. Without it, a pair involving an exiting arm stays Unknown.

### Disjoint classes, applied in this order; the first rule that holds decides

Notation: `arms(x)` is the set of `(branch, arm)` pairs enclosing step `x`.

1. **Exclusive by arms.** Some branch B has `(B, p)` in `arms(x)` and `(B, q)` in `arms(y)` with `p ≠ q`. *Needs P2.*
2. **Exclusive by termination.** Some branch B has `ARM_TERMINATES(B, p)`. One step lies inside arm p. The other lies outside arm p and is reachable from B only through an order fact out of B's other arm, never through arm p. *Needs P2 and order facts, so it is available from R-1B2 onward, and in the experiment.*
3. **Unknown, termination unresolved.** Neither rule 1 nor rule 2 holds, and some terminating arm contains one step but not the other. *Before order facts exist this is where K6d lands, because rule 2 cannot yet be checked.*
4. **Together (structurally compatible).** `arms(x) ⊆ arms(y)` or `arms(y) ⊆ arms(x)`.
5. **Unknown.** Everything else, chiefly steps under independent branches.

**Together is structural compatibility within the represented control model, nothing more.** It means the represented control structure contains a path through both steps. It does not claim both execute in any run: a condition may never hold, a call may throw, and anything inside an opaque construct is not modelled.

**Unknown is never resolved by comparing predicate text.** That holds whether the texts match (K6b) or look contradictory (K6c).

**The order of the rules removes draft 1's overlap.** K6d is decided by rule 2 when order facts exist, and by rule 3 when they do not. It never reaches rule 4.

## 2.3 Events and the derivation contract (replaces draft 1's section 2.3)

### Events

| Step kind | Events | Meaning |
|---|---|---|
| `call` | `invoke`, `return` | Control enters the callee; the call expression yields its value normally. |
| `call` | `fulfil` | The value the call returned settles **successfully**. It exists only if that value is awaitable and fulfils, and the store records it only as the source of a completion fact. |
| `await` | `suspend`, `resume` | The operand has been evaluated and the continuation suspends; then it resumes because the awaited value fulfilled. |
| `await` | `operand-fulfil` | The awaited value fulfils. When the operand is a call step in the same executable, this is that call's `fulfil`. Otherwise (`await ready`) it is an anonymous event whose producer the store cannot identify. |
| `branch` | `decide` | The predicate is evaluated and one arm is taken. |
| `exit` | `exit` | `return` or `throw` leaves the function. |
| `opaque`, `write`, `emit` | `start`, `end` | The construct as one unit. Its inside is not represented. |

**`return` and `fulfil` are different events.** A call's `return` hands back its value. `fulfil` is that value's later successful settlement. Program order uses `return`; only completion facts use `fulfil`.

### Internal rules (typed, per step kind, conditional on success)

| Rule | Ordering | Holds only if |
|---|---|---|
| R-CALL | `invoke` < `return` | the call returns normally |
| R-FULFIL | `return` < `fulfil` | the returned value is awaitable and fulfils |
| R-AWAIT | `suspend` < `operand-fulfil` < `resume` | the awaited value fulfils (successful continuation) |
| R-UNIT | `start` < `end` | the construct completes normally |

**Rejection and throws produce no ordering.** If an awaited value rejects, `resume` never happens: control raises at the await point, and that is R-1C. Every derived fact therefore means "on a successful run of every step in the chain".

### Program and completion facts as event edges

**Program order, X to Y** (with arm a when X is a branch) connects `end(X)` to `start(Y)`:

- `end(call)` is `return`, `end(await)` is `resume`, `end(branch, a)` is `decide` restricted to arm a, and `end(opaque, write, emit)` is `end`.
- `start(call)` is `invoke`, `start(await)` is `suspend`, `start(branch)` is `decide`, `start(exit)` is `exit`, and `start(opaque, write, emit)` is `start`.
- No program-order fact leaves an exit step.

**Completion, W awaits C** connects `C.fulfil` to `W.resume`, and identifies `W.operand-fulfil` with `C.fulfil`.

**Composition.** Event precedence is the transitive closure over internal rules, program edges, and completion edges, with conditions carried as in section 2.4. One step's `fulfil` precedes another step's start only through a chain containing a completion edge. An unawaited call's `fulfil` is therefore unordered against everything after it, which is correct, and it is not counted as a gap because `fulfil` is not an effect.

### `await ready`, corrected

The await step keeps its full successful-await meaning: `suspend` < `operand-fulfil` < `resume` < the next step's start. The store cannot say which producer fulfilled the operand. `ready` is a module-level name, and value tracking does not follow module-level names. So **no fact links `Parser.init`'s fulfilment to this await. That is a limit of this representation's value tracking**, not a statement about the source, which does assign `Parser.init()` to `ready` on one path.

## 2.4 Continuation and condition-preserving derivation (replaces draft 1's section 2.4)

**What is written:** only the frontier. Program-order facts go between immediate successors. A completion fact is written where the operand is a call step in the same executable. Nothing else.

**What a derived fact carries:** a condition set C, the conjunction of:

- `arms(x)` and `arms(y)` for the endpoints,
- `arms(z)` for every intermediate step z,
- the arm label of every program edge leaving a branch.

**Validity:** a chain is invalid, and contributes nothing, if C contains `(B, then)` and `(B, else)` for any branch B. Two derived facts are composed only if the union of their condition sets is valid. **Incompatible paths are never stitched together**, including by composing two facts that share an endpoint (control K9).

**`loadLanguage`, corrected.** `Parser.init` (c1) before `Language.load` (c3) is derived along `b1 then` to c1, c1 to w1, w1 to c2, c2 to b2, `b2 then` to c3. It carries `{(b1, then), (b2, then)}`, not only the deeper step's condition. Draft 1's "keep the condition of the deeper step" would have dropped `(b1, then)`. Control K10 exists to catch exactly that.

## 3. The relation experiment (replaces draft 1's section 3)

### 3.1 Boundary

The facts are written by hand from this document. The experiment therefore tests **representation and inference only**:

- whether each candidate can hold the facts,
- whether the schema and validator refuse what they should,
- whether the checker derives the expected answers.

**It does not test encoder agreement between TypeScript and Python.** That needs P1 and R-1B2. The paired fixtures in section 3.5 are written now so those later steps have them ready.

### 3.2 Candidates, fully specified

| | Candidate A: `FOLLOWS` widened | Candidate B: new relations |
|---|---|---|
| Program order | `Y FOLLOWS X`, `control: "program"`, `within: <executable>`, plus `arm` when X is a branch | `X NEXT_STEP Y`, plus `arm` when X is a branch |
| Completion | `W FOLLOWS C`, `control: "completion"`, `within: <executable>` | `W AWAITS C` |
| Direction | Subject is the later step | Program: subject is the earlier step. Completion: subject is the await. |
| Schema change | `FOLLOWS` subject and object gain `step` | Two new relations, `step` to `step`; `FOLLOWS` untouched |

Both candidates are judged by the **same semantic validator** (3.3). A direction difference between them is a notation difference, not a semantic one.

### 3.3 Validation, identical for both candidates

A fact is refused if any of these holds:

1. Either endpoint is not a `step`.
2. The two endpoints are not owned (`CONTAINS_STEP`) by the same executable. For Candidate A, `within` must name that executable.
3. Self-loop: both endpoints are the same step.
4. **Program order:**
   - the earlier step is an `exit`;
   - the earlier step is a `branch` and no `arm` is given;
   - an `arm` is given and the earlier step is not a `branch`;
   - a second program fact leaves the same step on the same arm.
5. **Completion:**
   - the endpoints are not exactly one `await` step and one `call` step;
   - the call step is not the await's R-1A dependency target;
   - a second completion fact names the same await step.
6. Any fact whose addition creates a cycle among program and completion facts.

Each rule has a refusal control in the run: one deliberately wrong fact per rule, per candidate.

### 3.4 The `HAS_PREDICATE` dimension, fully specified

| | H1 | H2 |
|---|---|---|
| Executable-level `HAS_PREDICATE` | Unchanged | Unchanged |
| The branch's own predicate fact | New relation `TESTS_PREDICATE`: subject a `branch` step, object a `predicate` literal holding the branch's normalised IR `Predicate`, the same payload form as today's `HAS_PREDICATE` literal | `HAS_PREDICATE` subject widened to `executable` or `step`: subject a `branch` step, the same literal |
| Validation | Subject `stepKind` is `branch`; exactly one per branch step; payload equals the branch's own predicate, never the path conjunction | Same three rules |

**Reported counts, kept separate in both:**

- **Executable-level `HAS_PREDICATE`:** stays 96 for `ir0-typescript`, as ruled, in both H1 and H2.
- **Branch-level predicate facts:** one per branch step. `ir0-typescript` has 52 branches, so 52 `TESTS_PREDICATE` facts under H1, or 52 more `HAS_PREDICATE` facts under H2.
- **Under H2 the total reads 148.** Every report prints the 96 executable-level assertions on their own line, so the ruled baseline is never hidden inside a total.

### 3.5 Paired fixtures for later encoder agreement (not tested here)

- **K1 to K11:** each is written in TypeScript and Python in the run directory, so P1 and R-1B2 can check the encoders produce the hand-written facts.
- **The section-16 pair** is the X2 fixture in `test/ir/r1a-await.test.ts`:
  - Python: `async def f(amount, status):` with body `if amount > Decimal("25000.00") and status == "APPROVED":` then `await publish(amount)`.
  - TypeScript: `async function f(amount, status) { if (amount <= 25_000) return; if (status !== "APPROVED") return; await publish(amount); }`.
- **The pair's step graphs differ by design,** and agreement is checked on derived effect order and condition semantics, not on raw facts:
  - Python has one branch with a compound predicate.
  - TypeScript has two branches whose then-arms terminate.
  - Both must yield one `call` step, one `await` step, and one completion fact.
  - Condition equivalence between the two shapes is the existing projection's job, which already passes X2. R-1B adds nothing that could disagree, because each side has a single effect and therefore no pairs.

### 3.6 Scoring order

1. Every answer in section 4 is derived from facts alone, with no position read.
2. Every refusal control in 3.3 is refused, for both candidates.
3. `return` and `fulfil` stay distinguishable in K3, K4, and K7.
4. No collision with thread-level `FOLLOWS` (A only), and the effect on `test/ir/ingest.test.ts` line 64.
5. The assertion count for the same answers.
6. Derivation cost.

H1 against H2 is scored on the same order, plus the separate-count requirement in 3.4.

## 4. Complete expected-answer table (replaces draft 1's section 4)

### 4.1 Notation

- `P(x→y)` is a program-order fact; `P(b→y | then)` leaves branch b through its then-arm.
- `C(w⇐c)` is a completion fact: await w awaits call c.
- `{…}` is a derived fact's condition set.
- `<` is event precedence on a successful run.
- Classes follow section 2.2: T for Together, X for Exclusive, U for Unknown.

Pairs are counted over observable effects only (call, write, and emit steps), as R-1B0 counts them.

### 4.2 The controls

| # | Source | Steps | Written facts | `IN_ARM` / `ARM_TERMINATES` | Pairs: class, order, condition | Other required answers |
|---|---|---|---|---|---|---|
| K1 | `a.x(); a.x();` | s1 call, s2 call | `P(s1→s2)` | none | (s1,s2): T; s1.return < s2.invoke; {} | s1 and s2 are distinct ids with identical literals |
| K2 | `f(); g();` | f call, g call | `P(f→g)` | none | (f,g): T; f.return < g.invoke; {} | none |
| K3 | `const p = load(); use(p);` | load call, use call | `P(load→use)` | none | (load,use): T; load.return < use.invoke; {} | load.fulfil vs use.invoke: **no order**, not counted as a gap |
| K4a | `await load(); use();` | load call, w await, use call | `P(load→w)`, `P(w→use)`, `C(w⇐load)` | none | (load,use): T; load.return < use.invoke and load.fulfil < use.invoke; {} | on rejection: no fact past w.suspend |
| K4b | `load(); use();` | load call, use call | `P(load→use)` | none | (load,use): T; load.return < use.invoke; {} | load.fulfil vs use.invoke: no order |
| K4 delta | K4a to K4b | −1 step (w) | −2 program facts, +1 program fact, −1 completion fact | none | **Semantic delta:** load.return < use.invoke is kept; **load.fulfil < use.invoke is lost** | nothing else changes |
| K5 | `if (c) { await load(); } use();` | b branch, load call, w await, use call | `P(b→load \| then)`, `P(load→w)`, `P(w→use)`, `P(b→use \| else)`, `C(w⇐load)` | load, w in (b,then) | (load,use): T; load.fulfil < use.invoke; {(b,then)} | on the else path, no fact relates load and use (load is absent) |
| K6a | `if (c) a(); else b();` | B branch, a call, b call | `P(B→a \| then)`, `P(B→b \| else)` | a in (B,then); b in (B,else) | (a,b): **X** by rule 1; no order needed | none |
| K6b | `if (c) a(); if (c) b();` | B1, a, B2, b | `P(B1→a \| then)`, `P(a→B2)`, `P(B1→B2 \| else)`, `P(B2→b \| then)` | a in (B1,then); b in (B2,then) | (a,b): **U** (never T from matching text); a.return < b.invoke; {(B1,then),(B2,then)} | none |
| K6c | `if (x > 0) a(); if (x < 0) b();` | as K6b | as K6b | as K6b | (a,b): **U** (never X from differing text); a.return < b.invoke; {(B1,then),(B2,then)} | none |
| K6d | `if (c) { a(); return; } b();` | B branch, a call, r exit, b call | `P(B→a \| then)`, `P(a→r)`, `P(B→b \| else)` | a, r in (B,then); `ARM_TERMINATES(B, then)` | (a,b): **X** by rule 2 with order facts; **U** by rule 3 if order facts are withheld; never T | no fact leaves r |
| K7 | `loadLanguage` (treeSitter.ts lines 9 to 19) | b1, c1 Parser.init, w1 await ready, c2 languages.get, b2, c3 Language.load, w2 await, c4 languages.set, x1 return | `P(b1→c1 \| then)`, `P(c1→w1)`, `P(b1→w1 \| else)`, `P(w1→c2)`, `P(c2→b2)`, `P(b2→c3 \| then)`, `P(c3→w2)`, `P(w2→c4)`, `P(c4→x1)`, `P(b2→x1 \| else)`, `C(w2⇐c3)`: 10 program facts, 1 completion fact | c1 in (b1,then); c3, w2, c4 in (b2,then); no `ARM_TERMINATES` | 4 calls, 6 pairs, listed below the table | w1: anonymous operand-fulfil < w1.resume < c2.invoke; {}. No fact links c1.fulfil to w1 (value-tracking limit). |
| K8 | `if (c) { if (d) a(); b(); } e();` | B1, B2, a, b, e | `P(B1→B2 \| then)`, `P(B2→a \| then)`, `P(a→b)`, `P(B2→b \| else)`, `P(b→e)`, `P(B1→e \| else)` | B2, b in (B1,then); a in (B2,then) | (a,b): T; a < b; {(B1,then),(B2,then)}. (a,e): T; a < e; {(B1,then),(B2,then)}. (b,e): T; b < e; {(B1,then)} | a's enclosing set is derived through B2's `IN_ARM` chain |
| K9 | `if (c) a(); else b(); d();` | B, a, b, d | `P(B→a \| then)`, `P(B→b \| else)`, `P(a→d)`, `P(b→d)` | a in (B,then); b in (B,else) | (a,b): X; **no order fact in either direction, derived or composed through d**. (a,d): T; a < d; {(B,then)}. (b,d): T; b < d; {(B,else)} | composing a < d with any fact through b is refused as an invalid condition set |
| K10 | `if (p) a(); if (q) b();` | B1, a, B2, b | as K6b | as K6b | (a,b): U; a < b; **{(B1,then),(B2,then)} exactly** | **Negative control.** An implementation that keeps only the deeper step's condition yields {(B2,then)}; one that discards conditions yields {}. Both must fail this control. |
| K11 | `await ready; use();` | w await, use call | `P(w→use)`; **no completion fact** | none | one effect, no pairs | anonymous operand-fulfil < w.resume < use.invoke; {}. Reported as "producer unidentified", **not** as an ordering gap. |
| K12 | K2 with the program fact withheld | f call, g call | none | none | (f,g): T; **unordered**, although f's position precedes g's | proves positions supply no ordering evidence |

### 4.3 K7 pairs in full

| Pair | Class | Order | Condition |
|---|---|---|---|
| c1, c2 | T | c1.return < c2.invoke | {(b1,then)} |
| c1, c3 | U | c1.return < c3.invoke | {(b1,then),(b2,then)} |
| c1, c4 | U | c1.return < c4.invoke | {(b1,then),(b2,then)} |
| c2, c3 | T | c2.return < c3.invoke | {(b2,then)} |
| c2, c4 | T | c2.return < c4.invoke | {(b2,then)} |
| c3, c4 | T | c3.return < c4.invoke and c3.fulfil < c4.invoke | {(b2,then)} |

Totals: 6 pairs, 6 fixed, 0 exclusive, 0 unfixed; 4 Together, 2 Unknown.

### 4.4 Refusal controls (section 3.3), run once per candidate

One deliberately invalid fact for each rule:

- an endpoint that is an executable;
- endpoints owned by different executables;
- a self-loop;
- a program fact leaving an exit;
- a branch fact without an arm;
- an arm on a non-branch;
- a second program fact on the same arm;
- a completion fact between two calls;
- a completion fact whose call is not the dependency target;
- a second completion fact for one await;
- a cycle;
- under H1 or H2, a predicate fact on a non-branch step, a second one on the same branch, and one carrying the path conjunction instead of the branch's own predicate.

Every one must be refused by name.

## 5. Prerequisites (changes only)

- **P0.** Unchanged in scope. It must explain radon's 120 against 121 before P1 is frozen. The original observation in draft 1's section 1 is preserved as recorded. If P0 shows the probe was wrong rather than the store, that is logged as a miss of the probe, not quietly corrected.
- **P1.**
  - `CONTAINS_STEP` carries the required `stepKind`.
  - Its "nothing existing moves" predictions are **provisional** until P0 is explained and the invocation-mapping decision (rebuild from the projection, or mint from the walk) is ruled.
  - **Graph-contract changes are recorded separately from the IR schema version.** A new concept kind, `CONTAINS_STEP`, and `STEP_INVOKES` change the graph contract, not the IR, so `ir_schema` stays 6. P1's protocol must name how a graph-contract revision is identified, because the log has no identifier for one today.
- **P2.**
  - Adds `ARM_TERMINATES` beside `IN_ARM`, both written from IR facts (`alwaysExits()`), as a second graph-contract change.
  - Before order facts exist, P2's classification uses rules 1, 3, 4, and 5 only. K6d-shaped pairs report Unknown until R-1B2, and P2's predictions must say so.
- **Sufficiency reporting** (from P1 onward) names nested-call and opaque limits per executable, as section 2.1 requires.

## 7. Rulings requested (replaces draft 1's section 7)

Draft 1's seven rulings stand as given. This draft asks only whether the corrections answer them:

1. The disjoint class rules, their order, and `ARM_TERMINATES` as the termination fact under P2 (section 2.2).
2. The event table with `fulfil` and `operand-fulfil`, the four internal rules, and the edge endpoints (section 2.3).
3. The condition set, validity, and no-stitching rule (section 2.4).
4. Both candidates and both H options as specified, with the shared validator and the separate predicate counts (sections 3.2 to 3.4).
5. The complete expected-answer table, including the K4 delta and controls K8 to K12 (section 4).
6. The experiment boundary and the section-16 pair as identified (sections 3.1 and 3.5).
7. The P1 and P2 changes, including the separate graph-contract record (section 5).
