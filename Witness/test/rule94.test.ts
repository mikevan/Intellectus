/**
 * Rule 94. A governed result Polyglot could not validate is not a validated
 * result, and absence of evidence is not a constraint violation.
 *
 * The first test here is A1's regression, and A1 was a live defect. On a
 * response that would not parse, `ask` stamped the failure onto
 * `effective.constraints[0].id`. The reconciler puts the spec's required
 * constraints first, so for `failure.explain` that is **C4**, the constraint
 * guarding `.deeptest`, `.untangleit`, and `.keepsafe`.
 *
 * A model returning broken JSON therefore produced a governance record
 * saying it had violated the recovery boundary. It had not. Worse, the one
 * bounded correction we allow was then spent telling the model to respect
 * C4, which is not what went wrong, so the attempt that was supposed to
 * rescue the interaction was aimed at the wrong thing.
 *
 * The fix is a type. `ValidatorOutcome`'s `fail` variant requires a
 * constraint id, so a fault belonging to no constraint had to borrow one.
 * `invalid` names none, and it cannot: there is no field for it.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  NOTHING_TO_VERIFY,
  NO_AUTHORIZATION_NEEDED,
  ONE_CORRECTION,
  PATH_CONSTRAINTS,
  PrerequisiteError,
  STANDING_CONSTRAINTS,
  UNREADABLE,
  USER_AUTHORIZES_ATTEMPT,
  authorizationBrief,
  authorizationEvent,
  buildPacket,
  capabilityIsLive,
  clearCapabilitiesForTests,
  clearRegistryForTests,
  memoryRepository,
  reconcileConstraints,
  registerInteraction,
  requirePrerequisites,
  runGovernedInteraction,
  validatorFor,
  PARAMETER_BINDINGS,
  bindingFor,
} from '../src/index';
import type { AuthorizationEvent, Constraint, GovernancePacket, InteractionSpec, ModelPort, SurfacePort, ValidatorId } from '../src/index';

/** The person's yes, for a fixture that needs one. */
function grant(spec: InteractionSpec, packet: GovernancePacket): AuthorizationEvent {
  return authorizationEvent(authorizationBrief(packet, spec, reconcileConstraints(spec, packet)), true, 'the test');
}

// ---------------------------------------------------------------------------

function model(answers: string[]): ModelPort & { sent: string[] } {
  const sent: string[] = [];
  return {
    id: 'the-model-the-user-picked',
    sent,
    async send(prompt: string): Promise<string> {
      sent.push(prompt);
      const next = answers.shift();
      if (next === undefined) {
        throw new Error('the model was asked more times than the test allows');
      }
      return next;
    },
  };
}

function surface(): SurfacePort & { markdown: string[] } {
  const markdown: string[] = [];
  return { markdown: (t) => markdown.push(t), progress: () => undefined, anchor: () => undefined, button: () => undefined, log: () => undefined } as SurfacePort & {
    markdown: string[];
  };
}

/**
 * The live shape, deliberately.
 *
 * `failure.explain` requires C4 and the path condition carries six of its
 * own, so C4 is first in the reconciled set. That ordering is what made the
 * defect pick C4, and the test is worth nothing against a fixture that does
 * not reproduce it.
 */
function liveSpec(): InteractionSpec {
  return registerInteraction({
    id: 'failure.explain',
    tool: 'DeepTest',
    title: 'Explain a run that failed before the tests started.',
    objective: 'explain',
    allowed: { readable: [], proposable: [], mayPropose: false },
    constraints: ['C4'],
    validators: ['V-forbidden-paths'],
    correction: ONE_CORRECTION,
    authorization: NO_AUTHORIZATION_NEEDED,
    verification: NOTHING_TO_VERIFY,
  });
}

function livePacket(): GovernancePacket {
  return buildPacket({
    evidence: [{ origin: 'runner-output', text: 'Application bundle generation failed.', source: 'ng test' }],
    classification: { failureClass: 'toolchain', condition: 'path-character', confidence: 'classified', label: 'toolchain path handling' },
    objective: 'explain',
    allowed: { readable: [], proposable: [], mayPropose: false },
    constraints: [...PATH_CONSTRAINTS, STANDING_CONSTRAINTS.C4],
    validators: ['V-response-shape', 'V-forbidden-paths'],
    correction: ONE_CORRECTION,
    authorization: NO_AUTHORIZATION_NEEDED,
    verification: NOTHING_TO_VERIFY,
    runner: "Angular's unit-test builder with Karma",
    headline: 'It could not start.',
    known: ['The path holds an apostrophe.'],
    remediation: ['Move the project.'],
    offers: ['explain'],
  });
}

function reset(): void {
  clearRegistryForTests();
  clearCapabilitiesForTests();
}

// ---------------------------------------------------------------------------
// A1
// ---------------------------------------------------------------------------

test('a malformed response is invalid, not a C4 violation', async () => {
  reset();
  const spec = liveSpec();
  const packet = livePacket();
  const m = model(['this is not JSON at all', 'still not JSON']);
  const s = surface();

  const outcome = await runGovernedInteraction(spec, packet, { model: m, surface: s });
  assert.equal(outcome.kind, 'abandoned', 'two unusable answers end the interaction');
  if (outcome.kind !== 'abandoned') {
    return;
  }

  const record = outcome.record;

  // The heart of it. Nothing was proven violated, so nothing is accused.
  assert.deepEqual([...record.validators.filter((v) => v.verdict === 'fail')], [], 'no validator reported a constraint violation');
  for (const v of record.validators) {
    assert.notEqual(v.constraint, 'C4', `${v.id} must not name C4: a response that would not parse proves nothing about the recovery boundary`);
    assert.equal(v.constraint, undefined, 'an invalid outcome carries no constraint id at all, because there is no field for one');
  }

  const invalid = record.validators.filter((v) => v.verdict === 'invalid');
  assert.equal(invalid.length, 1, 'one validator said the response could not be used');
  assert.equal(invalid[0].id, 'V-response-shape', 'and it is the one that owns response validity');
  assert.equal(invalid[0].cause, 'response', 'the model sent this, so the model could send something else');

  assert.equal(record.accepted, false, 'rule 94: a result we could not validate is not a validated result');
  reset();
});

