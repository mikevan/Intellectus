# P0 results: radon's 120/121, site by site

Michael Van Geertruy, with Claude. INTERNAL. Run 2026-11-02.

**Question.** Why does radon show 120 statement-level call sites against 121 stored call invocations, and does the R-1B1 step population correspond to R-1B0's effect population?

**Run under:** `docs/p0-protocol-frozen.md` (`bfc3195c...`), controls `docs/p0-controls.json` (`026e9809...`, frozen, unchanged) and `docs/p0-controls-2.json` (`469fa4f5...`, added after the source review). Recorded build `d7efd55eb399`, against baseline `a93a98cead33`. Raw results are in `docs/p0-results.json` (`2ccfbe65...`), and every run's complete output is in `docs/p0-run/`, which carries its own `MANIFEST.sha256`.

## 1. The answer

Radon's one extra stored invocation is a single call in `complexity.py`, in the executable `cc_visit_ast`:

```python
return ComplexityVisitor.from_ast(ast_node, **kwargs).blocks   # line 108
```

- **IR location:** `body[1].value.object.expr`.
- **Wrapper shape:** `return` → `read` (`.blocks`) → `computed` → call `from_ast`.
- **Contributing outcomes:** one, `return(read>computed)`, which went into the binding group. Nothing was merged or dropped.
- **Counts at its key:** O-pp 1, S 0, P 1, T 1. The mapping is unique.

The source line was located by a text search, not by the instrument. The IR carries no lines.

Ingestion's `fromOperand` descends through `read`. The draft 1 probe counted a returned call only when it was the whole `computed` value. So the store is right, and the 120 is a **miss of the draft 1 probe**. Both original figures stand as recorded.

Nowhere in the three corpora did the instrument find anything else that differs:

| Corpus | O | O-pp | S | P | T (store) | of T, matched | of T, store-only | Rows |
|---|---|---|---|---|---|---|---|---|
| ir0-typescript | 113 | 65 | 65 | 65 | 65 | 65 | 0 | 9, all coarse-ambiguous only |
| toml-python | 104 | 65 | 65 | 65 | 65 | 65 | 0 | 0 |
| radon-python | 183 | 121 | 120 | 121 | 121 | 121 | 0 | 1 wrapper, plus 11 coarse-ambiguous only |

The pseudo-invocations are 15, 34, and 81, and the projected and stored counts are equal for each.

**Coarse-ambiguous rows** (20 keys in all) are a mapping limit, not a discrepancy. In each one, two or more projected keys share an operation, argument kinds, and receiver kind but differ in path condition or literal content. The stored invocations cannot be split between them because the store records neither, but the coarse totals agree in every case. No key needed `multiplicity`, because no two identical occurrences share a path condition in these corpora.

## 2. Predictions, scored as frozen

| # | Prediction | Result |
|---|---|---|
| 1 | Figures reproduce: S 65/65/120, T 65/65/121 | **Held** |
| 2 | H1: exactly one `wrapper` row, in radon; none in toml or ir0 | **Held** (`cc_visit_ast`, `read`) |
| 3 | No `grouping-merge`, `grouping-duplication`, `ingestion-discrepancy`, or `other` rows | **Held** in all three. H2a, H2b, and H3 have no supporting row. |
| 4 | Nothing else moves | **Held.** See section 4. |
| 5 | A1, as revised before freezing: write, emit, and opaque match exactly; each call-step surplus is exactly the returned or thrown call steps; no unmatched effect | **Held.** See section 3. |

## 3. A1 findings

| Corpus | Executables equal | Unmatched steps | Groups whose unmatched count equals their returned call steps | Ambiguous groups | Unmatched effects | Write, emit, or opaque mismatches | Step-population pairs | Legacy `HAS_EFFECT` pairs (R-1B0) |
|---|---|---|---|---|---|---|---|---|
| ir0-typescript | 46 of 58 | 13 | 13 of 13 | 0 | 0 | 0 | 97 | **96** |
| toml-python | 42 of 56 | 15 | 15 of 15 | 0 | 0 | 0 | 314 | **303** |
| radon-python | 95 of 137 | 44 | 44 of 44 | 0 | 0 | 0 | 297 | **274** |

