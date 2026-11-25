# Understanding: founding design

Michael Van Geertruy, with Claude. Project Revive Solutions, LLC.

Draft 4, FROZEN 2026-09-13 (drafts 1 to 3 earlier the same day; draft 3 answered the second-pass technical review; draft 4 answers the third, which called the design architecturally credible and named twelve engineering refinements before it could be frozen: lineage, IR versioning, derived-assertion invalidation, source against verification, authority scope, proof evidence, transitive closure, the scope of equivalence, literal canonicalisation, semantic strings, the bootstrap phases, and a destructive-refactor experiment; the third review then called draft 4 ready to become code, and the architecture is frozen at this draft. From here, discoveries come from code, and a change to this document requires the two-adapter build to have forced it). INTERNAL. Not catalogued in the library's published pieces, not mirrored into any tool, not summarised in any README, commit subject, or Marketplace text. The toolkit's surface stays 1.0; this is what goes underneath it.

## 1. The four questions

**The goal.** The three tools share one memory of what an application is and means, so that DeepTest can ask what it is obligated to prove and lacks evidence for, UntangleIt can cut an implementation where the evidence-supported semantic structure allows, and CommentIt can say what authoritative purpose an implementation serves along each thread it takes part in. The memory holds evidence about meaning, not text.

**How it has been done.** Relational, document, graph, vector, and triple stores can each hold a model of this shape. What none of their primitives enforce is the set of distinctions this memory lives or dies by: persistent identity separate from every rendering; structural evidence, observed behaviour, and declared intent kept apart; source, confidence, and authority on every assertion; equivalence as a claim rather than a coincidence; obligations with a modality and a proof strength; and history that is never overwritten, including the history of being restored.

**Does that meet the goal?** Not as primitives. Each distinction can be a convention on a general store, and conventions are what a tool forgets under pressure and what a language model, which is very good at plausible and globally nonsensical assertions, will violate on the first day.

**Right solution or easy one?** The easy one is a graph database with an embedding column and a naming convention. Understanding is built so the distinctions are properties of the primitive and impossible statements are mechanically unrepresentable.

## 2. What Understanding is

Understanding does not store meaning. It stores evidence from which meaning can be reconstructed, about things whose identity does not change.

It is an event-sourced semantic database. The journal is the truth about everything Understanding has ever believed; the projection is what it believes now; and every index, fingerprint, delta, and materialisation is derived from the journal and can be rebuilt from it. There are five semantic objects and nothing else:

- **Concepts**: stable identity anchors. A permanent, meaningless id and a kind.
- **Assertions**: immutable, provenance-bearing evidence about concepts.
- **Obligations**: assertions about what must, may, or must not hold, with a modality and, when discharged, a proof strength.
- **Traces**: observations of what actually happened, under the conditions recorded.
- **Renderings**: representations of a concept for a person or a machine, in a language, regenerable while the anchor stands.

The graph, the thread map, and the grid are indexes. Fingerprints are derived properties. Materialisations are caches. Semantic delta is a comparison. The tools are clients.

The record becomes canonical in two phases, and the design says which phase it is in. In the **source-derived phase**, which is every application on the day it is encoded, the code is the authority and the record is a lossy reconstruction of it; nothing in the record is more canonical than its input. In the **semantically sufficient phase**, the record has accumulated what the code never held (declared intent with authority, obligations with evidence, traces, verified substitutability) and can be rendered back to code that passes the code's own tests. Only then is the record canonical and the code one tested rendering of it. E2 is the test for crossing that line, and a repository is marked with its phase.

## 3. The primitive: the assertion event

Everything in the journal is an immutable event concerning a persistent concept. Two kinds of event exist:

