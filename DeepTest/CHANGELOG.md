# Changelog

## 1.0.19

What a person sees when a run dies before a single test executes.

Before this, a project path containing an apostrophe produced a verdict of no
evidence and a wall of runner output, which reads exactly like their code did
something wrong. It did not: Angular's builder and Playwright's component build
each write the absolute project path into generated JavaScript inside a quoted
string without escaping it, the quote ends the string early, and the generated
file does not parse. A plain `npx playwright test` from such a path fails
identically with none of the toolkit involved.

What a person gets now is one line and an offer. Behind the line, the toolkit
writes down what it established from deterministic evidence: the runner, the
category, the exact character found in the path, the verbatim error lines, what
it knows, what it does not know, the remediation it is confident in, and the
constraints on what must never be recommended. Copilot turns that into plain
language, and is told not to diagnose anything from scratch when the diagnosis
already exists. When the toolkit cannot classify a failure it says so in the
packet, ships no remediation, and the brief tells Copilot to explain the
evidence and name no cause it does not support.

The constraints are the part worth guarding. Do not recommend Windows-specific
path handling, because hard-coded drive letters and backslash rules make the
project fail on Linux. Do not modify application logic, tests, or
configuration, because nothing in the project caused this. Do not propose
patching Angular, Playwright, or Vite. If the project already contains code
that quotes or normalises paths, leave it alone. And the path condition offers
explanation only, never a fix, because the remedy is moving a folder and an
assistant offered a fix button would write the very path-juggling the
constraints forbid.

The first four attempts at this were hand-written paragraphs, rewritten four
times, with a test pinning every sentence. That is an encyclopedia of prose
living inside a measurement tool, out of date the week it ships. The toolkit
now writes facts and boundaries and lets the assistant write the sentences.

Raw runner output has not gone anywhere. It stays in the log, one press away,
with the matched evidence and the generated-file paths. The change is that it
is no longer the first thing a non-expert reads.

Also in this delivery: the `.gitignore` rules for the gate's working folders
carried a slash, so git anchored them to the repository root and they never
reached the fixtures. They are anchored properly now, and the rule that keeps
`.untangleit/runs.json` in the repository still works. The six fixture
manifests and lockfiles that had drifted apart are reconciled, so a fresh
checkout can run `npm ci` and reproduce the qualification, and the Angular
Karma fixture's lockfile was structurally invalid and refused `npm ci`, which
is why it is regenerated here.

## 1.0.18

The published toolkit API now describes the product that exists, and a test
fails when it stops describing it.

`toolkit-api.md` published five silent commands, an event surface, a public
record file, and an integration between DeepTest and UntangleIt. None of them
existed in either tool. `deeptest.api.status`, `deeptest.api.check`,
`deeptest.api.function`, and `deeptest.api.decisions` were never registered;
neither was `untangleit.api.plan`; nothing wrote `.deeptest/last-check.json`;
neither tool exposed `onDidCheck` or `onDidDecide`; and UntangleIt's own
source says in its header that it does not call DeepTest. All of that is now
in section 10, "Proposed, not built", which says in its first line that
nothing below it is a promise.

What the contract says today is what the code does. One silent command,
`untangleit.api.measure`. Five interactive commands, all registered. The
DeepTest to UntangleIt hand-off through `prs.untangleit`. One KeepSafe
command, `keepsafe.quickCheckpoint`, with KeepSafe's own published surface
kept as a record of someone else's contract rather than as a claim about
ours. Two public record files, `.deeptest/decisions.json` and
`.untangleit/runs.json`. The exports `activate` actually returns:
`{ state, run, report }` from DeepTest and `{ state, run }` from UntangleIt.

DeepTest gains the `prsToolkit` discovery block it had never had, which is the
mechanism the whole document rests on. `prsToolkit.commands` now means silent
commands and nothing else, so DeepTest's array is empty. An empty array is a
fact about the tool, not a gap in the block.

The test is the part that lasts. It reads the section headings and the tables
under them, never backticks in prose, and it checks four things: every
published command is registered by the tool that publishes it, each tool's
`prsToolkit.commands` is exactly the silent commands published for it and
every one is registered, both tools declare a complete block, and every public
record path is demonstrably written by its owner. It stops reading at section
10. A second test runs the same four rules against trees built to break each
one, because rules that cannot fail prove nothing.

No API was added. The document came down to the code.

## 1.0.17

Angular measures through Witness, under both runners, and Istanbul is gone
from the product.

The builder bundles the application before either Vitest or Karma runs, and
no schema in it exposes a hook in front of that. So the source is instrumented
before the builder reads it. The source root is mirrored into
`.deeptest/instrumented`: source files instrumented, and everything else,
specs, templates, stylesheets, and assets, copied through so the relative
references a component makes still resolve. The builder is pointed at the
mirror with `--include` and a generated tsconfig that extends the project's
own and repoints any path alias whose target is inside the source root. An
alias left pointing at the real source would quietly pull in the
uninstrumented file, and every line in it would read as never executed.

