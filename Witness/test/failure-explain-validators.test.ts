/**
 * Does `V-response-shape` actually run for `failure.explain`?
 *
 * Part K says both explanation interactions carry `V-forbidden-paths` and
 * `V-response-shape`. Both products register `failure.explain` with
 * `V-forbidden-paths` alone, and have since Phase 3. That looked like a
 * governance gap: Phase 4 gave `V-response-shape` a real body, including the
 * completeness check that refuses a classified explanation resting on no
 * evidence, and an interaction that never reached it would never be checked
 * for that.
 *
 * **The question is factual and this file answers it.** Rule 93's
 * reconciliation takes the union of the spec's validators and the packet's,
 * and the runner iterates the reconciled set rather than the spec's. Every
 * `failure.explain` packet declares `V-response-shape` itself. So it runs,
 * on every condition, and the discrepancy is in the document rather than in
 * the product.
 *
 * The tests below establish that end to end rather than by reading: each
 * condition's real packet goes through the real governed path with a model
 * that returns a real answer, and the answer is accepted or refused by the
 * validator under test.
 */
import { test, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import {
  NOTHING_TO_VERIFY,
  NO_AUTHORIZATION_NEEDED,
  ONE_CORRECTION,
  clearRegistryForTests,
  instrumentationFailure,
  reconcileConstraints,
  registerInteraction,
  runGovernedInteraction,
  unclassifiedGovernancePacket,
  upstreamPathFailure,
} from '../src/index';
import { findingPacket } from '../src/index';
import type { GovernancePacket, InteractionSpec, ModelPort, SurfacePort } from '../src/index';

const NASTY = "C:\\workspace\\MikeVan's AI Development Toolkit\\app";
const ANGULAR_OUTPUT = [
  'Application bundle generation failed. [2.378 seconds]',
  '✘ [ERROR] Expected ";" but found "s"',
  "      1 │ import 'C:/workspace/MikeVan's AI Development Toolkit/app/polyfills.js';",
].join('\n');

/** Exactly what both products register today, unchanged. */
const FAILURE_EXPLAIN_AS_REGISTERED = {
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
} as unknown as InteractionSpec;

/** And what `finding.explain` registers, for the comparison at the end. */
const FINDING_EXPLAIN_AS_REGISTERED = {
  ...(FAILURE_EXPLAIN_AS_REGISTERED as unknown as Record<string, unknown>),
  id: 'finding.explain',
  title: 'Explain a finding a completed measurement produced.',
  validators: ['V-forbidden-paths', 'V-response-shape'],
} as unknown as InteractionSpec;

function surface(): SurfacePort {
  return { progress: () => undefined, markdown: () => undefined, anchor: () => undefined, button: () => undefined, log: () => undefined };
}

function model(answer: string): ModelPort {
  return { id: 'the-model-the-user-picked', vendor: 'copilot', send: async () => answer };
}

const explanation = (citedEvidence: number[]): string =>
  JSON.stringify({
    kind: 'explain',
    whatIsWrong: 'Something stopped the run.',
    whyItHappened: 'The evidence says what, and no more.',
    howToFix: null,
    whatNotToChange: ['Your own path handling.'],
    citedEvidence,
  });

const pathCharacter = (): GovernancePacket => upstreamPathFailure({ workspaceRoot: NASTY, runner: 'ng-karma', output: ANGULAR_OUTPUT, succeeded: false })!.governed;
const unclassified = (): GovernancePacket => unclassifiedGovernancePacket({ runner: 'vitest', evidence: ['exit code 1'] });
const polyglot = (): GovernancePacket =>
  instrumentationFailure({ runner: 'vitest', evidence: { testsFinished: 4, testsRecorded: 4, recordsWithEvidence: 4, filesWithHits: 2, brokenBoundaries: 1, reconcilable: true }, sentence: 'a test was cut off' })!;

const CONDITIONS: ReadonlyArray<{ name: string; packet: () => GovernancePacket; classified: boolean }> = [
  { name: 'path-character', packet: pathCharacter, classified: true },
  { name: 'unclassified', packet: unclassified, classified: false },
  { name: 'broken-boundary', packet: polyglot, classified: true },
];

beforeEach(() => {
  clearRegistryForTests();
});

// ---------------------------------------------------------------------------
// 1. What the interaction registers
// ---------------------------------------------------------------------------

test('failure.explain registers one validator, and it is not V-response-shape', () => {
  const spec = registerInteraction(FAILURE_EXPLAIN_AS_REGISTERED);
  assert.deepEqual([...spec.validators], ['V-forbidden-paths'], 'this is the registration both products have had since Phase 3');
});

// ---------------------------------------------------------------------------
// 2. What the effective set holds after rule 93 reconciles
// ---------------------------------------------------------------------------

test('every failure.explain condition puts V-response-shape into the effective set itself', () => {
  const spec = registerInteraction(FAILURE_EXPLAIN_AS_REGISTERED);
  for (const { name, packet } of CONDITIONS) {
    const p = packet();
    assert.ok(p.validators.includes('V-response-shape'), `${name}: the packet declares it`);
    const effective = reconcileConstraints(spec, p);
    assert.ok(effective.validators.includes('V-response-shape'), `${name}: and it is in the reconciled set`);
    assert.ok(effective.validators.includes('V-forbidden-paths'), `${name}: beside the one the spec requires`);
  }
});

test('the reconciled set is the union of the two, which is the mechanism', () => {
  const spec = registerInteraction(FAILURE_EXPLAIN_AS_REGISTERED);
  const effective = reconcileConstraints(spec, pathCharacter());
  assert.deepEqual([...effective.validators].sort(), ['V-forbidden-paths', 'V-response-shape'], 'spec first, then whatever the condition brought');
});

// ---------------------------------------------------------------------------
// 3 and 4. Whether it executes, proved by a response it refuses
// ---------------------------------------------------------------------------

test('a classified failure.explain answer citing no evidence is refused, on every classified condition', async () => {
  for (const { name, packet, classified } of CONDITIONS) {
    if (!classified) {
      continue;
    }
    clearRegistryForTests();
    const spec = registerInteraction(FAILURE_EXPLAIN_AS_REGISTERED);
    const out = await runGovernedInteraction(spec, packet(), { model: model(explanation([])), surface: surface() });
    // `abandoned` is what a validator refusal looks like after the one
    // correction the interaction allows. `refused` is the model declining,
    // which is a different answer and a correct one.
    assert.equal(out.kind, 'abandoned', `${name}: Phase 4's completeness check ran`);
    assert.equal(out.kind === 'abandoned' ? out.cause : '', 'response', `${name}: the answer was at fault, not the evidence`);
    assert.ok(
      out.kind === 'abandoned' && out.problems.some((p) => /cites none of the measured evidence/.test(p)),
      `${name}: and V-response-shape is what said so`,
    );
  }
});

test('the same answer citing the evidence is accepted', async () => {
  for (const { name, packet } of CONDITIONS) {
    clearRegistryForTests();
    const spec = registerInteraction(FAILURE_EXPLAIN_AS_REGISTERED);
    const out = await runGovernedInteraction(spec, packet(), { model: model(explanation([0])), surface: surface() });
    assert.equal(out.kind, 'explained', name);
  }
});

// ---------------------------------------------------------------------------
// 5. The unclassified condition, on its own contract
// ---------------------------------------------------------------------------

test('an unclassified explanation is not required to cite evidence, and may not carry a remedy', async () => {
  const spec = registerInteraction(FAILURE_EXPLAIN_AS_REGISTERED);
  // Completeness applies to a classified packet. Nothing was established
  // here, so citing nothing is not resting on nothing: there is nothing to
  // rest on, and the contract says so rather than pretending otherwise.
  const none = await runGovernedInteraction(spec, unclassified(), { model: model(explanation([])), surface: surface() });
  assert.equal(none.kind, 'explained', 'accepted, by the same validator, running');

  clearRegistryForTests();
  const spec2 = registerInteraction(FAILURE_EXPLAIN_AS_REGISTERED);
  const withRemedy = JSON.stringify({ kind: 'explain', whatIsWrong: 'x', whyItHappened: 'y', howToFix: 'Change line 12.', whatNotToChange: [], citedEvidence: [0] });
  const out = await runGovernedInteraction(spec2, unclassified(), { model: model(withRemedy), surface: surface() });
  assert.equal(out.kind, 'abandoned', 'a fix names a cause, and none was established');
  assert.ok(out.kind === 'abandoned' && out.problems.some((p) => /howToFix must be null/.test(p)), 'refused at the parse boundary, which is the unclassified packet`s own contract');
});

// ---------------------------------------------------------------------------
// 6. How finding.explain reaches the same validator
// ---------------------------------------------------------------------------

test('finding.explain reaches V-response-shape twice over: registered and declared', () => {
  const spec = registerInteraction(FINDING_EXPLAIN_AS_REGISTERED);
  assert.ok(spec.validators.includes('V-response-shape'), 'explicitly registered');
  const packet = findingPacket({ condition: 'behaviour-changed', measured: [{ text: 'm', source: 'witness' }], headline: 'h', known: ['k'] });
  assert.ok(packet.validators.includes('V-response-shape'), 'and declared by the packet as well');
  assert.ok(reconcileConstraints(spec, packet).validators.includes('V-response-shape'));
});

test('a finding is unclassified, so completeness does not apply to it either', async () => {
  const spec = registerInteraction(FINDING_EXPLAIN_AS_REGISTERED);
  const packet = findingPacket({ condition: 'behaviour-changed', measured: [{ text: 'm', source: 'witness' }], headline: 'h', known: ['k'] });
  const out = await runGovernedInteraction(spec, packet, { model: model(explanation([])), surface: surface() });
  assert.equal(out.kind, 'explained', 'the cause is not established, so there is no established cause to cite');
});

// ---------------------------------------------------------------------------
// What would actually be a gap
// ---------------------------------------------------------------------------

test('a packet that declared neither would reach neither, which is why the mechanism is worth naming', () => {
  const spec = registerInteraction(FAILURE_EXPLAIN_AS_REGISTERED);
  // Not a packet the products build. It exists here to show that the cover
  // comes from the packet and not from the registration, so that a future
  // condition that forgets to declare it would lose the check.
  const bare = unclassifiedGovernancePacket({ runner: 'vitest', evidence: ['x'] });
  assert.ok(bare.validators.includes('V-response-shape'), 'every condition the products build declares it');
  assert.deepEqual([...spec.validators], ['V-forbidden-paths'], 'and the registration alone would not');
});
