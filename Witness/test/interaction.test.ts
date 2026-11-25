/**
 * The governed sequence, 1.0.21 Phase 3.
 *
 * Rule 23 puts these in an order, and every test here is about the order
 * rather than about any single step working. A product can have a packet, a
 * prompt, validators, and a record, run them in the wrong sequence, and be
 * ungoverned while every part of it passes its own test.
 *
 * The four that matter: nothing the model wrote reaches the person before
 * validation passed; a second failure renders none of it at all; the person
 * authorizes before the model is asked, not after it has answered; and the
 * verdict never consults the authorization.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  ModelUnavailable,
  NOTHING_TO_VERIFY,
  NO_AUTHORIZATION_NEEDED,
  ONE_CORRECTION,
  PATH_CONSTRAINTS,
  STANDING_CONSTRAINTS,
  USER_AUTHORIZES_ATTEMPT,
  authorizationBrief,
  authorizationEvent,
  buildPacket,
  clearCapabilitiesForTests,
  clearRegistryForTests,
  modelFailureSentence,
  reconcileConstraints,
  registerInteraction,
  runGovernedInteraction,
} from '../src/index';
import type { GovernancePacket, InteractionSpec, ModelPort, PacketInput, SurfacePort } from '../src/index';

// ---------------------------------------------------------------------------
// Ports that record what happened to them
// ---------------------------------------------------------------------------

interface Recorded {
  progress: string[];
  markdown: string[];
  anchors: string[];
  buttons: Array<{ title: string; handle: string }>;
  log: string[];
}

function surface(): SurfacePort & { recorded: Recorded } {
  const recorded: Recorded = { progress: [], markdown: [], anchors: [], buttons: [], log: [] };
  return {
    recorded,
    progress: (l) => recorded.progress.push(l),
    markdown: (t) => recorded.markdown.push(t),
    anchor: (p) => recorded.anchors.push(p),
    button: (title, handle) => recorded.buttons.push({ title, handle }),
    log: (l) => recorded.log.push(l),
  };
}

function model(answers: string[] | (() => never)): ModelPort & { sent: string[] } {
  const sent: string[] = [];
  return {
    id: 'the-model-the-user-picked',
    vendor: 'copilot',
    sent,
    async send(prompt: string): Promise<string> {
      sent.push(prompt);
      if (typeof answers === 'function') {
        answers();
      }
      const next = (answers as string[]).shift();
      if (next === undefined) {
        throw new Error('the model was asked more times than the test allows');
      }
      return next;
    },
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GOOD_EXPLAIN = JSON.stringify({
  kind: 'explain',
  whatIsWrong: 'The project path has an apostrophe in it.',
  whyItHappened: 'Angular wrote the path into generated code without escaping it.',
  howToFix: 'Move the project somewhere without one.',
  whatNotToChange: ['Your own path-handling code.'],
  citedEvidence: [0],
});

function explainPacket(over: Partial<PacketInput> = {}): GovernancePacket {
  return buildPacket({
    evidence: [{ origin: 'runner-output', text: 'Application bundle generation failed.', source: 'ng test' }],
    classification: { failureClass: 'toolchain', condition: 'path-character', confidence: 'classified', label: 'toolchain path handling' },
    objective: 'explain',
    allowed: { readable: [], proposable: [], mayPropose: false },
    constraints: PATH_CONSTRAINTS,
    validators: ['V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: NO_AUTHORIZATION_NEEDED,
    verification: NOTHING_TO_VERIFY,
    runner: "Angular's unit-test builder with Karma",
    headline: 'It could not start.',
    known: ['The path holds an apostrophe.'],
    remediation: ['Move the project.'],
    offers: ['explain'],
    ...over,
  });
}

function explainSpec(): InteractionSpec {
  return registerInteraction({
    id: 'failure.explain',
    tool: 'DeepTest',
    title: 'Explain a run that failed before the tests started.',
    objective: 'explain',
    allowed: { readable: [], proposable: [], mayPropose: false },
    constraints: ['X-PATH-1'],
    validators: ['V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: NO_AUTHORIZATION_NEEDED,
    verification: NOTHING_TO_VERIFY,
  });
}

function proposePacket(): GovernancePacket {
  return buildPacket({
    evidence: [{ origin: 'measurement', text: 'total() has 9 ways through; the limit is 5.', source: 'complexity' }],
    classification: { failureClass: 'source', condition: 'over-limit', confidence: 'classified', label: 'source' },
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: ['src/pricing.ts'], mayPropose: true },
    constraints: [STANDING_CONSTRAINTS.C4],
    validators: ['V-forbidden-paths'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: { kind: 're-measure', measurements: ['behaviour-equivalence'], target: { kind: 'function', path: 'src/pricing.ts', name: 'total', startLine: 1 } },
    runner: 'vitest',
    headline: 'Break total() into smaller pieces without changing what it does.',
    known: ['total() has 9 ways through it, and your limit is 5.'],
    offers: ['fix'],
  });
}

function proposeSpec(): InteractionSpec {
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
  });
}

function reset(): void {
  clearRegistryForTests();
  clearCapabilitiesForTests();
}

// ---------------------------------------------------------------------------

test('an explanation reaches the person only after it has been validated', async () => {
  reset();
  const spec = explainSpec();
  const s = surface();
  const m = model([GOOD_EXPLAIN]);
  const out = await runGovernedInteraction(spec, explainPacket(), { model: m, surface: s });

  assert.equal(out.kind, 'explained');
  assert.equal(m.sent.length, 1);
  assert.equal(s.recorded.progress.length, 1, 'one progress line, ours');
  assert.doesNotMatch(s.recorded.progress[0], /apostrophe/, 'and it carries none of the model\'s words');
  assert.equal(s.recorded.markdown.length, 1, 'and exactly one render, after validation');
  assert.match(s.recorded.markdown[0], /The project path has an apostrophe/);
  assert.match(s.recorded.markdown[0], /What not to change/);
  reset();
});

/**
 * Rules 43 and 44. This is the one that would be invisible in production: a
 * response that failed validation, shown anyway, looks like help.
 */
