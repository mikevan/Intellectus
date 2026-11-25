/**
 * M17a: field 10 resolved for a governed decision.
 *
 * The four states, kept apart. The one worth the most care is the second: an
 * unapplied anchor reports `not-run` whatever ran, because a measurement over
 * untouched code says what untouched code does.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { contentDigest, memoryRepository } from '@projectrevivesolutions/witness';
import { resolveGovernedDecisions, withVerifications } from '../src/decisions/verification';
import type { AnalysisResult, FileResult, LineResult } from '../src/engine/types';
import type { Decision, DecisionFile } from '../src/decisions/decisions';

const SOURCE = 'src/pricing.ts';
const TEST_FILE = 'src/pricing.test.ts';
const TEST_TEXT = `it('adds', () => {});\n`;

function line(n: number, tests: string[], gap: number): LineResult {
  return { line: n, tests, density: tests.length, depth: 1, bar: 1, gap, status: gap > 0 ? 'short' : 'met', executed: true, route: { steps: [], reached: 0, total: 0 } } as LineResult;
}

function result(lines: Array<[number, string[], number]>, functions: Array<{ name: string; startLine: number; complexity: number }> = []): AnalysisResult {
  const file: FileResult = {
    path: SOURCE,
    skipped: [],
    lines: lines.map(([n, tests, gap]) => line(n, tests, gap)),
    functions: functions.map((f) => ({ ...f, endLine: f.startLine + 5, campbell: 0, mbcc: 0 })),
    executableLines: lines.length,
    coveredLines: lines.length,
    scoredLines: lines.length,
    passingLines: lines.length,
    totalGap: 0,
    unreachableLines: [],
  } as unknown as FileResult;
  return { files: [file], shortfalls: [], summary: { thresholds: { maxFunctionComplexity: 5 } } as AnalysisResult['summary'] };
}

function decision(over: Partial<Decision> = {}): Decision {
  return {
    path: SOURCE,
    line: 4,
    lineHash: 'abc',
    kind: 'fix',
    reason: '',
    by: 'mike',
    at: '2026-09-24T10:00:00Z',
    gapAtDecision: 1,
    governedInteractionId: 'coverage.propose-test',
    anchor: { kind: 'path-created', path: TEST_FILE },
    verificationTargets: [{ path: SOURCE, line: 4, testsBefore: ['src/pricing.test.ts::adds'] }],
    ...over,
  } as Decision;
}

const file = (d: Decision): DecisionFile => ({ version: 1, decisions: [d] });

const APPLIED = memoryRepository('/project', { [TEST_FILE]: TEST_TEXT });
const NOT_APPLIED = memoryRepository('/project', {});

// ---------------------------------------------------------------------------
// The second state: the anchor, and nothing else
// ---------------------------------------------------------------------------

test('an unapplied anchor resolves to nothing, whatever the measurement says', () => {
  // The gap closed and every previously observed test still runs. A
  // verdict built on the measurement alone would call this held.
  const closed = result([[4, ['src/pricing.test.ts::adds', 'src/pricing.test.ts::new'], 0]]);
  assert.deepEqual(resolveGovernedDecisions(file(decision()), closed, NOT_APPLIED), [], 'not-run is not written: the decision is still open');
});

test('a path-created anchor resolves once the file appears', () => {
  const closed = result([[4, ['src/pricing.test.ts::adds', 'src/pricing.test.ts::new'], 0]]);
  const resolved = resolveGovernedDecisions(file(decision()), closed, APPLIED);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].outcome, 'held');
});

test('a content-digest anchor resolves only when the authorized file changed', () => {
  const d = decision({ anchor: { kind: 'content-digest', path: TEST_FILE, digest: contentDigest(TEST_TEXT) } });
  const closed = result([[4, ['src/pricing.test.ts::adds', 'src/pricing.test.ts::new'], 0]]);
  assert.deepEqual(resolveGovernedDecisions(file(d), closed, APPLIED), [], 'untouched: nothing was applied');

  const edited = memoryRepository('/project', { [TEST_FILE]: `${TEST_TEXT}it('more', () => {});\n` });
  assert.equal(resolveGovernedDecisions(file(d), closed, edited)[0].outcome, 'held');
});

// ---------------------------------------------------------------------------
// Every named measurement must hold
// ---------------------------------------------------------------------------

test('the gap closing is not enough if a pre-existing test stopped running', () => {
  const silenced = result([[4, ['src/pricing.test.ts::new'], 0]]);
  const resolved = resolveGovernedDecisions(file(decision()), silenced, APPLIED);
  assert.equal(resolved[0].outcome, 'changed', 'closing the gap by silencing the test that held it honest is not success');
  assert.match(resolved[0].sentences.join(' '), /line 4 of src\/pricing\.ts was not observed this time/);
});

test('every previously observed test still running is not enough if the gap is open', () => {
  const stillShort = result([[4, ['src/pricing.test.ts::adds'], 1]]);
  assert.equal(resolveGovernedDecisions(file(decision()), stillShort, APPLIED)[0].outcome, 'changed');
});

/**
 * Targeted, never aggregate. A test exercising an easy path elsewhere raises
 * the project's number and closes nothing.
 */
