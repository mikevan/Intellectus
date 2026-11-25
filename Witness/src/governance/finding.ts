/**
 * The packet for a measurement that completed and produced a finding.
 *
 * **A finding is not a failure**, and the whole of this file exists to keep
 * those apart. `failure.explain` owns every case where the requested
 * analysis could not complete. `finding.explain` owns the cases where it
 * completed perfectly and the answer it produced is one the person may want
 * explained: this method behaves differently now, this comparison could not
 * reach a verdict, this decision is not confirmed, these lines cannot be
 * reached, this line has fewer tests than it has ways through it.
 *
 * **Two facts, and they are not the same fact.** The finding happened; that
 * is measured and it is established. Why it happened is not established, and
 * the toolkit has no rule that would establish it. `insufficient-evidence`
 * and `unclassified` say the second and say nothing at all about the first.
 * A model handed only the word "unclassified" will reach for the more
 * familiar reading, that the measurement itself may be unreliable, and the
 * person then learns nothing from a check that worked. The constraints say
 * so, the prompt says so in its own branch, and the tests hold both.
 *
 * **There is one builder because there is one classification.** Every
 * finding is `insufficient-evidence` / `unclassified`, and no caller may
 * choose otherwise: the class is written here, not taken as an argument.
 * Nothing in this file classifies anything, and nothing outside it can
 * classify a finding either.
 */
import type { FindingCondition } from './constraints';
import { findingConstraints } from './constraints';
import { NOTHING_TO_VERIFY, NO_AUTHORIZATION_NEEDED, ONE_CORRECTION, buildPacket } from './packet';
import type { GovernancePacket } from './packet';

export interface FindingInput {
  /** Which of the five findings this is. */
  readonly condition: FindingCondition;
  /**
   * What was measured, and by what. Every item is `measurement` origin,
   * because every one of them is a number or a verdict the toolkit
   * computed rather than a line it read out of somebody's output.
   */
  readonly measured: ReadonlyArray<{ readonly text: string; readonly source: string }>;
  /** One line naming the finding, for the person. */
  readonly headline: string;
  /** What the measurement established. At least one, or there is no finding. */
  readonly known: readonly string[];
  /** The runner, when a runner produced the measurement. Omitted otherwise. */
  readonly runner?: string;
  readonly context?: ReadonlyArray<{ readonly name: string; readonly value: string }>;
}

/**
 * The one sentence every finding's `unknown` carries, stated once.
 *
 * It says the cause is open. It deliberately does not say the finding is
 * open, and the difference between those two sentences is the architectural
 * rule this whole interaction is built on.
 */
export const CAUSE_NOT_ESTABLISHED = 'Why this happened. The measurement establishes what happened and nothing about its cause, and the toolkit has no rule that would establish one from what it has.';

export function findingPacket(input: FindingInput): GovernancePacket {
  if (input.measured.length === 0) {
    throw new Error(`A ${input.condition} finding with nothing measured is not a finding. The packet is not built.`);
  }
  if (input.known.length === 0) {
    throw new Error(`A ${input.condition} finding that states nothing known would travel as pure uncertainty, which is the one reading this interaction exists to prevent.`);
  }
  return buildPacket({
    evidence: input.measured.map((m) => ({ origin: 'measurement' as const, text: m.text, source: m.source })),
    classification: {
      // Written here and nowhere else. A finding is a result, not a cause:
      // the gate saying `changed` does not establish why it changed, and a
      // shortfall does not establish whose doing it is. Naming any other
      // class would be naming a cause nobody measured.
      failureClass: 'insufficient-evidence',
      condition: input.condition,
      confidence: 'unclassified',
      label: 'measured finding',
    },
    objective: 'explain',
    allowed: { readable: [], proposable: [], mayPropose: false },
    constraints: findingConstraints(input.condition),
    validators: ['V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: NO_AUTHORIZATION_NEEDED,
    verification: NOTHING_TO_VERIFY,
    ...(input.runner === undefined ? {} : { runner: input.runner }),
    headline: input.headline,
    context: input.context ?? [],
    known: [...input.known],
    unknown: [CAUSE_NOT_ESTABLISHED],
    // Nothing is recommended. A cause nobody established has no remedy the
    // toolkit can stand behind.
    remediation: [],
    offers: ['explain'],
  });
}
