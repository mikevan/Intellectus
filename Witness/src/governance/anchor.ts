/**
 * The application anchor: what, deterministically, would show that the
 * authorized change happened.
 *
 * Established at proposal time, when Polyglot knows what it authorized and
 * what the target looked like. Checked at the next ordinary measurement.
 *
 * **It establishes the second of four states and nothing else.** A proposal
 * was shown. The authorized target changed. A deterministic verification ran.
 * The objective held. Those are four different facts, and the way they used
 * to be confused was not sloppiness, it was that each one is evidence of
 * something and it is easy to accept it as evidence of the next one along.
 *
 * Two shapes, because one does not fit four interactions.
 *
 * **`path-created`, for the two test-proposing interactions.** They propose a
 * file, and the measured source is not touched by a correctly applied
 * proposal, so a source-line hash there is not weak evidence, it is evidence
 * of the opposite. The transition is provable at both ends: the path is
 * proven absent at proposal time, because the derivation refuses a path that
 * exists and `V-response-shape` refuses a create over an existing file, and
 * at the later run the path exists or it does not.
 *
 * **`content-digest`, for the two refactor interactions**, over the file the
 * person authorized, which is exactly what C3 bound. File-level rather than
 * method-level on purpose: a refactor is supposed to move the method, so a
 * method-extent digest would be measuring the thing that is meant to change
 * and would break the moment the method was split.
 *
 * **What was rejected, and why it is written down.** DeepTest's `hashLine` is
 * a sha1 of one trimmed line, and its job is to pin the decided line's
 * identity so a decision can be relocated after the code moves. A refactor
 * that rewrites a body without touching the signature line changes nothing
 * that hash sees, so using it here would report `not-run` for work that was
 * done. It keeps its own job and is not repurposed. UntangleIt's after-record
 * is worse: it is produced by the next ordinary measurement, which runs
 * whether or not anybody applied anything, so its existence proves the third
 * state and was being read as the second.
 *
 * **No digest of the proposed content**, deliberately. What has to be
 * established is that the authorized objective was met at the authorized
 * destination, not that the bytes the model wrote are the bytes on disk. A
 * person is free to improve a proposed test before saving it, and a byte
 * identity requirement would report `not-run` for a proposal that was applied
 * and made better. It would also put a derivative of customer source into the
 * record for no gain, and rule 70 is about not accumulating those.
 *
 * **The limitation, stated rather than hidden.** If somebody creates a file
 * at the authorized path for an unrelated reason, the anchor reports applied.
 * The record then says the objective held or did not, measured. It does not
 * claim the model caused it, and nothing in its wording does. That is the
 * honest boundary of what a diff-only workflow can establish, and it is why
 * M10's cost is recorded in the constitution rather than worked around here.
 *
 * Deterministic, and the reason rather than the habit (rule 88). This decides
 * whether a person's authorized change landed. An agent deciding that would
 * be reporting on its own work.
 */
import { createHash } from 'node:crypto';
import type { RepositoryPort } from './repository';

export type ApplicationAnchor =
  /** A file the proposal is authorized to create. Absent now, present later. */
  | { readonly kind: 'path-created'; readonly path: string }
  /** A file the proposal is authorized to change. Its content identity at proposal time. */
  | { readonly kind: 'content-digest'; readonly path: string; readonly digest: string };

/** The content identity of a file, for a `content-digest` anchor. */
export function contentDigest(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Whether the authorized target changed.
 *
 * **Fails closed.** A repository that cannot answer returns `false`, which
 * reports the change as not applied. That is the safe direction: reporting
 * `not-run` for work that was done costs the person a re-check, and reporting
 * applied for work that was not would let a verification outcome be attached
 * to a change that never happened.
 */
export function anchorApplied(anchor: ApplicationAnchor, now: RepositoryPort): boolean {
  const read = now.read(anchor.path);
  if (anchor.kind === 'path-created') {
    // The path was proven absent at proposal time. Present and readable now
    // is the whole transition. `not-found` is the ordinary answer here and
    // means the person has not applied it yet; `unreadable` and
    // `outside-root` are answers Polyglot cannot act on, and both report not
    // applied rather than guessing in the permissive direction.
    return read.ok;
  }
  if (!read.ok) {
    // The file the person authorized cannot be compared, so nothing is
    // claimed about it. Failing closed costs a re-check; failing open would
    // attach a verification outcome to a change that may never have
    // happened.
    return false;
  }
  return contentDigest(read.text) !== anchor.digest;
}
