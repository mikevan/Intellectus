/**
 * The governance record: what happened, without what was said.
 *
 * Schema and construction. Persistence and the viewer are Phase 7 and
 * nothing here writes a file.
 *
 * The privacy rule is rule 70, and the reason is worth stating plainly: a
 * governance log that accumulates prompts becomes a second, unaudited copy
 * of the customer's source code, sitting in a folder nobody thinks of as
 * source control, growing every time somebody presses a button. A hash
 * proves identity without holding the material, which is all the record
 * needs to do.
 *
 * That guarantee is structural rather than editorial. `GovernanceRecord` has
 * no field that can hold a prompt, a response body, or a line of source, so
 * storing one would mean changing this type. `buildRecord` takes the prompt
 * and the raw response and keeps only their digests. A test builds a record
 * from a prompt and a response each carrying a rare marker and asserts
 * neither marker appears anywhere in the serialized record, which proves the
 * property rather than the current field list and keeps proving it as the
 * schema grows.
 *
 * `model.id` is the model the user selected, recorded so that anyone can
 * later prove Polyglot did not substitute one (rules 35 to 38). Without it
 * that rule is an assertion; with it, it is auditable.
 *
 * Deterministic, with the reason (rule 88). A privacy guarantee decided case
 * by case is not a guarantee, and a record is evidence about the system
 * itself.
 */
import { createHash } from 'node:crypto';
import type { ToolName } from '../delivery';
import type { AttemptId } from './capability';
import type { ConstraintId } from './constraints';
import type { FailureClass, GovernancePacket, Objective, VerificationRule } from './packet';
import type { GovernedPrompt } from './prompt';
import type { InteractionId, InteractionSpec } from './registry';
import type { InvalidCause, ValidationResult, ValidatorId } from './validators';
import type { VerificationOutcome } from './verification';

/**
 * One validator's answer, as the record carries it.
 *
 * Rule 94's three outcomes stay apart here, because a record that collapsed
 * them could not say who failed. `fail` carries the constraint it proved was
 * violated. `invalid` carries no constraint and instead carries `cause`,
 * which says whether the model sent something unusable or the evidence was
 * not obtainable. `not-applicable` means the validator had nothing to decide.
 */
export interface RecordedValidator {
  readonly id: ValidatorId;
  readonly verdict: 'pass' | 'fail' | 'invalid' | 'not-applicable';
  /** Present only on `fail`. Absence of evidence is never a violation. */
  readonly constraint?: ConstraintId;
  /** Present only on `invalid`. */
  readonly cause?: InvalidCause;
}

export interface GovernanceRecord {
  readonly recordVersion: 1;
  readonly at: string;
  readonly interactionId: InteractionId;
  /**
   * Which attempt this record is of.
   *
   * `interactionId` names a **type**: a person can run the same interaction
   * against four different lines in an afternoon, so it correlates nothing
   * about one proposal. This does. It is random and content-free by
   * construction, and it is the join between this record and the product's
   * own record of the same attempt.
   */
  readonly attemptId: AttemptId;
  readonly tool: ToolName;
  readonly objective: Objective;
  /** The condition by name. A label, never the evidence behind it. */
  readonly conditionId: string;
  readonly classification: { readonly failureClass: FailureClass; readonly confidence: 'classified' | 'unclassified' };
  readonly constraintIds: readonly ConstraintId[];
  readonly validators: readonly RecordedValidator[];
  readonly accepted: boolean;
  readonly corrections: 0 | 1;
  /** The model the user selected, which answered. Never one Polyglot chose. */
  readonly model: { readonly id: string; readonly vendor?: string; readonly family?: string };
  /**
   * What the person was asked, and what they answered.
   *
   * `briefDigest` is a hash of the authorization brief they actually read, so
   * the record can later show which five points were put to them without
   * holding the text, on the same reasoning as the prompt hash. No source
   * code enters here: a diff in an authorization record proves only that a
   * diff existed, and recreates the second unaudited copy of the customer's
   * source that rule 70 exists to prevent.
   */
  readonly authorization?: { readonly granted: boolean; readonly at: string; readonly by?: string; readonly briefDigest?: string };
  /**
   * The outcome of the later re-measurement, when there has been one.
   *
   * Absent while unresolved, which includes the case where the ordinary run
   * failed or its attribution had a hole: no analysis existed, so no
   * measurement happened, and an absent verification is the honest state
   * rather than a fabricated one. The verification **target** never reaches
   * here: it holds paths and line numbers, and rule 70 keeps those out. The
   * `attemptId` above is enough to join.
   */
  readonly verification?: { readonly kind: VerificationRule['kind']; readonly outcome: VerificationOutcome };
  /**
   * Digests, in place of the things they were computed from.
   *
   * This is the only route by which a prompt or a response leaves a trace in
   * the record, and a digest is not a copy.
   */
  readonly hashes: {
    readonly packet: string;
    readonly prompt: string;
    readonly response: string;
    readonly changeSet?: string;
  };
}

