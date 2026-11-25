/**
 * The governance packet: the ten-field contract, as data.
 *
 * Every governed interaction declares all ten fields before a model is asked
 * anything. One that cannot declare them is not an interaction. The fields
 * are listed in order below, numbered as the contract numbers them, so that
 * a reader can check the code against the contract without a translation
 * step.
 *
 * This supersedes `ProblemPacket` in `../diagnosis` as the model. That type
 * still exists and still has its 1.0.19 shape, because both products consume
 * it and the failure-assistance path works. It is now produced FROM a packet
 * built here, by `toProblemPacket`, and the direction is one way on purpose.
 *
 * There is no `toGovernancePacket`. A `ProblemPacket` cannot become a
 * governance packet, because it does not carry typed evidence, structured
 * constraints, an objective, validators, an authorization rule, or a
 * verification rule, and a conversion would have to invent all six. Inventing
 * them is precisely the failure the contract exists to prevent: a packet that
 * looks governed, passes every downstream check, and was never governed at
 * all. The compatibility view is an output. It is never an input.
 *
 * Deterministic, and here is the reason rather than the habit (rule 88).
 * This file defines what counts as evidence, what a classification may claim,
 * and which combinations of the ten fields are coherent. Those are the
 * boundaries that make everything agentic above them safe. An agent deciding
 * them would be deciding whether it is allowed to be trusted.
 */
import { createHash } from 'node:crypto';
import { assertConstraintShape, bindingFor, isStandingConstraintId } from './constraints';
import type { Constraint, ConstraintId } from './constraints';
import type { ValidatorId } from './validators';

// ---------------------------------------------------------------------------
// Field 1. Deterministic evidence
// ---------------------------------------------------------------------------

/**
 * Where a piece of evidence came from.
 *
 * Every member is something the toolkit observed for itself. There is no
 * member for model output, and there must never be one: rule 13 and rule 24
 * hold that AI never creates a fact the product presents as measured, and a
 * union that could express "the assistant said so" would make that rule a
 * matter of discipline rather than of type.
 *
 * `EVIDENCE_ORIGINS` is the same list as a value, so a test can assert the
 * membership exactly. Adding a member fails that test rather than passing
 * quietly, which is the point of having it.
 */
export type EvidenceOrigin = 'runner-output' | 'parse' | 'observation' | 'file' | 'measurement';

export const EVIDENCE_ORIGINS: readonly EvidenceOrigin[] = Object.freeze(['runner-output', 'parse', 'observation', 'file', 'measurement'] as const);

/** One established fact, with where it came from. */
export interface EvidenceItem {
  readonly origin: EvidenceOrigin;
  /** Verbatim. Never paraphrased, never summarised. */
  readonly text: string;
  /** The process, path, or run it came from, so a reader can go and look. */
  readonly source: string;
}

// ---------------------------------------------------------------------------
// Field 2. Classification and confidence
// ---------------------------------------------------------------------------

/**
 * The eight failure classes, kept distinct (rule 22).
 *
 * This is a taxonomy invariant and not a promise of eight classifiers. Where
 * deterministic evidence supports a class, the toolkit may use it. Where it
 * does not, the condition stays unclassified, and `insufficient-evidence` is
 * the class that says so.
 *
 * `polyglot` is a real member from 1.0.21 (rule 21, M6). The toolkit must be
 * able to say a defect is its own. Selecting it from evidence is Phase 6
 * work; being able to express it is this file's job, and a taxonomy that
 * could not name us would have made that impossible to add honestly later.
 */
export type FailureClass = 'source' | 'test' | 'environment' | 'dependency' | 'runner' | 'toolchain' | 'polyglot' | 'insufficient-evidence';

export const FAILURE_CLASSES: readonly FailureClass[] = Object.freeze(['source', 'test', 'environment', 'dependency', 'runner', 'toolchain', 'polyglot', 'insufficient-evidence'] as const);

