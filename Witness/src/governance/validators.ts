/**
 * Validator contracts, the deterministic result model, and exactly one real
 * validator.
 *
 * Phase 2 defines the shape. Phase 4 builds the machinery. The one body
 * written here is `V-forbidden-paths`, deciding C4, and it is here for four
 * reasons rather than as a sample: it is fully decidable from the change set
 * with no repository access, so it does not drag Phase 4 forward; it proves
 * the whole chain from a structured constraint through a validator to an
 * outcome to a result; it is a required row in Part X of the constitution;
 * and it guards `.keepsafe`, which rule 7 makes absolute. A wrong answer
 * there puts a model inside the recovery boundary.
 *
 * Every other validator is declared with its id and the constraints it
 * decides, and has no body. `validatorFor` throws for one of those, so a
 * registered interaction that names an unbuilt validator fails loudly rather
 * than validating nothing and reporting a pass.
 *
 * Deterministic, with the reason (rule 88). Validation is the mechanism that
 * makes agentic freedom safe. A model judging its own compliance is rule 26
 * inverted, and a validator that weighed evidence would be deciding the very
 * thing it exists to check.
 */
import type { Constraint, ConstraintId, Coverage } from './constraints';
import type { GovernancePacket } from './packet';
import type { EffectiveConstraints } from './reconcile';
import type { RepositoryPort } from './repository';
import type { SyntaxPort } from './syntax';
import type { ValidatableResponse } from './response';
import type { InteractionId, InteractionSpec } from './registry';
import { forbiddenPathsValidator } from './validators/forbiddenPaths';
export { forbiddenPathsValidator };
import { responseShapeValidator } from './validators/responseShape';
import { scopePathsValidator } from './validators/scopePaths';
import { existingTestsValidator } from './validators/existingTests';
import { publicContractValidator } from './validators/publicContract';
import { refusalWellFormedValidator } from './validators/refusalWellFormed';

export type ValidatorId =
  | 'V-response-shape'
  | 'V-scope-paths'
  | 'V-forbidden-paths'
  | 'V-existing-tests'
  | 'V-public-contract'
  | 'V-platform-specific'
  | 'V-workaround-preserved'
  | 'V-unrelated-change'
  | 'V-contradiction'
  | 'V-refusal-wellformed';

export const VALIDATOR_IDS: readonly ValidatorId[] = Object.freeze([
  'V-response-shape',
  'V-scope-paths',
  'V-forbidden-paths',
  'V-existing-tests',
  'V-public-contract',
  'V-platform-specific',
  'V-workaround-preserved',
  'V-unrelated-change',
  'V-contradiction',
  'V-refusal-wellformed',
] as const);

/**
 * What a validator is given.
 *
 * `response` is a `ValidatableResponse`, which omits the model's compliance
 * claims. That omission is the enforcement of rule 51: a validator cannot
 * read the model's account of its own work, because it is not in the value
 * it receives. See `response.ts`.
 */
export interface ValidatorInput {
  readonly packet: GovernancePacket;
  readonly constraints: readonly Constraint[];
  readonly response: ValidatableResponse;
  /**
   * The repository, read-only, when one was supplied.
   *
   * A validator that needs it and does not have it returns
   * `invalid`/`evidence`, never a pass and never `not-applicable`. In the
   * governed sequence it will always have one by the time `run` is called,
   * because rule 94's gate refuses the interaction otherwise, but a
   * validator is a public function and must be safe when called directly.
   */
  readonly repository?: RepositoryPort;
  /** A parser, when one was supplied. Same fail-closed rule as `repository`. */
  readonly syntax?: SyntaxPort;
}

/**
 * Why a check could not be completed. Rule 94.
 *
 * `response`: the model sent something unusable. It can fix that, so the
 * response is worth the one bounded correction.
 *
 * `evidence`: the check applies and the facts it needs were not obtainable.
 * **The model cannot fix any of that**, so asking again would spend the
 * person's own model quota on a condition that has nothing to do with the
 * model, and it earns no correction.
 */
export type InvalidCause = 'response' | 'evidence';