test('a named line that did not close is changed, even when other lines improved', () => {
  const d = decision({ verificationTargets: [{ path: SOURCE, line: 4, testsBefore: [] }, { path: SOURCE, line: 5, testsBefore: [] }] });
  const partly = result([[4, ['t::a'], 0], [5, [], 1], [9, ['t::b', 't::c'], 0]]);
  assert.equal(resolveGovernedDecisions(file(d), partly, APPLIED)[0].outcome, 'changed');
});

test('a target that was not measured this time is insufficient, never a pass', () => {
  const d = decision({ verificationTargets: [{ path: SOURCE, line: 99, testsBefore: [] }] });
  assert.equal(resolveGovernedDecisions(file(d), result([[4, [], 0]]), APPLIED)[0].outcome, 'insufficient');
});

// ---------------------------------------------------------------------------
// The refactor interaction's pair
// ---------------------------------------------------------------------------

function refactorDecision(over: Partial<Decision> = {}): Decision {
  return decision({
    line: 1,
    scope: 'function',
    functionName: 'total',
    governedInteractionId: 'function.propose-refactor',
    anchor: { kind: 'content-digest', path: SOURCE, digest: 'the-old-digest' },
    verificationTargets: undefined,
    ...over,
  });
}

const REFACTORED = memoryRepository('/project', { [SOURCE]: 'export function total() { return 0; }\n' });

test('complexity within the limit with behaviour equivalent is held', () => {
  const d = refactorDecision({ behaviour: { verdict: 'equivalent', compared: 4, sentence: 'It still does what it did.' } });
  const within = result([[1, [], 0]], [{ name: 'total', startLine: 1, complexity: 3 }]);
  assert.equal(resolveGovernedDecisions(file(d), within, REFACTORED)[0].outcome, 'held');
});

test('complexity met with behaviour changed is changed, not held', () => {
  const d = refactorDecision({ behaviour: { verdict: 'changed', compared: 4, sentence: 'It does not do what it did.' } });
  const within = result([[1, [], 0]], [{ name: 'total', startLine: 1, complexity: 3 }]);
  assert.equal(resolveGovernedDecisions(file(d), within, REFACTORED)[0].outcome, 'changed');
});

test('behaviour equivalent with complexity still over is changed: the work did not happen', () => {
  const d = refactorDecision({ behaviour: { verdict: 'equivalent', compared: 4, sentence: 'It still does what it did.' } });
  const over = result([[1, [], 0]], [{ name: 'total', startLine: 1, complexity: 9 }]);
  assert.equal(resolveGovernedDecisions(file(d), over, REFACTORED)[0].outcome, 'changed');
});

test('no behaviour verdict yet is insufficient, never a pass', () => {
  const d = refactorDecision();
  const within = result([[1, [], 0]], [{ name: 'total', startLine: 1, complexity: 3 }]);
  assert.equal(resolveGovernedDecisions(file(d), within, REFACTORED)[0].outcome, 'insufficient');
});

// ---------------------------------------------------------------------------
// What is left alone
// ---------------------------------------------------------------------------

test('an ungoverned decision is not touched', () => {
  const d = decision({ governedInteractionId: undefined, anchor: undefined });
  assert.deepEqual(resolveGovernedDecisions(file(d), result([[4, [], 0]]), APPLIED), []);
});

test('a decision that already carries an outcome is not resolved twice', () => {
  const d = decision({ verification: { outcome: 'held', at: '2026-09-24T11:00:00Z' } });
  assert.deepEqual(resolveGovernedDecisions(file(d), result([[4, [], 1]]), APPLIED), []);
});

test('withVerifications writes the outcome onto the decision without mutating the input', () => {
  const original = file(decision());
  const closed = result([[4, ['src/pricing.test.ts::adds', 'src/pricing.test.ts::new'], 0]]);
  const resolved = resolveGovernedDecisions(original, closed, APPLIED);
  const next = withVerifications(original, resolved, '2026-09-24T12:00:00Z');
  assert.equal(next.decisions[0].verification?.outcome, 'held');
  assert.equal(original.decisions[0].verification, undefined, 'the input is untouched');
});