```
ASSERT
  id            monotonic sequence number
  tx            transaction id (section 12)
  schema        schema version of the vocabulary this event was written under
  subject       a concept id
  relation      a typed relation from the vocabulary (section 5)
  object        a concept id, or a typed literal
  attributes    relation-specific fields (modality, connectors, proof strength, validity)
  source        PARSED | OBSERVED | DECLARED | RECORDED | INFERRED   (how it arrived)
  verification  NONE | HUMAN | REPLAY | PROOF                         (what happened to it after)
  asserter      the parser and version, the Witness run, the person, the session, the tool brief
  authority     level NONE | CONTRIBUTOR | OWNER, with a scope (section 3a)
  confidence    in [0, 1], how likely the relation holds, independent of source
  evidence      file and span, test id, prompt id, trace id, as applicable
  derived_from  for derived assertions: the set of assertion ids this one depends on
  ir_schema     for assertions computed over the IR: the IR schema version
  encoder       for assertions computed by an adapter: adapter name and version
  at            wall-clock time
  supersedes    an earlier assertion id, or none

RETRACT
  id, tx, schema, at
  target        the assertion id that ceases to be live
  reason        source and asserter of the retraction, with evidence
```

Supersession handles replacement: yesterday's predicate replaced by today's. Retraction handles cessation: a call that is no longer made, an import removed, a participation ended, a test deleted, an invariant withdrawn, a rendering retired. Both keep the journal append-only; neither edits history. A retracted assertion and its retraction are both in the journal forever.

Every event carries a schema version. The meaning of a relation will change; when it does, old events are not reinterpreted. A migration writes new events, or a transformed projection, and says so. Without this the append-only guarantee is a lie in practice within a year.

Source and verification are two fields because they answer two questions. VERIFIED was a source in draft 3 and it is not one: an assertion arrives INFERRED and is later verified by a person, a replay, or a proof, and both facts must survive. Verification is an event that supersedes the assertion with the same content and a new verification value, so the history of how it came to be trusted is kept. RECORDED stays a source of its own: a prompt, an issue, or a commit message is evidence of a request and becomes intent only when a person with authority incorporates it.

**Derived assertions carry their dependencies.** A fingerprint, a similarity coordinate, an EQUIVALENT_TO proposal, an obligation's discharge state, and a narrative connector are all derived, and each carries `derived_from`, the set of assertion ids it was computed from. Invalidation is then one rule, applied by the store and not by each subsystem: when an assertion is superseded or retracted, every live assertion whose `derived_from` contains it is marked stale and recomputed or retracted in the same transaction. Recomputing outward along the call graph is a special case of this rule, not a separate mechanism.

**The IR is versioned, and so are the adapters.** Every assertion computed over the IR carries `ir_schema` and `encoder`. A change to normalisation semantics (a richer form of COMPARE, say) changes every fingerprint in the repository, and without these fields that would be indistinguishable from a semantic rewrite of the application. With them, the delta can say "no change in the application; the encoder changed", and a re-encode under a new IR schema is recorded as what it is.

### 3a. Authority has a scope

Three levels are too coarse for an application with organisational rules. A CPA, a regulator's text, a product owner, an administrator, and a developer each have authority over different things, and someone can be authoritative about one constraint and have no standing on another. Authority is therefore a level and a scope. The toolkit standardises only the mechanism: `level: NONE | CONTRIBUTOR | OWNER` and `scope: an application-defined scope`. The vocabulary is never toolkit-wide, because accounting-policy, safety, device-control, and ui-copy do not mean the same thing or carry the same weight across Regalia, LayerTime, and an Apache library, and a global list would be either absurdly long or too generic to check anything.

Each application declares its own scopes, and **a scope is a persistent concept**, kind `scope`, not a string: `SCOPE-17 RENDERS_AS "accounting-policy"`. Assertions carry the scope's concept id, so a scope can be renamed without changing identity, can carry a description, can be split later with lineage, and can be related hierarchically if an application ever needs that, and no authority check ever rests on text equality. An application may declare a root scope such as `application`; it is not authoritative over any child scope unless the owner declares that relation explicitly, so `OWNER / application` does not quietly become a superuser and defeat the reason scope exists. A DECLARED assertion is authoritative only for obligations in its scope, and `why()` requires the terminating intent to be authoritative for the scope of the obligation being explained.

## 4. Identity, equivalence, similarity, and analogy

Four things, kept apart:

