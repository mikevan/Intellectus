/**
 * `method.propose-untangle`, registered and reconciled.
 *
 * The two-part verification is the thing worth pinning: reporting `held` on
 * complexity alone would undo the reason Phase 1 exists.
 */
import { test, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import {
  anchorApplied,
  clearCapabilitiesForTests,
  clearRegistryForTests,
  contentDigest,
  memoryRepository,
  reconcileConstraints,
  requireInteraction,
  resolveVerification,
} from '@projectrevivesolutions/witness';
import { METHOD_PROPOSE_UNTANGLE, registerInteractions } from '../src/agent/interactions';
import { untangleProposalPacket } from '../src/agent/packets';
import { resolveGovernedRun } from '../src/verification';
import type { RunRecord } from '../src/runs';
import type { Comparison } from '../src/engine/tangle';

const PATH = 'src/pricing.ts';
const SOURCE = 'export function total(a, b) {\n  if (a < 0) { return 0; }\n  return a + b;\n}\n';

beforeEach(() => {
  clearCapabilitiesForTests();
  clearRegistryForTests();
  registerInteractions();
});

function made() {
  return untangleProposalPacket({
    path: PATH,
    name: 'total',
    startLine: 1,
    before: 12,
    limit: 5,
    measure: 'mbcc',
    runner: 'vitest',
    read: (p) => (p === PATH ? SOURCE : undefined),
  });
}

test('the packet names both measurements and targets the boundary', () => {
  const proposal = made();
  assert.ok(proposal.ok);
  if (!proposal.ok) {
    return;
  }
  const verification = proposal.packet.verification;
  assert.equal(verification.kind, 're-measure');
  if (verification.kind === 're-measure') {
    assert.deepEqual([...verification.measurements], ['function-complexity', 'behaviour-equivalence']);
    assert.equal(verification.target.kind, 'boundary');
  }
});

/**
 * The one invariant that survived the deleted hand-written brief.
 *
 * `buildUntangleBrief`'s test asserted that the brief "states the target
 * three ways". Most of what it checked was prose and went with the builder,
 * but the target itself is still a product requirement: the person and the
 * model are told which method, what it measured, and what the limit is. It is
 * asserted here over the packet's evidence rather than over generated text.
 *
 * **The measure decides the words, and both branches are reachable.** A run
 * record written before 0.1.11 carries no `measure`, so `anotherRound` falls
 * back to 'ways', which is every legacy upgrade. Getting the wording wrong
 * there tells the person the wrong number's name.
 */
test('the evidence names the method, its measured number in the right words, and the limit', () => {
  const tangle = untangleProposalPacket({ path: PATH, name: 'total', startLine: 1, before: 12, limit: 5, measure: 'mbcc', runner: 'vitest', read: () => SOURCE });
  assert.ok(tangle.ok);
  if (tangle.ok) {
    assert.equal(tangle.packet.evidence[0].text, 'total() has a tangle of 12; the limit is 5.');
    assert.deepEqual([...tangle.packet.known], ['total() has a tangle of 12, and your limit is 5.']);
    assert.equal(tangle.packet.evidence[0].origin, 'measurement', 'no assistant output ever enters field 1');
  }

  const ways = untangleProposalPacket({ path: PATH, name: 'total', startLine: 1, before: 12, limit: 5, measure: 'ways', runner: 'vitest', read: () => SOURCE });
  assert.ok(ways.ok);
  if (ways.ok) {
    assert.equal(ways.packet.evidence[0].text, 'total() has 12 ways through it; the limit is 5.');
    assert.deepEqual([...ways.packet.known], ['total() has 12 ways through it, and your limit is 5.']);
  }

  // The sentence is built per measure rather than by substituting a noun into
  // one template, which is what produced "has a ways through it of 12".
  for (const p of [tangle, ways]) {
    if (p.ok) {
      assert.doesNotMatch(p.packet.evidence[0].text, /has a ways through it of/);
      assert.doesNotMatch(p.packet.known[0], /has a ways through it of/);
    }
  }
});

/**
 * The headline names the method and the objective, and promises nothing about
 * the result. The old brief ended with "it will not accept the result on your
 * behalf"; that is now structural, in field 10's two measurements, rather
 * than a sentence somebody could edit out.
 */
test('the headline states the objective and claims nothing about the outcome', () => {
  const proposal = made();
  assert.ok(proposal.ok);
  if (!proposal.ok) {
    return;
  }
  assert.equal(proposal.packet.headline, 'Break total() into smaller pieces without changing what it does.');
  for (const promise of [/will fix/i, /will work/i, /guarantee/i, /correct/i]) {
    assert.doesNotMatch(proposal.packet.headline, promise, 'an objective, never an assurance about the result');
  }
});

test('the anchor is a digest of the authorized file, which is the first content identity a run has carried', () => {
  const proposal = made();
  assert.ok(proposal.ok);
  if (!proposal.ok) {
    return;
  }
  assert.deepEqual(proposal.anchor, { kind: 'content-digest', path: PATH, digest: contentDigest(SOURCE) });

  // A later measurement over untouched source is not an application, which
  // is the thing an after-record's existence was being read as.
  assert.equal(anchorApplied(proposal.anchor, memoryRepository('/project', { [PATH]: SOURCE })), false);
  const untangled = 'function guard(a) { return a < 0; }\nexport function total(a, b) {\n  if (guard(a)) { return 0; }\n  return a + b;\n}\n';
  assert.equal(anchorApplied(proposal.anchor, memoryRepository('/project', { [PATH]: untangled })), true);
});

test('C3 is bound to the authorized file and the spec requires all five', () => {
  const proposal = made();
  assert.ok(proposal.ok);
  if (!proposal.ok) {
    return;
  }
  const effective = reconcileConstraints(requireInteraction(METHOD_PROPOSE_UNTANGLE), proposal.packet);
  assert.deepEqual([...effective.required], ['C1', 'C2', 'C3', 'C4', 'C8']);
  const c3 = effective.constraints.find((c) => c.id === 'C3');
  assert.deepEqual(c3 && c3.rule.kind === 'paths-confined-to' ? [...c3.rule.allow] : [], [PATH]);
});

test('both halves must hold, and neither alone is success', () => {
  const rule = {
    kind: 're-measure' as const,
    measurements: ['function-complexity', 'behaviour-equivalence'] as const,
    target: { kind: 'boundary' as const, path: PATH, name: 'total' },
  };
  const outcome = (complexity: 'met' | 'not-met' | 'insufficient', behaviour: 'met' | 'not-met' | 'insufficient') =>
    resolveVerification({
      rule,
      appliedToTarget: true,
      results: [
        { measurement: 'function-complexity', outcome: complexity },
        { measurement: 'behaviour-equivalence', outcome: behaviour },
      ],
    });

  assert.equal(outcome('met', 'met'), 'held');
  assert.equal(outcome('met', 'not-met'), 'changed', 'something broke');
  assert.equal(outcome('not-met', 'met'), 'changed', 'the work did not happen');
  assert.equal(outcome('met', 'insufficient'), 'insufficient', 'nobody can tell');
});

test('an unreadable file refuses before anything is built', () => {
  const proposal = untangleProposalPacket({
    path: 'src/gone.ts',
    name: 'total',
    startLine: 1,
    before: 12,
    limit: 5,
    measure: 'mbcc',
    runner: 'vitest',
    read: () => undefined,
  });
  assert.equal(proposal.ok, false);
});

// ---------------------------------------------------------------------------
// M17a: field 10 resolved for a governed run
// ---------------------------------------------------------------------------

const UNTANGLED = 'function guard(a) { return a < 0; }\nexport function total(a, b) {\n  if (guard(a)) { return 0; }\n  return a + b;\n}\n';

function governedRun(over: Partial<RunRecord> = {}): RunRecord {
  return {
    id: 'r1',
    path: PATH,
    name: 'total',
    startLine: 1,
    before: 12,
    measure: 'mbcc',
    limit: 5,
    by: 'mike',
    startedAt: '2026-09-24T10:00:00Z',
    rounds: 1,
    status: 'sent',
    snapshot: { methods: [] },
    governedInteractionId: METHOD_PROPOSE_UNTANGLE,
    anchor: { kind: 'content-digest', path: PATH, digest: contentDigest(SOURCE) },
    ...over,
  } as unknown as RunRecord;
}

const comparison = (withinLimit: boolean) => ({ withinLimit, pieces: [], original: undefined }) as unknown as Comparison;

const APPLIED = memoryRepository('/project', { [PATH]: UNTANGLED });
const UNTOUCHED = memoryRepository('/project', { [PATH]: SOURCE });

/**
 * The mistake this whole contract exists to prevent. A measurement runs
 * whether or not the person applied anything, so the existence of this one
 * says nothing about whether their change landed.
 */
test('a later measurement over untouched source resolves to nothing', () => {
  const run = governedRun({ behaviour: { verdict: 'equivalent', compared: 4, sentence: 'It still does what it did.' } });
  assert.equal(resolveGovernedRun(run, comparison(true), UNTOUCHED), undefined, 'not-run is not written: the run is still open');
});

test('both halves met is held', () => {
  const run = governedRun({ behaviour: { verdict: 'equivalent', compared: 4, sentence: 'It still does what it did.' } });
  assert.equal(resolveGovernedRun(run, comparison(true), APPLIED)?.outcome, 'held');
});

test('within the limit with behaviour changed is changed: something broke', () => {
  const run = governedRun({ behaviour: { verdict: 'changed', compared: 4, sentence: 'It does not do what it did.' } });
  const resolved = resolveGovernedRun(run, comparison(true), APPLIED);
  assert.equal(resolved?.outcome, 'changed');
  assert.match(resolved?.sentence ?? '', /does not do what it did/);
});

test('behaviour equivalent but still over the limit is changed: the work did not happen', () => {
  const run = governedRun({ behaviour: { verdict: 'equivalent', compared: 4, sentence: 'It still does what it did.' } });
  assert.equal(resolveGovernedRun(run, comparison(false), APPLIED)?.outcome, 'changed');
});

test('no behaviour verdict yet is insufficient, and the tangle number alone is never a pass', () => {
  assert.equal(resolveGovernedRun(governedRun(), comparison(true), APPLIED)?.outcome, 'insufficient');
});

test('an insufficient behaviour verdict is insufficient, not held', () => {
  const run = governedRun({ behaviour: { verdict: 'insufficient', reason: 'the tests never reached it', sentence: 'Nobody can tell.' } });
  assert.equal(resolveGovernedRun(run, comparison(true), APPLIED)?.outcome, 'insufficient');
});

test('an ungoverned run, and one already resolved, are both left alone', () => {
  assert.equal(resolveGovernedRun(governedRun({ anchor: undefined, governedInteractionId: undefined }), comparison(true), APPLIED), undefined);
  const done = governedRun({ behaviour: { verdict: 'equivalent', compared: 4, sentence: 'x' }, verification: { outcome: 'held', at: '2026-09-24T11:00:00Z' } });
  assert.equal(resolveGovernedRun(done, comparison(false), APPLIED), undefined, 'an outcome is written once');
});
