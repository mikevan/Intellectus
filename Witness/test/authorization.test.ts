/**
 * The authorization boundary, 1.0.21 Phase 3.
 *
 * Rule 92 is the rule these tests hold, and it is the one with a person on
 * the other end of it. Polyglot is built for people who may not be able to
 * read the code. If the product ever slides back into showing them a diff and
 * treating the click as sign-off, it has made them the engineering validator
 * and will blame them for a defect they could not have seen. Every assertion
 * below exists because of a specific way that slide could happen quietly.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  AuthorizationError,
  CapabilityError,
  NOTHING_TO_VERIFY,
  NO_AUTHORIZATION_NEEDED,
  ONE_CORRECTION,
  STANDING_CONSTRAINTS,
  USER_AUTHORIZES_ATTEMPT,
  authorizationBrief,
  authorizationEvent,
  briefLines,
  buildPacket,
  buildRecord,
  buildPrompt,
  buildValidationResult,
  capabilityIsLive,
  clearCapabilitiesForTests,
  clearRegistryForTests,
  issueInteraction,
  redeemInteraction,
  reconcileConstraints,
  registerInteraction,
} from '../src/index';
import * as api from '../src/index';
import type { InteractionSpec, PacketInput } from '../src/index';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function proposeInput(over: Partial<PacketInput> = {}): PacketInput {
  return {
    evidence: [{ origin: 'measurement', text: 'total() has 9 ways through; the limit is 5.', source: 'complexity' }],
    classification: { failureClass: 'source', condition: 'over-limit', confidence: 'classified', label: 'source' },
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: ['src/pricing.ts'], mayPropose: true },
    constraints: [STANDING_CONSTRAINTS.C4, STANDING_CONSTRAINTS.C1],
    validators: ['V-forbidden-paths', 'V-existing-tests'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: { kind: 're-measure', measurements: ['behaviour-equivalence'], target: { kind: 'function', path: 'src/pricing.ts', name: 'total', startLine: 1 } },
    runner: 'vitest',
    headline: 'Break total() into smaller pieces without changing what it does.',
    known: ['total() has 9 ways through it, and your limit is 5.'],
    offers: ['fix'],
    ...over,
  };
}

function proposeSpec(over: Partial<InteractionSpec> = {}): Record<string, unknown> {
  return {
    id: 'fixture.propose',
    tool: 'UntangleIt',
    title: 'A fixture proposal, registered only by tests.',
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: ['src/pricing.ts'], mayPropose: true },
    constraints: ['C4', 'C1'],
    validators: ['V-forbidden-paths', 'V-existing-tests'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: { kind: 're-measure', measurements: ['behaviour-equivalence'], target: { kind: 'function', path: 'src/pricing.ts', name: 'total', startLine: 1 } },
    ...over,
  } as Record<string, unknown>;
}

function explainSpec(): Record<string, unknown> {
  return {
    id: 'fixture.explain',
    tool: 'DeepTest',
    title: 'A fixture explanation.',
    objective: 'explain',
    allowed: { readable: [], proposable: [], mayPropose: false },
    constraints: ['C4'],
    validators: ['V-forbidden-paths'],
    correction: ONE_CORRECTION,
    authorization: NO_AUTHORIZATION_NEEDED,
    verification: NOTHING_TO_VERIFY,
  } as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// The five points
// ---------------------------------------------------------------------------

/**
 * Rule 92's five points, all of them, every time. A brief with four is a
 * question with a hole in it, and the record would show the person agreed.
 */
