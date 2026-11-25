/**
 * Where a new test for a measured gap should be proposed, derived from this
 * project's own measured attribution.
 *
 * **DeepTest's question, not Witness's.** Witness owns `isTestPath` because
 * C1 needs one governance answer to "is this changed path an existing test",
 * and both products' governed interactions ask it. This is a different
 * question: given a measured gap in this project, where should a new test for
 * it be proposed? Only DeepTest asks it, it is a product decision about how
 * DeepTest proposes work, and the fact that its answer must satisfy
 * `isTestPath` is a constraint on the answer rather than a reason to move the
 * question. The invariant is asserted inside this function and again across
 * every naming fixture in the tests.
 *
 * **It observes; it does not assume.** An earlier design took the target
 * path, the runner, and a flat list of test file paths. A list of pathnames
 * does not say which source any of them tests, and recovering it by matching
 * basenames would be inventing a relationship and then measuring the thing we
 * invented. `src/pricing.ts` and `test/checkout.spec.ts` may well be the real
 * pair.
 *
 * The relationship is already measured, by running the project's own tests.
 * `LineResult.tests` holds distinct test identifiers per line, each one's
 * leading component the workspace-relative test file path, parsed from the
 * attribution records Witness's hooks write. That is the evidence this file
 * is built on.
 *
 * **One observed tuple, not four elections.** Placement, filename transform,
 * suffix and extension are decided together, as one whole convention that a
 * strict majority of attributed pairs agree on. Deciding them separately can
 * construct a combination the project never uses: a project mixing
 * co-located `.spec.tsx` with co-located `.test.ts` has placement unanimous
 * and the other two split, and independent majorities would return
 * `(co-located, .spec, .ts)`, which appears in neither half. Extension shows
 * the same hazard alone: `Greeting.tsx` tests as `Greeting.test.tsx` and
 * `Greeting.vue` tests as `Greeting.test.ts`, so neither "matches the source"
 * nor "is always .ts" is a rule. **Both policies are real, so the policy
 * itself is what is observed**, per pair: a test whose extension equals its
 * source's exhibits `matches-source`, and one whose extension differs
 * exhibits that literal extension. A project using only `.ts` exhibits
 * `matches-source` and derives `.ts`, which is the same answer either way.
 *
 * **It fails closed.** No attribution, no majority tuple, no observable
 * transform, a derived path that already exists, or a derived path
 * `isTestPath` rejects: each is a refusal and none is a fallback. A refusal
 * is knowable before the model, so it lands at rule 94's prerequisite gate:
 * zero model calls, no authorization question, no capability. C3 is never
 * broadened to the test directory to avoid the problem.
 *
 * **`runner` is not an input.** An earlier design refused when the runner was
 * `playwright-ct` and "the source is not a component". No deterministic
 * predicate for that exists: a React component in a `.tsx` is
 * indistinguishable by path from any other `.tsx`, and "is a component" is a
 * semantic judgement. The observed tuple answers the question without it. If
 * a component-test file executes this source, that pair is the evidence; a
 * plain source with no attributed pairs has no majority tuple and refuses,
 * which is the right answer arrived at without anybody deciding what a
 * component is.
 *
 * Deterministic, and the reason rather than the habit (rule 88). This decides
 * where a person's file is proposed. An agent deciding it would be choosing
 * its own destination.
 */
import * as path from 'node:path';
import { isTestPath } from '@projectrevivesolutions/witness';

/** Where a test sits relative to the source it exercises. */
export type Placement = 'co-located' | 'tests-dir-beside' | 'mirrored-tree';

/**
 * How a test's basename is built from its source's stem.
 *
 * A closed set, measured over the corpus, which found exactly two and nothing
 * else. A pair matching neither contributes to **no** tuple rather than being
 * forced into one, so a project whose tests are named for features rather
 * than for files simply has no observable transform, and that is a refusal.
 */
export type Transform = 'stem-preserving' | 'stem-prefixed';

/**
 * What extension the project's tests carry.
 *
 * Observed as a policy rather than as a value, because both policies are real
 * in the corpus and a value cannot tell them apart. `matches-source` when the
 * test's extension equals its source's; the literal extension otherwise.
 */
export type ExtensionPolicy = { readonly kind: 'matches-source' } | { readonly kind: 'literal'; readonly extension: string };

export interface TestNamingConvention {
  readonly placement: Placement;
  readonly transform: Transform;
  /** Empty for the Python shape, where the prefix carries it. */
  readonly suffix: '.test' | '.spec' | '';
  readonly extension: ExtensionPolicy;
  /** For the mirrored case, the observed test root. */
  readonly testRoot?: string;
}