test('the record still says which constraints were in force', async () => {
  reset();
  const spec = liveSpec();
  const packet = livePacket();
  const outcome = await runGovernedInteraction(spec, packet, { model: model(['nope', 'nope']), surface: surface() });
  if (outcome.kind !== 'abandoned') {
    assert.fail('expected abandonment');
    return;
  }
  // C4 belongs in `constraintIds`, because it really did bind this
  // interaction. What it must never appear as is a constraint somebody
  // violated. The two facts live in different fields and the distinction is
  // the whole of rule 94's second clause.
  assert.ok(outcome.record.constraintIds.includes('C4'), 'C4 was in force and the record says so');
  assert.equal(
    outcome.record.validators.some((v) => v.verdict === 'fail'),
    false,
    'and nothing reports it as broken',
  );
  reset();
});

test('the correction is about the malformed response, not about .keepsafe', async () => {
  reset();
  const spec = liveSpec();
  const packet = livePacket();
  const m = model(['{ not really json', 'nope']);
  await runGovernedInteraction(spec, packet, { model: m, surface: surface() });

  assert.equal(m.sent.length, 2, 'one request, then exactly one correction');

  // The second request is the original prompt plus the note. The prompt
  // still states every limit, including C4, because rule 50 requires the
  // constraints to travel with the request and a correction that dropped
  // them would be a second request with nothing attached. What must not
  // accuse the model of anything is the note.
  const at = m.sent[1].indexOf('## Your last answer');
  assert.notEqual(at, -1, 'the correction carries a note');
  const note = m.sent[1].slice(at);

  assert.ok(note.includes('could not be used'), 'the note says the answer was unusable');
  assert.ok(note.includes('valid JSON') || note.includes('JSON object'), 'and names the actual fault');
  assert.equal(note.includes('broke a limit'), false, 'it does not accuse the model of breaking a limit');
  assert.equal(note.includes('C4'), false, 'and it does not spend the one correction on a constraint nobody violated');
  assert.equal(note.includes('.keepsafe'), false, 'nor on the recovery boundary, which this response said nothing about');
  reset();
});

test('the interaction id is the registered one, not an empty string', async () => {
  reset();
  const spec = liveSpec();
  const packet = livePacket();
  const outcome = await runGovernedInteraction(spec, packet, { model: model(['x', 'y']), surface: surface() });
  if (outcome.kind !== 'abandoned') {
    assert.fail('expected abandonment');
    return;
  }
  assert.equal(outcome.record.interactionId, 'failure.explain');
  reset();
});

test('a validated response still passes, so the fix did not break the ordinary path', async () => {
  reset();
  const spec = liveSpec();
  const packet = livePacket();
  const good = JSON.stringify({
    kind: 'explain',
    whatIsWrong: 'The project path has an apostrophe in it.',
    whyItHappened: 'Angular wrote the path into generated code without escaping it.',
    howToFix: 'Move the project somewhere without one.',
    whatNotToChange: ['Your own path-handling code.'],
    citedEvidence: [0],
  });
  const m = model([good]);
  const outcome = await runGovernedInteraction(spec, packet, { model: m, surface: surface() });
  assert.equal(outcome.kind, 'explained');
  assert.equal(m.sent.length, 1, 'no correction was needed');
  if (outcome.kind === 'explained') {
    assert.equal(outcome.record.accepted, true);
    assert.deepEqual([...outcome.record.validators.filter((v) => v.verdict === 'invalid')], []);
  }
  reset();
});

// ---------------------------------------------------------------------------
// Rule 94, before the model
// ---------------------------------------------------------------------------

/**
 * A propose fixture, registered only here.
 *
 * Phase 4 registers no production propose interaction. O-5 is Phase 5's, and
 * a spec registered for a test is cleared by `reset()` so it cannot leak
 * into another one.
 */
function proposeSpec(over: Record<string, unknown> = {}): InteractionSpec {
  return registerInteraction({
    id: 'fixture.propose',
    tool: 'UntangleIt',
    title: 'A fixture proposal, registered only by tests.',
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: ['src/pricing.ts'], mayPropose: true },
    constraints: ['C4'],
    validators: ['V-forbidden-paths'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: { kind: 're-measure', measurements: ['behaviour-equivalence'], target: { kind: 'function', path: 'src/pricing.ts', name: 'total', startLine: 1 } },
    ...over,
  });
}

function proposePacket(constraints: readonly Constraint[], validators: readonly ValidatorId[]): GovernancePacket {
  return proposePacketWith({ readable: ['src/**'], proposable: ['src/pricing.ts'], mayPropose: true }, constraints, validators);
}