test('the authorization brief carries all five points, from the packet', () => {
  clearRegistryForTests();
  const spec = registerInteraction(proposeSpec());
  const packet = buildPacket(proposeInput());
  const brief = authorizationBrief(packet, spec, reconcileConstraints(spec, packet));

  assert.deepEqual([...brief.measured], ['total() has 9 ways through it, and your limit is 5.'], '1. what was measured, from the packet\'s own established facts');
  assert.equal(brief.outcome, 'Break total() into smaller pieces without changing what it does.', '2. what outcome is attempted');
  assert.deepEqual([...brief.mayChange], ['src/pricing.ts'], '3. what may change');
  // 4. What must not change, grouped by what Polyglot can prove. The count
  //    across the three groups is what matters: every constraint that binds
  //    the attempt reaches the person, in one group or another, and none is
  //    dropped between here and them.
  const told = [...brief.mustNotChange.checked, ...brief.mustNotChange.partlyChecked.map((p) => p.prose), ...brief.mustNotChange.statedOnly];
  assert.equal(told.length, 2, '4. what must not change, every constraint accounted for');
  assert.ok(told.some((c) => /\.keepsafe/.test(c)), 'and the constraints travel by their own prose');
  assert.match(brief.verification, /returns or throws at the places we watch/, '5. what will be measured afterwards, and only what is really measured');

  const lines = briefLines(brief).join('\n');
  for (const heading of ['What we found', 'What we want to try', 'What may change', 'What must not change', 'How we will check afterwards']) {
    assert.ok(lines.includes(heading), `the person reads ${heading}`);
  }
  clearRegistryForTests();
});

/** A point that cannot be made is refused, never filled in from nothing. */
test('a packet that cannot make one of the five points is refused', () => {
  clearRegistryForTests();
  const spec = registerInteraction(proposeSpec());

  const noOutcome = buildPacket(proposeInput({ known: [], headline: '' }));
  assert.throws(() => authorizationBrief(noOutcome, spec, reconcileConstraints(spec, noOutcome)), AuthorizationError, 'no outcome, no attempt to authorize');

  // An explain interaction has nothing to authorize at all, and putting a
  // consent question in front of somebody for an explanation trains them to
  // click through the ones that matter.
  const explain = registerInteraction(explainSpec());
  const explainPacket = buildPacket({
    ...proposeInput(),
    objective: 'explain',
    allowed: { readable: [], proposable: [], mayPropose: false },
    authorization: NO_AUTHORIZATION_NEEDED,
    verification: NOTHING_TO_VERIFY,
    constraints: [STANDING_CONSTRAINTS.C4],
    validators: ['V-forbidden-paths'],
  });
  assert.throws(() => authorizationBrief(explainPacket, explain, reconcileConstraints(explain, explainPacket)), /nothing for a person to authorize/);
  clearRegistryForTests();
});

/**
 * The question is about the attempt. This is the sentence the whole rule
 * exists to protect, so it is asserted rather than left to good intentions.
 */
test('the brief asks about the attempt, never about the code', () => {
  clearRegistryForTests();
  const spec = registerInteraction(proposeSpec());
  const brief = authorizationBrief(buildPacket(proposeInput()), spec, reconcileConstraints(spec, buildPacket(proposeInput())));
  const text = briefLines(brief).join('\n');

  assert.match(brief.question, /attempt this change/);
  assert.doesNotMatch(text, /\bdiff\b/i, 'no diff is mentioned, so reading one cannot become a precondition');
  assert.doesNotMatch(text, /approve this code|is this code correct|review the code|looks? (right|correct)/i, 'and nothing asks them to judge an implementation');
  assert.ok(text.includes('If it does not hold, we will say the attempt failed.'), 'the fifth point commits us to reporting the result, which is what makes the bounded attempt bounded');
  clearRegistryForTests();
});

// ---------------------------------------------------------------------------
// The authorization event
// ---------------------------------------------------------------------------

