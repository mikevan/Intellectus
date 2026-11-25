/**
 * The registered interaction against the packets it will really be given.
 *
 * M19's invariant is enforced in Witness, but whether THIS product's
 * registered spec reconciles with THIS product's real packets is a question
 * only the product can answer, and it is the one that would bite a customer.
 * A spec requiring a constraint no real packet can supply, or naming a
 * validator no real packet lists, would pass every test in the shared layer
 * and fail the first time somebody's run went wrong.
 *
 * So these build the actual packets the failure-assistance path produces and
 * reconcile them against the actual spec, before any of it reaches a person.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import {
  authorizationBrief,
  briefLines,
  buildPrompt,
  clearRegistryForTests,
  reconcileConstraints,
  requireInteraction,
  unclassifiedGovernancePacket,
  upstreamPathFailure,
} from '@projectrevivesolutions/witness';
import { FAILURE_EXPLAIN, registerInteractions } from '../src/agent/interactions';
import { registeredIds } from '@projectrevivesolutions/witness';

const NASTY = "C:\\workspace\\MikeVan's AI Development Toolkit\\app";
const ANGULAR = [
  'Application bundle generation failed. [2.378 seconds]',
  '✘ [ERROR] Expected ";" but found "s"',
  "      1 │ import 'C:/workspace/MikeVan's AI Development Toolkit/app/polyfills.js';",
].join('\n');

/** The classified case: the condition's six constraints plus the required one. */
test('the registered interaction reconciles with a real classified packet', () => {
  registerInteractions();
  const spec = requireInteraction(FAILURE_EXPLAIN);
  const packet = upstreamPathFailure({ workspaceRoot: NASTY, runner: 'ng-karma', output: ANGULAR, succeeded: false })!.governed;

  const effective = reconcileConstraints(spec, packet);
  assert.deepEqual([...effective.required], ['C4'], 'what this interaction always requires');
  assert.equal(effective.conditional.length, 6, 'and what the path condition added');
  assert.equal(effective.constraints.length, 7);

  // The prompt and the person are told the same seven, in the same words.
  const prompt = buildPrompt(packet, spec, effective).text;
  for (const c of effective.constraints) {
    assert.ok(prompt.includes(`[${c.id}] ${c.prose}`), `the model is told ${c.id}`);
  }
});

/** The unclassified case: one condition constraint, and still the required one. */
test('the registered interaction reconciles with a real unclassified packet', () => {
  registerInteractions();
  const spec = requireInteraction(FAILURE_EXPLAIN);
  const packet = unclassifiedGovernancePacket({ runner: 'vitest', evidence: ['exit code 7'] });

  const effective = reconcileConstraints(spec, packet);
  assert.deepEqual([...effective.required], ['C4']);
  assert.deepEqual([...effective.conditional], ['X-UNCLASSIFIED-1']);
  assert.equal(effective.constraints.length, 2);

  const prompt = buildPrompt(packet, spec, effective).text;
  assert.match(prompt, /has NOT been classified/, 'and it is still handed over as unclassified');
  assert.ok(prompt.includes('Do not state a cause the evidence does not support'));
});

/**
 * An explanation changes nothing, so there is nothing to authorize and the
 * product must not put a consent question in front of somebody for one.
 * Training people to click through the ones that do not matter is how they
 * come to click through the ones that do.
 */
test('the explanation asks for no authorization', () => {
  registerInteractions();
  const spec = requireInteraction(FAILURE_EXPLAIN);
  const packet = unclassifiedGovernancePacket({ runner: 'vitest', evidence: ['exit code 7'] });
  const effective = reconcileConstraints(spec, packet);
  assert.throws(() => authorizationBrief(packet, spec, effective), /nothing for a person to authorize/);
  assert.equal(typeof briefLines, 'function');
});

/** The id in code is the id in the registry. */
test('the runtime id is semantic and registered', () => {
  registerInteractions();
  assert.equal(FAILURE_EXPLAIN, 'failure.explain');
  assert.doesNotMatch(FAILURE_EXPLAIN, /^O-\d/, 'O-numbers are roadmap labels, never registry keys (rule 91)');
  assert.equal(requireInteraction(FAILURE_EXPLAIN).objective, 'explain');
  clearRegistryForTests();
});

/**
 * Registration is idempotent, and it asks the registry rather than trusting a
 * flag of its own.
 *
 * A module-local boolean says what this module did. The registry says what is
 * true, and after a test clears the registry those were two different
 * answers: the flag stayed set, nothing re-registered, and every interaction
 * id in the suite became unregistered. Asking the registry makes the guard
 * track reality.
 */
test('registering twice is safe, and clearing the registry lets it register again', () => {
  clearRegistryForTests();
  registerInteractions();
  registerInteractions();
  const after = [...registeredIds()].sort();
  assert.deepEqual(after, ['coverage.propose-test', 'failure.explain', 'finding.explain', 'function.propose-refactor', 'function.propose-tests'], 'five since Phase 6, once each');

  clearRegistryForTests();
  assert.deepEqual(registeredIds(), [], 'the registry is empty');
  registerInteractions();
  assert.deepEqual([...registeredIds()].sort(), after, 'and it fills again, which a module flag would have prevented');
});
