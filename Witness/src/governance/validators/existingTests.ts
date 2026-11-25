/**
 * V-existing-tests, deciding C1.
 *
 * C1 in 1.0.21 Phase 5: do not change any test that is already there; you may
 * add a new test to an existing test file, and you may add a new test file;
 * you may not add anything but a test.
 *
 * **What changed, and why it is a refinement rather than a relaxation.** The
 * Phase 4 rule refused every `modify` of a test file, on the path alone, with
 * no parsing. That refused the ordinary engineering action along with the
 * dangerous ones, and the corpus showed how often: a density shortfall on a
 * branch of an already-tested function lives in a file that already exists,
 * and the old rule forbade touching it, so O-5 refused in its flagship case.
 *
 * What replaced it is stricter than it looks. A modify is accepted only when
 * the parsed structure of the file proves the change additive: every
 * pre-existing structure identical, in order, at every depth, and every
 * addition a test case or a suite containing nothing but test cases. A
 * byte-prefix rule would have been weaker, because appended code can register
 * a hook or reconfigure a mock and change what the tests above it do without
 * touching their bytes. A denylist would have been weaker still, because the
 * construct that gets through is by definition the one nobody listed.
 *
 * **No assertion-strength analysis is implemented here, and none is
 * planned.** Deciding whether an assertion was weakened means understanding
 * the assertion, and being wrong in the permissive direction means a model
 * manufactured a pass and Polyglot signed it. Nothing here ranks an
 * assertion; the comparison is identity and text.
 *
 * **It needs a parser and a repository, and it fails closed without them.**
 * A modify of a test file cannot be decided from the change set alone, so
 * this validator now has prerequisites. Rule 94's gate refuses the
 * interaction before the model when either is missing; called directly with
 * neither, it returns `invalid`/`evidence` and accuses nobody.
 *
 * **A create always passes, whatever the path.** A new test file is the thing
 * C1 exists to allow. A new file somewhere it should not be is C3's business
 * and `V-scope-paths` decides it; two validators failing on one fact would
 * make the record ambiguous.
 *
 * Deterministic, with the reason (rule 88). C1 is the constraint that stops a
 * model from making its own work look correct. A model deciding whether it
 * had weakened a test is rule 26 inverted.
 */
import { isTestPath } from '../../delivery';
import { isProvablyAdditive } from '../additive';
import type { PrerequisiteInput, PrerequisiteOutcome, Validator, ValidatorInput, ValidatorOutcome } from '../validators';

export const existingTestsValidator: Validator = Object.freeze({
  id: 'V-existing-tests',
  decides: Object.freeze(['C1'] as const),
  /**
   * A parser and a repository, but only for an interaction that could
   * actually authorize a change to an existing test file.
   *
   * Decided from `allowed.proposable`, which is the scope the person will be
   * shown and the scope C3 binds. An interaction that may only propose a new
   * file, or may only propose source changes, needs neither and is not asked
   * for either: UntangleIt proposes source changes and never test changes, so
   * a proposal of its that touched a test file fails C1 on the path alone,
   * exactly as before, with no parsing. Requiring a parser of every
   * interaction carrying C1 would make a toolkit-wide prerequisite out of a
   * DeepTest one.
   */
  prerequisites(input: PrerequisiteInput): PrerequisiteOutcome {
    if (!input.constraints.some((c) => c.rule.kind === 'tests-additive-only')) {
      return { ok: true };
    }
    if (input.packet.objective !== 'propose') {
      return { ok: true };
    }
    if (!input.packet.allowed.proposable.some((p) => isTestPath(p))) {
      return { ok: true };
    }
    if (!input.repository) {
      return {
        ok: false,
        missing: 'the repository',
        because: 'This attempt may change an existing test file, and showing that the tests already in it are untouched means comparing it against what the change would leave, so Polyglot has to be able to read it.',
      };
    }
    if (!input.syntax) {
      return {
        ok: false,
        missing: 'a parser',
        because: 'This attempt may change an existing test file, and proving a change additive means reading the structure of the file rather than matching text against it. Without a parser Polyglot would be guessing at what a test is.',
      };
    }
    return { ok: true };
  },
  run(input: ValidatorInput): ValidatorOutcome {
    const constraint = input.constraints.find((c) => c.rule.kind === 'tests-additive-only');
    if (!constraint || constraint.rule.kind !== 'tests-additive-only') {
      return { id: 'V-existing-tests', verdict: 'not-applicable', because: 'This interaction carries no constraint about existing tests.' };
    }
    if (input.response.kind !== 'propose') {
      return { id: 'V-existing-tests', verdict: 'not-applicable', because: 'This interaction proposes no change, so no test file could have been touched.' };
    }

    const modifiedTests = input.response.changeSet.filter((e) => e.operation === 'modify' && isTestPath(e.path));

    for (const edit of modifiedTests) {
      if (!input.repository || !input.syntax) {
        // Rule 94. Not a violation: Polyglot cannot obtain what it needs to
        // decide, and saying "you changed a test" here would be inventing a
        // finding out of a missing tool.
        return {
          id: 'V-existing-tests',
          verdict: 'invalid',
          cause: 'evidence',
          because: `This proposal changes the existing test file ${edit.path}, and Polyglot could not ${input.repository ? 'parse' : 'read'} it to show that the tests already in it are untouched. Nothing is being alleged about the proposal.`,
        };
      }
      const read = input.repository.read(edit.path);
      if (!read.ok) {
        return {
          id: 'V-existing-tests',
          verdict: 'invalid',
          cause: 'evidence',
          because: `This proposal changes the existing test file ${edit.path} and Polyglot could not read it: ${read.why}`,
        };
      }
      if (!input.syntax.supports(edit.path)) {
        return {
          id: 'V-existing-tests',
          verdict: 'invalid',
          cause: 'evidence',
          because: `This proposal changes the existing test file ${edit.path} and Polyglot has no parser for that kind of file, so it cannot show that the tests already in it are untouched.`,
        };
      }

      const after = edit.after;
      if (after === undefined) {
        return {
          id: 'V-existing-tests',
          verdict: 'invalid',
          cause: 'response',
          because: `This proposal says it changes ${edit.path} and does not say what the file becomes, so there is nothing to compare.`,
        };
      }

      const verdict = isProvablyAdditive(input.syntax.testStructures(edit.path, read.text), input.syntax.testStructures(edit.path, after));
      if (verdict.kind === 'undecidable') {
        return { id: 'V-existing-tests', verdict: 'invalid', cause: 'evidence', because: `${edit.path}: ${verdict.because}` };
      }
      if (verdict.kind === 'not-additive') {
        return { id: 'V-existing-tests', verdict: 'fail', constraint: constraint.id, because: `${edit.path}: ${verdict.because}` };
      }
    }

    const added = input.response.changeSet.filter((e) => e.operation === 'create' && isTestPath(e.path)).length;
    const parts: string[] = [];
    if (modifiedTests.length > 0) {
      parts.push(`${modifiedTests.length === 1 ? 'One existing test file is' : `${modifiedTests.length} existing test files are`} changed, and every change adds tests without touching the tests already there`);
    }
    if (added > 0) {
      parts.push(`${added === 1 ? 'one new test file is' : `${added} new test files are`} added`);
    }
    return {
      id: 'V-existing-tests',
      verdict: 'pass',
      because: parts.length > 0 ? `${parts.join(', and ')}, which C1 allows.` : 'No existing test file is changed.',
    };
  },
});