export interface Classification {
  readonly failureClass: FailureClass;
  /** The condition by name, stable enough for a test to refer to it. */
  readonly condition: string;
  /**
   * Whether the classification rests on deterministic evidence. An
   * unclassified packet carries evidence and nothing more.
   */
  readonly confidence: 'classified' | 'unclassified';
  /** The class in words a person would recognise, for a display surface. */
  readonly label: string;
}

// ---------------------------------------------------------------------------
// Field 3. Exactly one objective
// ---------------------------------------------------------------------------

/**
 * One field, never an array. Rule 27 requires exactly one declared objective,
 * and the cheapest way to enforce "exactly one" is a shape that cannot hold
 * none or two. Input that arrives untyped is checked in `buildPacket`.
 */
export type Objective = 'explain' | 'propose';

/** Derived from the objective and never supplied, so the two cannot disagree. */
export type ResponseShape = 'explain-envelope' | 'propose-envelope';

// ---------------------------------------------------------------------------
// Field 4. Allowed actions
// ---------------------------------------------------------------------------

export interface AllowedActions {
  /** Paths the interaction may read, workspace-relative, forward slashes. */
  readonly readable: readonly string[];
  /** Paths a proposal may touch. Empty whenever `mayPropose` is false. */
  readonly proposable: readonly string[];
  readonly mayPropose: boolean;
}

// ---------------------------------------------------------------------------
// Field 8. Bounded correction and safe fallback
// ---------------------------------------------------------------------------

/**
 * One correction, then abandon (rules 59, 60, 61). The literal types are
 * deliberate: for the whole of 1.0.21 there is no other policy, and a number
 * that could be raised is a number somebody raises.
 */
export interface CorrectionPolicy {
  readonly maxAttempts: 1;
  readonly onSecondFailure: 'abandon';
}

export const ONE_CORRECTION: CorrectionPolicy = Object.freeze({ maxAttempts: 1, onSecondFailure: 'abandon' } as const);

// ---------------------------------------------------------------------------
// Field 9. The user authorization boundary
// ---------------------------------------------------------------------------

/**
 * Change authorization, and nothing else.
 *
 * There is deliberately no member meaning model-access consent. Part IV of
 * the constitution keeps those two boundaries apart, and the way to keep them
 * apart is a type with no way to confuse them. Being asked whether Polyglot
 * may use a model is not being asked whether to accept a refactor.
 *
 * The scope is `bounded-attempt`, not `change-set`, and the difference is the
 * whole of rule 92. The person authorizes an attempt, described in five plain
 * sentences, BEFORE the agent acts. They are not approving a diff the agent
 * later produced, they are not judging whether the code is safe, and nothing
 * downstream may read their answer as evidence about the implementation.
 * Polyglot is built for people who may not be able to read the code at all;
 * a product that treats their click as sign-off has made them the engineering
 * validator and will blame them for a defect they could not have seen.
 */
export type AuthorizationRule = { readonly kind: 'none-required'; readonly because: 'nothing-changes' } | { readonly kind: 'explicit-user'; readonly scope: 'bounded-attempt' };

export const NO_AUTHORIZATION_NEEDED: AuthorizationRule = Object.freeze({ kind: 'none-required', because: 'nothing-changes' } as const);
export const USER_AUTHORIZES_ATTEMPT: AuthorizationRule = Object.freeze({ kind: 'explicit-user', scope: 'bounded-attempt' } as const);

// ---------------------------------------------------------------------------
// Field 10. Deterministic verification
// ---------------------------------------------------------------------------

/** The measurements the toolkit can re-run to check an authorized change. */
export type MeasurementId =
  | 'behaviour-equivalence'
  | 'function-complexity'
  | 'coverage-density'
  | 'test-suite'
  /**
   * Every test identifier previously observed to exercise the target was
   * observed again. It rests on evidence the ordinary run already collects:
   * `LineResult.tests` is a sorted set of distinct test identifiers per line,
   * so the set before a proposal and the set after are both already there.
   * Nothing new is collected for it.
   */
  | 'existing-tests-still-ran';

