/**
 * V-response-shape: is the returned result usable at all.
 *
 * **It decides no constraint, and that is the point.** Every fault it finds
 * is `invalid`, which carries no constraint id, because none of these faults
 * proves anything about a limit the model was given. A response that will not
 * parse, a path that escapes the workspace, or a `before` that does not match
 * the file are all failures of the answer rather than violations of a rule,
 * and reporting them as C4 or C1 would accuse the model of something nobody
 * established (rule 94, A1).
 *
 * It also has exactly one meaning now, which it did not before Phase 4. The
 * id used to be both an unimplemented validator and the label stamped on a
 * parse failure, and every advisory constraint named it as its deciding
 * validator for no reason except that `decidedBy` was required. Advisory
 * constraints name nobody now (A2), so this validator owns response validity
 * and nothing else.
 *
 * Four jobs.
 *
 * **1. Envelope validity.** The parser already refuses a wrong `kind`, a
 * missing field, an out-of-range evidence index, a modify with no `before`,
 * and a remedy on an unclassified packet. This validator does not repeat any
 * of it, because a second copy of a check drifts from the first.
 *
 * **2. Path validity, including containment.** This is where M15's symlink
 * and workspace-containment work landed, rather than in C4. A path in a
 * workspace-relative change set is invalid when it is absolute, when it
 * escapes the root, or when following links lands outside the root.
 *
 * Diff-only is not permission to wander outside the workspace. Polyglot
 * still reads the referenced file to build the diff, so an escaping path is
 * a path we would read, and a person looking at a diff should not be the
 * containment check.
 *
 * A `create` names a file that does not exist, so containment is established
 * from the canonical nearest existing parent rather than from the file. That
 * is `RepositoryPort`'s job and it does it in one place, which is why the
 * port refuses an escaping read on its own instead of trusting that this
 * validator ran first.
 *
 * **3. `before` against the repository.** Every modify carries the exact
 * text it replaces, and this compares it against the file. A mismatch means
 * the proposal does not apply to this repository: `invalid`/`response`,
 * because the model sent a description of a file it got wrong. A file that
 * cannot be read is `invalid`/`evidence`, **never a pass and never
 * `not-applicable`**, because the check applied and could not finish.
 *
 * This is also the answer to a model that says one thing and did another.
 * The claim never reaches a validator, by the type. The file does.
 *
 * **4. Explanation completeness.** A classified packet whose explanation
 * cites no evidence is incomplete: it is not disagreeing with the evidence,
 * it is resting on none. Completeness rather than contradiction, which is
 * why it is here and not in `V-contradiction`.
 *
 * Deterministic, with the reason (rule 88). This is the boundary where
 * unvalidated output stops (rules 43, 44). A model deciding whether its own
 * output was usable is the loop those rules exist to break.
 */
import type { PrerequisiteInput, PrerequisiteOutcome, Validator, ValidatorInput, ValidatorOutcome } from '../validators';

const ID = 'V-response-shape' as const;

export const responseShapeValidator: Validator = Object.freeze({
  id: ID,
  // It decides no constraint. Not an omission: see the header.
  decides: Object.freeze([] as const),

  prerequisites(input: PrerequisiteInput): PrerequisiteOutcome {
    if (input.packet.objective !== 'propose') {
      // An explanation produces no change set, so there is nothing to check
      // against a repository and none is needed.
      return { ok: true };
    }
    if (!input.repository) {
      return {
        ok: false,
        missing: 'the repository',
        because:
          'This interaction will produce a change set, and checking it means reading the files it names: whether each path stays inside the project, and whether the text it claims to replace is really there. Without the repository Polyglot would be checking the answer against the answer.',
      };
    }
    return { ok: true };
  },

  run(input: ValidatorInput): ValidatorOutcome {
    if (input.response.kind === 'explain') {
      // 4. Completeness.
      if (input.packet.classification.confidence === 'classified' && input.response.citedEvidence.length === 0) {
        return {
          id: ID,
          verdict: 'invalid',
          cause: 'response',
          because: 'The explanation cites none of the measured evidence, so nothing it says rests on what was actually established. Cite the evidence the explanation is built on.',
        };
      }
      return { id: ID, verdict: 'pass', because: 'The explanation is well formed and cites the evidence it rests on.' };
    }

    const repository = input.repository;
    if (!repository) {
      // The check applies and cannot be completed. Not `not-applicable`:
      // that would read as a pass, and rule 94 says a result we could not
      // validate is not a validated result.
      return {
        id: ID,
        verdict: 'invalid',
        cause: 'evidence',
        because: 'Polyglot has no access to the project files, so it cannot check this change against them. It does not accept a change it could not check.',
      };
    }

    for (const edit of input.response.changeSet) {
      // 2. Path validity.
      const where = repository.resolveInside(edit.path);
      if (!where.ok) {
        return { id: ID, verdict: 'invalid', cause: 'response', because: `${edit.path} is not a usable path for this project. ${where.why}` };
      }

      if (edit.operation === 'create') {
        // Nothing to compare against. A create naming a file that already
        // exists is a modify wearing the wrong label, and it would silently
        // replace the whole file.
        const existing = repository.read(edit.path);
        if (existing.ok) {
          return {
            id: ID,
            verdict: 'invalid',
            cause: 'response',
            because: `${edit.path} is described as a new file and it already exists. Creating it would replace everything in it. Send it as a modify, with the exact text being replaced.`,
          };
        }
        continue;
      }

      // 3. `before` against the repository.
      //
      // The parser already refuses a modify without `before`, so this guard
      // never fires through the governed path. It is here because a
      // validator is a public function, and the alternative to a guard is a
      // cast that quietly turns `undefined` into a string and compares
      // against it.
      if (edit.before === undefined) {
        return {
          id: ID,
          verdict: 'invalid',
          cause: 'response',
          because: `${edit.path} is described as a change to an existing file and does not say what text it replaces, so there is nothing to check it against.`,
        };
      }
      const current = repository.read(edit.path);
      if (!current.ok) {
        if (current.reason === 'not-found') {
          return {
            id: ID,
            verdict: 'invalid',
            cause: 'response',
            because: `${edit.path} is described as a change to an existing file and there is no such file in the project.`,
          };
        }
        return {
          id: ID,
          verdict: 'invalid',
          cause: 'evidence',
          because: `Polyglot could not read ${edit.path}, so it cannot check that this change applies to what is really there. ${current.why} It does not accept a change it could not check.`,
        };
      }
      if (!current.text.includes(edit.before)) {
        return {
          id: ID,
          verdict: 'invalid',
          cause: 'response',
          because: `The text this change says it is replacing is not in ${edit.path} as the file stands today. The change does not apply to this project, so applying it would not do what it describes.`,
        };
      }
    }

    return {
      id: ID,
      verdict: 'pass',
      because: 'Every path stays inside the project and every change matches the file it claims to change.',
    };
  },
});
