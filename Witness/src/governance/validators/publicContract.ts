/**
 * V-public-contract, deciding C2, partly.
 *
 * C2 protects four surfaces: a public signature, an error message, a thrown
 * type, and the order of side effects. They are not alike, and pretending
 * they were is how a validator ends up claiming more than it proved.
 *
 * **What this decides: the exported declaration headers changed.** It parses
 * the file as it stands and the file as the change would leave it, takes the
 * header of every exported declaration, and fails if that set is not the
 * same. A header is the part that states the contract, without the body that
 * implements it.
 *
 * **Compared as text, not understood.** That is deliberate and it is the
 * conservative direction. Deciding whether two signatures mean the same
 * thing needs a type system and a judgment; deciding whether the text of a
 * declared contract changed needs neither. So this is **over-strict**: a
 * reformatted parameter list fails even though nothing about the contract
 * moved. Over-strict is the side to be wrong on. A comparator that formed a
 * view on equivalence would eventually decide that a widened parameter was
 * compatible, and the thing it waved through would be a caller somewhere
 * breaking at runtime.
 *
 * **What this does not decide, and nothing else does either:**
 *
 * **The order of side effects.** Not decidable statically, and it is **not
 * covered by the behaviour gate** either, which is worth being exact about
 * because the opposite was nearly written into the plan. A Witness
 * `Observation` records the target, the test, an entry index, a nesting
 * depth, the captured arguments, and one outcome of return, throw, resolve,
 * or reject. It records no side effects. Ordering is observed only among
 * entries into a boundary Witness was asked to watch, so a change that
 * reorders two file writes, or a write against a log line, is invisible to
 * it. An `equivalent` verdict proves the observations that were made and
 * nothing past them.
 *
 * **A message or thrown value that is not written as plain text in the
 * code.** A templated message or a thrown value produced by a factory is
 * only knowable by running it.
 *
 * Both of those live in C2's rule as its `unchecked` sentence, and the
 * authorization brief renders that sentence to the person, so somebody
 * authorizing a change is told which part of C2 Polyglot can actually prove.
 *
 * **A file it cannot parse is `invalid`/`evidence`, never a pass.** The
 * check applied and could not finish, which is rule 94, and a pass there
 * would be the quietest possible way to stop protecting a public contract.
 *
 * Deterministic, with the reason (rule 88). A public contract is what other
 * people's code depends on. An agent deciding whether it had changed one
 * would be deciding whether it had broken somebody it cannot see.
 */
import type { PrerequisiteInput, PrerequisiteOutcome, Validator, ValidatorInput, ValidatorOutcome } from '../validators';

const ID = 'V-public-contract' as const;

/** The declaration set as a comparable, order-independent shape. */
function headers(declarations: readonly { readonly name: string; readonly header: string }[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of declarations) {
    out.set(`${d.name}\u0000${d.header}`, d.header);
  }
  return out;
}

export const publicContractValidator: Validator = Object.freeze({
  id: ID,
  decides: Object.freeze(['C2'] as const),

  prerequisites(input: PrerequisiteInput): PrerequisiteOutcome {
    const constraint = input.constraints.find((c) => c.rule.kind === 'no-change-to');
    if (!constraint) {
      return { ok: true };
    }
    if (input.packet.objective !== 'propose') {
      return { ok: true };
    }
    if (!input.repository) {
      return {
        ok: false,
        missing: 'the repository',
        because: 'Deciding whether a public contract changed means comparing the file as it is against the file as the change would leave it, so Polyglot has to be able to read it.',
      };
    }
    if (!input.syntax) {
      return {
        ok: false,
        missing: 'a parser',
        because: 'Deciding whether a public contract changed means reading the structure of the code, not matching text against it. Without a parser Polyglot would be guessing at what a declaration is.',
      };
    }
    return { ok: true };
  },

  run(input: ValidatorInput): ValidatorOutcome {
    const constraint = input.constraints.find((c) => c.rule.kind === 'no-change-to');
    if (!constraint || constraint.rule.kind !== 'no-change-to') {
      return { id: ID, verdict: 'not-applicable', because: 'This interaction carries no public-contract constraint.' };
    }
    if (input.response.kind !== 'propose') {
      return { id: ID, verdict: 'not-applicable', because: 'This interaction proposes no change, so no public contract could have moved.' };
    }
    const { repository, syntax } = input;
    if (!repository || !syntax) {
      return {
        id: ID,
        verdict: 'invalid',
        cause: 'evidence',
        because: `Polyglot cannot check whether this change alters a public contract: it has no ${!repository ? 'access to the project files' : 'parser for this project'}. It does not accept a change it could not check.`,
      };
    }

    for (const edit of input.response.changeSet) {
      if (edit.operation !== 'modify' || edit.before === undefined) {
        // A new file declares no contract anybody already depends on.
        continue;
      }
      if (!syntax.supports(edit.path)) {
        return {
          id: ID,
          verdict: 'invalid',
          cause: 'evidence',
          because: `Polyglot has no parser for ${edit.path}, so it cannot tell whether this change alters a public signature, an error message, or a thrown type. It does not accept a change it could not check.`,
        };
      }
      const current = repository.read(edit.path);
      if (!current.ok) {
        return {
          id: ID,
          verdict: 'invalid',
          cause: 'evidence',
          because: `Polyglot could not read ${edit.path}, so it cannot compare the public contract before and after. ${current.why} It does not accept a change it could not check.`,
        };
      }

      const at = current.text.indexOf(edit.before);
      if (at === -1) {
        // `V-response-shape` owns this and says it better. Do not report it
        // as a C2 violation: a change set that does not apply has proven
        // nothing about the public contract.
        return {
          id: ID,
          verdict: 'invalid',
          cause: 'response',
          because: `The text this change says it is replacing is not in ${edit.path}, so there is nothing to compare the public contract against.`,
        };
      }
      const after = `${current.text.slice(0, at)}${edit.after}${current.text.slice(at + edit.before.length)}`;

      const wasDeclarations = syntax.exportedDeclarations(edit.path, current.text);
      const nowDeclarations = syntax.exportedDeclarations(edit.path, after);
      if (!wasDeclarations || !nowDeclarations) {
        return {
          id: ID,
          verdict: 'invalid',
          cause: 'evidence',
          because: `Polyglot could not read the structure of ${edit.path}${!nowDeclarations ? ' as this change would leave it' : ''}, so it cannot tell whether the public contract moved. It does not accept a change it could not check.`,
        };
      }

      const was = headers(wasDeclarations);
      const now = headers(nowDeclarations);
      for (const [key, header] of was) {
        if (!now.has(key)) {
          const stillNamed = [...nowDeclarations].find((d) => d.name === wasDeclarations.find((w) => `${w.name}\u0000${w.header}` === key)?.name);
          return {
            id: ID,
            verdict: 'fail',
            constraint: constraint.id,
            because: stillNamed
              ? `This change alters a declaration other code depends on in ${edit.path}. It was "${header}" and it becomes "${stillNamed.header}". Anything calling it would have to change too, and this brief did not ask for that.`
              : `This change removes a declaration other code depends on from ${edit.path}: "${header}". Anything calling it would stop working, and this brief did not ask for that.`,
          };
        }
      }
    }

    return {
      id: ID,
      verdict: 'pass',
      // Coverage stated on the pass. C2 protects four surfaces and this
      // decided one of them.
      because:
        'No exported declaration changed its header. Whether the order of side effects changed, or a message or thrown value that is not written as plain text in the code, is not decided here and is not decided anywhere in 1.0.21.',
    };
  },
});