**Identity is continuity, and continuity has a vocabulary.** A concept's id is opaque and permanent, attached to code by lineage, never by computation. For ordinary edits, moves, and renames, lineage is a symbol at a span followed by version history and the encoder's span tracking. For the cases that break that, which are exactly the cases UntangleIt exists to produce, lineage is explicit: `SPLIT_FROM` (three methods from one; none inherits the id, all three descend), `MERGED_FROM` (one from several), `COPIED_FROM` (a duplicate; a new id, descended), `EXTRACTED_FROM` (a helper pulled out; the parent keeps its id), and `DESCENDED_FROM` for the general case. The refactoring tool writes these as PARSED assertions with the transform as evidence, so identity is never guessed after the fact from the text. When lineage is lost entirely (a file deleted and rewritten, a port), the encoder proposes equivalence; it never invents identity.

**Fingerprints are evidence, through time.** Each is an assertion with validity, computed over the semantic IR (section 6), and each answers one question: *intrinsic* (decision shape, normalised predicates and transforms, effects, arity and type shape, and the intrinsic fingerprints of what it calls), refined over the call graph only, so it converges and never mentions context; *behavioural* (outcomes taken, shapes of what entered and left, effects observed, tests reached); *contextual* (threads, position, callers, dependents); *obligation* (what it satisfies and what constrains it). Equal refined fingerprints are evidence of structural equivalence, not proof: colour-refinement methods do not separate every pair of non-isomorphic graphs, and the design does not pretend otherwise.

**Equivalence is a claim, and it is scoped.** The relation is `SUBSTITUTABLE_UNDER`: A can stand in for B under a stated set of obligations, with evidence. It is not mathematical equivalence and the name no longer implies it: A substitutable for B under one obligation set and B for C under another says nothing about A and C, which is why it is not transitive. Proposed by `match()` at INFERRED with a confidence and the obligation set it was checked against; verified by a person, a replay, or a proof. A port is new anchors, each substitutable for its original under the port's obligations.

**Similarity is a distance**, in a space chosen by concept kind (section 9), used to find candidates and for nothing else.

**Analogy is out of scope.** Gentner's structure mapping is the ancestor of the idea that relations matter more than attributes, and it is where the design gets its instinct to strip names; it does not license the claim that structure establishes identity, and the design no longer makes that claim.

## 5. The vocabulary and its type system

A fixed vocabulary, each relation with a schema that `assert()` enforces: legal subject kinds, legal object kinds, layer, inverse, cardinality, and whether it is transitive or symmetric. An assertion that violates its schema is rejected at the store, which is the safety property that stops a model corrupting the graph with plausible nonsense.

Concept kinds: application, scope, thread, trace, component, module, class, executable (function, method), entity, state, event, external, test, requirement, intent, decision, constraint, invariant, obligation.

| Relation | Subject | Object | Layer | Inverse | Cardinality | Notes |
|---|---|---|---|---|---|---|
| CALLS | executable | executable | structural | CALLED_BY | many:many | not transitive |
| IMPORTS | module | module | structural | IMPORTED_BY | many:many | |
| MEMBER_OF | executable, entity | class, module | structural | HAS_MEMBER | many:one | |
| DEPENDS_ON | any implementation kind | any implementation kind | structural | DEPENDED_ON_BY | many:many | direct only; closure is a query result, never stored |
| HAS_EFFECT | executable | effect literal | structural | | many:many | attribute: kind (section 7) |
| HAS_PREDICATE | executable | predicate literal | structural | | many:many | normalised IR |
| HAS_TRANSFORM | executable | transform literal | structural | | many:many | normalised IR |
| HAS_FINGERPRINT | any | fingerprint literal | derived | | many:many | attribute: kind, valid_from, valid_to |
| RENDERS_AS | any | text literal | rendering | | many:many | attribute: language, audience |
| PARTICIPATES_IN | executable, entity, event | thread, trace | execution | HAS_STEP | many:many | attribute: position |
| FOLLOWS | executable (as a step) | executable (as a step) | execution | PRECEDES | many:many | attributes: control, data, narrative (section 8); scoped to a thread or trace |
| TESTED_BY | executable, obligation | test | execution | TESTS | many:many | attribute: proof strength |
| OBSERVED_IN | executable | trace | execution | | many:many | attributes: entered, returned, threw, outcomes, effects, conditions |
| SATISFIES | executable, component | requirement, obligation | intent | SATISFIED_BY | many:many | |
| SUPPORTS | requirement | job (a thread of kind business) | intent | SUPPORTED_BY | many:many | |
| SERVES | job | intent | intent | SERVED_BY | many:many | |
| CONSTRAINS | invariant, constraint | any | intent | CONSTRAINED_BY | many:many | attribute: modality |
| REQUIRES | requirement, intent | requirement, obligation | intent | REQUIRED_BY | many:many | |
| EXPLAINS | rendering, decision | any | intent | EXPLAINED_BY | many:many | |
| DERIVED_FROM | any | any | any | | many:many | provenance chain |
| SUBSTITUTABLE_UNDER | any | same kind | judgement | SUBSTITUTABLE_UNDER | many:many | attribute: obligation set; symmetric within the set; not transitive |
| SPLIT_FROM, MERGED_FROM, COPIED_FROM, EXTRACTED_FROM, DESCENDED_FROM | any | same kind | lineage | | many:many | written by the transforming tool with the transform as evidence |
| SIMILAR_TO | any | same kind | judgement | SIMILAR_TO | many:many | attribute: distance, space |
| CONFLICTS_WITH | assertion | assertion | judgement | CONFLICTS_WITH | many:many | symmetric |
| VIOLATES | trace, executable | obligation, invariant | judgement | VIOLATED_BY | many:many | |
| RESTORED_TO | application | checkpoint literal | history | | many:one | section 13 |