test('a response that fails validation twice is never shown', async () => {
  reset();
  const spec = proposeSpec();
  const packet = proposePacket();
  const brief = authorizationBrief(packet, spec, reconcileConstraints(spec, packet));
  const authorization = authorizationEvent(brief, true, 'mike');

  const touchesKeepSafe = JSON.stringify({
    kind: 'propose',
    changeSet: [{ path: '.keepsafe/checkpoints/1.json', operation: 'create', after: 'MODEL_TEXT_9c2f' }],
    claims: { perEdit: [{ path: '.keepsafe/checkpoints/1.json', respects: ['C4'] }] },
  });
  const s = surface();
  const m = model([touchesKeepSafe, touchesKeepSafe]);
  const out = await runGovernedInteraction(spec, packet, { model: m, surface: s, authorization });

  assert.equal(out.kind, 'abandoned');
  assert.equal(m.sent.length, 2, 'one correction, then stop');
  assert.match(m.sent[1], /\[C4\]/, 'and the correction carries the constraint that failed');

  const everything = [...s.recorded.markdown, ...s.recorded.anchors, ...s.recorded.buttons.map((b) => b.handle)].join('\n');
  assert.equal(everything.includes('MODEL_TEXT_9c2f'), false, 'nothing the model wrote reaches the person');
  assert.equal(everything.includes('.keepsafe'), false);
  assert.equal(s.recorded.buttons.length, 0, 'and no control is offered for a proposal that failed');
  assert.match(s.recorded.markdown.join('\n'), /did not hold to the limits/);
  assert.equal(out.kind === 'abandoned' && out.record.accepted, false, 'the record says so too');
  reset();
});

/** A third request is never made. */
test('two failures end the interaction and a third request is never sent', async () => {
  reset();
  const spec = proposeSpec();
  const packet = proposePacket();
  const authorization = authorizationEvent(authorizationBrief(packet, spec, reconcileConstraints(spec, packet)), true, 'mike');
  const bad = JSON.stringify({ kind: 'propose', changeSet: [{ path: '.keepsafe/x', operation: 'create', after: 'x' }], claims: {} });
  const m = model([bad, bad, bad]);
  await runGovernedInteraction(spec, packet, { model: m, surface: surface(), authorization });
  assert.equal(m.sent.length, 2);
  reset();
});

// ---------------------------------------------------------------------------
// Authorization comes first
// ---------------------------------------------------------------------------

/**
 * Rules 23 and 92. The check sits before the capability is issued, so a
 * caller cannot reach the model and ask the person afterwards.
 */
test('a consequential interaction will not run without an authorization', async () => {
  reset();
  const spec = proposeSpec();
  const packet = proposePacket();
  const m = model([JSON.stringify({ kind: 'propose', changeSet: [], claims: {} })]);

  await assert.rejects(() => runGovernedInteraction(spec, packet, { model: m, surface: surface() }), /authorized the attempt/);
  assert.equal(m.sent.length, 0, 'and the model was never asked');

  const declined = authorizationEvent(authorizationBrief(packet, spec, reconcileConstraints(spec, packet)), false, 'mike');
  await assert.rejects(() => runGovernedInteraction(spec, packet, { model: m, surface: surface(), authorization: declined }), /was not authorized/);
  assert.equal(m.sent.length, 0);
  reset();
});

/**
 * An authorization for a different brief is not an authorization for this
 * one. Otherwise a packet could be swapped after the person answered, and
 * they would have agreed to something else.
 */
