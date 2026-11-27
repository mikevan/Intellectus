# P3 Run 02 prompt amendment

**Status:** Draft for approval before inference.

## Question

Does making all three actions equally explicit reduce the tendency to choose repair on every case? Run 01 selected repair in all twelve cases, including four correct retention controls.

## Proposed change

Replace only the system prompt with the following text. Keep the twelve case packets and order, checkpoint and runtime, decoding budget, verifier, and pass thresholds from Run 01. Use fresh context per case.

> Review the seeded integer affine claim a + bx + cy. Use only the supplied observations and counterexample. Choose one action and return one JSON object, with no extra text.
>
> RETAIN if the supplied evidence is consistent with the seed and there is no counterexample. Return {"action":"retain"}.
>
> REPAIR if the seed is contradicted and a different integer affine formula fits all the supplied evidence. Return {"action":"repair","coefficients":[a,b,c]} with the replacement coefficients as JSON integers.
>
> WITHDRAW if the seed is contradicted and no integer affine formula fits all the supplied evidence. Return {"action":"withdraw","contradiction":{"point":[x,y],"predicted":p,"observed":o},"reason":"brief explanation"}. Use the actual disclosed point and values. Explain why the other observations and that point cannot all fit an affine formula.
>
> Before replying, check your action and any coefficients against every supplied point.

## Scoring

Compare the per-case action and independently verified outcome with Run 01. Apply the existing thresholds and review withdrawal explanations against the disclosed contradiction. Keep all twelve cases in the denominator. This deliberately reuses the same cases to isolate the prompt change. Any improvement is evidence about this paired comparison, and a fresh case set would be needed to test generalization. Record the prompt, fingerprints, raw outputs and findings as Run 02.
