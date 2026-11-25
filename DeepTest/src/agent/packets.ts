/**
 * DeepTest's governed packets: the measured evidence, turned into the ten
 * fields, with the destination decided before the model is reached.
 *
 * **The branch happens here, before the packet exists.** The destination is
 * chosen from measured attribution, read at the width of the target rather
 * than of the source file, and a target exercised by several test files
 * refuses with zero model calls. That is `resolveDestination`'s job and this
 * module's is to turn its answer into a packet whose `allowed.proposable`,
 * expected operation and application anchor all agree with it.
 *
 * **Nothing here is hand-written prose.** Rule 87: a brief assembled by hand
 * inside a governed packet is the thing the rule was written about. The
 * evidence is the measurement DeepTest already has, the constraints come from
 * the registry and the reconciler, and the sentence the person reads is built
 * by `authorizationBrief` from the packet.
 */
import { ONE_CORRECTION, STANDING_CONSTRAINTS, USER_AUTHORIZES_ATTEMPT, buildPacket, contentDigest } from '@projectrevivesolutions/witness';
import type { ApplicationAnchor, GovernancePacket, Runner } from '@projectrevivesolutions/witness';
import type { AttributedPair, Destination } from './testPath';
import { resolveDestination } from './testPath';

/** One measured gap this proposal is about. */
export interface MeasuredGap {
  readonly path: string;
  readonly line: number;
  /** That line's attributed test identifiers, now. */
  readonly tests: readonly string[];
  readonly gap: number;
  /** The untaken route, in the words the report already uses. */
  readonly because: string;
}

export interface TestProposalInput {
  readonly source: string;
  readonly gaps: readonly MeasuredGap[];
  readonly pairsForSource: readonly AttributedPair[];
  readonly pairsInProject: readonly AttributedPair[];
  readonly runner: Runner;
  /** Reads a workspace-relative file, for the content digest on branch A. */
  readonly read: (relativePath: string) => string | undefined;
  readonly exists: (relativePath: string) => boolean;
  /** `function.propose-tests` names the function; `coverage.propose-test` does not. */
  readonly functionName?: string;
}

export type TestProposal =
  | {
      readonly ok: true;
      readonly packet: GovernancePacket;
      readonly anchor: ApplicationAnchor;
      readonly operation: 'create' | 'modify';
      readonly destination: string;
    }
  /** Knowable before the model, so it lands at rule 94's gate: no capability, no request. */
  | { readonly ok: false; readonly why: string };

/**
 * A packet for one of the two test-proposing interactions.
 *
 * `coverage.propose-test` passes one gap. `function.propose-tests` passes
 * every gap line that justifies the proposal, and the union of their
 * attributed test files must be exactly one destination: three lines
 * resolving to three suites is three destinations, and picking one would
 * silently attach tests for the other two gaps to a file that does not
 * exercise them.
 */
