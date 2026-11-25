/**
 * The interaction registry: what a governed interaction has to declare, and
 * the refusal to accept one that does not.
 *
 * An interaction spec is the standing description of a governed interaction,
 * as against a packet, which is one occurrence of it. The spec says what the
 * interaction is allowed to do and what must be true of it; the packet
 * carries the evidence and the facts for a particular run.
 *
 * Seven states this file makes impossible or testably invalid, because each
 * one is a way to have a governed interaction that governs nothing: no
 * objective, two objectives, no constraints, a constraint nobody validates,
 * no authorization rule, no verification rule, and an id that exists in code
 * with no entry here.
 *
 * Validation runs at runtime as well as in the types. The types stop a spec
 * written in this repository; they do nothing for a spec parsed from JSON,
 * and "testably invalid" needs something that actually runs.
 *
 * Phase 2 registers no production interaction. O-1 through O-8 are
 * registered as their phases build them, because a spec whose validators
 * have no bodies would pass validation here and fail at the moment it
 * mattered. Registering early would buy a green list and an empty promise.
 *
 * No transport. This file does not know what a chat participant is, and
 * Phase 3 is where that lives.
 *
 * Deterministic, with the reason (rule 88). Registry validity is a
 * build-time gate that has to be able to fail a release (rules 72, 73), and
 * a gate that formed a view is not a gate.
 */
import type { ToolName } from '../delivery';
import type { AllowedActions, AuthorizationRule, CorrectionPolicy, Objective, VerificationRule } from './packet';
import { isConstraintId, type ConstraintId } from './constraints';
import { isValidatorId, type ValidatorId } from './validators';

/** Stable interaction ids. The objectives in Part XI are numbered O-1 to O-8. */
export type InteractionId = string;

export interface InteractionSpec {
  readonly id: InteractionId;
  /**
   * Which product runs it, as a name.
   *
   * A string, not an import. Witness may not depend on a peer product (rules
   * 2, 4), and naming one in a union of string literals is not depending on
   * it. `ToolName` already carries this from Phase 1.
   */
  readonly tool: ToolName;
  readonly title: string;
  /** Exactly one. A field, never a list. */
  readonly objective: Objective;
  readonly allowed: AllowedActions;
  readonly constraints: readonly ConstraintId[];
  readonly validators: readonly ValidatorId[];
  readonly correction: CorrectionPolicy;
  readonly authorization: AuthorizationRule;
  readonly verification: VerificationRule;
}

export interface SpecProblem {
  readonly field: string;
  readonly problem: string;
}

export type SpecValidation = { readonly ok: true; readonly spec: InteractionSpec } | { readonly ok: false; readonly problems: readonly SpecProblem[] };

export class RegistryError extends Error {
  constructor(message: string, readonly problems: readonly SpecProblem[] = []) {
    super(message);
  }
}

/**
 * Checks a candidate spec against every rule, and reports all the problems
 * rather than the first.
 *
 * Reporting all of them is deliberate. A spec is usually written once and
 * corrected once, and a validator that stops at the first fault turns that
 * into six rounds.
 */
