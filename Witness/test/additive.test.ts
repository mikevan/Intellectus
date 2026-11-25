/**
 * The provably additive test rule, against real parsers and real frameworks.
 *
 * Every refusal case in the plan's Part S.4 is here, and each structural
 * failure is asserted to name **C1 and no other id**, because a refusal that
 * blamed two constraints would make the governance record say two things
 * happened when one did. The two undecidable cases name no constraint at all,
 * which is rule 94: absence of evidence is not a violation and must not be
 * reported as one.
 */
import { test, beforeAll } from 'vitest';
import assert from 'node:assert/strict';
import {
  ONE_CORRECTION,
  STANDING_CONSTRAINTS,
  USER_AUTHORIZES_ATTEMPT,
  buildPacket,
  createTypeScriptSyntax,
  isProvablyAdditive,
  memoryRepository,
  repoWasmDir,
  validatorFor,
} from '../src/index';
import type { GovernancePacket, ProposedEdit, SyntaxPort, ValidatorOutcome } from '../src/index';

let syntax: SyntaxPort;
beforeAll(async () => {
  syntax = await createTypeScriptSyntax(repoWasmDir());
}, 60_000);

const FILE = 'src/pricing.test.ts';

function packetFor(): GovernancePacket {
  return buildPacket({
    evidence: [{ origin: 'measurement', text: 'line 4 has a gap of 1.', source: 'deeptest' }],
    classification: { failureClass: 'source', condition: 'coverage-gap', confidence: 'classified', label: 'source' },
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: [FILE], mayPropose: true },
    constraints: [STANDING_CONSTRAINTS.C1],
    validators: ['V-existing-tests'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: { kind: 're-measure', measurements: ['coverage-density', 'existing-tests-still-ran'], target: { kind: 'lines', path: 'src/pricing.ts', lines: [4] } },
    runner: 'vitest',
    headline: 'Add one test for the branch nothing reaches.',
    known: ['Line 4 has a gap of 1.'],
    offers: ['fix'],
  });
}

/** Runs C1's validator over a proposed modify of `FILE`, with a real parser. */
function c1(before: string, after: string, filePath: string = FILE): ValidatorOutcome {
  const edit: ProposedEdit = { path: filePath, operation: 'modify', before: 'x', after };
  return validatorFor('V-existing-tests').run({
    packet: packetFor(),
    constraints: [STANDING_CONSTRAINTS.C1],
    response: { kind: 'propose', changeSet: [edit] },
    repository: memoryRepository('/project', { [filePath]: before }),
    syntax,
  });
}

function assertFailsC1(outcome: ValidatorOutcome, note: string): void {
  assert.equal(outcome.verdict, 'fail', note);
  if (outcome.verdict === 'fail') {
    assert.equal(outcome.constraint, 'C1', 'on C1 and no other id');
  }
}

// ---------------------------------------------------------------------------
// The accepted cases, which are what the refinement exists for
// ---------------------------------------------------------------------------

const VITEST_BEFORE = `import { describe, it, expect } from 'vitest';
import { total } from './pricing';

describe('total', () => {
  it('adds two numbers', () => {
    expect(total(1, 2)).toBe(3);
  });
});
`;

test('Vitest: a new it inside an existing describe is accepted', () => {
  const after = VITEST_BEFORE.replace(
    `  });
});`,
    `  });

  it('handles the negative branch', () => {
    expect(total(-1, 2)).toBe(1);
  });
});`,
  );
  const outcome = c1(VITEST_BEFORE, after);
  assert.equal(outcome.verdict, 'pass', 'this is the flagship case and the whole reason C1 was refined');
});

test('a new test inserted before the end of a describe is accepted', () => {
  const after = VITEST_BEFORE.replace(
    `describe('total', () => {
`,
    `describe('total', () => {
  it('handles zero', () => {
    expect(total(0, 0)).toBe(0);
  });

`,
  );
  assert.equal(c1(VITEST_BEFORE, after).verdict, 'pass', 'insertion, not only appending: this is the ordinary engineering action');
});

test('a new top-level describe containing only tests is accepted', () => {
  const after = `${VITEST_BEFORE}
describe('total, edge cases', () => {
  it('handles zero', () => {
    expect(total(0, 0)).toBe(0);
  });
});
`;
  assert.equal(c1(VITEST_BEFORE, after).verdict, 'pass');
});

/**
 * The point of the whole thing. A density shortfall on a branch of an
 * already-tested function lives in a file that already imports that function,
 * so the new test needs no new import.
 */
