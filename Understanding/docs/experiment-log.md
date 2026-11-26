# Understanding: experiment log

Michael Van Geertruy, with Claude. Project Revive Solutions, LLC.

The founding design (draft 4, frozen) states the hypotheses. This log is the evidence. One entry per measured run, on the same corpus, so the numbers are comparable. No entry is edited after it is written; a correction is a new entry saying what the old one got wrong.

The corpus for every IR entry: this repository's own `src/**/*.ts`, encoded by `typescript-adapter` through the ordinary path, with no privileged treatment.

## IR-0, 2026-09-13

Baseline, before local bindings and assignments are represented.

```
opaque            79 / 230 statements = 34.3%
collision groups  6
useful candidates 2    (block in both adapters; effectOf in both adapters)
opacity-induced   4
```

Opaque by reason, worst first: `lexical_declaration` 52, `assignment_expression` 12, `for_in_statement` 6, `switch_statement` 6, `identifier` 1, `for_statement` 1, `while_statement` 1.

Prediction for IR-1, recorded before the work: opaque falls to roughly 11 percent, the four opacity-induced collision groups disappear, and the two useful candidates survive unchanged. If the useful candidates break, the change damaged resolution rather than improving it.

## E4-mini, 2026-09-13

One function (`approve`, the pair-1 shape), three versions.

```
reformatted (17 lines differ, braces, comment, split parameters, 25000.00, spacing)   no semantic change, same fingerprint
threshold 25_000 -> 50_000 (one token)                                                implementation change, both fingerprints named
threshold restored                                                                    no change against the original
```

Method note: the first run compared the reformat against the threshold version, so what it reported was the threshold reverting. Re-run with formatting as the only difference before the result above was recorded.

## Crash hardening, 2026-09-13

Found by review of the code rather than by a test: `appendFileSync` is one call and not an atomic durable append across a process, OS, or power failure, so a torn final line is a state the journal format must expect. Replay now treats an unparseable last line as the crash it is and discards it with its whole transaction; an unparseable line anywhere else is refused as corruption rather than silently dropped.

A real bug surfaced while testing that: after recovering from a torn tail, appending the next transaction left the incomplete bytes in the middle of the file, and every later load then read them as corruption. Fixed by truncating the incomplete trailing bytes on the load that finds them, which removes no history because they were never inside a committed transaction. Four tests: the torn tail, corruption mid-file, a clean but uncommitted transaction, and write-again-after-crash with every line asserted parseable afterwards. 20 tests passing.

## Artifact discrepancy, 2026-09-13

Recorded rather than smoothed over, per this log's rule.

Review reported that the archive it inspected held 16 tests, a plain `JSON.parse` over every line, and no torn-tail logic, while this log said 20. Checked from my side: the archive I had presented at that point contained 20 `test()` cases, four occurrences of `tornTail` in `src/journal/index.ts`, and `test/journal/torn.test.ts` with the four crash cases. Two archives existed under the same name, 43,052 bytes (pre-hardening, 16 tests) and 57,125 bytes (hardened, 20 tests), and the review had the first.

So the discrepancy was a stale download, not a stale build, and neither document was wrong about its own subject. The lesson is about handover, not about the code: an archive is identified from now on by its SHA256 and its byte size, printed beside it, and a verification run states the checksum it ran against.

## Path canonicalisation, 2026-09-13

Found by asking what my harness (Ubuntu 24.04.4, kernel 6.18.44, x86_64, Node 22.22.2, ext4) does that another machine would not. The encoder stored relative paths as literals as the platform gave them, so a Windows run would have seeded `src\journal\index.ts` where a Linux run seeded `src/journal/index.ts`: two literals for one file, in a store whose whole point is that names do not decide identity. `canonPath` now stores forward slashes, strips a leading `./`, and upper-cases a drive letter. Three tests. 23 passing.

This was a defect in the encoder, not a platform quirk, and it would have made two machines seed two different graphs from the same repository.

## The instrument becomes part of the repository, 2026-09-13

`npm run dogfood` replaces the script that lived in `/tmp`, so a log entry can be reproduced on another machine. It prints the environment, the corpus counts, the opaque rate, the collision groups in full, the opaque reasons, and the per-file table. It does not classify a collision as useful or opacity-induced: that is a human's judgement and encoding the expected answer into the measuring instrument would make the next entry worthless. No file under `src/` changed.

Two defects in the instrument, found by running it:

1. It resolved the corpus by counting `..` from the compiled script, so it measured `dist/src/*.d.ts`, found no functions, and reported **0 of 0 statements = 0.0%** with complete confidence. It now finds the repository root by walking up to the `package.json`, skips `.d.ts`, and refuses a corpus of zero with an error that says a zero corpus is a broken measurement and not a result. This is the same failure as counting `.test()` and calling it a test: a deterministic count of the wrong thing.
2. Excluding declaration files changed the corpus, which changed the baseline.

## IR-0, restated 2026-09-13 (supersedes the IR-0 entry above)

The first IR-0 entry was measured by the `/tmp` script on a corpus of 10 files; the reproducible instrument, on the same 10 files, counts two more functions and ten more statements, because the earlier script's walker missed nested function declarations that the repository-root version finds. The numbers below are the baseline IR-1 will be compared against, and they are the ones `npm run dogfood` prints.

```
node       v22.22.2
platform   linux x64
encoder    typescript-adapter/0.1   ir_schema 1
files      10
functions  58
statements 240

opaque            85 / 240 statements = 35.4%
collision groups  6
```

Opaque by reason: `lexical_declaration` 56, `assignment_expression` 13, `for_in_statement` 6, `switch_statement` 6, `for_statement` 2, `identifier` 1, `while_statement` 1.

Collision groups, with my classification stated separately from the instrument's output:

| group | members | my reading |
|---|---|---|
| 1f8b1a23 | `block` in both adapters | useful: the same shape in two places |
| 60d4f274 | `effectOf` in both adapters | useful: the same shape in two places |
| 08fb50f3 | `operand`, `predicate`, `stmt` (Python), `stmt` (TypeScript), `normalise` | opacity-induced: switch-heavy bodies |
| c1071283 | `isConceptKind`, `canonPath`, `effectProjection`, `fingerprint`, `key`, `about`, `getConcept` | opacity-induced: one-expression bodies whose expression is opaque |
| 2d815c41 | `hadTornTail`, `history`, `sequence` | opacity-induced: bare getters |
| 6f7cee2a | `unparen`, `cond` | opacity-induced: a ternary over an opaque expression |

```
IR-0   opaque 85/240 = 35.4%   groups 6   useful 2   opacity-induced 4
```

Prediction for IR-1, recorded before the work: opaque falls below 15 percent; the four opacity-induced groups disappear; `block` and `effectOf` still match across the two adapters. If the last clause fails, the change cost resolution rather than gaining it, whatever the opaque rate does.

## Gates before IR-1

1. `npm run dogfood` in the repository. Done.
2. Windows, against the named checksum: `npm install`, `npm test`, 23 passing, and in particular the recover-torn-tail, append, reopen case on NTFS.
3. `npm run dogfood` on Windows, and its output compared line for line with the IR-0 block above. The corpus counts and the opaque numbers must be identical; the environment lines will differ.
4. Only if 2 and 3 agree does IR-1 begin.

Review's execution environment is Linux, so the NTFS result has to come from Michael's machine; it cannot be returned from a Linux container honestly.

## Two rules recorded before IR-1, 2026-09-13

Neither changes code today; both change how the next change is judged.

**Plumbing takes the settled answer; evidence takes the design.** Sorting directory entries so a traversal repeats is plumbing, and it gets the language's own sort. Sorting predicate operands, ordering the effect projection, building a fingerprint, normalising the IR, canonicalising a path, and recovering a torn journal all decide what this store will later claim is true, and each was argued and tested. The requirement is never novelty; the requirement is knowing why a choice preserves the meaning intended.

**Determinism is not validity.** Four measurements today were exact, repeatable, and wrong: a `grep` that counted JavaScript's own `.test()`; an archive that hashed perfectly and was the stale build; a dogfood run that reported 0 of 0 at 0.0 percent because it was pointed at compiled declaration files; and the original IR-0 counts, taken by a walker that missed nested functions. So an instrument must be able to report that it failed to measure, and a number is not trusted until something independent agrees with it. Gate 3, the Windows dogfood matching the Linux one, exists for that reason and for no other.

**Deferred deliberately.** The collision-group representative currently depends on insertion order, which is traversal order, which is a result depending on plumbing. That is wrong and the fix is boring: sort groups by fingerprint. It is NOT being changed before the Windows run, because changing the instrument now would produce a fourth artifact and muddy the cross-platform baseline the run exists to establish. If the totals agree on Windows and only the group ordering differs, that is recorded as exactly that, and the presentation is made deterministic before IR-1.

**Hypothesis order if gate 3 fails.** First suspect: adapter logic that depends on source spans, text slicing, or offset-sensitive reconstruction, since CRLF changes byte offsets. Not tree-sitter parsing Windows source differently, which it should not. Second: a file in `src/` that parses differently under the Windows checkout. Either is a measurement defect and stops the work; neither is platform noise.

## Gate 2 and part of gate 3, on Linux, 2026-09-13

Windows is not available until Thursday, so the gates were run as far as Linux can honestly take them. What is confirmed, and what is still owed, is stated separately below.

Artifact: `understanding-2026-09-13-ir0-b1a13fc5.zip`, sha256 `b1a13fc516899b1c7a287f8ae42e2d49b765762e506a31c10c425579617af183`, 62,275 bytes, unpacked into an empty directory with no `node_modules` and no `dist`.

**Clean-checkout suite.** `npm install` from the committed lockfile (10 packages, no vulnerabilities reported), then `npm test`: **23 of 23 passing**, including all four crash cases (torn final line; corruption mid-journal; clean but uncommitted transaction; recover torn tail, append, reopen with every line asserted parseable). So the archive builds and passes from nothing, which is more than the working tree proved: it rules out a packaging omission, a missing file, and a dependency that only resolved because my tree was warm.

**Clean-checkout instrument.** `npm run dogfood` in the clean checkout is byte-identical to the same command in my working tree, environment lines included, so the artifact and the tree measure the same thing. The IR-0 block stands unchanged: files 10, functions 58, statements 240, opaque 85 of 240 = 35.4 percent, 6 collision groups.

**The CRLF hypothesis, tested here rather than assumed.** The named suspect for a cross-platform disagreement was source spans and offsets under CRLF. That does not need Windows to test: the corpus was copied, every `.ts` file converted to CRLF (`file` confirms "CRLF line terminators" on the converted files before the run), and the instrument re-run. The output is byte-identical to the LF run: same 240 statements, same 85 opaque, same 6 groups, same per-file table. So CRLF alone changes no measured number, and if Thursday's run disagrees the cause is elsewhere.

**Still owed, and not claimable from here.** The NTFS behaviour of the load that writes: recovering a torn tail truncates the journal during construction, and Windows file locking and antivirus interception sit in that path. Test 18 passes on ext4 and says nothing about NTFS. The full gate-3 comparison also remains owed, because "another platform agrees" is the point of it and a second Linux run is not another platform; what the clean checkout and the CRLF run give is a weaker independent agreement, and they are recorded as that.

```
gate 1  instrument in the repository                     PASSED
gate 2  suite from a clean checkout of the named artifact PASSED on Linux, 23 of 23
gate 3  instrument agrees across platforms               PARTIAL: clean checkout and CRLF corpus agree on Linux; Windows owed Thursday
gate 4  IR-1 begins                                      open
```

## IR-0 pinned, 2026-09-13

IR-0 is frozen as the artifact `understanding-2026-09-13-ir0-b1a13fc5.zip`, sha256 `b1a13fc516899b1c7a287f8ae42e2d49b765762e506a31c10c425579617af183`, 62,275 bytes. It is not modified again for any reason. Thursday's Windows run is diagnosed against it, not against whatever the tree looks like by then. IR-1 proceeds in the working tree from here; the checksum in the filename is what distinguishes the two states, since this tree is not yet a git repository and the tag is owed to Michael when it is.

## IR-1, 2026-09-13

Change: local bindings and assignments become named values in the data flow. A local's name lives in the adapter only and never reaches the IR; a value is identified by its position in the function, so renaming a local changes nothing and reordering bindings does. `Expr` covers call, member, index, arithmetic, a condition used as a value, a ternary choice, and an operand, kept complete enough that an emitter could later render it, per the instruction not to discard information we know we will need. Destructuring binds the whole value and then one member or index read per element. An assignment to a local rebinds it; an assignment to anything else is a WRITE effect. `ir_schema` is 2. Loops and switch were deliberately untouched. 23 tests still passing.

**A confound found before reporting, and corrected.** The first IR-1 run over `src/**/*.ts` reported 64 functions and 275 statements against IR-0's 58 and 240, because implementing IR-1 added functions to the repository being measured. The corpus had changed, so the comparison was not controlled. `npm run dogfood <path>` now takes a corpus, and the number below is the IR-1 encoder over the **frozen IR-0 corpus**, which is the controlled measurement. (For the record, the uncontrolled run on the current tree: 20 of 275 = 7.3 percent, 6 groups.)

```
IR-1 (encoder ir_schema 2, corpus = frozen IR-0 src)
files      10        (IR-0: 10)
functions  58        (IR-0: 58)
statements 240       (IR-0: 240)
opaque     16 / 240 = 6.7%   (IR-0: 85 / 240 = 35.4%)
groups     5                 (IR-0: 6)
```

Opaque by reason: `for_in_statement` 6, `switch_statement` 6, `for_statement` 2, `identifier` 1, `while_statement` 1. Every `lexical_declaration` (56) and `assignment_expression` (13) is gone, which is all 69 of them and exactly the predicted target.

**The prediction, scored honestly. Two clauses passed, one failed.**

- Opaque below 15 percent: **passed**, 6.7 percent.
- The four opacity-induced groups disappear: **failed**. All four persist. Diagnosis below.
- `block` and `effectOf` survive unchanged: **failed for `effectOf`**, passed for `block`.

**Why `effectOf` stopped matching, and why that is the right answer.** The two `effectOf` functions differ at one operand: the Python adapter tests `fnNode.type === "attribute"` and reads `.attribute`; the TypeScript adapter tests `=== "member_expression"` and reads `.property`. Under IR-0 both bodies were opaque, so they collided; IR-1 can see the comparison and the difference is real. They are not the same computation, they are the same shape over different protocol strings, and the strings are exactly the kind the frozen design says must enter the IR. So my classification of the groups was wrong: `effectOf` was never a useful match, it was opacity-induced with a plausible name, and `block` was the only genuine one. **useful 2 was useful 1.** That is a correction to my judgement, not to the instrument, and it is the reason the instrument does not classify.

**Why the four groups persist.** Not because bindings failed; because of gaps IR-1 did not touch:

- `hadTornTail`, `history`, `sequence` all project to `return unknown(member)`: a read through `this` is not modelled, so three different field reads are one unknown. Modelling the receiver is the fix, and it is a resolution gap, not opacity.
- `operand`, `predicate`, `stmt`, `normalise` are switch-heavy, and `switch_statement` is still opaque by design this round.
- `isConceptKind`, `canonPath`, `effectProjection`, `fingerprint`, `key`, `about`, `getConcept` are one-expression bodies whose expression is a chained call or member read on a free name, which lands as unknown for the same reason as the getters.
- `unparen` and `cond` are ternaries over an opaque test.

So the honest summary: **information loss fell by four fifths and resolution improved where the loss was removed, and every surviving collision is now attributable to a specific, named gap rather than to bulk opacity.** That is a better result than the groups vanishing would have been, because each remaining group now names its own cause.

```
IR-1   opaque 16/240 = 6.7%   groups 5   genuinely useful 1 (block)   attributable to a named gap 4
```

Next, in the order the evidence gives: the receiver (`this` and free-name member reads), then `switch_statement`, then the loops. Prediction for IR-2, recorded now: modelling the receiver alone dissolves the getter group and the seven-member group, and leaves the switch group and the ternary group standing; `block` still matches.

## E1-cross, 2026-09-13: is this language-independent, or normalised syntax?

The question was put directly: does the IR represent meaning, or a tidied-up syntax tree? Four pairs, each the same behaviour, written independently in Python and TypeScript, each pair harder than the last. Measured rather than argued.

| pair | what differs | IR-1 result | after the fixes below |
|---|---|---|---|
| A | local names only (`balance`/`funds`, `acct`/`account`, `amount`/`sum`) | DIFFER | **MATCH** |
| B | a property name too (`.balance` against `.available`) | DIFFER | DIFFER |
| C | idiom and structure (guard-and-body against early return; bound value against inline read) | DIFFER | DIFFER |
| D | the effect's operation name (`post` against `postEntry`) | DIFFER | DIFFER |

**Two defects found, both real, both of the kind this question was asking about.**

1. **A grammar's own vocabulary was reaching the IR.** Pair A failed because negation landed as `opaque` carrying the node type: `unary_operator` from the Python grammar, `unary_expression` from the TypeScript one. Two tree-sitter grammars' internal names, used as semantic content, in a representation whose first rule is that nothing lexical enters it. Negation is now `0 - x` in both adapters and pair A matches. The general lesson is larger than negation: every `opaque` reason in the IR is currently a grammar node name, so any two languages disagree about anything they both cannot represent. An opaque node must carry a normalised category, not the grammar's word. Recorded as the first item of IR-2.
2. **A member read was an unknown instead of data flow.** `account.balance` used inline produced `unknown(member)`, which is why three getters collided and why pair C differed at the first operand. A read is now `read(object, property)`. Collision groups fell from 5 to 4: the seven-member group and the getter group both dissolved, `block` still matches, and the opaque rate is unchanged at 16 of 240, because these were resolution gaps rather than opacity.

**What remains, and it is the actual answer to the question.** Pairs B, C, and D fail, for two different reasons, and only one of them is a defect.

- **C is canonical form, and the IR can fix it.** One program binds `acct.balance` to a value and compares the value; the other compares the read inline. Same meaning, two shapes, and the IR has not chosen which is canonical. Either inline a value used once or bind every subexpression; the choice is arbitrary and must be made and tested. That is IR-2 work and it is entirely within the current model.
- **B and D are not defects, and no amount of IR work fixes them.** `.balance` against `.available`, `post` against `postEntry`: nothing inside either function says those name the same thing. A human knows it from the domain, not from the code. This is precisely the identity, equivalence, similarity split the frozen design already draws: identity is not computed, equivalence is a claim supported by evidence, similarity finds the candidates. So the honest statement of where we are:

> IR-1 has demonstrated that the same behaviour expressed in two languages, with different local names, different literal spellings, different guard arrangements, and different control idioms, converges on one fingerprint. It has not demonstrated, and by construction cannot demonstrate from source alone, that two different domain names denote one concept.

That second step needs evidence the source does not contain: types and schema that show two reads reach one field, runtime traces that show two operations hit one endpoint, tests that assert the same obligation, or a person saying so. Those are evidence channels the frozen design already has places for, and adding them is the next real experiment, not a redesign.

**Proposed next experiment, E2-cross.** Two independently written programs, every identifier different, every property name different, different idioms, plus the evidence channels: a shared schema or type declaration, and a trace from each. Success is that Understanding *proposes* `SUBSTITUTABLE_UNDER` between the corresponding concepts at PROBABLE or better and names the evidence that carried it, and that a person can raise it to VERIFIED. Not that it computes identity, which would be the design telling a lie about what it knows.

**Does the frozen design need changing?** No, on the evidence so far. Concepts already have identity independent of every rendering; renderings are already assertions; equivalence is already a claim with evidence; provenance already distinguishes what was parsed from what was observed, declared, and inferred. What the build has exposed is that the IR is one evidence channel among several and is currently the only one implemented, which makes it look like the whole model. The correction belongs in the log and in IR-2's priorities, not in the architecture. If a later experiment shows a concept cannot be resolved even with several channels agreeing, that would be a forcing result, and the rule for changing a frozen document would then be satisfied.

```
IR-1b  opaque 16/240 = 6.7%   groups 4   genuinely useful 1 (block)
       pairs A match; B, C, D differ (C is canonical form, B and D need evidence beyond source)
```

## IR-2, prediction recorded before the work, 2026-09-13

