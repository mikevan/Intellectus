/**
 * The third identity, the application anchors, and field 10 resolved.
 *
 * Three things that were confused with each other across this plan's
 * revisions, tested together so the distinctions are held by assertions
 * rather than by whoever remembers them.
 */
import { test, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import {
  ONE_CORRECTION,
  STANDING_CONSTRAINTS,
  USER_AUTHORIZES_ATTEMPT,
  anchorApplied,
  buildPacket,
  buildRecord,
  clearCapabilitiesForTests,
  clearRegistryForTests,
  contentDigest,
  issueInteraction,
  memoryRepository,
  newAttemptId,
  recordVerification,
  registerInteraction,
  resolveVerification,
  RECORD_FIELDS,
  authorizationBrief,
  authorizationEvent,
  reconcileConstraints,
  runGovernedInteraction,
} from '../src/index';
import type { ApplicationAnchor, GovernancePacket, InteractionSpec, VerificationRule } from '../src/index';

function reset(): void {
  clearRegistryForTests();
  clearCapabilitiesForTests();
}
beforeEach(reset);

function spec(): InteractionSpec {
  return registerInteraction({
    id: 'coverage.propose-test',
    tool: 'DeepTest',
    title: 'Propose one test for a measured gap.',
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: ['src/pricing.test.ts'], mayPropose: true },
    constraints: ['C4'],
    validators: ['V-forbidden-paths', 'V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: { kind: 're-measure', measurements: ['coverage-density'], target: { kind: 'lines', path: 'src/pricing.ts', lines: [2] } },
  });
}

function packet(verification?: VerificationRule): GovernancePacket {
  return buildPacket({
    evidence: [{ origin: 'measurement', text: 'line 2 has a gap of 1.', source: 'deeptest' }],
    classification: { failureClass: 'source', condition: 'coverage-gap', confidence: 'classified', label: 'source' },
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: ['src/pricing.test.ts'], mayPropose: true },
    constraints: [STANDING_CONSTRAINTS.C4],
    validators: ['V-forbidden-paths', 'V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: verification ?? { kind: 're-measure', measurements: ['coverage-density'], target: { kind: 'lines', path: 'src/pricing.ts', lines: [2] } },
    runner: 'vitest',
    headline: 'Add one test for the branch nothing reaches.',
    known: ['Line 2 has a gap of 1.'],
    offers: ['fix'],
  });
}

// ---------------------------------------------------------------------------
// attemptId
// ---------------------------------------------------------------------------

test('two attempts at the same interaction are two attempts', () => {
  const s = spec();
  const p = packet();
  const a = issueInteraction(s, p);
  const b = issueInteraction(s, p);
  assert.notEqual(a.attemptId, b.attemptId, 'the same interaction, twice, is two attempts');
  assert.equal(a.interactionId, b.interactionId, 'and it is the same interaction type both times');
});

test('the attempt id is never derived from packet content', () => {
  const s = spec();
  // Byte-identical packets. A content digest would collide here, and the
  // whole point of a random identity is that it does not.
  const one = issueInteraction(s, packet());
  const two = issueInteraction(s, packet());
  assert.equal(one.packetId, two.packetId, 'the packets are identical, so their digests are');
  assert.notEqual(one.attemptId, two.attemptId, 'and the attempts are still two attempts');
});

test('the attempt id is not the capability value', () => {
  const capability = issueInteraction(spec(), packet());
  assert.notEqual(capability.attemptId, capability.value, 'a one-use secret must not reach a product store');
  assert.match(capability.attemptId, /^[0-9a-f-]{36}$/, 'and it is a uuid, carrying nothing');
});

test('newAttemptId produces distinct identities', () => {
  const ids = new Set(Array.from({ length: 200 }, () => newAttemptId()));
  assert.equal(ids.size, 200);
});

// ---------------------------------------------------------------------------
// The anchors, one per shape
// ---------------------------------------------------------------------------

const PRICING = 'export function total(a: number, b: number): number {\n  return a + b;\n}\n';

test('path-created: applied only once the path appears', () => {
  const anchor: ApplicationAnchor = { kind: 'path-created', path: 'src/pricing.test.ts' };
  assert.equal(anchorApplied(anchor, memoryRepository('/project', { 'src/pricing.ts': PRICING })), false, 'not applied: the file is not there');
  assert.equal(anchorApplied(anchor, memoryRepository('/project', { 'src/pricing.ts': PRICING, 'src/pricing.test.ts': 'test("x", () => {});\n' })), true);
});

/**
 * The case Revision 2 got wrong for the test-proposing interactions. A
 * correctly applied proposal does not touch the measured source, so a source
 * change here is evidence of the opposite.
 */
test('path-created: a changed source with no test created is not applied', () => {
  const anchor: ApplicationAnchor = { kind: 'path-created', path: 'src/pricing.test.ts' };
  const changed = memoryRepository('/project', { 'src/pricing.ts': `${PRICING}// edited somewhere else\n` });
  assert.equal(anchorApplied(anchor, changed), false, 'the measured source moving proves nothing about the test that was authorized');
});

test('content-digest: applied when the authorized file changed anywhere in it', () => {
  const anchor: ApplicationAnchor = { kind: 'content-digest', path: 'src/pricing.ts', digest: contentDigest(PRICING) };
  assert.equal(anchorApplied(anchor, memoryRepository('/project', { 'src/pricing.ts': PRICING })), false, 'untouched');
  const rewritten = 'export function total(a: number, b: number): number {\n  const sum = a + b;\n  return sum;\n}\n';
  assert.equal(anchorApplied(anchor, memoryRepository('/project', { 'src/pricing.ts': rewritten })), true);
});

/**
 * The DeepTest case Revision 2 got wrong. `hashLine` sees one trimmed line,
 * so a rewritten body under an unchanged signature would have reported
 * `not-run` for work that was done.
 */
test('content-digest: a rewritten body under an unchanged signature is applied', () => {
  const anchor: ApplicationAnchor = { kind: 'content-digest', path: 'src/pricing.ts', digest: contentDigest(PRICING) };
  const sameSignature = 'export function total(a: number, b: number): number {\n  return add(a, b);\n}\n';
  assert.equal(sameSignature.split('\n')[0], PRICING.split('\n')[0], 'the signature line is byte-identical');
  assert.equal(anchorApplied(anchor, memoryRepository('/project', { 'src/pricing.ts': sameSignature })), true);
});

/**
 * The UntangleIt case the ruling caught. A later measurement runs whether or
 * not anybody applied anything, so an after-record proves a run happened and
 * nothing more.
 */
test('content-digest: a later measurement over untouched source is not applied', () => {
  const anchor: ApplicationAnchor = { kind: 'content-digest', path: 'src/pricing.ts', digest: contentDigest(PRICING) };
  assert.equal(anchorApplied(anchor, memoryRepository('/project', { 'src/pricing.ts': PRICING })), false);
});

test('both anchors fail closed when the repository cannot answer', () => {
  const empty = memoryRepository('/project', {});
  assert.equal(anchorApplied({ kind: 'content-digest', path: 'src/gone.ts', digest: 'abc' }, empty), false);
  assert.equal(anchorApplied({ kind: 'path-created', path: '../outside.ts' }, empty), false);
});

// ---------------------------------------------------------------------------
// resolveVerification: every named measurement must hold
// ---------------------------------------------------------------------------

const TWO_PART = {
  kind: 're-measure' as const,
  measurements: ['function-complexity', 'behaviour-equivalence'] as const,
  target: { kind: 'function' as const, path: 'src/pricing.ts', name: 'total', startLine: 1 },
};

test('both measurements met is held', () => {
  assert.equal(
    resolveVerification({
      rule: TWO_PART,
      appliedToTarget: true,
      results: [
        { measurement: 'function-complexity', outcome: 'met' },
        { measurement: 'behaviour-equivalence', outcome: 'met' },
      ],
    }),
    'held',
  );
});

test('complexity met with behaviour changed is changed, not held', () => {
  assert.equal(
    resolveVerification({
      rule: TWO_PART,
      appliedToTarget: true,
      results: [
        { measurement: 'function-complexity', outcome: 'met' },
        { measurement: 'behaviour-equivalence', outcome: 'not-met' },
      ],
    }),
    'changed',
    'lower complexity with broken behaviour is not success',
  );
});

test('behaviour equivalent with complexity unmet is changed, not held', () => {
  assert.equal(
    resolveVerification({
      rule: TWO_PART,
      appliedToTarget: true,
      results: [
        { measurement: 'function-complexity', outcome: 'not-met' },
        { measurement: 'behaviour-equivalence', outcome: 'met' },
      ],
    }),
    'changed',
    'equivalent behaviour with no untangling means the work did not happen',
  );
});

test('a missing before-record is insufficient, never a pass', () => {
  assert.equal(
    resolveVerification({
      rule: TWO_PART,
      appliedToTarget: true,
      results: [
        { measurement: 'function-complexity', outcome: 'met' },
        { measurement: 'behaviour-equivalence', outcome: 'insufficient' },
      ],
    }),
    'insufficient',
  );
});

test('a named measurement nobody ran is insufficient, by rule 89', () => {
  assert.equal(
    resolveVerification({ rule: TWO_PART, appliedToTarget: true, results: [{ measurement: 'function-complexity', outcome: 'met' }] }),
    'insufficient',
    'absence of a result is not a result',
  );
});

test('a failure outranks an insufficiency', () => {
  assert.equal(
    resolveVerification({
      rule: TWO_PART,
      appliedToTarget: true,
      results: [
        { measurement: 'function-complexity', outcome: 'not-met' },
        { measurement: 'behaviour-equivalence', outcome: 'insufficient' },
      ],
    }),
    'changed',
  );
});

test('an unapplied anchor is not-run whatever ran, for both anchor kinds', () => {
  for (const results of [
    [
      { measurement: 'function-complexity' as const, outcome: 'met' as const },
      { measurement: 'behaviour-equivalence' as const, outcome: 'met' as const },
    ],
    [],
  ]) {
    assert.equal(resolveVerification({ rule: TWO_PART, appliedToTarget: false, results }), 'not-run');
  }
});

// ---------------------------------------------------------------------------
// The record
// ---------------------------------------------------------------------------

function recordFor(verification?: VerificationRule) {
  const s = spec();
  const p = packet(verification);
  const capability = issueInteraction(s, p);
  return buildRecord({
    spec: s,
    packet: p,
    prompt: { text: 'anything', hash: 'a'.repeat(64) } as never,
    attemptId: capability.attemptId,
    rawResponse: '{}',
    validation: { accepted: true, outcomes: [] } as never,
    corrections: 0,
    model: { id: 'the-model-the-user-picked' },
  });
}

test('the record carries the attempt, and the target never reaches it', () => {
  const record = recordFor();
  assert.match(record.attemptId, /^[0-9a-f-]{36}$/);
  assert.ok(RECORD_FIELDS.includes('attemptId'), 'and the schema names it');

  const serialized = JSON.stringify(record);
  assert.equal(serialized.includes('src/pricing.ts'), false, 'no path from the verification target');
  assert.equal(serialized.includes('lines'), false, 'and no line numbers');
});

test('a verification outcome attaches without mutating, and only once', () => {
  const record = recordFor();
  assert.equal(record.verification, undefined, 'unresolved until something measures');

  const resolved = recordVerification(record, 'held', 're-measure');
  assert.equal(resolved.verification?.outcome, 'held');
  assert.equal(record.verification, undefined, 'the original is untouched: this returns a new record');

  assert.throws(() => recordVerification(resolved, 'changed', 're-measure'), /already carries the verification outcome/);
});

// ---------------------------------------------------------------------------
// The verification rule's own shape
// ---------------------------------------------------------------------------

test('a propose packet names at least one measurement and exactly what is measured', () => {
  assert.throws(
    () => packet({ kind: 're-measure', measurements: [], target: { kind: 'lines', path: 'src/pricing.ts', lines: [2] } }),
    /names at least one measurement/,
  );
  assert.throws(
    () => packet({ kind: 're-measure', measurements: ['coverage-density', 'coverage-density'], target: { kind: 'lines', path: 'src/pricing.ts', lines: [2] } }),
    /named twice/,
  );
});

// ---------------------------------------------------------------------------
// onCapability: correlation only, and it fails closed
// ---------------------------------------------------------------------------

test('onCapability receives the attempt identity and nothing else', async () => {
  reset();
  const s = registerInteraction({
    id: 'fixture.propose',
    tool: 'DeepTest',
    title: 'A fixture proposal, registered only by tests.',
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: ['src/pricing.test.ts'], mayPropose: true },
    constraints: ['C4'],
    validators: ['V-forbidden-paths', 'V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: { kind: 're-measure', measurements: ['coverage-density'], target: { kind: 'lines', path: 'src/pricing.ts', lines: [2] } },
  });
  const p = packet();
  const seen: unknown[] = [];
  await runGovernedInteraction(s, p, {
    model: { id: 'm', async send() { return JSON.stringify({ kind: 'propose', changeSet: [{ path: 'src/pricing.test.ts', operation: 'create', after: 'x' }], claims: { perEdit: [{ withinScope: true }] } }); } },
    surface: { progress: () => {}, markdown: () => {}, anchor: () => {}, button: () => {}, log: () => {} },
    repository: memoryRepository('/project', {}),
    authorization: grantFor(s, p),
    onCapability: (attempt) => seen.push(attempt),
  });

  assert.equal(seen.length, 1, 'called once');
  assert.deepEqual(Object.keys(seen[0] as object).sort(), ['attemptId', 'interactionId', 'packetId'], 'three correlation values and no powers');
  // The one-use secret must not be reachable from here.
  assert.equal('value' in (seen[0] as object), false, 'no capability value');
  assert.equal('packet' in (seen[0] as object), false, 'and no packet to influence');
});

test('onCapability fails closed: a record that could not be written stops the request', async () => {
  reset();
  const s = registerInteraction({
    id: 'fixture.propose',
    tool: 'DeepTest',
    title: 'A fixture proposal, registered only by tests.',
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: ['src/pricing.test.ts'], mayPropose: true },
    constraints: ['C4'],
    validators: ['V-forbidden-paths', 'V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: { kind: 're-measure', measurements: ['coverage-density'], target: { kind: 'lines', path: 'src/pricing.ts', lines: [2] } },
  });
  const p = packet();
  const sent: string[] = [];

  await assert.rejects(
    () =>
      runGovernedInteraction(s, p, {
        model: { id: 'm', async send(prompt: string) { sent.push(prompt); return '{}'; } },
        surface: { progress: () => {}, markdown: () => {}, anchor: () => {}, button: () => {}, log: () => {} },
        repository: memoryRepository('/project', {}),
        authorization: grantFor(s, p),
        onCapability: () => {
          throw new Error('the decisions file is read-only');
        },
      }),
    /could not be recorded/,
  );

  assert.equal(sent.length, 0, 'no model request for an attempt nothing can be joined to');
});

function grantFor(s: InteractionSpec, p: GovernancePacket) {
  return authorizationEvent(authorizationBrief(p, s, reconcileConstraints(s, p)), true, 'the person');
}
