/**
 * Field 10 resolved: did the authorized objective hold?
 *
 * Pure. No filesystem, no watcher, no inference, and no knowledge of how any
 * product establishes anything. It takes the **fact** that the authorized
 * change occurred, not the means of establishing it, because whether that
 * fact came from a created path or a changed file digest is the product's
 * business and one interaction's anchor logic has no reason to be visible to
 * another's.
 *
 * **Four states, kept distinct**, because each is evidence of something and
 * each was at some point read as evidence of the next one along.
 *
 * | State | Established by | Never by |
 * |---|---|---|
 * | A proposal was shown | the interaction reaching `proposed` | — |
 * | The authorized target changed | the application anchor | a later run happening |
 * | A verification ran | an ordinary measurement over the target | the target having changed |
 * | The objective held | every named measurement reaching what it asked | any of the above |
 *
 * **Every named measurement must hold.** One measurement could not express
 * what an untangle has to prove: equivalent behaviour with no untangling is
 * not success, because the work did not happen, and lower complexity with
 * changed behaviour is not success, because something broke. The rule lives
 * here so there is one place it is decided.
 *
 * Deterministic, and the reason rather than the habit (rule 88). This decides
 * whether a change worked. Rules 26 and 31 exist because the one party who
 * must never answer that is the one that made the change.
 */
import type { MeasurementId, VerificationRule } from './packet';

/** What one re-measurement reported. */
export type MeasurementOutcome = 'met' | 'not-met' | 'insufficient';

export interface MeasurementResult {
  readonly measurement: MeasurementId;
  readonly outcome: MeasurementOutcome;
}

/**
 * The four outcomes.
 *
 * `not-run` means the authorized change was never applied, which is a
 * different thing from a run that failed. A failed or inconsistent test run
 * produces no analysis at all, so it reaches nothing here and the
 * verification is simply unresolved: absent, and resolved at the next healthy
 * check.
 */
export type VerificationOutcome = 'held' | 'changed' | 'insufficient' | 'not-run';

export class VerificationError extends Error {}

export function resolveVerification(input: {
  readonly rule: Extract<VerificationRule, { kind: 're-measure' }>;
  /** The second state, already established by the product through its anchor. */
  readonly appliedToTarget: boolean;
  readonly results: readonly MeasurementResult[];
}): VerificationOutcome {
  const { rule, appliedToTarget, results } = input;

  // An unapplied anchor reports `not-run` whatever ran. A measurement over
  // untouched code says what untouched code does, and reading that as a pass
  // is the exact mistake an after-record's existence used to invite.
  if (!appliedToTarget) {
    return 'not-run';
  }

  const byMeasurement = new Map<MeasurementId, MeasurementOutcome>();
  for (const r of results) {
    byMeasurement.set(r.measurement, r.outcome);
  }

  let anyInsufficient = false;
  for (const measurement of rule.measurements) {
    const outcome = byMeasurement.get(measurement);
    if (outcome === undefined) {
      // A named measurement nobody ran. Rule 89: absence of a result is not
      // a result, and it is certainly not a pass.
      anyInsufficient = true;
      continue;
    }
    if (outcome === 'not-met') {
      return 'changed';
    }
    if (outcome === 'insufficient') {
      anyInsufficient = true;
    }
  }

  return anyInsufficient ? 'insufficient' : 'held';
}
