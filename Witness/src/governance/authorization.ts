/**
 * What the person is asked, and what they answered.
 *
 * Rule 92. Polyglot is built for vibe coders, and the working assumption is
 * that the person may not be able to judge whether source code is correct. A
 * product that shows them a diff and treats the click as sign-off has quietly
 * made them the engineering validator, and will then blame them for a defect
 * they had no way to see. So the question put to them is about the attempt,
 * not about the code:
 *
 *   UntangleIt found this function is too complex. Copilot proposes breaking
 *   it into smaller pieces without changing what the application does.
 *   Existing behaviour is protected by Witness and will be compared before
 *   and after. Only these files may change. Do you want Polyglot to let
 *   Copilot attempt this change?
 *
 * Never "here is a diff, do you approve this code". A diff may still be
 * shown, as evidence and for people who want it, but understanding it must
 * never be a precondition for meaningful authorization.
 *
 * The five points, all of them, every time: what problem was measured, what
 * outcome is being attempted, what is allowed to change, what must remain
 * unchanged, and what Polyglot will measure afterwards to decide whether the
 * attempt succeeded. Every one comes out of the packet. A packet that cannot
 * produce all five is missing one of the ten fields, which `buildPacket`
 * already refuses, so there is no path to a brief with a hole in it.
 *
 * Deterministic, and this is the interesting one under rule 88. Five plain
 * sentences for somebody who cannot read the code is exactly the work rule 86
 * wants an agent doing, and it stays static anyway. This text is the thing
 * the person's approval attaches to. An agent that softened "what must remain
 * unchanged", or dropped the fifth point, would have narrowed the protections
 * the person thought they were getting, and nobody would see it happen. The
 * structure and its content are ours; the sentences a model writes go
 * everywhere else in the product.
 */
import { createHash } from 'node:crypto';
import type { GovernancePacket } from './packet';
import type { EffectiveConstraints } from './reconcile';
import { coverageOf } from './validators';
import type { InteractionId, InteractionSpec } from './registry';

/** The five points, plus the question they lead to. */
export interface AuthorizationBrief {
  readonly interactionId: InteractionId;
  readonly packetId: string;
  /** 1. What problem was measured. */
  readonly measured: readonly string[];
  /** 2. What outcome is being attempted. */
  readonly outcome: string;
  /** 3. What is allowed to change. */
  readonly mayChange: readonly string[];
  /**
   * 4. What must remain unchanged, grouped by how far Polyglot can prove it.
   *
   * **This used to be one flat list and that made the brief untrue.** After
   * Phase 4 the constraint set mixes protections Polyglot enforces (C1, C4)
   * with ones it partly enforces (C2, C8) and with instructions nothing
   * checks (C5, C6, C7). Rendered identically, a person would read "do not
   * remove code that works around a known limitation" in the same voice and
   * the same place as "do not touch anything inside .keepsafe", and would
   * reasonably conclude Polyglot guarantees both. It guarantees one.
   *
   * Rule 92 exists because the person may not be able to judge the code, so
   * the engineering system carries the burden and tells them the truth about
   * what it did. A brief presenting an unproven instruction as a protection
   * is the same failure as showing a diff and treating the click as
   * sign-off. The principle did not change; this is what keeps it true once
   * advisory and partial constraints exist.
   *
   * The grouping is derived from the constraint metadata by `coverageOf`,
   * never hand-written, because a hand-written list of what is enforced
   * drifts the first time a validator changes and the place it would drift
   * is here, where somebody is deciding something.
   */
  readonly mustNotChange: {
    /** Polyglot checks these and will not accept a change that breaks one. */
    readonly checked: readonly string[];
    /** Polyglot checks part of these. `gap` is the part it does not. */
    readonly partlyChecked: readonly { readonly prose: string; readonly gap: string }[];
    /** Polyglot states these to the assistant and cannot prove it listened. */
    readonly statedOnly: readonly string[];
  };
  /** 5. What Polyglot will measure afterwards. */
  readonly verification: string;
  /** The yes-or-no question, about the attempt. */
  readonly question: string;
  /** Digest of the five points and the question, for the governance record. */
  readonly digest: string;
}

/** The person's answer, and the metadata the record needs. */
export interface AuthorizationEvent {
  readonly interactionId: InteractionId;
  readonly packetId: string;
  /** The brief they actually read. A digest, never the source they never saw. */
  readonly briefDigest: string;
  readonly granted: boolean;
  readonly at: string;
  /** Who answered, as the host knows them. Never inferred here. */
  readonly by: string;
}

