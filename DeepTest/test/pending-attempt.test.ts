/**
 * One yes authorizes one attempt, and looking at the attempt must not spend
 * it.
 *
 * `peekPendingAttempt` exists so the integration suite can observe the
 * governed pre-fill behind "Fix this". If a later edit turned the look into a
 * take, the participant would find nothing waiting when the person pressed
 * send, and the authorization they gave would vanish without a trace. This
 * pins the difference, and pins that the look carries identifiers only.
 */
import { afterEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { clearPendingAttempt, hasPendingAttempt, peekPendingAttempt, setPendingAttempt, takePendingAttempt, type PendingAttempt } from '../src/agent/attempt';

const attempt = {
  interactionId: 'coverage.propose-test',
  packet: { headline: 'not for the look' },
  authorization: { answer: 'not for the look' },
  anchor: { kind: 'content-digest', path: 'tests/test_calc.py' },
  decision: { path: 'src/calc.py', line: 6 },
} as unknown as PendingAttempt;

afterEach(() => clearPendingAttempt());

test('the look returns nothing when nothing is waiting', () => {
  assert.equal(peekPendingAttempt(), undefined);
});

test('the look does not spend the attempt, and the take still does', () => {
  setPendingAttempt(attempt);
  const expected = { interactionId: 'coverage.propose-test', decision: { path: 'src/calc.py', line: 6 } };
  assert.deepEqual(peekPendingAttempt(), expected);
  assert.deepEqual(peekPendingAttempt(), expected, 'a second look sees the same attempt');
  assert.equal(hasPendingAttempt(), true);
  assert.equal(takePendingAttempt(), attempt, 'the participant still gets the whole attempt');
  assert.equal(peekPendingAttempt(), undefined, 'after the take nothing is waiting');
  assert.equal(takePendingAttempt(), undefined, 'and one yes authorized one attempt');
});

test('the look carries the identifiers and nothing else', () => {
  setPendingAttempt(attempt);
  const look = peekPendingAttempt();
  assert.deepEqual(Object.keys(look ?? {}).sort(), ['decision', 'interactionId']);
  assert.notEqual(look?.decision, attempt.decision, 'a copy, so a caller cannot reach the held attempt through it');
});