/**
 * Exactly what is re-measured. Never an aggregate.
 *
 * A proposal that closed nothing and raised a project-wide number would pass
 * an aggregate check, which is the shape of verification that flatters the
 * model instead of checking it.
 */
export type VerificationTarget =
  | { readonly kind: 'lines'; readonly path: string; readonly lines: readonly number[] }
  | { readonly kind: 'function'; readonly path: string; readonly name: string; readonly startLine: number }
  | { readonly kind: 'boundary'; readonly path: string; readonly name: string };

/**
 * Field 10, and it carries a list.
 *
 * One measurement could not express what an untangle actually has to prove.
 * Equivalent behaviour with no untangling is not success: the work did not
 * happen. Lower complexity with changed behaviour is not success: something
 * broke. **Every named measurement must hold**, and that rule lives in
 * `resolveVerification` so there is one place it is decided.
 */
export type VerificationRule =
  | { readonly kind: 'none'; readonly because: 'nothing-changes' }
  | {
      readonly kind: 're-measure';
      /** Every one must hold. Non-empty. */
      readonly measurements: readonly MeasurementId[];
      readonly target: VerificationTarget;
    };

export const NOTHING_TO_VERIFY: VerificationRule = Object.freeze({ kind: 'none', because: 'nothing-changes' } as const);

// ---------------------------------------------------------------------------
// Supporting facts
// ---------------------------------------------------------------------------

/** A named fact about the run, for context. Not a diagnosis. */
export interface Fact {
  readonly name: string;
  readonly value: string;
}

/**
 * What the person may be offered on screen.
 *
 * Not the objective. The objective is one thing the interaction does; this is
 * the menu a product may show. They were the same field in 1.0.19 (`actions`),
 * which is how a packet came to have no objective at all.
 */
export type Offer = 'explain' | 'fix';

// ---------------------------------------------------------------------------
// The packet
// ---------------------------------------------------------------------------

export interface GovernancePacket {
  readonly packetVersion: 1;
  /** Content hash of the packet. Stable, and holds no source of its own. */
  readonly id: string;

  /** 1. */ readonly evidence: readonly EvidenceItem[];
  /** 2. */ readonly classification: Classification;
  /** 3. */ readonly objective: Objective;
  /** 4. */ readonly allowed: AllowedActions;
  /** 5. */ readonly constraints: readonly Constraint[];
  /** 6. */ readonly responseShape: ResponseShape;
  /** 7. */ readonly validators: readonly ValidatorId[];
  /** 8. */ readonly correction: CorrectionPolicy;
  /** 9. */ readonly authorization: AuthorizationRule;
  /** 10. */ readonly verification: VerificationRule;

  /**
   * The runner that ran, when one ran.
   *
   * **Optional because a failure can happen before a runner is selected**,
   * and this field is evidence like every other field in a packet: it says
   * which runner produced the failure, so it may only ever hold one that
   * did. A refusal at the environment gate, or an exception thrown before
   * the run begins, has no runner, and absent is how that is said. There is
   * no sentinel for it. `auto`, an empty string, the language's name and the
   * word `unknown` are all a value standing where a measurement should be,
   * and a packet whose whole purpose is that everything in it was measured
   * cannot carry one.
   *
   * Every packet built from a run still carries it, and every one of those
   * call sites still passes a concrete value.
   */
  readonly runner?: string;
  readonly headline: string;
  readonly context: readonly Fact[];
  readonly known: readonly string[];
  readonly unknown: readonly string[];
  /** Remediation the toolkit stands behind. Empty unless classified. */
  readonly remediation: readonly string[];
  readonly offers: readonly Offer[];
}

/** Everything `buildPacket` needs. `id` and `responseShape` are derived. */
export interface PacketInput {
  evidence: readonly EvidenceItem[];
  classification: Classification;
  objective: Objective;
  allowed: AllowedActions;
  constraints: readonly Constraint[];
  validators: readonly ValidatorId[];
  correction: CorrectionPolicy;
  authorization: AuthorizationRule;
  verification: VerificationRule;
  /** Omitted when the failure happened before a runner was selected. See `GovernancePacket.runner`. */
  runner?: string;
  headline: string;
  context?: readonly Fact[];
  known?: readonly string[];
  unknown?: readonly string[];
  remediation?: readonly string[];
  offers?: readonly Offer[];
}

