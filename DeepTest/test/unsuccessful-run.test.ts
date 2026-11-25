/**
 * How an unsuccessful run reaches verification, and it does not.
 *
 * The worry was that a failed or holed run could yield a `coverage-density`
 * result and an `existing-tests-still-ran` result and therefore look `held`.
 * It cannot, and the guarantee is structural rather than a flag:
 * `runner.ts` runs two gates that return before `analyze()` ever produces an
 * `AnalysisResult`, and `verifyBehaviour()` sits after both. **Nothing was
 * added for this.** These tests name the existing path so it is tested rather
 * than trusted.
 *
 * One distinction the tables have to keep straight: a failed run is **not**
 * `not-run`. `not-run` means the anchor was never applied. A failed run means
 * the anchor may well have been applied and no measurement happened, so the
 * verification is simply unresolved and the decision stays awaiting.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveVerification } from '@projectrevivesolutions/witness';
import { evidenceProblemSentence, nothingToScoreSentence, testsRan } from '../src/ui/words';
import type { Evidence, TestRunSummary } from '../src/languages/types';

const EMPTY: TestRunSummary = { passed: 0, failed: 0, errors: 0, skipped: 0, exitCode: 1 } as TestRunSummary;

// ---------------------------------------------------------------------------
// Gate one: the tests did not run properly
// ---------------------------------------------------------------------------

test('a failing runner does not get past the first gate', () => {
  const runnerDied: TestRunSummary = { ...EMPTY, errors: 3 };
  assert.equal(testsRan(runnerDied), false, 'nothing finished, so there is nothing to score');
  assert.match(nothingToScoreSentence(runnerDied), /nothing to score/);
});

test('an all-skipped run does not get past the first gate either', () => {
  const skipped: TestRunSummary = { ...EMPTY, skipped: 7, exitCode: 0 };
  assert.equal(testsRan(skipped), false);
});

// ---------------------------------------------------------------------------
// Gate two: the attribution has a hole
// ---------------------------------------------------------------------------

test('a broken test boundary does not get past the second gate', () => {
  const holed = { testsFinished: 4, testsRecorded: 4, recordsWithEvidence: 4, filesWithHits: 2, brokenBoundaries: 1, reconcilable: true } as Evidence;
  assert.ok(evidenceProblemSentence(holed), 'a broken boundary is a hole, and a card drawn from it is a wrong card');
});

test('fewer records than tests finished does not get past the second gate', () => {
  const short = { testsFinished: 9, testsRecorded: 2, recordsWithEvidence: 2, filesWithHits: 1, brokenBoundaries: 0, reconcilable: true } as Evidence;
  assert.ok(evidenceProblemSentence(short));
});

// ---------------------------------------------------------------------------
// The structure: analyze() and verifyBehaviour() are behind both gates
// ---------------------------------------------------------------------------

/**
 * A source assertion, because the guarantee is the ORDER of three things in
 * one function. If somebody later moves `analyze` above a gate, a
 * behavioural test would be hard to write and this fails immediately.
 */
test('analyze and verifyBehaviour sit after both refusals, in runner.ts', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'runner.ts'), 'utf8');
  const firstGate = source.indexOf('nothingToScoreSentence(run.tests)');
  const secondGate = source.indexOf('evidenceProblemSentence(run.evidence)');
  const analyze = source.indexOf('analyze(run.coverages');
  const verify = source.indexOf('verifyBehaviour(');

  assert.ok(firstGate > 0 && secondGate > 0 && analyze > 0 && verify > 0, 'every landmark is present');
  assert.ok(firstGate < secondGate, 'the tests-ran gate is first');
  assert.ok(secondGate < analyze, 'no AnalysisResult exists until the attribution is whole');
  assert.ok(analyze < verify, 'and nothing is verified before there is a result to verify against');

  // Both gates return rather than falling through, which is what makes the
  // ordering a guarantee instead of a preference.
  const betweenFirstAndSecond = source.slice(firstGate, secondGate);
  assert.match(betweenFirstAndSecond, /return;/, 'the first gate returns');
  const betweenSecondAndAnalyze = source.slice(secondGate, analyze);
  assert.match(betweenSecondAndAnalyze, /return;/, 'and so does the second');
});

// ---------------------------------------------------------------------------
// So there is no pair of results to look held
// ---------------------------------------------------------------------------

/**
 * The shape the worry was about: a `coverage-density` result and an
 * `existing-tests-still-ran` result appearing together after a failed run.
 * No such pair can exist, because neither can be computed. What
 * `resolveVerification` does with an empty result list is the backstop, and
 * it is `insufficient` rather than `held` by rule 89.
 */
test('with no results, verification is insufficient and never held', () => {
  const rule = {
    kind: 're-measure' as const,
    measurements: ['coverage-density', 'existing-tests-still-ran'] as const,
    target: { kind: 'lines' as const, path: 'src/pricing.ts', lines: [4] },
  };
  assert.equal(resolveVerification({ rule, appliedToTarget: true, results: [] }), 'insufficient');
});

/**
 * And a failed run is not `not-run`. `not-run` is about the anchor, which is
 * a different fact entirely: the person may well have applied the change and
 * the run that would have measured it failed.
 */
test('a failed run leaves verification unresolved, which is not the same as not-run', () => {
  const rule = {
    kind: 're-measure' as const,
    measurements: ['coverage-density', 'existing-tests-still-ran'] as const,
    target: { kind: 'lines' as const, path: 'src/pricing.ts', lines: [4] },
  };
  // The anchor WAS applied and the run failed, so nothing was measured.
  assert.equal(resolveVerification({ rule, appliedToTarget: true, results: [] }), 'insufficient');
  // The anchor was NOT applied. That is what not-run means, and it is
  // decided before any measurement is consulted.
  assert.equal(resolveVerification({ rule, appliedToTarget: false, results: [] }), 'not-run');
  assert.notEqual(
    resolveVerification({ rule, appliedToTarget: true, results: [] }),
    resolveVerification({ rule, appliedToTarget: false, results: [] }),
    'the two states must not collapse into one',
  );
});