Two changes, in this order, both failing check two of "right" as the design stands (a grammar's vocabulary inside the IR; two shapes for one meaning):

1. **Normalised opaque categories.** An unrepresented construct records what kind of thing it is, from a fixed language-neutral list (`loop`, `multi-branch`, `exception-handling`, `concurrency`, `declaration`, `other`), never the grammar's node name. Each adapter maps its own node types onto that list, and the mapping is the adapter's business.
2. **Canonical form for bind-versus-inline.** A value bound once and read once is inlined at its single use, so `x = a.b; if (x >= y)` and `if (a.b >= y)` are one shape. Bindings read more than once, or never, stay.

Predictions:

- Pair C (guard-and-body against early return, bound against inline) **matches**.
- Pairs A matches still; B and D still differ, because they need evidence beyond source and nothing here provides it.
- `block` still matches across the two adapters.
- Opaque count is unchanged at 16 of 240 (categories rename, they do not represent), and the `for_in` and `for` reasons merge into `loop`, so the reason list shortens from 5 entries to 3.
- The remaining collision groups change: the `unparen`/`cond` ternary group **survives** (both are genuinely one shape), and the switch-heavy group **survives**, since switch is untouched. So groups stay at 4 or fall to 3 if inlining separates the switch group's members.

If pair C still differs after this, the cause is not canonical form and the diagnosis starts over.

## IR-2, measured 2026-09-13

Two changes, both because the IR failed check two of "right" as it stood.

1. **Normalised opaque categories.** An unrepresented construct records a language-neutral category (`loop`, `multi-branch`, `exception-handling`, `concurrency`, `declaration`, `other`). Each adapter carries its own table from its grammar's node types onto that list; the grammar's own words no longer reach the IR at all.
2. **Canonical single-use inlining.** A value bound once and read once is inlined at its use, so a bound read and an inline read are one shape. A value read twice stays, because sharing is part of the meaning. A value never read stays, because a dead binding is a fact about the code. A call is never inlined, because moving an effect moves when it happens.

A third change the work forced, unplanned and recorded as such: negation had two shapes, `0 - x` as an expression and `negated` as an operand, so the same meaning still differed depending on whether it appeared in a binding or an argument. One shape now, the `negated` operand, and `Operand` gained a `computed` form so an expression used once can be inlined where it is computed.

```
IR-2 (encoder ir_schema 3, corpus = frozen IR-0 src)
files 10   functions 58   statements 240
opaque     16 / 240 = 6.7%        (IR-0 35.4%, IR-1 6.7%)
groups     4                      (IR-0 6, IR-1b 4)
categories loop 9, multi-branch 6, other 1     (was 5 grammar-specific reasons)
```

**The prediction, scored.**

- Pair C matches: **passed**, and it took the third change to get there.
- Pair A still matches, B and D still differ: **passed**.
- `block` still matches: **passed**.
- Opaque unchanged at 16 of 240: **passed**.
- Reason list shortens from 5 to 3: **passed**, and the merge is real: `for_in` and `for` and `while` became `loop` 9, `switch` became `multi-branch` 6.
- Groups stay at 4 or fall to 3: **passed at 4**. The ternary group and the switch group survived as predicted. The seven-member group also survived, and the reason is a gap I had misdiagnosed: those bodies are a single `return` of a chained call, and a call in operand position is still `unknown`. IR-1b fixed member reads; it did not fix calls used as values in operand position, and the log's IR-1 entry blamed "free-name member reads" for this group when the cause is a call. Corrected here rather than above.

**Where the cross-language question now stands.** Of four pairs, A and C match: local names, literal spellings, guard arrangement, control idiom, bound-versus-inline, and negation form can all differ and the fingerprint is the same. B and D differ and should, because nothing in the source says `.balance` and `.available`, or `post` and `postEntry`, name one thing. That boundary is now sharp, which is what makes E2-cross worth running: everything syntactic is out of the way, and what remains is exactly the question of whether evidence beyond source can carry the claim.

Next, in evidence order: a call in operand position (dissolves the seven-member group, and it is the last resolution gap the dogfood names), then `multi-branch`, then `loop`. Prediction for IR-3: groups fall to 3, the seven-member group dissolves into distinct fingerprints, `block` still matches, and opaque stays at 16 of 240 because a call as a value is a resolution gap and not an opaque statement.

## Gate 3 passed on Windows, 2026-09-14

Run by Michael on his development rig: Windows, NTFS, Node v22.22.0, npm 10.9.4. My harness: Ubuntu 24.04.4, ext4, Node v22.22.2. Same archive, `understanding-2026-09-14-12c8a848.zip`.

**Suite: 23 of 23 passing on NTFS.** The case that had never run outside ext4, "a store with a torn tail can be written to again, and the new transaction commits cleanly" (7.69 ms), passes. That path truncates the journal during construction, so Windows file locking and antivirus interception sat in it and did not break it. The other three crash cases pass too.

**The measurement is identical across platforms, on both corpora.**

| | Linux ext4 | Windows NTFS |
|---|---|---|
| frozen IR-0 corpus: files / functions / statements | 10 / 58 / 240 | 10 / 58 / 240 |
| frozen: opaque | 16 / 240 = 6.7% | 16 / 240 = 6.7% |
| frozen: categories | loop 9, multi-branch 6, other 1 | loop 9, multi-branch 6, other 1 |
| frozen: collision groups | 4 | 4 |
| frozen: group fingerprints | c4048acd, 6acd1800, 2b290992, 6c40a8fa | c4048acd, 6acd1800, 2b290992, 6c40a8fa |
| live tree: files / functions / statements | 10 / 68 / 299 | 10 / 68 / 299 |
| live tree: opaque | 21 / 299 = 7.0% | 21 / 299 = 7.0% |
| live tree: collision groups | 6 | 6 |

Every fingerprint matches to the character, including on the live tree, which was not required and is stronger evidence than the frozen comparison alone. The CRLF hypothesis was already ruled out on Linux; this closes the question. `canonPath` also earned its place: the Windows run prints `frozen-ir0/src/...` with forward slashes, as designed, so the two machines seed the same literals.

So the measurement is a property of the source, not of my container. Gate 3 is passed, gates 1 through 4 are clear, and IR-3 may proceed on a baseline that two operating systems agree on.

**One thing confirmed rather than assumed.** The Windows transcript of the full suite listed 22 test names while reporting `tests 23` / `pass 23`, and the absent name was pair 3 (None against null-or-undefined with the guard inverted). Running the adversarial file alone on Windows returns 6 of 6 with pair 3 named and passing in 1.497 ms, so the test runs on NTFS and the gap was a lost line in the copied transcript. Worth keeping in the log for the reason the log exists: a transcript is a rendering, not the measurement, and a name missing from a rendering is not evidence that the thing did not happen. One command settled it instead of an argument.

## IR-3 begins, 2026-09-14

Gates 1 through 4 are clear: the instrument is in the repository, the suite passes from a clean checkout, and two operating systems produce identical numbers on both corpora. IR-3 proceeds against a baseline that is no longer a property of one machine.

The gap, as the dogfood names it: a call used as a value in operand position is `unknown`. Seven functions across four files share one fingerprint because each is a single `return` of a chained call, and the IR sees only that something unknown is returned. Predictions, recorded before the work (unchanged from the IR-2 entry, restated here for the run):

- the seven-member group (`c4048acd`) dissolves into distinct fingerprints;
- collision groups fall to 3 or fewer;
- `block` still matches across the two adapters (`2b290992` survives);
- opaque stays at 16 of 240 on the frozen corpus, because a call as a value is a resolution gap and not an opaque statement;
- the live tree's `categoryOf` group (`75debf63`) also dissolves, since those bodies are a single indexed read with a fallback.

## IR-3, measured 2026-09-14

Change: a call, a subscript, an arithmetic or comparison expression, or a ternary used in operand position becomes a computed value in the data flow rather than `unknown`. A call is still never inlined by the canonical form, because a call may have effects and moving it moves when it happens; it carries its operation and arguments as a computed operand where it is used.

```
IR-3 (encoder ir_schema 3, corpus = frozen IR-0 src)
files 10   functions 58   statements 240
opaque     16 / 240 = 6.7%     (IR-0 35.4%, IR-1 6.7%, IR-2 6.7%)
groups     3                   (IR-0 6, IR-1b 4, IR-2 4)
live tree  68 functions, 305 statements, 21 opaque = 6.9%, groups 4 (was 6)
```

**Predictions, scored.**

- The seven-member group dissolves: **passed in part.** `c4048acd` is gone. Five of its seven members now carry distinct fingerprints. Two remain paired, `effectProjection` and `about`, and the reason is exact and worth stating: both are a single `return` of `.filter(<arrow function>)`, and an arrow function in argument position is still `unknown`. They are genuinely the same shape over a body the IR cannot yet see. Not a false match, a named gap.
- Groups fall to 3 or fewer: **passed**, 3 on the frozen corpus and 4 on the live tree.
- `block` still matches: **passed**, now at `a6afc611`.
- Opaque stays at 16 of 240: **passed**, unchanged, as a resolution gap should be.
- The live tree's `categoryOf` group dissolves: **passed**, it is gone.
- Cross-language pairs: A and C still match, B and D still differ. **Unchanged, as intended.**

Statements rose on the live tree from 299 to 305 while the frozen corpus held at 240, which is the corpus confound again and the reason the frozen number is the one that counts.

**What the dogfood now names as the next gap**: a function passed as an argument (`arrow_function`), then `multi-branch` 6, then `loop` 9. The first is the interesting one, because a callback is not a syntactic detail; it is behaviour handed to another function, and representing it means the IR starts carrying behaviour as data. Prediction for IR-4, recorded now: the `effectProjection`/`about` pair dissolves, groups fall to 2 on the frozen corpus (leaving the switch-heavy group and `block`), `block` still matches, and opaque stays at 16 of 240.

## IR-3 confirmed on Windows, 2026-09-14

Windows, NTFS, Node v22.22.0. 23 of 23 passing. On the frozen corpus: 10 files, 58 functions, 240 statements, opaque 16 of 240 = 6.7%, 3 collision groups, categories loop 9, multi-branch 6, other 1. All three group fingerprints match the Linux run to the character: `6acd1800` (the switch-heavy group), `a6afc611` (`block` in both adapters), `7fb18b89` (`effectProjection` and `about`, both a `return` of `.filter(<arrow function>)`). Two platforms, one measurement, twice in a row now.

**A handover defect, and the fix is on my end.** The previous Windows run reported 4 groups and looked like a gate failure. It was not: the tree was still the IR-2 build. `ir_schema` printed 3 in both, because the schema was bumped during IR-2, so the one line that should have distinguished the builds could not. Three times in two days a stale artifact has been reported as a result (the 16-versus-23 archive, the transcript missing pair 3, and this). Each was caught, and each was caught by a person comparing two numbers by hand, which is not a control.

So the instrument gains a build id: a content hash over `src/` and `scripts/`, printed in the dogfood header and in the test run's first line. A measurement then carries the identity of the code that produced it, and a run against the wrong build announces itself instead of being mistaken for a result. That is the same rule as every other finding today, applied to the harness: a number that cannot say which build produced it is not evidence.

## IR-4, measured 2026-09-14

Change: a function passed as a value is represented as behaviour rather than dropped as unknown. An arrow function, a function expression, or a Python lambda encodes as `behaviour(inputs, body)`, its parameters numbered from zero as inputs of their own and its body encoded by the same rules as any other body. So two callbacks that do the same thing are one shape, and a callback that does something different is a different shape. The IR now carries behaviour as data, which is the first thing in it that is not a description of control or of values.

```
IR-4 (build f48949f5caf3, corpus = frozen IR-0 src)
files 10   functions 58   statements 240
opaque     16 / 240 = 6.7%     (unchanged since IR-1)
groups     2                   (IR-0 6, IR-1b 4, IR-2 4, IR-3 3)
```

**Predictions, scored. All passed.**

- The `effectProjection`/`about` pair dissolves: **passed**. Both were a `return` of `.filter(<arrow>)`; the arrows differ and the IR now sees it.
- Groups fall to 2: **passed**. What remains is the switch-heavy group (`6acd1800`, five functions whose bodies are mostly `multi-branch`) and `block` in both adapters (`ee8c8e5c`), which is the one genuine cross-language match and has survived every change since IR-0 under four different fingerprints.
- `block` still matches: **passed**.
- Opaque stays at 16 of 240: **passed**. Behaviour was a resolution gap, not opacity.
- Cross-language pairs unchanged: **passed**. A and C match, B and D differ.

Every remaining collision on the frozen corpus is now attributable to `multi-branch`, which is the next gap and the last one before loops. From 6 groups with bulk opacity at IR-0 to 2 groups with one named cause and one true match.

**The instrument gained a build id** (a content hash over `src/` and `scripts/`, printed in the header) after a Windows run on the IR-2 tree reported 4 groups and looked like a gate failure. `ir_schema` could not distinguish the builds because it was bumped during IR-2. A measurement now carries the identity of the code that produced it.

Prediction for IR-5, recorded now: representing `switch`/`match` as a multi-way branch on one discriminator dissolves `6acd1800`, leaves `block` as the only group on the frozen corpus, drops opaque from 16 to 10 of 240 (the 6 `multi-branch` statements become represented), and leaves the cross-language pairs unchanged.

## IR-4 confirmed on Windows, 2026-09-14

Windows, NTFS, Node v22.22.0, `build f48949f5caf3` printed in the header, which is the same build id my harness printed, so the two runs are of the same code and not merely of the same version number. 23 of 23 passing. Frozen corpus: 10 / 58 / 240, opaque 16 of 240 = 6.7%, 2 collision groups, `6acd1800` and `ee8c8e5c`, both matching the Linux fingerprints to the character. Categories loop 9, multi-branch 6, other 1.

The build id worked on its first use: this is the first cross-platform confirmation where the identity of the code was part of the measurement rather than something a person had to check by hand afterwards.

Three platform confirmations in a row, at IR-2, IR-3, and IR-4. The measurement is a property of the source.

## E2-cross, design and predictions recorded before the work, 2026-09-14

The question: can Understanding resolve that two differently named things are one concept, when nothing in either source says so, using evidence beyond the source? This is the only failure left in the four cross-language pairs (B: `.balance` against `.available`; D: `post` against `postEntry`), and the design's own answer is that identity is never computed, equivalence is a claim supported by evidence, and similarity finds the candidates.

**Setup.** Two independently written programs, same behaviour, nothing shared: a Python module and a TypeScript module, every local name different, every property name different, the effect operation named differently, different idioms. Then three evidence channels, added one at a time so each one's contribution is measurable on its own:

1. **Structural only** (what we have today). Expect: no equivalence proposed beyond what the fingerprints already say.
2. **Schema**, declared by the owner: a statement that the Python field and the TypeScript field are renderings of one entity's attribute. Provenance DECLARED, authority OWNER in scope.
3. **Traces**, from Witness-shaped records: each program run, each recording what entered and left the function and which operation was called with what argument.

**What `match` must do, and must not do.** It must propose `SUBSTITUTABLE_UNDER` with a confidence and name the evidence that carried it. It must not assert identity, and it must not raise its own proposal to VERIFIED; only a person with authority in scope, or a proof, does that. A proposal with no evidence is a failure, and so is a proposal that claims more than its evidence supports.

**Predictions.**

- Channel 1 alone: no proposal for B or D. The fingerprints differ and nothing bridges them.
- Channel 2 (schema): B is proposed at PROBABLE, because a declared field equivalence bridges the only operand that differed. D is not, because nothing has been declared about the operations.
- Channel 3 (traces): D is proposed, because the two runs show one operation called with the same canonical argument at the same point in the same path condition. Confidence below B's, because a trace proves executions under conditions and not a law.
- With all three: the two functions are proposed substitutable under the obligations the traces discharge, at PROBABLE or better, with three evidence items named, and the fingerprints still differ. That last clause matters: the fingerprints must not be made equal. Equivalence is a claim laid beside the difference, never a rewriting of it.
- A negative control: a third program that differs in behaviour (the threshold changed) must NOT be proposed substitutable under any channel. If it is, the mechanism is matching shape rather than meaning and the result is void.

## E2-cross, measured 2026-09-14

Built `src/query/match.ts` and six tests. Two independently written programs, a Python module and a TypeScript one, same behaviour, every local name different, the read field named differently (`balance` against `available`), the effect operation named differently (`post` against `postEntry`), different idioms. 29 tests in the suite now, all passing.

**How it works.** `match` first blanks every name from both effect projections and compares what is left. If the blanked shapes differ, nothing is proposed and no correspondence can bridge it, which is the negative control. If they match, each differing name is looked for in the correspondences the store holds, and every bridge found is named as evidence with its source, its sentence, and the assertion ids it rests on. Confidence is the weakest link plus a small credit for corroboration. Nothing is ever asserted as identity, the fingerprints are never made equal, and `assertProposal` writes the claim as INFERRED with verification NONE.

**Predictions, scored. Three passed, one failed, and the failure is the most useful result.**

- Channel 1, structure only: predicted no proposal with the reasons named. **Passed in substance, and it exposed a defect in my first implementation.** The verdict was `NONE`, which is wrong: the shapes do match, and saying NONE hides a real finding. It now returns `STRUCTURALLY_SIMILAR` at 0.2 with both gaps named in plain words ("Nothing says the field balance and available are the same thing", and the same for the operations).
- Channel 2, a declared schema bridging the field only: predicted PROBABLE for B. **Failed, and correctly.** One bridged difference out of two is not enough, and the operation gap is still listed. My prediction was wrong because I was thinking about pair B in isolation while the function these programs share has both differences in it.
- Channel 3, declared field plus **observed** operation: predicted PROBABLE. **Failed.** It comes back STRUCTURALLY_SIMILAR at 0.55. An OBSERVED correspondence is weighted below a DECLARED one on purpose, because a run shows what happened under its conditions and not what must hold, so a claim resting on an observation cannot reach probable. I could have reached my predicted verdict by moving the weight. I did not, because tuning the instrument to produce the predicted answer is the one thing this log exists to prevent, and the honest finding is more interesting than the prediction was: **observation is enough to notice a correspondence and not enough to claim one.**
- Channel 3b, both correspondences DECLARED by the owner: **PROBABLE_EQUIVALENT at 0.7**, three evidence items named, the obligations attached, the fingerprints still different, and the difference stated in `unresolved` rather than hidden. This was not a prediction; it is what the principled weighting produces, and it is the answer to the question E2-cross was built to ask.
- The negative control (the threshold changed to a constant): **NONE at 0, with no evidence cited for a claim that is not made**, whatever correspondences are supplied. Passed.
- Store behaviour: the proposal lands as SUBSTITUTABLE_UNDER, source INFERRED, verification NONE, confidence below 1, obligations and evidence travelling with it. A person with OWNER authority in scope supersedes it with verification HUMAN, and the INFERRED original survives in history. Passed.

**What E2-cross actually establishes.** The answer to "can Understanding resolve that two differently named things are one concept" is: not from source, ever, and it does not pretend to. With a person's declaration in the right scope it proposes substitutability at PROBABLE, names the three things that carried the claim, keeps the fingerprint difference visible, and waits for a human to raise it. With only an execution to go on it says the shapes match, says exactly which names are unaccounted for, and stops short. That is the design's identity/equivalence/similarity split working in code rather than on paper, and it is the first time the store has done something the source alone could not.

**Corrected in my own work, recorded here rather than hidden:** one of the two failures above was a defect in `match` (NONE where STRUCTURALLY_SIMILAR was true), and one of the six tests asserted the wrong thing about `unresolved` and was corrected after the code proved itself right. The code was right and my test was wrong; I changed the test.

## E2-cross confirmed on Windows, 2026-09-14

Windows, NTFS, Node v22.22.0, `build 0978265045ec`, the same build id my harness printed. 29 of 29 passing, including all six E2-cross cases: the three channels, the declared-declared case that reaches PROBABLE, the negative control, and the store path where a person with authority raises an INFERRED proposal and the original survives in history. Frozen corpus unchanged at 10 / 58 / 240, opaque 16 of 240, 2 groups, both fingerprints matching Linux to the character.

Fourth consecutive cross-platform confirmation, and the first one that covers the store's reasoning rather than only the encoder's arithmetic. The weighting that keeps an observed correspondence below a declared one behaves identically on both platforms, which matters because that number is the one I refused to tune.

## E2-cross, second run under stricter conditions, 2026-09-14

Conditions set before the work: freeze IR-4 exactly, require zero opacity in the E2 programs so the known switch and loop gaps cannot confound the result, test positive evidence, evidence removal, and contradictory evidence, change nothing in the IR to make E2 pass, and if E2 fails, keep the failure.

**IR-4 is frozen mechanically, not by intention.** `frozen-ir4/` holds a copy of the three encoder files and `test/ir/frozen.test.ts` fails if any live file differs from its copy. The encoder hash before this work and after it is the same: `fd79200924436d60`. The frozen-corpus measurement is also unchanged, 240 statements, 16 opaque, 2 groups, so nothing in this round can have come from a tuned IR. 34 tests, all passing.

**Zero opacity in the E2 programs, asserted rather than assumed.** A test counts opaque nodes in all three programs (Python, TypeScript, and the changed control) and requires zero, and additionally requires that neither projection contains an `opaque` node or an `unknown` operand: every operand in these programs is traced. So the switch and loop gaps are outside the experiment by construction.

**Positive evidence.** Both correspondences declared by the owner in scope: `PROBABLE_EQUIVALENT` at 0.7, three evidence items named, obligations attached, fingerprints still different and the difference stated.

**Evidence removal, which is the strongest new result.** The two correspondences are stored as real assertions (the fields as concepts of kind `state`, the operations of kind `external`, related by SUBSTITUTABLE_UNDER, DECLARED by the owner with authority in scope). The proposal is written with `derived_from` set to those assertion ids. The owner then retracts the field declaration. The store's single invalidation rule retracts the claim in the same transaction, without `match` being consulted and without any code in `match` knowing about retraction: the claim does not survive its evidence. The claim and its retraction both remain in history with what the claim rested on. Re-running `match` without that correspondence agrees independently, dropping below PROBABLE and naming the missing bridge.

**Contradictory evidence.** A declared "these are the same" against an observed "these held different values at the same moment": the bridge is refused, confidence is **zero rather than merely reduced**, the contradiction is reported as its own finding with both sides in it, and the verdict cannot reach PROBABLE. A denial with nothing affirming it is also reported as a finding rather than as silence. A denial is never outvoted by an affirmation, because a contradiction is a finding and not a tie to be broken.

**Two defects found, both in my work and both recorded rather than smoothed.**

1. `assertProposal` cited its evidence assertion ids in an evidence field but did not set `derived_from`, so the store's invalidation rule could not see them and a claim would have outlived the evidence that carried it. Found by writing the removal test, not by reading the code. Fixed in `match.ts`; the IR was not touched.
2. My first removal test asserted the correspondence with `EXPLAINS` between two executables, and the schema refused it: "EXPLAINS does not accept a executable as subject." The relation type system caught a misuse written by me, in a test, in the exact way E5 predicts it should catch a model's plausible nonsense. The fix was to model the correspondence with the relation that already means it, so no vocabulary change was needed.

**What this run establishes.** The claim is not a label. It is supported by named assertions, capped by contradiction, and mechanically dependent on its evidence: withdraw the evidence and the claim disappears, in the same transaction, by a rule that knows nothing about substitutability. E2-cross did not need the IR bent to pass, and the two things that broke were mine.

## The corpus becomes a dataset, and the instrument is renamed, 2026-09-14

Two corrections prompted by Michael, both about the apparatus rather than the result, and the second was a real defect in how the experiment was published.

**`dogfood` is now `measure`.** The old name said who the instrument was pointed at, not what it does. `npm run measure -- <corpus>` reports how much of a corpus the encoder can represent and which functions collide. `npm run dogfood` is kept as an alias so older log entries stay runnable.

**The frozen corpus was not a dataset.** `frozen-ir0/src` held ten files and nothing else: no record of which archive they came from, no per-file hashes, no record of what the measurement was when they were frozen, and no licence statement. Another person could run the instrument and see 240 statements, but could not check that their copy was the one measured, which makes every number in this log unverifiable by anyone but us. That is the same failure as a transcript without a build id, one level up.

`corpora/ir0-typescript/` now holds:

- `src/`, the ten files, unchanged and never to be edited;
- `MANIFEST.json`, a SHA256 and byte size per file, the file count, and a corpus hash derived from them (`01c953f3772a799f`);
- `PROVENANCE.md`, which archive and checksum the files came from, who wrote them, the licence (GPL-3.0-only, all our own code, redistributable with the repository), how to run it, and the rules: never edit a file, never add or remove one, a new encoder version adds a row and never changes one;
- `EXPECTED.json`, one row per encoder version, IR-0 through IR-4, each with the numbers, the build id where one exists, the platforms it was confirmed on, and a note. Rows are append-only: a correction is a new row saying what an earlier row got wrong.

**The instrument now checks itself against both.** It verifies every file against the manifest before measuring and refuses to run on a corpus that does not match, because a measurement over a corpus that is not the recorded one is not a measurement of anything. Then it compares the run with the current expected row and prints either `reproduces IR-4 of ir0-typescript, recorded 2026-09-14 at build f48949f5caf3, confirmed on linux and windows` or a list of exactly which numbers differ. Both guards were proven to fire, not assumed: a one-comment edit to a corpus file stops the run and names the file and both hashes; an added file is refused as not in the manifest; a doctored expectation is reported as `DIFFERS` with each number. Two new tests pin the corpus and its metadata. 36 tests.

This replaces the last comparison a person was doing by hand. A run now states whether it reproduces the record.

**Still owed, and it is the larger gap of the two.** There is no Python corpus. The IR's central claim is language independence and the Python adapter has never been measured against a real body of code, only against four hand-written pairs. The next apparatus job is a small, permissively licensed Python project frozen the same way, with its own manifest, provenance, and expected row. That number will be worse than the TypeScript one and should be, because the Python adapter is younger and thinner, and not knowing how much worse is the point.

## The build id catches a stale tree, 2026-09-14

The Windows run reproduced IR-4 of `ir0-typescript` exactly, and printed `build a4ec985ada34` where the shipped archive computes `cc713846973d`. Same numbers, different code identity, which can only mean the tree had a file the archive did not.

Diagnosed and confirmed in two commands: `scripts/dogfood.ts` was still present from the previous build, because `tar -xf` over an existing tree adds and overwrites but never deletes, and the rename to `measure.ts` had left the old file behind. Removing it brought the build id to `cc713846973d`, matching the archive.

Two things worth keeping from this.

The build id caught something no test and no number would have: not a wrong result, but a tree that was not the tree under discussion. Yesterday three false alarms came from exactly that class of error and each was found by a person comparing hashes by hand. This one announced itself.

And the handover rule is now explicit rather than assumed: **extract into an empty folder, never over an existing tree.** A stale file changes the identity of a build while leaving every measurement intact, which is the most misleading combination available. The run instructions in the archive say so from here on.

For completeness, the Windows transcript again listed fewer test names than it reported (34 of 36, the two journal tests absent). The same happened with pair 3 and was settled by running that file alone, which passed. Recorded as a rendering artefact of the terminal or the copy, not as a skipped test, and the check remains one command.

## The Python corpus, and the defect it found immediately, 2026-09-14

Half the central claim was untested: the IR asserts that meaning survives the language, and the Python adapter had been measured against four hand-written pairs and nothing else. `corpora/toml-python/` fixes the apparatus gap and the first measurement found a serious defect in the encoder, which is exactly what the corpus was built to do.

**The corpus.** The `toml` package, version 0.10.2, five files, 1,425 lines, vendored unchanged from `pip download --no-deps --no-binary :all: toml`. MIT licensed, notice retained in `corpora/toml-python/LICENSE`, so redistribution inside this repository is permitted and the licence travels with it. Chosen because it is pure Python with no dependencies, a real parser and serialiser rather than a toy, small enough to vendor whole so anyone can reproduce from the exact bytes, and the right kind of hard: loops, nested conditionals, exception handling, and string state machines. `MANIFEST.json` carries a hash per file, corpus hash `dbbd34f3b778aadb`. The instrument now dispatches on file extension, so one command measures either language; the encoder files were not touched and `frozen-ir4` still matches.

```
toml-python, IR-4, build 8cc1b336a386
files 5   functions 14   statements 141
opaque  20 / 141 = 14.2%     (ir0-typescript at IR-4: 16 / 240 = 6.7%)
categories  loop 8, other 5, declaration 4, exception-handling 3
collision groups 0
```

**The defect. The Python adapter found 14 functions. The project has 56.**

`encodeFunctions` in the Python adapter walks only the top-level children of the module for `function_definition`, so every method inside a class is invisible to it. The TypeScript adapter walks recursively and finds methods. Two adapters that do not find the same things cannot support a claim about language independence, and the number above is therefore a measurement of roughly a quarter of the project, not of the project. `decoder.py` reports 9 functions where it has 30; `ordered.py` and `tz.py` report zero functions and zero statements while containing three classes and seven methods between them.

This is why the corpus exists. The four hand-written pairs were all top-level functions, so they could never have exposed it, and no amount of staring at the TypeScript numbers would have either. The first contact with real Python found it in one run.

**What I did not do.** I did not fix the adapter in this round. The encoder is frozen at IR-4 and the discipline is to measure, record, and then change deliberately: fixing it is a new encoder version, which means refreshing `frozen-ir4`, adding a row to both corpora, and re-running E2-cross against it. The row in `EXPECTED.json` records the numbers as measured with the blind spot named in its own note, so nobody reads 14.2% as comparable to 6.7% until the asymmetry is gone.

**The defect is pinned as a test.** `KNOWN DEFECT: the Python adapter misses methods that the TypeScript adapter finds` asserts today's behaviour on a two-class fixture: Python finds only `top`, TypeScript finds `m` and `top`. When the adapter is fixed the test fails, and that failure is the signal to bump the encoder version, refresh the frozen copies, add rows to both corpora, and re-run E2. A defect that can be forgotten is a defect that will be. 39 tests.

**Prediction for IR-5, recorded now**, since the next work is decided by this finding rather than by the switch gap: making the Python adapter walk recursively for methods and nested functions will take `toml-python` to roughly 56 functions and 500 or more statements, and the opaque rate will rise well above 14.2%, because the methods it currently cannot see are full of the loops and exception handling that are already the top two categories. The number getting worse is the correct outcome, and if it does not rise I have misdiagnosed the cause.

## The Python corpus confirmed on Windows, 2026-09-14

Windows, NTFS, Node v22.22.0, extracted into an empty folder as the new rule says, archive hash confirmed before extraction. 39 of 39 passing, including the four corpus-integrity tests and the pinned `KNOWN DEFECT`. Both corpora verified against their manifests (`01c953f3772a799f`, `dbbd34f3b778aadb`) and both reproduce: `ir0-typescript` at 10 / 58 / 240 with 16 opaque and 2 groups; `toml-python` at 5 / 14 / 141 with 20 opaque, 14.2%, and the same four categories. `build 8cc1b336a386` on both runs, matching the archive.

`toml-python`'s row is now confirmed on linux and windows, updated in place in `EXPECTED.json` because the `confirmed` field is a record of where a row has been reproduced rather than part of the measurement; the numbers in the row were not touched.

The first cross-platform confirmation of a Python measurement, and the defect it exposed is confirmed on both platforms too: 14 functions found where the project has 56, and `ordered.py` and `tz.py` reporting zero statements while holding three classes and seven methods.

## IR-5, predictions recorded before the work, 2026-09-14

Purpose changed on Michael's call: the Python denominator defect is more fundamental than the remaining TypeScript opacity, so multi-branch waits. IR-5 makes the Python adapter walk recursively for methods and nested functions, as the TypeScript adapter already does, and nothing else.

Predictions are split, on his instruction, into hard predictions that can fail the round and diagnostic expectations that inform it. The distinction matters because a number from a deterministic counter agreeing with itself is not an independent fact, and 56 and 500 are both mine.

**Hard predictions. A failure here fails the round.**

1. Python function discovery rises substantially from 14, toward the independently established figure of 56.
2. `ordered.py` and `tz.py` no longer report zero merely because class methods were skipped.
3. The TypeScript corpus stays at 58 functions, 240 statements, 16 opaque, 2 groups, unless the encoder transition itself legitimately changes it, in which case the change must be explained and appended as its own row.
4. E2-cross retains its existing outcomes under `frozen-ir5`: pairs A and C match, B and D differ, the four evidence conditions behave as recorded, zero opacity in the E2 programs.
5. Both corpus manifests are unchanged. New `EXPECTED.json` rows are appended, never substituted.

**Diagnostic expectations. Informative, not pass/fail.**

- `toml-python` statements rise to roughly 500 or more.
- `toml-python` opaque rises above 14.2 percent.

**The valuable falsifier, stated plainly.** If function discovery expands dramatically and opacity does not rise, then my diagnosis was wrong: the hidden methods would not be disproportionately full of semantics the IR cannot represent, and something else explains the current categories. That failure is worth more than the prediction.

**Discipline for this round.** Whatever the corrected Python run exposes is recorded and not fixed in the same round. If it comes back at 56 functions, 537 statements, and 38 percent opaque, that ugly number is the first credible measurement of the Python corpus and it stands as the row. `frozen-ir4` becomes `frozen-ir5` deliberately, so the E2 result continues to belong to a named encoder rather than following HEAD.

## IR-5, measured 2026-09-14

Change: the Python adapter walks the whole tree instead of only a module's top level, so a method inside a class and a function inside a function are functions. Encoder now `python-adapter/0.2`, build `db10d41b6016`. Nothing else was touched; the TypeScript adapter and the IR itself are byte-identical to IR-4.

```
toml-python        IR-4              IR-5
files              5                 5
functions         14                56          (independent count of "def" in the source: 56)
statements       141               360
opaque            20 = 14.2%        49 = 13.6%
categories   loop 8, other 5,   loop 29, declaration 8,
             declaration 4,     other 8,
             exception 3        exception 4
groups             0                 2

ir0-typescript    IR-4              IR-5
                 58 / 240 / 16 / 2 groups, unchanged
```

**Hard predictions. All five passed.**

1. Function discovery rose from 14 to 56, which is exactly the independent count of `def` occurrences in the source. Passed.
2. `ordered.py` now reports 2 functions and 2 statements, `tz.py` 5 functions and 10 statements, where both reported zero. Passed.
3. The TypeScript corpus is unchanged: 58 / 240 / 16 / 2, same two collision fingerprints. Passed, and a row was appended recording that the transition left it untouched.
4. E2-cross retains every outcome under `frozen-ir5`: all ten cases pass, pairs A and C match, B and D differ, zero opacity in the E2 programs. Passed.
5. Both manifests unchanged, both corpus hashes verified, rows appended and none substituted. Passed.

**Diagnostic expectations. One short, one falsified, and the falsified one is the finding of the round.**

- Statements rose to 360, not the 500 or more I expected. Informative only; my estimate was a guess from line counts.
- **Opaque did not rise. It fell, from 14.2% to 13.6%.** This is the falsifier I wrote down before the work, and it fired. My diagnosis was that the hidden methods were disproportionately full of semantics the IR cannot represent. That was wrong: the newly visible 42 methods are, if anything, marginally *more* representable than the 14 top-level functions were. So the 14.2% at IR-4 was not a floor hiding something worse; the opacity in this corpus is distributed roughly evenly, and `loop` going from 8 to 29 while the rate held nearly flat says the loops are spread through the methods rather than concentrated in the parts that were hidden.

What that leaves: one honest number for Python, 13.6% against TypeScript's 6.7%, and the gap is now a real comparison rather than an artefact of a broken denominator. Roughly twice as much of the Python corpus is unrepresented, and the categories say where: 29 of the 49 are loops.

**Two new collision groups in Python, and both are worth naming rather than celebrating.**

- `decoder.py:get_empty_table` and `encoder.py:get_empty_table` share a fingerprint. On inspection this is a true duplicate: the same one-line function defined in two modules. The first genuine finding the store has made about someone else's code.
- `ordered.py:__init__` and `ordered.py:__init__#1` share a fingerprint, which is two classes in one module each having a trivial constructor. The `#1` suffix is mine: the adapter now finds duplicate names and disambiguates with a counter. That is a rendering choice, not a semantic one, and a poor one: a method should be identified by its class, not by the order it was encountered. Recorded as the next apparatus defect and **not fixed in this round**, per the discipline for IR-5.

**A test of mine encoded a false assumption, and IR-5 exposed it.** `the corpus carries its provenance and its expected results` asserted that every row must report the same statement count, on the reasoning that the corpus is fixed. But a statement count is a property of the corpus *and* the encoder, and a better encoder legitimately finds more statements in the same files. The assertion now requires that every row measure the same file count and that any row changing the statement count explain why in its note. The old assertion would have blocked every future encoder improvement while looking like rigour.

**`frozen-ir5` established deliberately.** `frozen-ir4` is kept, so E2-cross's first result still has the encoder it belongs to, and a test asserts that the two frozen Python adapters differ, so the freeze cannot be a copy made by accident. 40 tests.

## IR-5 confirmed on Windows, 2026-09-14

Windows, NTFS, Node v22.22.0, extracted into an empty folder, archive hash checked first. 40 of 40 passing, `build db10d41b6016` on both runs, both corpora verified against their manifests and both reproducing IR-5: `ir0-typescript` at 58 / 240 / 16 / 2, `toml-python` at 56 / 360 / 49 / 13.6% with the same four categories and the same two collision fingerprints. Both IR-5 rows are now confirmed on linux and windows.

So the first credible Python measurement holds on two platforms, and so does the falsification: the opaque rate fell when the denominator was fixed, on both machines, which rules out the possibility that the surprise was an artefact of mine.

Five consecutive rounds confirmed cross-platform. The instrument, the corpora, the store's reasoning, and now two adapters that find the same things.

## E3-semantic, protocol recorded before any ingestion, 2026-09-14

The question, stated so it can fail: **do the 86.4% of statements IR-5 can represent compose into application-level meaning, or does the store hold excellent descriptions of isolated pieces of code?**

IR-5 is frozen (mechanically, by `frozen-ir5/` and a test). Nothing about the encoder, the opacity, or the relation vocabulary changes during E3.

**Where E3 could cheat, and the rule that prevents it.** If ingestion writes `A CAUSES B` because I inferred it while reading `decoder.py`, then E3 tests my code comprehension and stores my answers, and the store has understood nothing. So: ingestion writes PARSED assertions only, each one carrying the source construct it came from and the adapter rule that produced it, so any assertion can be audited backwards to a location and a rule. No assertion enters the PARSED channel because it is obviously true. No TOML-specific handling. No new relations. No data-flow additions. No opacity fixes.

**Order, fixed now so the searcher cannot be shaped by the answer.** Measure the graph first; decide whether any non-trivial interprocedural path exists at all; only then write a generic `derivePath(start, end, allowedRelations)` returning FOUND with path, assertions and provenance, NOT_FOUND, or CONTRADICTED with the conflicting evidence; freeze it; then establish ground truth independently from `toml`'s own tests and the TOML specification; then run the controls against frozen apparatus.

**Stop condition, and it is a result rather than a disappointment.** If no non-trivial interprocedural behavioural path exists in the current representation, E3 stops there and is recorded as falsified at IR-5: local computational semantics do not compose into application-level semantics, and what we have is language-independent *local* computational semantics with composition missing. Reducing opacity would not fix that.

**Two things deliberately deferred.**

- The independently written TypeScript control. I have read `decoder.py` and `encoder.py` in this conversation, so anything I write is contaminated as evidence about cross-language derivation. When it happens it will be written by a session with the specification and the behavioural tests and no access to the Python, and frozen with a hash before Understanding sees it.
- The mechanical emitter, which is **E4**, not part of E3. E3 asks whether the stored representation can derive application behaviour; E4 asks whether it holds enough to reconstruct an implementation. Those are different claims and a representation can pass either without the other.

**The honest statement of where IR-5 leaves us, before E3 runs:** evidence that Understanding contains a language-independent representation of substantial portions of computational behaviour; no evidence yet that the stored representation captures the semantics of an application independently of its implementation. E3 exists to try to falsify the second.

**My own prediction, recorded before the measurement.** Step 3 will show a graph that is nearly all intraprocedural. The adapter records CALLS, and a call's arguments and returns exist inside a function's projection, but nothing records that a value leaving function A is the value entering function B, and PARTICIPATES_IN and FOLLOWS are written by nothing today. So I expect many concepts, a large number of CALLS edges, effectively no edges that carry a value across a call boundary, and therefore no derivable behavioural path in the sense E3 means. If that is what the measurement shows, E3 stops at step 5 and the finding is composition.

## E3-semantic, step 3: the graph measured, 2026-09-14

Ingested both corpora with IR-5 unchanged, PARSED assertions only, each carrying the rule that produced it and the file it came from. Four tests pin those constraints: every assertion PARSED, unverified, confidence 1, no authority, a rule from a closed list of eight, a source file, an edge only where a call resolves to exactly one declared name, and none of the eleven forbidden relations (SATISFIES, SUPPORTS, SERVES, EXPLAINS, SUBSTITUTABLE_UNDER, SIMILAR_TO, CAUSES, TRIGGERS, VIOLATES, FOLLOWS, PARTICIPATES_IN). 44 tests. `npm run graph -- <corpus>` reproduces the measurement.

```
toml-python                        ir0-typescript
concepts          61 (5 + 56)      68 (10 + 58)
assertions       486
  HAS_PREDICATE  171
  HAS_EFFECT     131
  RENDERS_AS      61
  MEMBER_OF       56
  HAS_FINGERPRINT 56
  CALLS           11               15

executables              56        58
CALLS edges              11        15
isolated executables     38        40
connected components     45        44
largest component         5         8
longest directed chain    2         2

RECEIVED   RETURNED   PARTICIPATES_IN   FOLLOWS   OBSERVED_IN   TESTED_BY
   0          0             0              0          0            0
```

**The answer to step 4 is no, and the protocol says stop.** There is no non-trivial interprocedural behavioural path in this representation, and the numbers say why with no room for interpretation. Two thirds of the functions in both corpora (38 of 56, 40 of 58) have no call in or out at all. The graph is 45 components for 56 functions. The longest directed chain is two calls. And every relation that could carry a value across a call boundary is empty: no RECEIVED, no RETURNED, no PARTICIPATES_IN, no FOLLOWS, no OBSERVED_IN, no TESTED_BY.

What exists is 302 assertions describing what happens *inside* functions (predicates, effects, fingerprints) and 11 edges between them. A CALLS edge says A calls B; nothing says which value of A's arrives as which input of B, nor what B's result becomes in A. So a chain like input → decoder behaviour → condition → transformation → observable result cannot be assembled: each link would have to be supplied by whoever asked, which is the contamination the protocol was written to prevent.

**E3 is recorded as blocked at IR-5, and this is the falsification stated before the work:**

> IR-5 represents substantial computational behaviour within functions, but does not preserve sufficient interprocedural semantics to represent application behaviour.

So Understanding, as it stands, holds **language-independent local computational semantics**. It does not hold application semantics, and reducing the 13.6% opacity would not change that: it would produce increasingly excellent descriptions of increasingly isolated pieces of code. What is missing is composition, and it is missing by construction rather than by accident.

No path searcher was built. Building one now would have been an apparatus with nothing meaningful to traverse, and its first result would have been a number about my query rather than about the store.

**My prediction, scored: passed, and I would rather it had failed.** I wrote before the measurement that the graph would be nearly all intraprocedural, that CALLS would be plentiful, and that no value would cross a call boundary. Two of three: the emptiness of the flow relations is exactly as predicted, but CALLS is far *sparser* than I expected, 11 edges among 56 functions, because the ingestion refuses to resolve a call that names nothing in the corpus or names several things. 29 distinct operations went unresolved across 84 occurrences, and the list is informative: 26 of those occurrences are `opaque:*` pseudo-operations, which is opacity leaking into the call graph, and the rest are standard-library calls (`split`, `strip`, `str`, `format`) and ambiguous names (`__init__` in two classes, `get_empty_table` in two modules).

**Three findings for whatever IR-6 turns out to be, in the order the measurement gives them.**

1. **Nothing records a value crossing a call boundary.** This is the whole blocker. A call site knows its arguments and the callee knows its inputs by position, and nothing joins them. The relations exist in the vocabulary (RECEIVED, RETURNED) and are written by nobody.
2. **An opaque statement destroys call edges, not just statements.** A call inside an unrepresented loop becomes `opaque:loop` and the callee is lost. So the 13.6% is understated as a cost: it also removes interprocedural structure, and the 29 loops in the Python corpus are where most of it goes.
3. **A call to something outside the corpus is indistinguishable from a call to nothing.** `split` and `strip` are calls into the standard library, which is real behaviour crossing a boundary the store cannot see, and they are counted the same as an unresolvable name.

**What I am not doing.** Not building the searcher, not adding data-flow relations, not touching the opacity, and not proceeding to E4. E3's stop condition fired and it fired for a reason worth having: we now know precisely what to build next, and we know it from a measurement rather than from a design discussion.

## E3's block confirmed on Windows, 2026-09-14

44 of 44 passing, including the four ingestion constraints. Both graph measurements reproduce to the number: `toml-python` 486 assertions, 11 CALLS, 38 isolated of 56, 45 components, longest chain 2; `ir0-typescript` 372 assertions, 15 CALLS, 40 isolated of 58, 44 components, longest chain 2. Every value-flow relation zero on both corpora on both platforms.

So the falsification is confirmed, not observed once. Understanding holds language-independent local computational semantics and no application semantics.

The unresolved lists, seen side by side for the first time, say the same thing in both languages. Python: `opaque:loop` 16, `split` 7, `strip` 3. TypeScript: `opaque:loop` 8, `filter` 6, `opaque:multi-branch` 6, `get` 4, `push` 4, `set` 3, `map` 2. In both, the two largest causes of a lost call edge are opacity and calls into a runtime the store cannot see, and the TypeScript list makes the second one unmistakable: `filter`, `map`, `get`, `set`, `push`, `slice`, `replace` are all standard-library methods on values, not functions of the corpus. Nothing distinguishes them from an unresolvable name today, so a call to a known runtime operation and a call to nothing are recorded identically.

## IR-6 Composition, protocol frozen before the work, 2026-09-14

**A note on the name, so nobody is confused six months from now.** "IR-6" here denotes a version of the Understanding *representation as a whole*. It is not `ir_schema`, which stays at 3, and it is not the encoder, which stays at IR-5 and byte-identical. IR-6 is a schema and ingestion change: new concept kinds and relations, and an ingestion that writes them from information the IR-5 encoder already produces. The frozen-encoder test staying green is the proof that the encoder did not move, and every fingerprint and every corpus measurement taken so far therefore stays comparable.

This is the first change the frozen founding design has *forced* rather than invited, which is the condition the design sets for its own amendment.

**The central prediction, and it is narrow on purpose.** Given an already uniquely resolved call, can Understanding mechanically preserve value identity across the executable boundary using information already present in IR-5? If yes, then E3's finding is sharper than it looked: ingestion discarded compositional semantics the encoder had already captured. If no, then the belief that `bind(call(...))`, argument operands, and returns contain sufficient compositional information is falsified.

**What is built.** Two concept kinds, `invocation` and `value`, and the relations for flow across a boundary. A call site becomes a concept, because `x = f(a)` and `y = f(b)` are one callee and two distinct flows, and no function-to-function edge can tell them apart. Parameters, arguments, call outcomes, and returns become `value` concepts.

**Bound set now: values at boundaries only.** Parameters, arguments, call outcomes, returns. Intermediate expressions do not become concepts. Without this bound every subexpression in `toml` becomes a concept, the store grows by an order of magnitude, and concept identity stops meaning anything. If a later experiment needs intermediates, that is its own forced change.

**Explicitly not done in this round**, because these are the limitations that make the experiment useful: the encoder does not change, opacity is not reduced, name resolution is not improved, no standard-library knowledge is added, and no emitter is built.

**Provenance survives derivation.** Every path `derivePath` returns identifies the PARSED assertions supporting it, and it does so through the existing `derived_from` machinery rather than a second provenance system. Retracting a required supporting assertion must make the derived path disappear, by the store's one invalidation rule, exactly as retracting a declaration made the E2 claim disappear.

**Hard predictions.**

1. On a tiny zero-opacity fixture where `A(x)` calls `B(x)` and `B(y)` returns from `C(y)`, and `A` returns `B`'s result, the chain `A.parameter[0] → invocation.argument[0] → B.parameter[0] → B.return → invocation.result → A.return` is derivable mechanically, with no step supplied by the query.
2. Two calls to the same callee with different arguments produce distinct flows; the values do not merge.
3. A call to `B` and a call to `C` produce flows whose results cannot cross.
4. Reversing argument order changes the derived result.
5. Named and positional arguments that bind the same way converge on the same derived result.
6. An unresolved callee yields UNKNOWN and an ambiguous one yields AMBIGUOUS. Never a guess. This refusal is why the 11 resolved calls are honest, and it must survive a round whose purpose is to make the graph denser.
7. Every returned path names its supporting PARSED assertions, and retracting one removes the path.
8. `frozen-ir5` still matches, `ir_schema` is still 3, and both corpora still reproduce their IR-5 rows.

**The corpus prediction, stated as the thing I expect and want.** `toml-python` stays fragmented. Value flow is derivable only where a callee resolves, and 11 of 56 calls resolve. The other two blockers, opacity destroying call edges and runtime operations being indistinguishable from unknown names, are untouched. **If the corpus graph becomes substantially connected without those 84 unresolved occurrences being addressed, that is a finding against us and the first question is where the extra knowledge came from.**

**Then E3 is re-run unchanged.** Same ingestion constraints, same graph measurement, no redesign of the experiment after the fact. Its IR-5 result stands in the log as BLOCKED, and whatever the re-run produces becomes its own entry.

## IR-6 Composition, measured, and E3 re-run unchanged, 2026-09-14

Built as a schema and ingestion change. `ir_schema` is still 3, `frozen-ir5` still matches, and both corpora still reproduce their IR-5 rows, which is the proof that no measurement taken before today became incomparable. 53 tests.

**What was added.** Two concept kinds, `invocation` and `value`. Seven relations: HAS_PARAMETER, HAS_RETURN, HAS_INVOCATION, INVOKES, HAS_ARGUMENT, HAS_OUTCOME, FLOWS_TO. Eight new ingestion rules, all mechanical, all auditable to a construct and a file. Values at boundaries only, as bounded before the work: parameters, arguments, call outcomes, returns. No intermediate expression became a concept.

**The central question is answered yes.** Given an already uniquely resolved call, value identity survives the executable boundary using only information the IR-5 encoder had already produced. Nothing in the encoder changed to make that true, which sharpens E3's finding: **IR-5's ingestion discarded compositional semantics the encoder had already captured.** The information was there; nothing was writing it down.

**Hard predictions, all eight passed.**

1. On `chain.py` (a calls b calls c), `a.parameter[0]` reaches `c.parameter[0]` in four steps through parsed assertions, and `c.return` reaches `a.return`. No step supplied by the query.
2. On `twice.py`, two call sites are two invocation concepts with distinct argument values, and `p` reaches one argument while `q` reaches the other. The flows do not merge.
3. On `two_callees.py`, `c.return` does NOT reach `a.return` (c is never called by a) while `b.return` does.
4. On `reversed.py`, `b(q, p)`: `q` reaches b's first parameter and `p` its second, and the crossed pairs are NOT_FOUND.
5. Named against positional binding: not testable on these fixtures without new adapter work, so it is **deferred rather than claimed**; the Python adapter does not yet record keyword arguments, and adding that would be an encoder change this round forbids.
6. An unresolved callee yields UNKNOWN and an ambiguous one AMBIGUOUS. `tz.py` produces unresolved invocations for its standard-library calls, and an INVOKES edge exists only where the callee resolved.
7. A derived path names its supporting assertions; storing the conclusion with `derived_from` set to them and then retracting one removes the conclusion by the store's own rule and makes the path NOT_FOUND. Provenance survives derivation, through the existing machinery.
8. `IR_SCHEMA` is 3 and the frozen encoder matches.

**The searcher was written and frozen before any corpus ground truth existed**, `frozen-e3/derive.ts`, pinned by a test. `derivePath(start, end, {allowedRelations})` knows no application, no language, and no experiment; it returns FOUND with the path and its supporting assertions, NOT_FOUND, UNKNOWN, AMBIGUOUS, or CONTRADICTED. `only()` returns UNKNOWN or AMBIGUOUS rather than choosing.

**A defect found by a control, which is what the controls are for.** The two-flows test reported four invocations for two call sites. Cause: a bind whose value is a call is reported twice by the projection, once as the effect the call has and once as the binding it produces, and both are true of it. Correct in the projection, wrong in ingestion, where one call in the source is one invocation. Sites are now counted per (operation, arguments, path condition) as the larger of the two reports rather than their sum, which leaves a bare call at one, a bound call at one, and two identical calls at two.

**E3 re-run, same ingestion constraints, same measurement, no redesign.**

```
                          toml-python                    ir0-typescript
                       IR-5        IR-6                IR-5        IR-6
assertions              486         979                 372         ~700
CALLS edges              11          12                  15           16
isolated executables     38          38                  40           40
components               45          45                  44           44
longest call chain        2           2                   2            2
invocations               -         114                   -           81
  resolved                -          12                   -           16
  unresolved              -          92                   -           63
  ambiguous               -          10                   -            1
boundary values           -         306                   -          279
FLOWS_TO                  0          60                   0           61
values that flow          -    58 of 306                  -    52 of 279
largest reachability      -     4 values                  -     5 values
PARTICIPATES_IN / FOLLOWS / OBSERVED_IN / TESTED_BY / SATISFIES: 0 everywhere, still
```

**The corpus prediction held, and I wanted it to.** Both corpora stayed exactly as fragmented: 38 and 40 isolated executables, 45 and 44 components, longest call chain still 2. Value flow appeared only where a callee resolves, so 12 resolved calls out of 114 invocations in Python and 16 of 81 in TypeScript. A value can travel at most four or five hops. Nineteen percent of boundary values flow anywhere at all. Nothing became connected that had no right to, and had it done so the first question would have been where the extra knowledge came from.

**What the re-run now names precisely.** 92 of 114 Python invocations are unresolved and 10 ambiguous. The composition machinery works and has almost nothing to work on, because the callees are unresolvable for exactly the two reasons E3 identified and this round deliberately did not touch: opacity destroying call sites (`opaque:loop` is now the single largest unresolved operation at 29 occurrences, up from 16, because IR-6 counts call sites where IR-5 counted calls) and calls into a runtime the store cannot see (`split`, `strip`, `replace`, `filter`, `get`, `set`, `push`, `map`).

So the honest statement of where this leaves the claim: **Understanding now preserves value identity across a resolved executable boundary, mechanically, from parsed evidence, with provenance that survives derivation. It still holds no application-level semantics for either corpus, because 84 percent of invocations have no resolvable callee.** The next two blockers are named and ranked, and neither is the statement opacity rate.

**Terminology, as required:** statement representation coverage, never semantic coverage. E3 demonstrated why they differ, and IR-6 has now demonstrated it twice: an opaque loop destroys call sites, so a single opaque statement can cost an unbounded amount of composition.

## IR-6 confirmed on Windows, 2026-09-14

53 of 53 passing, including the eight composition controls and the frozen-searcher test. Both graph measurements reproduce to the number: `toml-python` 979 assertions, 114 invocations (12 resolved, 92 unresolved, 10 ambiguous), 306 boundary values, 60 FLOWS_TO, 58 of 306 values flowing anywhere, still 38 isolated and 45 components; `ir0-typescript` 810 assertions, 81 invocations (16 resolved, 63 unresolved, 1 ambiguous), 279 values, 61 FLOWS_TO, still 40 isolated and 44 components. All five unwritten channels still zero. And `measure` still reports `reproduces IR-5 of toml-python`, which is the proof that IR-6 left every earlier measurement comparable.

So the answer holds on two platforms: value identity survives a resolved executable boundary from parsed evidence, and neither corpus became any less fragmented.

One line is absent from both Windows graph outputs, `longest directed chain 2 calls deep`, which appears between the components line and the unresolved list on Linux. I verified it from the shipped archive rather than from my working tree: the line is in `scripts/graph.ts` at line 74 and it prints on a clean extraction of `ea91a17a`. So this is the same transcript-rendering loss seen with pair 3 and the two journal tests, now three times, and each time the targeted re-run found the missing thing present. Recorded rather than dismissed, because "the same line is missing twice in one paste" is a weak enough coincidence to be worth one command: `npm run graph -- corpora\toml-python\src | Select-String "longest"` settles it.

## E3-loss, protocol recorded before the work, 2026-09-14

Measurement apparatus only. No IR-7. No encoder change, no resolver change, no opacity fix, no standard-library semantics. The point of this round is to find out which of the three named blockers actually costs the most composition, because the unresolved lists rank operation *names* and an operation name is not a causal classification. `opaque:loop` at 29 looks like the winner in Python; that is a count of a symptom.

**Qualifications recorded, all five accepted.** Do not fix loops yet. Do not build standard-library semantics yet. Do not improve resolution yet. Preserve the UNKNOWN against AMBIGUOUS distinction, which IR-6 tests and which is becoming a real epistemic property of the store. And **E3 is not passed**: it remains blocked at application composition. IR-6 passed a narrower hypothesis extracted from E3's failure, and the log says so wherever it says anything.

**What IR-6 established, stated precisely so it is not overclaimed later.** IR-6 added no computational information to IR-5; it preserved and composed information IR-5 already contained. The evidence is that `measure` still reproduces the IR-5 rows on both corpora and both platforms while the graph gained 114 invocations, 306 boundary values, and 60 flow edges. So:

```
IR-5   language-independent local computational semantics
E3     those semantics do not compose in the store
IR-6   the missing composition was already latent in IR-5 and can be mechanically preserved
       => local semantics + mechanically derivable interprocedural value semantics,
          wherever call identity is known
```

The resolved Python CALLS also moved from 11 to 12, which is the duplicate-call correction doing more precise invocation accounting rather than the application becoming connected.

**What is built.** A classifier over every unresolved and ambiguous invocation, counting occurrences rather than distinct names, into six categories:

- REPRESENTATION_LOSS: the operation was lost inside an opaque construct.
- EXTERNAL_UNMODELED: a known external, runtime, or library operation.
- INTERNAL_UNRESOLVED: a target exists in the corpus but the resolver does not identify it.
- INTERNAL_AMBIGUOUS: several corpus targets remain possible.
- DYNAMIC: the target depends on runtime information not available statically.
- UNKNOWN: insufficient evidence to classify.

And, more importantly than the counts, the **lost composition opportunity** per category: the arguments, outcomes, and potential boundary flows each unresolved invocation prevented, so a category with few occurrences and many arguments is not hidden behind one with many trivial ones.

**Evidentiary honesty during classification.** EXTERNAL_UNMODELED requires knowing that `split` is a string method, which is knowledge from outside the corpus. Every such judgement records its source and its status in the classifier's own output, and the classifier carries no external knowledge that is not declared in one place as data. DYNAMIC will be conservative: an operation is DYNAMIC only when the IR shows the callee itself came from a value, and otherwise it is UNKNOWN rather than guessed.

**Prediction, recorded before the measurement.** Python: REPRESENTATION_LOSS largest by occurrence (the four `opaque:*` operations are 49 of 102), EXTERNAL_UNMODELED second, INTERNAL_AMBIGUOUS small (`__init__`, `get_empty_table`), INTERNAL_UNRESOLVED near zero. But by **lost flow**, I expect EXTERNAL_UNMODELED to be at or above REPRESENTATION_LOSS, because an opaque construct usually loses one pseudo-operation with no argument list, while a `split` or `replace` call loses real arguments and a real outcome. If that holds, the ranking by cost differs from the ranking by count, and the obvious winner was the wrong target.

**One conceptual correction accepted into the record.** What has been demonstrated is fairly called computational semantics: mechanically derivable value identity across differently represented executable boundaries, plus cross-language convergence despite syntactic difference. What has not been demonstrated is whole-application semantic understanding. The boundary between those two claims is now observed rather than argued.

## E3-loss, measured 2026-09-14

Measurement only: nothing in the representation, the encoder, the resolver, or the opacity changed, and both corpora still reproduce their IR-5 rows. 58 tests. `npm run graph` now classifies every unresolved invocation by cause and reports what each cost.

```
toml-python, 102 unresolved invocations of 114
  category              occ    args   lost flows
  EXTERNAL_UNMODELED     28      31        59
  REPRESENTATION_LOSS    49       0        49
  UNKNOWN                15      10        25
  INTERNAL_AMBIGUOUS     10      13        23
  TOTAL                 102      54       156
  flows written 60, flows prevented 156  ->  27.8% of the composition this corpus offers was captured

ir0-typescript, 65 unresolved invocations of 81
  EXTERNAL_UNMODELED     32      41        73
  UNKNOWN                15      17        32
  REPRESENTATION_LOSS    16       0        16
  INTERNAL_AMBIGUOUS      1       2         3
  INTERNAL_UNRESOLVED     1       1         2
  TOTAL                  65      61       126
  flows written 61, flows prevented 126  ->  32.6% captured
```

**My prediction was right, and the reason it matters is that it inverts the obvious target.** By occurrence in Python, REPRESENTATION_LOSS leads at 49 against EXTERNAL_UNMODELED's 28. By cost, that reverses: 59 lost flows against 49. In TypeScript it is not close, 73 against 16. The cause is exactly what I wrote down beforehand: an opaque construct loses a pseudo-operation with **no argument list at all** (0 arguments across 49 occurrences in Python, 0 across 16 in TypeScript), while a `split` or a `filter` loses real arguments and a real outcome. So `opaque:loop` at 29 occurrences, which looked like the obvious winner, is the cheapest kind of loss per occurrence, and fixing loops first would have been chasing the loudest number rather than the largest cost.

**The single most useful number this round produced:** across both corpora, **roughly 70% of the composition the corpus offers is prevented**, 156 of 216 possible flows in Python and 126 of 187 in TypeScript. That is a denominator we have never had. It says the store is not slightly short of application semantics, it is capturing under a third of the value flow that exists in code the encoder can already read.

**UNKNOWN is the finding I did not predict.** 15 occurrences and 25 lost flows in Python, 15 and 32 in TypeScript, and the operations are informative: `fspath`, `TomlDecoder`, `TomlEncoder`, `DynamicInlineTableDict`, `_dict`, `unicode` in Python; `readFileSync`, `writeFileSync`, `setLanguage`, `load`, `visit`, `walk` in TypeScript. Three different things are hiding in one bucket. Constructors of classes the corpus declares (`TomlDecoder`) are *internal* targets the resolver cannot see because a class is not an executable in the store. Node built-ins (`readFileSync`) are external but absent from the declared list. Methods on objects whose type the store does not track (`visit`, `walk`) are the genuinely dynamic ones. So UNKNOWN is not one cause and the next round should split it, and that is a finding about the classifier rather than about the corpora.

**INTERNAL_UNRESOLVED is almost empty**, 0 in Python and 1 in TypeScript. The resolver, as crude as it is, is not the blocker. That closes one of the three candidate targets on evidence.

**Honesty about the borrowed knowledge.** EXTERNAL_UNMODELED rests on a list of 88 built-in operation names declared in one place with its source and its limits, status DECLARED_BY_AUTHOR, not parsed from the corpus and not verified against a specification. A test asserts that every EXTERNAL_UNMODELED record names that source and that no other category rests on anything outside the corpus. If the list is wrong, the EXTERNAL number moves and the UNKNOWN number moves with it, in a direction the log can then state.

**E3 is still blocked.** This round measured why; it did not change it.

## E3-loss confirmed on Windows, 2026-09-14

58 of 58 passing, including the five loss tests. Both cost tables reproduce to the number: Python 102 unresolved, EXTERNAL_UNMODELED 28 occurrences and 59 lost flows against REPRESENTATION_LOSS 49 and 49, 27.8% of the composition captured; TypeScript 65 unresolved, EXTERNAL_UNMODELED 32 and 73 against REPRESENTATION_LOSS 16 and 16, 32.6% captured. Zero arguments across every REPRESENTATION_LOSS occurrence on both platforms, which is the mechanism behind the inversion.

So the ranking by cost differing from the ranking by count is confirmed, not observed once, and the conclusion holds: opacity is the loudest cause and the cheapest one, and loops were the wrong first target.

On the transcript losses: this run's Python output is missing the `FLOWS_TO edges 60` line while the TypeScript output has it, and the `longest directed chain` line that vanished from both outputs in the previous run is present in both here. Different line, different run, no pattern, and the numbers that depend on the missing line (60 flows written, 27.8% captured) appear correctly two lines below it. Fourth instance, consistent with terminal or copy loss and not with the code, and the log stops treating each one as an open question.

## Two corrections to the wording of the E3-loss result, 2026-09-14

Both are corrections to my summary, not to the numbers, and both make the result harder to misread later. Recorded as a new entry rather than by editing the entry above, per this log's rule.

**"Opacity is loud and cheap" was wrong, or at least unsupportable.** It is cheap *to the current loss instrument*, and the reason is circular: a REPRESENTATION_LOSS occurrence exposes zero arguments precisely because the IR has already lost the interior structure, so the instrument cannot see what calls and value flows disappeared inside the opaque construct. The correct statement:

> Among boundary-flow opportunities still visible to IR-6, external unmodeled operations impose the greatest measured composition loss. Representation loss occurs more frequently in Python but exposes zero arguments to the loss instrument, so its full semantic cost cannot yet be measured.

**"Under a third of the value flow present in the code" was wrong.** 216 and 187 are boundary-flow opportunities as IR-6 defines them, not all value flow that exists. The correct statement, which is also the metric to compare against after any future change:

> IR-6 currently captures 27.8% of measured boundary-flow opportunities in the Python corpus and 32.6% in the TypeScript corpus.

Neither figure is a percentage of semantics, and the log should never let it become one.

**The chain of evidence as it stands:**

```
source syntax
  -> language-independent local computational semantics        established
  -> cross-language semantic convergence                       established
  -> evidence-supported conceptual correspondence              established
  -> static boundary-value composition for resolved calls      established
  -> whole-application composition                             BLOCKED
```

## E3-loss-2, the UNKNOWN split: categories frozen before the occurrences are read, 2026-09-14

Classification apparatus only. No encoder change, no ingestion change, no new resolution, no semantic addition. The five categories are fixed here, before I look at a single occurrence, so a definition cannot be shaped to fit what I find:

- **INTERNAL_NONEXECUTABLE**: a declared corpus entity exists, and the current semantic model cannot represent it as a callable target.
- **EXTERNAL_UNMODELED**: an external or runtime target identifiable from declared external evidence, absent from the semantic model.
- **RECEIVER_UNRESOLVED**: the operation belongs to an object or receiver whose identity or type is not statically represented.
- **DYNAMIC**: the target genuinely depends on runtime behaviour that the available static evidence cannot determine.
- **UNKNOWN**: the available evidence does not justify any stronger claim.

**RECEIVER_UNRESOLVED is deliberately separate from DYNAMIC.** `thing.visit()` is not necessarily dynamically unknowable; we may simply have discarded the information needed to know what `thing` is. Calling that DYNAMIC would point the next round at runtime traces when static object or type flow may be the answer.

**Prediction, and it is about my own observation rather than about which category wins.** UNKNOWN shrinks substantially and does not reach zero. The falsifiable claim is that the UNKNOWN bucket really does contain several distinguishable mechanisms; if most occurrences stay UNKNOWN under the frozen definitions, that observation was weaker than it looked and I should say so.

## E3-loss-2, measured 2026-09-14

Classification apparatus only. 62 tests. Both corpora still reproduce their IR-5 rows and the IR-6 graph numbers are unchanged, which is the check that nothing but the classifier moved.

```
toml-python, the same 102 losses and the same 156 lost flows, reclassified
  category                  occ   args   lost flows      (before the split)
  EXTERNAL_UNMODELED         28     31        59          28 / 59
  REPRESENTATION_LOSS        49      0        49          49 / 49
  INTERNAL_AMBIGUOUS         10     13        23          10 / 23
  UNKNOWN                    11      7        18          15 / 25
  INTERNAL_NONEXECUTABLE      4      3         7           new
  RECEIVER_UNRESOLVED         0      0         0           cannot be populated, see below
  DYNAMIC                     0      0         0           cannot be populated, see below
```

**The prediction is scored as partly right, and the part that failed is the more useful half.** UNKNOWN shrank, 15 to 11 occurrences and 25 to 18 lost flows, and did not reach zero. So the bucket did contain a distinguishable mechanism. But only one of the three I claimed was in there could actually be separated on the store's evidence, and that is a smaller result than my observation implied.

- **INTERNAL_NONEXECUTABLE is real and now counted:** 4 occurrences, 7 lost flows, `TomlDecoder`, `TomlEncoder`, `DynamicInlineTableDict`. These are constructor calls on classes the corpus declares. They are internal targets with nothing to resolve to, because **the encoder produces functions and the store has no concept for a class at all.** That absence is the finding; the classification is just how it gets counted instead of hiding in UNKNOWN.
- **RECEIVER_UNRESOLVED cannot be populated, and this is the round's sharpest finding.** The IR-5 encoder records a method call by its property name and discards the receiver: `effectOf` takes `member_expression` and keeps `property`. So the store cannot tell `thing.visit()` from `visit()`, and every such occurrence necessarily falls into UNKNOWN or, if the name happens to be a built-in method, into EXTERNAL_UNMODELED. Separating them requires an encoder change, which this round forbids. The category stays at zero and the instrument says why rather than being filled by a guess.
- **DYNAMIC is zero for the same kind of reason:** it can only be populated where the IR recorded that the callee itself came from a value, and the current adapters never record that.

**A consequence worth stating plainly, because it cuts against an earlier number.** If the receiver is discarded, then EXTERNAL_UNMODELED is not a clean category either: `get`, `set`, `push`, `filter`, `map` were classified as built-in methods on the strength of their names alone, and some of them may be methods on objects of the corpus's own making. So the 59 and 73 lost flows attributed to external operations are an upper bound on external loss and a lower bound on receiver loss, and the two cannot be separated without the encoder keeping the receiver. That is now the first piece of evidence pointing at a specific encoder change rather than at opacity or resolution.

**Two declared sources, both auditable.** 88 built-in operation names and 14 class names, each with its source, its status DECLARED_BY_AUTHOR, and a note saying what it rests on. Tests assert that every EXTERNAL_UNMODELED record names the first, every INTERNAL_NONEXECUTABLE record names the second, and no other category borrows anything. The instrument also prints what it cannot measure alongside every result.

**A test of mine was wrong and I corrected the test.** It asserted that only EXTERNAL_UNMODELED rests on anything outside the corpus. That became false by design when the class list was added, and the rule it was reaching for is the one now asserted: every borrowed claim names its source, and nothing borrows silently.

**Totals unchanged, which is the check that a reclassification reclassifies.** 102 occurrences and 156 lost flows before and after, with occurrences moved between categories and none created.

## E3-loss-2 confirmed on Windows, 2026-09-14

62 of 62 passing, including the four split tests. Both tables reproduce: Python 28/59 external, 49/49 representation, 10/23 ambiguous, 11/18 unknown, 4/7 non-executable, with RECEIVER_UNRESOLVED and DYNAMIC at zero and the three stated limits printed; TypeScript 32/73, 15/32, 16/16, 1/3, 1/2. Totals 102 and 156, and 65 and 126, unchanged from before the split. Both corpora still reproduce their IR-5 rows.

The TypeScript corpus has no INTERNAL_NONEXECUTABLE occurrences, which is correct rather than an omission: the declared class list covers both committed corpora, and `ir0-typescript` constructs nothing. `init` sits in its UNKNOWN list because the TypeScript adapter records `Parser.init()` by its property name, which is the receiver loss stated in the limits, seen from the other side.

**Where the evidence now points, on the numbers rather than on preference.**

```
                          Python            TypeScript
receiver-contaminated     59 + 18 = 77      73 + 32 = 105     upper bound: external, lower bound: receiver
representation loss       49 (unmeasurable interior)   16 (same)
ambiguity                 23                 3
non-executable             7                 0
resolver failure           0                 2
```

The largest measured cost in both corpora is a bucket whose composition cannot be determined without the encoder keeping the receiver, and the second largest is a bucket whose cost cannot be measured at all for the same class of reason. So the next architectural target is not chosen by cost ranking, because the two leading numbers are both bounded by what the instrument cannot see. The honest next question is narrower: **does keeping the receiver make the receiver-versus-external split measurable, and how much of the 77 and 105 turns out to be internal?** That is an encoder change, which means a new encoder version, refreshed frozen copies, new rows in both corpora, and E2-cross re-run against it.

## A correction to my own wording, and two deficiencies named, 2026-09-14

**"Receiver-contaminated 77 / 105" was wrong and I withdraw it.** Those are not measured receiver losses. The instrument says it cannot tell `thing.visit()` from `visit()`, so nothing about how much of either bucket belongs to receivers has been measured. The correct term is **receiver-sensitive pools**: EXTERNAL_UNMODELED and UNKNOWN are contaminated by lost receiver identity, and the size of the contamination is unknown. I had converted a bound into a quantity two entries above, which is the same error as calling boundary-flow opportunities "value flow present in the code", and the log now says so in both places.

**The deeper finding, which is not a classification problem.**

```
source   parser.init()
IR-5     call("init", args)
lost     parser
```

The statement is represented. It counts toward statement representation coverage. And part of its computational meaning is gone: the operation survives and the entity the operation acts on does not. That is different in kind from opacity, where we know information disappeared because the construct was unrepresented. So:

> **Represented does not mean semantically lossless.** IR-5's 86.4% Python statement representation coverage tells us even less about semantic preservation than E3 originally showed.

**Two distinct deficiencies, to be fixed one at a time.**

```
ENTITY PRESERVATION      a class exists in source; class identity is absent from the representation
RECEIVER PRESERVATION    object.method() exists; the method survives; the object identity disappears
```

They are related and they are not the same, and fixing both at once would make any improvement in application composition unattributable. Entity preservation is explicitly out of the next round.

## IR-7 Receiver, protocol and predictions frozen before implementation, 2026-09-14

The first deliberate change to what the encoder knows since IR-5, so the ceremony is full: new encoder versions, `frozen-ir5` kept, new frozen copies, E1 and E2 re-run, new rows in both corpora, then the loss classifier re-run.

**The one question this round answers.** Does preserving receiver identity allow the previously inseparable external-versus-receiver loss pools to be separated mechanically?

**What is preserved, and what is not.** The receiver becomes an operand of a member invocation, as parsed evidence:

```
thing.visit(x)   ->   call(receiver = thing, operation = visit, args = [x])
```

and never

```
call(receiver_type = Visitor, operation = visit, ...)
```

The first is in the source. The second requires inference we have not earned. **The receiver is not used to improve resolution in this round.** Information is preserved and deliberately not consumed, so that any later improvement in connectivity is attributable to the round that consumes it rather than to this one.

**Predictions, frozen here.**

1. Both adapters' encoder versions change, and the IR-5 frozen copies remain available.
2. Corpus statement counts need not change, and **fingerprint stability is not predicted**: intrinsic fingerprints involving member calls may change, because computational information has changed. A fingerprint change here is expected and must be explained, not defended.
3. E1 and E2 cross-language controls continue to pass, or any change is explained as a consequence of receiver preservation rather than silently accepted.
4. **RECEIVER_UNRESOLVED becomes non-zero in at least one corpus.** If it stays zero, the hypothesis that receiver loss explains part of the current pool is falsified.
5. EXTERNAL_UNMODELED + UNKNOWN + RECEIVER_UNRESOLVED preserves the relevant invocation total. Classification moves; invocations do not disappear.
6. **FLOWS_TO, CALLS resolution, and E3 connectivity do not improve**, because this round preserves information and does not consume it. An improvement would mean the receiver leaked into resolution and the measurement is void.
7. INTERNAL_NONEXECUTABLE is unchanged. Classes are outside this experiment.
8. A fixture proves `a.visit(x)` and `b.visit(x)` keep distinct receiver identities despite identical operation names and arguments.
9. A fixture proves `visit(x)` stays receiverless. No receiver is manufactured.
10. Provenance reaches the receiver back to its source construct, like every other PARSED assertion.
11. Cross-language control: `thing.visit(x)` in Python and in TypeScript preserve equivalent receiver structure despite the grammars differing.

Then the loss classifier is re-run **without using receiver information to resolve anything**, and we see how much of the receiver-sensitive pools moves into RECEIVER_UNRESOLVED. Only that number decides whether IR-8 is object and type flow, external semantic identity, or something else.

Two languages independently pointed at the same missing primitive: Python's `_dict`, `write`, `isoformat` and TypeScript's `init`, `setLanguage`, `visit`, `walk` are the same loss in two grammars. The build forced this change rather than a design preference choosing it.

## IR-7 Receiver, measured 2026-09-14

67 tests. `frozen-ir7` established, `frozen-ir4` and `frozen-ir5` kept, `ir_schema` 4, encoders `python-adapter/0.3` and `typescript-adapter/0.2`. A member call now keeps the entity it acts on, as parsed, and the receiver is **not** used for resolution.

```
                        toml-python                ir0-typescript
                     IR-6        IR-7            IR-6        IR-7
RECEIVER_UNRESOLVED     0    31 / 61 lost           0    36 / 79 lost
EXTERNAL_UNMODELED     28 / 59   4 / 8            32 / 73    0 / 0
UNKNOWN                11 / 18   4 / 8            15 / 32   11 / 26
REPRESENTATION_LOSS    49 / 49  49 / 49            16 / 16   16 / 16
INTERNAL_AMBIGUOUS     10 / 23  10 / 23             1 / 3     1 / 3
INTERNAL_NONEXECUTABLE  4 / 7    4 / 7              0 / 0     0 / 0
INTERNAL_UNRESOLVED     0        0                  1 / 2     1 / 2
TOTAL                 102 / 156 102 / 156          65 / 126  65 / 126
invocations            114      114                81        81
CALLS resolved          12       12                16        16
boundary values        306      355               279       325
FLOWS_TO                60       69                61        65
```

**Predictions, scored.**

1. Encoder versions changed, IR-5's frozen copies kept, and a test asserts `frozen-ir5` and `frozen-ir7` differ so the freeze cannot be an accidental copy. Passed.
2. Statement counts, function counts, and opacity unchanged; **collision fingerprints changed** for functions containing member calls, exactly as the protocol said not to predict stable. New rows appended to both corpora with the new fingerprints and a note; no row edited. Passed.
3. **E1/E2: pair 1 now DIFFERS, and that is the finding of the round.** Under IR-5 the Python `publish("ACCOUNT_CLOSED")` and the TypeScript `await events.publish(AccountEvents.Closed)` projected identically. They are not the same program at the call site: one calls a module-level function, the other a method on an entity. IR-5's match was partly the encoder being blind to the receiver. **The fixture was not edited to make it pass.** Its outcome is now recorded as a difference, with an assertion that the Python call has no receiver and the TypeScript one does, and a new `pair 1b` compares two programs that genuinely agree at the call site and still converges. Pairs A, C match; B, D differ; everything else unchanged.
4. **RECEIVER_UNRESOLVED became non-zero in both corpora: 31 occurrences and 61 lost flows in Python, 36 and 79 in TypeScript.** The hypothesis is not falsified.
5. Totals preserved exactly: 102 and 156, 65 and 126. Classification moved; no invocation disappeared. Passed.
6. **CALLS resolution and connectivity did not improve:** 12 and 16 resolved, unchanged, and E3 connectivity untouched. Boundary values and FLOWS_TO rose (306 to 355, 60 to 69) because the receiver is itself a boundary value and a parameter used as a receiver is a flow; that is preservation, not consumption. Passed.
7. INTERNAL_NONEXECUTABLE unchanged at 4 and 0. Passed.
8. `a.visit(x)` and `b.visit(x)` keep distinct receivers, parameters 0 and 1, with identical operation and argument. Passed.
9. `visit(x)` stays receiverless in both languages. Passed.
10. Every receiver assertion is PARSED, carries rule `receiver-from-member-call`, its file, the construct "the entity the operation acts on", and position -1 so it is not mistaken for an argument. Passed.
11. `thing.visit(x)` in Python and TypeScript produce identical projections and one fingerprint. Passed.

**The answer to the round's question: yes, and the pools separate almost completely.** In TypeScript EXTERNAL_UNMODELED fell from 32 occurrences to **zero**: every one of `filter`, `map`, `get`, `set`, `push` was a method on an entity, and naming it a runtime operation had been an artefact of the receiver being discarded. In Python it fell from 28 to 4, so 24 of the 28 were receivers too. What remains in EXTERNAL_UNMODELED is the small residue of genuinely bare built-in calls, `str`, `list`, `len`. So the earlier claim that external operations were the largest measured cost was wrong in attribution, and the correction is large: **the largest measured cost in both corpora is the receiver, not the runtime.**

**Two defects found while building, both by measurement rather than by reading.** The receiver was dropped twice on the way through: `expression()` rebuilt a call from `effectOf` without it, so a bound call lost its receiver, and `project()` built the effect half of a bound call without it, so ingestion saw two call sites where the source had one. The first showed up as 11 receivers where there should have been dozens; the second as a key mismatch in the site deduplication. Both fixed in the encoder, which is inside this round's scope.

**What still cannot be measured.** DYNAMIC stays zero: no adapter records a callee that itself came from a value. And RECEIVER_UNRESOLVED does not distinguish a receiver of the corpus's own making from a runtime object, because that needs type or object flow, which this round deliberately does not have. So the 61 and 79 are the size of the receiver problem, not its composition, and that is the next question rather than this one's answer.

## IR-7 confirmed on Windows, 2026-09-14

67 of 67 passing, including the four receiver fixtures, the pair-1 finding, and pair 1b. Both cost tables reproduce exactly: Python RECEIVER_UNRESOLVED 31 occurrences and 61 lost flows with EXTERNAL_UNMODELED down to 4; TypeScript 36 and 79 with EXTERNAL_UNMODELED at zero. CALLS resolution unchanged at 12 and 16, connectivity unchanged at 38 and 40 isolated, `ir_schema 4`, encoders `python-adapter/0.3` and `typescript-adapter/0.2`, both corpora reproducing their IR-7 rows. Both rows now confirmed on linux and windows.

One number moved that I did not call out and should have: **the captured share of boundary-flow opportunities rose from 27.8% to 30.7% in Python** (69 flows written against the same 156 prevented), and from 32.6% to about 34% in TypeScript. That is not resolution improving. It is the receiver being a boundary value in its own right, so a parameter used as a receiver is a flow that now exists. Preservation, not consumption, and the denominator is unchanged, which is why the percentage moves without any callee resolving.

The TypeScript UNKNOWN list is the most informative thing left on the page: `visit`, `walk`, `readFileSync`, `writeFileSync`, `appendFileSync`, `super`, `lookup`. Those are bare calls to names the corpus does not declare and the built-in list does not contain, which is exactly what UNKNOWN is for, and three of them are Node built-ins that would move to EXTERNAL_UNMODELED if the declared list covered Node rather than only the language. That is a limitation of the declared knowledge, not of the store, and it is worth stating before anyone reads 26 lost flows as mystery.

## Three corrections, and the pair-1 result stated properly, 2026-09-14

**"The receiver is the target" was wrong.** Receiver preservation is done; the receiver is no longer missing. What is missing is the answer to a different question: given a preserved receiver, *what is it?* Calling the next step "type flow" also narrows the architecture prematurely, because four different programs raise four different needs:

```
x = Parser()          a type would answer it
x = make_parser()     return-value identity would answer it
x = config.parser     member or value flow would answer it
def use(x): x.init()  parameter flow from callers would answer it
```

Three of those four are things IR-6 already built machinery for. So the risk is building a conventional static type analyser when what Understanding may need is semantic entity identity flowing through values it already tracks.

**The pair-1 result belongs in the log prominently, because it falsifies an earlier success of ours.** IR-5 reported that the Python `publish(...)` and the TypeScript `events.publish(...)` converged. IR-7 reports that they do not, and the fixture did not change: the instrument got less blind. So:

> **Some cross-language semantic equivalences reported by IR-5 were false positives caused by information loss.**

That is a better-founded representation invalidating one of our own positive results, with the original fixture kept, its new outcome asserted, and a genuinely equivalent pair added beside it that still converges.

**The output label is stale.** `composition (IR-6)` prints under an IR-7 encoder. Renamed to `boundary composition`, which will not rot as versions move.

## E3-origin, protocol and prediction frozen before the work, 2026-09-14

Apparatus only. IR-7 frozen. **No encoder change, no type inference, no receiver-based call resolution.** The question is deliberately about origin rather than type:

> How often can the existing IR-7 information already establish the semantic origin of a preserved receiver, with no new inference?

Because the first question is not whether the store knows `x` is a `Parser`. It is whether the store knows that the `x` used here is the same semantic value that came from somewhere else, which is the principle IR-6 established across function boundaries, now asked on the receiver side.

Categories, frozen before any occurrence is read:

- **PARAMETER**: the receiver is a parameter of the executable.
- **LOCAL_BINDING**: the receiver came from a local binding.
- **CALL_OUTCOME**: the receiver came from another invocation.
- **MEMBER_VALUE**: the receiver came from a member access.
- **MODULE_OR_IMPORTED**: the receiver refers to module or import identity, where that is preserved.
- **LITERAL_OR_CONSTRUCTED**: a directly created value, where mechanically visible.
- **UNRESOLVED**: the origin cannot be established from IR-7. This stays legitimate and is not to be squeezed toward zero.

**Hard prediction.** A non-zero subset of the 67 preserved receiver occurrences (31 Python, 36 TypeScript) has an origin mechanically traceable through existing IR-7 value information, without type inference or runtime evidence. If it comes back zero, receiver identity exists only as a terminal label and object or type flow is a much larger job than it currently sounds. If it comes back substantial, the next architecture may not be type flow at all, but an extension of the value-identity graph already built so that receiver values participate in it.

**Noted limit, carried forward:** TypeScript's remaining UNKNOWN contains Node runtime names (`readFileSync`, `writeFileSync`, `appendFileSync`), so its 26 lost flows are not all mysterious static-analysis failures. That is an acknowledged gap in the declared external-knowledge set, which covers the two languages and not their runtimes.

## E3-origin, measured 2026-09-14

Apparatus only. IR-7 untouched (`frozen-ir7` matches, `ir_schema` 4, both corpora still reproduce their IR-7 rows), no type inference, no receiver-based resolution, and the classifier appends nothing to the store, which a test asserts. 73 tests.

```
                         toml-python        ir0-typescript
receivers preserved           49                 46
  UNRESOLVED                  27                 24
  PARAMETER                    9 (9 in a flow)    4 (4 in a flow)
  LOCAL_BINDING                9                  5
  MEMBER_VALUE                 1                 13
  LITERAL_OR_CONSTRUCTED       3                  0
  MODULE_OR_IMPORTED           0                  0   cannot be populated
traceable origins             22 of 49           22 of 46
backward steps followed       max 2, total 11    max 1, total 4
```

(The receiver counts here, 49 and 46, are receiver *values* in the store and exceed the 31 and 36 RECEIVER_UNRESOLVED invocations, because a resolved call can also have a receiver and a receiver value exists whether or not the callee resolved.)

**The prediction passed: 22 of 49 and 22 of 46 receivers have an origin mechanically traceable through information IR-7 already holds.** So receiver identity is not a terminal label, and roughly 45 percent of it already participates in the value structure the store has. That is the result that makes the next step a question about extending the existing value-identity graph rather than about building a type analyser.

**The traceable half splits in an informative way, and the two languages differ.** Python's traceable receivers are mostly PARAMETER (9, every one of them actually joined by a flow edge) and LOCAL_BINDING (9). TypeScript's are mostly MEMBER_VALUE (13), with only 4 parameters. That is a real difference between the corpora rather than an artefact: `toml` passes objects into functions and calls methods on them, while this repository reads a field and calls a method on what it finds (`this.something.method()`), which the store records as a read.

**Only the PARAMETER receivers are actually in a flow**, 9 of 9 in Python and 4 of 4 in TypeScript, and nothing else is. That is the sharpest finding of the round and it is about ingestion rather than the encoder: LOCAL_BINDING and MEMBER_VALUE origins are read off the operand kind the encoder recorded, and **ingestion writes no flow edge from a binding to its use as a receiver**, so those receivers are labelled but not connected. The information exists in the IR; the graph does not carry it. That is the same class of finding as E3 itself, one level down.

**What UNRESOLVED actually contains**, which matters because it is the largest bucket in both:

```
toml-python   27 unresolved: 16 recorded as `computed`, 11 as `unknown`
ir0-typescript 24 unresolved: 10 `computed`, 14 `unknown`
```

`computed` means the receiver is itself the result of an expression, most often a chained call (`s.strip().split(...)`), so the origin is another invocation whose outcome the store has but which ingestion did not join to this receiver. `unknown` means a free name the encoder could not bind to a parameter or a local, which is where imports and module-level names land. So UNRESOLVED is two mechanisms, not one, and neither needs a type system: the first needs a flow edge from an outcome to a receiver, the second needs module and import identity, which the limits section already says the store cannot express.

**Stated limits, printed with every result.** MODULE_OR_IMPORTED cannot be populated, because the encoder records an imported name as a free name rather than as the module it came from. An origin is not a type: PARAMETER says the identity arrives from the caller and says nothing about what the caller passed. LOCAL_BINDING and MEMBER_VALUE are read from the operand kind rather than followed through the graph, for the reason above.

**So the next missing primitive is not "type flow".** On this evidence it is three smaller things, in the order the numbers rank them: a flow edge from a call outcome to a receiver use (26 occurrences across both corpora), a flow edge from a binding to a receiver use (14), and module or import identity (25). Two of those three are extensions of machinery IR-6 already built. Only after they are in place does the question of what a receiver *is*, as opposed to where it came from, become the blocker.

**One label corrected:** the graph output said `composition (IR-6)` under an IR-7 encoder and now says `boundary composition`, which will not rot as versions move.

## E3-origin confirmed on Windows, 2026-09-14

73 of 73 passing, including the six origin tests and the one that asserts the classifier appends nothing. Both origin tables reproduce exactly: Python 49 receivers, 22 traceable, UNRESOLVED 27, PARAMETER 9 with all 9 in a flow, LOCAL_BINDING 9, LITERAL_OR_CONSTRUCTED 3, MEMBER_VALUE 1, backward steps max 2 and total 11; TypeScript 46 receivers, 22 traceable, UNRESOLVED 24, MEMBER_VALUE 13, LOCAL_BINDING 5, PARAMETER 4 with all 4 in a flow, steps max 1 and total 4. MODULE_OR_IMPORTED zero in both, with its limit printed.

So the prediction is confirmed on two platforms: **22 of 49 and 22 of 46 receivers have an origin mechanically traceable through information IR-7 already holds**, and receiver identity is therefore not a terminal label. The two corpora differ in the same way on both machines, `toml` through parameters and bindings, this repository through member reads, which is a property of how the two projects are written rather than of the platform.

The TypeScript captured share also reads 34.0% here, which is the figure I gave as "about 34" and is now exact: 65 flows written against 126 prevented.

One line in the Python output is truncated mid-sentence, "So EXTERNAL_UNMODELE" then "hich this round does not have", where the TypeScript output prints the same limit whole. Fifth instance of a transcript line loss, and the first that mangles a line rather than dropping it; the text is one string constant printed identically in both runs, so it is the terminal or the copy again. Recorded and not chased.

## Two corrections, and the three-level boundary, 2026-09-14

**"The next missing primitives" was wrong for two of the three.** A call outcome reaching a receiver use and a binding reaching a receiver use are not new semantic primitives. They are missing *applications* of FLOWS_TO, which the store already has and which already says exactly that. No new relation should be created where the existing one means the thing.

**And I combined `computed` with "call outcome" without evidence.** I wrote "26 call-outcome to receiver opportunities". What the apparatus established is that 26 receivers are recorded as computed expressions. Whether their producer is an invocation is not measured, and writing a flow edge on that reading would turn an observation into an assumption. That is exactly the error the protocols exist to prevent, and I made it in a summary sentence.

**The result has three levels, and the boundary between them is clean:**

```
receiver preserved                          95 (49 Python, 46 TypeScript)   IR-7 solved this
receiver origin recognisable                44 of 95                        E3-origin measured this
receiver identity connected to value graph  13 of 95 (9 Python, 4 TypeScript, all parameters)
```

**And the pattern has now happened twice, which makes it a pattern rather than a defect:**

```
E3          the encoder had call information;            the store discarded composition
E3-origin   the encoder has receiver-origin information; the store discards local composition
```

**Architectural reading, revised.** We have been asking whether Understanding needs a type system. The evidence says not yet. What it appears to need is a generalised value-identity graph, in which a value keeps its identity as it moves through parameter, local binding, call argument, callee parameter, member read, call receiver, call outcome, and return. Some of those edges exist; others do not. Type can later become *evidence about* a value rather than the thing that defines its identity. Every experiment since E3 has pushed the missing boundary further toward ordinary value continuity and never toward types.

**Imports wait a round, deliberately.** MODULE_OR_IMPORTED cannot be populated because the encoder records an imported name as a free name, which is a genuine encoder preservation gap of the same kind receivers were before IR-7. Mixing an encoder change for imports with an ingestion change for value flow would cost causal attribution again, and that has already been paid for once.

## E3-origin-producer, protocol and prediction frozen before the work, 2026-09-14

Measurement only. **No FLOWS_TO added.** IR-7 frozen. The question: for the receivers whose origin is recognisable but unconnected, and for the computed ones, is the *producer* mechanically identifiable in what IR-7 already holds?

Reported per group, with these outcomes and no others:

```
LOCAL_BINDING    total, producer identifiable, producer unavailable, producer ambiguous
MEMBER_VALUE     total, producer identifiable, producer unavailable, producer ambiguous
COMPUTED         total, invocation producer identifiable, other producer identifiable,
                 producer unavailable, producer ambiguous
```

MEMBER_VALUE is kept separate for a reason worth preserving: knowing that `x` came from `obj.field` is knowing the producer *expression*, not the identity of the entity stored in the field. Producer known and produced entity unknown are different states.

**Hard prediction, deliberately weak.** At least one non-parameter receiver in each corpus has a mechanically identifiable producer in the existing IR-7 representation. If that fails, IR-8 is not built: it would mean "origin" was weaker than the classifier's structure suggested. If it passes, the producer forms ingestion is allowed to connect get frozen, and IR-8 tests whether value continuity increases without inventing identity.

Sequence from here, fixed now: this apparatus round, then IR-8 value continuity using the existing FLOWS_TO and only where a producer is mechanically established, then E3 re-run unchanged, then measure what receiver loss remains, and only then consider import identity as an IR-9 candidate.

We still have not earned type inference.

## E3-origin-producer, measured 2026-09-14

Measurement only. No FLOWS_TO written, IR-7 frozen, both corpora still reproduce their IR-7 rows. 78 tests.

```
toml-python, 71 receiver operands
  group           total  identifiable  ambiguous  unavailable   invocation / other
  LOCAL_BINDING      16            16          0            0          13 / 3
  MEMBER_VALUE        2             2          0            0           0 / 2
  COMPUTED           21            21          0            0           9 / 12

ir0-typescript, 55 receiver operands
  LOCAL_BINDING       8             8          0            0           4 / 4
  MEMBER_VALUE       13            13          0            0           0 / 13
  COMPUTED           10            10          0            0          10 / 0
```

**The prediction passed, and by more than it needed to: every producer in both corpora is identifiable, with none ambiguous and none unavailable.** 39 of 39 in Python across the three groups, 31 of 31 in TypeScript. So the producer of a non-parameter receiver is not merely sometimes present in IR-7; on these two corpora it is always present, and the store simply does not join it.

**And the correction I was told to make turns out to matter.** I had written "26 call-outcome to receiver opportunities" from the fact that 26 receivers were recorded as computed. Measured properly, the computed receivers split: **9 of 21 in Python have an invocation producer and 12 do not** (they are member reads, arithmetic, indexes and ternaries), while **10 of 10 in TypeScript are invocations**. So "computed means chained call" was right for TypeScript and wrong for more than half of Python. Had IR-8 been built on my sentence it would have written flow edges from invocation outcomes for twelve Python receivers that have no invocation behind them.

**The invocation-versus-other split across all groups**, which is what IR-8 would have to handle:

```
                          Python    TypeScript
producer is an invocation      22            14
producer is something else     15            17
```

So roughly half of what IR-8 would connect comes from an invocation outcome and half from a binding, a member read, or an expression. A design that only joined call outcomes to receivers would capture about 60 percent of the Python opportunity and 45 percent of the TypeScript.

**MEMBER_VALUE behaves as the protocol anticipated.** Every one is identifiable as an expression and none tells us what is stored in the field, and each record says so in its own sentence. Producer known and produced entity unknown is preserved as a distinct state rather than collapsed into "known".

**The receiver counts here (71 and 55) exceed E3-origin's (49 and 46)** because this instrument reads the IR directly, per function, and counts every receiver operand including those on resolved calls and those inside expressions the store does not hold as invocations. That is stated rather than reconciled away: the two instruments count different things, and the reason they differ is the same absence both are measuring.

**Ambiguous and unavailable were tested rather than assumed empty.** Both are unreachable from the two corpora, so a synthetic fixture constructs a value bound twice and a receiver with no binding, and the classifier returns AMBIGUOUS and UNAVAILABLE respectively. A category that is empty because the data lacks it must still be shown to work.

**What this licenses, and what it does not.** IR-8 may connect a receiver to its producer wherever the producer is mechanically established, and on this evidence that is everywhere in both corpora. It may not treat a computed receiver as an invocation outcome without checking, because 12 of 21 Python cases are not. And it still licenses nothing about types: every finding since E3 has pushed the boundary further toward ordinary value continuity.

## E3-origin-producer confirmed on Windows, 2026-09-14

78 of 78 passing, including the synthetic ambiguous and unavailable cases. Both producer tables reproduce exactly: Python LOCAL_BINDING 16 all identifiable with 13 invocation producers, MEMBER_VALUE 2, COMPUTED 21 with 9 invocations and 12 not; TypeScript LOCAL_BINDING 8 with 4 invocations, MEMBER_VALUE 13 with none, COMPUTED 10 all invocations. Zero ambiguous and zero unavailable in both corpora on both platforms.

So the finding holds: on these corpora the producer of a non-parameter receiver is always present in IR-7, and the store does not join it. Third instance of the same pattern.

The line-loss count is now six: the Python origin table here omits `backward steps followed  max 2, total 11`, which the TypeScript table prints. Same string, same run, one dropped. Noted and not chased.

## Corrections carried forward, and IR-8 Value Continuity frozen before the work, 2026-09-14

**Denominator attached permanently.** "Every producer is identifiable" means every producer in the three measurable receiver groups, LOCAL_BINDING, MEMBER_VALUE, and COMPUTED. It excludes free-name receivers, which sit outside producer analysis because their producer may be an import or a module-level entity IR-7 does not preserve. The instrument says this; my summary should have too.

**"Producer" defined, and its limit kept.** A producer is the expression that created the value used as the receiver. In `account = find_account(); account.close()` the producer is `find_account()`. In `account = customer.account; account.close()` the producer expression is `customer.account`, and the semantic identity of whatever was stored in that member remains unknown. Producer known, produced entity unknown, is a state the report keeps.

**One correction to my own arithmetic.** I wrote "15 and 17" for the non-invocation producers, adding across groups. The tables are Python 13/3, 0/2, 9/12 and TypeScript 4/4, 0/13, 10/0, so the correct totals are Python 22 invocation and 17 other, TypeScript 14 invocation and 17 other. The earlier sentence had Python's other count wrong by two.

**The rule that governs IR-8, and it is a limit on FLOWS_TO rather than a licence.** FLOWS_TO connects semantic boundary values, and its meaning must not quietly become "this expression syntactically produced that one". So:

> **IR-8 may write FLOWS_TO only where the existing IR mechanically establishes value identity between the producer's value or outcome and the receiver value.**

An identifiable producer expression is therefore necessary and not sufficient. The 17 and 17 non-invocation cases are not forced into flow because their producer is nameable.

**Why the computed correction mattered, stated for the record.** Python has 21 computed receivers and 9 invocation producers; TypeScript has 10 and 10. Accepting "computed receiver equals call outcome" would have injected false semantics into 12 of 21 Python cases, 57 percent, and **a TypeScript-only experiment would have reported the bad rule as perfect.** That is the strongest argument yet for keeping independently developed corpora in two languages, and it is the reason this project has two.

**The working prior, now experimentally earned rather than preferred:** three successive failures first attributed to missing semantic representation turned out to be semantic information already present in the representation and not composed by ingestion. When Understanding cannot derive something, first test whether the representation already contains the facts, and only then expand the representation.

### IR-8 Value Continuity: scope and predictions

Ingestion only. **No encoder change, no new semantic relation, no type inference, no import modelling, no receiver-based call resolution.** It extends ingestion so existing FLOWS_TO preserves mechanically established value identity through local production and receiver use.

Predictions, frozen here:

1. FLOWS_TO increases in both corpora.
2. More non-parameter receivers participate in a value-flow path in both corpora.
3. Resolved CALLS stays exactly 12 Python and 16 TypeScript.
4. Isolated executables stay exactly 38 and 40, because no additional call is resolved.
5. Encoder version, `ir_schema`, statement counts, opacity, and intrinsic fingerprints all unchanged; both corpora still reproduce their IR-7 rows.
6. E1, E2, IR-6, and IR-7 controls continue to pass unchanged.
7. LOCAL_BINDING, MEMBER_VALUE, and COMPUTED are handled by their actual producer form, never by their classifier label.
8. An invocation outcome flows into a receiver only where that invocation is mechanically identified as its producer.
9. A non-invocation producer is never converted into an invocation outcome.
10. An ambiguous or unavailable producer creates no flow edge.
11. Every new FLOWS_TO carries provenance to the PARSED assertions and source constructs establishing the identity, and retraction destroys the derived continuity.
12. **E3 remains blocked** unless its original application-level criterion actually passes. Increased local value continuity alone does not count.

Negative control required:

```
x = make_a()
x = make_b()
x.run()
```

IR-8 must not choose which producer reaches `x.run()` merely because both are syntactically available. The producer apparatus already reports that as AMBIGUOUS, and IR-8 must respect it.

## IR-8 Value Continuity, measured 2026-09-14

Ingestion only. 82 tests. `frozen-ir7` matches, `ir_schema` still 4, encoders unchanged, statement counts and opacity unchanged, and both corpora still reproduce their IR-7 rows, so no earlier measurement moved.

```
                        toml-python            ir0-typescript
                     IR-7        IR-8        IR-7        IR-8
FLOWS_TO               69          75          65          67
values that flow    65/355      71/355      54/325      56/325
captured share      30.7%       32.5%       34.0%       34.7%
CALLS resolved         12          12          16          16
isolated               38          38          40          40
components             45          45          44          44
```

**Predictions, scored.**

1. FLOWS_TO increases in both: passed, 69 to 75 and 65 to 67.
2. More non-parameter receivers in a flow path: passed. Python's origin table moves 5 receivers out of LOCAL_BINDING into CALL_OUTCOME, all of them now in a flow; TypeScript moves 1.
3. Resolved CALLS exactly 12 and 16: passed.
4. Isolated executables exactly 38 and 40: passed. Components unchanged at 45 and 44.
5. Encoder, schema, statements, opacity, fingerprints unchanged; both corpora reproduce their IR-7 rows: passed.
6. Every earlier control passes unchanged: passed, 82 tests with nothing rewritten except as noted below.
7. Handled by producer form rather than classifier label: passed. The rule reads the operand the encoder recorded and the expression bound to it, never the origin category.
8. An invocation outcome flows in only where that invocation is its producer: passed, matched on the call site's own identity.
9. A non-invocation producer is never converted: passed, with a fixture where the producers are a member read and arithmetic and no invocation-outcome edge is written.
10. Ambiguous or unavailable producers create no edge: passed.
11. Provenance and retraction: passed. Every new edge carries `derived_from` naming the outcome and receiver assertions, and retracting one removes the edge by the store's own rule.
12. **E3 remains blocked.** Local value continuity rose and application-level composition did not: 12 resolved calls, 38 isolated executables, the same 45 components. Increased continuity does not count, and it is recorded as not counting.

**The increase is small, and the reason is worth more than the number.** 6 edges in Python and 2 in TypeScript, against 37 and 25 receiver candidates. The limiter is the rule itself: an edge requires a boundary value in the store to flow *from*, and only a call has one, because only a call produces an outcome concept. A receiver produced by a member read, arithmetic, an index, or a ternary has an identifiable producer expression and **no boundary value at either end**, so writing an edge would mean inventing a value concept for an expression, which is the intermediate-expression bound IR-6 set deliberately. 15 of 37 Python candidates and 1 of 25 TypeScript are rejected for exactly that.

So the honest statement: **producer identifiable is not producer flowable.** E3-origin-producer measured the first and I let the summary imply the second. The gap between them is the intermediate-value bound, and crossing it is a decision about whether expressions become concepts, not an ingestion fix.

**A defect found by the measurement, not by reading.** My first implementation read `j.liveAssertions()` while the ingestion transaction was still open. Events are applied at commit, so it saw nothing and wrote zero edges while reporting success. Fixed by collecting what the pass needs as pass 2 writes it. Had FLOWS_TO not been checked against the previous number, this would have shipped as "IR-8 complete, no change observed."

**And a second, which was my shortcut rather than the design's.** The producer was looked up by operation *name*, so a function calling one operation twice could never establish identity; that rejected 22 of 37 Python candidates and 24 of 25 TypeScript. The call site's own identity (operation, arguments, receiver) is what pass 2 already deduplicates on and is precise, so the lookup now uses it. This is the implementation being made to match the frozen rule, not the rule being loosened to reach a number.

**The required negative control did not fire, and that is a finding.** `x = make_a(); x = make_b(); x.run()` creates no ambiguity in this representation: the encoder gives each binding its own positional value id, so the receiver names value 1 and its single producer is `make_b()`, which is what the program does. IR-8 cannot choose between two producers because the IR already recorded which binding the receiver refers to. The control now asserts that single correct edge and says why, and genuine ambiguity, one value id bound twice, is tested on the synthetic fixture where the classifier reports AMBIGUOUS and no edge is written.

## The goal, stated, and what it changes, 2026-09-14

**The long-term goal.** Separate the semantic meaning of an application from its implementation. Today source code does two jobs at once: it is the best available description of what the application means, and it is the instructions a machine runs. The architecture being investigated inverts that: human intent, then a semantic application model, then an implementation chosen for current constraints. If it works, source becomes a rendering of the model rather than the authority, and the asset is the model.

**The near case is Python to IR to TypeScript.** Perl to C shows the eventual power and would fail for reasons that teach nothing yet, because too many language and runtime differences move at once. Python and TypeScript are close enough that a failure is about the model rather than about the runtimes.

**"Thread" means** a connected path of work through the application: the values, transformations, calls, decisions, and effects that together produce some behaviour. Not an OS thread.

**The product requirement, adopted as the north star sentence:**

> For any thread, sufficiency means that no semantically relevant fact required to produce an equivalent implementation must be recovered from the original source or invented by the emitter.

**The practical question the checker answers:** if the source for this thread were deleted now, what would have to be invented to recreate it? The eventual answer is nothing.

**Coverage stops being the product metric; sufficiency becomes it.** "87 percent of statements represented" says little, because if the missing fraction contains one fact a thread needs, that thread is not sufficient. Coverage stays as a diagnostic and is no longer the headline.

**E4 is demoted from "the test that matters" to the first regeneration test.** The real target is bidirectional:

```
Python source -> Model A -> TypeScript -> Model B,  with Model A equivalent to Model B
```

Passing independent behavioural tests shows the TypeScript works. Inverting it to a model equivalent to the one extracted from Python shows meaning survived a change of implementation language, which is a much stronger claim than successful transpilation.

**The development loop from here:** pick a thread, measure the missing semantics, implement the missing representation or composition, repeat until sufficient, then delete the source from the generation side, render mechanically, run independent behavioural tests, invert the result, and compare models.

## E5-sufficiency, protocol and predictions frozen before any build, 2026-09-14

Measurement only. No encoder change, no ingestion change, no emitter, no new relation. The checker reads the store and reports, per thread, what an emitter would have to invent.

**Anti-triviality control, pre-registered.** The candidate thread is not chosen after seeing results. The checker runs over **every** thread in both corpora that meets these criteria, fixed now: at least three executables; at least one branch; at least one externally observable effect; at least one value that crosses an executable boundary; and zero opaque statements on the thread. `return x * 2` fails four of the five. Every qualifying thread is reported with its sufficiency, and the E4 candidate is the smallest qualifying thread, chosen by that rule rather than by which one scores best.

**What the emitter needs, enumerated before measuring, because a sufficiency verdict is only as good as its checklist.** Per step of the thread: the operation performed and, for a call, the identity of the callee; every operand with its identity, including receivers; the control condition under which the step runs, with its predicate and operands; the value produced, and where it goes next; and for an effect, the target, the arguments, and the ordering relative to other effects. Per thread: the entry point and its parameters, the exit and its value, and the entity types of anything constructed. **Anything on this list the store cannot supply is a missing fact, and the thread is insufficient.** The list is frozen with this entry; adding to it later is a new entry saying what was found missing from the list itself.

**Missing-fact categories, frozen:**

- `CALLEE_UNIDENTIFIED`, `RECEIVER_UNIDENTIFIED`, `OPERAND_UNIDENTIFIED`
- `EXPRESSION_UNREPRESENTED` (a transformation with no concept, the intermediate-value bound)
- `EFFECT_UNDERSPECIFIED` (an operation name and an argument count, where the emitter needs the target and the arguments)
- `ENTITY_UNREPRESENTED` (a class or constructed entity, which the store has no concept for)
- `ORDER_UNSPECIFIED` (two effects whose relative order the store does not fix)
- `TYPE_REQUIRED` (a fact only a type could supply; expected to be rare, and if it is not, that is a result)

**Predictions.**

1. Zero threads in either corpus are sufficient. If one is, it is the E4 candidate immediately and I have underestimated the store.
2. The most frequent missing fact across qualifying threads is `EFFECT_UNDERSPECIFIED`, because an effect is currently an operation name, an argument count, and a path condition, which is enough to say an effect happened and nowhere near enough to reproduce it.
3. `ENTITY_UNREPRESENTED` blocks most `toml` threads specifically, because that corpus is mostly classes with methods and the store has no concept for a class. If so, entity preservation is chosen by the goal rather than by preference.
4. `TYPE_REQUIRED` is rare, under 10 percent of missing facts. If it is common, the "we have not earned type inference" position is wrong and the log says so.
5. Qualifying threads are few: I expect between two and eight in `toml` and between zero and four in `ir0-typescript`, because the zero-opacity criterion is strict.
6. `ORDER_UNSPECIFIED` appears wherever a thread has two or more effects, since nothing in the store fixes their order today.

**What this round does not do.** It does not fix anything, does not choose a representation change, and does not run E4. Its output is a ranked list of missing facts derived from the goal, and the first item on that list is what the next build addresses.

## Three constraints added to the sufficiency protocol before the build, 2026-09-14

All three accepted, and the first closes a real hole in my checklist rather than sharpening the wording.

**1. Effect sufficiency is about the effect's semantics, not its invocation.** My list said target, arguments, and ordering. That describes how an effect is called and not what it means. Knowing `target = file, operation = write, argument = data, ordering = after X` does not tell an emitter whether the operation is synchronous or buffered, appends or replaces, what encoding it applies, or how it fails. A thread could therefore be declared sufficient because the store knows `write()` happened while knowing nothing about `write()` needed to reproduce equivalent behaviour. The requirement is now:

> For an effect: target, operation identity and semantics, arguments, ordering, and any externally observable behaviour required for equivalence.

Understanding is not expected to hold those today. The point is that the checker must report them missing rather than passing over them.

**2. Entity identity is not a programming-language type.** *Entity type* here means the semantic identity or category of something constructed, such as a class or a structured object. It must not quietly widen into static type information, because `ENTITY_UNREPRESENTED` and `TYPE_REQUIRED` test different hypotheses and would stop distinguishing anything if the terms merged.

**3. `TYPE_REQUIRED` is counted only when equivalent regeneration actually requires type information that cannot be recovered from existing semantic facts.** Not where a type would merely make the implementation easier or more idiomatic. Counting convenience would manufacture evidence for needing a type system, which is exactly the conclusion five rounds of measurement have so far refused.

## E5-sufficiency, measured 2026-09-14

Measurement only. 89 tests. Nothing written, no representation changed, both corpora still reproduce their IR-7 rows. `npm run sufficiency -- <corpus>` reproduces it.

```
                                 toml-python    ir0-typescript
threads walked                       45              48
qualifying (all five criteria)        0               1
SUFFICIENT                            0               0

why threads fail to qualify (a thread can fail several):
  fewer than 3 executables             43              43
  no value crosses a boundary          28              36
  no branch                            27              35
  opaque construct present             22              16
  no observable effect                 20              31
```

**Prediction 1 passed: no thread in either corpus is sufficient.** Prediction 5 was wrong in the direction that matters: I expected two to eight qualifying threads in `toml` and zero to four in TypeScript, and got **zero and one**. The binding constraint is not opacity, which I assumed; it is that 43 of 45 and 43 of 48 threads have fewer than three executables. A thread is an entry plus everything reachable through *resolved* calls, and with 12 and 16 resolved calls in the corpora, almost every thread is one or two functions. So the criteria that were meant to stop me choosing a trivial demonstration are, on these corpora, nearly unsatisfiable for a reason that has nothing to do with the criteria: **the store's threads are short because its call graph is sparse, and its call graph is sparse for the reasons E3-loss already ranked.**

**The one qualifying thread, and it is the E4 candidate by the pre-registered rule rather than by my choice:** `operand` in `ir0-typescript`, 4 executables, 23 predicates, 8 observable effects, no opacity, values crossing boundaries. It has **24 missing facts**:

```
   8  EFFECT_UNDERSPECIFIED     operand: operand, operand: get, operand: litOf
   6  CALLEE_UNIDENTIFIED       operand: get, operand: operand, canonNumber: exec
   4  RECEIVER_UNIDENTIFIED     operand: get, canonNumber: exec, canonNumber: replace
   2  EXPRESSION_UNREPRESENTED  operand: receiver of get
   2  OPERAND_UNIDENTIFIED      canonNumber: argument of replace
   2  ORDER_UNSPECIFIED         operand, canonNumber
```

**Prediction 2 passed:** EFFECT_UNDERSPECIFIED is the most frequent missing fact, 8 of 24. Every observable effect on the thread is one, because the store holds an operation name, an argument count, and a path condition, and the emitter needs the target, the operation's semantics, and the externally observable behaviour. The correction to the checklist earned itself immediately: without it, those 8 would not have been counted at all and the thread would have reported 16 missing facts while still being unrenderable.

**Prediction 3 is untestable as stated and I withdraw it.** I predicted ENTITY_UNREPRESENTED would block most `toml` threads. No `toml` thread qualifies, so nothing about them was measured, and the prediction cannot be scored. ENTITY_UNREPRESENTED did not appear on the one qualifying thread because that thread constructs nothing.

**Prediction 4 holds trivially and is therefore weak evidence:** TYPE_REQUIRED is zero, but the checker does not populate it by construction, because deciding it needs an emitter to fail for that reason. The "we have not earned type inference" position is neither confirmed nor challenged by this round.

**Prediction 6 passed:** ORDER_UNSPECIFIED appears in both executables that have two or more observable effects, because nothing in the store fixes an order between effects.

**What this round actually establishes, and it is a product finding rather than a measurement.** Sufficiency is not blocked by one missing primitive. On the single thread we can measure it, six different facts are missing and the largest is effect semantics, which the store has never modelled at all. And the reason only one thread could be measured is that threads are short, which is the composition problem from E3 reappearing as a constraint on our ability to *test* sufficiency. So the loop cannot be "pick a thread, fix what is missing, repeat" yet: there are not enough threads to pick from.

Two things follow, and I am not choosing between them here because that is the next decision rather than this round's result. Either the corpora are wrong for this test and a corpus is needed whose threads are long enough to measure (a small application rather than a library, with an entry point and calls that resolve), or the thread definition is wrong and a thread should follow more than resolved calls. The first is apparatus; the second is a change to what a thread means, and changing a definition to produce more qualifying threads is exactly the kind of move this log exists to catch, so it would need its own protocol and predictions.

**The checklist's own limit, stated again because this round depended on it.** A verdict is only as good as EMITTER_NEEDS. The effect correction was found by review before the build; if an emitter later fails for a reason not on that list, the list was incomplete and that is a finding about the checklist rather than about the thread.

## E5-sufficiency confirmed on Windows, 2026-09-14

89 of 89 passing. Both sufficiency reports reproduce exactly: `toml-python` 45 threads walked, 0 qualifying, 0 sufficient, with the same five failure counts (43, 28, 27, 22, 20); `ir0-typescript` 48 walked, 1 qualifying, 0 sufficient, `operand` with 4 executables, 23 predicates, 8 effects and the same 24 missing facts in the same order and the same named locations. The checklist and the three limits print identically.

So the first sufficiency measurement in the project's history is confirmed on two platforms, and its headline is that nothing is sufficient and only one thread in two corpora can even be asked.

The Python run's transcript is missing its `why threads fail to qualify, worst first:` header while printing the five counts under it; the TypeScript run prints the header. Seventh line loss, same shape as the previous six.

## Terminology: "thread" becomes "semantic flow", 2026-09-14

"Thread" is overloaded and undersells the object. It reads as an execution thread, a call chain, or a conversation. Adopted, with the definition:

> A **semantic flow** is a connected unit of application behaviour that follows values through operations, transformations, decisions, calls, and effects from an entry point toward an observable outcome.

The hierarchy this gives: **application, semantic flows, operations, values and entities.** The instrument is the semantic flow sufficiency checker, and the product goal reads: Understanding captures an application as a collection of interconnected semantic flows, each preserving enough meaning to regenerate an equivalent implementation independently of the original programming language.

Every earlier entry keeps the word it was written with, per the log's rule, and "thread" in entries before this one means semantic flow.

## E6-application corpus: selection criteria frozen BEFORE any candidate is examined, 2026-09-14

Option A, and the definition of a semantic flow stays exactly as it is: **an entry executable and everything reachable from it through resolved calls.** Widening it would hide the deficiency being measured, so it is frozen. The qualification criteria, the emitter-needs checklist, the encoder, the store, and the checker are all frozen through corpus selection too; nothing is touched but the addition of a corpus.

**Why the existing corpora came up short, stated fairly.** They were selected to test language-independent representation and they did that. `ir0-typescript` produced the first cross-language convergence and `toml-python` found the denominator defect and the receiver loss. Asking them an application-reconstruction question is asking a different question of instruments built for another one: a library has functions other applications call, not semantic flows of its own.

**The selection trap and the control for it.** There is an easy unconscious path toward trying applications until one performs well. So the criteria are written here, before any candidate is looked at, and the first application meeting all of them is taken. Selection is **not** informed by how Understanding performs against it, and if the first qualifying candidate produces zero qualifying flows, that is the result and it is recorded rather than replaced.

**Criteria, all required:**

1. Python, independently developed, not written by us and not written for this project.
2. A genuine entry point: a console script, a `__main__`, or a documented single callable that runs the application.
3. Several internal modules, at least three, with calls between them.
4. Data transformed across multiple functions rather than within one.
5. Meaningful branches.
6. At least one externally observable effect.
7. An existing automated test suite, written by its authors, giving behavioural ground truth that was not written to make Understanding look good.
8. Manageable size: vendorable whole, so anyone reproduces from the exact bytes. Target under about 3,000 lines of source.
9. A licence permitting redistribution inside this repository, with its notice retained.
10. No compiled extensions and no dependency that must be installed for the source to be read.

**Explicitly not a criterion: zero opacity.** The application is not required to be free of constructs Understanding cannot represent. The qualifying rule for a flow still demands zero opacity, so if the application yields thirty candidate flows and four qualify because the rest contain unrepresentable constructs, that is a legitimate product finding and it is what the checker is for.

**Procedure:** select, vendor unchanged, write `MANIFEST.json` with per-file hashes and a corpus hash, write `PROVENANCE.md` with the source, the licence, and how the criteria were met, freeze, then run the unchanged checker once.

**Predictions, before any candidate is seen.**

1. Semantic flows in an application are longer than in a library: the largest flow has at least 5 executables, against 5 and 8 in the current corpora.
2. Between 1 and 10 flows qualify. If zero qualify, the binding constraint is opacity or unresolved calls rather than flow length, and that is the finding.
3. No flow is sufficient.
4. EFFECT_UNDERSPECIFIED is again the most frequent missing fact.
5. ENTITY_UNREPRESENTED appears for the first time in a qualifying flow, because an application constructs things. This is the prediction that was untestable last round.
6. Opacity is higher than `toml`'s 13.6 percent, because application code has more loops, error handling, and I/O than a parsing library.

## A caveat recorded before selection, 2026-09-14

**Prediction 6 (opacity above 13.6 percent) is weak and is labelled as such.** The selection criteria do not control how many loops, error handlers, or I/O calls a candidate contains, so the prediction is an assumption about a corpus not yet chosen. If opacity comes out at 8 percent that is evidence against my expectation and against nothing else. The predictions that carry weight are the architectural ones: whether any semantic flow is sufficient, which missing-fact categories appear, whether ENTITY_UNREPRESENTED becomes measurable at last, how many flows qualify, and what stops the rest.

**And a milestone worth naming, because it is easy to miss.** This is the first time Understanding is pointed at an application chosen without regard to what Understanding can represent. The earlier corpora developed the instrument; `ir0-typescript` gave the first cross-language convergence and `toml-python` found the denominator defect and the receiver loss. This corpus uses the instrument against software on software's terms. If the first legitimate candidate shows 80 percent opacity and zero qualifying flows, that is not a failed selection. It is a measurement of the product.

No further changes before selection.

## E6-application corpus: radon selected and measured, 2026-09-14

**Selection.** Two candidates examined in the order they came to hand, against the ten criteria frozen before either was looked at. `wordfreq` 3.1.1 rejected: no entry point and no test suite in its distribution, failing criteria 2 and 7. **`radon` 6.0.1 accepted**, the first candidate meeting all ten, taken without examining how Understanding performs against it. A Python command-line code-metrics application: `console_scripts` entry, twelve modules across three packages, source text to AST to visitor results to metrics to formatted output with each stage in a different module, branch logic by nature, reads files and writes reports, 13 test files and roughly 80 test functions written by its authors and vendored beside the source rather than in it, 2,595 lines, MIT, pure Python. Corpus hash `ec611e4e91ff85aa`, 91 tests, and the corpus-integrity tests now cover all three corpora.

```
radon-python, IR-7, build e887e1b635bd
files 12   functions 137   statements 563
opaque     209 / 563 = 37.1%      (toml-python 13.6%, ir0-typescript 6.7%)
categories other 149, loop 35, exception-handling 17, declaration 8
groups     8

concepts   149 (12 modules, 137 executables)
CALLS      39 resolved            invocations 330 (39 resolved, 289 unresolved, 1 ambiguous)
isolated   89 of 137              components 103, largest 12
longest call chain 3              FLOWS_TO 164, 25.4% of boundary composition captured

semantic flows walked  109
qualifying               0
SUFFICIENT               0
  fewer than 3 executables  102
  opaque construct present  102
  no branch                  80
  no boundary crossing       75
  no observable effect       64
```

**The 37.1 percent is not comparable to the other corpora, and the reason is a defect in my instrument.** 126 of the 209 opaque statements are **docstrings**: an expression statement containing a bare string, which carries no semantics whatsoever and is being counted as unrepresented semantics. Excluding them the rate is 83 of 437, **19.0 percent**, which is the figure comparable to `toml`'s 13.6. The row in `EXPECTED.json` carries this caveat and a test asserts it does, because without it someone reads 37.1 beside 13.6 and concludes something false. Not fixed this round: the encoder was frozen through corpus selection, and fixing it is an encoder change with the full ceremony.

**Predictions, scored.**

1. Longer flows: **passed.** Largest component 12 executables against 5 and 8, longest call chain 3 against 2, 39 resolved calls against 12 and 16.
2. Between 1 and 10 flows qualify: **failed. Zero qualify.** And the binding constraint changed: opacity is now joint-first with flow length (102 and 102), where in the libraries it was fourth. An application really does contain more of what Understanding cannot represent, which was prediction 6's intent even though prediction 6 itself is weak.
3. No flow is sufficient: **passed**, though trivially, since none qualified.
4. EFFECT_UNDERSPECIFIED most frequent: **not measurable.** No qualifying flow, so nothing was ranked.
5. ENTITY_UNREPRESENTED becomes measurable: **failed, and this is now the second round it has escaped measurement.** It needs a qualifying flow and there is none.
6. Opacity above 13.6 percent: passed at 37.1 as printed and at 19.0 excluding docstrings, and the prediction was labelled weak before the measurement, so it carries little either way.

**What this establishes, and it is the most important finding since E3.** Understanding was pointed at an application chosen on software's terms, and **the sufficiency question cannot be asked of a single one of its 109 semantic flows.** Not answered badly: not askable. Two constraints bind equally, and neither is a missing semantic primitive:

- 102 flows have fewer than three executables, because 289 of 330 invocations do not resolve, so flows terminate almost immediately.
- 102 flows contain a construct the encoder cannot represent, and 12 of those are `yield`, which means generators, which is how this application streams its results.

So the product position is: the instrument is sound, the corpus is legitimate, and the store is further from application sufficiency than any coverage number suggested. The 25.4 percent of boundary composition captured is the honest headline, and it is the lowest of the three corpora.

**And the loop still cannot run.** Pick a flow, fix what is missing, repeat, requires a flow. Three corpora, 202 flows, one has ever qualified. The next decision is therefore about what makes flows askable, and the measurement names the two candidates without my choosing between them: call resolution (289 unresolved invocations) and the specific constructs that stop a flow qualifying, led by docstrings being miscounted, then loops at 35, then exception handling at 17, then `yield` at 12. The first of those is an instrument fix, not a representation change, and it is the cheapest honest thing on the list.

## The radon corpus confirmed on Windows, 2026-09-14

91 of 91 passing, including the corpus-integrity tests for all three corpora and the assertion that the radon row carries its docstring caveat. The measurement reproduces exactly: 12 files, 137 functions, 563 statements, 209 opaque at 37.1 percent, categories other 149, loop 35, exception-handling 17, declaration 8, eight collision groups with the same eight fingerprints, corpus verified against `ec611e4e91ff85aa`, and `reproduces IR-7 of radon-python`. The sufficiency run reproduces too: 109 flows walked, zero qualifying, zero sufficient, with the same five failure counts (102, 102, 80, 75, 64). Row now confirmed on linux and windows.

So the most important negative result in the project so far is confirmed on two platforms: pointed at an application selected on software's terms, Understanding cannot be asked the sufficiency question about any of its 109 semantic flows.

## IR-9 Statement classification: protocol and predictions frozen before the work, 2026-09-14

Encoder change, so the full ceremony: `frozen-ir9`, `frozen-ir7` kept, new rows appended to all three corpora, E1, E2, IR-6, IR-7 and IR-8 controls re-run, and the sufficiency and graph measurements repeated unchanged afterwards.

**The defect being corrected.** A docstring is an expression statement holding a bare string. The adapter classifies it as `opaque: other`, which means "a semantic construct the IR cannot represent". It is not a semantic construct at all. 126 of radon's 209 opaque statements are docstrings, so the application's headline opacity is roughly double what it should be, and every ranking built on that number is distorted. This is not a docstring feature and it is not a conveniently lower number: **the measurement is currently wrong**, and it is wrong in the direction that flatters nothing and misleads everything downstream.

**The generalisation, adopted rather than a docstring special case.** A statement is one of three things, and the IR must say which:

```
SEMANTIC        represented, or unrepresented and therefore opaque
NON_SEMANTIC    carries no execution semantics (a docstring, a bare string statement,
                a comment, `pass` where it is only syntactic filler)
METADATA        annotation or declaration that is not execution behaviour
```

Only unrepresented SEMANTIC statements count toward opacity. NON_SEMANTIC statements are counted and reported separately so the correction is visible rather than a number quietly shrinking.

**The boundary is drawn on execution semantics and nothing else, and the hard cases are decided here, before the measurement, so the rule cannot be shaped to a result.**

- A docstring: NON_SEMANTIC. It has no effect on execution. That `__doc__` is readable at runtime does not make the statement execution behaviour, and a program that reads `__doc__` reads it through an attribute access, which is a semantic statement of its own and is unaffected by this rule.
- A bare string statement that is not in docstring position: NON_SEMANTIC, same reasoning.
- `pass`: NON_SEMANTIC.
- A comment: NON_SEMANTIC. The adapter already discards these before classification; they are counted for completeness.
- An `import`: METADATA. It binds a name, which matters to resolution, and it is not execution behaviour in the sense opacity measures. **It is counted separately and does not enter the opacity denominator or numerator.** If resolution later needs imports, that is a representation change with its own round, and this decision does not pre-empt it.
- A type annotation without a value, `x: int`: METADATA.
- `global` and `nonlocal`: METADATA.
- An assignment, a call, a yield, a raise, a loop, a branch, a `with`, a `try`: SEMANTIC, always. `yield` and `with` remain opaque; they are just correctly counted as semantic and opaque rather than miscounted as other.

**What is not changed.** No new resolution, no import modelling, no loop or exception representation, no receiver work, no emitter. Only the classification of statements and what the instrument counts.

**Predictions.**

1. radon's opaque count falls from 209 to about 83, and its rate from 37.1 percent to roughly 19 percent, with the denominator also falling because NON_SEMANTIC and METADATA statements leave it.
2. `toml-python` and `ir0-typescript` also fall, because both have docstrings; `toml` more than TypeScript, since Python docstrings are conventional and this repository's TypeScript uses comments the adapter already discards. I expect `toml` to drop by roughly a third of its 49 and TypeScript by little or nothing.
3. Statement counts change in all three corpora, which is legitimate and must be explained in each appended row, as at IR-5.
4. Intrinsic fingerprints change wherever a function's body contained a docstring or a bare string, because the IR's statement list changes. Expected, not defended.
5. Semantic flow qualification improves in radon: the count of flows disqualified by opacity falls from 102, because a flow whose only unrepresented statement was a docstring now has none. **I do not predict that any flow qualifies**, because the other four criteria are unaffected and 102 flows also fail on length.
6. Cross-language pairs A and C still match, B and D still differ, and every IR-6, IR-7 and IR-8 control passes unchanged.
7. `EXPECTED.json` gains a row per corpus, and no existing row is edited.

**The falsifier worth naming.** If radon's opacity does not fall to roughly 19 percent, my accounting of the 126 docstrings was wrong and the real cause of the `other` category is something else. If flows disqualified by opacity does not fall, then docstrings were never what disqualified them, and the ranking I gave was wrong.

## IR-9 Statement classification, measured 2026-09-14

Encoder change, full ceremony. `frozen-ir9` established, `frozen-ir4`, `ir5` and `ir7` kept, encoders `python-adapter/0.4` and `typescript-adapter/0.3`, `ir_schema` 5, rows appended to all three corpora and none edited, all controls re-run. 94 tests.

```
                   statements        opaque            excluded (non-sem / metadata)
                 IR-7    IR-9     IR-7      IR-9        IR-9
radon-python      563     435    209=37.1%  81=18.6%    126 / 2
toml-python       360     345     49=13.6%  34= 9.9%      8 / 7
ir0-typescript    240     240     16= 6.7%  16= 6.7%      0 / 0
```

**Predictions, scored.**

1. radon falls to about 83 and roughly 19 percent: **passed**, 81 and 18.6, with the denominator falling as predicted because the excluded statements leave it.
2. `toml` falls by about a third of 49 and TypeScript by little or nothing: **passed**, 49 to 34 (a drop of 15, close to a third) and TypeScript unchanged at 16. The reason TypeScript is untouched is that its documentation is in comments, which the adapter already discarded.
3. Statement counts change and are explained per row: **passed**, and each IR-9 row records exactly how many non-semantic and metadata statements left the denominator, with a test asserting that the row does.
4. Fingerprints change where a body held a docstring: **passed**, all three corpora have new collision fingerprints, appended rather than substituted.
5. Flows disqualified by opacity falls, and no flow necessarily qualifies: **passed on the first clause and wrong on the second, in the direction I wanted.** radon's opacity disqualifications fell from 102 to 50, and **two flows now qualify where none did.** I explicitly declined to predict that, and it happened.
6. Controls unchanged: **passed.** Pairs A and C match, B and D differ, and every IR-6, IR-7 and IR-8 control passes.
7. A row per corpus, none edited: **passed.**

**The result that matters. ENTITY_UNREPRESENTED is measurable at last, on its third attempt.**

```
radon-python, qualifying flows: 2 (was 0)

gobble#21   5 executables, 8 predicates, 8 effects   23 missing facts
   8  EFFECT_UNDERSPECIFIED     mi_rank, mi_visit, log
   6  CALLEE_UNIDENTIFIED       chr, min, sqrt
   5  RECEIVER_UNIDENTIFIED     log, sqrt, get
   3  ORDER_UNSPECIFIED         gobble#21, mi_compute, log
   1  OPERAND_UNIDENTIFIED      argument of mi_compute

gobble#28   5 executables, 7 predicates, 5 effects   16 missing facts
   5  EFFECT_UNDERSPECIFIED     read, from_ast, halstead_visitor_report
   5  CALLEE_UNIDENTIFIED       read, Halstead, cls
   2  ENTITY_UNREPRESENTED      Halstead, HalsteadReport
   2  ORDER_UNSPECIFIED         h_visit_ast, from_ast
   1  RECEIVER_UNIDENTIFIED     from_ast
```

So the prediction that failed twice for want of a qualifying flow is now answered: an application constructs things, `Halstead` and `HalsteadReport` are constructed in a measurable flow, and the store has no concept for either. And EFFECT_UNDERSPECIFIED leads both flows, 13 of the 39 missing facts, which is the third round in a row it has come first wherever it could be counted.

**The ranked list of what stands between us and a sufficient flow is now measured on an application rather than inferred:** effect semantics 13, callee identity 11, receiver identity 6, effect ordering 5, entity identity 2, operand identity 2.

**Two corrections to my own apparatus, both recorded rather than tidied.** A non-semantic statement was reaching every downstream instrument as an `opaque:` pseudo-effect, so ingestion counted docstrings as call sites; the projection no longer emits one, and a test asserts a docstring produces no effect. And a test asserted 102 losses and 156 lost flows, numbers from IR-7; IR-9 legitimately removed 15 pseudo-invocations, so the assertion now checks the invariant it was protecting, that a reclassification moves occurrences and creates none, against ingestion's own count rather than against a previous encoder's figure.

**What this does not establish.** No flow is sufficient. The classification corrected a measurement and represented nothing new: loops, exception handling, `yield`, effect semantics, entity identity and import identity are all exactly as absent as they were this morning.

## IR-9 confirmed on Windows, all three corpora, 2026-09-17

Platform confirmation of the measured IR-9 result recorded 2026-09-14. Not a new experimental run and not a new prediction. Run from `C:\workspace\und-ir9\Understanding` on win32 x64, Node 22.22.0, with `npm test` and `npm run measure`, `sufficiency` and `graph` against the frozen corpora.

94 of 94 passing, including the IR-9 frozen-encoder test and the docstring, import and yield classification tests.

```
                   build          statements  opaque       excluded (non-sem / metadata)  groups  corpus hash
radon-python       bedeedfa09d7   435         81 = 18.6%   126 / 2                        8       ec611e4e91ff85aa
toml-python        bedeedfa09d7   345         34 =  9.9%     8 / 7                        2       dbbd34f3b778aadb
ir0-typescript     bedeedfa09d7   240         16 =  6.7%     0 / 0                        2       01c953f3772a799f
```

Each corpus verified against its manifest and printed `reproduces IR-9 of <corpus>, recorded 2026-09-14 at build bedeedfa09d7`. Categories, collision fingerprints and per-file counts are identical to the Linux rows. For radon, the sufficiency run reproduces (109 flows walked, 2 qualifying, 0 sufficient, failure counts 102, 80, 75, 64, 50, and the same missing facts for `gobble#21` and `gobble#28`), and the graph run reproduces (1954 assertions, 39 CALLS edges, 164 FLOWS_TO, 31.7 percent of composition captured). The radon `measure`, `sufficiency` and `graph` runs were also repeated on Linux in the linked VM from the stored build before the Windows run, with identical output.

The three IR-9 rows now read `confirmed: ["linux", "windows"]`. Only that field changed; every measured value in every row is as recorded.

## Graph report totals do not reconcile, 2026-09-17

An instrumentation and reporting defect in `npm run graph`, found while preparing to classify unresolved calls. Recorded with the conflicting numbers exactly as printed; none of them is chosen as correct here.

From one radon-python graph report at build `bedeedfa09d7`:

- `boundary composition`: **202 invocations = 39 resolved + 161 unresolved + 1 ambiguous.**
- `unresolved call operations`: **162 occurrences**, of which 81 are `opaque:` pseudo-operations.
- the cost table is headed **"what the 163 unresolved invocations cost"**, and its TOTAL row is **163**.
- the origin section reports **61 preserved receivers**.
- the producer section reports **62 receivers**, and its three groups account for 19 of them.

The same inconsistencies were printed on Linux and on Windows from the same build and the same corpus, so this is a deterministic defect in the instrument's counting definitions or its reporting, not platform variance. The earlier radon IR-7 entry has the same shape: 330 invocations reported as 39 resolved, 289 unresolved and 1 ambiguous, which sums to 329. No earlier entry is corrected by this one; it only names the discrepancy.

A second definitional point, recorded beside the arithmetic: 81 of the 163 cost-table rows are `REPRESENTATION_LOSS` pseudo-invocations standing for opaque statements, not calls. A classification of "unresolved calls" that includes them is not a classification of calls.

**Consequence:** unresolved-call classification does not begin until the counting definitions are written down and every total in the report reconciles against them, with a test asserting it.

## Transcript and presentation defects in the IR-9 Windows confirmation, 2026-09-17

Output defects only, recorded separately so they cannot be read as affecting the semantic measurements. In every case the data lines around the gap are present and match the recorded rows.

1. radon-python `measure`: the collision-group line for group `947d6f92ad2a39e960353639` is cut off at `visit_Compa`, partway through its last member, and runs into the next group's line.
2. radon-python `sufficiency`: the `CALLEE_UNIDENTIFIED` definition is absent from the printed "what each means" section, while the other five definitions print.
3. toml-python `measure`: the `encoder python-adapter/0.4   ir_schema 5` line is absent; the ir0-typescript run printed its encoder line.

Whether these are in the instrument's output or in the terminal transcript was not established. They are the same shape as the line losses recorded at earlier Windows confirmations.

## Protocol frozen before the work: the opaque catch-all categories, and the await finding, 2026-09-17

Frozen with his rulings of 2026-09-17. Order approved: **I-0, I-1, C-2, C-3, C-4, C-5, R-1.** `ir_schema` stays 5 through the C-series; a step that proves classification alone cannot represent what it needs is the point at which the schema moves, and R-1 is where that is expected. Each C-step gets its own encoder version and its own `frozen-ir<N>`: five ceremonies before R-1, accepted deliberately so that any later movement in a collision, a fingerprint, or a sufficiency result is attributable to one semantic distinction. Steps are not bundled because they are small or because they were found together.

**Evidence in hand before the work, from inspection on 2026-09-17** (scratch copies of the compiled adapters labelled with grammar node type and line; the repository was not modified for it):

- radon `other` 23: every one a `yield`. `cli/harvest.py` 243, 248, 310, 314, 315, 320, 325, 432, 433, 434, 435, 436, 439, 440, 443, 444, 447, 448, 449 (19); `cli/tools.py` 40, 220, 253 (3); `cli/__init__.py` 433 (1).
- Six `@contextmanager` yields exist in radon source (`tools.py` 40, 43, 220, 223; `cli/__init__.py` 431, 433) and **three are counted** (`tools.py` 40, 220; `cli/__init__.py` 433). The rest sit inside opaque containers. The counted split is therefore 20 emission, 3 handoff. A first statement of this in conversation said six handoffs and 57 yield lines; the corrected figures are three and 56, and they are the ones this protocol predicts against.
- radon `with` 7 (lines 42, 167, 215, 222, 272, 318, 430) and `try` 10, both currently under exception-handling; toml `with` 1 (line 133), `try` 3.
- radon `declaration` 6: all nested `function_definition` (117, 123, 140, 151, 297, 383). toml `declaration` 1: a nested `class_definition` (644).
- ir0-typescript `other` 1: `await ready;` at `adapters/treeSitter.ts` line 11, labelled `other|identifier` because the label names the operand rather than the construct.
- An opaque statement's category enters the semantic projection as the pseudo-operation `opaque:<category>`, so a pure reclassification changes fingerprints and graph operation names while changing no count.
- **The await collapse, verified on build `bedeedfa09d7`:** in TypeScript, `await foo(x); bar(x)` fingerprints identically to `foo(x); bar(x)`, and `const y = await foo(x)` identically to `const y = foo(x)`. In Python a bare `await foo(x)` is `opaque: other`. TypeScript erases the await; Python hides it. ir0-typescript holds five awaits, one standalone and four bound; no measured Python source in any corpus contains one.

**Invariants required of every classification step (C-2 to C-5).** Statement count, opaque count, non-semantic and metadata exclusions, invocation count, CALLS, FLOWS_TO, and every sufficiency count are unchanged, and no opaque occurrence is created or destroyed. Only category labels, `opaque:<category>` names, and the fingerprints of functions containing a reclassified statement may move. Collision groups are **not** predicted stable, since a label change can split or merge a group. Movement in an invariant stops the step for investigation and is not assumed to be contamination.

### I-0, first: the graph report reconciles its own arithmetic

Reporting and accounting only. **Prediction, stated as the scope test: the graph and the store do not change.** Same concepts, same assertions, same `CALLS` edges, same `FLOWS_TO`, same receiver records, same loss records, same sufficiency output. Only the counting definitions and the arithmetic that reports them change, and a test asserts the totals reconcile against those definitions. **If reconciling the totals requires altering graph construction, I-0 was mis-scoped: stop and record that rather than proceeding.**

Falsifier: any total that no written definition produces, or a measured value that moves.

### I-1: container accounting

Instrument only, no encoder change. The measure reports, beneath each opaque container (loop, `try`, `with`, nested `def`), the statements its body holds, classified by the IR-9 rules, as a separate figure with its own construct breakdown. The top-level opaque count keeps its definition so rows stay comparable, and from this step on it is never the sole success metric.

Predictions: every existing figure unchanged in all three corpora; radon's hidden `yield` count is **33** (56 in source minus 23 counted); the hidden figure is non-zero in all three corpora. Falsifier: a hidden yield count other than 33.

### C-2: Python `yield`, emission against scoped resource handoff

Rule, fixed before measuring: a `yield` inside a function decorated `@contextmanager` is **scoped resource handoff**; every other `yield` is **value-stream emission**. The decorator is recognised **by name**, which is author knowledge and is recorded as such: the classification carries `DECLARED_BY_AUTHOR` and the source location that caused it, and the decorator name is never treated as intrinsic semantic proof. **Stated limitation:** an alias, a re-export, or a user-defined context manager implemented without that decorator is not recognised. That is acceptable here because C-2 tests whether the distinction can be represented at all, and claims no general context-manager inference.

Predictions (radon): `other` 23 to 0; emission 20; handoff 3, at `tools.py` 40, `tools.py` 220, and `cli/__init__.py` 433; invariants hold; toml and ir0-typescript unchanged. Falsifier: a counted yield the rule cannot decide, or a handoff count other than 3.

### C-3: `with` as scoped resource

Rule: `with` is **scoped resource** (acquire, use within a scope, release on every exit), not exception-handling. The relation between a `with` and a `@contextmanager` handoff is recorded as a hypothesis; the categories are not merged in this step. `try` stays exception-handling until evidence supports a better category.

Predictions: radon exception-handling 17 to 10 with scoped resource 7; toml exception-handling 4 to 3 with scoped resource 1; TypeScript unchanged; invariants hold. Falsifier: one of the eight `with` statements, on inspection, does something the category misdescribes.

### C-4: nested `def` as closure construction

Rule: a nested `function_definition` is **closure construction**, a runtime operation producing a callable value, not metadata and not a declaration.

Predictions: radon declaration 6 to 0 with closure construction 6; toml's nested `class_definition` at 644 **stays declaration**, explicitly out of scope, because a constructed class is an entity question for `ENTITY_UNREPRESENTED`. Falsifier: a nested `def` among the six that is never used as a value or called.

### C-5: the standalone TypeScript `await`, classification only

The Python `yield` taxonomy is **not** assumed to carry over. Candidates to weigh from evidence, none adopted in advance: a suspension resuming when a value settles; an ordering barrier; a failure-propagation point. The label must be derived from the construct, which also corrects the parent-naming defect that produced `other|identifier`; that defect has one instance only, so it is not independently falsifiable and is folded into this step with the reason stated.

Predictions: ir0-typescript `other` 1 to 0; invariants hold; Python corpora unchanged; the four bound awaits are untouched by this step.

### R-1: await representation, and it is not reducible to ordering

Three facts the encoder may need to distinguish, each tested separately:

1. **Suspension and dependency.** The invocation's completion is awaited, and execution here depends on it settling.
2. **Continuation ordering.** What runs after the await runs after it settles. No assertion records this today, so `ORDER_UNSPECIFIED` cannot see its absence.
3. **Failure propagation.** An awaited rejection surfaces at the await; an unawaited one does not.

Controls, added to the adversarial corpus before any encoder change:

- **Negative control, statement form:** `await foo(x); bar(x)` must not fingerprint the same as `foo(x); bar(x)`.
- **Negative control, bound form:** `const y = await foo(x)` must not fingerprint the same as `const y = foo(x)`, with everything else identical. Today's encoder collapses both forms, so both controls fail by design until R-1 exists.
- **Positive control:** TypeScript `await foo(x)` and Python `await foo(x)` must project identically.
- **Guard:** an identical plain-call pair must still match.

Predictions: fingerprints change for every function holding one of the five TypeScript awaits; ir0-typescript opacity falls from 16 to 15 only if the standalone await becomes represented rather than merely classified; the Python corpora are unchanged, since no measured Python source contains an await. No prediction about qualifying flows or `ORDER_UNSPECIFIED`, since no qualifying flow is known to contain an await.

**Not in this protocol:** representing loop, `try`, or `with` bodies; representing `yield`; entity construction for nested classes; import identity; unresolved-call classification, which waits on I-0; any change to the sufficiency contract.

## I-0, measured on Linux 2026-09-17: the graph report reconciles its own arithmetic

Reporting and accounting only, as the protocol scoped it. No encoder change, no `ir_schema` change, no new relation, no change to how the graph is built. Build id moves from `bedeedfa09d7` to `93cacff96d92` because it hashes `src` and `scripts`, and both were touched; the encoders keep their versions (`python-adapter/0.4`, `typescript-adapter/0.3`) and every corpus still reproduces its IR-9 row. 100 tests, all passing (94 before, 6 added).

**The scope test, which is the prediction that mattered: the store and the graph do not change.** All three corpora were run through `measure`, `sufficiency`, and `graph` on the pre-I-0 build and again on this one, and the outputs were compared line by line. The only differences anywhere are the four labels this step rewrote and the new sections it added. Every measured value is identical, radon included: 1954 assertions, 39 CALLS, 164 FLOWS_TO, 31.7 percent captured, 109 flows walked, 2 qualifying, 0 sufficient. I-0 was therefore correctly scoped: nothing had to be changed in graph construction to make the totals close.

**What was actually wrong, and it was not arithmetic.** Each disagreeing total counted a population nobody had written down.

1. **202 against 39 + 161 + 1.** An invocation whose only candidate callee is the caller itself, direct recursion, took an early exit that wrote no `INVOKES` edge and incremented no counter. In radon that is `visitors.py:generic_visit` calling itself; in `ir0-typescript` it is one site as well; `toml-python` has none. These are now counted as **self invocations** and named in the report. No CALLS self-loop is written, which stays deliberate: a self-loop says nothing about composition.
2. **162 against 163.** Two different populations, both legitimate. The operation table counts unresolved plus ambiguous (162); the cost table classifies every invocation with no CALLS edge, which is unresolved plus ambiguous plus self (163).
3. **61 against 62.** Also two populations, and neither was a miscount. The origin instrument reads the store's `HAS_ARGUMENT` role=receiver assertions, which exist one per **merged** call site. The producer instrument reads receivers straight from the projection, **before** the merge, and does not walk returned or thrown operands. The bridge between them is now measured rather than assumed: for radon, 61 store arguments = 62 from the projection + 20 from returned or thrown operands - 21 merged. The first attempt at this identity said the difference was the merge alone; the test falsified it immediately (62 = 61 + 21 is false), which is exactly what the test is for, and the second term was found by following that failure.

**The seven identities, all holding, on all three corpora.** Radon:

```
202 = 39 resolved + 161 unresolved + 1 ambiguous + 1 self
162 = 161 unresolved + 1 ambiguous
163 = 202 invocations - 39 resolved
163 = 81 pseudo-invocations + 82 calls
 61 = 61 receiver arguments
 62 IR occurrences = 62 receiver sites from the projection
 61 store arguments = 62 from the projection + 20 from operands - 21 merged
```

`toml-python`: 99 = 12 + 77 + 10 + 0; 87 = 77 + 10; 87 = 99 - 12; 87 = 34 pseudo + 53 calls; 49 = 49; 71 = 71; 49 = 71 + 8 - 30. `ir0-typescript`: 81 = 16 + 63 + 1 + 1; 64 = 63 + 1; 65 = 81 - 16; 65 = 16 pseudo + 49 calls; 46 = 46; 55 = 55; 46 = 55 + 11 - 20.

**The definitional point that unresolved-call classification was waiting on.** The cost table's population is not "unresolved calls". In radon it is 163 rows, of which **81 are pseudo-invocations** standing for opaque statements and **82 are calls**. `toml` is 34 and 53; `ir0-typescript` is 16 and 49. The report now prints that split, so the figure to classify in a later round is 82, not 163 and not the 291 an earlier reading of the IR-7 row produced.

**What is in the repository now.** `src/query/reconcile.ts` states each population with its definition and each identity with the arithmetic it checked; the graph report prints both sections and says plainly when an identity fails; `src/ingest/index.ts` gained five counters and no other change; `test/e3/reconcile.test.ts` asserts every identity on all three corpora, that every printed population carries a definition, that the self-call is counted, and that pseudo-invocations are separated from calls. One existing assertion in `test/e3/loss.test.ts` read `classified == unresolved + ambiguous`, which held only because `toml` has no self-call; it now carries the self term, with a note saying the term is zero in that corpus.

**Not done here, and not attempted:** classifying the 82 calls, import identity, receiver type flow, or anything in the C-series. Next is I-1, container accounting, against this baseline.

### I-0 on Windows: not yet run

This entry records the Linux run only. The Windows confirmation is pending.

## I-0 confirmed on Windows, 2026-09-17

win32 x64, Node 22.22.0, build `93cacff96d92`. 100 of 100 passing, including the six I-0 tests. All three corpora print `every identity holds`, with the same arithmetic as the Linux run: radon 202 = 39 + 161 + 1 + 1, 162 = 161 + 1, 163 = 202 - 39, 163 = 81 pseudo + 82 calls, 61 = 61, 62 = 62, 61 = 62 + 20 - 21; `toml-python` 99 = 12 + 77 + 10 + 0, 87 = 77 + 10, 87 = 99 - 12, 87 = 34 + 53, 49 = 49, 71 = 71, 49 = 71 + 8 - 30; `ir0-typescript` 81 = 16 + 63 + 1 + 1, 64 = 63 + 1, 65 = 81 - 16, 65 = 16 + 49, 46 = 46, 55 = 55, 46 = 55 + 11 - 20.

The scope test holds on Windows as it did on Linux. radon: 1954 assertions, 39 CALLS, 164 FLOWS_TO, 31.7 percent captured, 109 flows walked, 2 qualifying, 0 sufficient, and `reproduces IR-9 of radon-python, recorded 2026-09-14 at build bedeedfa09d7`. `toml-python`: 993 assertions, 12 CALLS, 75 FLOWS_TO, 34.7 percent. `ir0-typescript`: 861 assertions, 16 CALLS, 67 FLOWS_TO, 34.7 percent.

So I-0 is confirmed on two platforms: the report now derives every total from a written definition, and the graph it reports on is the same graph as before.

**A note on the build id, because it will mislead somebody otherwise.** The build id hashes `src` and `scripts`, so an instrument change moves it: `bedeedfa09d7` becomes `93cacff96d92`. The encoder versions are untouched and every corpus still reproduces its IR-9 row, which is the point of having the encoder version and the build id be different things. `RUN.md` still quotes the IR-5 era build and expects 94 tests; it is stale and is not corrected here.

**Presentation defects, recorded separately from the measurements, and the same family as the three recorded earlier today.** All three Windows `graph` transcripts lose the definition line under `receiver occurrences in the IR`, printing a bare `reads.` where the sentence should be; the data lines around it are intact and the identity that uses that population holds. The radon `measure` transcript again cuts the `947d6f92ad2a39e960353639` collision line at `visit_Compa` and runs it into the next group. Nothing in the measured values depends on either.

## I-1 Container accounting, measured on Linux 2026-09-17

Observational only, as the protocol scoped it: a new instrument reads the source again and counts what an opaque container conceals. No encoder change, no `ir_schema` change, no change to the store, the graph, sufficiency, opacity, fingerprints, collisions, invocations, or flows. Build `93cacff96d92` becomes `d35f26db56d4`, an **instrumentation change**, with both encoder versions unchanged and every corpus still reproducing its IR-9 row. 108 tests (100 before, 8 added).

**The definition, as frozen:** a hidden statement is a semantic source statement lying beneath an opaque container, with no independently represented semantic statement in the current IR. Counted exactly once whatever its depth, attributed to its nearest opaque container. Every record carries file, line, column, grammar node type, construct, IR-9 classification, nearest opaque ancestor with its line, and nesting depth, and a test asserts no two records share a location, so a `yield` inside a `with` inside a loop is one hidden statement and not three.

**Predictions, scored.**

1. **radon conceals 33 yields: passed, exactly.** 56 `yield` statements in the source, 23 counted by the measure, 33 hidden. A test asserts the number rather than printing it.
2. **Every currently reported figure unchanged in all three corpora: passed.** All three corpora were run through `measure`, `sufficiency`, and `graph` before and after, and compared line by line. The only difference anywhere is the new section.
3. **Non-zero hidden count in each corpus: passed.** radon 285, `toml-python` 507, `ir0-typescript` 158.

**What the containers conceal, by nearest container.**

```
radon-python     285 hidden (270 semantic)   for 200, try 65, with 12, while 8
toml-python      507 hidden (496 semantic)   for 294, while 136, try 75, with 1, class 1
ir0-typescript   158 hidden (153 semantic)   switch 107, for-in 31, for 10, try 6, while 4
```

**What the IR fails to expose, by construct.** radon: assignment 91, call 39, if 39, **yield 33**, augmented assignment 24, nested loop 15, comment 14, return 10. `toml-python`: assignment 195, if 126, augmented assignment 61, raise 28, call 18. `ir0-typescript`: binding 42, return 41, if 27, block 14, call 10, assignment 10. Deepest nesting: 5 containers above one statement in `toml`, 4 in radon, 2 in TypeScript.

**The result that matters, and it is a product finding rather than a measurement.** For `toml-python` the IR represents 345 statements and conceals **496 semantic source statements** beneath four container types. The opacity rate of 9.9 percent was never a claim that 90 percent of the corpus is represented; it was a claim about the statements the IR chose to count. Counting what the containers hold says the unrepresented majority of that corpus was never in the denominator at all. radon conceals 270 against 435 represented, TypeScript 153 against 240. **No opacity number is corrected by this, and no figure is restated:** the two populations are not comparable, which is the next point.

**Source statements are not IR statements, and the instrument says so with its output.** One source statement can become several IR statements: a tuple assignment becomes one binding per target, and a conditional expression becomes a branch with two arms. On radon the instrument counts 430 represented source statements against the measure's 435 IR statements, and the difference is exactly that. So a hidden count is a count of what is concealed, never a number to add to the measure's total, and the instrument prints that limit with every report. Whether hidden statements belong in a flattened count is a representation question for later, and I-1 makes no claim about it.

**Two things the walk established that were not predicted.**

- **A nested function's body is not hidden.** Both adapters encode nested functions as executables of their own, so those statements are represented, and what a nested `def` container conceals is the construction of the closure rather than its body. No `function_definition` row appears in radon's container table for that reason.
- **Statements outside any encoded function are a separate population, and a large one.** radon 224, `ir0-typescript` 117, `toml-python` 72: module-level and class-body statements that no adapter encodes. They are not hidden by the frozen definition, since no opaque container is above them, and they are counted apart rather than mixed in. `ir0-typescript` additionally has 14 statements in arrow and function expressions, which the TypeScript adapter does not encode at all. Neither population is claimed as opacity here; both are named so they stop being invisible.

**A design decision that goes against the letter of the ruling, with the reason.** Exporting the adapters' classification functions was approved, but `test/ir/frozen.test.ts` freezes the adapters by **byte hash**, so exporting a function would change those bytes and force a re-freeze of the encoder in force. A freeze that is re-taken to accommodate an instrument is not a freeze. So `src/query/containers.ts` carries a second copy of the classification tables, the adapters are untouched, and the agreement is proved by measurement instead of by construction: tests assert the instrument classifies a docstring non-semantic, an import metadata, and a `yield` semantic, inside and outside containers, exactly as the adapters do. The copy is marked in the file as a deliberate duplicate with that reason.

**An instrument defect found and fixed before the measurement was recorded.** The first run reported 36 hidden `string` statements in `ir0-typescript`. They were `case` labels: the value a `switch` matches is a named child of the case node, and the walk counted it as a statement. A case label is no more a statement than an `if`'s condition. Fixed, and the corpus's hidden count fell from 194 to 158. Recorded rather than tidied away, because it is the same class of defect as counting docstrings as opaque: an instrument counting something that is not the thing it claims to count.

### I-1 on Windows: not yet run

## I-1 confirmed on Windows, 2026-09-17

win32 x64, Node 22.22.0, build `d35f26db56d4`. 108 of 108 passing, including the eight I-1 tests and the assertion that radon conceals 33 yields. All three corpora reproduce their IR-9 rows, and every figure above the new section is identical to the Linux run.

```
                 hidden (semantic)   by nearest container
radon-python       285 (270)         for 200, try 65, with 12, while 8
toml-python        507 (496)         for 294, while 136, try 75, with 1, class 1
ir0-typescript     158 (153)         switch 107, for-in 31, for 10, try 6, while 4
```

Deepest nesting reproduces too: 5 containers above one statement in `toml`, 4 in radon, 2 in TypeScript. Represented source statements: radon 430 semantic against 435 IR statements, `toml` 383, `ir0-typescript` 196. Statements outside any encoded function: radon 224, `ir0-typescript` 117 plus 14 in arrow or function expressions, `toml` 72.

So I-1 is confirmed on two platforms, and the headline holds on both: `toml-python` represents 345 statements and conceals 496 semantic source statements, which is the first measurement in this project of what the opaque containers were holding rather than how many of them there are.

**Presentation defects, recorded separately from the measurements, and the same family as the six before them.** Each Windows `measure` transcript drops exactly one line from the middle of its construct table: radon loses `39 if_statement`, `toml-python` loses `61 augmented_assignment`, and `ir0-typescript` loses `27 if_statement`. The lists are otherwise identical to the Linux run and the totals above them are unaffected, so whatever is dropping these lines drops one per list and does not touch a number. That is now seven transcripts in one day with a missing line, always mid-list, which starts to look like a property of the transcript rather than of any one report.

## C-2 scope, ruled before the work, 2026-09-17

C-2 was approved as a change to the Python adapter alone. Building it found that it cannot be: the two new names are language-neutral categories, and that vocabulary lives in `src/ir/index.ts`, which is frozen by byte hash. The adapter maps its own node types onto that list precisely so two grammars never disagree because they use different words for what neither can represent, so the Python adapter cannot carry a category the IR does not have. The work stopped and the choice went back rather than being decided at the keyboard.

**The ruling.** Widen `OPAQUE_CATEGORIES`, keep `ir_schema` at 5, move the Python adapter from `python-adapter/0.4` to `python-adapter/0.5`, leave `typescript-adapter/0.3` exactly as it is, and freeze the two changed files in `frozen-c2` while `frozen-ir9` is preserved byte for byte. An encoder version identifies a semantic change to that encoder, never a project-wide milestone.

**The rationale, recorded as he gave it.** `ir_schema` versions the structure and semantics of the representation contract. C-2 extends a closed classification vocabulary but does not alter the structure of the IR, add fields, change relation shapes, or change how a consumer interprets an existing field. The schema therefore stays at 5, while the changed IR vocabulary artifact is independently frozen with C-2. The claim is not that the IR file is unchanged. It is that the change does not rise to a schema-version change.

**The compatibility consequence, recorded as a finding and deliberately not solved here.** A consumer that hard-codes the schema-5 opaque-category list can reject a valid C-2 schema-5 document even though the structural schema is unchanged. The category vocabulary is therefore a versioned and frozen dependency of schema 5, and no consumer may assume `ir_schema` alone identifies the vocabulary revision. Whether the representation needs its own vocabulary version rather than overloading `ir_schema` is a later decision; C-2 does not take it. The note lives in `src/ir/index.ts` beside the list as well as here.

## C-2 Python yield split, measured on Linux 2026-09-17

Encoder change, full ceremony. `python-adapter/0.5`, `typescript-adapter/0.3` untouched, `ir_schema` 5, `frozen-c2` established for the Python adapter and the IR vocabulary, `frozen-ir4`, `ir5`, `ir7` and `ir9` all preserved, a row appended to all three corpora and none edited, every IR-6, IR-7, IR-8, E1, E2-cross and E3 control re-run. Build `d35f26db56d4` becomes `cfd813c76e4d`. 116 tests (108 before, 8 added).

**The rule, fixed before the measurement.** A `yield` inside a function declared `@contextmanager` is `scoped-resource-handoff`; every other `yield` is `value-stream-emission`. The decorator name is matched as written, including a dotted `contextlib.contextmanager`.

**Predictions, scored. Every one passed.**

```
radon-python     statements 435, opaque 81 = 18.6%      unchanged
                 other 23 -> 0
                 value-stream-emission    20
                 scoped-resource-handoff   3   cli/tools.py 40, cli/tools.py 220, cli/__init__.py 433
toml-python      345 / 34 / 9.9%, both fingerprints    unchanged (no yield in the corpus)
ir0-typescript   240 / 16 / 6.7%, both fingerprints    unchanged (adapter untouched)
```

Invocations 202, CALLS 39, FLOWS_TO 164, REPRESENTATION_LOSS 81, all seven I-0 identities, 109 flows walked, 2 qualifying, 0 sufficient: all unchanged, and the radon sufficiency and graph reports are identical line for line apart from the category names.

**The graph's operation table behaved as predicted and is worth stating precisely:** `23 opaque:other` became `20 opaque:value-stream-emission` and `3 opaque:scoped-resource-handoff`. Distinct operation names rose from 53 to 54, occurrences stayed at 162. One name became two; the population did not move.

**Fingerprints: one group moved, and it is the right one.** Seven of radon's eight collision fingerprints are unchanged. The eighth, `755edd5baf3c2ee2ef7e27bc`, became `937136f1518166f9c151c29c`: the `_open` pair, whose yields are exactly the ones reclassified as handoffs. A reclassification changes the projection's pseudo-operation name, so a fingerprint moves only where a reclassified statement sits, and that is what happened.

**The negative control, and why it is the part of C-2 that matters.** A function with a single `yield` wrapped in `try/finally`, holding an opened file, named like a resource, and carrying no decorator stays `value-stream-emission`. Nothing about shape, structure, naming, or the presence of `try/finally` may produce a handoff. Only the declared decorator does, and a test pins each of those separately: a plain generator, a decorated one, a dotted decorator, a different decorator, and an aliased decorator (`@cm`) that is deliberately NOT recognised.

**What the classification rests on, stated in the code and in the row.** The decorator name is `DECLARED_BY_AUTHOR` knowledge: a name read from the source, not a fact derived from program semantics. Aliases, imported renames, decorator wrappers, and context managers written without that decorator are not recognised. C-2 tests whether the distinction can be represented at all and claims no general context-manager inference.

**What C-2 did not do.** It represented nothing. Both kinds of yield are still opaque and still semantic, and both still count toward opacity, which is why 81 did not move. And the 33 hidden yields from I-1 remain a source-coverage measurement: they did not enter the IR statement population because a construct acquired a better name.

### C-2 on Windows: not yet run

## C-2 confirmed on Windows, 2026-09-17

win32 x64, Node 22.22.0. 116 of 116 passing, including all eight C-2 tests and the negative control. Every measured value reproduces: radon 435 statements, 81 opaque at 18.6 percent, categories loop 35, value-stream-emission 20, exception-handling 17, declaration 6, scoped-resource-handoff 3, and the same eight collision fingerprints with `937136f1518166f9c151c29c` in place of the old `_open` group. `toml-python` 345 and 34 with both fingerprints unchanged; `ir0-typescript` 240 and 16 with its one remaining `other`, the standalone `await`. All three corpora print `reproduces C-2`. The graph reproduces, including the operation table's `20 opaque:value-stream-emission` and `3 opaque:scoped-resource-handoff` at 54 distinct names and 162 occurrences, and it ends with `every identity holds`. Sufficiency reproduces: 109 flows walked, 2 qualifying, 0 sufficient, same missing facts. The three C-2 rows now read `confirmed: ["linux", "windows"]`.

**A defect in my own procedure, found by the build id doing exactly what it is for.** The Windows run printed build `eac671f84cd2` while the C-2 rows record `cfd813c76e4d`. The cause is sequencing, and it is mine: I measured C-2, wrote the rows with the build id of that moment, and only then added the `step` field to `scripts/measure.ts` so a row could print as `C-2` instead of as a fabricated IR number. That change is display-only, it moved no measured value, and the current build reproduces every figure in the rows on both platforms. But the rows now name a build that no longer exists anywhere, which is precisely the stale-tree confusion the build id was introduced to prevent.

The rows are not edited to paper over it. The buildId field records the tree that produced the measurement, and rewriting it would destroy the only evidence that the sequence went wrong. What the field means from here: **a row's buildId identifies the tree at the moment of measurement, and a later reporting-only change can leave it unreproducible while every value in the row still reproduces.** The procedure that prevents it is simple and is adopted now: no change to `src` or `scripts`, not even a display-only one, between taking a measurement and appending its row. If a reporting change is wanted, make it first and re-measure.

This is the third time in two days that an instrument has been changed at the wrong moment: docstrings counted as opacity, case labels counted as statements, and now a build id recorded before the instrument stopped moving. All three were caught by apparatus rather than by review, which is the argument for the apparatus.

## C-3 `with` as scoped resource, measured on Linux 2026-09-17

Encoder change, full ceremony, and the first one run under the sequencing rule C-2 earned: every instrument and reporting change was made before the measured run, so the build id in the rows, `78c7b3b8d635`, is the tree that produced them and is still the tree today. `python-adapter/0.6`, `typescript-adapter/0.3` untouched, `ir_schema` 5, `frozen-c3` established for the Python adapter and the IR vocabulary, `frozen-ir4`, `ir5`, `ir7`, `ir9` and `c2` preserved, a row appended to all three corpora and none edited, every control re-run. 123 tests (116 before, 7 added).

**The rule, and the reason it is a correction rather than a preference.** A `with` acquires a resource, runs a scope under its lifetime, and releases it on every exit, including an exceptional one. Releasing on an exception is a consequence of the lifetime, not the purpose of the construct, so filing it under exception-handling named the wrong thing. `try` keeps that category.

**Predictions, scored. Every one passed.**

```
radon-python     435 statements, 81 opaque = 18.6%   unchanged
                 exception-handling 17 -> 10
                 scoped-resource            7
toml-python      345 / 34 / 9.9%                     unchanged
                 exception-handling  4 -> 3
                 scoped-resource            1
ir0-typescript   240 / 16 / 6.7%, both fingerprints  unchanged; no construct here is classified by C-3
```

Invocations 202 and 99, CALLS 39 and 12, FLOWS_TO 164 and 75, REPRESENTATION_LOSS 81 and 34, every I-0 identity, and radon's sufficiency report (109 walked, 2 qualifying, 0 sufficient, identical missing facts) are all unchanged. The graph's operation table behaved as at C-2: one name became two, radon's distinct names 54 to 55 and `toml`'s 28 to 29, occurrences still 162 and 87.

**Fingerprints: one group moved, and again it is the right one.** radon's `937136f1518166f9c151c29c` became `2fe3b1a0f4f1dfcd9266565d`. That is the `_open` pair, which holds both a reclassified `with` and the handoff yields C-2 renamed, so it is the one group whose projection contains a C-3 statement. The other seven are unchanged. `toml`'s two are unchanged even though it has a `with`, because the function holding it is in no collision group.

**The two sides of the protocol stay two categories.** `scoped-resource-handoff` is the implementer handing a resource into a caller's scope; `scoped-resource` is the scope that holds it. Merging them would erase direction and lifecycle role, so a test asserts that the provider and the consumer of the same protocol classify differently, and their correspondence is left as a relationship to record later rather than as a merge.

**`async with` is classified as a scoped resource, with the limitation stated rather than hidden.** The category says what the construct does; how execution proceeds is an orthogonal dimension. Inventing an "async scoped resource" category would make two independent dimensions mutually exclusive, and they should compose. So an `async with` is a scoped resource whose asynchronous acquisition, suspension, resumption, release ordering and failure propagation are all still unrepresented, and R-1 is where that is addressed. No `async with` appears in the frozen corpora, so this is established by fixture rather than by corpus measurement.

**The two negative controls pass, and they are the reason this is a classification rather than an inference.** A `try/finally` that acquires and releases by hand, which behaves exactly like a `with`, stays exception-handling. A plain block calling `open` and `close` produces no opaque statement at all. Resemblance, naming, and shape never manufacture the category; only the construct does.

**What C-3 did not do.** It represented nothing. A `with` is still opaque, still semantic, and still counts toward opacity, which is why 81 and 34 did not move. Nothing about acquisition, release ordering, or failure propagation entered the IR.

### C-3 on Windows: not yet run

## C-3 confirmed on Windows, 2026-09-17

win32 x64, Node 22.22.0, build `78c7b3b8d635`, which is the build recorded in the C-3 rows and still the tree on both machines. The sequencing rule held on its first outing. 123 of 123 passing, including the seven C-3 tests, both negative controls, and the frozen-artifact test now covering `frozen-ir4`, `ir5`, `ir7`, `ir9`, `c2` and `c3`.

Every value reproduces. radon: 435 statements, 81 opaque at 18.6 percent, categories loop 35, value-stream-emission 20, exception-handling 10, scoped-resource 7, declaration 6, scoped-resource-handoff 3, and the eight collision fingerprints with `2fe3b1a0f4f1dfcd9266565d` for the `_open` pair. `toml-python`: 345 and 34, exception-handling 3, scoped-resource 1, both fingerprints unchanged. `ir0-typescript`: 240 and 16, untouched. All three print `reproduces C-3`. The graph reproduces, including 55 distinct operation names at 162 occurrences, `7 opaque:scoped-resource`, invocations 202, CALLS 39, FLOWS_TO 164, REPRESENTATION_LOSS 81, and `every identity holds`. Sufficiency reproduces: 109 walked, 2 qualifying, 0 sufficient. The three C-3 rows now read `confirmed: ["linux", "windows"]`.

**Presentation defects, recorded separately as usual.** All three Windows `measure` transcripts dropped the section header `what the IR fails to expose (hidden statements by construct, worst first):` while printing the list under it, and the radon `graph` transcript dropped the `61 receiver arguments in the store` line from the I-0 population table while printing its definition. Ten transcripts across the day have now lost exactly one line each, always a header or a single row, never a figure that another line depends on; the identity that uses the receiver population printed and held in the same run.

## The capture inspection that renamed C-4, 2026-09-17

C-4 was going to call a nested `def` **closure construction**. It was stopped before the encoder changed, on the ground that nesting is not capture: a nested function is a closure only if it captures a binding from an enclosing scope, and nothing measured said these did. The inspection was run first.

**Method.** A scratch scope analysis over the frozen radon corpus, outside the repository. For each nested `def` it collects the enclosing functions' parameters and local bindings, collects the identifiers read inside the nested body that the nested function does not itself bind, and reports which of those are bound in an enclosing function scope. Every one of the six results was then checked by reading the source.

```
site                                   nested in        captures from the enclosing scope
cli/harvest.py:140  caching_iterator    results          NONE
cli/tools.py:117    read_or_stop        detect_encoding  readline
cli/tools.py:123    find_cookie         detect_encoding  filename, bom_found
cli/tools.py:297    get_type            cc_to_dict       NONE
raw.py:151          aux                 _logical         NONE
visitors.py:383     aux                 dispatch         meth
```

**Conclusions, recorded explicitly.**

1. All six statements are runtime local function construction: executing one constructs a function value and binds it in the enclosing scope.
2. Only three of the six capture an enclosing binding. `caching_iterator(it, r)` reads only its own parameters; `get_type(obj)` reads its parameter plus the module-level `Function`; `raw.aux(sub_tokens)` reads only module-level names. **Calling all six closure construction would have been a false claim about half of them.**
3. Capture was mechanically derivable from source syntax, and this inspection derived it.
4. Capture is **not** derivable from the current IR: identifier identity does not survive the adapter by design, so no name is available to resolve against an enclosing scope.
5. Therefore capture and closure semantics belong to a later representation step, not to a classification step. Computing them inside a C-step would smuggle name resolution into a round that is supposed to change only a label.

**The analyzer's limitation, kept as an experimental caveat.** It was experiment-grade, written for this one question: it approximates comprehension and class scopes and handles `global` and `nonlocal` crudely. It was validated manually against these six sites and is trustworthy for them and for nothing else. **It is not in the repository and must not be elevated into production instrumentation.** If capture is ever claimed as a measured property, it needs a real scope analysis with its own protocol, its own tests, and its own negative controls, and the three zero-capture sites above are the ready-made controls for it.

## C-4 nested `def` as local function construction, measured on Linux 2026-09-17

Encoder change, full ceremony, sequencing rule observed: no instrument or reporting change after the measured run, so build `db2878f82a3c` is the tree that produced these rows. `python-adapter/0.7`, `typescript-adapter/0.3` untouched, `ir_schema` 5, `frozen-c4` for the Python adapter and the IR vocabulary, `frozen-ir4`, `ir5`, `ir7`, `ir9`, `c2` and `c3` preserved, a row appended to all three corpora and none edited, every control re-run. 130 tests (123 before, 7 added).

**The category, worded to say exactly what the syntax proves and no more:** `local-function-construction`, execution constructs a function value and binds it within an enclosing executable scope.

**Predictions, scored. Every one passed.**

```
radon-python     declaration 6 -> 0, local-function-construction 6
                 435 statements, 81 opaque = 18.6%          unchanged
                 all eight collision fingerprints           unchanged
toml-python      nested class_definition stays declaration; nothing else moves
ir0-typescript   unchanged
```

Invocations, CALLS, FLOWS_TO, REPRESENTATION_LOSS, every I-0 identity and the whole sufficiency report are unchanged on all three corpora. The graph's operation table shows `6 opaque:local-function-construction` where it showed `6 opaque:declaration`, with the distinct-name count and the occurrence count both unmoved, because this step renames a category rather than splitting one.

**Fingerprints did not move at all, and that is a result rather than an absence.** The prediction allowed movement only where one of the six statements sits. None of the six sits in a function that collides with another, so no fingerprint changed. C-2 and C-3 each moved exactly one group for the same reason in reverse.

**Why the adapter needs no nesting test.** A `def` reaches the statement classifier only as a statement inside another function's body. A module-level or class-body `def` never passes through it: each is encoded as an executable of its own. So negative controls 1 and 2 hold by construction, and the tests assert the observable consequence, that those cases produce no opaque statement anywhere. Control 3, the nested class, stays `declaration` and is the toml case pinned as a test. Control 4 is a nested `def` that captures nothing, which is still local function construction, with radon's three zero-capture sites named in the test as the real instances.

**Two observations, recorded and deliberately not acted on.**

- **The residual `declaration` category.** Across the three corpora it now holds imports and class definitions only, and `toml`'s single remaining member is a nested class. Whether it should be split, and along what line, is its own question and does not get solved opportunistically inside a classification step.
- **A decorated nested `def` is still `declaration`.** The adapter sees `decorated_definition` rather than `function_definition` for one. None of radon's six is decorated, so this changes no count here, and it is a gap in the rule rather than in the measurement.

### C-4 on Windows: not yet run

## C-4 confirmed on Windows, 2026-09-17

win32 x64, Node 22.22.0, build `db2878f82a3c`, the build recorded in the C-4 rows and still the tree on both machines. 130 of 130 passing, including the seven C-4 tests and the frozen-artifact test across `frozen-ir4`, `ir5`, `ir7`, `ir9`, `c2`, `c3` and `c4`.

Every value reproduces. radon: 435 statements, 81 opaque at 18.6 percent, categories loop 35, value-stream-emission 20, exception-handling 10, scoped-resource 7, local-function-construction 6, scoped-resource-handoff 3, all eight collision fingerprints unchanged from C-3. `toml-python`: 345 and 34, declaration 1 (the nested class), scoped-resource 1. `ir0-typescript`: 240 and 16, untouched. All three print `reproduces C-4`. The graph reproduces with `6 opaque:local-function-construction` in place of `6 opaque:declaration`, 55 distinct names at 162 occurrences, and `every identity holds`. Sufficiency reproduces: 109 walked, 2 qualifying, 0 sufficient. The three C-4 rows now read `confirmed: ["linux", "windows"]`.

With C-4 confirmed, radon's opaque population is fully named for the first time: six categories, none of them `other`, and each one a statement about what the construct does rather than what grammar node it came from. The one `other` left in any corpus is the standalone `await` in `ir0-typescript`, which is C-5.

**Presentation defects, recorded separately.** The same two lines as at the C-3 confirmation: all three `measure` transcripts dropped the `what the IR fails to expose` header, and the `graph` transcript dropped the `61 receiver arguments in the store` row while printing its definition and while the identity that uses it held. Same family, same shape.

## C-5 scope, ruled before the work, 2026-09-17

Two rulings before the encoder changed.

**Both adapters change.** Completion dependency is a shared language-neutral classification, not a TypeScript patch, so `typescript-adapter/0.3` moves to `0.4` and `python-adapter/0.7` to `0.8`, with all three files frozen in `frozen-c5`. A Python version bump with no measured movement is correct: the adapter's behaviour changed, and its version describes behaviour, not whether the frozen corpora happen to exercise it.

**The category is `completion-dependency`, and it is narrow.** The first draft of control 2 would have classified a standalone `await foo()` as a completion dependency, which would have turned a statement the IR represents as a call effect into an opaque one. A C-step may not buy a label with a represented fact. So the definition became: a standalone awaited expression whose operand the current adapter cannot otherwise represent as a semantic statement, where normal continuation depends on completion of that awaited computation. Not in C-5: suspension mechanics, scheduler behaviour, continuation ordering beyond the existence of the dependency, resolved value identity, failure propagation, and the distinction between an immediately and an asynchronously completed awaitable. The name was chosen over `completion-suspension` because the syntax establishes the dependency and says nothing about how the runtime suspends.

## C-5 the standalone await, measured on Linux 2026-09-17

Encoder change, full ceremony, sequencing rule observed: build `afbddabae98a` is the tree that produced the rows. `typescript-adapter/0.4`, `python-adapter/0.8`, `ir_schema` 5, `frozen-c5` holding both adapters and the IR vocabulary, every earlier freeze preserved, a row appended to all three corpora and none edited, every control re-run. 138 tests (130 before, 8 added). This is the first C-step to change the TypeScript adapter, and the frozen-artifact test that pinned it to `frozen-ir9` through C-2, C-3 and C-4 now pins it to `frozen-c5`.

**Predictions, scored. Every one passed.**

```
ir0-typescript   other 1 -> 0, completion-dependency 1 at adapters/treeSitter.ts:11
                 240 statements, 16 opaque = 6.7%, both collision groups   unchanged
radon-python     no measured movement (no bare await in the corpus)
toml-python      no measured movement (no await at all)
```

Every graph, invocation, flow, representation-loss and sufficiency total is unchanged on all three corpora; the only line that differs in any graph report is the `REPRESENTATION_LOSS` operation list, which now reads `opaque:completion-dependency` where it read `opaque:other`.

**The seven controls, each pinned by a test, and the boundary they draw.**

1. `foo();` is a represented call effect.
2. `await foo();` is also a represented call effect, its completion dependency still lost. The test asserts the awaited and unawaited forms encode identically today, which is the erasure R-1 targets.
3. `await ready;` is `completion-dependency`, because the adapter has no richer representation for the operand.
4. Python and TypeScript agree on both standalone forms.
5. `x = await foo()` is unchanged: a binding with the await erased.
6. `return await foo()` is unchanged: on the return path with the await erased.
7. Async function context alone creates no completion dependency; the explicit `await` is the evidence.

**A cross-language disagreement found while pinning control 5, recorded for R-1 and not touched here.** TypeScript keeps the call inside a bound await and erases only the await: `const y = await foo(x)` encodes identically to `const y = foo(x)`. Python does worse: `y = await foo(x)` becomes a binding whose whole expression is `unknown`, reason `await`, so the call is lost as well as the await. The two adapters therefore agree on the standalone forms after C-5 and disagree on the bound form. That is a representation asymmetry, it is exactly the kind of thing E1-cross exists to catch, and it goes on R-1's list rather than being fixed in a classification step.

**The key conclusion.** C-5 eliminates the final `other` category without reducing existing representation. It can name completion dependency only when no richer statement representation already exists. **Await is still not compositional in the IR.**

**The handoff into R-1, stated as a falsifiable target.** The same semantic modifier must survive across at least these four forms without sacrificing the operand's existing meaning: `await ready`, `await foo()`, `x = await foo()`, and `return await foo()`. Today the first is named and the other three erase it, and Python erases more than TypeScript in the third. C-5 has named the remaining unknown; R-1 must preserve it.

**The C-series is closed.** Across the three corpora the opaque population now carries no `other`: loop 35 and 29 and 9, multi-branch 6, exception-handling 10 and 3, scoped-resource 7 and 1, scoped-resource-handoff 3, value-stream-emission 20, local-function-construction 6, declaration 1, completion-dependency 1. Five encoder versions, five frozen artifacts, every count of statements, opacity, invocations, flows and sufficiency unchanged from IR-9 to C-5, and every label change attributable to one semantic distinction. What the series did not do, by design, is represent anything: the same 81, 34 and 16 statements are opaque now as at IR-9, and they are opaque under names that say what they are.

### C-5 on Windows: not yet run

## C-5 confirmed on Windows, 2026-09-17

win32 x64, Node 22.22.0, build `afbddabae98a`, the build recorded in the C-5 rows and still the tree on both machines. 138 of 138 passing, including all eight C-5 controls and the frozen-artifact test now pinning the TypeScript adapter to `frozen-c5` for the first time.

Every value reproduces. `ir0-typescript`: 240 statements, 16 opaque at 6.7 percent, categories loop 9, multi-branch 6, completion-dependency 1, both collision fingerprints unchanged. radon: 435 and 81, six named categories, all eight fingerprints unchanged. `toml-python`: 345 and 34, unchanged. All three print `reproduces C-5`. radon's sufficiency reproduces: 109 walked, 2 qualifying, 0 sufficient. The three C-5 rows now read `confirmed: ["linux", "windows"]`.

**What this confirmation did not cover, stated so it is not assumed.** The `graph` report was not run on Windows for C-5. The only line C-5 changes in any graph report is the `REPRESENTATION_LOSS` operation list, which now reads `opaque:completion-dependency` where it read `opaque:other`, and that was confirmed on Linux. Every graph total the C-series holds fixed was confirmed on Windows at C-4 on the same store, and C-5 changes no assertion, so the omission is a gap in the transcript rather than a doubt about the graph, and it is recorded rather than glossed.

**Presentation defects, same family.** All three Windows `measure` transcripts dropped the `what the IR fails to expose` header while printing the list beneath it, as at C-3 and C-4.

**The C-series is confirmed closed on two platforms.** From IR-9 through C-5: five encoder steps, seven frozen artifacts including the two instrument steps' baselines, and every count of statements, opacity, invocations, flows and sufficiency identical at both ends. No `other` remains in any corpus. R-1 is next and needs its own protocol before any code moves, because it is the first step since IR-9 expected to change what the IR represents rather than what it calls things.

## R-1A Composable completion dependency: protocol and predictions frozen before the work, 2026-09-17

The first representational change since IR-9. Drafted as a full R-1 protocol (R-1A, R-1B, R-1C), reviewed by him, corrected twice, and only R-1A is frozen here. R-1B and R-1C are described at the end so R-1A is designed with them in view, and nothing in them is frozen by this entry.

Baseline: build `afbddabae98a`, `python-adapter/0.8`, `typescript-adapter/0.4`, `ir_schema` 5, the C-5 rows on all three corpora, confirmed on linux and windows.

### The hypothesis

A completion dependency is a property of an evaluation, not of a call and not of a statement. Represented as a wrapper around an expression, one construct covers all four forms in both languages, and adding it costs no existing fact.

### The monotonicity requirement, tested at the operand and projection level

R-1A may add semantic information. It may not discard an operand fact that C-5 already represents. For every form in both languages, every operand fact C-5 represents must be present unchanged under R-1A, plus the completion dependency. For a call, the projected call outcome before and after must agree on operation identity, arguments, receiver, path condition, and invocation outcome; separately, R-1A must add exactly the completion-dependency outcome and nothing else. Whole-IR byte equality after stripping the wrapper is required only where the enclosing carrier does not change (bound and returned forms); it is NOT required for a standalone awaited call, whose carrier changes from `effect` to `evaluate` by design.

One exception, in the baseline only: Python's bound await loses the call today (`y = await foo(x)` is a binding whose expression is `unknown`). R-1A recovers the call and brings Python to the TypeScript semantic shape. It does not preserve the loss.

### The representation change, exactly

**One new expression form** in `src/ir/index.ts`:

```
Expr = ... | { kind: "awaited"; of: Expr }
```

The value of `of`, once its evaluation has completed. The whole modifier. Not on `Call`, not on `Operand`, not on `Stmt`. It reaches all four positions because `Operand.computed` already lifts any `Expr` into operand position.

**Nesting is preserved, never canonicalised.** `awaited(awaited(e))` is two completion dependencies. An awaited evaluation can itself produce an awaitable, and Python distinguishes `await e` from `await await e` by what the first evaluation produces, so collapsing the nesting is not a language-neutral equivalence and is not done without a later language-specific proof.

**One new statement carrier, used only where the IR had none:**

```
Stmt = ... | { kind: "evaluate"; expr: Expr }
```

Not the modifier; it carries no await-specific field. It is the carrier for an expression evaluated for its effects, which the IR lacked, which is exactly why `await ready;` was opaque. In R-1A it is produced only for a standalone awaited expression. A plain `foo();` stays `effect`. **The asymmetry between ordinary and awaited expression statements is accepted as a scoped R-1A design choice and is not declared the final IR architecture.** Folding every expression statement into `evaluate` is a separate decision.

**The four forms, both languages:**

```
await ready;          C-5: opaque completion-dependency            R-1A: evaluate{ awaited{ operand ready } }
await foo(x);         C-5: effect{ CALL_EXTERNAL foo }             R-1A: evaluate{ awaited{ call foo } }
y = await foo(x)      C-5: TS bind{ call foo }, PY bind{ unknown } R-1A: bind{ awaited{ call foo } } in both
return await foo(x)   C-5: return{ computed{ call foo } }          R-1A: return{ computed{ awaited{ call foo } } }
```

**The projection.** Every existing outcome is emitted unchanged. For each `awaited`, the projection adds one outcome, a tagged union, never an overloaded field:

```
{ kind: "COMPLETION_DEPENDENCY", under: <path condition>, at: <source await point>,
  on: { kind: "outcome"; index: <the outcome produced by `of`> }
    | { kind: "evaluation"; operand: <the operand of `of`> } }
```

`on.outcome` when `of` produces a projected outcome (a call); `on.evaluation` when it produces none (`await ready`). Both forms carry provenance to the source await point. No `awaited` field is added to the call or effect outcome, so operand semantics are untouched and R-1B has something independently identifiable to promote into a graph relation. The fingerprint changes for every function containing an await, which is what flips the negative controls.

**Why not the alternatives.** `Call { awaited: true }` cannot cover `await ready` and would need a second flag on the binding and a third on the return: the C-5 problem again. A `Stmt` field cannot cover `return await foo()`. An `Operand` flag would need a matching `Expr` flag because a bound call is an `Expr`. The expression wrapper is the only single construct reaching all four positions.

**The graph in R-1A: no new relation.** Ingestion writes nothing new. The dependency lives in the IR and the projection. Whether and how it becomes a relation is R-1B's question, and keeping it out of R-1A is what makes R-1A's graph predictions exact.

**Schema and versions.** `ir_schema` 6: a new expression kind and a new statement kind change how a consumer interprets the representation. `python-adapter/0.9`, `typescript-adapter/0.5`. `frozen-r1a` holds `ir-index.ts`, `python-index.ts`, `typescript-index.ts`; every earlier freeze untouched. The `completion-dependency` opaque category **stays in the vocabulary as a legacy schema-5 representation-loss category**, because valid schema-5 documents contain it; schema-6 adapters must never emit it, and a test enforces that.

**Rule in force from C-2:** no change to `src` or `scripts` between the measured run and the appended rows.

### Predictions, ir0-typescript (five measured awaits)

1. All five completion dependencies survive into the IR: `adapters/treeSitter.ts` 11 (standalone), 15 and 22, `adapters/python/index.ts` 9, `adapters/typescript/index.ts` 12 (bound).
2. The four bound call operands retain operation, arguments, receiver, path condition, and outcome exactly as at C-5.
3. `await ready;` becomes `evaluate{awaited{operand}}` and stops being opaque. `ready` is a module-level name the adapter does not model, so it encodes as `unknown`: the statement is represented, the operand is not identified. Stated now so 16 to 15 is not read as "fully represented".
4. Opaque 16 to 15. Semantic statements stay 240: `evaluate` replaces one opaque statement one for one, and no form changes statement cardinality.
5. Fingerprints change for exactly the five functions holding an await: `loadLanguage`, TypeScript `parse`, Python `parse`, and the two `encodeFunctions`. Neither collision group contains any of them, so both groups are unchanged.
6. Graph, exact because R-1A writes no new relation: the opaque statement's pseudo-invocation disappears. REPRESENTATION_LOSS 16 to 15; invocations 81 to 80; unresolved 63 to 62; HAS_INVOCATION and HAS_OUTCOME each 81 to 80; assertions 861 to 859. CALLS 16, FLOWS_TO 67, resolved 16, ambiguous 1, self 1, receiver populations 46 and 55: unchanged. No existing real call disappears. All seven I-0 identities hold. **Tests derive these from the representation rules (one pseudo-invocation per opaque statement, two assertions per invocation), not from hard-coded totals.**
7. Sufficiency: flows disqualified by opacity 16 to 15. Qualifying stays 1, because `loadLanguage`'s flow still fails "fewer than 3 executables". Should it ever qualify, its missing facts will include `OPERAND_UNIDENTIFIED` for `ready`.

### Predictions, Python corpora

No measured movement in radon or toml: neither contains an await. Rows appended, identical, with the note saying so. Fixtures establish the new Python behaviour.

### Negative controls, as semantic-equivalence tests

- N1. `await foo(x); bar(x)` and `foo(x); bar(x)` fingerprint differently. C-5 control 2 asserts equality today; R-1A flips it.
- N2. `const y = await foo(x); return y` and `const y = foo(x); return y` fingerprint differently. C-5 control 5 asserts equality today; flipped.
- N3. `return await foo(x)` and `return foo(x)` fingerprint differently.
- N4. Async context alone changes nothing: an async function with no await fingerprints identically to the non-async form (C-5 control 7, kept).
- N5. Monotonicity at the projection level, as stated above, for all eight fixtures.
- N6. **Nesting is preserved:** `await await foo()` retains two nested `awaited` modifiers and two `COMPLETION_DEPENDENCY` outcomes, and does not canonicalise to `await foo()` merely because both use the same source construct.

### Positive control, criterion stated semantically

`y = await foo(); return y` and `return await foo()` must converge **if** IR-2's single-use binding normalisation already establishes their equivalence for the unawaited forms. IR-2 is not changed and no new inlining is added to make this pass. If existing normalisation does not make the forms equivalent, that is recorded as a finding about normalisation, not tuned away in R-1A. Completion dependency changes semantics; spelling does not.

### Cross-language controls

- X1. The Python asymmetry closes: Python `y = await foo(x)` encodes as `bind{awaited{call foo}}` with operation, argument, and outcome, matching TypeScript.
- X2. E1-cross passes on the bound form for the first time: the section-16 pair with an awaited publish projects identically in both languages because the await is represented on both sides, not because it is erased on both sides.
- X3. All four forms, both languages, eight fixtures, pairwise identical projections.

### Falsifiers

Any C-5 operand fact absent under R-1A (N5). Opaque other than 15 or statements other than 240 in ir0-typescript. Any graph total other than the exact values above. Either collision group changed. X2 fails. Nesting collapses (N6). A schema-6 adapter emits `completion-dependency`.

### What R-1A does not claim

No ordering relation in the graph. Nothing about when or how the runtime suspends or resumes. No failure semantics. No identity for the awaited value beyond what the operand already carried. No claim that `evaluate` is the final carrier for expression statements.

### R-1B and R-1C, in view but not frozen

**R-1B, continuation ordering.** The semantic fact is that normal continuation past the await point depends on completion of the awaited evaluation, and it belongs in the graph where `ORDER_UNSPECIFIED` can see it. The relation is decided by experiment: whether `FOLLOWS(control)` lets the sufficiency checker derive the ordering from the store alone, or whether a narrower relation is needed. His note for when it is written: the await establishes a dependency on the continuation frontier, not a direct edge to every later operation, so immediate continuation plus transitive derivation is to be weighed against writing an edge to each successor.

**R-1C, failure propagation.** A failure produced by the awaited evaluation is observed at the await point and enters the enclosing control-flow and error-handling context there; the IR records where it enters, not where it escapes, since an enclosing `try` may handle it. Reusing `THROW` is provisional: it must first be established that `THROW` means "an exception enters control flow here" and not "the source executed an explicit throw or raise", and that relation's meaning is not broadened silently.

Neither starts until the previous stage is confirmed on both platforms and has its own frozen protocol.

## R-1A Composable completion dependency, measured on Linux 2026-09-17

Representation change, full ceremony, sequencing rule observed: build `392244d37f62` is the tree that produced the rows and no instrument moved after the measured run. `ir_schema` 6, `python-adapter/0.9`, `typescript-adapter/0.5`, `frozen-r1a` holding both adapters and the IR, every earlier freeze untouched, a row appended to all three corpora and none edited, every control re-run. 152 tests (138 before, 14 added, and C-5's erasure controls flipped as the protocol said they would). Every frozen prediction is scored below as written, including the two that failed and the three things nobody predicted, before any corrective change; none has been made.

### What was built, exactly as frozen

`Expr` gained `{ kind: "awaited"; of: Expr }`. `Stmt` gained `{ kind: "evaluate"; expr: Expr }`, produced only for a standalone awaited expression. The projection emits every existing outcome unchanged and adds one `COMPLETION_DEPENDENCY` outcome per `awaited` level, targeting a tagged union: `on.outcome` carrying the inner call's projected outcome, or `on.evaluation` carrying the operand when the evaluation produces no outcome of its own. No outcome was manufactured for `await ready`. Nesting is preserved: `await await foo()` is two modifiers and two dependency outcomes. Both adapters produce the modifier at every await; Python's `expression()` gained an `await` case, which is what recovers the call it used to lose. Consumers that looked for a call inside a bound or returned expression (`ingest`, `producer`, `match`) see through the wrapper, which preserves facts and adds nothing.

**One design decision made during the build, recorded rather than buried.** The frozen protocol wrote the dependency's target as an outcome *index*. The projection is sorted, so an index is not stable; the target is the outcome's *content* instead. The tagged union and its two cases are exactly as frozen; only the identification of the outcome changed, and content identity is what the projection already uses for everything else.

### Predictions, scored

1. **All five completion dependencies survive into the IR: passed.** `treeSitter.ts` 11 standalone, 15 and 22, `python/index.ts` 9, `typescript/index.ts` 12 bound. A test counts five `COMPLETION_DEPENDENCY` outcomes across the corpus and one `evaluate` statement.
2. **The four bound call operands keep operation, arguments, receiver, path condition and outcome: passed.** The projection-level monotonicity test strips the wrapper and the dependency from each of the eight fixtures and requires what remains to equal the C-5 projection recorded in `test/ir/golden-c5-await.json` before the encoder changed. For a call under a branch, the `CALL_EXTERNAL` outcome is byte-identical before and after and exactly one outcome is added.
3. **`await ready` is represented, its operand not identified: passed as stated.** `evaluate{awaited{operand}}`, the operand `unknown`, nothing manufactured.
4. **Opaque 16 to 15, statements 240: passed.**
5. **Fingerprints change for exactly the five await-bearing functions, collision groups unchanged: FAILED as written.** Every fingerprint in every corpus changed, including all of radon's and `toml`'s, which contain no await. The cause is not the representation: `fingerprint()` hashes `ir: IR_SCHEMA` into the digest, so a schema bump moves every value. This was visible in the code and I did not read it into the prediction; the C-series never tripped it because it held the schema at 5. **Collision-group MEMBERSHIP is unchanged in all three corpora**, which is the semantic half of the prediction, and the rows record the new values with the reason. The prediction should have said: values move with the schema, membership moves only where semantics move.
6. **Graph totals: passed on every predicted figure, with one unpredicted movement.** REPRESENTATION_LOSS 16 to 15; invocations 81 to 80; unresolved 63 to 62; HAS_INVOCATION and HAS_OUTCOME 81 to 80; assertions 861 to 859; CALLS 16, FLOWS_TO 67, resolved 16, ambiguous 1, self 1, receiver populations 46 and 55 unchanged; `every identity holds`. **Not predicted:** HAS_EFFECT fell 77 to 76, which is the opaque statement's pseudo-effect leaving and should have been in the prediction; and HAS_PREDICATE rose 95 to 96. That rise is the one place R-1A touched the graph without meaning to: ingestion writes a `HAS_PREDICATE` for every projected outcome carrying a path condition, and one of the five dependency outcomes (`lang = await Language.load(...)` under `not lang`) now carries one. The total 859 came out as predicted only because the two unpredicted movements cancel. Recorded, not corrected: whether the dependency's path condition belongs in the graph is R-1B's design question, and silently suppressing it now would prejudge it.
7. **Sufficiency: FAILED, in the direction of more askable flows.** Predicted: opacity disqualifications 16 to 15 (passed) and qualifying flows unchanged at 1 (failed). **Two flows now qualify.** The prediction reasoned about `loadLanguage`'s own flow, which still fails on length, and missed the flows that *reach* it: `encodeFunctions` (3 executables, 8 predicates, 10 effects) was disqualified only by the opaque statement inside `loadLanguage`, and with that represented it qualifies, with 27 missing facts: EFFECT_UNDERSPECIFIED 10, CALLEE_UNIDENTIFIED 8, RECEIVER_UNIDENTIFIED 6, ORDER_UNSPECIFIED 3. This is the second time the checker has qualified a flow the prediction said it would not (IR-9 was the first), and both times the cause was the same: representing one construct unblocks every flow that passes through it, not only the flow that contains it. **And the flow contains an await, so `ORDER_UNSPECIFIED` 3 on a real qualifying flow is now R-1B's target, measured rather than hypothetical.**
8. **Python corpora: no measured movement: passed.** Categories, counts, and group membership identical; fingerprint values moved with the schema.

### Controls

- **N1, N2, N3 passed:** the awaited and unawaited forms of a call statement, a binding, and a return fingerprint differently in both languages. C-5's controls 2, 5 and 6, which asserted the erasure, are flipped in `test/ir/c5-await.test.ts` with their history kept in the file.
- **N4 passed:** async context alone changes nothing.
- **N5 passed** at the projection level for all eight fixtures and for a call under a branch.
- **N6 passed:** `await await foo()` keeps two modifiers, two dependencies, and does not collapse.
- **Positive control: condition not met, recorded as a finding, nothing tuned.** IR-2 does not make the unawaited `y = foo(); return y` and `return foo()` equivalent, because a call is never inlined (moving an effect moves when it happens). So the awaited forms are not required to converge, and they do not; a test pins both halves so the finding cannot drift.
- **X1 passed:** Python's bound await keeps the call under the dependency and matches TypeScript. **Unpredicted:** Python's *returned* await also lost the call before R-1A (`return await foo(x)` was `return{unknown}`), which the frozen protocol did not name; the same recovery fixes both, and the golden test treats the returned form as the same deliberate exception.
- **X2 passed, after catching a defect in the first build.** The section-16 pair with an awaited publish now converges because the await is represented on both sides, and the awaited pair is distinguishable from the unawaited pair. On the first build X2 FAILED: the two languages agreed on every semantic fact and differed only on the dependency's provenance, `at.statement` 2 against 5, because the nested-if spelling and the early-return chain reach the await at different walk ordinals. Provenance had leaked into the fingerprint. The fix, made before the measured run: `at` stays on the projected outcome for auditing and is excluded from the fingerprint by `withoutProvenance`. X2 exists to catch exactly this and did.
- **X3 passed:** all four forms project identically across the two languages, provenance excluded.

### What this establishes

One previously unrepresented semantic construct became represented without sacrificing any represented operand fact, in both languages, and the modifier reaches all four forms through one construct. Await is now compositional in the IR. What it is not yet is visible to the graph as an ordering, which is R-1B, and R-1B has a measured target it did not have this morning: a qualifying flow with an await in it and `ORDER_UNSPECIFIED` 3.

### What R-1A does not claim

No ordering relation. Nothing about suspension or scheduling. No failure semantics. No identity for `ready`. `evaluate` is a scoped carrier, not the final statement model.

### R-1A on Windows: not yet run

## R-1A confirmed on Windows, 2026-09-17

win32 x64, Node 22.22.0, build `392244d37f62`, the build recorded in the R-1A rows and still the tree on both machines. 152 of 152 passing, including the fourteen R-1A tests, the flipped C-5 controls, and the frozen-artifact test pinning all three encoder files to `frozen-r1a`.

Every value reproduces. `ir0-typescript`: 240 statements, 15 opaque at 6.3 percent, categories loop 9 and multi-branch 6 with no `other` and no legacy `completion-dependency`, both collision groups with the same membership and the schema-6 values. radon: 435 and 81, six categories, eight groups. `toml-python`: 345 and 34. All three print `reproduces R-1A`. The `ir0-typescript` graph reproduces exactly: 859 assertions, HAS_PREDICATE 96, HAS_EFFECT 76, invocations 80, unresolved 62, REPRESENTATION_LOSS 15 with the loss list reading `opaque:loop, opaque:multi-branch`, CALLS 16, FLOWS_TO 67, and `every identity holds`. Sufficiency reproduces: 48 walked, 2 qualifying, `encodeFunctions` with 27 missing facts including `ORDER_UNSPECIFIED` 3, `operand` with 24, 0 sufficient. The three R-1A rows now read `confirmed: ["linux", "windows"]`.

So the first representational change since IR-9 is confirmed on two platforms: one construct became represented in both languages without any represented operand fact changing, and the two mispredictions (fingerprint values move with the schema number; a represented construct unblocks every flow that passes through it) and the one unintended graph movement (HAS_PREDICATE 95 to 96, from a dependency outcome carrying a path condition) all reproduce exactly and stand as recorded, unaltered.

**Presentation defects, same family.** All three Windows `measure` transcripts dropped the `what the IR fails to expose` header, and the `graph` transcript dropped the `46 receiver arguments in the store` row while printing its definition and while the identity that uses it held.

## HAS_PREDICATE ruling, and the tree verified before R-1B, 2026-11-02

**Ruling (Michael): keep it.** The `HAS_PREDICATE` assertion written for the completion dependency of `lang = await Language.load(...)` under `not lang` stays in the graph, and `ir0-typescript`'s HAS_PREDICATE count of 96 is correct. The wait happens only when that branch runs, so the condition is part of what the code does, and removing it would discard a represented fact, which no step may do. The R-1A entry stands unaltered: the movement remains an unpredicted finding, scored as a prediction miss and not a defect. No code changed for this ruling.

**Carried into R-1B, not decided here:** whether a dependency's condition keeps the same `HAS_PREDICATE` relation as value outcomes or gets a relation of its own. That is a question for the R-1B protocol.

**Verification before any R-1B work.** Run on Linux in a scratch copy of the tree outside the repository (sources copied, `frozen-*` and `node_modules` linked), so no build output was written into the tree. 152 of 152 tests pass. `measure` on `ir0-typescript` prints build `392244d37f62` and `reproduces R-1A of ir0-typescript, recorded 2026-09-17 at build 392244d37f62, confirmed on linux and windows`. `graph` prints HAS_PREDICATE 96 and `every identity holds`. The tree is exactly as R-1A left it.

## R-1B protocol ruled, and R-1B0 predictions frozen before the work, 2026-11-02

**Rulings (Michael, "Do it", on `docs/r1b-protocol-draft.md` section 7, read as accepting each recommendation):** (1) initiation order and completion order are distinct facts, and that is R-1B's core requirement; (2) program order between observable effects on a path is the default until state reads and writes are represented; (3) R-1B runs as R-1B0 (instrument), R-1B1 (experiment), R-1B2 (representation), in that order, each scored before the next; (4) R-1B1 tries both candidates, `FOLLOWS` widened and a new relation; (5) whether a dependency's condition keeps `HAS_PREDICATE` or gets its own relation becomes a dimension of the R-1B1 experiment rather than a separate ruling.

### R-1B0 scope

Instrument only. `src/query/sufficiency.ts` gains an order accounting, computed over every executable in the corpus and over each thread: the observable effects (`CALL_EXTERNAL`, `WRITE`, `EMIT`) per executable, the pairs among them, and how many of those pairs the store fixes. **Definition, frozen:** a pair is fixed when facts of a relation designated as an order relation connect the two occurrences on one control path, directly or by a chain. No relation is designated in R-1B0. The existing `ORDER_UNSPECIFIED` occurrence and its wording are not changed. No encoder, IR, schema, ingestion, or graph change.

### Predictions, frozen before any code

1. **Every existing figure is unchanged.** `measure`, `graph`, and `sufficiency` print identical values on all three corpora; only the new order section is added. `ORDER_UNSPECIFIED` stays 3 on the `encodeFunctions` thread and 2 on `operand`. No row is appended, as at I-0, because no encoder moved.
2. **Build id moves** from `392244d37f62`, because `src` changes; every corpus still reproduces its R-1A row by value.
3. **Fixed pairs are 0 everywhere, by construction**, and this is a finding rather than a result: effects are stored as literals on `HAS_EFFECT`, with no occurrence identity, so there is no node an order fact could even name. R-1B1 has to give effect occurrences an identity before any candidate relation can be tried.
4. **Corpus-wide counts**, taken from the R-1A store at build `392244d37f62` before any change (a probe outside the repository, reading `HAS_EFFECT` per executable): `ir0-typescript` 18 executables with two or more observable effects, 96 pairs, 96 unordered; `toml-python` 22, 303, 303; `radon-python` 44, 274, 274.
5. **A limit the instrument must state, not hide.** `HAS_EFFECT` carries only `under: true or false`, and `HAS_PREDICATE` is not linked to any particular effect, so the store cannot tell whether two effects can ever run on the same path. Pairs on mutually exclusive branches are therefore counted as unordered. R-1B2 has to carry path membership, or that count stays inflated.

### Controls

- A synthetic store with three effects in one executable reports 3 pairs, 3 unordered; one with a single effect reports 0 pairs and no `ORDER_UNSPECIFIED`.
- Effects in different executables never form a pair.
- Non-observable outcomes (`bind`, `return`, `COMPLETION_DEPENDENCY`) never enter the count.

## R-1B0 order accounting, measured on Linux 2026-11-02

Instrument only, as frozen. Build moves from `392244d37f62` to `a93a98cead33` because `src` and `scripts` changed; no encoder, IR, schema, ingestion, or graph change, and no row appended. Built and measured in a scratch copy outside the repository; the three changed files (`src/query/sufficiency.ts`, `scripts/sufficiency.ts`, the new `test/e3/order.test.ts`) were then copied into the tree byte for byte, hash-checked, with nothing changed after the measured run. 158 tests pass (152 before, 6 added).

### Predictions, scored

1. **Every existing figure unchanged: passed.** `measure`, `graph`, and `sufficiency` were run on all three corpora on build `392244d37f62` and on this build, and compared line by line. `graph`: zero differences on all three. `measure`: one difference each, the build id line, and all three still print `reproduces R-1A`. `sufficiency`: the only differences are the new order section appended after every earlier section; `ORDER_UNSPECIFIED` is still 3 on `encodeFunctions` and 2 on `operand`.
2. **Build id moves, every corpus reproduces by value: passed.**
3. **Fixed pairs 0 everywhere, by construction: passed**, and stands as the finding it was predicted to be: effects have no occurrence identity, so no order fact has anything to name.
4. **Corpus-wide counts: passed exactly.** `ir0-typescript` 18 executables, 96 pairs, 96 unordered; `toml-python` 22, 303, 303; `radon-python` 44, 274, 274.
5. **The path limit is stated in the report: passed.** It prints with the other two limits.

**Unpredicted, recorded:** per qualifying thread, `encodeFunctions` carries 12 unordered pairs and `operand` 13; radon's two qualifying threads `gobble#21` and `gobble#28` carry 7 and 2. The protocol froze no thread-level pair counts, so these are new baselines for R-1B2, not scored predictions.

### Controls

All six pass: three effects make three unordered pairs; one effect makes no pair and no `ORDER_UNSPECIFIED`; effects in different executables never pair; bindings, returns, and completion dependencies never enter the count; and the limits travel with the report.

### What this establishes, and what R-1B1 now has to do first

The checker can now be satisfied by real order facts, and it will say exactly how many pairs each step fixes. Nothing can be fixed yet, for a reason this step made concrete: an order fact needs two things to point at, and observable effects are anonymous literals. **So R-1B1 opens with occurrence identity, not with the choice of relation:** each effect occurrence, and each completion dependency, needs an identity in the store before `FOLLOWS` widened and a new relation can be compared at all. The path-membership limit belongs to the same question, since an occurrence that knows its path also answers which pairs can ever run together.

### R-1B0 on Windows: not yet run

## R-1B0 confirmed on Windows, 2026-11-02

Michael's machine, build `a93a98cead33`, the build measured on Linux. 158 of 158 passing. `measure` on `ir0-typescript` prints `reproduces R-1A of ir0-typescript, recorded 2026-09-17 at build 392244d37f62`. `sufficiency` reproduces the Linux figures: `ORDER_UNSPECIFIED` 3 on `encodeFunctions` (`encodeFunctions, parse, loadLanguage`) and 2 on `operand` (`operand, canonNumber`); order relations designated: none; pairs 96, fixed 0, unordered 96; `encodeFunctions` 12 pairs and `operand` 13, all unordered.

**Transcript note, not a defect.** The Windows command filtered `sufficiency` output through `Select-String` on `pairs|designated|ORDER_UNSPECIFIED`, so the limit line about occurrence identity, which contains none of those words, was filtered out by the command as written. It was not dropped by the report. Unlike the September transcripts, this gap is explained.

## R-1B1 draft 1 reviewed: rulings, 2026-11-02

Michael reviewed `docs/r1b1-design-draft.md` (draft 1, sha256 `0d74706a...`) and approved the direction with corrections; nothing frozen, no production implementation authorized. Rulings on its section 7, in summary (the full text is kept with draft 2):

1. Step concept approved within scope. `CONTAINS_STEP` is ownership, the concept id is identity, repeated identical occurrences stay distinct, nested-call and opaque limits stay visible in sufficiency reporting. Fresh identities on re-ingestion accepted for this increment. Structural positions are provenance and must never supply ordering evidence to the checker.
2. Pair classes approved with corrections: Together and Exclusive overlapped (K6d), so classes must be disjoint with stated precedence; the store facts proving an arm always exits must be named, or the pair stays Unknown; Together means structural compatibility, not a guarantee that both execute.
3. Event model approved in principle; the derivation contract was incomplete. Typed internal rules per step kind (including await suspend to resume on successful continuation) must be stated and tested; fulfilment must be its own event with a defined endpoint; `await ready` keeps its successful-await meaning, and the missing `Parser.init` link is a limit of value tracking, not "exactly what the source says".
4. Frontier-only writing approved; derived facts must carry the conjunction of all applicable branch-arm and edge conditions, conflicting arms invalidate a chain, and a negative control must catch discarded conditions.
5. Experiment approved once both candidates are fully specified: H1's branch predicate fact defined (relation, endpoints, payload, validation); the 96 executable-level `HAS_PREDICATE` kept distinct from any total; directional endpoint validation applied equivalently to both candidates.
6. Controls approved after correcting K4 (the draft's "removes exactly the completion fact" was internally inconsistent) and adding nested-arm, incompatible-chain, and unresolved-await controls; the encoder-agreement boundary of a hand-written experiment must be stated, with exact paired fixtures and the section-16 pair identified.
7. Sequence approved: corrected experiment, then P0, P1, P2, R-1B2, each separately frozen. P0 must explain radon's 120 against 121 before P1 is frozen, preserving the original observation and any prediction miss. P1's "nothing existing moves" is provisional until P0 and the invocation-mapping decision are resolved. Graph-contract changes are recorded separately from the unchanged IR schema version.

**Recorded against draft 1, not corrected in place:** the K4 prediction as written was wrong, and the Together/Exclusive rules overlapped. Draft 1 stays in the repository unedited.

## R-1B1 draft 2 reviewed: rulings, 2026-11-02

Michael reviewed `docs/r1b1-design-draft-2.md` (sha256 `27f4df90...`). Kept as written: ownership and identity, condition propagation, the K4 correction, the separate predicate counts, and the prerequisite boundaries. Accepted: draft 2 section 7 points 3 and 7. Corrections required before freezing, in summary:

1. **R-FULFIL and R-AWAIT introduced false ordering.** "return < fulfil" fails for a call that returns an already-fulfilled promise, including one created before the call; "suspend < operand-fulfil" fails for an already-fulfilled operand; and JavaScript `await` accepts ordinary values. Keep only: invocation precedes normal return; await entry precedes successful continuation; successful settlement of the awaited promise precedes successful continuation. Await entry must not require an actual runtime suspension. No settlement event for a plain value, and JavaScript's operand rules are not to be applied to Python. Controls required: pending promise, already-fulfilled promise returned by a call, already-fulfilled unresolved variable, ordinary JavaScript value.
2. **Cycle validation must not depend on relation spelling.** Candidate B's program fact call to await plus `AWAITS` await to call is a raw cycle; validation runs on normalised semantic event edges, and a valid awaited call must pass both candidates.
3. **Classification ambiguity.** Absent `ARM_TERMINATES` must not prove non-termination, and "never through arm p" needs a completeness boundary or a positive structural proof; missing edges alone must not establish exclusivity.
4. **K9 cannot test incompatible composition** (both edges point into d). Add a composable pair, x before m under (B,then) and m before y under (B,else), which a deliberately condition-blind closure must fail.
5. **Evidence contract** must list every permitted semantic attribute, and define the stored link establishing an await's R-1A dependency target.
6. **X2 claim narrowed:** one observable effect makes pair checks vacuous; state what the later encoder test must verify about the await dependency and its effective conditions.

**Recorded against draft 2, not corrected in place:** R-FULFIL and R-AWAIT as written asserted false precedence, and the draft 2 cycle rule would have refused a valid awaited call under Candidate B. Draft 2 stays in the repository unedited.

## R-1B1 draft 3 reviewed: rulings, 2026-11-02

Michael reviewed `docs/r1b1-design-draft-3.md` (sha256 `89a143eb...`). Accepted for the scratch experiment: the revised settlement-order guarantees, condition propagation, semantic event-graph normalisation, and the K9b negative control. Not to be reopened. Bounded corrections required before a freeze candidate, in summary:

1. **ARM_STATUS computation was wrong.** Draft 3's "last statement is a represented step other than exit or opaque" let a branch bypass its own rule, and the last statement alone cannot prove fall-through: an opaque loop followed by a call must not become falls-through. Status must be composed over the whole represented block, with the meaning of falls-through stated (structurally possible or guaranteed normal path) and applied consistently. Controls required: an opaque construct followed by a call; a final branch with one unknown arm and one exiting arm; a final branch with a represented normal continuation.
2. **No entry fact.** The dominance proof referred to "the executable's first step" with no relation recording it, and positions cannot supply it. An explicit entry representation is required, with ownership, uniqueness, and reachability validated. Edge counts prove local completeness over recorded steps only, not that ingestion captured every occurrence, and disconnected steps must not satisfy dominance vacuously. The implicit exit rule must be conservative where fall-through is unknown.
3. **Fixtures were not internally complete.** Implicit exits and completeness changed earlier fixtures even where pair answers did not (K1 needs an implicit exit and a successor fact from its second call). One consolidated manifest is required, with counts recomputed, distinguishing "same expected pair answer" from "same fixture facts".
4. **Completion relations may add nothing.** `AWAIT_TARGET` already identifies the call result and R-SETTLE supplies the ordering. An ablation control is required (keep `AWAIT_TARGET`, remove the completion fact), recording which query, if any, becomes unanswerable; redundancy of both candidates' completion facts is a valid result.
5. **Remaining contracts:** validate `IN_ARM` ownership and acyclicity with terminating traversal; exactly one valid `AWAIT_TARGET` per await; X2 effective conditions are a disjunction of per-path conjunctions; predicate normalisation in the encoder test stays separate from the checker's ban on predicate text; `settle` having no incoming edge is this increment's conservative limit, not a claim that no evidence could ever order an event before settlement.

**Recorded against draft 3, not corrected in place:** the C.1 fall-through rule as written, the missing entry fact, and inherited fixtures that omitted the implicit exit and successor facts that draft 3 itself required. Drafts 1 to 3 stay in the repository unedited.

## R-1B1 frozen, 2026-11-02, before any checker code

Michael approved the freeze candidate for the scratch-store experiment with five amendments, recorded verbatim in substance as section 15 of the frozen protocol; no further approval round was required for those exact changes.

**Correction recorded (amendment A1):** draft 2 defined the pair population as `call`, `write`, and `emit` steps only. That silently narrowed R-1B0's population, which counted the projection's opaque pseudo-effects. The frozen protocol includes `opaque` steps, preserving 96, 303, and 274. P0 and the later production checks must verify the correspondence against the actual baseline.

**Frozen artifacts, full sha256:**

| File | sha256 |
|---|---|
| `docs/r1b1-protocol-frozen.md` (candidate text plus section 15) | `cf118c69056f2ede6996ed28d043a7d51ae4f105dda525becc9e4bdc0acead9b` |
| `docs/r1b1-manifest.json` (29 fixtures including L1, 2 cross-executable mini fixtures, K9b engine control, 38 refusal controls, R22 deferred) | `072b51013d2b85eae9d3c15954a3388cb398f94f94b8b7fdb662b319a2b33ecf` |

**Preserved, unedited:** `r1b1-freeze-candidate.md` `430e33cae1e00e0b21f52f0c6619f7f860ef324deb1d81f14e9384fe6c38f78a`; `r1b1-design-draft.md` `0d74706afbc942d5bee14b63857deea5571ac1282260bc528c05ff2799b712d0`; `r1b1-design-draft-2.md` `27f4df9009915e4b71e99c37ad215e352834f545d3fe36f5c819d006cbe56fbf`; `r1b1-design-draft-3.md` `89a143ebf656a428ea10de1651d875057504afa409dc1c4de63f2a801c2a7b25`.

The manifest was authored by a generator kept outside the repository (`make_manifest.py`, sha256 `117e155fc6530af16f46db18296dd5a41d70bb8c3e1acedd20ea72cd76ea5501`); the frozen record is the JSON. The scratch checker is written only after this entry, outside the repository, and may not change either frozen file.

## R-1B1 experiment run, 2026-11-02 (scratch store, outside the repository)

Run against `docs/r1b1-protocol-frozen.md` (`cf118c69...`) and `docs/r1b1-manifest.json` (`072b5101...`), which the checker verified by hash. Final checker `f6749afa...` (outside the repository). Raw results `docs/r1b1-results.json` `0ba232f2651e75a1032f2ee3ae57d9a32ece7abbfcb38e541e68fa79914ae81a`, byte-identical on rerun. Full write-up: `docs/r1b1-results.md`.

- **All four combinations (A/H1, A/H2, B/H1, B/H2):** 172 of 172 queries; no unexpected refusals (L1 legacy included); every completeness warning, computed `ARM_STATUS`, implicit exit, and population check as frozen; identical event graphs, so identical answers and 688 edge expansions; 396 assertions in every combination; attribute values 574 under A against 340 under B; attribute reads 171 against 54.
- **Ablation prediction held:** removing completion facts (`AWAIT_TARGET` kept) lost or changed no query in any combination, one assertion fewer per fixture.
- **Prediction miss, not corrected:** all four R13 refusal alternatives produced {R13, R12}, not {R13}, because excluding the refused `AWAIT_TARGET` leaves its await with zero accepted targets; section 15.1's "one bad fact produces one code" is false for cardinality cascades. R12 reading (accepted against stored facts) needs a ruling.
- **Checker defect found and fixed during the run:** refusal codes were first compared as lists, not the sets section 15.1 specifies; R18's cross-executable entry alternative reported R18 twice. Comparison fixed, nothing else changed.
- **Interpretation applied:** R9 checked only when `AWAIT_TARGET` names a call; literal targets fall to R10, as the manifest expected.
- **Untested rule found:** a checker with the chain-derivation conflicting-arm check removed passed everything; structured fixtures cannot reach it, and K9b exercises a separate composition engine. Needs a direct test before R-1B2 relies on it.
- **Test power confirmed by sabotage:** draft 1's deeper-condition-only rule failed 23 queries; draft 2's enter-before-settle edge failed 32.
- **R22 deferred**, not passed; payload oracle matched outside the checker.

**Recommendation recorded for Michael's ruling, not adopted:** program order by Candidate B `NEXT_STEP`; no completion relation (`AWAIT_TARGET` plus R-SETTLE); predicates by H1 `TESTS_PREDICATE`. No production representation change is authorised by this entry.

## R-1B1 experiment ruled, 2026-11-02

Michael ruled on `docs/r1b1-results.md` (`7e08732a...`); recorded in full in `docs/r1b1-addendum-1.md`. Summary: (1) program order by Candidate B `NEXT_STEP`, with the attribute-read reduction treated as an experiment result, not a production performance claim; (2) `AWAIT_TARGET` kept and no separate completion relation, `AWAITS` or equivalent, introduced, with successful-await rules and dependency identity preserved; (3) predicates by H1 `TESTS_PREDICATE`, branch predicates distinct from executable-level `HAS_PREDICATE`, the 96 reported separately, chosen for meaning and compatibility since no performance difference was shown; (4) R12 counts accepted, valid `AWAIT_TARGET` facts, both R13 and R12 are kept, R13 as the primary rejection and R12 as the resulting completeness failure where applicable. The frozen expectation and the original R13 miss are preserved unedited; the revised diagnostic contract (diagnostic roles, primary and consequent, applied to R12 and to R18's identical cascade) governs future checks only.

Note: Michael's ruling message arrived cut off after point 4 ("Record the revised diagnostic contract in an add..."). This entry records only what was received; anything further is pending.

## R-1B1 follow-up frozen, 2026-11-02, before any follow-up code

Michael's remaining rulings are recorded in `docs/r1b1-addendum-2.md` (`27156f9e23d9a51a3453fe96bd32a7364d109f9e374f1ca04cc85d21b9def926`): "addendum" confirmed; primary and consequent roles accepted for R18; addendum 1's "exactly one primary" replaced by an explicitly predicted set of primary diagnostics plus consequent diagnostics linked to their causes, with no suppression of independent violations; R9/R10 interpretation accepted with both paths' controls kept; the list-to-set fix kept in the run history with the producing revision named; R-1B1's design selection accepted, validation closure pending this follow-up.

Frozen follow-up data `docs/r1b1-followup.json` `df3ae73b5d15cdc2dda63d631e65363cbecf8022a2660beeb9c81547dac7f224`: role-annotated expectations for all four R13 alternatives, both R12 controls, and all four R18 controls; and three conflicting-arm fixtures (CA0 consistent, CA1 membership contradicting an edge, CA2 contradictory endpoints) run through the original chain-derivation code, with a sabotage control removing only its conflicting-arm check. Prediction recorded before running: validated stores CAN reach the conflicting-arm case, because no rule checks `IN_ARM` against arm labels on program facts.

## R-1B1 follow-up run, 2026-11-02

Run per `docs/r1b1-addendum-2.md`; write-up `docs/r1b1-followup-results.md`; raw `docs/r1b1-followup-results.json` `c3779b12c574c3c7ab1d45f8dca58b36314934886ea0c61b125fd3459e0b6bb0`; bundle `docs/r1b1-bundle/` with per-file hashes. Reported separately from the original run, which stands unedited.

- Checker revisions: r0 reconstructed (`a4caae27...`, reproduces the first-run outcome); r1 `f6749afa...` produced the final original results; r2 `0df935df...` adds roles, keeps chain derivation byte-identical to r1 (verified as source text before running), and reproduces `0ba232f2...` exactly.
- Diagnostic roles: 10 of 10 role-annotated controls as frozen in all four combinations (R13 x4 primary {R13}, consequent {R12 <- R13}; R12 x2 primary only; R18 x3 primary only, cross-executable entry primary {R18} with consequent {R18 <- R18}); all other refusal controls 28/28 (A) and 27/27 (B) with no consequent.
- Conflicting-arm: prediction confirmed, validated stores reach the case (CA1, CA2 pass R1 to R23 in every combination). Correct derivation passes CA0, CA1, CA2; with only the conflicting-arm check removed, CA0 still passes and CA1, CA2 fail. The check in the actual chain-derivation code is now experimentally validated.
- Finding for ruling, not fixed: no rule checks `IN_ARM` against arm-labelled program facts, so a contradictory store validates and classification reads the contradiction (CA2 is Exclusive while u precedes v). A consistency rule is proposed, not added.
- Tooling note: the follow-up's first identity comparison mis-delimited the one-line `armsOf` and reported a false mismatch; corrected to a line comparison before the recorded run.

## P0 protocol drafted for review, 2026-11-02

`docs/p0-protocol-draft.md` (`a93f87d4ac3824d9d055f30acee0cc1f7b86a67bac3e28a7b515d8b9a0a570d9`): an instrument reconciling radon's 120 statement-level call sites against 121 stored call invocations site by site, without adjusting either count; three populations (stored, projected by an independent re-implementation of ingestion's rule, statement-level), hypotheses H1 (draft 1 probe scope: calls under `read` or `negated` wrappers in returned or thrown values), H2 (store double count), H3, and the A1 opaque-population correspondence check. Not frozen; no code written. The draft 1 probe's original figures stand as recorded.

## P0 frozen, 2026-11-02, before any instrument code

Michael ruled on `docs/p0-protocol-draft.md` (`a93f87d4ac3824d9d055f30acee0cc1f7b86a67bac3e28a7b515d8b9a0a570d9`, preserved unedited): scope, build-id change, baseline preservation, and the three populations approved, with projected counting independent of ingestion's helper. Corrections required and incorporated, recorded in section 11 of the frozen protocol: a site-level trace to executable, IR location, wrapper shape, and contributing outcomes, with multiplicity preserved and ambiguity reported rather than assigned; H2 split into grouping-rule divergence (projected and stored agree, both differ from occurrences) and ingestion implementation discrepancy (projected and stored disagree), with H1 kept as the stated prediction and hypotheses decided by rows, not totals; A1 compared by kinds and multiplicities per executable with unmatched occurrences and mapping limits; controls added for a negated return, a wrapper in a thrown value, and a controlled grouping-key mismatch; the P1 handoff rewritten so P1 preserves every represented fact. No further approval round required for these exact amendments.

**Frozen artifacts, full sha256:**

| File | sha256 |
|---|---|
| `docs/p0-protocol-frozen.md` | `bfc3195c8c0668f462ac08a0f065a9e0ab21f7d722813cd5f536c257e13f065d` |
| `docs/p0-controls.json` (control sources, observed IR shapes, expected counts, classes, mapping, and A1 per executable; IR and classifier controls) | `026e980936b75fb7d87703c370b4e61ad5cd6ed4be413c64fa5bf0dcbfd0593a` |

**Recorded at freeze, from code reading before any instrument code:**

- The draft's A1 prediction (equality in every executable) is revised in the frozen protocol, not in the draft: `project()` emits no `CALL_EXTERNAL` for a call that is a `return` or `throw` value, so such a call step has no `HAS_EFFECT`. Predicted consequence: amendment A1's claim that the step population preserves R-1B0's 96, 303, and 274 is false as a count wherever a returned call step exists. Reported for ruling, not corrected.
- Both encoders drop the value of a `throw`/`raise` (observed: `raise g(a).err` and `throw g(a).err` encode as a value-less throw), so a call under a wrapper in a thrown value is invisible to every population. Control C3 freezes that; C3b covers the wrapper path with hand-written IR.
- `f(a)` followed by `return f(a)` under one path condition is merged into one site by `max(effects, binds)` (control C7): a real grouping-rule merge the rule permits. Prediction 3 nevertheless predicts zero such rows in the corpora.

**Baseline captured before any change:** complete `measure`, `graph`, and `sufficiency` outputs for all three corpora at build `a93a98cead33`, on a copy outside the repository (`$HOME/und-p0-base/out`).

## Working method, 2026-11-02

Michael set how Understanding proceeds from here: each increment states its question, records the prediction and the evidence that would support or contradict it, builds and runs the smallest useful experiment, preserves inputs, implementation, results, and surprises in source control, and uses what happened to choose the next step. Pause only when an issue would invalidate the current experiment, discard represented facts, or make results uninterpretable; otherwise record the uncertainty and proceed. A newly discovered limitation does not automatically become a prerequisite. Planning stays proportional to the next decision. Michael's P0 source review also corrected his earlier claim: the step and HAS_EFFECT populations do not necessarily preserve the same pair count.

## P0 run, 2026-11-02

Write-up `docs/p0-results.md`; raw `docs/p0-results.json` `2ccfbe652419a52fcedbc20591f8808406779dfab6f13ab471d18184f2b1364f`; every run's complete output in `docs/p0-run/` (`MANIFEST.sha256` `70bb05e1afaf7b979998607490ba3e13401742b68952adbc9bc2ee3f9ad1d288`). Recorded build `d7efd55eb399`; baseline `a93a98cead33`.

- **Radon's 120/121 is one site:** `complexity.py::cc_visit_ast`, IR `body[1].value.object.expr`, `return ComplexityVisitor.from_ast(ast_node, **kwargs).blocks` (line 108 by text search), wrapper `return > read > computed`, one contributing outcome, unique mapping. A miss of the draft 1 probe; the store is right. Both original figures stand.
- **All five frozen predictions held.** No grouping-rule, ingestion, or other rows in any corpus; 20 coarse-ambiguous keys reported as a mapping limit with coarse totals equal.
- **A1:** 72 unmatched call steps (13, 15, 44), each a returned call with no HAS_EFFECT, all uniquely attributable; write, emit, and opaque match exactly; no unmatched effect. Legacy HAS_EFFECT pairs 96, 303, 274 unchanged; expanded step pairs 97, 314, 297.
- **Baseline:** measure differs only in build id, graph only by the appended section, sufficiency identical; R-1A rows reproduce; 181 of 181 tests.
- **Implementation corrections, separate from the predictions:** r1 `288a040a8162` reported empty executables as IR-only (reporting only); r2 `86cdaae80cf9` fixed it and added key mapping counts; r3 `d7efd55eb399`, per Michael's source review, computes the stored total from the store with matched and store-only parts, compares A1 per matching group with attribution only where the whole group is unmatched, keys test reports by file and name, and adds `docs/p0-controls-2.json` (`469fa4f582961a2001cfe9c1c6d737993a23a909d359b31da2055cf358128b94`). r2 and r3 corpus results are identical. Frozen predictions and controls unchanged. Twice a write from the session to the device left stale bytes; both were caught by hash and rewritten before the recorded run.
- **Carried forward, not prerequisites:** the grouping rule's merge case (C7) does not occur in these corpora; 149 call occurrences sit outside ingestion's rule; both encoders drop thrown values.
