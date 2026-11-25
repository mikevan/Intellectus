/**
 * The effective constraint set, M19.
 *
 * The invariant: a packet may ADD condition-specific constraints, and it may
 * never omit, weaken, replace, or contradict one its registered interaction
 * requires. The set is established deterministically before prompt
 * construction, authorization, capability issuance, or model access.
 *
 * Why this is a governance invariant rather than a tidiness one. Without it,
 * a measured condition could hand the model a narrower rulebook than the
 * interaction was registered with, and every stage downstream would agree
 * with itself: the prompt would state the weaker set, the person would
 * authorize the weaker set, and the validators would check the weaker set.
 * Nothing would look wrong anywhere. That is the quietest way for governance
 * to stop governing, which is why it fails loudly and fails first.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  NOTHING_TO_VERIFY,
  NO_AUTHORIZATION_NEEDED,
  ONE_CORRECTION,
  PATH_CONSTRAINTS,
  ReconciliationError,
  STANDING_CONSTRAINTS,
  USER_AUTHORIZES_ATTEMPT,
  authorizationBrief,
  briefLines,
  buildPacket,
  buildPrompt,
  clearCapabilitiesForTests,
  clearRegistryForTests,
  reconcileConstraints,
  registerInteraction,
  runGovernedInteraction,
} from '../src/index';
import type { Constraint, GovernancePacket, InteractionSpec, ModelPort, PacketInput, SurfacePort } from '../src/index';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function explainInput(over: Partial<PacketInput> = {}): PacketInput {
  return {
    evidence: [{ origin: 'runner-output', text: 'Application bundle generation failed.', source: 'ng test' }],
    classification: { failureClass: 'toolchain', condition: 'path-character', confidence: 'classified', label: 'toolchain path handling' },
    objective: 'explain',
    allowed: { readable: [], proposable: [], mayPropose: false },
    // The condition's own six, plus the standing one the interaction requires.
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
    ...over,
  };
}

function spec(over: Record<string, unknown> = {}): InteractionSpec {
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
    ...over,
  });
}

function reset(): void {
  clearRegistryForTests();
  clearCapabilitiesForTests();
}

/** A constraint that borrows an id and changes what it means. */
function impostor(id: string, over: Partial<Constraint>): Constraint {
  return Object.freeze({ ...STANDING_CONSTRAINTS.C4, id, ...over }) as Constraint;
}

// ---------------------------------------------------------------------------

/** The legitimate case: two layers, both kept. */
test('a required interaction constraint and the condition\'s own coexist', () => {
  reset();
  const s = spec();
  const packet = buildPacket(explainInput());
  const effective = reconcileConstraints(s, packet);

  assert.deepEqual([...effective.required], ['C4'], 'what the registered interaction always requires');
  assert.deepEqual([...effective.conditional], ['X-PATH-1', 'X-PATH-2', 'X-PATH-3', 'X-PATH-4', 'X-PATH-5', 'X-PATH-6'], 'what this measured condition added');
  assert.equal(effective.constraints.length, 7, 'and the effective set is both');
  assert.equal(effective.constraints[0].id, 'C4', 'required first, so a reader sees the standing protections before the local ones');
  assert.deepEqual([...effective.validators].sort(), ['V-forbidden-paths', 'V-response-shape']);
  reset();
});

/** A required constraint nobody supplies is a protection in name only. */
test('a required interaction constraint that cannot be resolved fails', () => {
  reset();
  const s = spec({ constraints: ['X-NOT-ANYWHERE'] });
  const packet = buildPacket(explainInput());
  assert.throws(() => reconcileConstraints(s, packet), ReconciliationError, 'nothing can supply it');
  assert.throws(() => reconcileConstraints(s, packet), /protection in name only/);
  reset();
});

/**
 * The same stable id meaning two things. A validator names what failed by
 * id, so an id that decides two different things makes every outcome
 * ambiguous, and the governance record would name a constraint nobody could
 * look up.
 */
test('the same constraint id with changed semantics fails', () => {
  reset();
  const s = spec();

  // A weakened rule: C4 with nothing denied.
  const emptyDeny = buildPacket(explainInput({ constraints: [impostor('C4', { rule: { kind: 'paths-forbidden', deny: [] } })] }));
  assert.throws(() => reconcileConstraints(s, emptyDeny), /Its rule differs/);

  // A weakened sentence under the same rule. This is the dangerous one: it
  // would pass validation and mislead the model and the person, which is
  // exactly the harm rule 92 is about.
  const softened = buildPacket(explainInput({ constraints: [impostor('C4', { prose: 'Try to avoid .keepsafe if you can.' })] }));
  assert.throws(() => reconcileConstraints(s, softened), /wording differs/);

  // A different validator deciding it.
  const rerouted = buildPacket(explainInput({ constraints: [impostor('C4', { decidedBy: 'V-response-shape' })], validators: ['V-response-shape', 'V-forbidden-paths'] }));
  assert.throws(() => reconcileConstraints(s, rerouted), /different validator/);
  reset();
});