/** Rule 70 and rule 92. The event proves what was asked, not what was written. */
test('an authorization event carries the answer and no source code', () => {
  clearRegistryForTests();
  const spec = registerInteraction(proposeSpec());
  const packet = buildPacket(
    proposeInput({
      evidence: [{ origin: 'measurement', text: 'MARKER_EVIDENCE_b41d', source: 'complexity' }],
      known: ['MARKER_MEASURED_77ac'],
      headline: 'MARKER_OUTCOME_02fe',
    }),
  );
  const brief = authorizationBrief(packet, spec, reconcileConstraints(spec, packet));
  const event = authorizationEvent(brief, true, 'mike', '2026-09-23T00:00:00.000Z');

  assert.equal(event.granted, true);
  assert.equal(event.by, 'mike');
  assert.equal(event.briefDigest, brief.digest, 'the record can later show which five points were put to them');
  assert.equal(event.briefDigest.length, 64, 'a digest, not the text');

  const serialized = JSON.stringify(event);
  for (const marker of ['MARKER_EVIDENCE_b41d', 'MARKER_MEASURED_77ac', 'MARKER_OUTCOME_02fe']) {
    assert.equal(serialized.includes(marker), false, `${marker} must not reach the authorization event`);
  }
  assert.ok(JSON.stringify(brief).includes('MARKER_MEASURED_77ac'), 'the marker really was in the brief, or this proves nothing');

  // And the same holds once it is in the governance record.
  const record = buildRecord({
    spec,
    packet,
    prompt: buildPrompt(packet, spec, reconcileConstraints(spec, packet)),
    rawResponse: '{}',
    validation: buildValidationResult(spec.id, [{ id: 'V-forbidden-paths', verdict: 'pass' }]),
    corrections: 0,
    model: { id: 'the-model-the-user-picked' },
    authorization: { granted: event.granted, at: event.at, by: event.by, briefDigest: event.briefDigest },
    at: '2026-09-23T00:00:00.000Z',
  });
  const recorded = JSON.stringify(record);
  for (const marker of ['MARKER_EVIDENCE_b41d', 'MARKER_MEASURED_77ac', 'MARKER_OUTCOME_02fe']) {
    assert.equal(recorded.includes(marker), false, `${marker} must not reach the governance record either`);
  }
  assert.equal(record.authorization?.by, 'mike');
  assert.equal(record.authorization?.briefDigest, brief.digest);
  clearRegistryForTests();
});

/**
 * Rule 92's last clause. An authorized attempt that fails is a failed
 * attempt. The authorization is not an input to the verdict, and the type
 * system says so: nothing in a `ValidationResult` can hold one.
 */
test('an authorization is never an input to the verdict', () => {
  const failed = buildValidationResult('fixture.propose', [{ id: 'V-forbidden-paths', verdict: 'fail', constraint: 'C4', because: 'it touched .keepsafe' }]);
  assert.equal(failed.accepted, false, 'and no argument exists that could soften it');
  assert.equal('authorization' in failed, false);
  assert.equal('granted' in failed, false);
  assert.equal('approvedBy' in failed, false);
});

// ---------------------------------------------------------------------------
// The interaction capability
// ---------------------------------------------------------------------------

/** Rule 49. The transport cannot manufacture permission for itself. */
test('a capability comes only from a registered spec and a built packet', () => {
  clearRegistryForTests();
  clearCapabilitiesForTests();
  const unregistered = { ...(proposeSpec() as unknown as InteractionSpec) };
  const packet = buildPacket(proposeInput());
  assert.throws(() => issueInteraction(unregistered, packet), CapabilityError, 'an unregistered interaction has no objective, no constraints, and no validators');

  const spec = registerInteraction(proposeSpec());
  const capability = issueInteraction(spec, packet);
  assert.equal(capability.kind, 'interaction');
  assert.equal(capability.interactionId, 'fixture.propose');
  assert.equal(capability.packetId, packet.id);
  assert.ok(capability.value.length >= 32, 'opaque, and not guessable');

  const explain = registerInteraction(explainSpec());
  assert.throws(() => issueInteraction(explain, packet), /One of them is wrong/, 'a spec and a packet that disagree on the objective are not guessed at');
  clearRegistryForTests();
  clearCapabilitiesForTests();
});

/** One use, so a leaked or replayed value buys nothing. */
test('a capability is spent on redemption and cannot be replayed', () => {
  clearRegistryForTests();
  clearCapabilitiesForTests();
  const spec = registerInteraction(proposeSpec());
  const capability = issueInteraction(spec, buildPacket(proposeInput()));

  assert.equal(capabilityIsLive(capability.value), true);
  const first = redeemInteraction(capability.value);
  assert.equal(first.ok, true);
  assert.equal(capabilityIsLive(capability.value), false);

  const second = redeemInteraction(capability.value);
  assert.equal(second.ok, false);
  assert.ok(!second.ok && /already been used/.test(second.why));

  const unknown = redeemInteraction('not a capability this session issued');
  assert.equal(unknown.ok, false);
  assert.ok(!unknown.ok && /not a capability/.test(unknown.why));
  clearRegistryForTests();
  clearCapabilitiesForTests();
});

