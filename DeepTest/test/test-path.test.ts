/**
 * Where a new test is proposed, and which of several files it belongs in.
 *
 * Every convention below is taken from a real fixture in `test/fixtures`, not
 * invented, because the point of this module is that it observes a project
 * rather than assuming one. Where a case is deliberately synthetic it says so
 * and says what it is testing.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { isTestPath } from '@projectrevivesolutions/witness';
import { attributedTestFiles, conventionOf, majorityTuple, proposedTestPath, resolveDestination, testFileOf } from '../src/agent/testPath';
import type { AttributedPair } from '../src/agent/testPath';

const NOTHING_EXISTS = (): boolean => false;

function derive(source: string, pairs: readonly AttributedPair[], exists: (p: string) => boolean = NOTHING_EXISTS) {
  return proposedTestPath({ source, pairsForSource: [], pairsInProject: pairs, exists });
}

// ---------------------------------------------------------------------------
// The corpus's real conventions, each derived from its own attributed pairs
// ---------------------------------------------------------------------------

/** helloworld-angular-karma and helloworld-angular-vitest. */
const ANGULAR: AttributedPair[] = [
  { source: 'src/app/greet.ts', test: 'src/app/greet.spec.ts' },
  { source: 'src/app/names.ts', test: 'src/app/names.spec.ts' },
  { source: 'src/app/greeting.ts', test: 'src/app/greeting.spec.ts' },
];

/** helloworld-node-mocha. */
const MOCHA: AttributedPair[] = [
  { source: 'src/greet.js', test: 'test/greet.test.js' },
  { source: 'src/names.js', test: 'test/names.test.js' },
];

/** helloworld-python. */
const PYTEST: AttributedPair[] = [
  { source: 'greet.py', test: 'tests/test_greet.py' },
  { source: 'names.py', test: 'tests/test_names.py' },
];

/** helloworld-react-vitest. Two source extensions, both matching their tests. */
const REACT_VITEST: AttributedPair[] = [
  { source: 'src/greet.ts', test: 'src/greet.test.ts' },
  { source: 'src/names.ts', test: 'src/names.test.ts' },
  { source: 'src/components/Greeting.tsx', test: 'src/components/Greeting.test.tsx' },
];

/** helloworld-svelte-vitest. The test extension does not match the source. */
const SVELTE: AttributedPair[] = [
  { source: 'src/lib/greet.ts', test: 'src/lib/greet.test.ts' },
  { source: 'src/lib/names.ts', test: 'src/lib/names.test.ts' },
  { source: 'src/lib/Greeting.svelte', test: 'src/lib/Greeting.test.ts' },
];

/** helloworld-vue-vitest. Same shape as svelte, different extension. */
const VUE: AttributedPair[] = [
  { source: 'src/greet.ts', test: 'src/greet.test.ts' },
  { source: 'src/names.ts', test: 'src/names.test.ts' },
  { source: 'src/components/Greeting.vue', test: 'src/components/Greeting.test.ts' },
];

test('Angular: co-located .spec.ts', () => {
  const derived = derive('src/app/schedule.service.ts', ANGULAR);
  assert.equal(derived.ok && derived.path, 'src/app/schedule.service.spec.ts');
});

test('Mocha: mirrored tree, .test.js', () => {
  const derived = derive('src/schedule.js', MOCHA);
  assert.equal(derived.ok && derived.path, 'test/schedule.test.js');
});

test('pytest: a tests directory, and the prefix carries the naming', () => {
  const derived = derive('calc.py', PYTEST);
  assert.equal(derived.ok && derived.path, 'tests/test_calc.py');
  assert.equal(derived.ok && derived.convention.transform, 'stem-prefixed');
  assert.equal(derived.ok && derived.convention.suffix, '');
});

test('React with Vitest: a .tsx source gets a .test.tsx', () => {
  const derived = derive('src/components/NameTag.tsx', REACT_VITEST);
  assert.equal(derived.ok && derived.path, 'src/components/NameTag.test.tsx');
});

test('React with Vitest: a .ts source beside it still gets a .test.ts', () => {
  const derived = derive('src/schedule.ts', REACT_VITEST);
  assert.equal(derived.ok && derived.path, 'src/schedule.test.ts');
});

/**
 * The case where the test extension does not match the source, which is why
 * the extension is observed as a policy rather than taken as a value. A
 * project-wide majority here is `matches-source`, from the two plain `.ts`
 * pairs, and applying that to a `.svelte` source would name a file this
 * project has never written.
 */
test('Svelte: a .svelte source gets a .test.ts, not a .test.svelte', () => {
  const derived = derive('src/lib/GreetingPicker.svelte', SVELTE);
  assert.equal(derived.ok && derived.path, 'src/lib/GreetingPicker.test.ts');
});

