/**
 * Test-only constraint fixtures.
 *
 * `scopedConstraint('C3', paths)` used to live in the production API, and
 * M21 removed it. Production never called it, and keeping it would have left
 * a second valid-looking way to produce a bound C3 beside the reconciler's,
 * which is exactly the ambiguity M21 exists to end: "where did this scope
 * come from" has to have one answer.
 *
 * A validator, though, is a pure function over an effective constraint set,
 * and a unit test of `V-scope-paths` should be able to hand it a scope
 * without building a packet, registering an interaction, and reconciling.
 * So the shape survives here, in a folder that is plainly test-only and
 * cannot be mistaken for the governed path.
 *
 * **Nothing in `src/` may import this.** A structural test asserts it.
 */
import { STANDING_CONSTRAINTS } from '../../src/index';
import type { Constraint } from '../../src/index';

/**
 * C3 with a scope, for a validator test.
 *
 * The same shape the reconciler produces, built the same way: the standing
 * constraint's identity, with the one declared instance parameter filled in.
 * If the two ever diverge, the binding test in `rule94.test.ts` is the one
 * that catches it, because it asserts the real reconciler's output.
 */
export function scopedC3(paths: readonly string[]): Constraint {
  return Object.freeze({
    ...STANDING_CONSTRAINTS.C3,
    rule: Object.freeze({ kind: 'paths-confined-to', allow: Object.freeze([...paths]) }),
  }) as Constraint;
}