/** One measured source-to-test pair. Both paths are workspace-relative, POSIX. */
export interface AttributedPair {
  readonly source: string;
  readonly test: string;
}

export type TestPathResult =
  | { readonly ok: true; readonly path: string; readonly convention: TestNamingConvention }
  | { readonly ok: false; readonly why: string };

const PYTHON_PREFIX = 'test_';

/**
 * The derived path for a new test exercising `source`, or the reason there is
 * none.
 *
 * `pairsForSource` are the attributed pairs for this source file, which are
 * preferred; `pairsInProject` are every attributed pair measured anywhere in
 * the project, used when the source itself has none. Both require a strict
 * majority of complete tuples.
 *
 * `exists` answers whether a workspace-relative path is already a file. It is
 * a parameter rather than a filesystem call so this stays pure and testable,
 * and so the caller decides what "the project" means.
 */
export function proposedTestPath(input: {
  readonly source: string;
  readonly pairsForSource: readonly AttributedPair[];
  readonly pairsInProject: readonly AttributedPair[];
  readonly exists: (relativePath: string) => boolean;
}): TestPathResult {
  const { source, pairsForSource, pairsInProject, exists } = input;

  if (pairsForSource.length === 0 && pairsInProject.length === 0) {
    return {
      ok: false,
      why: 'Nothing in this project has been measured as testing anything yet, so Polyglot has not observed where this project puts its tests or what it calls them. Run the tests once and it will have.',
    };
  }

  // Evidence order, narrowest first, and a strict majority of complete
  // tuples is required at whichever tier answers.
  //
  // The middle tier is the one worth explaining. A project can treat two
  // source extensions differently and both treatments be real: in the corpus,
  // `Greeting.svelte` tests as `Greeting.test.ts` while `greet.ts` beside it
  // tests as `greet.test.ts`. Counting those together makes the plain `.ts`
  // pairs outvote the `.svelte` one, and a new `.svelte` source would be
  // told its test is `Foo.test.svelte`, which the project has never written.
  // So a source is shown what this project does with sources like it before
  // it is shown what the project does generally. That is still observation;
  // it is observation over the comparable pairs.
  const sourceExtension = path.posix.extname(posix(source));
  const sameExtension = pairsInProject.filter((pair) => path.posix.extname(posix(pair.source)) === sourceExtension);
  const decided = majorityTuple(pairsForSource) ?? majorityTuple(sameExtension) ?? majorityTuple(pairsInProject);
  if (decided === undefined) {
    return {
      ok: false,
      why: 'This project\'s test files do not follow one convention that a majority of them agree on, so Polyglot cannot say where a new one belongs without inventing an answer. Name the file yourself and it will check the rest.',
    };
  }

  const derived = applyConvention(source, decided);
  if (derived === undefined) {
    return {
      ok: false,
      why: 'Polyglot observed how this project names its test files and could not apply that naming to this source file.',
    };
  }

  if (exists(derived)) {
    return {
      ok: false,
      why: `This project's convention puts a test for ${source} at ${derived}, and that file already exists. Polyglot proposes new test files and does not rewrite one that is already there.`,
    };
  }

  // The F.1 invariant, enforced rather than assumed. A derived path Witness's
  // own predicate would not call a test is a path C1 would not protect.
  if (!isTestPath(derived)) {
    return {
      ok: false,
      why: `Polyglot derived ${derived} and the toolkit does not recognize that as a test file, so proposing it would create a file nothing would govern as a test.`,
    };
  }

  return { ok: true, path: derived, convention: decided };
}

// ---------------------------------------------------------------------------
// Observation
// ---------------------------------------------------------------------------

/**
 * The one complete tuple a strict majority of pairs agree on, or nothing.
 *
 * Whole tuples are counted. No element is decided on its own and no tuple is
 * assembled from popular pieces, which is the entire reason this is one
 * function rather than four.
 */
export function majorityTuple(pairs: readonly AttributedPair[]): TestNamingConvention | undefined {
  const tuples = pairs.map(conventionOf).filter((t): t is TestNamingConvention => t !== undefined);
  if (tuples.length === 0) {
    return undefined;
  }
  const counts = new Map<string, { tuple: TestNamingConvention; n: number }>();
  for (const tuple of tuples) {
    const key = JSON.stringify(tuple);
    const held = counts.get(key);
    if (held) {
      held.n += 1;
    } else {
      counts.set(key, { tuple, n: 1 });
    }
  }
  // Strict majority of the **pairs**, not of the tuples that parsed. A
  // project where half the pairs exhibit no transform at all has not shown a
  // convention a majority of it follows.
  for (const { tuple, n } of counts.values()) {
    if (n * 2 > pairs.length) {
      return tuple;
    }
  }
  return undefined;
}

