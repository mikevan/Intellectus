/**
 * One yes authorizes one attempt, and looking at the attempt must not spend
 * it.
 *
 * `peekPendingAttempt` exists so the integration suite can observe the
 * governed hand-off. If a later edit turned the look into a take, the
 * participant would find nothing waiting when the person pressed send, and
 * the authorization they gave would vanish without a trace. This pins the
 * difference, and pins that the look carries identifiers only.
 */
import { afterEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { clearPendingAttempt, peekPendingAttempt, setPendingAttempt, takePendingAttempt, type PendingAttempt } from '../src/agent/attempt';

const attempt = {
  interactionId: 'method.propose-untangle',
  runId: 'run-1',
  packet: { headline: 'not for the look' },
  authorization: { answer: 'not for the look' },
  anchor: { path: 'src/calc.ts' },
} as unknown as PendingAttempt;

afterEach(() => clearPendingAttempt());

test('the look returns nothing when nothing is waiting', () => {
  assert.equal(peekPendingAttempt(), undefined);
});

test('the look does not spend the attempt, and the take still does', () => {
  setPendingAttempt(attempt);
  assert.deepEqual(peekPendingAttempt(), { interactionId: 'method.propose-untangle', runId: 'run-1' });
  assert.deepEqual(peekPendingAttempt(), { interactionId: 'method.propose-untangle', runId: 'run-1' }, 'a second look sees the same attempt');
  assert.equal(takePendingAttempt(), attempt, 'the participant still gets the whole attempt');
  assert.equal(peekPendingAttempt(), undefined, 'after the take nothing is waiting');
  assert.equal(takePendingAttempt(), undefined, 'and one yes authorized one attempt');
});

test('the look carries the two identifiers and nothing else', () => {
  setPendingAttempt(attempt);
  assert.deepEqual(Object.keys(peekPendingAttempt() ?? {}).sort(), ['interactionId', 'runId']);
});