/**
 * There is one capability kind, and no way to mistake it for permission to
 * write. An earlier design had a second one authorizing application; under
 * the Phase 3 answer to M10 it would have authorized nothing, and a type
 * promising a power the product does not have is worse than no type.
 */
test('there is no capability that authorizes writing to a file', () => {
  for (const name of Object.keys(api)) {
    assert.doesNotMatch(name, /applicationCapability|issueApplication|redeemApplication|applyCapability/i, `${name} would be an apply authorization, and there is deliberately none`);
  }
});

// ---------------------------------------------------------------------------
// The brief tells the truth about what is enforced
// ---------------------------------------------------------------------------

/**
 * After Phase 4 the constraint set mixes protections Polyglot enforces with
 * instructions it merely states. Rendered as one list, a person would read
 * "do not remove code that works around a known limitation" in the same
 * voice as "do not touch anything inside .keepsafe" and conclude Polyglot
 * guarantees both. It guarantees one.
 *
 * Rule 92's principle does not change. This is what keeps it true.
 */
function briefWith(constraints: readonly Constraint[]): ReturnType<typeof authorizationBrief> {
  clearRegistryForTests();
  const spec = registerInteraction({
    id: 'fixture.propose',
    tool: 'UntangleIt',
    title: 'A fixture proposal.',
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: ['src/pricing.ts'], mayPropose: true },
    constraints: constraints.map((c) => c.id),
    // A spec always names at least one validator. `V-response-shape` decides
    // no constraint and is always relevant, so it is the honest floor here.
    validators: [...new Set(['V-response-shape' as const, ...constraints.map((c) => c.decidedBy).filter((v): v is NonNullable<typeof v> => v !== undefined)])],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: { kind: 're-measure', measurements: ['behaviour-equivalence'], target: { kind: 'function', path: 'src/pricing.ts', name: 'total', startLine: 1 } },
  });
  const packet = buildPacket({
    ...proposeInput(),
    constraints: [...constraints],
    validators: [...new Set(['V-response-shape' as const, ...constraints.map((c) => c.decidedBy).filter((v): v is NonNullable<typeof v> => v !== undefined)])],
  });
  return authorizationBrief(packet, spec, reconcileConstraints(spec, packet));
}

test('an enforced protection is presented as one Polyglot checks', () => {
  const brief = briefWith([STANDING_CONSTRAINTS.C4, STANDING_CONSTRAINTS.C1]);
  assert.equal(brief.mustNotChange.checked.length, 1, 'C4 is decided in full');
  // C1 is partly checked since Phase 5, and the brief must say so. A person
  // told "we check this" about a protection with a known residue is being
  // told something slightly untrue, which is what rule 92 is about.
  assert.equal(brief.mustNotChange.partlyChecked.length, 1);
  assert.equal(brief.mustNotChange.statedOnly.length, 0);
  const shown = briefLines(brief).join('\n');
  assert.match(shown, /We will check these, and we will not accept a change that breaks one/);
  clearRegistryForTests();
});

test('a partly enforced protection does not imply full coverage', () => {
  const brief = briefWith([STANDING_CONSTRAINTS.C4, STANDING_CONSTRAINTS.C2]);
  assert.equal(brief.mustNotChange.partlyChecked.length, 1);
  const only = brief.mustNotChange.partlyChecked[0];
  assert.equal(only.prose, STANDING_CONSTRAINTS.C2.prose, 'the person is told the whole protection');
  assert.match(only.gap, /order of side effects/, 'and told which part of it is not checked');

  const shown = briefLines(brief).join('\n');
  assert.match(shown, /We will check part of this/);
  assert.ok(shown.includes(`We cannot check ${only.gap}.`), 'in the person\'s own language, not as a constraint id');
  assert.equal(/C2/.test(shown), false, 'no internal labels reach the person');
  clearRegistryForTests();
});

