# P0 protocol draft: reconcile walked call sites with stored call invocations

Michael Van Geertruy, with Claude. INTERNAL. Drafted 2026-11-02. **Draft for review. Not frozen. No implementation.**

## 1. What P0 must establish

R-1B1 draft 1 recorded a measured discrepancy from a probe outside the repository:

| Corpus | Call sites in the walk (draft 1 probe) | Call invocations in the store (I-0 accounting) |
|---|---|---|
| `ir0-typescript` | 65 | 65 (80 invocations minus 15 pseudo) |
| `toml-python` | 65 | 65 (99 minus 34 pseudo) |
| `radon-python` | **120** | **121** (202 minus 81 pseudo) |

P0 names the cause of every difference, site by site, before P1 is frozen. It **never adjusts either count to make them agree.** Both original observations stay as recorded. If the cause turns out to be the probe rather than the store, that is logged as a miss of the draft 1 probe.

## 2. Scope

An **instrument only**, in the I-0 tradition. It extends `src/query/reconcile.ts` with a site-level reconciliation, and adds a section to the `graph` report.

- No change to the IR, the encoders, `ir_schema` (6), ingestion, or the store.
- The build id moves, because `src` changes. No `EXPECTED.json` row is appended, as at I-0 and R-1B0.

## 3. Definitions, frozen with the protocol

- **Stored call invocation.** A `HAS_INVOCATION` assertion whose operation is not an `opaque:` pseudo-invocation.
- **Projected call site.** Each site the ingestion rule itself counts, computed by a **separate re-implementation of that rule** inside the instrument, so the instrument can disagree with ingestion. That rule:
  - takes `CALL_EXTERNAL` outcomes;
  - takes binding outcomes whose expression, with `awaited` unwrapped, is a call;
  - takes calls reached from `return` and `throw` values **through `computed`, `negated`, and `read` wrappers** (ingestion's `fromOperand`, `src/ingest/index.ts` lines 183 to 191);
  - merges per key as `max(effects, binds)`.
- **Statement-level call site.** The draft 1 probe's population: a top-level call in a binding, `evaluate`, or effect statement, or a `computed` call directly in a `return` or `throw` value. Kept **only** to reproduce the draft 1 figures.

Per executable, the instrument lists each population's sites by key `(operation, arguments, path condition, receiver)`, and every key whose counts differ between any two populations.

## 4. Hypotheses, stated before measuring

| | Hypothesis | What it predicts |
|---|---|---|
| **H1, probe scope** (stated as the likely cause, not assumed) | The draft 1 probe counted a call in a `return` or `throw` value only when it was the whole `computed` value. Ingestion also descends through `negated` and `read` wrappers, as in `return f(x).attr` or `return -f(x)`. | radon contains exactly one such call. Statement-level gives 120, projected and stored give 121, and the difference is that one site. toml and ir0 contain none. |
| **H2, store double count** | One source call lands under two different keys in ingestion's regrouping, for example because its effect and binding reports differ in receiver or path condition. | Projected equals statement-level (120), and stored is 121. |
| **H3, other** | Neither of the above. | P0 must then name the construct before P1. |

## 5. Predictions, frozen with the protocol

1. **The figures reproduce.** Statement-level and stored counts match the table in section 1.
2. **H1 holds.** The projected population equals the stored one in all three corpora (65, 65, 121). In radon, exactly one executable differs between statement-level and projected, by exactly one site, and that site is a call under a `read` or `negated` wrapper in a `return` or `throw` value. If this fails, the failure is scored as written and H2 or H3 is investigated. Nothing is tuned.
3. **Nothing else moves.** Every existing `measure`, `graph`, and `sufficiency` figure is identical apart from the build id and the new section, including R-1B0's 96, 303, and 274, and `HAS_PREDICATE` 96. Every corpus still reproduces its R-1A row.
4. **The A1 correspondence check.** The instrument also counts R-1B0's observable-effect population per executable: `HAS_EFFECT` of kind `CALL_EXTERNAL`, `WRITE`, or `EMIT`, which includes the opaque pseudo-effects. It reports whether each executable's count equals its statement-level call, write, emit, and opaque steps. This is the correspondence that amendment A1 requires P0 to verify. **Prediction:** equal in every executable of all three corpora. Any difference is listed by executable and construct, not corrected.

## 6. Controls

- **H1 positive:** a fixture with `return f(x).attr` must count one site in the projected and stored populations and zero in the statement-level one.
- **H2 negative:** a bound call whose effect and binding reports share a key must count one site in every population.
- **Repeated identical calls:** `a.x(); a.x();` counts two sites in every population.
- **Pseudo-invocations:** an opaque statement counts in none of the three call populations, and does count in the A1 effect population.

## 7. What P0 hands to P1

P0's result decides one input to P1's invocation-mapping ruling. If H1 holds, some stored invocations, such as calls under `read` or `negated` wrappers in returned values, have **no statement-level step** under R-1B1's step definition. P1 must then decide one of three things:

- whether such calls become steps;
- whether their invocations stay unmapped and are reported;
- whether invocations are minted from the walk.

P0 reports the facts. It does not choose among these.

## 8. Rulings requested

1. The scope: an instrument, the build id moves, no row is appended.
2. The three population definitions, including the instrument's independent re-implementation of ingestion's rule.
3. The hypotheses and the four predictions, H1 included as the stated prediction.
4. The A1 correspondence check living in P0.
5. The controls.
