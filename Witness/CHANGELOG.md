# Changelog

## 1.0.19

Runner delivery and behaviour recording move here, so two tools reach a
project's runner through one piece of code.

UntangleIt needed to know whether a method still worked after it was
untangled, and doing that inside UntangleIt would have meant a second
instrumentation path beside DeepTest's, aimed at the same six runners, drifting
from it the first week. So Witness owns instrumentation delivery and behaviour
recording, DeepTest owns measurement, attribution, and evidence, and UntangleIt
owns the refactor workflow and reads the recordings.

The recorder writes down every call a watched method makes: the arguments, the
outcome, whether it returned, threw, resolved, or rejected, and in what order.
Six JavaScript and TypeScript runners reach it, in three shapes of delivery,
because that is what the runners allow. Vitest, Mocha, and Playwright's page
instrument as the runner loads or builds the file. Jest's transform contract is
synchronous and the instrumenter is not, so the file is rewritten ahead of the
run. Angular bundles before either runner is involved and offers no hook in
front of that, so the source is mirrored into a shadow tree and the builder is
pointed at the mirror. Playwright reaches only the code that runs in the page,
and a boundary outside the reachable path reports insufficient evidence rather
than a pass. Python runs the same gate through pytest with the same record
shape.

`diagnosis.ts` owns the structured problem packet and the brief built from it,
and `compatibility.ts` produces the packet for the path-character condition. A
project path containing an apostrophe kills Angular's builder and Playwright's
component build, because both write the absolute project path into generated
JavaScript inside a quoted string without escaping it. That is not ours: a
plain `npx playwright test` from such a path fails identically with none of the
toolkit involved. Our own generation was already clean, and a test now pins
that.

Four things cost time and are written down rather than tidied away. A Python
recording came back equivalent when it should have been changed, because
CPython validates a `.pyc` by size and mtime to the second, so a same-length
edit inside one second was invisible; the recorder now runs with bytecode
writing off. The boundary runtime and the main runtime both declared top-level
`fs` in the same page. Playwright records with a null test identity unless the
identity is stamped at drain, because it has no per-test page hook. And a
mutation survived in the boundary runtime and proved a thenable branch was
already dead.

## 1.0.17

Karma, and two defects in the rewrite that only a type-checking compiler could
have found.

`witness-karma.cjs` and `witness-karma-client.js` put the runtime in front of
the bundle and the test boundary on Jasmine, and hand each record back through
the Karma server. Nothing is mapped and no statement map crosses the wire: a
driver that instruments the source before the browser sees it gets records
that already name the person's own files and lines.

The handle is declared with a type now, not cast to `any`. `W.v` returns the
value it was given, so an `any` handle made every instrumented declarator
`any` too, and the erasure spread until a callback further down the chain had
no contextual type. Under `noImplicitAny` that is TS7006, and it stopped an
Angular build on a real project.

No counter wraps a condition any more. TypeScript cannot narrow a variable
through a function call, so `if (W.b(0, p))` left `p` possibly undefined in
the body and `typeof v === 'string'` wrapped the same way lost the union
refinement. No signature fixes that and no compiler option fixes it, because
the second failure is not a strictness error. The counters moved into the
arms instead: an `if` counts inside each arm, with a synthetic `else` when it
has none, a ternary counts inside each branch, and a boolean run or a default
value counts as the first operand of a comma expression. The condition is left
exactly as the person wrote it. That is also where istanbul-lib-instrument
puts its branch counters. `W.b` and `W.l` are gone; every way through a
decision reports through `W.c`.

The synthetic `else` has to be emitted as part of the consequent's own closing
edit. As an edit of its own it collided with an enclosing block that ends at
the same offset, and `if (a) { if (b) { x } }` came out as `}} else {}`.

A new test compiles the rewrite with `tsc --strict` and fails if any type is
erased or any narrowing is lost. Both defects reproduce against it.

The embedded maps carry `skipped` as well. A browser page is the only place a
decorated Angular component is measured, and it is the embedding path, so
leaving it out lost the skip reason exactly where it was needed.

## 1.0.16

Three hooks for Jest: the runtime, the test boundary, and a transformer that
wraps the project's own.