function proposePacketWith(
  allowed: { readable: readonly string[]; proposable: readonly string[]; mayPropose: boolean },
  constraints: readonly Constraint[],
  validators: readonly ValidatorId[],
): GovernancePacket {
  return buildPacket({
    evidence: [{ origin: 'measurement', text: 'total() has 9 ways through; the limit is 5.', source: 'complexity' }],
    classification: { failureClass: 'source', condition: 'over-limit', confidence: 'classified', label: 'source' },
    objective: 'propose',
    allowed: { readable: [...allowed.readable], proposable: [...allowed.proposable], mayPropose: allowed.mayPropose },
    constraints: [...constraints],
    validators: [...validators],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: { kind: 're-measure', measurements: ['behaviour-equivalence'], target: { kind: 'function', path: 'src/pricing.ts', name: 'total', startLine: 1 } },
    runner: 'vitest',
    headline: 'Break total() into smaller pieces without changing what it does.',
    known: ['total() has 9 ways through it, and your limit is 5.'],
    offers: ['fix'],
  });
}

/** A surface that records absolutely everything that reached the person. */
function watchful(): SurfacePort & { everything: string[] } {
  const everything: string[] = [];
  return {
    everything,
    progress: (l) => everything.push(l),
    markdown: (t) => everything.push(t),
    anchor: (p) => everything.push(p),
    button: (t, h) => everything.push(`${t}:${h}`),
    log: (l) => everything.push(l),
  } as SurfacePort & { everything: string[] };
}

/**
 * The three layers standing between an unscoped propose interaction and a
 * model, each tested where it actually refuses.
 *
 * These three tests used to reach rule 94's prerequisite gate by handing the
 * governed path a packet carrying standing C3 with its empty allow list.
 * **M21 closed that route**, and closed it with something better: a packet
 * may no longer supply C3 at all, and reconciliation binds it from
 * `allowed.proposable`, which `buildPacket` already refuses to leave empty on
 * a propose packet. The guarantee these tests protect is unchanged, so they
 * are rewritten to the layer that now holds it rather than deleted.
 */
test('layer 1: a propose packet with no scope cannot be built', () => {
  reset();
  assert.throws(
    () => proposePacketWith({ readable: ['src/**'], proposable: [], mayPropose: true }, [STANDING_CONSTRAINTS.C4], ['V-forbidden-paths']),
    /must say which paths a proposal may touch/,
  );
  reset();
});

test('layer 2: an empty scope refuses at reconciliation, before the model, and accuses nobody', async () => {
  reset();
  const spec = proposeSpec({ constraints: ['C3', 'C4'], validators: ['V-scope-paths', 'V-forbidden-paths'] });
  const good = proposePacket([STANDING_CONSTRAINTS.C4], ['V-scope-paths', 'V-forbidden-paths']);
  // Hand-built, because `buildPacket` refuses this at layer 1. An effective
  // set can be assembled from any object shaped like a packet, so the
  // refusal has to hold here too.
  const unscoped = { ...good, allowed: { ...good.allowed, proposable: Object.freeze([]) } } as unknown as GovernancePacket;
  const m = model(['{"kind":"propose","changeSet":[],"claims":{"perEdit":[]}}']);
  const s = watchful();

  await assert.rejects(() => runGovernedInteraction(spec, unscoped, { model: m, surface: s }), /is not a narrow scope, it is no scope/);

  assert.equal(m.sent.length, 0, 'zero model calls: the person does not pay to discover this');
  assert.deepEqual(s.everything, [], 'and no authorization question, no progress line, nothing');
  assert.equal(/violat/i.test('is no scope'), false, 'nothing is accused of violating anything');
  reset();
});

test('layer 3: the prerequisite failure is reported as missing, never as a C3 violation', () => {
  reset();
  // The one route left to rule 94's gate for this constraint: an effective
  // set built directly, without coming through the reconciler. It is
  // reachable, so it is still checked, and the distinction rule 94's second
  // clause exists for is still the thing being asserted.
  const spec = proposeSpec({ constraints: ['C3', 'C4'], validators: ['V-scope-paths', 'V-forbidden-paths'] });
  const packet = proposePacket([STANDING_CONSTRAINTS.C4], ['V-scope-paths', 'V-forbidden-paths']);
  const effective = {
    interactionId: spec.id,
    packetId: packet.id,
    constraints: Object.freeze([STANDING_CONSTRAINTS.C3, STANDING_CONSTRAINTS.C4]),
    required: Object.freeze(['C3', 'C4'] as const),
    conditional: Object.freeze([]),
    validators: Object.freeze(['V-scope-paths', 'V-forbidden-paths'] as const),
  } as unknown as EffectiveConstraints;

  let caught: unknown;
  try {
    requirePrerequisites(spec, packet, effective, { repository: memoryRepository('/project', {}) });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof PrerequisiteError, 'a prerequisite failure, not a validation result');
  const missing = (caught as PrerequisiteError).missing;
  assert.equal(missing.length, 1);
  assert.equal(missing[0].validator, 'V-scope-paths');
  assert.deepEqual([...missing[0].constraints], ['C3'], 'it names which constraint it could not decide');
  assert.match(missing[0].missing, /scope/, 'and what was missing');
  assert.match((caught as Error).message, /cannot be checked/);
  assert.equal(/violat/i.test((caught as Error).message), false, 'nothing is accused of violating anything');
  reset();
});

test('no capability is issued for an interaction that cannot be checked', async () => {
  reset();
  const spec = proposeSpec({ constraints: ['C3', 'C4'], validators: ['V-scope-paths', 'V-forbidden-paths'] });
  const good = proposePacket([STANDING_CONSTRAINTS.C4], ['V-scope-paths', 'V-forbidden-paths']);
  const unscoped = { ...good, allowed: { ...good.allowed, proposable: Object.freeze([]) } } as unknown as GovernancePacket;
  await assert.rejects(() => runGovernedInteraction(spec, unscoped, { model: model([]), surface: watchful() }));
  // A capability is one use and short-lived, and none should exist at all.
  // Issuing one for an interaction that never ran would leave a redeemable
  // permission lying around for something nobody checked.
  assert.equal(capabilityIsLive('anything'), false);
  reset();
});