/** Two constraints that cannot both be obeyed. */
test('a contradictory constraint set fails', () => {
  reset();
  const s = registerInteraction({
    id: 'fixture.propose',
    tool: 'UntangleIt',
    title: 'A fixture proposal.',
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: ['.keepsafe/notes.md'], mayPropose: true },
    constraints: ['C4'],
    validators: ['V-forbidden-paths'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: { kind: 're-measure', measurements: ['behaviour-equivalence'], target: { kind: 'function', path: 'src/pricing.ts', name: 'total', startLine: 1 } },
  });
  // The packet permits changing a file inside the folder C4 forbids. The
  // interaction would tell the model both things at once.
  const packet = buildPacket({
    evidence: [{ origin: 'measurement', text: 'x', source: 'complexity' }],
    classification: { failureClass: 'source', condition: 'over-limit', confidence: 'classified', label: 'source' },
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: ['.keepsafe/notes.md'], mayPropose: true },
    constraints: [STANDING_CONSTRAINTS.C4],
    validators: ['V-forbidden-paths'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: { kind: 're-measure', measurements: ['behaviour-equivalence'], target: { kind: 'function', path: 'src/pricing.ts', name: 'total', startLine: 1 } },
    runner: 'vitest',
    headline: 'Do a thing.',
    known: ['A measurement.'],
    offers: ['fix'],
  });
  assert.throws(() => reconcileConstraints(s, packet), ReconciliationError);
  assert.throws(() => reconcileConstraints(s, packet), /both that it may change this and that it must never touch it/);
  reset();
});

// ---------------------------------------------------------------------------
// One set, three consumers
// ---------------------------------------------------------------------------

/**
 * The prompt and the authorization brief are handed the same reconciled set.
 * Three consumers each combining constraints for themselves is three chances
 * to combine them differently, and the one that drifts is the one nobody is
 * looking at.
 */
test('the prompt and the authorization brief receive the same effective set', () => {
  reset();
  const s = spec({
    id: 'fixture.propose',
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: ['src/pricing.ts'], mayPropose: true },
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: { kind: 're-measure', measurements: ['behaviour-equivalence'], target: { kind: 'function', path: 'src/pricing.ts', name: 'total', startLine: 1 } },
  });
  const packet = buildPacket(
    explainInput({
      objective: 'propose',
      allowed: { readable: ['src/**'], proposable: ['src/pricing.ts'], mayPropose: true },
      authorization: USER_AUTHORIZES_ATTEMPT,
      verification: { kind: 're-measure', measurements: ['behaviour-equivalence'], target: { kind: 'function', path: 'src/pricing.ts', name: 'total', startLine: 1 } },
      headline: 'Break total() into smaller pieces without changing what it does.',
    }),
  );
  const effective = reconcileConstraints(s, packet);

  const prompt = buildPrompt(packet, s, effective).text;
  const brief = authorizationBrief(packet, s, effective);
  const shown = briefLines(brief).join('\n');

  for (const c of effective.constraints) {
    assert.ok(prompt.includes(`[${c.id}] ${c.prose}`), `the model is told ${c.id}`);
    assert.ok(shown.includes(c.prose), `and the person is told ${c.id} in the same words`);
  }
  // The brief groups its protections by what Polyglot can prove, so the
  // comparison is across the three groups. What must hold is that neither
  // set is a subset of the other: every constraint the model was given is
  // one the person was told, and the reverse.
  const told = [...brief.mustNotChange.checked, ...brief.mustNotChange.partlyChecked.map((p) => p.prose), ...brief.mustNotChange.statedOnly];
  assert.equal(told.length, effective.constraints.length, 'neither set is a subset of the other');
  assert.ok(told.includes(STANDING_CONSTRAINTS.C4.prose), 'including the one the registered interaction requires, which the packet-local set alone would have omitted');
  reset();
});

/** A set reconciled for something else is not this interaction's set. */
test('a reconciled set cannot be used with a different packet or interaction', () => {
  reset();
  const s = spec();
  const packet = buildPacket(explainInput());
  const other = buildPacket(explainInput({ headline: 'Something else entirely.' }));
  const effective = reconcileConstraints(s, packet);

  assert.throws(() => buildPrompt(other, s, effective), /reconciled for a different/);
  assert.throws(() => authorizationBrief(other, s, effective), /reconciled for a different/);
  reset();
});

// ---------------------------------------------------------------------------
// It happens first
// ---------------------------------------------------------------------------

/**
 * A governance defect must not cost the person a request against their own
 * model quota, and it must not put a question in front of them that was
 * worked out from a set that does not reconcile.
 */
test('reconciliation fails before any capability is issued or model reached', async () => {
  reset();
  const s = spec({ constraints: ['X-NOT-ANYWHERE'] });
  const packet = buildPacket(explainInput());

  let asked = 0;
  const model: ModelPort = {
    id: 'the-model-the-user-picked',
    send: async () => {
      asked += 1;
      return '{}';
    },
  };
  const written: string[] = [];
  const surface: SurfacePort = {
    progress: (l) => written.push(l),
    markdown: (t) => written.push(t),
    anchor: () => undefined,
    button: () => undefined,
    log: () => undefined,
  };

  await assert.rejects(() => runGovernedInteraction(s, packet, { model, surface }), ReconciliationError);
  assert.equal(asked, 0, 'the model was never asked');
  assert.deepEqual(written, [], 'and nothing reached the person, not even a progress line');
  reset();
});

/** And the packet's own set alone is never what governs. */
test('the effective set is what validation sees, not the packet-local set', () => {
  reset();
  const s = spec();
  const packet: GovernancePacket = buildPacket(explainInput({ constraints: [...PATH_CONSTRAINTS], validators: ['V-response-shape'] }));
  // The packet carries six and lists one validator; the spec requires C4 and
  // lists the validator that decides it. The reconciled answer is seven and
  // two, and that is what every consumer gets.
  const effective = reconcileConstraints(s, packet);
  assert.equal(packet.constraints.length, 6);
  assert.equal(effective.constraints.length, 7);
  assert.ok(effective.constraints.some((c) => c.id === 'C4'));
  assert.deepEqual([...effective.validators].sort(), ['V-forbidden-paths', 'V-response-shape']);
  reset();
});