/** The complete tuple one attributed pair exhibits, or nothing. */
export function conventionOf(pair: AttributedPair): TestNamingConvention | undefined {
  const source = posix(pair.source);
  const test = posix(pair.test);
  const sourceDir = dirOf(source);
  const testDir = dirOf(test);
  const sourceStem = stemOf(source);
  const testBase = path.posix.basename(test);

  const named = transformOf(sourceStem, testBase);
  if (named === undefined) {
    return undefined;
  }
  const { transform, suffix } = named;
  const sourceExtension = path.posix.extname(source);
  const extension: ExtensionPolicy =
    named.extension === sourceExtension ? { kind: 'matches-source' } : { kind: 'literal', extension: named.extension };

  if (testDir === sourceDir) {
    return { placement: 'co-located', transform, suffix, extension };
  }
  if (testDir === join(sourceDir, '__tests__') || testDir === join(sourceDir, 'tests') || testDir === join(sourceDir, 'test')) {
    return { placement: 'tests-dir-beside', transform, suffix, extension, testRoot: path.posix.basename(testDir) };
  }
  const mirrored = mirroredRoot(sourceDir, testDir);
  if (mirrored !== undefined) {
    return { placement: 'mirrored-tree', transform, suffix, extension, testRoot: mirrored };
  }
  return undefined;
}

/**
 * Which transform of `stem` produces `basename`, with the suffix and
 * extension it used.
 *
 * The suffix is read off the observed basename rather than guessed, and the
 * extension likewise: `Greeting.vue` tests as `Greeting.test.ts`, so an
 * extension taken from the source would be wrong here and right next door.
 */