test('a propose interaction with no repository refuses before the model', async () => {
  reset();
  const spec = proposeSpec({ constraints: ['C2', 'C4'], validators: ['V-public-contract', 'V-forbidden-paths', 'V-response-shape'] });
  const packet = proposePacket([STANDING_CONSTRAINTS.C2, STANDING_CONSTRAINTS.C4], ['V-public-contract', 'V-forbidden-paths', 'V-response-shape']);
  const m = model([]);

  let caught: unknown;
  try {
    await runGovernedInteraction(spec, packet, { model: m, surface: watchful() });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof PrerequisiteError);
  assert.equal(m.sent.length, 0);
  // Every missing prerequisite, not the first. Somebody assembling an
  // interaction should see the whole list rather than peel them off one per
  // run, the way `validateSpec` already reports every fault.
  const missing = (caught as PrerequisiteError).missing;
  assert.ok(missing.length >= 2, `both V-response-shape and V-public-contract need it: ${missing.map((x) => x.validator).join(', ')}`);
  assert.ok(missing.every((x) => /repository|parser/.test(x.missing)));
  reset();
});

test('an explain interaction needs neither, so the gate is silent for failure.explain', async () => {
  reset();
  const spec = liveSpec();
  const packet = livePacket();
  const good = JSON.stringify({
    kind: 'explain',
    whatIsWrong: 'The project path has an apostrophe in it.',
    whyItHappened: 'Angular wrote it into generated code without escaping it.',
    howToFix: 'Move the project.',
    whatNotToChange: ['Your own path-handling code.'],
    citedEvidence: [0],
  });
  const outcome = await runGovernedInteraction(spec, packet, { model: model([good]), surface: watchful() });
  assert.equal(outcome.kind, 'explained', 'the gate must be inert where nothing needs a facility');
  reset();
});

// ---------------------------------------------------------------------------
// Rule 94, during validation
// ---------------------------------------------------------------------------

const PRICING = 'export function total(a: number, b: number): number {\n  return a + b;\n}\n';

function proposeAnswer(edits: unknown[]): string {
  return JSON.stringify({ kind: 'propose', changeSet: edits, claims: { perEdit: [] } });
}

test('a file unreadable only while validating is invalid/evidence, one send, no correction', async () => {
  reset();
  const spec = proposeSpec({ constraints: ['C4'], validators: ['V-forbidden-paths', 'V-response-shape'] });
  const packet = proposePacket([STANDING_CONSTRAINTS.C4], ['V-forbidden-paths', 'V-response-shape']);
  // The file is present, so nothing is knowable before the model, and
  // unreadable, so the fault only appears while checking the answer.
  const repository = memoryRepository('/project', { 'src/pricing.ts': UNREADABLE });
  const m = model([proposeAnswer([{ path: 'src/pricing.ts', operation: 'modify', before: 'a + b', after: 'a + b + 0' }])]);
  const s = watchful();

  const outcome = await runGovernedInteraction(spec, packet, {
    model: m,
    surface: s,
    repository,
    authorization: grant(spec, packet),
  });

  assert.equal(outcome.kind, 'abandoned');
  if (outcome.kind !== 'abandoned') {
    return;
  }
  assert.equal(outcome.cause, 'evidence');
  assert.equal(m.sent.length, 1, 'exactly one send: the model cannot make our file readable, so it is not asked again');
  assert.deepEqual([...outcome.record.validators.filter((v) => v.verdict === 'fail')], [], 'and nothing is accused');
  const invalid = outcome.record.validators.filter((v) => v.verdict === 'invalid');
  assert.ok(invalid.length >= 1);
  assert.ok(invalid.every((v) => v.cause === 'evidence'));
  assert.ok(invalid.every((v) => v.constraint === undefined), 'an evidence failure names no constraint');
  reset();
});

test('the person is told Polyglot could not check, not that the assistant failed', async () => {
  reset();
  const spec = proposeSpec({ constraints: ['C4'], validators: ['V-forbidden-paths', 'V-response-shape'] });
  const packet = proposePacket([STANDING_CONSTRAINTS.C4], ['V-forbidden-paths', 'V-response-shape']);
  const repository = memoryRepository('/project', { 'src/pricing.ts': UNREADABLE });
  const s = watchful();
  await runGovernedInteraction(spec, packet, {
    model: model([proposeAnswer([{ path: 'src/pricing.ts', operation: 'modify', before: 'a + b', after: 'a + b + 0' }])]),
    surface: s,
    repository,
    authorization: grant(spec, packet),
  });
  const said = s.everything.join('\n');
  assert.match(said, /could not check this change against your files/);
  assert.equal(/did not hold to the limits/.test(said), false, 'blaming the model for our unreadable file would send them off to try a different one');
  reset();
});