Jest's `process` is synchronous and this library's instrumenter is not, so
`witness-jest-transform.cjs` never instruments. It reads the source a driver
instrumented before the run, from the folder named by
`WITNESS_INSTRUMENTED_DIR`, substitutes it, and calls the project's
transformer with it. Its cache key is the upstream key over that text, salted
with the text itself, so a transformer that keys only on a file path cannot
serve a stale transform after the instrumenter's output has changed.

`witness-jest-runtime.cjs` loads the runtime from `setupFiles`, ahead of a
project's own, because an instrumented module calls the runtime in its
prologue and a project's setup file may import source.
`witness-jest.cjs` carries the test boundary and writes the whole-run counters
when each test file finishes, since Jest throws away the environment between
test files and anything left to process exit would be lost.

## 1.0.14

The runtime writes down a broken test boundary instead of papering over it.

`begin()` on a test that is still open used to overwrite it: the open test's
lines were lost and everything after was credited to whichever test came
last. A process ending with a test open wrote that test at exit as if it had
ended. Both produced a record that looked like any other. Now the open test
is closed and its record says `boundary: "overlapped"` or `"unterminated"`,
and a driver that sees the key refuses to score the run.

A file under the source root that the loader or the Vite plugin could not
instrument is noted beside the reports (`unmeasured-<worker>.json`) with the
reason, so a driver can show it as unmeasured rather than as measured and
never executed. What the instrumenter skipped rides on the file's report
entry under `skipped`. The Playwright fixture writes a record for a test
whose page never loaded the runtime, so an empty test is not a missing one.

The separator regression test builds both spellings of a path explicitly,
so it fails on Linux as well as Windows when the plugin stops normalising.

## 1.0.12

The README stops claiming more than the code does.

The README and the package description no longer say one instrument for every
JavaScript framework. That was three of eight at the time. They say what is
true and point at `docs/witness.md` for which runners are on which side.

This library also gained the `.gitattributes` that DeepTest and UntangleIt
already had, which stops a settings file flipping its line endings on every
release.

## 1.0.11

A comparison that could never match, and three ways a report could overwrite
itself.

The Vite plugin compared a `path.resolve` result against the module id Vite
passes to `transform`. Vite uses forward slashes on every platform and
`path.resolve` on Windows answers with backslashes, so nothing under the source
root ever matched, the plugin instrumented nothing, the run still passed, and
every file read as untested. Both sides are normalised now. The plugin's own
test never caught it because every id it built went through `path.join`, so the
id and the root shared the host separator and agreed with each other while
disagreeing with Vite. The test now feeds a posix-style id as well. The same
comparison serves Playwright component tests, so this fix applies to that path
too.

Reports are named by the test file. The first version numbered the per-worker
reports with a counter held in the hook, and Vitest gives each test file a
fresh module registry, so the counter reset every time and every file wrote
over the last one. The run passed eleven of eleven and reported zero hits for
every file but the last, which is worse than a crash. The counters are reset
after each write, so every report is a delta the driver can sum whether or not
the runner isolates.

A process id was not enough either. Records were named by process id alone, and
under a threads pool one process serves several workers with separate globals,
measured here as one process id and three distinct thread ids. The records
interleaved into one file and the reports overwrote each other. The name now
carries Node's `threadId` beside the pid, which costs this library no knowledge
of any runner.

`witnessUniverse` serves the Vitest branch the same way it already served Mocha
and Playwright. Vite only transforms what something imports, so a source file
no test reaches is never seen by the plugin and drops out of the report rather
than showing as untested. That is the falsely clean report, the worst failure
this product has.

## 1.0.9

Witness leaves DeepTest and becomes its own library, `@projectrevivesolutions/witness`, at the toolkit version. The instrumenter, the runtime, the Node loader, the Vite plugin, the Playwright worker hook and fixture, the Mocha boundary, the esbuild bundle, the grammars, and the tests move here unchanged in what they measure; the hooks now read `WITNESS_*` environment names instead of `DEEPTEST_*`, so any tool can drive them. DeepTest bundles it; UntangleIt declares it for its behaviour gate.