test('a new test reusing an already-imported function is accepted, with no new import', () => {
  const after = VITEST_BEFORE.replace(
    `  });
});`,
    `  });

  it('adds a negative', () => {
    expect(total(-5, 5)).toBe(0);
  });
});`,
  );
  assert.equal(c1(VITEST_BEFORE, after).verdict, 'pass');
  assert.equal(after.split('import').length, VITEST_BEFORE.split('import').length, 'and no import was added');
  assert.match(after, /total\(-5, 5\)/, 'the new test calls the function the file already imports');
});

/** Recursion: the addition is three levels deep. */
const NESTED = `describe('outer', () => {
  describe('middle', () => {
    describe('inner', () => {
      it('one', () => {});
    });
  });
});
`;

test('an addition three levels deep is accepted', () => {
  const after = NESTED.replace(`      it('one', () => {});`, `      it('one', () => {});
      it('two', () => {});`);
  assert.equal(c1(NESTED, after).verdict, 'pass');
});

test('one character changed in a sibling test at that depth is refused', () => {
  const after = NESTED.replace(`it('one', () => {});`, `it('one', () => { 1; });`);
  assertFailsC1(c1(NESTED, after), 'a changed test three levels down is still a changed test');
});

// ---------------------------------------------------------------------------
// Part S.4, every row
// ---------------------------------------------------------------------------

test('changing the wording of an existing assertion fails C1', () => {
  const after = VITEST_BEFORE.replace('toBe(3)', 'toBeTruthy()');
  assertFailsC1(c1(VITEST_BEFORE, after), 'rewriting an assertion is not an addition');
});

/**
 * A change that **strengthens** an assertion fails too, and that is
 * deliberate. Deciding which is which means understanding the assertion, and
 * an analysis wrong in the permissive direction signs off on a manufactured
 * pass.
 */
test('strengthening an existing assertion fails C1 as well, and that is the honest boundary', () => {
  const before = VITEST_BEFORE.replace('toBe(3)', 'toBeTruthy()');
  assertFailsC1(c1(before, VITEST_BEFORE), 'no assertion-strength analysis is implemented, and none is planned');
});

test('reordering two existing tests fails C1', () => {
  const before = `describe('total', () => {
  it('a', () => {});
  it('b', () => {});
});
`;
  const after = `describe('total', () => {
  it('b', () => {});
  it('a', () => {});
});
`;
  const outcome = c1(before, after);
  assertFailsC1(outcome, 'order-preserving matching');
  assert.match(outcome.verdict === 'fail' ? outcome.because : '', /has moved/);
});

test('deleting an existing test fails C1', () => {
  const before = `describe('total', () => {
  it('a', () => {});
  it('b', () => {});
});
`;
  const after = `describe('total', () => {
  it('a', () => {});
});
`;
  assertFailsC1(c1(before, after), 'removing something already there is not an addition');
});

test('adding an it and a beforeEach fails C1', () => {
  const after = VITEST_BEFORE.replace(
    `describe('total', () => {
`,
    `describe('total', () => {
  beforeEach(() => { reset(); });
`,
  );
  const outcome = c1(VITEST_BEFORE, after);
  assertFailsC1(outcome, 'a hook runs before every test already in the file');
  assert.match(outcome.verdict === 'fail' ? outcome.because : '', /not a test/);
});

test('adding an it and a new import fails C1', () => {
  const after = `import { vi } from 'vitest';\n${VITEST_BEFORE}`;
  assertFailsC1(c1(VITEST_BEFORE, after), 'a new import changes the module\'s shared scope');
});

test('adding vi.mock fails C1', () => {
  const after = VITEST_BEFORE.replace(`describe('total'`, `vi.mock('./pricing');\n\ndescribe('total'`);
  assertFailsC1(c1(VITEST_BEFORE, after), 'reconfiguring a shared mock changes what existing tests do');
});

test('adding .only to an existing describe fails C1, on the header', () => {
  const after = VITEST_BEFORE.replace(`describe('total'`, `describe.only('total'`);
  const outcome = c1(VITEST_BEFORE, after);
  assertFailsC1(outcome, '.only makes every other test in the run not run');
  assert.match(outcome.verdict === 'fail' ? outcome.because : '', /changed the line that opens it/);
  assert.match(outcome.verdict === 'fail' ? outcome.because : '', /stops every other test in the file from running/);
  // And it is not reported as a deletion, which is what the person would
  // otherwise be told they had done.
  assert.equal(/Removing something/.test(outcome.verdict === 'fail' ? outcome.because : ''), false);
});