test('a proposal whose before does not match the file is the model\'s fault, and gets its one correction', async () => {
  reset();
  const spec = proposeSpec({ constraints: ['C4'], validators: ['V-forbidden-paths', 'V-response-shape'] });
  const packet = proposePacket([STANDING_CONSTRAINTS.C4], ['V-forbidden-paths', 'V-response-shape']);
  const repository = memoryRepository('/project', { 'src/pricing.ts': PRICING });
  const m = model([
    proposeAnswer([{ path: 'src/pricing.ts', operation: 'modify', before: 'this text is not in the file', after: 'x' }]),
    proposeAnswer([{ path: 'src/pricing.ts', operation: 'modify', before: 'still not in the file', after: 'x' }]),
  ]);

  const outcome = await runGovernedInteraction(spec, packet, { model: m, surface: watchful(), repository, authorization: grant(spec, packet) });
  assert.equal(outcome.kind, 'abandoned');
  assert.equal(m.sent.length, 2, 'a response fault is correctable, so it earns the one correction');
  if (outcome.kind === 'abandoned') {
    assert.equal(outcome.cause, 'response');
  }
  reset();
});

test('the record distinguishes a violation, an unusable answer, and missing evidence', async () => {
  reset();

  // 1. A proven constraint violation.
  const specA = proposeSpec({ constraints: ['C4'], validators: ['V-forbidden-paths', 'V-response-shape'] });
  const packetA = proposePacket([STANDING_CONSTRAINTS.C4], ['V-forbidden-paths', 'V-response-shape']);
  const violation = await runGovernedInteraction(specA, packetA, {
    model: model([
      proposeAnswer([{ path: '.keepsafe/notes.md', operation: 'create', after: 'x' }]),
      proposeAnswer([{ path: '.keepsafe/notes.md', operation: 'create', after: 'x' }]),
    ]),
    surface: watchful(),
    repository: memoryRepository('/project', { 'src/pricing.ts': PRICING }),
    authorization: grant(specA, packetA),
  });
  reset();

  // 2. An unusable answer.
  const specB = proposeSpec({ constraints: ['C4'], validators: ['V-forbidden-paths', 'V-response-shape'] });
  const packetB = proposePacket([STANDING_CONSTRAINTS.C4], ['V-forbidden-paths', 'V-response-shape']);
  const unusable = await runGovernedInteraction(specB, packetB, {
    model: model(['not json', 'still not json']),
    surface: watchful(),
    repository: memoryRepository('/project', { 'src/pricing.ts': PRICING }),
    authorization: grant(specB, packetB),
  });
  reset();

  // 3. Evidence that could not be obtained.
  const specC = proposeSpec({ constraints: ['C4'], validators: ['V-forbidden-paths', 'V-response-shape'] });
  const packetC = proposePacket([STANDING_CONSTRAINTS.C4], ['V-forbidden-paths', 'V-response-shape']);
  const unchecked = await runGovernedInteraction(specC, packetC, {
    model: model([proposeAnswer([{ path: 'src/pricing.ts', operation: 'modify', before: 'a + b', after: 'x' }])]),
    surface: watchful(),
    repository: memoryRepository('/project', { 'src/pricing.ts': UNREADABLE }),
    authorization: grant(specC, packetC),
  });

  for (const o of [violation, unusable, unchecked]) {
    assert.equal(o.kind, 'abandoned');
  }
  if (violation.kind !== 'abandoned' || unusable.kind !== 'abandoned' || unchecked.kind !== 'abandoned') {
    return;
  }

  assert.equal(violation.cause, 'constraints');
  assert.deepEqual([...violation.record.validators.filter((v) => v.verdict === 'fail').map((v) => v.constraint)], ['C4']);
  assert.deepEqual([...violation.record.validators.filter((v) => v.verdict === 'invalid')], [], 'a violation is not an invalid');

  assert.equal(unusable.cause, 'response');
  assert.deepEqual([...unusable.record.validators.filter((v) => v.verdict === 'fail')], [], 'an unusable answer is not a violation');
  assert.ok(unusable.record.validators.some((v) => v.verdict === 'invalid' && v.cause === 'response'));

  assert.equal(unchecked.cause, 'evidence');
  assert.deepEqual([...unchecked.record.validators.filter((v) => v.verdict === 'fail')], [], 'missing evidence is not a violation');
  assert.ok(unchecked.record.validators.some((v) => v.verdict === 'invalid' && v.cause === 'evidence'));

  // And none of the three is mistaken for another.
  assert.equal(new Set([violation.cause, unusable.cause, unchecked.cause]).size, 3);
  reset();
});

test('abandonment carries the real problems, not an empty list', async () => {
  reset();
  const spec = proposeSpec({ constraints: ['C4'], validators: ['V-forbidden-paths', 'V-response-shape'] });
  const packet = proposePacket([STANDING_CONSTRAINTS.C4], ['V-forbidden-paths', 'V-response-shape']);
  const outcome = await runGovernedInteraction(spec, packet, {
    model: model([
      proposeAnswer([{ path: '.keepsafe/notes.md', operation: 'create', after: 'x' }]),
      proposeAnswer([{ path: '.keepsafe/notes.md', operation: 'create', after: 'x' }]),
    ]),
    surface: watchful(),
    repository: memoryRepository('/project', {}),
    authorization: grant(spec, packet),
  });
  assert.equal(outcome.kind, 'abandoned');
  if (outcome.kind === 'abandoned') {
    // A4: this used to be empty for the ordinary abandonment, which is
    // exactly when it most needs to say what went wrong.
    assert.ok(outcome.problems.length > 0);
    assert.ok(outcome.problems.some((p) => /\.keepsafe/.test(p)));
  }
  reset();
});

