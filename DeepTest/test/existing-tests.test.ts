/**
 * `existing-tests-still-ran`, per targeted line.
 *
 * The case that matters most is the third one: a pre-existing test stops
 * reaching one of three target lines while still appearing on another. A
 * flattened union reports met there, which is the whole reason the before-set
 * is kept per line.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { existingTestsSentence, existingTestsStillRan } from '../src/decisions/existingTests';
import type { AnalysisResult, FileResult, LineResult } from '../src/engine/types';

function line(n: number, tests: string[]): LineResult {
  return { line: n, tests, density: tests.length, depth: 1, bar: 1, gap: 0, status: 'met', executed: true, route: { steps: [], reached: 0, total: 0 } } as LineResult;
}

function result(lines: Array<[number, string[]]>, unmeasured?: string): AnalysisResult {
  const file: FileResult = {
    path: 'src/pricing.ts',
    ...(unmeasured ? { unmeasured } : {}),
    skipped: [],
    lines: lines.map(([n, tests]) => line(n, tests)),
    functions: [],
    executableLines: lines.length,
    coveredLines: lines.length,
    scoredLines: lines.length,
    passingLines: lines.length,
    totalGap: 0,
    unreachableLines: [],
  } as FileResult;
  return { files: [file], shortfalls: [], summary: {} as AnalysisResult['summary'] };
}

const T = (path: string, line: number, testsBefore: string[]) => ({ path, line, testsBefore });

test('every previously observed identifier still observed is met', () => {
  const targets = [T('src/pricing.ts', 4, ['test/a.test.ts::one'])];
  const answer = existingTestsStillRan(targets, result([[4, ['test/a.test.ts::one', 'test/a.test.ts::new']]]));
  assert.equal(answer.outcome, 'met');
  assert.match(existingTestsSentence(answer), /still does/);
});

test('a missing identifier is not-met', () => {
  const targets = [T('src/pricing.ts', 4, ['test/a.test.ts::one'])];
  const answer = existingTestsStillRan(targets, result([[4, ['test/a.test.ts::new']]]));
  assert.equal(answer.outcome, 'not-met');
  assert.deepEqual(answer.missing, [{ path: 'src/pricing.ts', line: 4, tests: ['test/a.test.ts::one'] }]);
  assert.match(existingTestsSentence(answer), /line 4 of src\/pricing\.ts was not observed this time/);
});

/**
 * The case a flattened union hides. `one` stops reaching line 4 and still
 * reaches line 6, so the union of every identifier seen is unchanged.
 */
test('a test that stops reaching ONE target line is not-met, which a flattened union would miss', () => {
  const targets = [
    T('src/pricing.ts', 4, ['test/a.test.ts::one']),
    T('src/pricing.ts', 5, ['test/a.test.ts::two']),
    T('src/pricing.ts', 6, ['test/a.test.ts::one']),
  ];
  const after = result([
    [4, ['test/a.test.ts::two']],
    [5, ['test/a.test.ts::two']],
    [6, ['test/a.test.ts::one']],
  ]);

  const flattened = new Set(targets.flatMap((t) => t.testsBefore));
  const seenAnywhere = new Set(after.files[0].lines.flatMap((l) => l.tests));
  assert.equal([...flattened].every((t) => seenAnywhere.has(t)), true, 'a flattened union sees nothing wrong here');

  const answer = existingTestsStillRan(targets, after);
  assert.equal(answer.outcome, 'not-met', 'and the per-line comparison does');
  assert.deepEqual(answer.missing, [{ path: 'src/pricing.ts', line: 4, tests: ['test/a.test.ts::one'] }]);
});

test('a target that was not measured this time is insufficient, never a finding', () => {
  const targets = [T('src/pricing.ts', 4, ['test/a.test.ts::one'])];
  assert.equal(existingTestsStillRan(targets, result([[9, []]])).outcome, 'insufficient');
  assert.equal(existingTestsStillRan(targets, result([[4, ['test/a.test.ts::one']]], 'no parser')).outcome, 'insufficient');
  assert.equal(existingTestsStillRan(targets, { files: [], shortfalls: [], summary: {} as AnalysisResult['summary'] }).outcome, 'insufficient');
});

test('a real loss outranks an unmeasured target', () => {
  const targets = [T('src/pricing.ts', 4, ['test/a.test.ts::one']), T('src/pricing.ts', 99, ['test/a.test.ts::two'])];
  assert.equal(existingTestsStillRan(targets, result([[4, []]])).outcome, 'not-met');
});

test('no targets is insufficient, not met', () => {
  assert.equal(existingTestsStillRan([], result([[4, []]])).outcome, 'insufficient', 'nothing checked is not the same as nothing wrong');
});

test('the sentence says what was observed, never why', () => {
  const answer = existingTestsStillRan([T('src/pricing.ts', 4, ['test/a.test.ts::one'])], result([[4, []]]));
  const said = existingTestsSentence(answer);
  assert.match(said, /was not observed this time/);
  for (const word of ['disabled', 'deleted', 'removed', 'sabotage', 'weakened']) {
    assert.equal(said.toLowerCase().includes(word), false, `${word} would be claiming a cause`);
  }
});
