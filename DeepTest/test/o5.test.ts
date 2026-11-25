/**
 * O-5, end to end, through the real governed sequence.
 *
 * Both branches, from the same fixture set, so the choice of destination is
 * shown to come from measured attribution rather than from a preference. And
 * the refusals, which reach rule 94's gate before the model: zero model
 * calls, nothing on the surface, no capability.
 */
import { test, beforeAll, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import {
  clearCapabilitiesForTests,
  clearRegistryForTests,
  authorizationBrief,
  authorizationEvent,
  memoryRepository,
  reconcileConstraints,
  requireInteraction,
  runGovernedInteraction,
} from '@projectrevivesolutions/witness';
import type { GovernancePacket, InteractionSpec, ModelPort, SurfacePort, SyntaxPort } from '@projectrevivesolutions/witness';
import { repoWasmDir } from '../src/languages/shared/treeSitter';
import { createDeepTestSyntax } from '../src/agent/syntax';
import { COVERAGE_PROPOSE_TEST, FUNCTION_PROPOSE_TESTS, registerInteractions } from '../src/agent/interactions';
import { testProposalPacket } from '../src/agent/packets';
import type { MeasuredGap } from '../src/agent/packets';

let syntax: SyntaxPort;
beforeAll(async () => {
  syntax = await createDeepTestSyntax(repoWasmDir());
}, 60_000);

beforeEach(() => {
  clearCapabilitiesForTests();
  clearRegistryForTests();
  registerInteractions();
});

const SOURCE = 'src/pricing.ts';
const EXISTING_TEST = 'src/pricing.test.ts';
const PROJECT_FILES: Record<string, string> = {
  [SOURCE]: 'export function total(a: number, b: number): number {\n  if (a < 0) { return 0; }\n  return a + b;\n}\n',
  [EXISTING_TEST]: `import { it, expect } from 'vitest';
import { total } from './pricing';

it('adds', () => {
  expect(total(1, 2)).toBe(3);
});
`,
};

const PAIRS = [
  { source: 'src/greet.ts', test: 'src/greet.test.ts' },
  { source: 'src/names.ts', test: 'src/names.test.ts' },
];

function gap(line: number, tests: string[]): MeasuredGap {
  return { path: SOURCE, line, tests, gap: 1, because: 'Nothing took the branch where a is negative.' };
}

function proposal(gaps: MeasuredGap[], files: Record<string, string> = PROJECT_FILES, functionName?: string) {
  return testProposalPacket({
    source: SOURCE,
    gaps,
    pairsForSource: [],
    pairsInProject: PAIRS,
    runner: 'vitest',
    read: (p) => files[p],
    exists: (p) => p in files,
    ...(functionName ? { functionName } : {}),
  });
}

function model(answers: string[]): ModelPort & { sent: string[] } {
  const sent: string[] = [];
  return {
    sent,
    id: 'the-model-the-user-picked',
    async send(prompt: string) {
      sent.push(prompt);
      return answers.shift() ?? '';
    },
  } as unknown as ModelPort & { sent: string[] };
}

function watchful(): SurfacePort & { everything: string[] } {
  const everything: string[] = [];
  return {
    everything,
    progress: (l: string) => everything.push(l),
    markdown: (t: string) => everything.push(t),
    anchor: (p: string) => everything.push(p),
    button: (t: string, h: string) => everything.push(`${t}:${h}`),
    log: (l: string) => everything.push(l),
  } as unknown as SurfacePort & { everything: string[] };
}

/** The person, saying yes to the brief this attempt would actually show them. */
function grant(spec: InteractionSpec, packet: GovernancePacket) {
  return authorizationEvent(authorizationBrief(packet, spec, reconcileConstraints(spec, packet)), true, 'the person');
}

function proposeAnswer(changeSet: unknown[]): string {
  return JSON.stringify({ kind: 'propose', changeSet, claims: { perEdit: changeSet.map(() => ({ withinScope: true })) } });
}

// ---------------------------------------------------------------------------
// The branch comes from attribution
// ---------------------------------------------------------------------------

test('branch A: one attributed test file gives a modify packet with a content digest', () => {
  const made = proposal([gap(2, [`${EXISTING_TEST}::adds`])]);
  assert.ok(made.ok);
  if (!made.ok) {
    return;
  }
  assert.equal(made.operation, 'modify');
  assert.equal(made.destination, EXISTING_TEST);
  assert.equal(made.anchor.kind, 'content-digest');
  assert.deepEqual([...made.packet.allowed.proposable], [EXISTING_TEST]);
  assert.match(made.packet.headline, /without changing the tests already in it/);
});

test('branch B: no attributed test file gives a create packet with a created-path anchor', () => {
  const made = proposal([gap(2, [])], { [SOURCE]: PROJECT_FILES[SOURCE] });
  assert.ok(made.ok);
  if (!made.ok) {
    return;
  }
  assert.equal(made.operation, 'create');
  assert.equal(made.destination, EXISTING_TEST, 'derived from the project\'s own convention');
  assert.equal(made.anchor.kind, 'path-created');
  assert.deepEqual([...made.packet.allowed.proposable], [EXISTING_TEST]);
});

test('the same source with and without attribution takes the two branches', () => {
  const withOne = proposal([gap(2, [`${EXISTING_TEST}::adds`])]);
  const withNone = proposal([gap(2, [])], { [SOURCE]: PROJECT_FILES[SOURCE] });
  assert.equal(withOne.ok && withOne.operation, 'modify');
  assert.equal(withNone.ok && withNone.operation, 'create');
  assert.equal(withOne.ok && withOne.anchor.kind, 'content-digest');
  assert.equal(withNone.ok && withNone.anchor.kind, 'path-created');
});

// ---------------------------------------------------------------------------
// The refusals, all before the packet exists
// ---------------------------------------------------------------------------

test('several distinct test files refuse, and no packet is built', () => {
  const made = proposal([gap(2, ['test/unit/pricing.test.ts::a', 'test/integration/checkout.test.ts::b'])]);
  assert.equal(made.ok, false);
  assert.match(made.ok ? '' : made.why, /exercised by 2 test files/);
});

test('function.propose-tests refuses on the union over its gap lines', () => {
  const made = proposal([gap(2, ['test/a.test.ts::x']), gap(3, ['test/b.test.ts::y'])], PROJECT_FILES, 'total');
  assert.equal(made.ok, false);
  assert.match(made.ok ? '' : made.why, /exercised by 2 test files/);
});

test('no measured gap refuses', () => {
  assert.equal(proposal([]).ok, false);
});

// ---------------------------------------------------------------------------
// The packet reconciles, and C3 is bound to the one destination
// ---------------------------------------------------------------------------

test('C3 is bound to the destination and equals what the brief will show', () => {
  const made = proposal([gap(2, [`${EXISTING_TEST}::adds`])]);
  assert.ok(made.ok);
  if (!made.ok) {
    return;
  }
  const spec = requireInteraction(COVERAGE_PROPOSE_TEST);
  const effective = reconcileConstraints(spec, made.packet);
  const c3 = effective.constraints.find((c) => c.id === 'C3');
  assert.ok(c3, 'the spec requires C3 and the reconciler produced it');
  assert.deepEqual(c3 && c3.rule.kind === 'paths-confined-to' ? [...c3.rule.allow] : [], [EXISTING_TEST]);
  assert.deepEqual([...effective.required], ['C1', 'C3', 'C4', 'C8']);
});

test('function.propose-tests reconciles the same way', () => {
  const made = proposal([gap(2, [`${EXISTING_TEST}::adds`]), gap(3, [`${EXISTING_TEST}::adds`])], PROJECT_FILES, 'total');
  assert.ok(made.ok);
  if (!made.ok) {
    return;
  }
  const effective = reconcileConstraints(requireInteraction(FUNCTION_PROPOSE_TESTS), made.packet);
  assert.deepEqual([...effective.required], ['C1', 'C3', 'C4', 'C8']);
});

// ---------------------------------------------------------------------------
// Through the governed sequence
// ---------------------------------------------------------------------------

test('branch A: a provably additive modification is accepted', async () => {
  const made = proposal([gap(2, [`${EXISTING_TEST}::adds`])]);
  assert.ok(made.ok);
  if (!made.ok) {
    return;
  }
  const spec = requireInteraction(COVERAGE_PROPOSE_TEST);
  const after = `${PROJECT_FILES[EXISTING_TEST]}
it('returns zero for a negative', () => {
  expect(total(-1, 2)).toBe(0);
});
`;
  const outcome = await runGovernedInteraction(spec, made.packet, {
    model: model([proposeAnswer([{ path: EXISTING_TEST, operation: 'modify', before: 'it(', after }])]),
    surface: watchful(),
    repository: memoryRepository('/project', PROJECT_FILES),
    syntax,
    authorization: grant(spec, made.packet),
  });
  assert.equal(outcome.kind, 'proposed', 'this is the case the whole refinement exists for');
});

test('branch A: a non-additive modification fails C1 and no other id', async () => {
  const made = proposal([gap(2, [`${EXISTING_TEST}::adds`])]);
  assert.ok(made.ok);
  if (!made.ok) {
    return;
  }
  const spec = requireInteraction(COVERAGE_PROPOSE_TEST);
  const rewritten = PROJECT_FILES[EXISTING_TEST].replace('toBe(3)', 'toBeTruthy()');
  const outcome = await runGovernedInteraction(spec, made.packet, {
    model: model([
      proposeAnswer([{ path: EXISTING_TEST, operation: 'modify', before: 'it(', after: rewritten }]),
      proposeAnswer([{ path: EXISTING_TEST, operation: 'modify', before: 'it(', after: rewritten }]),
    ]),
    surface: watchful(),
    repository: memoryRepository('/project', PROJECT_FILES),
    syntax,
    authorization: grant(spec, made.packet),
  });
  assert.equal(outcome.kind, 'abandoned');
  if (outcome.kind === 'abandoned') {
    const failed = outcome.record.validators.filter((v) => v.verdict === 'fail');
    assert.deepEqual(failed.map((v) => v.constraint), ['C1'], 'on C1 and no other id');
  }
});

test('branch A: a modification of a different test file fails C3', async () => {
  const made = proposal([gap(2, [`${EXISTING_TEST}::adds`])]);
  assert.ok(made.ok);
  if (!made.ok) {
    return;
  }
  const spec = requireInteraction(COVERAGE_PROPOSE_TEST);
  const outcome = await runGovernedInteraction(spec, made.packet, {
    model: model([
      proposeAnswer([{ path: 'src/greet.test.ts', operation: 'modify', before: 'a', after: `it('x', () => {});` }]),
      proposeAnswer([{ path: 'src/greet.test.ts', operation: 'modify', before: 'a', after: `it('x', () => {});` }]),
    ]),
    surface: watchful(),
    repository: memoryRepository('/project', { ...PROJECT_FILES, 'src/greet.test.ts': `it('a', () => {});\n` }),
    syntax,
    authorization: grant(spec, made.packet),
  });
  assert.equal(outcome.kind, 'abandoned');
  if (outcome.kind === 'abandoned') {
    assert.ok(outcome.record.validators.some((v) => v.verdict === 'fail' && v.constraint === 'C3'));
  }
});

test('a tool folder fails C4', async () => {
  const made = proposal([gap(2, [`${EXISTING_TEST}::adds`])]);
  assert.ok(made.ok);
  if (!made.ok) {
    return;
  }
  const spec = requireInteraction(COVERAGE_PROPOSE_TEST);
  const outcome = await runGovernedInteraction(spec, made.packet, {
    model: model([
      proposeAnswer([{ path: '.keepsafe/notes.md', operation: 'create', after: 'x' }]),
      proposeAnswer([{ path: '.keepsafe/notes.md', operation: 'create', after: 'x' }]),
    ]),
    surface: watchful(),
    repository: memoryRepository('/project', PROJECT_FILES),
    syntax,
    authorization: grant(spec, made.packet),
  });
  assert.equal(outcome.kind, 'abandoned');
  if (outcome.kind === 'abandoned') {
    assert.ok(outcome.record.validators.some((v) => v.verdict === 'fail' && v.constraint === 'C4'));
  }
});

test('branch B: a new file at the derived path is accepted, and a modify fails C1', async () => {
  const onlySource = { [SOURCE]: PROJECT_FILES[SOURCE] };
  const made = proposal([gap(2, [])], onlySource);
  assert.ok(made.ok);
  if (!made.ok) {
    return;
  }
  const spec = requireInteraction(COVERAGE_PROPOSE_TEST);
  const created = await runGovernedInteraction(spec, made.packet, {
    model: model([proposeAnswer([{ path: EXISTING_TEST, operation: 'create', after: `it('a', () => {});\n` }])]),
    surface: watchful(),
    repository: memoryRepository('/project', onlySource),
    syntax,
    authorization: grant(spec, made.packet),
  });
  assert.equal(created.kind, 'proposed');
});

test('a refusal with a reason is a correct outcome', async () => {
  const made = proposal([gap(2, [`${EXISTING_TEST}::adds`])]);
  assert.ok(made.ok);
  if (!made.ok) {
    return;
  }
  const spec = requireInteraction(COVERAGE_PROPOSE_TEST);
  const outcome = await runGovernedInteraction(spec, made.packet, {
    model: model([JSON.stringify({ kind: 'propose', changeSet: [], refusal: { reason: 'There is no way to reach that branch without changing the function.' }, claims: { perEdit: [] } })]),
    surface: watchful(),
    repository: memoryRepository('/project', PROJECT_FILES),
    syntax,
    authorization: grant(spec, made.packet),
  });
  assert.notEqual(outcome.kind, 'abandoned');
});
