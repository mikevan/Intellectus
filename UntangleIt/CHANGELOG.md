# Changelog

## 1.0.19

It could tell you a method got simpler. It could not tell you the method still
worked.

Before the brief goes to the assistant, the project's own tests run once more
with a Witness recorder watching the one method the person selected, and every
call it makes is written down. At "Measure again" the same recording runs
against whatever came back. The two sets are compared and the answer is one of
three words. Equivalent, changed, or insufficient.

The third word is the point. A gate that only ever says yes or no will say yes
when it has nothing to go on, and a confident wrong yes is worse than no gate.
So it refuses, by name. The method was never exercised by the suite. The
recorder could not find the target after the assistant moved it. The target is
a shape we cannot watch. The runs cannot be paired. The arguments differ, so
the comparison would be meaningless. There is nothing comparable. Six reasons,
each one a thing the person can act on, and not one of them is a pass.

The recording itself lives in Witness, not here. Doing it here would have meant
a second instrumentation path beside DeepTest's, aimed at the same six runners,
drifting from it the first week. This tool owns the refactor workflow and reads
the recordings.

A changed-return proof case reported unstable pairing until it turned out the
fixture's own assertion was truncating the suite, so the fixture was rewritten
and the truncation kept as its own test.

## 1.0.18

`untangleit.api.measure` is published, and it is the only silent command this
tool has.

The toolkit's published API described `untangleit.api.plan`, which was never
registered, and an integration where this tool asked DeepTest for numbers
before and after every untangling, which this tool's own header says it does
not do. The contract was cut down to the product rather than the product built
up to the contract. Everything removed moved to a section named "Proposed, not
built", whose first line says that nothing below it is a promise.

This tool declares the `prsToolkit` discovery block, and `prsToolkit.commands`
now means silent commands and nothing else.

## 1.0.17

Packaging stops carrying another tool's working files.

`.deeptest` artifacts are excluded from UntangleIt packages, and the retired
`.refactorit` state and some stale package exclusions are gone.

## 1.0.13

A split that only moves the tangle around no longer passes quietly.

After "Measure again", the comparison now carries the total as well as the
pieces: what the pieces come to together in tangle, against what the method
and any piece the untangling disturbed were carrying before. The card says
both. When the total holds or rises while every piece fits, it says the tangle
moved rather than went away, in those words, and the person still decides.

This closes a hole the scorer cannot close. A boolean run that holds a call is
charged per operand, so moving it into a helper costs the caller one call
instead of its operands and the caller's number falls with the reader's work
untouched. An assistant told to get a method under a limit will find that
move. The scorer measures one method at a time and cannot see it; the loop
holds both versions and can. The header comment in src/engine/tangle.ts said
the only extraction that lowers tangle is one that removes nesting. That was
not true, and it now says what is.

## 1.0.12

The side panel footer carries the series name.

`PRODUCT_FULL` is new in `src/ui/words.ts` and the panel footer uses it, while
`PRODUCT` stays short.

## 1.0.11

The side panel header stopped printing the product twice.

The container's title comes from `package.json` and the build stamps it, which
is right. The view also set its own title in `resolveWebviewView`, and VS Code
renders the container's title and the view's joined by a colon rather than
hiding the view's, so every build printed the product twice. The run-time
assignment is gone and the build is now the only place either title is set. The
note in `esbuild.mjs` claiming the view's title is hidden and that neither
title can change at run time was wrong on both counts and has been corrected,
because that note is what would put the line back.

## 1.0.10

The 1.x series is named Polyglot, and UntangleIt carries it. The side panel
header and the Marketplace title read `UntangleIt - Polyglot`, with the version
still appended to the header as before. Nothing else changes.

## 1.0.9

Declares `@projectrevivesolutions/witness`, the toolkit's instrumentation library, for the behaviour gate that comes next. Nothing in UntangleIt uses it yet.

## 1.0.0

The core is done. UntangleIt ranks, judges, and briefs by tangle (MBCC), with a default limit of 15; the brief says what lowers tangle and what does not, so a flat switch is never split into a method per case. Run records say which number they hold. Python and TypeScript / JavaScript. Next: Java (1.1), C# (1.2), C++ (1.3); see docs/toolkit/toolkit-roadmap.md.

