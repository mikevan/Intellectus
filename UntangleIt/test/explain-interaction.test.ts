/**
 * Which explanation interaction each real packet resolves to.
 *
 * **This exists because it was wrong.** Both `failure.explain` and
 * `finding.explain` have always been registered, and the participant asked
 * for `failure.explain` whatever it held. A finding explanation was therefore
 * recorded under the wrong interaction id and ran one validator short:
 * `V-response-shape` is declared by the finding spec and not by the failure
 * spec. The Phase 9 release governance gate found it, as a registered
 * interaction with no production caller.
 *
 * So these are not shape tests. They build the packets the product really
 * produces, put each through the real selection, and check the interaction
 * that comes back and what that interaction obliges.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { requireInteraction, unclassifiedGovernancePacket } from '@projectrevivesolutions/witness';
import { explainInteractionFor } from '../src/agent/explainInteraction';
import { FAILURE_EXPLAIN, FINDING_EXPLAIN, registerInteractions } from '../src/agent/interactions';
import { behaviourFinding } from '../src/agent/findings';
import type { RunRecord } from '../src/runs';

/** A run whose behaviour gate came back `changed`: a measurement that completed. */
const changed = {
  id: 'r1',
  path: 'src/engine/tangle.ts',
  name: 'untangle',
  startLine: 12,
  before: 31,
  limit: 12,
  by: 'mbcc',
  startedAt: '2026-01-01T00:00:00.000Z',
  rounds: 1,
  status: 'open',
  behaviour: { verdict: 'changed', compared: 14, sentence: 'Fourteen calls were compared and two disagree.' },
  boundary: { path: 'src/engine/tangle.ts', name: 'untangle' },
} as unknown as RunRecord;

const finding = behaviourFinding(changed)!;

test('the finding packet this product really builds exists', () => {
  assert.ok(finding, 'behaviourFinding returns a packet for a changed verdict');
});

test('a run whose cause was never established explains as a failure', () => {
  const packet = unclassifiedGovernancePacket({ runner: 'vitest', evidence: ['exit code 7'] });
  assert.equal(explainInteractionFor(packet), FAILURE_EXPLAIN);
});

test('a measured finding explains as a finding, not as a failure', () => {
  assert.equal(explainInteractionFor(finding), FINDING_EXPLAIN);
});

test('the finding path therefore receives the finding validator set, including V-response-shape', () => {
  registerInteractions();
  const spec = requireInteraction(explainInteractionFor(finding));
  assert.equal(spec.id, FINDING_EXPLAIN);
  assert.ok(spec.validators.includes('V-response-shape'), 'the check the failure spec does not declare');
  assert.ok(spec.validators.includes('V-forbidden-paths'));
});

test('and the failure path keeps its own, narrower set', () => {
  registerInteractions();
  const packet = unclassifiedGovernancePacket({ runner: 'vitest', evidence: ['exit code 7'] });
  const spec = requireInteraction(explainInteractionFor(packet));
  assert.equal(spec.id, FAILURE_EXPLAIN);
  assert.deepEqual([...spec.validators], ['V-forbidden-paths'], 'unchanged by this fix');
});

test('both explanations stay explanations: neither proposes and neither needs authorization', () => {
  registerInteractions();
  for (const id of [FAILURE_EXPLAIN, FINDING_EXPLAIN]) {
    const spec = requireInteraction(id);
    assert.equal(spec.objective, 'explain');
    assert.equal(spec.allowed.mayPropose, false);
    assert.deepEqual([...spec.allowed.proposable], []);
  }
});