test('V-scope-paths keeps its backstop, and the governed path never reaches it', () => {
  reset();
  // Called directly, with no scope. A validator is a public function and one
  // that answered "pass" here would be a loaded gun in the public surface.
  const outcome = validatorFor('V-scope-paths').run({
    // The packet is scaffolding here and cannot carry C3, per M21. The
    // unbound C3 is handed to the validator directly, which is exactly the
    // caller this backstop exists for.
    packet: proposePacket([STANDING_CONSTRAINTS.C4], ['V-scope-paths', 'V-forbidden-paths']),
    constraints: [STANDING_CONSTRAINTS.C3],
    response: { kind: 'propose', changeSet: [{ path: 'src/pricing.ts', operation: 'create', after: 'x' }] },
  });
  assert.equal(outcome.verdict, 'invalid');
  if (outcome.verdict === 'invalid') {
    assert.equal(outcome.cause, 'evidence');
  }
  reset();
});

// ---------------------------------------------------------------------------
// Safe fallback, and the authorization boundary under validation
// ---------------------------------------------------------------------------

test('an abandoned interaction changes no project file and keeps no proposal', async () => {
  reset();
  const spec = proposeSpec({ constraints: ['C4'], validators: ['V-forbidden-paths', 'V-response-shape'] });
  const packet = proposePacket([STANDING_CONSTRAINTS.C4], ['V-forbidden-paths', 'V-response-shape']);

  const before = { 'src/pricing.ts': PRICING, 'src/billing.ts': 'export const rate = 1;\n' };
  const repository = memoryRepository('/project', before);
  const s = watchful();
  const kept: string[] = [];

  const outcome = await runGovernedInteraction(spec, packet, {
    model: model([
      proposeAnswer([{ path: '.keepsafe/notes.md', operation: 'create', after: 'x' }]),
      proposeAnswer([{ path: '.keepsafe/notes.md', operation: 'create', after: 'x' }]),
    ]),
    surface: s,
    repository,
    authorization: grant(spec, packet),
    keepProposal: () => {
      kept.push('a handle was made');
      return 'handle';
    },
  });

  assert.equal(outcome.kind, 'abandoned');

  // The invariant that matters, over the files it is about. Every source
  // file and every path the change set named, byte for byte.
  for (const [p, text] of Object.entries(before)) {
    const now = repository.read(p);
    assert.equal(now.ok, true);
    if (now.ok) {
      assert.equal(now.text, text, `${p} is byte-identical`);
    }
  }
  assert.equal(repository.read('.keepsafe/notes.md').ok, false, 'and the proposed target was never created');

  assert.deepEqual(kept, [], 'no proposal is kept, so no later command can find one to show');
  assert.equal(
    s.everything.some((e) => e.includes('handle')),
    false,
    'and no button reaches the person',
  );
  reset();
});

test('an abandoned interaction still records that it happened', async () => {
  reset();
  const spec = proposeSpec({ constraints: ['C4'], validators: ['V-forbidden-paths', 'V-response-shape'] });
  const packet = proposePacket([STANDING_CONSTRAINTS.C4], ['V-forbidden-paths', 'V-response-shape']);
  const outcome = await runGovernedInteraction(spec, packet, {
    model: model([
      proposeAnswer([{ path: '.keepsafe/notes.md', operation: 'create', after: 'MARKER-IN-THE-ANSWER' }]),
      proposeAnswer([{ path: '.keepsafe/notes.md', operation: 'create', after: 'MARKER-IN-THE-ANSWER' }]),
    ]),
    surface: watchful(),
    repository: memoryRepository('/project', { 'src/pricing.ts': PRICING }),
    authorization: grant(spec, packet),
  });
  assert.equal(outcome.kind, 'abandoned');
  if (outcome.kind !== 'abandoned') {
    return;
  }
  // Governance and log effects are allowed. What is not allowed is the
  // record holding what was said.
  assert.equal(outcome.record.accepted, false);
  assert.equal(outcome.record.corrections, 1);
  assert.ok(outcome.record.constraintIds.includes('C4'));
  assert.equal(JSON.stringify(outcome.record).includes('MARKER-IN-THE-ANSWER'), false, 'rule 70: no response body reaches the record');
  reset();
});

test('nothing the model wrote is rendered when validation fails', async () => {
  reset();
  const spec = proposeSpec({ constraints: ['C4'], validators: ['V-forbidden-paths', 'V-response-shape'] });
  const packet = proposePacket([STANDING_CONSTRAINTS.C4], ['V-forbidden-paths', 'V-response-shape']);
  const s = watchful();
  await runGovernedInteraction(spec, packet, {
    model: model([
      proposeAnswer([{ path: '.keepsafe/notes.md', operation: 'create', after: 'MARKER-ONE' }]),
      proposeAnswer([{ path: '.keepsafe/notes.md', operation: 'create', after: 'MARKER-TWO' }]),
    ]),
    surface: s,
    repository: memoryRepository('/project', {}),
    authorization: grant(spec, packet),
  });
  const said = s.everything.join('\n');
  assert.equal(said.includes('MARKER-ONE'), false, 'not from the first answer');
  assert.equal(said.includes('MARKER-TWO'), false, 'nor from the second');
  reset();
});