test('an authorization only covers the brief the person actually read', async () => {
  reset();
  const spec = proposeSpec();
  const packet = proposePacket();
  const other = buildPacket({
    evidence: [{ origin: 'measurement', text: 'something else entirely', source: 'complexity' }],
    classification: { failureClass: 'source', condition: 'other', confidence: 'classified', label: 'source' },
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: ['src/other.ts'], mayPropose: true },
    constraints: [STANDING_CONSTRAINTS.C4],
    validators: ['V-forbidden-paths'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: { kind: 're-measure', measurements: ['behaviour-equivalence'], target: { kind: 'function', path: 'src/pricing.ts', name: 'total', startLine: 1 } },
    runner: 'vitest',
    headline: 'Do something quite different.',
    known: ['A different measurement.'],
    offers: ['fix'],
  });
  const forOther = authorizationEvent(authorizationBrief(other, spec, reconcileConstraints(spec, other)), true, 'mike');
  const m = model([JSON.stringify({ kind: 'propose', changeSet: [], claims: {} })]);
  await assert.rejects(() => runGovernedInteraction(spec, packet, { model: m, surface: surface(), authorization: forOther }), /different brief/);
  assert.equal(m.sent.length, 0);
  reset();
});

/** An explanation changes nothing, so it needs no authorization and asks for none. */
test('an explanation runs without an authorization event', async () => {
  reset();
  const spec = explainSpec();
  const out = await runGovernedInteraction(spec, explainPacket(), { model: model([GOOD_EXPLAIN]), surface: surface() });
  assert.equal(out.kind, 'explained');
  reset();
});

// ---------------------------------------------------------------------------
// A validated proposal, and where the text does not go
// ---------------------------------------------------------------------------

test('a validated proposal names its files and hides its text behind a handle', async () => {
  reset();
  const spec = proposeSpec();
  const packet = proposePacket();
  const authorization = authorizationEvent(authorizationBrief(packet, spec, reconcileConstraints(spec, packet)), true, 'mike');
  const good = JSON.stringify({
    kind: 'propose',
    changeSet: [{ path: 'src/pricing.ts', operation: 'modify', before: 'old', after: 'PROPOSED_TEXT_5e1a' }],
    claims: { perEdit: [{ path: 'src/pricing.ts', respects: ['C4'] }] },
  });
  const s = surface();
  let kept = 0;
  const out = await runGovernedInteraction(spec, packet, {
    model: model([good]),
    surface: s,
    authorization,
    keepProposal: () => {
      kept += 1;
      return 'opaque-handle-1';
    },
  });

  assert.equal(out.kind, 'proposed');
  assert.equal(kept, 1, 'only a validated proposal is kept');
  assert.deepEqual(s.recorded.anchors, ['src/pricing.ts'], 'the affected file is named');
  assert.deepEqual(s.recorded.buttons, [{ title: 'Show me the change', handle: 'opaque-handle-1' }]);

  const shown = [...s.recorded.markdown, ...s.recorded.buttons.map((b) => `${b.title} ${b.handle}`)].join('\n');
  assert.equal(shown.includes('PROPOSED_TEXT_5e1a'), false, 'the proposed text is not written into the chat and not put in the button');
  assert.match(s.recorded.markdown.join('\n'), /does not apply it for you/, 'and the person is told we do not apply it');
  reset();
});

/** Rule 64. Refusing is a correct answer, and is reported as one. */
test('a refusal is an outcome, not a failure', async () => {
  reset();
  const spec = proposeSpec();
  const packet = proposePacket();
  const authorization = authorizationEvent(authorizationBrief(packet, spec, reconcileConstraints(spec, packet)), true, 'mike');
  const refused = JSON.stringify({ kind: 'propose', changeSet: [], refusal: { reason: 'The limits do not allow touching the only file that would need to change.' }, claims: {} });
  const s = surface();
  const out = await runGovernedInteraction(spec, packet, { model: model([refused]), surface: s, authorization });
  assert.equal(out.kind, 'refused');
  assert.match(s.recorded.markdown.join('\n'), /did not propose a change/);
  assert.equal(s.recorded.buttons.length, 0);
  reset();
});

// ---------------------------------------------------------------------------
// The model is unavailable in flight
// ---------------------------------------------------------------------------

/** Rule 39, corrected: the trigger is a failing send, not a missing field. */
test('an in-flight model failure stops, says the real condition, and changes nothing', async () => {
  reset();
  const spec = explainSpec();
  for (const [code, expected] of [
    ['NoPermissions', /has not given Polyglot permission/],
    ['Blocked', /declined this request, or the quota is spent/],
    ['NotFound', /Choose another one in the VS Code model picker/],
    ['Whatever', /VS Code reported:/],
  ] as const) {
    const s = surface();
    const failing: ModelPort = {
      id: 'the-model-the-user-picked',
      send: async () => {
        throw new ModelUnavailable(code, 'the provider said no');
      },
    };
    const out = await runGovernedInteraction(spec, explainPacket(), { model: failing, surface: s });
    assert.equal(out.kind, 'model-unavailable');
    assert.match(s.recorded.markdown.join('\n'), expected);
    assert.match(s.recorded.markdown.join('\n'), /Nothing was changed/);
  }

  // And no sentence offers a different model, because Polyglot does not choose one.
  for (const code of ['NoPermissions', 'Blocked', 'NotFound', 'Whatever']) {
    const sentence = modelFailureSentence(code, 'x');
    assert.doesNotMatch(sentence, /we (will )?(use|try|pick|switch)/i, 'Polyglot never substitutes a model');
  }
  reset();
});