/** Raised when a packet would be incoherent. Never caught to build a lesser one. */
export class PacketError extends Error {}

/**
 * Builds a packet, or refuses.
 *
 * The checks below are not defensive programming. Each one is a way to
 * produce something that looks governed, satisfies every downstream stage,
 * and is not. The type system stops most of them for code written in this
 * repository; none of it helps for a packet parsed from JSON, which is why
 * the same rules are checked at runtime.
 */
export function buildPacket(input: PacketInput): GovernancePacket {
  assertEvidence(input.evidence);
  assertClassification(input.classification, input.remediation ?? []);
  assertObjective(input.objective);
  assertCoherent(input);
  assertConstraints(input.constraints, input.validators);

  const packet: GovernancePacket = {
    packetVersion: 1,
    id: '',
    evidence: input.evidence.map((e) => Object.freeze({ origin: e.origin, text: e.text, source: e.source })),
    classification: Object.freeze({ ...input.classification }),
    objective: input.objective,
    allowed: Object.freeze({ readable: Object.freeze([...input.allowed.readable]), proposable: Object.freeze([...input.allowed.proposable]), mayPropose: input.allowed.mayPropose }),
    constraints: input.constraints.map(freezeConstraint),
    responseShape: input.objective === 'explain' ? 'explain-envelope' : 'propose-envelope',
    validators: Object.freeze([...input.validators]),
    correction: Object.freeze({ ...input.correction }),
    authorization: Object.freeze({ ...input.authorization }) as AuthorizationRule,
    verification: freezeVerification(input.verification),
    // Present only when there is one. An absent runner leaves no key, so
    // nothing downstream can read a defined-but-empty value as a name.
    ...(input.runner === undefined ? {} : { runner: input.runner }),
    headline: input.headline,
    context: (input.context ?? []).map((c) => Object.freeze({ ...c })),
    known: [...(input.known ?? [])],
    unknown: [...(input.unknown ?? [])],
    remediation: [...(input.remediation ?? [])],
    offers: [...(input.offers ?? ['explain'])],
  };
  const withId: GovernancePacket = { ...packet, id: packetId(packet) };
  return deepFreeze(withId);
}

/** The content hash. A digest, so nothing it was computed from travels with it. */
export function packetId(packet: Omit<GovernancePacket, 'id'> | GovernancePacket): string {
  const { ...rest } = packet as GovernancePacket;
  const canonical = JSON.stringify({ ...rest, id: undefined });
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32);
}

/** The constraint ids this packet carries, for the governance record. */
export function constraintIds(packet: GovernancePacket): readonly ConstraintId[] {
  return packet.constraints.map((c) => c.id);
}

// ---------------------------------------------------------------------------
// The compatibility view: one way, on purpose
// ---------------------------------------------------------------------------

/** The 1.0.19 shape, as a view. See this file's header for why there is no reverse. */
export interface LegacyProblemPacketView {
  condition: string;
  category: string;
  confidence: 'classified' | 'unclassified';
  /** Absent when the packet has none. The view does not fill it in. */
  runner?: string;
  headline: string;
  actions: Array<'explain' | 'fix'>;
  evidence: string[];
  context: Array<{ name: string; value: string }>;
  known: string[];
  unknown: string[];
  remediation: string[];
  constraints: string[];
}

/**
 * The governance packet rendered into the 1.0.19 `ProblemPacket` shape.
 *
 * Lossy by definition: typed evidence becomes strings, structured constraints
 * become their prose, and the objective, validators, authorization, and
 * verification are dropped because the old shape has nowhere to put them.
 * That loss is exactly why the conversion does not run the other way.
 */