test('an earlier yes does not authorize a wider change', async () => {
  reset();
  // The scope the person was shown is the scope that binds. A response that
  // edits outside it is refused however enthusiastically they agreed.
  //
  // The scope arrives as **standing C3, bound at reconciliation** from the
  // packet's `allowed.proposable`. Until M21 closed, this test had to use a
  // condition constraint instead, because a spec requiring C3 and a packet
  // carrying a scoped C3 were refused by rule 93: `assertSameMeaning`
  // compared the rules and read a filled-in parameter as a changed meaning.
  // It is now the production shape, and the behaviour proved is the same as
  // it always was: the boundary binds and the yes does not widen it.
  const spec = proposeSpec({ constraints: ['C3', 'C4'], validators: ['V-scope-paths', 'V-forbidden-paths', 'V-response-shape'] });
  const packet = proposePacket([STANDING_CONSTRAINTS.C4], ['V-scope-paths', 'V-forbidden-paths', 'V-response-shape']);
  const authorization = grant(spec, packet);
  assert.equal(authorization.granted, true, 'the person said yes');

  const outcome = await runGovernedInteraction(spec, packet, {
    model: model([
      proposeAnswer([{ path: 'src/billing.ts', operation: 'modify', before: 'rate', after: 'rate2' }]),
      proposeAnswer([{ path: 'src/billing.ts', operation: 'modify', before: 'rate', after: 'rate3' }]),
    ]),
    surface: watchful(),
    repository: memoryRepository('/project', { 'src/pricing.ts': PRICING, 'src/billing.ts': 'export const rate = 1;\n' }),
    authorization,
  });

  assert.equal(outcome.kind, 'abandoned', 'a granted authorization does not rescue a failed validation');
  if (outcome.kind === 'abandoned') {
    assert.equal(outcome.cause, 'constraints');
    assert.ok(outcome.record.validators.some((v) => v.verdict === 'fail' && v.constraint === 'C3'));
    assert.equal(outcome.record.authorization?.granted, true, 'and the record shows they agreed, which changed nothing');
  }
  reset();
});

/**
 * M21, closed, and the refusal that replaced it.
 *
 * The old shape of this test asserted that a packet carrying a scoped C3 was
 * refused with `does not mean what C3 means`. That refusal was correct about
 * the rule and wrong about the cause: C3's standing definition is a template
 * with an empty list rather than a meaning, so rule 93 read a filled-in
 * parameter as a changed meaning and no production propose interaction could
 * be registered at all.
 *
 * It is **replaced rather than deleted**, per A2. The subject is the same,
 * the reason is sharper, and there was no window in between where nothing
 * held the line: a packet still may not supply its own C3, because
 * reconciliation owns that binding and two sources for one scope is one
 * source too many.
 */
test('M21: a packet may not supply a bound parameterised standing constraint', () => {
  reset();
  const scopedC3: Constraint = Object.freeze({
    ...STANDING_CONSTRAINTS.C3,
    rule: Object.freeze({ kind: 'paths-confined-to', allow: Object.freeze(['src/pricing.ts']) }),
  }) as Constraint;

  // Refused when the packet is built, before anything can be reconciled.
  assert.throws(
    () => proposePacket([scopedC3, STANDING_CONSTRAINTS.C4], ['V-scope-paths', 'V-forbidden-paths']),
    /bound from allowed\.proposable/,
  );
  reset();
});

/**
 * And refused again at reconciliation, for the case where the packet did not
 * come through `buildPacket`. Belt and braces, because an effective set can
 * be assembled from any object shaped like a packet.
 */
test('M21: reconciliation refuses a packet-supplied C3 too', () => {
  reset();
  const spec = proposeSpec({ constraints: ['C3', 'C4'], validators: ['V-scope-paths', 'V-forbidden-paths'] });
  const good = proposePacket([STANDING_CONSTRAINTS.C4], ['V-scope-paths', 'V-forbidden-paths']);
  const smuggled = {
    ...good,
    constraints: [
      Object.freeze({ ...STANDING_CONSTRAINTS.C3, rule: Object.freeze({ kind: 'paths-confined-to', allow: Object.freeze(['src/pricing.ts']) }) }),
      STANDING_CONSTRAINTS.C4,
    ],
  } as unknown as GovernancePacket;
  assert.throws(() => reconcileConstraints(spec, smuggled), /Reconciliation owns that binding/);
  reset();
});

/**
 * The binding itself, which is what M21 actually needed: a spec that requires
 * C3 and a packet that does not carry it now reconcile, and the effective C3
 * carries the paths the person will be shown.
 */
test('M21: C3 is bound from the packet, and it is the same C3', () => {
  reset();
  const spec = proposeSpec({ constraints: ['C3', 'C4'], validators: ['V-scope-paths', 'V-forbidden-paths'] });
  const packet = proposePacket([STANDING_CONSTRAINTS.C4], ['V-scope-paths', 'V-forbidden-paths']);
  const effective = reconcileConstraints(spec, packet);

  const c3 = effective.constraints.find((c) => c.id === 'C3')!;
  assert.ok(c3, 'C3 is in the effective set');
  assert.equal(c3.rule.kind, 'paths-confined-to');
  assert.deepEqual(c3.rule.kind === 'paths-confined-to' ? c3.rule.allow : [], ['src/pricing.ts'], 'bound from allowed.proposable and nowhere else');

  // Identity is untouched. This is the difference between an instance and a
  // redefinition, and it is the whole of M21's argument.
  assert.equal(c3.id, STANDING_CONSTRAINTS.C3.id);
  assert.equal(c3.prose, STANDING_CONSTRAINTS.C3.prose);
  assert.equal(c3.decidedBy, STANDING_CONSTRAINTS.C3.decidedBy);
  reset();
});

/**
 * Two differently scoped instances, distinguishable without two meanings.
 */