test('Vue: a .vue source gets a .test.ts', () => {
  const derived = derive('src/components/NameTag.vue', VUE);
  assert.equal(derived.ok && derived.path, 'src/components/NameTag.test.ts');
});

test('every derived path satisfies Witness\'s isTestPath', () => {
  const cases: Array<[string, AttributedPair[]]> = [
    ['src/app/schedule.service.ts', ANGULAR],
    ['src/schedule.js', MOCHA],
    ['calc.py', PYTEST],
    ['src/components/NameTag.tsx', REACT_VITEST],
    ['src/schedule.ts', REACT_VITEST],
    ['src/lib/GreetingPicker.svelte', SVELTE],
    ['src/components/NameTag.vue', VUE],
  ];
  for (const [source, pairs] of cases) {
    const derived = derive(source, pairs);
    assert.ok(derived.ok, `${source} derives`);
    assert.ok(derived.ok && isTestPath(derived.path), `${derived.ok && derived.path} is a test path to the toolkit`);
  }
});

// ---------------------------------------------------------------------------
// The transform is observed, not assumed
// ---------------------------------------------------------------------------

/**
 * The test a basename implementation fails. These stems deliberately disagree
 * with the real attribution: `pricing.ts` is exercised by `checkout.test.ts`,
 * which shares no stem with it, so no pair exhibits a transform.
 */
test('a project whose tests are named for features exhibits no transform, and refuses', () => {
  const featureNamed: AttributedPair[] = [
    { source: 'src/pricing.ts', test: 'src/checkout.test.ts' },
    { source: 'src/tax.ts', test: 'src/checkout.test.ts' },
    { source: 'src/rounding.ts', test: 'src/invoicing.test.ts' },
  ];
  const derived = derive('src/discount.ts', featureNamed);
  assert.equal(derived.ok, false);
  assert.match(derived.ok ? '' : derived.why, /do not follow one convention/);
});

test('a stem match is not assumed when the attribution says otherwise', () => {
  // `src/pricing.ts` and `test/pricing.test.ts` share a stem and are NOT the
  // measured pair. A basename implementation would derive from the
  // coincidence; this one derives from what ran.
  const misleading: AttributedPair[] = [
    { source: 'src/pricing.ts', test: 'test/checkout.test.ts' },
    { source: 'src/tax.ts', test: 'test/checkout.test.ts' },
  ];
  assert.equal(majorityTuple(misleading), undefined, 'no pair exhibits a transform, so there is no tuple');
});

// ---------------------------------------------------------------------------
// One tuple, never three elections
// ---------------------------------------------------------------------------

/**
 * Placement unanimous, suffix split, extension split. Three independent
 * majorities would synthesize `(co-located, .spec, .ts)`, which appears in
 * neither half of this project.
 */
test('a project mixing .spec.tsx and .test.ts refuses rather than synthesizing a tuple', () => {
  const mixed: AttributedPair[] = [
    { source: 'src/a.tsx', test: 'src/a.spec.tsx' },
    { source: 'src/b.tsx', test: 'src/b.spec.tsx' },
    { source: 'src/c.ts', test: 'src/c.test.ts' },
    { source: 'src/d.ts', test: 'src/d.test.ts' },
  ];
  assert.equal(majorityTuple(mixed), undefined, 'no whole tuple has a strict majority');
  // And the synthesized combination is nowhere in the evidence, which is the
  // point: it is not merely unelected, it was never written.
  const tuples = mixed.map(conventionOf);
  assert.equal(
    tuples.some((t) => t?.suffix === '.spec' && t.extension.kind === 'literal' && t.extension.extension === '.ts'),
    false,
  );
});

test('no element is ever decided on its own', () => {
  // A 3-to-2 placement majority with no whole-tuple majority still refuses.
  const noWholeMajority: AttributedPair[] = [
    { source: 'src/a.ts', test: 'src/a.test.ts' },
    { source: 'src/b.ts', test: 'src/b.spec.ts' },
    { source: 'src/c.ts', test: 'src/__tests__/c.test.ts' },
  ];
  assert.equal(majorityTuple(noWholeMajority), undefined);
});

// ---------------------------------------------------------------------------
// It fails closed
// ---------------------------------------------------------------------------

test('no attribution at all refuses', () => {
  const derived = proposedTestPath({ source: 'src/pricing.ts', pairsForSource: [], pairsInProject: [], exists: NOTHING_EXISTS });
  assert.equal(derived.ok, false);
  assert.match(derived.ok ? '' : derived.why, /has been measured as testing anything/);
});