export function validateSpec(candidate: unknown): SpecValidation {
  const problems: SpecProblem[] = [];
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { ok: false, problems: [{ field: '(spec)', problem: 'An interaction spec is an object.' }] };
  }
  const s = candidate as Record<string, unknown>;

  if (typeof s.id !== 'string' || s.id.trim() === '') {
    problems.push({ field: 'id', problem: 'Every interaction has a stable id.' });
  }
  if (s.tool !== 'DeepTest' && s.tool !== 'UntangleIt') {
    problems.push({ field: 'tool', problem: 'tool names the product that runs this interaction.' });
  }
  if (typeof s.title !== 'string' || s.title.trim() === '') {
    problems.push({ field: 'title', problem: 'A title a person could read in a governance record.' });
  }

  // Objective: zero and two are the two states worth naming separately,
  // because they fail for different reasons and a reader should see which.
  if (Array.isArray(s.objective)) {
    problems.push({
      field: 'objective',
      problem:
        (s.objective as unknown[]).length === 0
          ? 'This interaction declares no objective. Rule 27 requires exactly one, and an interaction with none has nothing to validate against.'
          : `This interaction declares ${(s.objective as unknown[]).length} objectives. Rule 27 requires exactly one, because the response shape, the validators, and the authorization boundary all follow from it.`,
    });
  } else if (s.objective === undefined || s.objective === null) {
    problems.push({ field: 'objective', problem: 'This interaction declares no objective. Rule 27 requires exactly one.' });
  } else if (s.objective !== 'explain' && s.objective !== 'propose') {
    problems.push({ field: 'objective', problem: `${JSON.stringify(s.objective)} is not an objective. For 1.0.21 they are explain and propose.` });
  }

  const allowed = s.allowed as AllowedActions | undefined;
  if (!allowed || typeof allowed !== 'object' || !Array.isArray(allowed.readable) || !Array.isArray(allowed.proposable) || typeof allowed.mayPropose !== 'boolean') {
    problems.push({ field: 'allowed', problem: 'allowed states what may be read, what may be proposed, and whether proposing is permitted at all.' });
  }

  if (!Array.isArray(s.constraints) || (s.constraints as unknown[]).length === 0) {
    problems.push({ field: 'constraints', problem: 'A governed interaction carries at least one constraint. One with none is ungoverned with extra steps.' });
  } else {
    for (const id of s.constraints as unknown[]) {
      if (typeof id !== 'string' || !isConstraintId(id)) {
        problems.push({ field: 'constraints', problem: `${JSON.stringify(id)} is not a constraint id. Standing constraints are C1 to C8; a condition's own are prefixed X-.` });
      }
    }
  }

  if (!Array.isArray(s.validators) || (s.validators as unknown[]).length === 0) {
    problems.push({ field: 'validators', problem: 'A governed interaction names at least one validator. Constraints nobody checks are suggestions.' });
  } else {
    for (const id of s.validators as unknown[]) {
      if (typeof id !== 'string' || !isValidatorId(id)) {
        problems.push({ field: 'validators', problem: `${JSON.stringify(id)} is not a validator id.` });
      }
    }
  }

  const correction = s.correction as CorrectionPolicy | undefined;
  if (!correction || correction.maxAttempts !== 1 || correction.onSecondFailure !== 'abandon') {
    problems.push({ field: 'correction', problem: 'For 1.0.21 the policy is one correction, then abandon (rules 59, 60, 61).' });
  }

  const authorization = s.authorization as AuthorizationRule | undefined;
  if (!authorization || (authorization.kind !== 'none-required' && authorization.kind !== 'explicit-user')) {
    problems.push({ field: 'authorization', problem: 'Every interaction states its change-authorization boundary, even when the answer is that nothing changes.' });
  }

  const verification = s.verification as VerificationRule | undefined;
  if (!verification || (verification.kind !== 'none' && verification.kind !== 're-measure')) {
    problems.push({ field: 'verification', problem: 'Every interaction states how the result is verified deterministically, even when the answer is that nothing changes.' });
  }

  // The coherence rules, once the individual fields are sound. These are the
  // combinations that look complete and are not.
  if (s.objective === 'explain') {
    if (allowed && allowed.mayPropose) {
      problems.push({ field: 'allowed', problem: 'An explain interaction proposes nothing, so mayPropose is false and proposable is empty.' });
    }
    if (authorization && authorization.kind === 'explicit-user') {
      problems.push({ field: 'authorization', problem: 'An explain interaction changes nothing, so there is nothing for a person to authorize.' });
    }
    if (verification && verification.kind === 're-measure') {
      problems.push({ field: 'verification', problem: 'An explain interaction changes nothing, so there is nothing to re-measure.' });
    }
  }
  if (s.objective === 'propose') {
    if (allowed && (!allowed.mayPropose || allowed.proposable.length === 0)) {
      problems.push({ field: 'allowed', problem: 'A propose interaction must name the paths a proposal may touch.' });
    }
    if (authorization && authorization.kind !== 'explicit-user') {
      problems.push({ field: 'authorization', problem: 'A propose interaction changes files, so a person authorizes the change set (rule 62).' });
    }
    if (verification && verification.kind !== 're-measure') {
      problems.push({ field: 'verification', problem: 'A propose interaction is verified by re-measurement, never by the assistant\'s account of its own work (rules 26, 31).' });
    }
  }

  if (problems.length > 0) {
    return { ok: false, problems };
  }
  return { ok: true, spec: Object.freeze({ ...(s as unknown as InteractionSpec) }) };
}

const REGISTERED = new Map<InteractionId, InteractionSpec>();

/** Registers a spec, or refuses it with every reason. */
export function registerInteraction(candidate: unknown): InteractionSpec {
  const checked = validateSpec(candidate);
  if (!checked.ok) {
    throw new RegistryError(`This interaction spec cannot be registered:\n${checked.problems.map((p) => `  ${p.field}: ${p.problem}`).join('\n')}`, checked.problems);
  }
  REGISTERED.set(checked.spec.id, checked.spec);
  return checked.spec;
}

/**
 * The spec for an id, or an error naming the id.
 *
 * **This call is the declaration.** Code that reaches a governed interaction
 * calls this with a literal id, and the structural test in
 * `test/governance.test.ts` scans the source for those literals and asserts
 * every one is registered. That is how "an id exists in code but not in the
 * registry" is caught.
 *
 * The scan looks for this call and nothing else, deliberately. The 1.0.19
 * clipboard and chat hand-offs are not governed interactions yet and do not
 * call it, so they are not caught by it. They come under the registry test
 * when Phase 3 converts them, which is when they will have ids at all.
 */
export function requireInteraction(id: InteractionId): InteractionSpec {
  const found = REGISTERED.get(id);
  if (!found) {
    throw new RegistryError(`Interaction ${JSON.stringify(id)} is used in code but is not registered. An unregistered interaction has no objective, no constraints, and no validators, so nothing about it can be checked.`);
  }
  return found;
}

export function isRegistered(id: InteractionId): boolean {
  return REGISTERED.has(id);
}

export function registeredIds(): readonly InteractionId[] {
  return Object.freeze([...REGISTERED.keys()].sort());
}

/** Test support. Production code registers at module load and never clears. */
export function clearRegistryForTests(): void {
  REGISTERED.clear();
}