test('M21: two scopes, two instances, one meaning', () => {
  reset();
  const spec = proposeSpec({ constraints: ['C3', 'C4'], validators: ['V-scope-paths', 'V-forbidden-paths'] });
  const one = proposePacket([STANDING_CONSTRAINTS.C4], ['V-scope-paths', 'V-forbidden-paths']);
  const other = { ...one, allowed: { ...one.allowed, proposable: Object.freeze(['src/billing.ts']) } } as unknown as GovernancePacket;

  const a = reconcileConstraints(spec, one).constraints.find((c) => c.id === 'C3')!;
  const b = reconcileConstraints(spec, other).constraints.find((c) => c.id === 'C3')!;

  assert.deepEqual(a.rule.kind === 'paths-confined-to' ? a.rule.allow : [], ['src/pricing.ts']);
  assert.deepEqual(b.rule.kind === 'paths-confined-to' ? b.rule.allow : [], ['src/billing.ts']);
  assert.equal(a.prose, b.prose, 'the same sentence reaches the model and the person');
  assert.equal(a.decidedBy, b.decidedBy, 'the same validator decides both');
  reset();
});

/**
 * The registry's contents, asserted, so a second entry cannot be added
 * quietly and `paths-forbidden`'s absence stays deliberate.
 */
test('M21: exactly one rule kind carries an instance parameter', () => {
  assert.deepEqual(Object.keys(PARAMETER_BINDINGS), ['paths-confined-to']);
  assert.equal(PARAMETER_BINDINGS['paths-confined-to']!.field, 'allow');
  assert.equal(PARAMETER_BINDINGS['paths-confined-to']!.from, 'allowed.proposable');
  // C4's deny list is what C4 means. Its absence here is the reason a
  // redefined C4 still fails rule 93, and it is asserted rather than assumed.
  assert.equal(PARAMETER_BINDINGS['paths-forbidden'], undefined);
  assert.equal(bindingFor(STANDING_CONSTRAINTS.C4.rule), undefined);
});

/**
 * Binding refuses to produce an unbound instance. The second of the three
 * layers between an unscoped propose interaction and a model.
 */
test('M21: an empty scope is no scope, and it is refused', () => {
  reset();
  const spec = proposeSpec({ constraints: ['C3', 'C4'], validators: ['V-scope-paths', 'V-forbidden-paths'] });
  const good = proposePacket([STANDING_CONSTRAINTS.C4], ['V-scope-paths', 'V-forbidden-paths']);
  const empty = { ...good, allowed: { ...good.allowed, proposable: Object.freeze([]) } } as unknown as GovernancePacket;
  assert.throws(() => reconcileConstraints(spec, empty), /is not a narrow scope, it is no scope/);
  reset();
});

// ---------------------------------------------------------------------------
// M16: the scope the person authorized is the scope that binds
// ---------------------------------------------------------------------------

test('M16: the bound allow equals the packet\'s proposable list', () => {
  reset();
  const spec = proposeSpec({ constraints: ['C3', 'C4'], validators: ['V-scope-paths', 'V-forbidden-paths'] });
  const packet = proposePacketWith(
    { readable: ['src/**'], proposable: ['src/pricing.ts', 'src/pricing.test.ts'], mayPropose: true },
    [STANDING_CONSTRAINTS.C4],
    ['V-scope-paths', 'V-forbidden-paths'],
  );
  const effective = reconcileConstraints(spec, packet);
  const c3 = effective.constraints.find((c) => c.id === 'C3')!;
  assert.deepEqual(c3.rule.kind === 'paths-confined-to' ? [...c3.rule.allow] : [], [...packet.allowed.proposable]);
});

test('M16: the brief shows the list the validator enforces', () => {
  reset();
  const spec = proposeSpec({ constraints: ['C3', 'C4'], validators: ['V-scope-paths', 'V-forbidden-paths'] });
  const packet = proposePacketWith(
    { readable: ['src/**'], proposable: ['src/pricing.ts', 'src/pricing.test.ts'], mayPropose: true },
    [STANDING_CONSTRAINTS.C4],
    ['V-scope-paths', 'V-forbidden-paths'],
  );
  const effective = reconcileConstraints(spec, packet);
  const brief = authorizationBrief(packet, spec, effective);
  const c3 = effective.constraints.find((c) => c.id === 'C3')!;
  assert.deepEqual([...brief.mayChange], c3.rule.kind === 'paths-confined-to' ? [...c3.rule.allow] : [], 'one list, shown and enforced');
});

/**
 * A divergent second source is refused in the reconciler, with zero model
 * calls, no brief and no capability. Today there is only one source, so the
 * divergence has to be constructed; that is the point. This assertion is what
 * a later change introducing a second source would have to defeat.
 */
test('M16: a scope that is enforced and a scope that is displayed cannot be two lists', async () => {
  reset();
  const spec = proposeSpec({ constraints: ['C3', 'C4'], validators: ['V-scope-paths', 'V-forbidden-paths'] });
  const packet = proposePacket([STANDING_CONSTRAINTS.C4], ['V-scope-paths', 'V-forbidden-paths']);
  // A packet whose proposable list reports one thing to the binding and
  // another to the brief: exactly the silent failure M16 exists to prevent.
  let reads = 0;
  const twoFaced = {
    ...packet,
    allowed: {
      ...packet.allowed,
      get proposable(): readonly string[] {
        reads += 1;
        return reads === 1 ? ['src/pricing.ts'] : ['src/pricing.ts', 'src/billing.ts'];
      },
    },
  } as unknown as GovernancePacket;

  const m = model(['{"kind":"propose","changeSet":[],"claims":{"perEdit":[]}}']);
  const s = watchful();
  await assert.rejects(
    () => runGovernedInteraction(spec, twoFaced, { model: m, surface: s, repository: memoryRepository('/project', {}) }),
    /cannot be two lists/,
  );
  assert.equal(m.sent.length, 0, 'no model call');
  assert.deepEqual(s.everything, [], 'no brief, nothing on the surface');
  assert.equal(capabilityIsLive('anything'), false, 'and no capability');
  reset();
});