test('a derived path that already exists refuses, and this is the common case', () => {
  const derived = derive('src/app/greet.ts', ANGULAR, (p) => p === 'src/app/greet.spec.ts');
  assert.equal(derived.ok, false);
  assert.match(derived.ok ? '' : derived.why, /already exists/);
});

test('runner is not an input', () => {
  // The signature is the assertion. A component judgement cannot come back
  // through a parameter that is not there.
  const parameters = Object.keys({ source: '', pairsForSource: [], pairsInProject: [], exists: NOTHING_EXISTS });
  assert.equal(parameters.includes('runner'), false);
  assert.deepEqual(parameters, ['source', 'pairsForSource', 'pairsInProject', 'exists']);
});

// ---------------------------------------------------------------------------
// The destination, when attribution is not unique (Part T.1)
// ---------------------------------------------------------------------------

test('an identifier names its test file exactly, with no inference', () => {
  assert.equal(testFileOf('test/greet.test.js::greet > returns a greeting'), 'test/greet.test.js');
  assert.equal(testFileOf('src/a.test.ts::outer > inner > does the thing'), 'src/a.test.ts');
});

test('several identifiers from one file is one destination, not several', () => {
  const destination = resolveDestination({
    source: 'src/pricing.ts',
    testsPerTarget: [['test/pricing.test.ts::a', 'test/pricing.test.ts::b', 'test/pricing.test.ts::c']],
    pairsForSource: [],
    pairsInProject: MOCHA,
    exists: NOTHING_EXISTS,
  });
  assert.deepEqual(destination, { kind: 'modify', path: 'test/pricing.test.ts' });
});

test('several distinct test files refuse, before the packet and before the model', () => {
  const destination = resolveDestination({
    source: 'src/pricing.ts',
    testsPerTarget: [['test/unit/pricing.test.ts::a', 'test/integration/checkout.test.ts::b', 'test/snapshot/pricing.test.ts::c']],
    pairsForSource: [],
    pairsInProject: MOCHA,
    exists: NOTHING_EXISTS,
  });
  assert.equal(destination.kind, 'refuse');
  assert.match(destination.kind === 'refuse' ? destination.why : '', /exercised by 3 test files/);
  // The reason names them, because "pick the file" is only actionable if the
  // person can see which files Polyglot meant.
  for (const f of ['test/unit/pricing.test.ts', 'test/integration/checkout.test.ts', 'test/snapshot/pricing.test.ts']) {
    assert.match(destination.kind === 'refuse' ? destination.why : '', new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

/**
 * The case a plausible implementation quietly gets wrong: every gap line
 * resolves to exactly one file individually, and the union is three.
 */
test('function.propose-tests refuses on the union, not per line', () => {
  const destination = resolveDestination({
    source: 'src/pricing.ts',
    testsPerTarget: [['test/a.test.ts::one'], ['test/b.test.ts::two'], ['test/c.test.ts::three']],
    pairsForSource: [],
    pairsInProject: MOCHA,
    exists: NOTHING_EXISTS,
  });
  assert.equal(destination.kind, 'refuse');
  assert.match(destination.kind === 'refuse' ? destination.why : '', /exercised by 3 test files/);
});

test('no heuristic tiebreak survives', () => {
  // One candidate covers more lines, one name resembles the source, one path
  // is shortest. Every one of those would pick a file. None of them does.
  const destination = resolveDestination({
    source: 'src/pricing.ts',
    testsPerTarget: [
      ['a.test.ts::one', 'test/integration/billing/checkout.test.ts::x'],
      ['a.test.ts::two', 'test/unit/pricing.test.ts::y'],
      ['a.test.ts::three'],
    ],
    pairsForSource: [],
    pairsInProject: MOCHA,
    exists: NOTHING_EXISTS,
  });
  assert.equal(destination.kind, 'refuse');
});

test('no attributed file at all takes branch B, and the branch comes from attribution', () => {
  const withNone = resolveDestination({
    source: 'src/schedule.js',
    testsPerTarget: [[]],
    pairsForSource: [],
    pairsInProject: MOCHA,
    exists: NOTHING_EXISTS,
  });
  assert.equal(withNone.kind, 'create');
  assert.equal(withNone.kind === 'create' && withNone.path, 'test/schedule.test.js');

  const withOne = resolveDestination({
    source: 'src/schedule.js',
    testsPerTarget: [['test/schedule.test.js::already here']],
    pairsForSource: [],
    pairsInProject: MOCHA,
    exists: NOTHING_EXISTS,
  });
  assert.deepEqual(withOne, { kind: 'modify', path: 'test/schedule.test.js' });
});

test('attributedTestFiles is a sorted distinct set', () => {
  assert.deepEqual(attributedTestFiles([['b.test.ts::x', 'a.test.ts::y'], ['b.test.ts::z']]), ['a.test.ts', 'b.test.ts']);
});