export class AuthorizationError extends Error {}

/**
 * What a measurement will be called in a sentence a person reads.
 *
 * **Point 5 names only what Polyglot will actually measure.** The first of
 * these used to read "record what the code does before and after, and
 * compare them", which is not what the instrument does and was the same
 * overclaim in the one place it does the most harm: the sentence somebody
 * reads while deciding.
 *
 * Witness does not record what the code does. A boundary `Observation`
 * carries the target, the test it ran under, an entry index, a nesting
 * depth, the captured arguments, and one outcome of return, throw, resolve,
 * or reject with its value. It records no side effects. Ordering is observed
 * only among entries into a boundary it was asked to watch. An `equivalent`
 * verdict proves the observations that were made and nothing past them,
 * which is why the comparator has six insufficient reasons.
 *
 * So the sentence is longer and true. The rest are checked against their
 * instruments in the same pass: complexity really does re-count the paths
 * through a function, density really does re-measure tests against code, and
 * the suite really is re-run.
 */
const MEASUREMENT_WORDS: Readonly<Record<string, string>> = Object.freeze({
  'behaviour-equivalence': 'record what the code returns or throws at the places we watch, before and after, and compare them',
  'function-complexity': 'count how many ways there are through the function again',
  'coverage-density': 'measure the tests against the code again',
  'test-suite': 'run the project\'s own tests again',
  'existing-tests-still-ran': 'check that the tests which already exercised this code still do',
});

/**
 * Builds the brief from the packet.
 *
 * Every point is refused rather than filled in from nothing. An outcome we
 * cannot state is an attempt nobody can authorize, and a silent placeholder
 * would be worse than a refusal: the person would answer a question with a
 * hole in it and the record would show they agreed.
 */
export function authorizationBrief(packet: GovernancePacket, spec: InteractionSpec, effective: EffectiveConstraints): AuthorizationBrief {
  if (effective.interactionId !== spec.id || effective.packetId !== packet.id) {
    throw new AuthorizationError('This constraint set was reconciled for a different interaction or packet. The person would be shown protections that do not belong to what they are authorizing.');
  }
  if (spec.objective !== packet.objective) {
    throw new AuthorizationError(`The packet declares the objective ${packet.objective} and ${spec.id} declares ${spec.objective}.`);
  }
  if (packet.authorization.kind === 'none-required') {
    throw new AuthorizationError(`${spec.id} changes nothing, so there is nothing for a person to authorize. Do not put a consent question in front of somebody for an explanation.`);
  }

  // 1. What was measured. The packet's own established facts, never a summary
  //    of them written somewhere else.
  const measured = packet.known.length > 0 ? [...packet.known] : [packet.headline];
  if (measured.length === 0 || measured.every((m) => m.trim() === '')) {
    throw new AuthorizationError('The packet states nothing that was measured, so the first of the five points cannot be made.');
  }

  // 3. What may change.
  const mayChange = [...packet.allowed.proposable];
  if (mayChange.length === 0) {
    throw new AuthorizationError('The packet names no paths a change may touch, so the third of the five points cannot be made.');
  }

  // 4. What must not. From the reconciled set, not the packet's own, so the
  //    person is told every protection that actually binds this attempt. A
  //    brief built from the packet alone would omit the ones the registered
  //    interaction requires, and they would be agreeing to less than they
  //    thought (M19).
  //
  //    Grouped by what Polyglot can actually prove, so they are not told
  //    that an instruction is a guarantee.
  const checked: string[] = [];
  const partlyChecked: Array<{ prose: string; gap: string }> = [];
  const statedOnly: string[] = [];
  for (const c of effective.constraints) {
    switch (coverageOf(c)) {
      case 'checked':
        checked.push(c.prose);
        break;
      case 'partly-checked':
        partlyChecked.push({ prose: c.prose, gap: c.rule.kind === 'advisory' ? '' : (c.rule.unchecked ?? '') });
        break;
      default:
        statedOnly.push(c.prose);
    }
  }
  if (checked.length + partlyChecked.length + statedOnly.length === 0) {
    throw new AuthorizationError('The packet carries no constraints, so the fourth of the five points cannot be made.');
  }
  if (checked.length === 0 && partlyChecked.length === 0) {
    // Every protection on this attempt is an instruction nobody checks. That
    // is not something a person can meaningfully authorize: they would be
    // agreeing to a change on the strength of promises Polyglot has no way
    // to keep, and the record would show they agreed. Refusing is the honest
    // answer, and it is a defect in the interaction rather than in their
    // decision.
    throw new AuthorizationError(
      'Every protection on this attempt is an instruction Polyglot cannot check, so there is nothing for a person to rely on in agreeing to it. An interaction that changes files needs at least one protection that is actually enforced.',
    );
  }
  const mustNotChange = Object.freeze({
    checked: Object.freeze(checked),
    partlyChecked: Object.freeze(partlyChecked.map((p) => Object.freeze(p))),
    statedOnly: Object.freeze(statedOnly),
  });

  // 5. What will be measured afterwards.
  if (packet.verification.kind !== 're-measure') {
    throw new AuthorizationError('The packet declares no measurement to verify the attempt, so the fifth of the five points cannot be made.');
  }
  // Every named measurement, in the order the rule names them, because the
  // person is owed all of what will be checked rather than the first of it.
  // Rule 92: what they are told is what actually happens afterwards.
  const verification = packet.verification.measurements
    .map((m) => MEASUREMENT_WORDS[m] ?? `re-run the ${m} measurement`)
    .join(', and ');

  const outcome = packet.headline.trim();
  if (outcome === '') {
    throw new AuthorizationError('The packet states no outcome, so the second of the five points cannot be made.');
  }

  const question = `Do you want Polyglot to let your assistant attempt this change?`;
  const brief: Omit<AuthorizationBrief, 'digest'> = {
    interactionId: spec.id,
    packetId: packet.id,
    measured,
    outcome,
    mayChange,
    mustNotChange,
    verification,
    question,
  };
  return Object.freeze({ ...brief, digest: digestOf(brief) });
}