export interface RecordInput {
  spec: InteractionSpec;
  packet: GovernancePacket;
  prompt: GovernedPrompt;
  /** Hashed, never stored. */
  rawResponse: string;
  validation: ValidationResult;
  corrections: 0 | 1;
  model: { id: string; vendor?: string; family?: string };
  authorization?: { granted: boolean; at: string; by?: string; briefDigest?: string };
  verification?: { kind: VerificationRule['kind']; outcome: VerificationOutcome };
  /** The attempt this record is of. Required: a record of no attempt is not a record. */
  attemptId: AttemptId;
  /** Hashed, never stored. The edits themselves stay out of the record. */
  changeSetText?: string;
  at?: string;
}

/**
 * Builds a record.
 *
 * `rawResponse` and `changeSetText` come in and only their digests go out.
 * That is the point of taking them at all: the caller is spared deciding
 * what is safe to keep, because this function keeps nothing.
 */
export function buildRecord(input: RecordInput): GovernanceRecord {
  return Object.freeze({
    recordVersion: 1,
    at: input.at ?? new Date().toISOString(),
    interactionId: input.spec.id,
    attemptId: input.attemptId,
    tool: input.spec.tool,
    objective: input.packet.objective,
    conditionId: input.packet.classification.condition,
    classification: Object.freeze({ failureClass: input.packet.classification.failureClass, confidence: input.packet.classification.confidence }),
    constraintIds: Object.freeze(input.packet.constraints.map((c) => c.id)),
    validators: Object.freeze(
      input.validation.outcomes.map((o) =>
        Object.freeze(
          o.verdict === 'fail'
            ? { id: o.id, verdict: 'fail' as const, constraint: o.constraint }
            : o.verdict === 'invalid'
              ? { id: o.id, verdict: 'invalid' as const, cause: o.cause }
              : { id: o.id, verdict: o.verdict },
        ),
      ),
    ),
    accepted: input.validation.accepted,
    corrections: input.corrections,
    model: Object.freeze({ id: input.model.id, ...(input.model.vendor ? { vendor: input.model.vendor } : {}), ...(input.model.family ? { family: input.model.family } : {}) }),
    ...(input.authorization ? { authorization: Object.freeze({ ...input.authorization }) } : {}),
    ...(input.verification ? { verification: Object.freeze({ ...input.verification }) } : {}),
    hashes: Object.freeze({
      packet: input.packet.id,
      prompt: input.prompt.hash,
      response: digest(input.rawResponse),
      ...(input.changeSetText !== undefined ? { changeSet: digest(input.changeSetText) } : {}),
    }),
  });
}

export function digest(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * The names a record may carry, for a structural check.
 *
 * Exported so a test can assert the schema rather than infer it, and so that
 * a field added later has to be added here too, which is the moment somebody
 * notices they are adding somewhere to put a response body.
 */
export const RECORD_FIELDS: readonly string[] = Object.freeze([
  'recordVersion',
  'at',
  'interactionId',
  'attemptId',
  'tool',
  'objective',
  'conditionId',
  'classification',
  'constraintIds',
  'validators',
  'accepted',
  'corrections',
  'model',
  'authorization',
  'verification',
  'hashes',
] as const);

/**
 * A record with a verification outcome attached.
 *
 * Returns a **new** record. It does not mutate, and it does not persist:
 * persistence is Phase 7's, and a function here that wrote somewhere would be
 * claiming a store this release does not have.
 *
 * `at` replaces nothing. The record's own `at` stays the moment of the
 * attempt, because that is what it is a record of. A verification that
 * happened later is a fact about the attempt, not a new attempt.
 */
export function recordVerification(
  record: GovernanceRecord,
  outcome: VerificationOutcome,
  rule: VerificationRule['kind'],
): GovernanceRecord {
  if (record.verification !== undefined) {
    throw new Error(
      `This attempt already carries the verification outcome ${record.verification.outcome}. Overwriting it would replace what was measured with what was measured later, and the record would no longer say which one it meant.`,
    );
  }
  return Object.freeze({ ...record, verification: Object.freeze({ kind: rule, outcome }) });
}
