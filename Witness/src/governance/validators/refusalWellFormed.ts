/**
 * V-refusal-wellformed, deciding C8, partly.
 *
 * C8 says: if you cannot meet the objective inside these limits, say so
 * plainly and stop. Refusing is a correct answer (rule 64).
 *
 * **What this decides is the shape of a refusal. What it does not decide is
 * whether refusing was the right answer**, and nothing decides that. You
 * cannot mechanically establish whether an objective could have been met, so
 * C8's rule carries an `unchecked` sentence saying so and the authorization
 * brief shows that sentence to the person. The alternative, a validator that
 * formed a view on feasibility, would be a guess wearing a guarantee, and it
 * would be wrong in the permissive direction most of the time.
 *
 * Three facts are decidable and all three are worth deciding.
 *
 * **Refusing and shipping edits at once is incoherent.** The response says
 * it could not do the work and then does some. Whichever half a reader
 * believed would decide what happened next.
 *
 * **An empty change set with no refusal is a non-answer.** This one is not
 * hypothetical: `parsePropose` accepts it today, and
 * `runGovernedInteraction` would go on to render "the assistant proposes a
 * change to 0 files" and offer a button. A model that has nothing to say
 * must say that, in the refusal field, where it is recorded.
 *
 * **A refusal carries a reason.** The parser already requires a non-empty
 * one, so this validator does not repeat the check; it relies on it, and a
 * test pins the parser's half.
 *
 * Deterministic, with the reason (rule 88). Whether a response is coherent
 * with itself is arithmetic over two fields. A model deciding whether its
 * own refusal counted would be deciding whether it had to do the work.
 */
import type { Validator, ValidatorInput, ValidatorOutcome } from '../validators';

export const refusalWellFormedValidator: Validator = Object.freeze({
  id: 'V-refusal-wellformed',
  decides: Object.freeze(['C8'] as const),
  run(input: ValidatorInput): ValidatorOutcome {
    const constraint = input.constraints.find((c) => c.rule.kind === 'must-refuse-when-infeasible');
    if (!constraint) {
      return { id: 'V-refusal-wellformed', verdict: 'not-applicable', because: 'This interaction carries no refusal constraint.' };
    }
    if (input.response.kind !== 'propose') {
      // Genuinely nothing to decide. An explanation is not an attempt at
      // work that could have been refused.
      return { id: 'V-refusal-wellformed', verdict: 'not-applicable', because: 'This interaction proposes no change, so there is nothing it could have refused.' };
    }

    const refused = input.response.refusal !== undefined;
    const edits = input.response.changeSet.length;

    if (refused && edits > 0) {
      return {
        id: 'V-refusal-wellformed',
        verdict: 'fail',
        constraint: constraint.id,
        because: `The answer says the work could not be done inside the limits and then proposes ${edits === 1 ? 'a change' : `${edits} changes`} anyway. One of those is wrong and neither is safe to act on.`,
      };
    }
    if (!refused && edits === 0) {
      return {
        id: 'V-refusal-wellformed',
        verdict: 'fail',
        constraint: constraint.id,
        because: 'The answer proposes nothing and does not say it is refusing. If the objective cannot be met inside the limits, say so in the refusal, plainly, and that is a correct answer.',
      };
    }

    return {
      id: 'V-refusal-wellformed',
      verdict: 'pass',
      // Stated on the pass, so nobody reads this as C8 having been decided
      // in full. It has not been.
      because: refused
        ? 'The refusal is well formed and carries a reason. Whether refusing was the right answer is not decided here.'
        : 'The answer proposes work rather than refusing, which is coherent. Whether it should have refused instead is not decided here.',
    };
  },
});
