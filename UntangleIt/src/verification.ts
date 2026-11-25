/**
 * Field 10 resolved for a governed run, at "Measure again".
 *
 * **The four states, kept apart**, because each is evidence of something and
 * each was at some point read as evidence of the next one along.
 *
 * A proposal was shown. **The authorized target changed**, which is the
 * anchor's job and nothing else's. A deterministic verification ran. The
 * objective held. The mistake this file exists to prevent is the second one:
 * an after-record is produced by the next ordinary measurement, which runs
 * whether or not the person applied anything, so its existence proves a
 * measurement happened and nothing more. Until Phase 5 a `RunRecord` carried
 * no content identity of the source at all, so there was nothing better to
 * read. Now there is.
 *
 * **Nothing here decides what a measurement means.** The outcome rule lives
 * in Witness's `resolveVerification`, in one place, so the two products and
 * the four interactions cannot resolve it four ways. This module produces the
 * inputs: whether the anchor says the change landed, and what each named
 * measurement came to.
 *
 * **Both halves must hold.** Equivalent behaviour with no untangling is not
 * success, because the work did not happen. Lower complexity with changed or
 * insufficient behaviour is not success, because something broke or nobody
 * can tell. The second half is why Phase 1 exists, and reporting `held` on
 * the tangle number alone would undo it.
 */
import { anchorApplied, resolveVerification } from '@projectrevivesolutions/witness';
import type { MeasurementResult, RepositoryPort, VerificationOutcome } from '@projectrevivesolutions/witness';
import type { Comparison } from './engine/tangle';
import type { RunRecord } from './runs';

export interface ResolvedRun {
  readonly outcome: VerificationOutcome;
  /** What the person is told, when the behaviour gate had something to say. */
  readonly sentence?: string;
}

/**
 * Resolves one governed run, or nothing.
 *
 * `undefined` means there is nothing to resolve: the run did not come from a
 * governed attempt, or its outcome is already recorded, or the anchor says
 * the person has not applied the proposal yet. **`not-run` is not written**,
 * because the decision is still open and the next measurement asks again;
 * writing it would close something that has not finished.
 */
export function resolveGovernedRun(run: RunRecord, comparison: Comparison, repository: RepositoryPort): ResolvedRun | undefined {
  if (!run.anchor || !run.governedInteractionId || run.verification) {
    return undefined;
  }

  const applied = anchorApplied(run.anchor, repository);

  const results: MeasurementResult[] = [
    {
      measurement: 'function-complexity',
      outcome: comparison.withinLimit ? 'met' : 'not-met',
    },
    {
      // The behaviour gate's own answer. Absent means no comparison has been
      // reached yet, and rule 89 makes that insufficient rather than a pass:
      // a lower number with nobody able to say the code still behaves the
      // same is not a fix, it is an unanswered question.
      measurement: 'behaviour-equivalence',
      outcome: run.behaviour?.verdict === 'equivalent' ? 'met' : run.behaviour?.verdict === 'changed' ? 'not-met' : 'insufficient',
    },
  ];

  const outcome = resolveVerification({
    rule: {
      kind: 're-measure',
      measurements: ['function-complexity', 'behaviour-equivalence'],
      target: { kind: 'boundary', path: run.path, name: run.name },
    },
    appliedToTarget: applied,
    results,
  });

  if (outcome === 'not-run') {
    return undefined;
  }
  return run.behaviour ? { outcome, sentence: run.behaviour.sentence } : { outcome };
}