The counters are in the bundle before the builder touches it, and they carry
the original path and the original line, so nothing is mapped back out of a
chunk afterwards. That mapping layer, and the coverage provider it needed, are
deleted. Karma ignores `--setup-files`, so its runtime and test boundary go in
through a generated Karma config that wraps the project's own and adds a
Witness framework and reporter.

Out with them: `@vitest/coverage-istanbul` and `karma-coverage` as
requirements, the chunk-to-source mapper, the unloaded-file universe that
needed the project's `istanbul-lib-instrument`, and all five hooks DeepTest
used to ship. DeepTest now ships no hooks of its own. Every hook comes from
the Witness package, and no runner asks a project to install anything for
coverage.

Packaging caught up in the same pass. `.refactorit` was still tracked, eleven
days after the tool was renamed to UntangleIt, and is removed; DeepTest
ignores `.refactorit/**` in both the repository and the package, UntangleIt
excludes `.deeptest/**` from its package, and DeepTest's package no longer
excludes a `hooks/**` folder it does not have.

The include pattern is written relative to Angular's own project source root
and never as an absolute path. The Karma compatibility layer strips a leading
slash from every pattern before globbing it, which turns an absolute pattern
into a relative one that matches nothing, and the run then reports zero tests
and passes.

Measured on the angular-vitest and angular-karma ports, at Node v22.23.2:
eleven tests, eleven records, eleven carrying a file, three files with a line
that ran, none cut off, test ids naming the spec the person wrote. The two
runners agree file for file on every count, including the two lines in the
component that Angular requires to appear exactly as written and that the
report names rather than hides. The figures describe the source now, not the
builder's compiled output, so they differ from the 1.0.15 baseline by design.

## 1.0.16

Jest measures through Witness, so nothing in a Jest project installs a
coverage package either.

Jest's transform contract is synchronous and the instrumenter is not, because
tree-sitter initialises its WASM asynchronously. So the instrumenting happens
before Jest starts: the walk that already produced the executable-line
universe now produces the instrumented source in the same parse, and the
transformer is a synchronous lookup that substitutes it and hands it to the
project's own transformer. The project's transform table is read from
`jest --showConfig` and wrapped pattern by pattern, so a project that
transforms other file types keeps doing exactly that, with its own options.

The instrumenting goes in front of the project's transformer rather than
behind it. Witness rewrites source textually on the source's own lines, so
letting Babel compile around the counters keeps the numbers in the
coordinates the editor uses. Instrumenting Babel's output would have put them
in compiled coordinates and needed a source map to get back, which is the
problem the Angular path spent 1.0.15 escaping.

Measured on the react-jest port: eleven tests, eleven records, per-test
attribution on the component, the helpers, and nothing on the untested
villain. Those numbers are identical, file for file, to what the same program
reports under Vitest, which is the first time two runners with different
transform pipelines have been shown to agree.

## 1.0.15

DeepTest checks that a tool will run before it drives it, and Angular with
Vitest measures source again.

Every npm package may declare which Node versions it supports, and nothing
read that. The setup screen said the environment was ok and the Angular CLI
then refused to start, because the CLI needs Node `^22.22.3 || ^24.15.0 ||
>=26.0.0` and the machine had 22.22.0. DeepTest now reads what each tool it
starts declares and refuses first, naming the package, what it needs, and
what is installed. A range it cannot parse lets the run proceed, because
refusing a project over a misread range is the same wrong answer pointed the
other way.

Angular with Vitest measured nothing at all from 1.0.12 until now, and said
so with a straight face. That delivery moved the path onto the Witness Vite
plugin, but the Angular builder bundles the application before Vitest is
involved, so the only files the plugin ever saw were built chunks outside the
source root, and it correctly declined every one. Eleven tests passed, every
coverage report was `{}`, every attribution record was empty, and the card
called a fully tested project 81 untested lines. The path is back to what
1.0.4 built, which measures through the builder's own instrumentation and
maps the chunks back to sources, and it reproduces 1.0.4's recorded figures
exactly: 21 attributed lines, 25.61% coverage on the Angular port.

That defect passed 1.0.14's evidence check, so the check was incomplete. It
counted records and never asked whether a record contained anything. A run is
now refused when it measured nothing at all, meaning no record carried a file
and no file had a line that ran. One empty record is ordinary and is still
allowed; a suite where every record is empty is not a verdict, it is a
measurement failure.

## 1.0.14

A card is never drawn from evidence with a hole in it.

The runner's own test count is now held against the attribution records the
hooks wrote. A finished test that left no record, or a record whose test
boundary was cut off, and the panel shows "The check did not finish." with
the reason and the three controls, where 1.0.13 drew a card. The Windows
separator bug shipped four versions of a card with empty per-test
attribution, and nothing in the pipeline could have said so.