function transformOf(stem: string, basename: string): { transform: Transform; suffix: '.test' | '.spec' | ''; extension: string } | undefined {
  const extension = path.posix.extname(basename);
  if (extension === '') {
    return undefined;
  }
  const withoutExtension = basename.slice(0, -extension.length);

  for (const suffix of ['.test', '.spec'] as const) {
    if (withoutExtension === `${stem}${suffix}`) {
      return { transform: 'stem-preserving', suffix, extension };
    }
  }
  if (withoutExtension === `${PYTHON_PREFIX}${stem}`) {
    return { transform: 'stem-prefixed', suffix: '', extension };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

/** The path this convention gives for this source, or nothing. */
export function applyConvention(source: string, convention: TestNamingConvention): string | undefined {
  const normalized = posix(source);
  const sourceDir = dirOf(normalized);
  const stem = stemOf(normalized);
  const extension = convention.extension.kind === 'matches-source' ? path.posix.extname(normalized) : convention.extension.extension;
  if (extension === '') {
    return undefined;
  }
  const basename = convention.transform === 'stem-prefixed' ? `${PYTHON_PREFIX}${stem}${extension}` : `${stem}${convention.suffix}${extension}`;

  if (convention.placement === 'co-located') {
    return join(sourceDir, basename);
  }
  if (convention.placement === 'tests-dir-beside') {
    return join(join(sourceDir, convention.testRoot ?? '__tests__'), basename);
  }
  // Mirrored: the source's first segment is replaced by the observed test
  // root and the rest of the path is kept, which is what "mirrored" means.
  const segments = sourceDir === '' ? [] : sourceDir.split('/');
  if (convention.testRoot === undefined || segments.length === 0) {
    return undefined;
  }
  return join(join(convention.testRoot, segments.slice(1).join('/')), basename);
}

/**
 * The test root, when the test tree mirrors the source tree under a different
 * first segment. `src/a/b` against `test/a/b` gives `test`.
 */
function mirroredRoot(sourceDir: string, testDir: string): string | undefined {
  const source = sourceDir === '' ? [] : sourceDir.split('/');
  const test = testDir === '' ? [] : testDir.split('/');
  if (test.length === 0 || source.length === 0 || test.length !== source.length) {
    return undefined;
  }
  for (let i = 1; i < source.length; i += 1) {
    if (source[i] !== test[i]) {
      return undefined;
    }
  }
  return test[0] === source[0] ? undefined : test[0];
}

// ---------------------------------------------------------------------------

function posix(p: string): string {
  return p.split('\\').join('/');
}

function dirOf(p: string): string {
  const dir = path.posix.dirname(p);
  return dir === '.' ? '' : dir;
}

function stemOf(p: string): string {
  const base = path.posix.basename(p);
  const extension = path.posix.extname(base);
  return extension === '' ? base : base.slice(0, -extension.length);
}

function join(a: string, b: string): string {
  if (a === '') {
    return b;
  }
  if (b === '') {
    return a;
  }
  return `${a}/${b}`;
}

// ---------------------------------------------------------------------------
// The destination, resolved from attribution (Part T.1)
// ---------------------------------------------------------------------------

/**
 * The test file a test identifier names.
 *
 * One identifier is `<test file path>::<full test name>`, composed by the
 * runner hooks. The distinct test **files** for a target are therefore
 * recoverable exactly, by taking the leading component. No inference.
 */
export function testFileOf(identifier: string): string {
  const cut = identifier.indexOf('::');
  return posix(cut === -1 ? identifier : identifier.slice(0, cut));
}

/** The distinct test files attributed to a set of measured targets. */
export function attributedTestFiles(testsPerTarget: readonly (readonly string[])[]): string[] {
  const files = new Set<string>();
  for (const tests of testsPerTarget) {
    for (const identifier of tests) {
      files.add(testFileOf(identifier));
    }
  }
  return [...files].sort();
}

export type Destination =
  /** Branch A: exactly one attributed test file. An additive edit, governed by C1. */
  | { readonly kind: 'modify'; readonly path: string }
  /** Branch B: no test file is attributed to the target. A new file. */
  | { readonly kind: 'create'; readonly path: string; readonly convention: TestNamingConvention }
  | { readonly kind: 'refuse'; readonly why: string };

/**
 * Where a proposal for these targets belongs, decided before the packet
 * exists and therefore before any model is reached.
 *
 * **Attribution is read at the width of the target, not of the source file.**
 * A source file's other lines may be exercised by suites that have nothing to
 * do with this proposal, and a source-wide question would let them choose the
 * destination. `coverage.propose-test` passes the one target line's tests;
 * `function.propose-tests` passes one entry per gap line that justifies the
 * proposal, and the union over all of them must be exactly one file.
 *
 * **Several distinct files refuse.** Attribution establishes *that* a test
 * file exercises a source. It does not establish *which* of several a new
 * test belongs in, and that is a question about intent rather than about
 * evidence. Every candidate tiebreak is a heuristic wearing a measurement:
 * the file covering the most lines, the file whose name resembles the source,
 * the shortest path, the first alphabetically. Each would pick a file often
 * enough to look right and would sometimes put a unit test into an
 * integration suite, authorized by a brief that told the person Polyglot knew
 * where it belonged. Asking the person which file is the obvious future, and
 * it is a UI affordance rather than a governance mechanism, so it is recorded
 * and not built here.
 *
 * It is not enough for each target to resolve to one file individually: three
 * gap lines resolving to three suites is three destinations, and picking one
 * would silently attach tests for the other two gaps to a file that does not
 * exercise them. **The union is what is counted.**
 */
export function resolveDestination(input: {
  readonly source: string;
  /** One entry per measured target: that target's attributed test identifiers. */
  readonly testsPerTarget: readonly (readonly string[])[];
  readonly pairsForSource: readonly AttributedPair[];
  readonly pairsInProject: readonly AttributedPair[];
  readonly exists: (relativePath: string) => boolean;
}): Destination {
  const files = attributedTestFiles(input.testsPerTarget);

  if (files.length === 1) {
    return { kind: 'modify', path: files[0] };
  }
  if (files.length > 1) {
    const many = files.join(', ');
    return {
      kind: 'refuse',
      why: `This code is exercised by ${files.length} test files (${many}), and Polyglot cannot tell which one a new test belongs in. That is a question about what you intended, not something the measurement answers. Pick the file and Polyglot will check the rest.`,
    };
  }

  const derived = proposedTestPath({
    source: input.source,
    pairsForSource: input.pairsForSource,
    pairsInProject: input.pairsInProject,
    exists: input.exists,
  });
  return derived.ok ? { kind: 'create', path: derived.path, convention: derived.convention } : { kind: 'refuse', why: derived.why };
}

/**
 * Every measured source-to-test pair in a result.
 *
 * One pair per (source file, test file) that the run observed, taken from the
 * leading component of each identifier in every line's `tests`. The
 * relationship is **measured by running the project's own tests**, not
 * inferred from names, which is the whole reason this module can claim to
 * observe a convention rather than assume one.
 */
export function attributedPairs(files: ReadonlyArray<{ readonly path: string; readonly lines: ReadonlyArray<{ readonly tests: readonly string[] }> }>): AttributedPair[] {
  const seen = new Set<string>();
  const out: AttributedPair[] = [];
  for (const file of files) {
    for (const line of file.lines) {
      for (const identifier of line.tests) {
        const test = testFileOf(identifier);
        const key = `${file.path}\u0000${test}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ source: posix(file.path), test });
        }
      }
    }
  }
  return out;
}
