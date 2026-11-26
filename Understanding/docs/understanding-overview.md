# Understanding: what it is, why it is built this way, how it was built, and how it is tested

Michael Van Geertruy, with Claude. 2026-09-17. INTERNAL. Understanding is not named or described anywhere public until he says so. This document lives in the Understanding repository and in the project. It is not mirrored into the toolkit library.

This is the high-level companion to `docs/handoff-2026-09-17.md`, which says where the tree stands. This one says what the thing is.

## 1. What Understanding is

Understanding is a semantic database. It stores what an application does, not how its source code says it. The unit of storage is not a file, a class, or a function. It is an assertion about a persistent concept: a subject, a relation, an object, and the evidence for the claim.

The purpose is a change of abstraction. Today source code does two jobs at once. It is the best available description of what a program means, and it is the instructions a machine runs. Understanding separates those jobs:

```
human intent  ->  semantic model  ->  an implementation chosen for current constraints
```

If this works, source code becomes one rendering of the model rather than the authority, and the asset a team owns is the model. Python, TypeScript, Java, and the rest become target renderings. The near test of the idea is Python to model to TypeScript, because those two languages are close enough that a failure teaches something about the model rather than about the runtimes.

Understanding is the shared memory behind the toolkit's four tools. KeepSafe feeds it. DeepTest uses it to check that every semantic flow is tested. UntangleIt uses it to separate code by flow while preserving intent. CommentIt uses it to explain what code is for rather than what it mechanically does. On the surface the tools look and act exactly as they do today. The semantic core sits underneath and stays invisible.

### The vocabulary

**Concept.** A persistent thing the application has: an executable, a module, a value, an entity, a scope, an intent. A concept's identity is an opaque id carried forward by lineage. It is never computed from a name, because names are what change when a program is ported or refactored.

**Assertion.** One claim about a concept, with its provenance. Every assertion says where it came from: parsed from source, observed in an execution, declared by a person with authority, recorded from a prompt or an issue, inferred by a model, or verified by a person, a replay, or a proof. Inference never silently becomes declared intent. Deterministic facts outrank inference, and only a person can verify.

**Journal.** The store is event-sourced. The append-only journal is the truth and any in-memory projection of it is belief. Assertions can be retracted but never erased. A restore is a new event, never a rewind. Every derived assertion names what it was derived from, so when a base fact is retracted everything built on it goes with it in the same transaction.

**Relation schema.** The set of legal relations, with the kinds each may join and the attributes each requires, is enforced at write time. A module cannot CALL, a test cannot SATISFY, a DECLARED assertion must carry an authority. The point is that model-generated nonsense is unrepresentable rather than merely discouraged.

**Semantic flow.** A connected unit of application behaviour: values passing through operations, transformations, decisions, calls, and effects from an entry point toward an observable outcome. A large application is more like a novel than a library. Functions, classes, and files are its pages and paragraphs. The unit that matters is the thread that crosses the whole book: a customer id, a payment amount, an authorisation decision. Understanding is meant to let a reader enter at any point and ask what this is, where it came from, what changed it, what decisions depended on it, where it went, and what it caused.

**The IR.** Between the parse tree and the store sits a language-neutral intermediate representation. Source goes through tree-sitter, then a language adapter, then the IR, then assertions. The IR keeps nothing lexical: no identifiers, no comments, no formatting. It keeps predicates, effects, bindings, branches, returns, throws, and, since today, completion dependencies. Its semantic projection is every effect and return with the path condition under which it is reached, and the fingerprint of a function is a hash of that projection. Two functions that do the same thing under the same conditions fingerprint the same, whatever they are called and whichever language they are written in.

The IR is one evidence channel. It is not the semantic model. The model also anticipates observed behaviour, declared intent, lineage, equivalence claims, and uncertainty, and the IR work is testing how much of the model can be recovered mechanically from existing source.

## 2. The philosophy

**Unknowns stay unknown.** The system does not statistically guess what code probably does. It derives what the program demonstrably does and records the rest as not yet understood. An opaque statement is reported as opaque. A call whose target cannot be resolved is reported as unresolved, never resolved to the most likely candidate. A collision between two functions' fingerprints is reported as a candidate for a person to judge, never asserted as equivalence. Structural similarity is not semantic identity, and a claim of substitutability is made only with named evidence and a person's or a proof's confirmation.

**Deterministic facts outrank inference.** AI should not infer facts that deterministic tooling can prove. Where a fact can be parsed or observed, it is. Where a model contributes, its contribution is marked as inferred and never promoted on its own.

**Engineer from first principles. Start at the foundation and question everything above it.** The founding question was whether source code is really the foundation of software. It is not. It is an artifact sitting above the semantic description of what the system does, and Understanding is built at that lower level. The same habit applies inside the project. When a category named `other` held a fifth of an application's opaque statements, the answer was not to reduce the count but to open every case and say what it was. When a nested function was about to be called a closure, the answer was to inspect all six and find that half of them capture nothing.

**Do not close doors, and do not take the easy solution.** Every constraint is stated as the shape of a problem rather than as a verdict. Every design step asks what the goal is, how it has been done, whether that meets the goal, and whether the obvious answer is the right one or the easy one. Best practice is treated as stale by default, and the search is for the lost art: the technique that was ahead of its time, or the one practitioners used without documenting because it was obvious to them.

**Correctness over speed.** The standard is the one he learned leading development teams during the war, where bad analytics were paid for in something other than money. Nothing is sequenced by cheapest win first. It is sequenced by what makes the thing correct, and a week spent on the right thing beats a day spent on something that does not work.

