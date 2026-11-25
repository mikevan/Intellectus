/**
 * Field 10 resolved for a governed decision, at the next ordinary check.
 *
 * **The four states, kept apart**, because each is evidence of something and
 * each was at some point read as evidence of the next one along.
 *
 * A proposal was shown. **The authorized target changed**, which is the
 * anchor's job and nothing else's. A deterministic verification ran. The
 * objective held. A later run alone proves only the third, and an unapplied
 * anchor reports `not-run` whatever ran.
 *
 * **Nothing here decides what a measurement means.** The outcome rule lives
 * in Witness's `resolveVerification`, in one place, so the two products and
 * the four interactions cannot resolve it four ways. This module's job is to
 * produce the inputs: whether the anchor says the change landed, and what
 * each named measurement came to.
 *
 * **A failed or holed run never reaches here.** `runner.ts` refuses to score
 * a run whose tests did not finish and refuses a run whose attribution has a
 * hole, and both return before `analyze()` produces anything. So there is no
 * `AnalysisResult` for this function to be called with, the verification is
 * simply unresolved, and the decision stays awaiting. That is a different
 * thing from `not-run`, which says the anchor was never applied.
 */
import { anchorApplied, resolveVerification } from '@projectrevivesolutions/witness';
import type { MeasurementId, MeasurementResult, RepositoryPort, VerificationOutcome } from '@projectrevivesolutions/witness';
import type { AnalysisResult } from '../engine/types';
import type { Decision, DecisionFile } from './decisions';
import { recordDecision } from './decisions';
import { existingTestsSentence, existingTestsStillRan } from './existingTests';

/** The measurements a governed decision's interaction named, by interaction. */
const MEASUREMENTS: Readonly<Record<string, readonly MeasurementId[]>> = Object.freeze({
  'coverage.propose-test': Object.freeze(['coverage-density', 'existing-tests-still-ran'] as const),
  'function.propose-tests': Object.freeze(['coverage-density', 'existing-tests-still-ran'] as const),
  'function.propose-refactor': Object.freeze(['function-complexity', 'behaviour-equivalence'] as const),
});

export interface ResolvedVerification {
  readonly decision: Decision;
  readonly outcome: VerificationOutcome;
  /** What the person is told, naming the line where a measurement names one. */
  readonly sentences: readonly string[];
}

/**
 * Resolves every governed decision whose outcome is still open.
 *
 * Returns what it resolved rather than writing, so the caller owns the store
 * and the reporting. A decision with no anchor is not a governed decision and
 * is left alone; a decision that already carries an outcome is not resolved
 * twice.
 */
export function resolveGovernedDecisions(file: DecisionFile, result: AnalysisResult, repository: RepositoryPort): ResolvedVerification[] {
  const out: ResolvedVerification[] = [];
  for (const decision of file.decisions) {
    if (!decision.anchor || !decision.governedInteractionId || decision.verification) {
      continue;
    }
    const measurements = MEASUREMENTS[decision.governedInteractionId];
    if (!measurements) {
      continue;
    }

    // The second state, and only the second. An unapplied anchor reports
    // `not-run` whatever ran, because a measurement over untouched code says
    // what untouched code does.
    const applied = anchorApplied(decision.anchor, repository);

    const results: MeasurementResult[] = [];
    const sentences: string[] = [];

    if (measurements.includes('coverage-density')) {
      results.push({ measurement: 'coverage-density', outcome: coverageOutcome(decision, result) });
    }
    if (measurements.includes('existing-tests-still-ran')) {
      const stillRan = existingTestsStillRan(decision.verificationTargets ?? [], result);
      results.push({ measurement: 'existing-tests-still-ran', outcome: stillRan.outcome });
      sentences.push(existingTestsSentence(stillRan));
    }
    if (measurements.includes('function-complexity')) {
      results.push({ measurement: 'function-complexity', outcome: complexityOutcome(decision, result) });
    }
    if (measurements.includes('behaviour-equivalence')) {
      // The behaviour gate's own answer, which `verifyBehaviour` writes onto
      // the decision. Absent means no comparison has been reached yet, and
      // rule 89 makes that insufficient rather than a pass.
      const verdict = decision.behaviour?.verdict;
      results.push({
        measurement: 'behaviour-equivalence',
        outcome: verdict === 'equivalent' ? 'met' : verdict === 'changed' ? 'not-met' : 'insufficient',
      });
      if (decision.behaviour) {
        sentences.push(decision.behaviour.sentence);
      }
    }

    const outcome = resolveVerification({
      rule: { kind: 're-measure', measurements, target: { kind: 'lines', path: decision.path, lines: [decision.line] } },
      appliedToTarget: applied,
      results,
    });

    // `not-run` is not resolved: the person has not applied the proposal yet,
    // and the next check asks again. Writing it would close a decision that
    // is still open.
    if (outcome === 'not-run') {
      continue;
    }
    out.push({ decision, outcome, sentences });
  }
  return out;
}

/** Writes the resolved outcomes onto the decisions. */
export function withVerifications(file: DecisionFile, resolved: readonly ResolvedVerification[], at: string): DecisionFile {
  let next = file;
  for (const r of resolved) {
    next = recordDecision(next, { ...r.decision, verification: { outcome: r.outcome, at } });
  }
  return next;
}

/**
 * Did the targeted gaps close?
 *
 * **Targeted, never aggregate.** A model that added a test exercising an easy
 * path elsewhere in the file raises the project's number and closes nothing,
 * and a verdict built on the aggregate would call that a pass.
 */
function coverageOutcome(decision: Decision, result: AnalysisResult): 'met' | 'not-met' | 'insufficient' {
  const targets = decision.verificationTargets ?? [{ path: decision.path, line: decision.line, testsBefore: [] }];
  let anyUnmeasured = false;
  let anyOpen = false;
  for (const target of targets) {
    const file = result.files.find((f) => f.path === target.path);
    const line = file?.lines.find((l) => l.line === target.line);
    if (file === undefined || file.unmeasured !== undefined || line === undefined) {
      anyUnmeasured = true;
      continue;
    }
    if (line.gap > 0) {
      anyOpen = true;
    }
  }
  return anyOpen ? 'not-met' : anyUnmeasured ? 'insufficient' : 'met';
}

/** Is the function within the limit now? */
function complexityOutcome(decision: Decision, result: AnalysisResult): 'met' | 'not-met' | 'insufficient' {
  const file = result.files.find((f) => f.path === decision.path);
  const fn = file?.functions.find((f) => f.startLine === decision.line);
  if (!file || !fn) {
    return 'insufficient';
  }
  return fn.complexity <= result.summary.thresholds.maxFunctionComplexity ? 'met' : 'not-met';
}
