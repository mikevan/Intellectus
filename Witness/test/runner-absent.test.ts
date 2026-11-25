/**
 * Runner identity is conditional evidence, not a mandatory fact.
 *
 * A packet's `runner` says which runner produced the failure, so it may only
 * ever hold one that did. Some failures happen before a runner is selected at
 * all: an environment gate refusing, or an exception thrown before the run
 * begins. Those carry no runner, and the packet says that rather than filling
 * the field with `auto`, an empty string, the language's name, the tool's own
 * name, or the word `unknown`. Every one of those is a value standing where a
 * measurement should be, in the one record whose whole point is that
 * everything in it was measured.
 *
 * What must not change is the other half: a packet built after a run still
 * carries the concrete runner that ran, and nothing about the existing
 * path-character or instrumentation packets moves.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { buildFailureBrief, instrumentationFailure, toProblemPacket, unclassifiedGovernancePacket, unclassifiedPacket, upstreamPathFailure } from '../src/index';
import { NO_AUTHORIZATION_NEEDED, NOTHING_TO_VERIFY, ONE_CORRECTION, buildPrompt, clearRegistryForTests, reconcileConstraints, registerInteraction } from '../src/index';
import type { GovernancePacket, InteractionSpec } from '../src/index';

/**
 * The prompt is rendered through a registered interaction, because that is
 * the only way it is ever rendered. The fixture is an `explain` interaction
 * with no constraints of its own, so what shows up in the text is the
 * packet's.
 */