/**
 * What a validator answered.
 *
 * Four verdicts, and the distinction between the last two is rule 94's.
 *
 * `not-applicable` means **this validator legitimately had nothing to
 * decide**: a path validator handed an explain response, a forbidden-paths
 * validator on an interaction carrying no such constraint. It reads as a
 * pass because it is one, and it must never be used for a check that
 * applied and could not finish.
 *
 * `invalid` means **this cannot be safely validated**, and it is not
 * acceptable. It carries no constraint id, deliberately: nothing was proven
 * violated, so nothing is accused. A result that named a constraint here
 * would put a fabricated violation into a governance record, which is the
 * defect A1 fixed.
 *
 * `pass` carries an optional `because` so a validator that decides part of
 * what its constraint states can say what it actually checked, rather than
 * leaving a reader to assume it checked all of it.
 */
export type ValidatorOutcome =
  | { readonly id: ValidatorId; readonly verdict: 'pass'; readonly because?: string }
  | { readonly id: ValidatorId; readonly verdict: 'fail'; readonly constraint: ConstraintId; readonly because: string }
  | { readonly id: ValidatorId; readonly verdict: 'invalid'; readonly cause: InvalidCause; readonly because: string }
  | { readonly id: ValidatorId; readonly verdict: 'not-applicable'; readonly because: string };

/** One reason a check could not be completed, as the result and the record carry it. */
export interface InvalidReason {
  readonly id: ValidatorId;
  readonly cause: InvalidCause;
  readonly because: string;
}

/**
 * What a validator is asked before the model is reached.
 *
 * There is no response here, deliberately. A validator that needs the
 * response to answer this is answering the wrong question, and its answer
 * belongs in `run` as an `invalid`/`evidence` outcome.
 */
export interface PrerequisiteInput {
  readonly spec: InteractionSpec;
  readonly packet: GovernancePacket;
  readonly constraints: readonly Constraint[];
  readonly repository?: RepositoryPort;
  readonly syntax?: SyntaxPort;
}

export type PrerequisiteOutcome = { readonly ok: true } | { readonly ok: false; readonly missing: string; readonly because: string };

export interface Validator {
  readonly id: ValidatorId;
  readonly decides: readonly ConstraintId[];
  /**
   * Whether this validator can decide what it claims, asked once, before
   * authorization and before the model.
   *
   * Absent means it needs nothing beyond the packet and the response, which
   * is the common case. See `requirePrerequisites` and rule 94.
   */
  prerequisites?(input: PrerequisiteInput): PrerequisiteOutcome;
  run(input: ValidatorInput): ValidatorOutcome;
}

/** One prerequisite a governed interaction needed and did not have. */
export interface MissingPrerequisite {
  readonly validator: ValidatorId;
  readonly constraints: readonly ConstraintId[];
  readonly missing: string;
  readonly because: string;
}

/**
 * Raised when a governed interaction cannot be checked, before it is run.
 *
 * It is a defect in how the interaction was assembled, not a condition the
 * person caused, which is why it throws rather than returning an outcome.
 * There is no governance record: no prompt was built and no response exists,
 * so there is nothing to hash, and filling in values to make a record build
 * would manufacture exactly the evidence rule 89 forbids.
 */
export class PrerequisiteError extends Error {
  constructor(message: string, readonly missing: readonly MissingPrerequisite[]) {
    super(message);
  }
}

/**
 * Rule 94's gate: refuse before the model when a required check already
 * cannot be completed.
 *
 * Two conditions fail here rather than after the model has answered.
 *
 * **A validator the interaction requires has no body.** Today this is
 * discovered inside the validator loop, after a request has been sent, and
 * reported as `not-applicable`, which reads as a pass. That is the same
 * fault one stage too late.
 *
 * **A validator that has a body cannot obtain what it needs**, and can say
 * so without seeing a response. An empty scope list. An absent repository on
 * an interaction that will produce a change set. Both are knowable from the
 * registered spec and the reconciled set, and spending the person's own
 * model quota to discover them is wrong.
 *
 * Evidence whose absence could only be established while validating the
 * returned response is not this function's business. That is
 * `invalid`/`evidence`, it costs one request, and it earns no correction.
 *
 * Every missing prerequisite is reported, not the first, the way
 * `validateSpec` reports every fault. Somebody assembling an interaction
 * should see the whole list rather than peel them off one per run.
 */
