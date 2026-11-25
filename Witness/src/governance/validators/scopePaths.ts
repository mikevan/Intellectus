/**
 * V-scope-paths, deciding C3.
 *
 * C3 is the hard scope boundary, and it answers one question: is this change
 * inside the scope the person authorized? Nothing else in the toolkit
 * answers it, which is why C7 is not allowed to become a second copy of it.
 * C7 asks whether the change was larger than necessary, necessity is
 * semantic, and a second file inside the authorized scope can be entirely
 * legitimate; refusing a correct solution for touching one more permitted
 * file would be worse than the change it prevented. So C7 is advisory and
 * this is the only path boundary that binds.
 *
 * **The scope is bound at reconciliation**, from the packet's
 * `allowed.proposable`, through the one parameter binding declared in
 * `constraints.ts`. No caller supplies a scoped C3 and there is no second way
 * to produce one, so the list enforced here is the same list the
 * authorization brief showed the person. That matters more than it looks:
 * the person's yes is for those paths, and an earlier yes must never widen
 * to cover a path they were never shown (rule 92).
 *
 * **The empty list is a missing prerequisite, not a violation.** An
 * unscoped C3 means nobody told Polyglot what the scope was, and reporting
 * that as a C3 failure would put a record in front of somebody saying the
 * model went outside the authorized scope when the model did nothing of the
 * kind. That is the same fabrication A1 fixed at the parse boundary, and
 * rule 94's second clause forbids it: absence of evidence is not a
 * constraint violation. So it is declared as a prerequisite, refused before
 * the model is reached, and the `run` path below keeps the honest
 * `invalid`/`evidence` answer as a backstop for a caller that invokes this
 * validator directly.
 *
 * Lexical containment over declared paths, with no filesystem. Whether a
 * declared path is inside a declared list is arithmetic. Whether it exists,
 * and where a symlink really points, is response validity and belongs to
 * `V-response-shape`.
 *
 * Deterministic, with the reason (rule 88). This is the boundary the person
 * authorized. An agent deciding what counted as inside it would be deciding
 * the scope of its own permission.
 */
import { normalizeSegments } from '../validators';
import type { PrerequisiteInput, PrerequisiteOutcome, Validator, ValidatorInput, ValidatorOutcome } from '../validators';

/**
 * Whether `candidate` sits inside `allow`.
 *
 * An entry is either an exact path or a prefix. A trailing `/**` or `/*` is
 * understood as "this directory and below", because that is how the packet's
 * proposable lists are written, and a bare directory name behaves the same
 * way. Segment-wise throughout: `src` permits `src/pricing.ts` and does not
 * permit `srcfoo/pricing.ts`.
 */
function insideAny(candidate: string, allow: readonly string[]): boolean {
  const target = normalizeSegments(candidate).map((s) => s.toLowerCase());
  for (const entry of allow) {
    const parts = normalizeSegments(entry.replace(/\/+\*{1,2}$/, '')).map((s) => s.toLowerCase());
    if (parts.length === 0) {
      continue;
    }
    if (parts.length > target.length) {
      continue;
    }
    if (parts.every((p, i) => p === target[i])) {
      // An exact match is inside itself; a prefix match is inside the folder.
      return true;
    }
  }
  return false;
}

export const scopePathsValidator: Validator = Object.freeze({
  id: 'V-scope-paths',
  decides: Object.freeze(['C3'] as const),

  prerequisites(input: PrerequisiteInput): PrerequisiteOutcome {
    const constraint = input.constraints.find((c) => c.rule.kind === 'paths-confined-to');
    if (!constraint || constraint.rule.kind !== 'paths-confined-to') {
      return { ok: true };
    }
    if (input.packet.objective !== 'propose') {
      // An explanation changes nothing, so there is no change set for a
      // scope to bound. Not a missing prerequisite.
      return { ok: true };
    }
    if (constraint.rule.allow.length === 0) {
      return {
        ok: false,
        missing: 'the authorized scope',
        because: `${constraint.id} bounds this change to a list of paths and the list is empty, so nobody supplied the scope. Reconciliation binds it from the packet's proposable paths, so the paths checked are the paths the person was shown, and an empty list here means this effective set was built without going through the reconciler.`,
      };
    }
    return { ok: true };
  },

  run(input: ValidatorInput): ValidatorOutcome {
    const constraint = input.constraints.find((c) => c.rule.kind === 'paths-confined-to');
    if (!constraint || constraint.rule.kind !== 'paths-confined-to') {
      return { id: 'V-scope-paths', verdict: 'not-applicable', because: 'This interaction carries no scope constraint.' };
    }
    if (input.response.kind !== 'propose') {
      return { id: 'V-scope-paths', verdict: 'not-applicable', because: 'This interaction proposes no change, so there are no paths to bound.' };
    }
    if (constraint.rule.allow.length === 0) {
      // The backstop. Unreachable through `runGovernedInteraction`, because
      // the prerequisite above refuses the interaction before the model. It
      // exists because a validator is a public function, and one that
      // answered "pass" here would be a loaded gun in the public surface.
      return {
        id: 'V-scope-paths',
        verdict: 'invalid',
        cause: 'evidence',
        because: `${constraint.id} bounds this change to a list of paths and the list is empty, so there is nothing to check it against. Polyglot cannot confirm this change stays inside what was authorized, so it does not accept it.`,
      };
    }

    for (const edit of input.response.changeSet) {
      if (!insideAny(edit.path, constraint.rule.allow)) {
        return {
          id: 'V-scope-paths',
          verdict: 'fail',
          constraint: constraint.id,
          because: `${edit.path} is outside what this change was allowed to touch. What was authorized was ${constraint.rule.allow.join(', ')}.`,
        };
      }
    }
    return { id: 'V-scope-paths', verdict: 'pass' };
  },
});