export function toProblemPacket(packet: GovernancePacket): LegacyProblemPacketView {
  return {
    condition: packet.classification.condition,
    category: packet.classification.label,
    confidence: packet.classification.confidence,
    ...(packet.runner === undefined ? {} : { runner: packet.runner }),
    headline: packet.headline,
    actions: [...packet.offers],
    evidence: packet.evidence.map((e) => e.text),
    context: packet.context.map((c) => ({ name: c.name, value: c.value })),
    known: [...packet.known],
    unknown: [...packet.unknown],
    remediation: [...packet.remediation],
    constraints: packet.constraints.map((c) => c.prose),
  };
}

// ---------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------

function assertEvidence(evidence: readonly EvidenceItem[]): void {
  for (const item of evidence) {
    if (!item || typeof item !== 'object') {
      throw new PacketError('Every piece of evidence must be an item with an origin, a text, and a source.');
    }
    if (!EVIDENCE_ORIGINS.includes(item.origin)) {
      // The type system does not reach a packet parsed from JSON, and this is
      // the one place assistant output could arrive wearing an origin it was
      // never entitled to.
      throw new PacketError(`Evidence origin ${JSON.stringify(item.origin)} is not one the toolkit observes for itself. Deterministic origins are: ${EVIDENCE_ORIGINS.join(', ')}.`);
    }
    if (typeof item.text !== 'string' || typeof item.source !== 'string') {
      throw new PacketError('Evidence carries verbatim text and the place it came from, both as strings.');
    }
  }
}

function assertClassification(c: Classification, remediation: readonly string[]): void {
  if (!FAILURE_CLASSES.includes(c.failureClass)) {
    throw new PacketError(`${JSON.stringify(c.failureClass)} is not one of the eight failure classes: ${FAILURE_CLASSES.join(', ')}.`);
  }
  if (c.confidence !== 'classified' && c.confidence !== 'unclassified') {
    throw new PacketError('Confidence is classified or unclassified.');
  }
  if (c.confidence === 'unclassified') {
    // Rule 20. An unclassified condition carries evidence and nothing more.
    // Both halves matter: a remedy implies a cause, and any class other than
    // insufficient-evidence names one.
    if (remediation.length > 0) {
      throw new PacketError('An unclassified packet cannot carry remediation. A remedy is a claim about the cause, and no cause was established.');
    }
    if (c.failureClass !== 'insufficient-evidence') {
      throw new PacketError(`An unclassified packet is classed insufficient-evidence, not ${JSON.stringify(c.failureClass)}. Naming a class is naming a cause.`);
    }
  }
}

function assertObjective(objective: Objective): void {
  if (Array.isArray(objective)) {
    throw new PacketError('A packet declares exactly one objective, as a value and not a list.');
  }
  if (objective !== 'explain' && objective !== 'propose') {
    throw new PacketError(`${JSON.stringify(objective)} is not an objective. For 1.0.21 they are explain and propose.`);
  }
}

/**
 * The three ways a packet can hold ten valid fields and still be incoherent.
 *
 * An explain interaction that carries proposable paths, or an authorization
 * boundary, or a verification rule, is one edit away from proposing. A
 * propose interaction with no authorization boundary changes a person's files
 * without asking. Neither is caught by any single field being wrong.
 */
