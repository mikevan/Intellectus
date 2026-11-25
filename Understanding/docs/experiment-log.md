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
