/**
 * UntangleIt's two findings, each built from the measurement that produced it.
 *
 * **Both read `RunRecord.behaviour` directly.** That field is what
 * `compareBehaviour` wrote from Witness's `verdictFor`, and the verdict, the
 * comparison count, the insufficient reason and the sentence are all as the
 * comparator left them. Nothing here compares anything or re-decides a
 * verdict; there is one comparator in the toolkit and it is not in the agent
 * layer.
 *
 * **UntangleIt reaches two of the five conditions, and that is a fact about
 * the product rather than about the interaction.** `decision-unverified`,
 * `coverage-unreachable` and `coverage-density-shortfall` are produced by
 * DeepTest's decision store and density engine, neither of which UntangleIt
 * has. `finding.explain` is registered identically in both, because it is
 * the same interaction.
 *
 * The classification is written by `findingPacket` and cannot be chosen
 * here: `insufficient-evidence` / `unclassified` says the cause is not
 * established and says nothing about whether the finding happened. It
 * happened, and it was measured.
 */
import { findingPacket } from '@projectrevivesolutions/witness';
import type { GovernancePacket } from '@projectrevivesolutions/witness';
import type { RunRecord } from '../runs';

function label(run: RunRecord): string {
  return `${run.boundary?.container ? `${run.boundary.container}.` : ''}${run.name}()`;
}

/**
 * The behaviour gate's answer for the latest round, when it is worth
 * explaining.
 *
 * Undefined for `equivalent` and for a gate that did not run: neither is a
 * finding. An absent `behaviour` is not a pass and is not a finding either,
 * and the run record already reads that way.
 */
export function behaviourFinding(run: RunRecord): GovernancePacket | undefined {
  const b = run.behaviour;
  if (!b || b.verdict === 'equivalent') {
    return undefined;
  }
  const where = run.boundary?.path ?? run.path;
  if (b.verdict === 'changed') {
    return findingPacket({
      condition: 'behaviour-changed',
      measured: [
        { text: b.sentence, source: 'witness' },
        { text: `${b.compared ?? 0} calls were compared, before and after the untangling, and they do not agree.`, source: 'witness' },
        { text: `The method is ${label(run)} in ${where}.`, source: 'untangleit' },
      ],
      headline: `${label(run)} does not do what it did before it was untangled.`,
      known: [
        'The same tests were run before and after, the same calls were paired, and at least one produced a different result.',
        b.sentence,
        'The tangle may well have come down. That is a separate measurement, and it does not make this one a pass.',
      ],
      context: [{ name: 'Where', value: where }],
    });
  }
  return findingPacket({
    condition: 'behaviour-insufficient',
    measured: [
      { text: b.sentence, source: 'witness' },
      { text: `The comparator reported: ${b.reason ?? 'no reason recorded'}.`, source: 'witness' },
      { text: `The method is ${label(run)} in ${where}.`, source: 'untangleit' },
    ],
    headline: `The behaviour gate could not reach a verdict on ${label(run)}.`,
    known: [
      'The comparison ran and stopped short of a verdict, for the reason recorded above.',
      'The method is neither shown to have changed nor shown to be the same.',
    ],
    context: [{ name: 'Where', value: where }],
  });
}