export function testProposalPacket(input: TestProposalInput): TestProposal {
  if (input.gaps.length === 0) {
    return { ok: false, why: 'There is no measured gap to propose a test for.' };
  }

  const destination: Destination = resolveDestination({
    source: input.source,
    testsPerTarget: input.gaps.map((g) => g.tests),
    pairsForSource: input.pairsForSource,
    pairsInProject: input.pairsInProject,
    exists: input.exists,
  });
  if (destination.kind === 'refuse') {
    return { ok: false, why: destination.why };
  }

  let anchor: ApplicationAnchor;
  if (destination.kind === 'create') {
    // Proven absent: the derivation refuses a path that exists, and
    // `V-response-shape` refuses a create over an existing file. The
    // transition is provable at both ends.
    anchor = { kind: 'path-created', path: destination.path };
  } else {
    const current = input.read(destination.path);
    if (current === undefined) {
      return {
        ok: false,
        why: `This code is exercised by ${destination.path}, and Polyglot could not read that file, so it cannot tell later whether your change was applied.`,
      };
    }
    anchor = { kind: 'content-digest', path: destination.path, digest: contentDigest(current) };
  }

  const what = input.functionName ? `${input.functionName}()` : `${input.source} line ${input.gaps[0].line}`;
  const packet = buildPacket({
    evidence: input.gaps.map((gap) => ({
      origin: 'measurement' as const,
      text: `${gap.path} line ${gap.line} is short by ${gap.gap}. ${gap.because}`,
      source: 'deeptest' as const,
    })),
    classification: { failureClass: 'source', condition: 'coverage-gap', confidence: 'classified', label: 'source' },
    objective: 'propose',
    allowed: {
      readable: [input.source, destination.path],
      // One path, and it is the one the anchor watches and the one C3 binds.
      proposable: [destination.path],
      mayPropose: true,
    },
    // The standing constraints this condition restates, identically, which
    // rule 93 allows and `assertSameMeaning` checks. **C3 is absent on
    // purpose**: its `allow` is an instance parameter bound from
    // `allowed.proposable` at reconciliation, and a packet supplying its own
    // would be a second source for one scope (M21). The registered spec
    // requires it and the reconciler produces it.
    constraints: [STANDING_CONSTRAINTS.C1, STANDING_CONSTRAINTS.C4, STANDING_CONSTRAINTS.C8],
    validators: ['V-existing-tests', 'V-forbidden-paths', 'V-refusal-wellformed', 'V-scope-paths', 'V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: {
      kind: 're-measure',
      measurements: ['coverage-density', 'existing-tests-still-ran'],
      // Targeted, never aggregate: a project-wide number can rise while the
      // line the person authorized work on closed nothing.
      target: { kind: 'lines', path: input.source, lines: input.gaps.map((g) => g.line) },
    },
    runner: input.runner,
    headline:
      destination.kind === 'create'
        ? `Write ${input.gaps.length === 1 ? 'a test' : 'tests'} for ${what} in a new file, ${destination.path}.`
        : `Add ${input.gaps.length === 1 ? 'a test' : 'tests'} for ${what} to ${destination.path}, without changing the tests already in it.`,
    known: input.gaps.map((gap) => `Line ${gap.line} is short by ${gap.gap}.`),
    offers: ['fix'],
  });

  return { ok: true, packet, anchor, operation: destination.kind === 'create' ? 'create' : 'modify', destination: destination.path };
}

export interface RefactorProposalInput {
  readonly source: string;
  readonly functionName: string;
  readonly startLine: number;
  readonly complexity: number;
  readonly limit: number;
  readonly runner: Runner;
  readonly read: (relativePath: string) => string | undefined;
}

export type RefactorProposal =
  | { readonly ok: true; readonly packet: GovernancePacket; readonly anchor: ApplicationAnchor }
  | { readonly ok: false; readonly why: string };

/**
 * A packet for `function.propose-refactor`.
 *
 * The anchor is a digest of **the whole authorized file**, which is exactly
 * what C3 binds. File-level rather than method-level deliberately: a refactor
 * is supposed to move the method, so a method-extent digest would be
 * measuring the thing that is meant to change and would break the moment the
 * method was split.
 */
export function refactorProposalPacket(input: RefactorProposalInput): RefactorProposal {
  const current = input.read(input.source);
  if (current === undefined) {
    return { ok: false, why: `Polyglot could not read ${input.source}, so it cannot tell later whether your change was applied.` };
  }

  const packet = buildPacket({
    evidence: [
      {
        origin: 'measurement',
        text: `${input.functionName}() has ${input.complexity} ways through it; the limit is ${input.limit}.`,
        source: 'complexity',
      },
    ],
    classification: { failureClass: 'source', condition: 'over-limit', confidence: 'classified', label: 'source' },
    objective: 'propose',
    allowed: { readable: [input.source], proposable: [input.source], mayPropose: true },
    // C3 is absent for the same reason as above. C2 is here because this
    // interaction changes product source, so its public contract is exactly
    // what must not move.
    constraints: [STANDING_CONSTRAINTS.C1, STANDING_CONSTRAINTS.C2, STANDING_CONSTRAINTS.C4, STANDING_CONSTRAINTS.C8],
    validators: ['V-existing-tests', 'V-public-contract', 'V-forbidden-paths', 'V-refusal-wellformed', 'V-scope-paths', 'V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: {
      kind: 're-measure',
      measurements: ['function-complexity', 'behaviour-equivalence'],
      target: { kind: 'function', path: input.source, name: input.functionName, startLine: input.startLine },
    },
    runner: input.runner,
    headline: `Break ${input.functionName}() into smaller pieces without changing what it does.`,
    known: [`${input.functionName}() has ${input.complexity} ways through it, and your limit is ${input.limit}.`],
    offers: ['fix'],
  });

  return { ok: true, packet, anchor: { kind: 'content-digest', path: input.source, digest: contentDigest(current) } };
}