Primitive assertions stay local; closures (transitive dependency, reachability, the why chain) are derived by queries and never stored as base facts, so provenance stays attached to the direct fact that produced each hop. Adding a relation, a kind, or an attribute is a schema version.

## 6. The semantic intermediate representation

Parsing is not the hard part. The hard part is normalising language-specific constructs into shared semantics, and it is the largest single piece of engineering in Understanding. `x is None`, `x === null || x === undefined`, and `x.is_none()` are one predicate. `amount > 25000` is `COMPARE GT (INPUT monetary) (CONSTANT 25000)`. The pipeline is:

```
source
  → tree-sitter concrete syntax tree (in-process, through WebAssembly where the platform needs it)
  → language adapter (one per language, the only code that knows the language)
  → semantic IR (language-neutral)
  → assertions
```

The IR encodes: control (BRANCH with a normalised predicate and true and false arms, LOOP, SEQUENCE, RETURN, THROW, TRY, ASYNC, FORK, JOIN), data (INPUT, OUTPUT, transforms as normalised operator trees, constants with inferred units and ranges), effects (section 7), and calls resolved to concept ids.

**Literals are canonicalised.** `25_000`, `25000`, `$25,000`, `25000 USD`, and `Decimal("25000.00")` denote one value and must fingerprint as one: the IR carries a canonical literal (numeric value in a fixed representation, unit where inferred, precision where it matters) and never the source spelling. The same for booleans, nulls across languages, dates, and enumerations.

**Which strings enter.** Human-facing lexical renderings do not: identifiers, comments, log and message text, formatting. Literals that take part in predicates, protocols, state, identity, or externally observable effects do: `status == "APPROVED"`, `publish("ACCOUNT_CLOSED")`, a route path, a field name in a query, an enumeration value, an external operation name. The adapter classifies each string by where it is used, not by what it looks like, and the classification is itself a PARSED assertion so it can be reviewed. Fingerprints, predicates, transforms, and effects are computed over the IR and never over a language's syntax tree, which is what E1 depends on. The complexity library's walkers are rewritten as IR consumers, and the 40 whitepaper cases must still produce the same three numbers from the IR, which is their proof of survival.

## 7. Effects

Two executables with identical control structure and return values can differ entirely in meaning because one writes a database, sends an email, charges a card, or calls another service. The behavioural model carries an explicit effect vocabulary as attributes of HAS_EFFECT and OBSERVED_IN:

```
READ state          WRITE state         EMIT event
CALL external       THROW failure       RETURN value
```

Effects participate in the intrinsic fingerprint (as declared by the IR) and in the behavioural fingerprint (as observed), and in the similarity coordinates. Two implementations that compute the same value with different external consequences are not equivalent, and the store can say why.

## 8. Threads, traces, and connectors