export function requirePrerequisites(spec: InteractionSpec, packet: GovernancePacket, effective: EffectiveConstraints, facilities: { readonly repository?: RepositoryPort; readonly syntax?: SyntaxPort } = {}): void {
  const missing: MissingPrerequisite[] = [];

  for (const id of effective.validators) {
    const decides = effective.constraints.filter((c) => c.decidedBy === id).map((c) => c.id);

    if (!validatorImplemented(id)) {
      // A required validator with no body cannot decide anything it was
      // named for. If it decides nothing in this set, it is merely listed,
      // and that is not a reason to refuse an interaction.
      if (decides.length > 0) {
        missing.push({
          validator: id,
          constraints: Object.freeze(decides),
          missing: 'the validator itself',
          because: `${id} has no implementation, and ${decides.join(', ')} name it as the validator that decides them. Nothing would check them.`,
        });
      }
      continue;
    }

    const validator = validatorFor(id);
    if (!validator.prerequisites) {
      continue;
    }
    const answer = validator.prerequisites({ spec, packet, constraints: effective.constraints, ...facilities });
    if (!answer.ok) {
      missing.push({ validator: id, constraints: Object.freeze(decides), missing: answer.missing, because: answer.because });
    }
  }

  if (missing.length === 0) {
    return;
  }
  const lines = missing.map((m) => `  ${m.validator}: ${m.because}`);
  throw new PrerequisiteError(
    `${spec.id} cannot be checked, so it is not run (rule 94). Polyglot does not ask a model for something it could not validate the answer to, and it does not ask a person to authorize an attempt it already knows it cannot check.\n${lines.join('\n')}`,
    Object.freeze(missing),
  );
}

export interface ValidationResult {
  readonly interactionId: InteractionId;
  readonly outcomes: readonly ValidatorOutcome[];
  /** Constraints a validator proved were violated. */
  readonly failedConstraints: readonly ConstraintId[];
  /**
   * Checks that could not be completed, kept separate from the above.
   *
   * Rule 94: absence of evidence is not a constraint violation. A record
   * that collapsed these two fields could not tell a model that failed from
   * an environment that prevented checking, and it would accuse the
   * assistant of something nobody established.
   */
  readonly invalidReasons: readonly InvalidReason[];
  /** Derived, never supplied. See `buildValidationResult`. */
  readonly accepted: boolean;
}

/**
 * The result, with `accepted` computed rather than taken.
 *
 * There is no way to hand this function a result and tell it the result was
 * accepted. That is rule 26 one level down: the thing being judged does not
 * get to record the judgment, and neither does whatever called it.
 *
 * `accepted` is false for any `invalid`, of either cause. Rule 94: a
 * governed result Polyglot could not validate is not a validated result.
 */
export function buildValidationResult(interactionId: InteractionId, outcomes: readonly ValidatorOutcome[]): ValidationResult {
  const failedConstraints = outcomes.filter((o): o is Extract<ValidatorOutcome, { verdict: 'fail' }> => o.verdict === 'fail').map((o) => o.constraint);
  const invalidReasons = outcomes
    .filter((o): o is Extract<ValidatorOutcome, { verdict: 'invalid' }> => o.verdict === 'invalid')
    .map((o) => Object.freeze({ id: o.id, cause: o.cause, because: o.because }));
  return Object.freeze({
    interactionId,
    outcomes: Object.freeze([...outcomes]),
    failedConstraints: Object.freeze(failedConstraints),
    invalidReasons: Object.freeze(invalidReasons),
    accepted: failedConstraints.length === 0 && invalidReasons.length === 0,
  });
}

/**
 * A path as its meaningful segments.
 *
 * Both separators are treated as separators, because a change set can arrive
 * with either whatever the platform is, and a Windows-spelled path must not
 * become one long segment that matches nothing.
 *
 * It stays here rather than moving with `V-forbidden-paths`, because
 * `reconcile.ts` uses it for rule 93's path-contradiction check and a
 * reconciler importing a validator would be the wrong way round.
 */
