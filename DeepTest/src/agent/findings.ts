/**
 * DeepTest's four findings, each built from the measurement that produced it.
 *
 * **Every packet here consumes an existing deterministic source directly.**
 * Nothing in this file compares behaviour, decides a verification state,
 * works out reachability, or calculates a density. Those answers already
 * exist, they were computed by the engine and the gate, and recomputing any
 * of them in the agent layer would give the toolkit two answers to the same
 * question and no rule for which one is true. What this file does is read
 * the answer and say what was measured.
 *
 * Where each one comes from:
 *
 * - `behaviour-changed` and `behaviour-insufficient` read `Decision.behaviour`,
 *   which `verify.ts` wrote from Witness's `verdictFor`. The verdict, the
 *   comparison count, the insufficient reason and the sentence are all as the
 *   comparator left them.
 * - `decision-unverified` reads the `unverified` `DecisionState` and its
 *   `why`, which `withinLimitState` decided. The three reasons are its three.
 * - `coverage-unreachable` reads `FileResult.unreachableLines`, which
 *   `density.ts` filled from the parser's `FileStructure.unreachable`.
 * - `coverage-density-shortfall` reads one `Shortfall` from
 *   `AnalysisResult.shortfalls`, with its own `density`, `bar` and `gap`.
 *
 * **The classification is not here either.** `findingPacket` writes
 * `insufficient-evidence` / `unclassified` itself, and no caller may choose
 * otherwise. That pair says the cause is not established and says nothing
 * whatever about whether the finding happened: the finding happened, and it
 * was measured.
 */
import { findingPacket } from '@projectrevivesolutions/witness';
import type { GovernancePacket } from '@projectrevivesolutions/witness';
import type { Decision, UnverifiedReason } from '../decisions/decisions';
import type { FileResult, Shortfall } from '../engine/types';

/** What the toolkit calls a decision's function, for a headline. */
function named(decision: Decision): string {
  return `${decision.functionName ?? 'the function'}()`;
}

/**
 * The behaviour gate's verdict, when it reached one and it was `changed`, and
 * when it could not reach one at all.
 *
 * One function for two conditions because one stored field produces both, and
 * reading it twice in two places is how the two drift apart. It returns
 * undefined for `equivalent`, which is not a finding: nothing changed, and
 * there is nothing to explain.
 */
export function behaviourFinding(decision: Decision): GovernancePacket | undefined {
  const b = decision.behaviour;
  if (!b || b.verdict === 'equivalent') {
    return undefined;
  }
  const where = `${decision.path}:${decision.line}`;
  if (b.verdict === 'changed') {
    return findingPacket({
      condition: 'behaviour-changed',
      measured: [
        { text: b.sentence, source: 'witness' },
        { text: `${b.compared ?? 0} calls were compared, before and after, and they do not agree.`, source: 'witness' },
        { text: `The method is ${named(decision)} at ${where}.`, source: 'deeptest' },
      ],
      headline: `${named(decision)} does not do what it did before the change.`,
      known: [
        'The same tests were run before and after, the same calls were paired, and at least one produced a different result.',
        b.sentence,
      ],
      context: [{ name: 'Where', value: where }],
    });
  }
  return findingPacket({
    condition: 'behaviour-insufficient',
    measured: [
      { text: b.sentence, source: 'witness' },
      { text: `The comparator reported: ${b.reason ?? 'no reason recorded'}.`, source: 'witness' },
      { text: `The method is ${named(decision)} at ${where}.`, source: 'deeptest' },
    ],
    headline: `The behaviour gate could not reach a verdict on ${named(decision)}.`,
    known: [
      'The comparison ran and stopped short of a verdict, for the reason recorded above.',
      'The method is neither shown to have changed nor shown to be the same.',
    ],
    context: [{ name: 'Where', value: where }],
  });
}

/** What each of the three unverified reasons means, in the toolkit's own words. */
const UNVERIFIED: Readonly<Record<UnverifiedReason, string>> = Object.freeze({
  'not-recorded': 'The gate could not watch this method, so there is no before to compare against.',
  'not-compared': 'The gate watched this method and the second recording has not happened yet.',
  insufficient: 'The gate compared and could not reach a verdict.',
});