/**
 * Default-deny, proved by a construct nobody listed. If this passed, the rule
 * would be a denylist wearing an allowlist's clothes.
 */
test('a module-scope statement nobody thought of is refused', () => {
  const after = VITEST_BEFORE.replace(`describe('total'`, `Object.freeze(globalThis.sharedFixture);\n\ndescribe('total'`);
  assertFailsC1(c1(VITEST_BEFORE, after), 'the rule is default-deny, not a list of forbidden constructs');
});

// ---------------------------------------------------------------------------
// The two undecidable rows: no constraint is named
// ---------------------------------------------------------------------------

test('a file that cannot be parsed is invalid/evidence and names no constraint', () => {
  const outcome = c1(VITEST_BEFORE, 'describe("total", () => {\n  it("a", () => {}\n');
  assert.equal(outcome.verdict, 'invalid');
  if (outcome.verdict === 'invalid') {
    assert.equal(outcome.cause, 'evidence');
  }
  assert.equal('constraint' in outcome, false, 'nothing is accused of violating anything');
});

test('two existing tests sharing an identity is invalid/evidence, not a violation', () => {
  const before = `describe('total', () => {
  it('works', () => { 1; });
  it('works', () => { 2; });
});
`;
  const after = before.replace(`});
`, `  it('new', () => {});
});
`);
  const outcome = c1(before, after);
  assert.equal(outcome.verdict, 'invalid');
  if (outcome.verdict === 'invalid') {
    assert.equal(outcome.cause, 'evidence');
    assert.match(outcome.because, /cannot tell which one/);
  }
});

test('no parser for this file is invalid/evidence, and the gate catches it first', () => {
  const edit: ProposedEdit = { path: FILE, operation: 'modify', before: 'x', after: VITEST_BEFORE };
  const outcome = validatorFor('V-existing-tests').run({
    packet: packetFor(),
    constraints: [STANDING_CONSTRAINTS.C1],
    response: { kind: 'propose', changeSet: [edit] },
    repository: memoryRepository('/project', { [FILE]: VITEST_BEFORE }),
  });
  assert.equal(outcome.verdict, 'invalid');
  if (outcome.verdict === 'invalid') {
    assert.equal(outcome.cause, 'evidence');
  }
});

// ---------------------------------------------------------------------------
// The adapter's allowlist, asserted at the classification
// ---------------------------------------------------------------------------

function kindsOf(source: string, file = 'src/a.test.ts'): string[] {
  return (syntax.testStructures(file, source) ?? []).map((s) => s.kind);
}

test('bare it, test, specify, describe and context are cases and suites', () => {
  assert.deepEqual(kindsOf(`it('a', () => {});`), ['test-case']);
  assert.deepEqual(kindsOf(`test('a', () => {});`), ['test-case']);
  assert.deepEqual(kindsOf(`specify('a', () => {});`), ['test-case']);
  assert.deepEqual(kindsOf(`describe('a', () => {});`), ['suite']);
  assert.deepEqual(kindsOf(`context('a', () => {});`), ['suite']);
});

/**
 * `test.describe` is Playwright's suite form and it is a member expression.
 * It is the reason the rule cannot be "reject member access", and asserting
 * it here is what stops somebody simplifying the allowlist into that rule.
 */
test('test.describe is a suite, which is why the rule is not "reject member access"', () => {
  assert.deepEqual(kindsOf(`test.describe('a', () => { test('b', () => {}); });`), ['suite']);
  const structures = syntax.testStructures('src/a.test.ts', `test.describe('a', () => { test('b', () => {}); });`) ?? [];
  assert.equal(structures[0].kind === 'suite' && structures[0].children[0].kind, 'test-case');
});

test('every modifier is other, at the classification and not at a later check', () => {
  for (const source of [
    `test.only('a', () => {});`,
    `describe.only('a', () => {});`,
    `it.only('a', () => {});`,
    `fit('a', () => {});`,
    `fdescribe('a', () => {});`,
    `it.skip('a', () => {});`,
    `it.todo('a');`,
    `xit('a', () => {});`,
    `xdescribe('a', () => {});`,
    `it.concurrent('a', () => {});`,
    `it.failing('a', () => {});`,
    `test.use({ locale: 'en' });`,
    `test.beforeEach(async () => {});`,
    `test.describe.configure({ mode: 'parallel' });`,
  ]) {
    assert.deepEqual(kindsOf(source), ['other'], source);
  }
});