/**
 * The brief as the lines a person reads, in the fixed order of rule 92.
 *
 * Returned as lines rather than one blob so a product can lay them out in its
 * own surface, and so a test can assert that all five arrived.
 */
export function briefLines(brief: AuthorizationBrief): string[] {
  const lines: string[] = [];
  lines.push('What we found');
  for (const m of brief.measured) {
    lines.push(`  ${m}`);
  }
  lines.push('');
  lines.push('What we want to try');
  lines.push(`  ${brief.outcome}`);
  lines.push('');
  lines.push('What may change');
  for (const p of brief.mayChange) {
    lines.push(`  ${p}`);
  }
  lines.push('');
  // Three blocks, and an empty one is omitted rather than shown with
  // nothing under it. No constraint ids, no validator names, and not the
  // word advisory: the distinction is translated, not dumped.
  lines.push('What must not change');
  if (brief.mustNotChange.checked.length > 0) {
    lines.push('  We will check these, and we will not accept a change that breaks one:');
    for (const c of brief.mustNotChange.checked) {
      lines.push(`    ${c}`);
    }
  }
  for (const p of brief.mustNotChange.partlyChecked) {
    lines.push(`  We will check part of this:`);
    lines.push(`    ${p.prose}`);
    lines.push(`    We cannot check ${p.gap}.`);
  }
  if (brief.mustNotChange.statedOnly.length > 0) {
    lines.push('  We have told your assistant these, and we cannot prove it listened:');
    for (const c of brief.mustNotChange.statedOnly) {
      lines.push(`    ${c}`);
    }
  }
  lines.push('');
  lines.push('How we will check afterwards');
  lines.push(`  We will ${brief.verification}, and tell you what it showed. If it does not hold, we will say the attempt failed.`);
  lines.push('');
  lines.push(brief.question);
  return lines;
}

/**
 * Records the person's answer.
 *
 * It carries the digest of the brief and nothing of the code. A diff pasted
 * into an authorization record proves only that a diff existed, and it
 * recreates the second unaudited copy of the customer's source that rule 70
 * exists to prevent.
 */
export function authorizationEvent(brief: AuthorizationBrief, granted: boolean, by: string, at?: string): AuthorizationEvent {
  return Object.freeze({
    interactionId: brief.interactionId,
    packetId: brief.packetId,
    briefDigest: brief.digest,
    granted,
    at: at ?? new Date().toISOString(),
    by,
  });
}

function digestOf(brief: Omit<AuthorizationBrief, 'digest'>): string {
  return createHash('sha256').update(JSON.stringify(brief)).digest('hex');
}