A **thread** is a semantic traversal, suitable for narrative: a job Jeff would name, walked from its entry point. A **trace** is what actually executed, recorded by Witness, a partial order. A thread is stored as a small DAG with one or more valid narrative traversals; the plot branches, and the Plottr grid still holds.

FOLLOWS carries three connectors, kept apart because three clients need different ones:

```
control    SEQUENCE | BRANCH_TRUE | BRANCH_FALSE | LOOP | FORK | JOIN | ERROR | RETRY | ASYNC | RETURN
data       the concept or value that flows from the earlier step to the later one, or none
narrative  THEREFORE | BUT | none
```

The narrative connector is derived: THEREFORE when data flows, BUT when control is a branch or an error, none when neither is provable, in which case the FOLLOWS is INFERRED and flagged. CommentIt reads the narrative connector; DeepTest reads control; UntangleIt reads both. The storytelling rule survives without becoming the execution ontology.

**OBSERVED is observation, not law.** A trace asserts that this execution occurred under the recorded conditions (inputs, state touched, environment, version); it does not assert that every execution with the same apparent inputs behaves the same. Traces discharge obligations at the proof strength of what they show, never beyond it, and `match()` treats behavioural evidence as evidence.

**Obligations have a modality and a proof strength.** Modality is an attribute, not a family of verbs: REQUIRED, PERMITTED, PROHIBITED. A PROHIBITED obligation is discharged by evidence that the prohibited path was blocked under the recorded conditions, which is what a passing negative test is. Proof evidence is not a ladder. A path test is not stronger than a partition test, and a property test can test the wrong property, so discharge carries evidence dimensions rather than one rank, on the discharging TESTED_BY or OBSERVED_IN: examples (a count), boundaries (covered or not), partitions (covered of known), paths (covered of known), property (present or not), formal proof (present or not). What an obligation requires is stated on the obligation by its kind, and DeepTest reasons from the requirement to the evidence: an invariant over all transactions wants a property or a proof; a threshold wants boundaries; a dispatcher wants every partition. The 2.0 verdict is then "covered by 14 examples, boundaries covered, 4 of 5 partitions, no property", and a REQUIRED invariant with examples only is reported as exactly that.

**Violations are the point.** Evidence against evidence is CONFLICTS_WITH; evidence against authority is VIOLATES; nothing outranks anything, and both are first-class query results. The Anscombe rule is a query, `why(id)`: the shortest evidence-supported path from an implementation concept through SATISFIES, SUPPORTS, and SERVES to an intent with source DECLARED, authority appropriate for the obligation's scope, and whatever verification state the query's policy requires, with the confidence of its weakest link; a chain that dead-ends is reported as dead-ended.

## 9. Indexes, spaces, and the grid as a hypothesis

The **graph** is compressed sparse rows per relation, forward and reverse. The **thread map** is a bitmap of threads and traces by concepts. Both are rebuilt from the projection and are exact.

**Similarity spaces are per concept kind.** Functions are near by branching, predicates, transforms, and effects; requirements by obligations and relations; threads by topology; tests by what they discharge and at what strength. One universal space would let ways-through at 250 swamp arity at 3, so each space has an explicit policy for scaling (per-dimension normalisation to a fixed range), weighting (set per kind and recorded), categorical dimensions (one-hot or ordinal, stated), missing values (a reserved coordinate), and correlated dimensions (dropped or combined, stated). Cross-kind comparison happens only through a shared projection where it is meaningful, and the design names none yet.

