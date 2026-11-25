/**
 * Did the tests that already exercised this code still exercise it?
 *
 * **It adds no collection.** `LineResult.tests` is already a sorted set of
 * distinct test identifiers per line, built from the attribution records
 * Witness's hooks write and already rendered to people by the report. The set
 * before a proposal and the set after are both there; nothing in the tree
 * took the difference. That is all this does.
 *
 * If the before-set were not already computed, the honest answer would have
 * been to keep the narrower guarantee and say so, and that is the answer that
 * was prepared before looking.
 *
 * **Per targeted line, never one flattened union.** A union over every
 * identifier seen anywhere would hide a pre-existing test ceasing to exercise
 * one target line while still appearing on another, and that is exactly the
 * loss worth catching. Each target line's before-set is compared against its
 * own after-set, and the measurement is met only when **every** target line's
 * before-set is still a subset of its after-set.
 *
 * **What it establishes, and what it does not.** It establishes that a
 * previously observed test no longer executes the target. **Why** is not
 * decided. A disabled test and a regenerated test name produce the same
 * observation, and the sentence says what was observed rather than what it
 * means, because rule 89 forbids manufacturing the certainty. The outcome
 * does not claim sabotage and it does not claim innocence.
 *
 * **Two limits worth knowing, from the identifier itself.** Two sibling tests
 * with the same name in one suite produce one identifier, so if one of them
 * disappears the identifier is still present and this reports met. And a test
 * whose name is built from something non-deterministic never matches, so such
 * a project reports not-met on every comparison including ones where nothing
 * was proposed. Both are stated rather than smoothed over; the identity is
 * stable for the ordinary case, and an unchanged-run test pins that.
 *
 * Deterministic, with the reason (rule 88). This decides whether a proposal
 * silenced the tests that hold it honest.
 */
import type { MeasurementOutcome } from '@projectrevivesolutions/witness';
import type { AnalysisResult } from '../engine/types';

export interface VerificationTarget {
  readonly path: string;
  readonly line: number;
  /** That line's `LineResult.tests` when the proposal was made. */
  readonly testsBefore: readonly string[];
}

export interface ExistingTestsResult {
  readonly outcome: MeasurementOutcome;
  /** Which targets lost tests, and which tests, for the person's sentence. */
  readonly missing: ReadonlyArray<{ readonly path: string; readonly line: number; readonly tests: readonly string[] }>;
}

/**
 * Compares each target's before-set against the same line in a later result.
 *
 * A target whose line cannot be found in the later result is `insufficient`,
 * not `not-met`: the code moved or the file was not measured this time, so
 * nothing was observed about it, and rule 89 forbids reporting an absence of
 * evidence as a finding.
 */
export function existingTestsStillRan(targets: readonly VerificationTarget[], now: AnalysisResult): ExistingTestsResult {
  if (targets.length === 0) {
    return { outcome: 'insufficient', missing: [] };
  }

  const missing: Array<{ path: string; line: number; tests: string[] }> = [];
  let anyUnmeasured = false;

  for (const target of targets) {
    const file = now.files.find((f) => f.path === target.path);
    const line = file?.lines.find((l) => l.line === target.line);
    if (file === undefined || file.unmeasured !== undefined || line === undefined) {
      anyUnmeasured = true;
      continue;
    }
    const after = new Set(line.tests);
    const lost = target.testsBefore.filter((identifier) => !after.has(identifier));
    if (lost.length > 0) {
      missing.push({ path: target.path, line: target.line, tests: lost });
    }
  }

  if (missing.length > 0) {
    // A failure outranks an unmeasured target. Something was observed to have
    // stopped running, and that is a finding whether or not another line
    // could be checked.
    return { outcome: 'not-met', missing };
  }
  return { outcome: anyUnmeasured ? 'insufficient' : 'met', missing: [] };
}

/**
 * What the person is told, naming the line.
 *
 * "A test that previously exercised line 42 was not observed this time" is
 * actionable in a way a whole-proposal count is not.
 */
export function existingTestsSentence(result: ExistingTestsResult): string {
  if (result.outcome === 'met') {
    return 'Every test that already exercised this code still does.';
  }
  if (result.outcome === 'insufficient') {
    return 'Polyglot could not tell whether the tests that already exercised this code still do, because the lines it was watching were not measured this time.';
  }
  const first = result.missing[0];
  const count = result.missing.reduce((n, m) => n + m.tests.length, 0);
  const where = result.missing.length === 1 ? `line ${first.line} of ${first.path}` : `${result.missing.length} of the lines this proposal was about`;
  return count === 1
    ? `A test that previously exercised ${where} was not observed this time.`
    : `${count} tests that previously exercised ${where} were not observed this time.`;
}
