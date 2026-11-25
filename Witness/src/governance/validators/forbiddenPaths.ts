/**
 * V-forbidden-paths, deciding C4.
 *
 * **Moved in Phase 4, and its logic is unchanged.** Only the imports and the
 * module framing are new, which is what extracting a module means. The proof
 * that the logic survived is its own test cases, which moved unedited: an
 * ordinary path passes, the two paths that merely contain the text `.deeptest`
 * pass, and the six real tool-folder paths fail, including a Windows-spelled
 * one, a case-varied one, and one reached through `..`.
 *
 * Narrow on purpose, and the narrowness is the design rather than an
 * unfinished edge. It decides C4 from the paths in the proposed change set,
 * lexically, and does nothing else. It does not enforce C3's scope, resolve
 * symlinks, check workspace containment, walk the filesystem, or read the
 * repository.
 *
 * **Phase 4 deliberately did not add any of that here.** Symlink resolution
 * and workspace containment are response validity and belong to
 * `V-response-shape`: a path that escapes the workspace is a malformed value
 * in a workspace-relative field, not a violation of C4. Folding them in
 * would make C4's answer depend on the filesystem being readable at the
 * moment of judgment, and rule 7 makes the `.keepsafe` boundary absolute. An
 * absolute boundary cannot become unanswerable because a disk was busy.
 *
 * Segment matching, never substring matching. `.deeptest` as a substring
 * appears in `src/dotdeeptest-notes.md` and in `docs/.deeptest-format.md`,
 * neither of which is inside a tool folder, and a validator that failed
 * those would teach people to work around it.
 *
 * Lexical normalisation only: separators are unified, `.` segments drop, and
 * `..` pops. Popping `..` lexically is what stops
 * `src/../.keepsafe/checkpoints/x` from reading as a path under `src`. It is
 * not a containment check and does not claim to be one.
 */
import type { Validator, ValidatorInput, ValidatorOutcome } from '../validators';
import { normalizeSegments } from '../validators';
import type { ProposedEdit } from '../response';

export const forbiddenPathsValidator: Validator = Object.freeze({
  id: 'V-forbidden-paths',
  decides: Object.freeze(['C4'] as const),
  run(input: ValidatorInput): ValidatorOutcome {
    const constraint = input.constraints.find((c) => c.rule.kind === 'paths-forbidden');
    if (!constraint || constraint.rule.kind !== 'paths-forbidden') {
      return { id: 'V-forbidden-paths', verdict: 'not-applicable', because: 'This interaction carries no forbidden-paths constraint.' };
    }
    if (input.response.kind !== 'propose') {
      return { id: 'V-forbidden-paths', verdict: 'not-applicable', because: 'This interaction proposes no change, so there are no paths to check.' };
    }
    const deny = new Set(constraint.rule.deny.map((d) => d.toLowerCase()));
    for (const edit of input.response.changeSet as readonly ProposedEdit[]) {
      const hit = normalizeSegments(edit.path).find((segment) => deny.has(segment.toLowerCase()));
      if (hit !== undefined) {
        return {
          id: 'V-forbidden-paths',
          verdict: 'fail',
          constraint: constraint.id,
          because: `${edit.path} is inside ${hit}, which belongs to the tools and is not the assistant's to change.`,
        };
      }
    }
    return { id: 'V-forbidden-paths', verdict: 'pass' };
  },
});
