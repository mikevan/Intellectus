/**
 * UntangleIt's governed packet for `method.propose-untangle`.
 *
 * The measured evidence, turned into the ten fields. **No hand-written
 * prose**: rule 87 is about exactly the brief builder this replaced, and the
 * sentence the person reads is built by `authorizationBrief` from the packet
 * rather than assembled here.
 *
 * **The anchor is a digest of the whole authorized file**, which is exactly
 * what C3 binds. File-level rather than method-level deliberately: an
 * untangle is supposed to move the method, so a method-extent digest would be
 * measuring the thing that is meant to change and would break the moment the
 * method was split. It is also the first content identity of the source a
 * `RunRecord` has ever carried.
 *
 * **Both measurements must hold.** Equivalent behaviour with no untangling is
 * not success, because the work did not happen. Lower complexity with changed
 * or insufficient behaviour is not success, because something broke or nobody
 * can tell.
 */
import { ONE_CORRECTION, STANDING_CONSTRAINTS, USER_AUTHORIZES_ATTEMPT, buildPacket, contentDigest } from '@projectrevivesolutions/witness';
import type { ApplicationAnchor, GovernancePacket, Runner } from '@projectrevivesolutions/witness';

export interface UntangleProposalInput {
  readonly path: string;
  readonly name: string;
  readonly startLine: number;
  /** The number the run is judged by. */
  readonly before: number;
  readonly limit: number;
  readonly measure: 'ways' | 'mbcc';
  readonly runner: Runner;
  readonly read: (relativePath: string) => string | undefined;
}

export type UntangleProposal =
  | { readonly ok: true; readonly packet: GovernancePacket; readonly anchor: ApplicationAnchor }
  | { readonly ok: false; readonly why: string };

export function untangleProposalPacket(input: UntangleProposalInput): UntangleProposal {
  const current = input.read(input.path);
  if (current === undefined) {
    return { ok: false, why: `UntangleIt could not read ${input.path}, so it cannot tell later whether your change was applied.` };
  }

  // The whole clause per measure, not a noun substituted into one sentence.
  // Substituting produced "total() has a ways through it of 12", which is
  // broken English in text the person reads, and it was reachable: a run
  // record written before 0.1.11 carries no `measure`, so `anotherRound`
  // falls back to 'ways' and every legacy upgrade hit it.
  const measured = input.measure === 'mbcc' ? `a tangle of ${input.before}` : `${input.before} ways through it`;
  const packet = buildPacket({
    evidence: [
      {
        origin: 'measurement',
        text: `${input.name}() has ${measured}; the limit is ${input.limit}.`,
        source: 'complexity',
      },
    ],
    classification: { failureClass: 'source', condition: 'over-limit', confidence: 'classified', label: 'source' },
    objective: 'propose',
    allowed: { readable: [input.path], proposable: [input.path], mayPropose: true },
    // C3 is absent on purpose: its `allow` is an instance parameter bound
    // from `allowed.proposable` at reconciliation, and a packet supplying its
    // own would be a second source for one scope (M21).
    constraints: [STANDING_CONSTRAINTS.C1, STANDING_CONSTRAINTS.C2, STANDING_CONSTRAINTS.C4, STANDING_CONSTRAINTS.C8],
    validators: ['V-existing-tests', 'V-public-contract', 'V-forbidden-paths', 'V-refusal-wellformed', 'V-scope-paths', 'V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: {
      kind: 're-measure',
      measurements: ['function-complexity', 'behaviour-equivalence'],
      target: { kind: 'boundary', path: input.path, name: input.name },
    },
    runner: input.runner,
    headline: `Break ${input.name}() into smaller pieces without changing what it does.`,
    known: [`${input.name}() has ${measured}, and your limit is ${input.limit}.`],
    offers: ['fix'],
  });

  return { ok: true, packet, anchor: { kind: 'content-digest', path: input.path, digest: contentDigest(current) } };
}