/**
 * `.each` is a different invocation shape: a call whose callee is a call. It
 * is very likely additive and not affirmatively provable with this
 * comparison, so it is deliberately `other` for 1.0.21 rather than
 * accidentally so.
 */
test('.each is other, deliberately, and its exclusion is pinned', () => {
  assert.deepEqual(kindsOf(`it.each([[1, 2]])('adds %i', (a, b) => {});`), ['other']);
});

test('a new .only in a proposal fails C1, which is the case the allowlist exists for', () => {
  const after = VITEST_BEFORE.replace(
    `  });
});`,
    `  });

  it.only('the new one', () => {
    expect(total(1, 1)).toBe(2);
  });
});`,
  );
  assertFailsC1(c1(VITEST_BEFORE, after), 'a green suite in which the pre-existing tests never ran');
});

// ---------------------------------------------------------------------------
// The other frameworks, over their real shapes
// ---------------------------------------------------------------------------

test('Karma and Mocha: a new it inside an existing describe is accepted', () => {
  const karma = `describe('GreetService', () => {
  it('greets', () => {
    expect(greet('a')).toBe('Hello a');
  });
});
`;
  const after = karma.replace(`  });
});`, `  });

  it('greets nobody', () => {
    expect(greet('')).toBe('Hello');
  });
});`);
  assert.equal(c1(karma, after, 'src/app/greet.spec.ts').verdict, 'pass');

  const mocha = `const assert = require('assert');
describe('greet', function () {
  it('greets', function () {
    assert.equal(greet('a'), 'Hello a');
  });
});
`;
  const mochaAfter = mocha.replace(`  });
});`, `  });

  it('greets nobody', function () {
    assert.equal(greet(''), 'Hello');
  });
});`);
  assert.equal(c1(mocha, mochaAfter, 'test/greet.test.js').verdict, 'pass');
});

test('Playwright: a new test inside an existing test.describe is accepted', () => {
  const before = `import { test, expect } from '@playwright/experimental-ct-react';

test.describe('Greeting', () => {
  test('renders', async ({ mount }) => {
    const c = await mount(<Greeting name="a" />);
    await expect(c).toContainText('Hello a');
  });
});
`;
  const after = before.replace(`  });
});`, `  });

  test('renders empty', async ({ mount }) => {
    const c = await mount(<Greeting name="" />);
    await expect(c).toContainText('Hello');
  });
});`);
  assert.equal(c1(before, after, 'src/components/Greeting.spec.tsx').verdict, 'pass');
});

// ---------------------------------------------------------------------------
// The comparator on its own
// ---------------------------------------------------------------------------

test('undefined structures are undecidable, never a pass', () => {
  assert.equal(isProvablyAdditive(undefined, []).kind, 'undecidable');
  assert.equal(isProvablyAdditive([], undefined).kind, 'undecidable');
  assert.equal(isProvablyAdditive(undefined, undefined).kind, 'undecidable');
});

test('an unchanged file is additive, trivially', () => {
  const structures = syntax.testStructures(FILE, VITEST_BEFORE);
  assert.equal(isProvablyAdditive(structures, structures).kind, 'additive');
});

// ---------------------------------------------------------------------------
// The path rule is unchanged for everything that is not a governed test edit
// ---------------------------------------------------------------------------

test('an ordinary source file is still not a test file', () => {
  const outcome = validatorFor('V-existing-tests').run({
    packet: packetFor(),
    constraints: [STANDING_CONSTRAINTS.C1],
    response: { kind: 'propose', changeSet: [{ path: 'src/pricing.ts', operation: 'modify', before: 'a + b', after: 'a + b + 0' }] },
    repository: memoryRepository('/project', {}),
    syntax,
  });
  assert.equal(outcome.verdict, 'pass', 'C1 is about tests, and a source change is C2 and C3\'s business');
});

test('a create always passes, whatever the path', () => {
  const outcome = validatorFor('V-existing-tests').run({
    packet: packetFor(),
    constraints: [STANDING_CONSTRAINTS.C1],
    response: { kind: 'propose', changeSet: [{ path: 'src/brand.test.ts', operation: 'create', after: `it('a', () => {});` }] },
    repository: memoryRepository('/project', {}),
    syntax,
  });
  assert.equal(outcome.verdict, 'pass', 'a new file somewhere wrong is C3\'s business, and two validators failing on one fact makes the record ambiguous');
});