## 3. How it was created

**A frozen founding design.** The design went through four drafts against three hostile reviews, then froze. From that point discoveries come from code, and the document changes only when the build forces it. The frozen design is also the repository's first declared intent, so the store can catch its own implementation violating the decisions that created it.

**No privileged path.** Understanding's own TypeScript goes through the same adapter as any other project. There is no hand-authored graph and no bootstrap metadata other users do not get. The only things seeded are what the design requires a person to declare: authority scopes and initial intent. The repository encodes itself as soon as the adapter can, and every opaque statement the adapter reports on its own source is the honest measure of how far the IR is from representing it.

**The smallest first move, then progressively nastier pairs.** The first build was only concepts, the journal with transactions, the relation schema, the minimum IR, and the two adapters. The first test was the pair from the design's own section 16: a Python conjunction with a `Decimal` threshold and a status string against a TypeScript early-return chain with enums and an awaited publish. They project and fingerprint identically. Everything since has been one distinction at a time, on real corpora.

**Frozen corpora, chosen before they were looked at.** Three corpora are vendored byte for byte with a manifest of hashes: this repository's own source, the `toml` library, and the `radon` application. Radon was selected against ten criteria written down before any candidate was examined, and the rule was that the first candidate meeting all ten would be taken regardless of how Understanding performed on it. It scored zero sufficient flows, and that number was recorded rather than replaced.

**One label, one step.** Findings discovered together are never fixed together. Today's work split what was found into two instrument steps, five classification steps, and a representation step, each with its own encoder version, its own frozen copy of the encoder, its own row in every corpus's expected results, and its own prediction. That costs ceremony and buys attribution: when a fingerprint, a collision group, or a sufficiency result moves later, exactly one semantic distinction is responsible.

**Two people, one method.** He rules, Claude builds, and neither builds on an unruled decision. A change the ruling cannot be executed as written stops and goes back rather than being decided at the keyboard, and that happened three times today. Every document carries the byline "Michael Van Geertruy, with Claude." Commits carry his name alone.

## 4. How it is tested

The apparatus matters more than any single result, because the apparatus is what has caught every mistake so far.

**Predictions before measurements.** Every step's protocol is written into the experiment log before the code changes, with numbered predictions and the falsifier for each. After the measurement every prediction is scored as written, including the ones that failed and the things nobody predicted, before any corrective change is made. Today two R-1A predictions failed and the log says so in those words.

**An append-only log.** `docs/experiment-log.md` is the evidence. No entry is edited. A correction is a new entry. A misprediction stays a misprediction. A build id recorded against a tree that no longer exists stays recorded, with an entry explaining why and the rule that stops it happening again.

**One measured run per corpus per encoder version.** Every corpus carries an expected-results file with one row per encoder version. Rows are appended, never edited. The measuring instrument verifies the corpus against its manifest before it measures anything, compares the run against the current row, and prints `reproduces` or `DIFFERS` with the differing figures. Every result is confirmed on both Linux and Windows before it counts.

**A frozen encoder.** A byte-hash test fails if any live encoder file differs from its frozen copy, so no experimental result can come from an encoder tuned to produce it. A change to the encoder is a deliberate act: a new frozen copy, a new version number, a new row in every corpus. The earlier frozen copies are kept so that every earlier result still has an encoder to belong to.

**A build id.** A content hash of everything doing the measuring is printed with every result, so a number can never be mistaken for one produced by a different tree. It has caught stale trees three times, including one of Claude's own sequencing mistakes today.

**Instrument defects kept apart from semantic failures.** When docstrings were being counted as unrepresented semantics, that was recorded as a defect in the instrument, not as opacity. When case labels were counted as statements, the same. When a report's totals did not add up, the report was made to derive every total from a written definition and a test now holds it to that. The distinction matters because the system could otherwise evolve while its instruments evolve and nobody could tell the two apart.

**Negative controls, positive controls, and cross-language controls, on every step.** A classification step must show that shape, naming, and resemblance never produce the category and only the construct does. A representation step must show that the awaited and unawaited forms differ, that spelling alone does not, and that the same program in Python and TypeScript projects identically. Where a control's precondition is not met, that is recorded as a finding rather than tuned away.

**Monotonicity.** A step may add semantic information. It may never discard a fact the previous encoder represented. The test compares projections before and after, fact by fact, against a golden record taken before the change.

**Sufficiency, not coverage, as the product metric.** The question the checker asks of every semantic flow is: if the source for this flow were deleted now, what would an emitter have to invent to recreate it? The answer is a ranked list of missing facts, measured against a checklist frozen before the first run. Today no flow in any corpus is sufficient, and on the flows that can be asked the leading gap is effect semantics, then callee identity, then receiver identity, then ordering. The contract is never weakened to make a flow pass. Zero is data.

**What the numbers say tonight.** Radon: 435 semantic statements, 81 opaque, every one of them under a name that says what it is. Two of its 109 flows can be asked the sufficiency question; none passes. Completion dependency became the first construct to go from opaque to represented without any represented fact changing, in both languages, and the day ended with a measured target for the next step: a qualifying flow with an await in it and three unresolved orderings.

## 5. Where to read more

- `docs/founding-design.md`: the frozen design, draft 4.
- `docs/experiment-log.md`: every protocol, measurement, confirmation, correction, and finding, in order.
- `docs/handoff-2026-09-17.md`: the state of the tree and what is next.
- `corpora/*/EXPECTED.json`: one row per encoder version per corpus, with the note that explains each.