function governedPrompt(packet: GovernancePacket): string {
  clearRegistryForTests();
  const spec = registerInteraction({
    id: 'O-RUNNER-FIXTURE',
    tool: 'DeepTest',
    title: 'A fixture interaction, registered only by this test.',
    objective: 'explain',
    allowed: { readable: [], proposable: [], mayPropose: false },
    constraints: ['C4'],
    validators: ['V-forbidden-paths', 'V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: NO_AUTHORIZATION_NEEDED,
    verification: NOTHING_TO_VERIFY,
  } as unknown as InteractionSpec);
  return buildPrompt(packet, spec, reconcileConstraints(spec, packet)).text;
}

const NASTY = "C:\\workspace\\MikeVan's AI Development Toolkit\\app";
const ANGULAR_OUTPUT = [
  'Application bundle generation failed. [2.378 seconds]',
  '✘ [ERROR] Expected ";" but found "s"',
  "      1 │ import 'C:/workspace/MikeVan's AI Development Toolkit/app/polyfills.js';",
].join('\n');

/** Every shape a fabricated runner would take, in one place. */
const FABRICATIONS = ['auto', '', 'unknown', 'Unknown', 'none', 'n/a', 'TypeScript', 'JavaScript', 'Python', 'DeepTest', 'UntangleIt', 'Polyglot'];

// ---------------------------------------------------------------------------
// 1. A packet created after execution still carries the actual runner
// ---------------------------------------------------------------------------

test('a failure after a run carries the concrete runner that ran', () => {
  const packet = unclassifiedGovernancePacket({ runner: 'ng-karma', evidence: ['exit code 1'] });
  assert.equal(packet.runner, 'ng-karma');
  assert.match(packet.headline, /^ng-karma failed/);
  assert.deepEqual(packet.known, ['ng-karma did not finish successfully.']);
  assert.equal(packet.evidence[0].origin, 'runner-output', 'it came out of the runner, and is labelled as that');
  assert.equal(packet.evidence[0].source, 'ng-karma');
});

// ---------------------------------------------------------------------------
// 2. A pre-run packet carries no runner identity
// ---------------------------------------------------------------------------

test('a failure before a runner was selected carries no runner, and no stand-in', () => {
  const packet = unclassifiedGovernancePacket({ runner: undefined, evidence: ['Jest is not installed.'] });
  assert.equal(packet.runner, undefined, 'absent');
  assert.equal(Object.prototype.hasOwnProperty.call(packet, 'runner'), false, 'and absent as a key, not present and empty');
  for (const bad of FABRICATIONS) {
    assert.notEqual(packet.runner as unknown, bad, `${bad || '<empty string>'} is not a runner that ran`);
  }
});

test('a packet with no runner says so, in the words the person reads', () => {
  const packet = unclassifiedGovernancePacket({ runner: undefined, evidence: ['Jest is not installed.'] });
  assert.equal(packet.headline, 'The check could not start, and the toolkit could not work out why.');
  assert.deepEqual(packet.known, ['The failure happened before a test runner was selected, so no runner ran.']);
  assert.equal(packet.classification.failureClass, 'insufficient-evidence');
  assert.equal(packet.classification.confidence, 'unclassified');
});

test('with no runner there is no runner output, and the evidence is labelled for what it is', () => {
  const packet = unclassifiedGovernancePacket({ runner: undefined, evidence: ['Jest is not installed.'] });
  assert.equal(packet.evidence[0].origin, 'observation', 'the toolkit observed it; no runner produced it');
  assert.equal(packet.evidence[0].source, 'witness');
  assert.equal(packet.evidence[0].text, 'Jest is not installed.', 'and the text is carried, not rewritten');
});

// ---------------------------------------------------------------------------
// 3. Serialization does not invent a runner
// ---------------------------------------------------------------------------

test('a packet with no runner serializes without a runner key', () => {
  const packet = unclassifiedGovernancePacket({ runner: undefined, evidence: ['Jest is not installed.'] });
  const json = JSON.stringify(packet);
  assert.doesNotMatch(json, /"runner"/, 'no key, so nothing can read a value out of it');
  const back = JSON.parse(json) as GovernancePacket;
  assert.equal(back.runner, undefined);
});

test('the 1.0.19 view does not fill the field in either', () => {
  const view = toProblemPacket(unclassifiedGovernancePacket({ runner: undefined, evidence: ['Jest is not installed.'] }));
  assert.equal(view.runner, undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(view, 'runner'), false);
  assert.doesNotMatch(JSON.stringify(view), /"runner"/);
  // And the same view built from a packet that has one still carries it.
  assert.equal(toProblemPacket(unclassifiedGovernancePacket({ runner: 'vitest', evidence: ['x'] })).runner, 'vitest');
  assert.equal(unclassifiedPacket({ runner: undefined, evidence: ['x'] }).runner, undefined);
});

test('the packet id is stable and does not depend on a missing key being present', () => {
  const a = unclassifiedGovernancePacket({ runner: undefined, evidence: ['Jest is not installed.'] });
  const b = unclassifiedGovernancePacket({ runner: undefined, evidence: ['Jest is not installed.'] });
  assert.equal(a.id, b.id, 'the same facts give the same id');
  assert.notEqual(a.id, unclassifiedGovernancePacket({ runner: 'vitest', evidence: ['Jest is not installed.'] }).id, 'and a runner changes it');
});

// ---------------------------------------------------------------------------
// 4. Rendering prints neither `undefined` nor a fabricated substitute
// ---------------------------------------------------------------------------

test('the 1.0.19 brief states the absence instead of printing undefined', () => {
  const brief = buildFailureBrief(unclassifiedPacket({ runner: undefined, evidence: ['Jest is not installed.'] }));
  assert.doesNotMatch(brief, /undefined/, 'never');
  assert.doesNotMatch(brief, /Runner or framework:\s*$/m, 'and never an empty label');
  assert.match(brief, /- Runner or framework: none\. The failure happened before a test runner was selected\./);
});

test('the governed prompt states the absence too, and the same way', () => {
  const prompt = governedPrompt(unclassifiedGovernancePacket({ runner: undefined, evidence: ['Jest is not installed.'] }));
  assert.doesNotMatch(prompt, /undefined/);
  assert.doesNotMatch(prompt, /Runner or framework:\s*$/m);
  assert.match(prompt, /- Runner or framework: none\. The failure happened before a test runner was selected\./);
});

test('both renderers still print a runner that is there', () => {
  const withRunner = unclassifiedGovernancePacket({ runner: 'ng-karma', evidence: ['exit code 1'] });
  assert.match(buildFailureBrief(toProblemPacket(withRunner)), /- Runner or framework: ng-karma/);
  assert.match(governedPrompt(withRunner), /- Runner or framework: ng-karma/);
});

// ---------------------------------------------------------------------------
// 5. The existing packets are unchanged
// ---------------------------------------------------------------------------

test('the path-character packet is unchanged: it still names its runner everywhere', () => {
  const shown = upstreamPathFailure({ workspaceRoot: NASTY, runner: 'ng-karma', output: ANGULAR_OUTPUT, succeeded: false })!;
  assert.equal(shown.governed.runner, "Angular's unit-test builder with Karma");
  assert.equal(shown.packet.runner, "Angular's unit-test builder with Karma");
  assert.equal(shown.governed.classification.failureClass, 'toolchain');
  assert.equal(shown.governed.classification.condition, 'path-character');
  assert.equal(shown.governed.classification.confidence, 'classified');
  assert.ok(shown.governed.context.some((c) => c.name === 'Runner'), 'and still carries it as context');
  assert.match(governedPrompt(shown.governed), /- Runner or framework: Angular's unit-test builder with Karma/);
});

test('the M6 packet is unchanged: it still requires and carries a runner', () => {
  const packet = instrumentationFailure({
    runner: 'vitest',
    evidence: { testsFinished: 4, testsRecorded: 4, recordsWithEvidence: 4, filesWithHits: 2, brokenBoundaries: 1, reconcilable: true },
    sentence: 'a test was cut off',
  })!;
  assert.equal(packet.runner, 'vitest');
  assert.equal(packet.classification.failureClass, 'polyglot');
  assert.equal(packet.classification.condition, 'broken-boundary');
  assert.match(governedPrompt(packet), /- Runner or framework: vitest/);
});
