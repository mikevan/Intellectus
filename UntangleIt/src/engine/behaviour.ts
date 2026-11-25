/**
 * The behaviour comparator, now owned by Witness.
 *
 * The comparison moved to `@projectrevivesolutions/witness` on 2026-09-23,
 * because DeepTest needs the same verdicts for its own refactor workflow and
 * a peer product may not import another peer's implementation. Shared
 * capability belongs behind the shared API.
 *
 * This file stays so that `loop.ts`, `gate.ts`, and the existing tests keep
 * importing exactly what they imported before. Nothing about `equivalent`,
 * `changed`, or `insufficient evidence` changed, and the tests that prove it
 * were not edited.
 */
export { compareValue, decide, sentence } from '@projectrevivesolutions/witness';
export type { Insufficient, Difference, Verdict, Comparison } from '@projectrevivesolutions/witness';
export type { Captured, Observation, OutcomeKind, Problem, BoundaryRecord } from '@projectrevivesolutions/witness';
