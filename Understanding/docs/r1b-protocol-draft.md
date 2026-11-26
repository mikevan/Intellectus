# R-1B, continuation ordering: protocol draft for review

Michael Van Geertruy, with Claude. INTERNAL. Drafted 2026-11-02. **Not frozen.** No code moves until Michael rules on section 7.

## 1. What R-1B has to make true

An emitter must never invent the order of observable effects. Today the store fixes no order at all, and that is wider than `await`:

- **Ingestion never writes an order fact.** `FOLLOWS` exists in `src/schema/relations.ts` (executable to executable, required `control` and `within`), but nothing in `src` writes it, and `test/ir/ingest.test.ts` line 64 explicitly forbids ingestion from writing it.
- **The projection throws order away on purpose.** `src/ir/index.ts` sorts outcomes by content (line 322) so that two spellings of the same logic project identically. That is right for identity, and it means the sequence the encoder walked never reaches the store.
- **The checker cannot be satisfied.** `src/query/sufficiency.ts` reports `ORDER_UNSPECIFIED` for any executable with two or more observable effects without asking the store anything, so no representation could clear it.

`await` makes this acute rather than causing it. The measured target from R-1A stands: the qualifying `encodeFunctions` flow in `ir0-typescript` carries `ORDER_UNSPECIFIED` 3 (`encodeFunctions`, `parse`, `loadLanguage`), and `operand` carries 2.

## 2. What the semantics require, from first principles

1. **Initiation order and completion order are different facts.** For a synchronous call they coincide. For an asynchronous one they do not: `a(); b();` fixes only that `a` started before `b`, while `await a(); b();` fixes that `a` finished before `b` started. If the order relation cannot tell these apart, R-1B erases `await` again, one layer up from where R-1A recovered it.
2. **An await orders the continuation frontier, not every later step.** Completion of the awaited computation precedes the next step on that path. Everything after that is derived by following the chain. No edge is written from an await to each successor (Michael's note from 2026-09-17).
3. **Order is per control path.** Two steps on different branches are never ordered against each other. A step under a condition keeps its predicate, which Michael ruled today stays in the graph.
4. **Program order between effects is the safe default, not dependency order alone.** A dependency-only rule would order steps joined by data flow or by an await and leave the rest unordered. `encodeFunctions` shows why that is not enough: `visit(root)` fills the `enums` map and `walk(root)` reads it through `ctx`. No value flows from one call to the other, yet swapping them changes the result. The order is carried by shared state the IR does not model. Until state reads and writes are represented, observable effects keep the order they were written in on each path.
5. **Steps with no effect are not ordered.** Two pure bindings that do not depend on each other need no order fact, and writing one would be inventing it.
6. **Textual position is evidence, never the fact.** The encoder learns order from its walk. The stored fact is "precedes on this path", never "line 12 before line 15". Provenance stays out of fingerprints, as X2 required under R-1A.

## 3. Steps, each independently falsifiable

**R-1B0, instrument only.** The checker reports `ORDER_UNSPECIFIED` per unordered pair of effects, decided from store facts by a written definition of "fixed": two effects are ordered when a chain of order facts on one control path connects them. No representation changes and no encoder version moves. Prediction: every `ORDER_UNSPECIFIED` count stays exactly as it is today, because no order facts exist yet, and the per-pair listing is new output only.

**R-1B1, experiment before any schema change.** `FOLLOWS` relates executables, but effects are literals on `HAS_EFFECT` and invocations are concepts of kind `invocation`, so `FOLLOWS` cannot order two effects inside one executable without widening its kinds. Michael's 2026-09-17 ruling was not to assume `FOLLOWS` is the relation. So both candidates are tried in a scratch store, by hand, on `loadLanguage`, with the R-1B0 checker as the judge:

- **A.** `FOLLOWS` widened to invocation and effect occurrences, with `control` carrying `initiation` or `completion`.
- **B.** A new relation dedicated to step order, with the same basis attribute, leaving `FOLLOWS` for executables in a thread.

The experiment reports, for each: whether the checker can derive every required order from the store alone, how many assertions it takes, whether initiation and completion stay distinguishable, and what it does to `test/ir/ingest.test.ts`. Michael picks one before R-1B2.

**R-1B2, representation.** The chosen relation is written by ingestion from an ordered list the encoder already has, referring to outcomes by content as R-1A did, never by index. The sorted outcome set and the fingerprint stay as they are. Predicted to move `ir_schema` to 7, because a new kind of fact enters the contract. Both adapters bump; a frozen copy holds the IR and both adapters.

## 4. The hand-derived target: `loadLanguage`

```
if (!ready) ready = Parser.init();      initiation of Parser.init, under !ready
await ready;                            completion of ready precedes the next step
let lang = languages.get(name);
if (!lang) {
  ... readFileSync(path)                under !lang
  lang = await Language.load(...)       completion of Language.load precedes languages.set
  languages.set(name, lang);
}
return lang;
```

The facts R-1B2 must produce here are written out above before any code exists. After R-1B2 the `loadLanguage` occurrence of `ORDER_UNSPECIFIED` must reach 0, with `Parser.init` ordered by initiation only, since it is never awaited where it is called.

Numeric predictions for every corpus are frozen with the protocol, after Michael's review, by reading each affected function the way this section reads `loadLanguage`. One lesson from IR-9 and R-1A applies: a represented construct changes every flow that passes through it, so the predictions walk the callers too.

## 5. Controls

- **N1, the core distinction:** `a(); b();` and `await a(); b();` produce different order facts (initiation against completion), in both languages.
- **N2:** reordering two independent pure bindings changes no order fact and no fingerprint.
- **N3:** whitespace, comments, and splitting one statement across lines change nothing.
- **N4:** two effects on different branches are never ordered against each other.
- **X1:** the same constructs in Python and TypeScript produce the same order facts.
- **X2:** the section-16 pair (nested `if` against early-return chain) produces the same order facts, with provenance excluded.
- **Monotonicity:** every R-1A projected fact survives unchanged; R-1B only adds order facts.
- **Guardrails:** never order effects across paths, and never manufacture an order between steps with no effect.

## 6. What R-1B does not claim

No scheduling model and no concurrency beyond "initiated before". No failure propagation; that is R-1C. No order between executables beyond what the call graph already says; thread-level order is later work. No model of shared state, which is why section 2.4 keeps program order.

## 7. Rulings needed before anything is frozen

1. Initiation and completion as distinct order facts: the core requirement of R-1B.
2. Program order between effects on a path as the default (section 2.4), until state is represented.
3. The split into R-1B0, R-1B1, and R-1B2, in that order.
4. Running both candidates A and B in R-1B1, or naming one now.
5. Carried from today's ruling: whether a dependency's condition keeps the same `HAS_PREDICATE` relation as value outcomes or gets its own.