function assertCoherent(input: PacketInput): void {
  const { objective, allowed, authorization, verification } = input;
  if (objective === 'explain') {
    if (allowed.mayPropose || allowed.proposable.length > 0) {
      throw new PacketError('An explain interaction proposes nothing, so it carries no proposable paths.');
    }
    if (authorization.kind !== 'none-required') {
      throw new PacketError('An explain interaction changes nothing, so there is nothing for a person to authorize.');
    }
    if (verification.kind !== 'none') {
      throw new PacketError('An explain interaction changes nothing, so there is nothing to verify afterwards.');
    }
    return;
  }
  if (!allowed.mayPropose || allowed.proposable.length === 0) {
    throw new PacketError('A propose interaction must say which paths a proposal may touch.');
  }
  if (authorization.kind !== 'explicit-user') {
    throw new PacketError('A propose interaction changes files, so a person authorizes the change set explicitly (rule 62).');
  }
  if (verification.kind === 're-measure') {
    if (verification.measurements.length === 0) {
      throw new PacketError('A propose interaction names at least one measurement to re-run. A verification rule that names none would resolve to held without having checked anything.');
    }
    if (new Set(verification.measurements).size !== verification.measurements.length) {
      throw new PacketError('A measurement is named twice in this verification rule. Every named measurement must hold, so naming one twice changes nothing and hides which list was intended.');
    }
    if (!verification.target) {
      throw new PacketError('A propose interaction says exactly what is re-measured. An aggregate can rise while the thing the person authorized closed nothing.');
    }
  }
  if (verification.kind !== 're-measure') {
    throw new PacketError('A propose interaction is verified by re-measurement afterwards, never by the assistant\'s account of its own work (rules 26, 31).');
  }
}

function assertConstraints(constraints: readonly Constraint[], validators: readonly ValidatorId[]): void {
  if (constraints.length === 0) {
    throw new PacketError('A governed interaction carries at least one constraint.');
  }
  const seen = new Set<string>();
  for (const c of constraints) {
    if (!c || typeof c.id !== 'string' || !c.rule || typeof c.prose !== 'string') {
      throw new PacketError('Every constraint carries a stable id, a machine-readable rule, and the prose the prompt renders.');
    }
    if (seen.has(c.id)) {
      throw new PacketError(`Constraint id ${c.id} appears twice. Ids are how a validator names what failed, so they cannot repeat.`);
    }
    seen.add(c.id);
    assertConstraintShape(c);
    // M21. A rule kind with a declared instance parameter is bound at
    // reconciliation, from one named packet field, and nowhere else. A
    // packet carrying its own bound copy would be a second source for the
    // same scope, and `assertSameMeaning` would then be asked to compare an
    // unbound template against a bound instance, which is the question it
    // gets wrong. There is never a second one to compare, because of this.
    if (isStandingConstraintId(c.id) && bindingFor(c.rule) !== undefined) {
      const binding = bindingFor(c.rule)!;
      throw new PacketError(
        `This packet carries ${c.id}, whose ${binding.field} is bound from ${binding.from} when the interaction is reconciled. A packet may not supply it: two sources for one scope is one source too many, and the one nobody is looking at is the one that drifts. Put the paths in allowed.proposable and let reconciliation bind them.`,
      );
    }
    // An advisory constraint decides nothing and names nobody, so there is
    // no validator to require here. "A constraint nobody checks is a
    // suggestion" is exactly what advisory declares itself to be, in the
    // type and in the `why` a reader can look at (A2).
    if (c.decidedBy !== undefined && !validators.includes(c.decidedBy)) {
      throw new PacketError(`Constraint ${c.id} is decided by ${c.decidedBy}, which this packet does not list. A constraint nobody checks is a suggestion.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Freezing
// ---------------------------------------------------------------------------

function freezeVerification(v: VerificationRule): VerificationRule {
  if (v.kind === 'none') {
    return Object.freeze({ ...v });
  }
  return Object.freeze({
    kind: 're-measure' as const,
    measurements: Object.freeze([...v.measurements]),
    target: Object.freeze({ ...v.target, ...('lines' in v.target ? { lines: Object.freeze([...v.target.lines]) } : {}) }),
  }) as VerificationRule;
}

function freezeConstraint(c: Constraint): Constraint {
  return Object.freeze({ ...c, rule: Object.freeze({ ...c.rule }) }) as Constraint;
}

/**
 * Freezes the packet, its arrays, and the objects inside them.
 *
 * The array alone is not enough. A frozen array of live objects still lets
 * somebody rewrite an evidence item's text in place, which is the same
 * outcome as appending one and harder to notice. There is deliberately no
 * function anywhere in this module that adds to or edits a built packet.
 */
function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) {
    deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}