export function normalizeSegments(path: string): string[] {
  const out: string[] = [];
  for (const raw of path.split(/[\\/]+/)) {
    if (raw === '' || raw === '.') {
      continue;
    }
    if (raw === '..') {
      out.pop();
      continue;
    }
    out.push(raw);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

/**
 * The validators that have bodies.
 *
 * Four ids are deliberately absent, and the reason differs.
 *
 * `V-platform-specific`, `V-workaround-preserved`, and `V-unrelated-change`
 * would have decided C5, C6, and C7, and all three of those constraints are
 * advisory in 1.0.21 because the questions they ask are semantic. No
 * constraint names any of these three validators any more, so they are
 * declared ids with no consumer rather than gaps in enforcement, and nothing
 * anywhere claims they ran.
 *
 * `V-contradiction` has no body because **no deterministic semantic
 * contradiction predicate has been established for 1.0.21.** That is not a
 * gap left for later convenience; the contradiction classes that are
 * deterministic already have owners, and giving this id a body by
 * relabelling one of them would make the record say a contradiction was
 * found where something else was. Constraint against constraint is rule 93
 * and `reconcileConstraints`. A path outside the authorized scope is C3 and
 * `V-scope-paths`. An unclassified response inventing a remedy is the parse
 * boundary in `response.ts`. An explanation resting on no evidence is
 * completeness and belongs to `V-response-shape`. A proposed change
 * differing from measured behaviour is deterministic verification, later,
 * where the behaviour is actually observed.
 *
 * `validatorFor` throws for all four, and rule 94's gate refuses an
 * interaction that requires one before a model is reached.
 */
const IMPLEMENTED: Readonly<Partial<Record<ValidatorId, Validator>>> = Object.freeze({
  'V-forbidden-paths': forbiddenPathsValidator,
  'V-response-shape': responseShapeValidator,
  'V-scope-paths': scopePathsValidator,
  'V-existing-tests': existingTestsValidator,
  'V-public-contract': publicContractValidator,
  'V-refusal-wellformed': refusalWellFormedValidator,
});

/** Whether a validator has a body yet. */
export function validatorImplemented(id: ValidatorId): boolean {
  return Object.prototype.hasOwnProperty.call(IMPLEMENTED, id);
}

/**
 * The validator for an id, or an error.
 *
 * It throws for a declared-but-unbuilt validator rather than returning
 * undefined, because the caller most likely to receive undefined is a loop
 * running every validator a spec names, and skipping one there would report
 * a constraint as checked when nothing checked it.
 */
export function validatorFor(id: ValidatorId): Validator {
  const found = IMPLEMENTED[id];
  if (!found) {
    throw new Error(`${id} is declared but has no implementation yet (Phase 4). A constraint it decides cannot be enforced, so nothing may report it as checked.`);
  }
  return found;
}

export function isValidatorId(id: string): id is ValidatorId {
  return (VALIDATOR_IDS as readonly string[]).includes(id);
}

/**
 * How far Polyglot can actually prove a constraint.
 *
 * **Derived, never declared.** A hand-written list of what is enforced
 * drifts the first time a validator changes, and the place it would drift is
 * the authorization brief, where a person is deciding something. So the
 * answer comes from three facts and nothing else: whether the rule is
 * advisory, whether the validator it names has a body, and whether the rule
 * itself declares a gap.
 *
 * It lives here rather than in `constraints.ts` because it needs the
 * validator registry, and a constraint should not have to know which
 * validators happen to be built today.
 *
 * `stated-only` covers two cases that are the same thing from the person's
 * side: a constraint nothing can decide, and a constraint whose validator
 * does not exist. Both travel to the model and bind nobody. Rule 94's gate
 * refuses the second one before the model whenever the validator is
 * required, so in the governed path this function sees it only where the
 * constraint is carried without being required.
 */
export function coverageOf(c: Constraint): Coverage {
  if (c.rule.kind === 'advisory') {
    return 'stated-only';
  }
  if (!c.decidedBy || !validatorImplemented(c.decidedBy)) {
    return 'stated-only';
  }
  return c.rule.unchecked ? 'partly-checked' : 'checked';
}