A file the instrumenter could not take is shown as unmeasured, out of every
number, with the reason, and the verdict is not ready while one exists;
before, it read as measured and never executed. Decisions the instrumenter
could not count are listed per file in the full report. `scripts\survey.cjs`
prints the same evidence line the panel checks.

## 1.0.13

The headless survey driver is checked in.

`scripts/survey.cjs` prints what the DeepTest panel would show, without an
editor. It had been in use for two deliveries without being checked in.

## 1.0.12

Angular under Vitest is measured by Witness, on the same plugin the Vitest
runner uses.

The generated runner config carries the Witness plugin and nothing else, and
the builder's own coverage provider is no longer part of the run. 1.0.4 drove
Angular through the builder and had to map bundle chunks back to source files
through their input source maps, because the builder instruments after it
bundles. Witness instruments at transform time, on the source, before any
bundling, so the counters are keyed by source file from the start. The
chunk-to-source mapping is no longer on this path.

The `--coverage`, `--coverage-reporters`, `--coverage-include`, and
`--coverage-exclude` flags are gone, and so is the coverage block in the
generated runner config. The executable universe of files the builder never
transformed now comes from `witnessUniverse`, the same call Mocha, Playwright,
and Vitest use. The environment check no longer demands a pinned
`@vitest/coverage-istanbul` for Angular. Karma still requires its five
packages, because that runner has not moved yet.

The runner config is its own function now. Neither Angular driver has an
end-to-end test, because running one would mean carrying the whole Angular
toolchain in this tool's devDependencies. `angularRunnerConfig` is pure and
tested, so a later refactor cannot quietly drop the plugin or put the coverage
provider back, which is how this path would go falsely clean with nothing
failing. That test proves what is generated, not that the builder accepts it.

One risk is recorded in the code rather than in anyone's head. The hook still
goes in through the CLI's `--setup-files`, which is the seam the builder
documents, so the builder decides its order against a project's own setup file.
The Vitest path controls that order directly and this one cannot. An Angular
project with its own setup file under the source root would fail on
"reading 'file' of undefined", and the comment above the flag says so.

The side panel footer carries the series name through a new `PRODUCT_FULL`,
while `PRODUCT` stays short so the status bar still reads "DeepTest: checking".
This tool has Marketplace keywords for the first time.

## 1.0.11

Vitest is measured by Witness. A Vitest project now needs nothing installed
beyond Vitest itself.

The generated wrapper config adds the Witness Vite plugin, points `setupFiles`
at `hooks/witness-vitest.mjs`, and drops the entire coverage block: no
provider, no reports directory, and no include or exclude globs, because
Witness's own patterns already decide what gets instrumented. The run carries
`WITNESS_WASM_DIR`, `WITNESS_SOURCE_ROOT`, and `WITNESS_COVERAGE_DIR` beside
the two the shared setup already set. The environment check no longer demands a
pinned `@vitest/coverage-istanbul` for plain Vitest, and the "Install Vitest"
button no longer installs it. Angular's builder still runs on istanbul, so
`checkAngularEnvironment` keeps its requirement until that runner moves.

`setupFiles` is replaced rather than merged. `mergeConfig` concatenates arrays,
which leaves the project's own setup file first. A project's setup file usually
sits under the source root, so it is instrumented, and an instrumented module
calls the runtime in its prologue. Merged in second, the Witness hook loaded
too late and every test file died on "reading 'file' of undefined". The fixture
found that, not a code review.

The executable universe is in this delivery and not a later one. Vite only
transforms what something imports, so a source file no test reaches is never
seen by the plugin and drops out of the report rather than showing as untested.
That is the falsely clean report, the worst failure this product has.

The side panel header said the name and the build number twice. It read
"DeepTest - Polyglot 1.0.10: DeepTest 1.0.10", because two places were naming
the same panel. The run-time assignment is gone and the build is now the only
place either title is set.

## 1.0.10

The 1.x series is named Polyglot, and DeepTest carries it. The side panel header
and the Marketplace title read `DeepTest - Polyglot`, with the version still
appended to the header as before. The name is stamped by the build, because VS
Code will not let a panel header change at run time. Nothing else changes.

## 1.0.9

Witness moves out of DeepTest into its own library, `@projectrevivesolutions/witness`, and DeepTest bundles it the way it bundles the complexity library. Nothing measured changes: Mocha and Playwright component tests report the same lines, decisions, and functions per test as 1.0.8. The Witness hooks now read `WITNESS_*` environment names, which DeepTest sets beside its own.

## 1.0.0

The core is done. DeepTest measures and judges by ways through, refuses to score a run in which no test ran, names the Python it installs coverage into, and carries tangle (Campbell and MBCC) beside every function as a sanity check that points at UntangleIt. Python and TypeScript / JavaScript. Next: Java (1.1), C# (1.2), C++ (1.3); see docs/toolkit/toolkit-roadmap.md.