**The grid** supplies the adaptive multidimensional partition, after Nievergelt, Hinterberger, and Sevcik (1984, https://doi.org/10.1145/348.318586): symmetric multikey access, an adaptive partition per dimension, bounded accesses per point query on disk. Understanding's nearest-neighbour traversal over that partition in a behaviour space is a new use of it and is a hypothesis of this design, not a property inherited from the paper. Eight or fewer primary dimensions per space; the rest re-rank within a cell; search expands in shells with a bound; E3 measures cost and agreement with exact search. The grid is not the invention. If another structure wins E3, the architecture is untouched.

## 10. Storage, incremental maintenance, and the semantic delta

The journal is the durable form: append-only, one event per line in a format a person can read and git can diff, under the workspace root in a folder the tools share. A materialisation (live projection, fingerprints, partitions) is a cache, written when replay would exceed the load criterion and whenever KeepSafe takes a checkpoint with a verdict attached. Load reads the last materialisation, replays committed transactions since, and builds the indexes; a materialisation can always be discarded and rebuilt from the journal.

Encoding is incremental. Structural assertions carry the hash of the source span they came from; a change marks them stale; only those are re-encoded through the IR; intrinsic fingerprints are refined outward along the call graph until stable; contextual fingerprints are recomputed for the threads touched; renderings and intent assertions on concepts whose intrinsic fingerprint did not change are untouched; DECLARED and VERIFIED assertions are never touched by encoding. Relations that vanished are RETRACTed by the encoder with the new parse as evidence.

The semantic delta is a comparison of projections at two sequence numbers in six categories: implementation (intrinsic fingerprints), behaviour (behavioural fingerprints and predicates), context (contextual fingerprints, participation), intent (DECLARED and VERIFIED assertions, and new VIOLATES or CONFLICTS_WITH), obligation (discharge state and proof strength), documentation (stale renderings). A 300-line formatting change reports nothing; a one-predicate change reports an implementation and behaviour change with the threads and obligations named; adding an unchanged function to a third thread reports a context change only.

## 11. The operations

No query language. Fourteen operations with fixed result shapes, all read through one writer (section 12):

1. `encode(sources)`: adapters and Witness readers over changed sources, in one transaction; returns the delta.
2. `concept(id)`: anchor, live assertions by layer, fingerprints with validity, renderings.
3. `neighbourhood(id, depth, layers, minConfidence)`: bounded context.
4. `threads(id)` and `traces(id)`: participation, with position and connectors.
5. `steps(threadId)`: the DAG with its narrative traversals and connectors.
6. `nearest(id | coordinates, kind, k)`: k most similar in that kind's space, with distances.
7. `match(candidate)`: EXACT_FINGERPRINT, PROBABLE_EQUIVALENT, STRUCTURALLY_SIMILAR, or NONE, proposing SUBSTITUTABLE_UNDER with its obligation set where warranted.
8. `why(id)`: the shortest evidence-supported path to an authoritative intent, or where it dead-ends.
9. `render(id, language, audience)`: the current rendering, or a brief for regeneration.
10. `assert(event)` and `retract(target, reason)`: append under schema enforcement, within a transaction, detecting CONFLICTS_WITH and VIOLATES.
11. `obligations(filter)`: what is demanded, with modality, discharge state, and proof strength.
12. `violations()` and `conflicts()`: declared and contradicted; evidence and contradicted.
13. `delta(fromSeq, toSeq)`: the six categories.
14. `restore(checkpoint)`: section 13.

## 12. Transactions, writer, and recovery

Journal writes are atomic batches: `BEGIN tx`, events, `COMMIT tx`. On replay an uncommitted transaction is ignored, so a crash mid-encode never exposes half a semantic change as live. Every encode, Witness ingestion, human verification, refactor delta, and materialisation is one transaction.

One store has exactly one writer. The extension host owns the journal; a command-line run, a background runner, or a test suite either sends events to that writer or acquires an exclusive lock on the journal for its lifetime. Two appenders allocating the same sequence number is the failure this rule exists to prevent, and it is decided now rather than discovered.

## 13. Restore is an event, not a rewind

When KeepSafe restores a checkpoint, the application returns to an earlier state; Understanding does not rewind. It appends `RESTORED_TO checkpoint` in a transaction, the projection returns to the semantic state recorded at that checkpoint, and the journal keeps everything that happened in between. A restore is therefore a first-class semantic event: the store remembers that B existed and that the repository went back to A, which is more than the repository itself remembers.

## 14. Encoding, rendering, and the tools

Encoding: adapters produce the IR and the structural layer; Witness produces traces; the owner's validated intent and jobs are DECLARED first; prompts, issues, and commit messages are RECORDED beside them; tool briefs add INFERRED assertions with confidence and evidence; the transforming tool writes lineage. The complexity walkers and Witness's instrumenter become encoders, their tests unchanged.

Rendering: a rendering is INFERRED with verification NONE until judged. Code is judged by the verification ladder (inlining, replay against traces, fingerprint, suite); English by the mechanical checks of the CommentIt review; a test by the obligation it discharges and at what strength. The store never vouches.

The four tools ask four bounded questions of one memory: DeepTest, what are we obligated to prove and lack evidence for, and at what strength; UntangleIt, where can this implementation be cut while preserving the evidence-supported semantic structure; CommentIt, what authoritative purpose does this implementation serve along this thread; KeepSafe, what did the code and our understanding of it look like at this point in history. The four surfaces and verbs do not change.

## 15. Experiments

**E1, semantic invariance across ports.** Encode the seven HelloWorlds ports. Success: the semantic projection (threads as DAGs, normalised predicates, transforms, and effects on each step, obligations, and intent chains) is isomorphic across all seven; `match` proposes SUBSTITUTABLE_UNDER at PROBABLE_EQUIVALENT or better between every corresponding pair; `pickGreeting`'s seven anchors carry identical normalised predicates. Failure means the port is not the same program, a lexical feature leaked into the IR, a semantic operand or effect was dropped, or an adapter normalises differently from its siblings, and the adapter is fixed first.

**E2, round trip.** Encode Regalia. Render one thread to Jeff's English, to a test, and to Python. Success: the English passes the mechanical checks and the owner recognises the job; the test discharges the thread's obligations at partition strength or better and passes on the original code; the regenerated Python passes the original suite unedited and measures no worse on ways through and tangle per piece. "Most optimised form" is supported only on nine of ten sampled threads.

**E3, speed, and the grid.** On Regalia: load under 500 ms from a materialisation; `neighbourhood` to depth 3 under 1 ms; `nearest` with k of 10 under 1 ms and agreeing with exact search on at least 95 percent of queries; `encode` of a one-file change under 200 ms within one transaction, touching no concept outside the intrinsic neighbourhood; `delta` under 50 ms. Medians of five on Michael's machine. If the grid misses the bar, exact search becomes the index and the grid is recorded as tried.

**E4, semantic delta and history.** The 25,000 to 50,000 threshold change reports one predicate changed, a behaviour change, and a VIOLATES or CONFLICTS_WITH if a DECLARED threshold exists, with threads and obligations named. A 300-line formatting change reports nothing. Adding `validateAddress` to a third thread reports a context change only. An encoder upgrade under a new IR schema reports no application change and an encoder change. A KeepSafe restore reports a RESTORED_TO event, the projection matches the checkpoint's materialisation, and the journal still contains the intervening events. A crash injected mid-encode leaves the projection at the last committed transaction.

**E6, destructive refactor and lineage.** Take one Regalia method that serves three threads. Split it into three methods; rename them; move two into another module; inline one helper; preserve behaviour. Success: lineage is recorded explicitly (SPLIT_FROM for the three, EXTRACTED_FROM and its retraction for the inlined helper) and no identity is invented; the delta reports the expected implementation and context changes and no unintended behaviour or obligation change; every `why()` chain that reached an authoritative intent before still does, through the new concepts; every post-refactor concept is traceable to the pre-refactor semantic responsibility; and the encoder, re-run cold on the result with no lineage, proposes SUBSTITUTABLE_UNDER between the new pieces and the old concept at PROBABLE or better. This is the test for the part of the design most likely to hurt in use, because it is what UntangleIt does on purpose.

**E5, the ontology.** Feed `assert()` one thousand model-generated assertions drawn from a brief over Regalia. Success: every assertion that violates a relation schema is rejected with the rule named, none is accepted, and the accepted set contains no assertion a reviewer marks as kind-impossible. This is the safety property under test.

## 16. Implementation order, and the first move

The ontology is where Understanding lives or dies, so the order is the review's, and the grid is last. The risk has flipped: the design was under-specified and is now at risk of becoming a perfect semantic universe before two adapters have been shown to normalise the same five nontrivial behaviours. So the first move is small and brutal, and nothing else is built until it passes, in this order: concept ids and kinds; ASSERT, RETRACT, BEGIN, and COMMIT; schema enforcement; application-defined authority-scope concepts; the minimum IR for predicates, constants, branches, returns, throws, and effects; the Python adapter; the TypeScript adapter; and a test corpus designed to make the two adapters disagree. The corpus gets nastier than HelloWorld at once, because null against undefined will not expose the real normalisation failures. The first adversarial pair:

```python
if amount > Decimal("25000.00") and status == "APPROVED":
    publish("ACCOUNT_CLOSED")
```

against the same behaviour written with different structure:

```typescript
if (status !== Status.Approved) return;
if (amount <= 25_000) return;
await events.publish(AccountEvents.Closed);
```

Both adapters must independently produce the same normalised predicates (a comparison on a canonical monetary literal, an equality on a canonical state value), the same control outcome (the effect happens only when both hold, however the guards are arranged), and the same external effect (EMIT of one canonical event), with the same fingerprint. Then: exceptions against discriminated unions; a library call against its expansion; a loop against a comprehension; an early-return chain against a nested conditional. If the two encoders independently turn equivalent code into the same normalised predicates, transforms, effects, and threads, the hardest bridge in the project is crossed. If they do not, no grid, no CommentIt integration, and no rendering would have mattered. The ontology stops growing from this draft except where that build forces it.

The order after the first move:

1. persistent identity and lineage;
2. the semantic IR and the first two language adapters (Python, TypeScript);
3. assertion, retraction, transactions, schema and IR versions, derived-from invalidation, single writer;
4. the relation type system, lineage relations, and E5;
5. effects, traces, and the observation rule;
6. obligations with modality and evidence dimensions;
7. threads as DAGs with the three connectors, `why` with authority scope, and E6;
8. indexes, per-kind spaces, and the grid under E3.

## 17. Principles, and what is not claimed

The 2.0 paper's twelve principles hold. Five are now properties of the primitive: deterministic extraction outranks inference within a layer; inference never becomes intent without a person with authority; memory changes are events; a request is not an intent; and a restore is remembered. The store is useful to a developer who has never heard of a graph, because the developer never sees it.

Not claimed: that fingerprints separate every pair of different things (substitutability is a claim for that reason); that the record is canonical on the day of encoding (it is source-derived until E2 says otherwise); that identity can be computed (lineage and people carry it); that a trace proves a law (it proves an execution under conditions); that an example discharges an invariant (proof strength says what it discharges); that the intent layer fills itself; that a rendering is correct because the store produced it; that the grid is the right index; that any of this scales beyond one workspace in one process; or that any of it has been measured. E1 through E6 are the measurements.

## Sources

- Nievergelt, J., H. Hinterberger, and K. C. Sevcik. "The Grid File: An Adaptable, Symmetric Multikey File Structure." *ACM Transactions on Database Systems*, vol. 9, no. 1, 1984, pp. 38-71. https://doi.org/10.1145/348.318586. The adaptive partition; nothing more is claimed from it.
- Gentner, Dedre. "Structure-Mapping: A Theoretical Framework for Analogy." *Cognitive Science*, vol. 7, no. 2, 1983, pp. 155-170. https://doi.org/10.1207/s15516709cog0702_3. The instinct to weigh relations over attributes; nothing about identity is claimed from it.
- MikeVan's AI Development Toolkit V2.0, Semantic Memory (2026), sections 3 to 7, 13, 16, and 21.
- Critique of Understanding: Founding Design (first pass) and Understanding: Second-Pass Technical Review, both 2026-09-13. Draft 2 took the first; draft 3 takes the second in full: event sourcing and schema versions, retraction, modality, the relation type system, the semantic IR, effects, observation as observation, proof strength, the three connectors, threads as DAGs, per-kind spaces with normalisation, the scoped citations, the no-native-code wording, restore as an event, transactions, the single writer, the five objects, and the implementation order.
- Third review of the founding design (draft 3), 2026-09-13. Lineage vocabulary; IR and encoder versions; `derived_from` invalidation; source against verification; authority scope; proof evidence as dimensions; direct dependency with derived closure; scoped substitutability; literal canonicalisation; semantic strings; the two phases; E6; and the first move.
- This toolkit's record, 2026-09-13: the CommentIt design review, the UntangleIt behaviour-preservation hypothesis, and the KeepSafe checkpoint-cost hypothesis.