- **The cause is one rule.** Every unmatched step is a call carried by a `return` value. `project()` emits no `CALL_EXTERNAL` outcome for a returned call, so it has no `HAS_EFFECT`.
- **Every group attributed uniquely.** No group's attribution was ambiguous in the corpora: in each, the whole group was unmatched. Control C7 (`f(a); return f(a)`) shows the case where a group is ambiguous. One step of two is unmatched, both candidates are listed, and neither is named.
- **The two pair counts are kept distinct.** The legacy `HAS_EFFECT` pair count reproduces R-1B0's 96, 303, and 274 exactly. The expanded step population gives 97, 314, and 297. Amendment A1's "preserves R-1B0's population" does not hold as a count, as predicted at freeze.

## 4. Baseline comparison

I compared the complete `measure`, `graph`, and `sufficiency` outputs for all three corpora at `a93a98cead33` with those at `d7efd55eb399`:

- **`measure`:** the only line that differs is the build id.
- **`graph`:** no line removed or changed. The P0 section is appended.
- **`sufficiency`:** identical.

Within that:

- R-1B0's pairs are unchanged at 96, 303, and 274, with 0 fixed. `ORDER_UNSPECIFIED` is 3 and 2. `HAS_PREDICATE` is 96 for ir0.
- Every corpus still reproduces its R-1A row.
- The full test suite passes 181 of 181: the 158 existing tests, the 19 frozen-control tests, and 4 added in the second controls revision.

## 5. Other observations from the run

- **Occurrences outside ingestion's rule.** These are not stored as invocations today:

  | Corpus | Nested argument | Receiver | Predicate | Expression operand | Behaviour body | Unreachable |
  |---|---|---|---|---|---|---|
  | ir0-typescript | 8 | 19 | 3 | 4 | 14 | 0 |
  | toml-python | 6 | 12 | 11 | 10 | 0 | 0 |
  | radon-python | 40 | 6 | 2 | 13 | 1 | 0 |

- **Visibility bound.** Semantic opaque statements are 15, 34, and 81, and value-less throws are 18, 10, and 8. Calls hidden behind these are in no population. Both encoders drop the value of a `throw` or `raise`.

## 6. Implementation corrections, separate from the predictions

None of these touched a frozen prediction or a frozen control.

1. **r1 (`288a040a8162`) reported executables with no invocation and no effect as IR-only.** The store readback had created entries only on encountering a fact. The populations were unaffected. Fixed in r2 (`86cdaae80cf9`), which also added counts of every key's mapping status.
2. **The P0 source review led to r3 (`d7efd55eb399`):**
   - The stored total is now computed from the store itself and split into matched and store-only parts.
   - A1 now compares by matching group and names a step only when its whole group is unmatched; traversal order no longer decides attribution.
   - The test harness keys by file and name, and checks that control names are distinct; they were.
   - `docs/p0-controls-2.json` adds an empty-executable and stored-only-executable control, plus A1 attribution expectations for C7 (ambiguous) and C9 (unique).

   **Effect on the results:** in the three corpora, r2 and r3 give identical populations and identical A1 counts. Every group was uniquely attributable, and nothing was store-only.
3. **Recurring tooling hazard.** Writing a file from the session to Michael's computer twice left stale bytes in place. Both were caught by hash comparison and rewritten before any recorded run.

All runs (baseline, r1, r2, and r3) are kept in `docs/p0-run/`, and none was rewritten.

## 7. What this means for P1

P0 reports facts; P1 chooses. **Constraint carried forward:** P1 must preserve every invocation the store represents today, including `cc_visit_ast`'s wrapper call and all 121, 65, and 65 call invocations.

1. **Wrapper calls.** In these corpora there is one, `cc_visit_ast`. It is a stored invocation, but under R-1B1's step definition it is not a step.
2. **Returned calls: 72 in total** (44, 15, and 13). Each is a call step with no `HAS_EFFECT`. P1 must decide whether a returned call is an ordered effect-bearing step. Its answer also settles which pair count is the R-1B2 baseline: 96/303/274 or 97/314/297.
3. **Occurrences outside the rule: 149 in total** (62, 39, and 48; section 5). Representing them would add facts. Leaving them out loses nothing the store has now.
4. **No ingestion or grouping defect needs fixing before P1.** The grouping rule's known merge case (C7) does not occur in these corpora. It stays recorded as an uncertainty, not a prerequisite.
