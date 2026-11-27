# Python Hello World application-flow pilot

**Status:** Draft for approval. Existing-tool baseline checked. No Colibri trial has been run.

## Goal

Extract explicit control flows deterministically using the same parsed decision constructs that MBCC measures. Count the decisions evaluated on each flow, then send the established flow and its function and attribute evidence to Colibri one packet at a time. Ask for an explanation after the final packet.

## Fixture and existing-tool baseline

Use hello in the Python HelloWorlds greeting module. The current Complexity library reports function-level MBCC 1, Campbell 1, and cyclomatic complexity 2. The existing Understanding encoder identifies the conditional but stores the formatted return expression as source text. It does not fully resolve that value. The Python execution below supplies observed outputs independently.

| Input example | Explicit path | Decisions evaluated | Observed result |
| --- | --- | ---: | --- |
| hello("") | Empty input, assign World, return greeting | 1 | Hello, World! |
| hello("Jeff") | Nonempty input, keep the name, return greeting | 1 | Hello, Jeff! |
| hello() | Default argument World, nonempty branch, return greeting | 1 | Hello, World! |

The omission control demonstrates that the same returned greeting can result from different paths. Function-level MBCC and the number of evaluated decisions along a particular path are recorded as separate measurements. Keep the decision outcome and source location with each path, even when paths share an output.

## Deterministic stage

Emit the two feasible explicit paths with stable IDs, the predicate and its outcome, ordered operations, and decision count. Match the decision to the syntax MBCC scores. Confirm that the empty and nonempty paths each evaluate one decision. Record omitted-argument binding before branch evaluation. Keep source-derived expressions separate from observed runtime values. Verify both paths against independently executed Python examples before proceeding.

## Context stage

Send one numbered evidence packet per turn in a single conversation, retaining the full transcript and collecting only an acknowledgment until the final marker.

1. Send the verified flows and their decision counts.
2. Send the function name, parameter name and default, and names, values, or attributes actually present in the fixture. The initial fixture has no object attributes.
3. Send the observed input and output examples, then mark the evidence complete and request one explanation.

Do not ask Colibri to infer missing flow edges. A passing final explanation distinguishes an omitted argument from an explicitly empty string, accounts for nonempty names, and says the function returns a string. Count early explanations separately from final grounding errors. Record checkpoint identity, exact packets and replies, and request durations. Estimate live duration from the chosen packet budget after implementation.

After this pilot, hello_many is the next candidate for checking an explicit call between functions. Calls and attributes should enter the scope through a fixture that actually uses them.