/**
 * A decision recorded as unverified, with the reason `withinLimitState`
 * decided.
 *
 * `why` is that function's answer and is used as given. The finer detail,
 * when the reason is `insufficient`, is the comparator's own reason on the
 * decision, and it is carried rather than re-derived.
 */
export function decisionUnverifiedFinding(decision: Decision, why: UnverifiedReason): GovernancePacket {
  const where = `${decision.path}:${decision.line}`;
  const measured = [
    { text: UNVERIFIED[why], source: 'deeptest' },
    { text: `The decision is on ${named(decision)} at ${where}, and its gate state is ${decision.behaviourGate ?? 'not recorded'}.`, source: 'deeptest' },
  ];
  if (why === 'insufficient' && decision.behaviour?.sentence) {
    measured.push({ text: decision.behaviour.sentence, source: 'witness' });
  }
  return findingPacket({
    condition: 'decision-unverified',
    measured,
    headline: `The fix to ${named(decision)} is not confirmed.`,
    known: [
      UNVERIFIED[why],
      'Unverified means the confirmation has not happened. It does not mean the change was rejected, and it does not mean the change is wrong.',
    ],
    context: [{ name: 'Where', value: where }],
  });
}

/**
 * The lines the parser found unreachable in one file.
 *
 * `unreachableLines` is `density.ts`'s answer, which it took from the
 * parser's `FileStructure.unreachable`. **There is no reason string for an
 * unreachable line, and none is invented here**: the finding is the
 * structure, and the numbers are the whole of what was measured.
 */
export function unreachableFinding(file: FileResult): GovernancePacket | undefined {
  if (file.unreachableLines.length === 0) {
    return undefined;
  }
  const count = file.unreachableLines.length;
  return findingPacket({
    condition: 'coverage-unreachable',
    measured: [
      { text: `${count} line${count === 1 ? '' : 's'} in ${file.path} cannot be reached by anything that executes.`, source: 'deeptest' },
      { text: `The lines are ${file.unreachableLines.join(', ')}.`, source: 'deeptest' },
    ],
    headline: `${count} line${count === 1 ? '' : 's'} in ${file.path} can never run.`,
    known: [
      'This was found by reading the structure of the code rather than by running it: every path that reaches that point has already returned, raised, broken or continued.',
      'No test can cover these lines, and their absence from the coverage is not a gap in the tests.',
    ],
    context: [{ name: 'File', value: file.path }],
  });
}

/**
 * One measured density shortfall.
 *
 * `density`, `bar` and `gap` are the `Shortfall`'s own numbers, straight from
 * `rankShortfalls`. Nothing is recalculated: `bar` is the ways through the
 * line, `density` the tests that reach it, and `gap` the difference the
 * engine already worked out.
 */
export function densityShortfallFinding(shortfall: Shortfall): GovernancePacket {
  const where = `${shortfall.path}:${shortfall.line}`;
  const untested = shortfall.status === 'untested';
  return findingPacket({
    condition: 'coverage-density-shortfall',
    measured: [
      { text: `Line ${shortfall.line} of ${shortfall.path} has ${shortfall.bar} way${shortfall.bar === 1 ? '' : 's'} through it and ${shortfall.density} test${shortfall.density === 1 ? '' : 's'} reaching it.`, source: 'deeptest' },
      { text: `The shortfall is ${shortfall.gap}, and the line is ${shortfall.status}.`, source: 'deeptest' },
    ],
    headline: untested ? `Line ${shortfall.line} of ${shortfall.path} is not tested at all.` : `Line ${shortfall.line} of ${shortfall.path} has fewer tests than it has ways through it.`,
    known: [
      `Both numbers were measured: ${shortfall.bar} from the structure of the line, ${shortfall.density} from which tests were recorded reaching it.`,
      'A shortfall says how many ways through the line no test tells apart. It does not say which way, and it does not say the line is wrong.',
    ],
    context: [{ name: 'Where', value: where }],
  });
}