test('an advisory instruction is never presented as a guarantee', () => {
  const brief = briefWith([STANDING_CONSTRAINTS.C4, STANDING_CONSTRAINTS.C5, STANDING_CONSTRAINTS.C6, STANDING_CONSTRAINTS.C7]);
  assert.deepEqual(
    [...brief.mustNotChange.statedOnly],
    [STANDING_CONSTRAINTS.C5.prose, STANDING_CONSTRAINTS.C6.prose, STANDING_CONSTRAINTS.C7.prose],
  );
  assert.deepEqual([...brief.mustNotChange.checked], [STANDING_CONSTRAINTS.C4.prose]);

  const shown = briefLines(brief).join('\n');
  assert.match(shown, /We have told your assistant these, and we cannot prove it listened/);
  // The three instructions must not appear under the sentence that promises
  // they will be checked.
  const checkedBlock = shown.slice(shown.indexOf('We will check these'), shown.indexOf('We have told your assistant'));
  for (const c of [STANDING_CONSTRAINTS.C5, STANDING_CONSTRAINTS.C6, STANDING_CONSTRAINTS.C7]) {
    assert.equal(checkedBlock.includes(c.prose), false, `${c.id} is not presented as checked`);
  }
  assert.equal(/advisory/i.test(shown), false, 'the distinction is translated, not jargon');
  clearRegistryForTests();
});

test('an attempt whose every protection is unproven is refused, not rendered', () => {
  // Nothing here is enforced, so there is nothing for the person to rely on
  // in agreeing. Asking them anyway would put their yes on a record against
  // promises Polyglot has no way to keep.
  assert.throws(() => briefWith([STANDING_CONSTRAINTS.C5, STANDING_CONSTRAINTS.C6, STANDING_CONSTRAINTS.C7]), /at least one protection that is actually enforced/);
  clearRegistryForTests();
});

test('the digest changes when a protection moves between groups', () => {
  // Two constraints with the same words, one checked and one not. A standing
  // id cannot be used for this, and that is rule 93 working: borrowing C1's
  // id for something that means less is exactly what it refuses.
  const SAME = 'Do not touch anything inside .deeptest, .untangleit, or .keepsafe.';
  const checked: Constraint = Object.freeze({ id: 'X-SAME-1', rule: Object.freeze({ kind: 'paths-forbidden', deny: ['.keepsafe'] }), decidedBy: 'V-forbidden-paths', prose: SAME }) as Constraint;
  const stated: Constraint = Object.freeze({ id: 'X-SAME-1', rule: Object.freeze({ kind: 'advisory', why: 'nothing checks it' }), prose: SAME }) as Constraint;

  const enforced = briefWith([checked]);
  const weakened = briefWith([stated, STANDING_CONSTRAINTS.C4]);
  assert.equal(enforced.mustNotChange.checked.includes(SAME), true);
  assert.equal(weakened.mustNotChange.statedOnly.includes(SAME), true);
  assert.notEqual(enforced.digest, weakened.digest, 'the person agreed to a brief that promised more, so the old yes must not carry');
  clearRegistryForTests();
});

test('the digest changes when the protection wording changes', () => {
  const one: Constraint = Object.freeze({ id: 'X-WORD-1', rule: Object.freeze({ kind: 'paths-forbidden', deny: ['.keepsafe'] }), decidedBy: 'V-forbidden-paths', prose: 'Do not touch the tool folders.' }) as Constraint;
  const two: Constraint = Object.freeze({ ...one, prose: 'Do not touch anything inside .deeptest, .untangleit, or .keepsafe.' }) as Constraint;
  assert.notEqual(briefWith([one]).digest, briefWith([two]).digest);
  clearRegistryForTests();
});

test('point 5 names only what the instrument actually measures', () => {
  const brief = briefWith([STANDING_CONSTRAINTS.C4]);
  assert.match(brief.verification, /returns or throws at the places we watch/);
  // The old sentence claimed Witness records what the code does. It records
  // arguments and one outcome per entry to a watched boundary, and no side
  // effects at all.
  assert.equal(/record what the code does/.test(brief.verification), false);
  clearRegistryForTests();
});
