# R-1B1 addendum 2: the diagnostic contract adjusted, and the follow-up frozen before it runs

Michael Van Geertruy, with Claude. INTERNAL. Ruled and frozen 2026-11-02, before any follow-up checker code. Nothing frozen earlier is edited:

- `r1b1-protocol-frozen.md` `cf118c69...`
- `r1b1-manifest.json` `072b5101...`
- `r1b1-results.md` `7e08732a...`
- `r1b1-results.json` `0ba232f2...`
- `r1b1-addendum-1.md` `08c69913...`

## 1. Rulings recorded

- "Addendum" was the intended word.
- **Applying primary and consequent roles to R18 is accepted.**
- **Addendum 1's general rule is adjusted.** It said "one bad fact produces exactly one primary code". **Replaced by:** each control has an **explicitly predicted set of primary diagnostics**, plus any **consequent diagnostics, each linked to its cause**. "Exactly one primary" is not imposed universally, and independent violations are never suppressed.
- The R9/R10 interpretation is accepted. When `AWAIT_TARGET` names a call, R9 compares call identity. Otherwise R10 validates the operand class. Controls for both paths are retained.
- The checker's list-to-set comparison fix stays in the run history, which names the revision that produced each result (section 4).
- R-1B1's design selection is accepted. **Validation closure is pending this follow-up.**

## 2. Diagnostic follow-up: frozen expectations

A consequent diagnostic is written `CODE <- CAUSE`. The original run's expectations and its R13 miss stand. These results are reported **separately** from that run.

| Control (rule, alternative from the frozen manifest) | Primary | Consequent |
|---|---|---|
| R13, `AWAIT_TARGET` to a non-call step | {R13} | {R12 <- R13} |
| R13, `AWAIT_TARGET` to another executable's call | {R13} | {R12 <- R13} |
| R13, call step with class unresolved | {R13} | {R12 <- R13} |
| R13, literal with class call-result | {R13} | {R12 <- R13} |
| R12, await without `AWAIT_TARGET` | {R12} | {} |
| R12, await with two valid `AWAIT_TARGET` | {R12} | {} |
| R18, entry missing | {R18} | {} |
| R18, entry duplicated (the second fact refused, the first kept) | {R18} | {} |
| R18, entry owned by another executable | {R18} | {R18 <- R18} |
| R18, entry with an incoming program fact | {R18} | {} |
| Every other refusal control in the frozen manifest | its frozen expected set | {} |

**Classification rule for the follow-up checker:**

- A store-level R12 or R18 is **consequent** when every stored fact that could have satisfied it was refused, and it names those refusals as its cause.
- Otherwise it is **primary**.

## 3. Conflicting-arm test through the actual chain-derivation code

**Question:** can a store that passes every refusal rule reach the conflicting-arm case? **Prediction: yes.** No rule (R1 to R23) checks `IN_ARM` membership against the arm labels on program facts. A validated store can therefore hold membership that contradicts its edges. The chain-derivation code sees the conflict, and only its check stops a false precedence. If the prediction holds, it is also a validator finding, and it is reported for ruling, not fixed here.

Fixtures are in `r1b1-followup.json`. Each is one executable, and none is refused by the frozen rules:

| Fixture | Program facts | `IN_ARM` | Expected answers |
|---|---|---|---|
| CA0 (consistent, a non-vacuity control) | x→B, B→u\|then, B→v\|else, u→v, v→end | u in (B,then) | No refusal. x.return < u.invoke = {(B,then)}. x.return < v.invoke = {(B,else)} or {(B,then)}: two sets, as a disjunction |
| CA1 (membership contradicts the edge) | as CA0 | **u in (B,else)** | No refusal. x.return < u.invoke **not derived**: the then edge and u's else membership conflict. x.return < v.invoke = exactly {(B,else)}; the chain through u is rejected |
| CA2 (contradictory endpoints) | B→u\|then, u→v, B→v\|else, v→end | u in (B,then), v in (B,else) | No refusal. u.return < v.invoke **not derived** |

**Sabotage control:** the same chain-derivation function with only its conflicting-arm check removed. It must fail CA1 and CA2, by deriving the forbidden precedences or the extra condition sets, and still pass CA0.

**Where the code under test comes from:** the follow-up checker imports the chain-derivation function **byte-identical** to the one in the checker revision that produced the original results. Before it runs, it proves that by comparing the function's source text.

## 4. Run history and revisions

| Revision | sha256 | What it did |
|---|---|---|
| r0 | not recorded at the time; reconstructed in the follow-up | Compared refusal codes as lists. The first run reported 5 refusal misses per combination, including R18 twice. |
| r1 | `f6749afaae98945cbb3600f59a7ec7cd8c6f5b18740b775ca75362f7a058eae6` | Compared sets, as section 15.1 specifies. **Produced the final results** `r1b1-results.json` `0ba232f2...`. |
| r2 | recorded when written | Adds diagnostic roles and exports. Its chain derivation is unchanged from r1. Runs only this addendum's follow-up. |

**Frozen follow-up data:** `docs/r1b1-followup.json`, authored by a generator kept outside the repository.
