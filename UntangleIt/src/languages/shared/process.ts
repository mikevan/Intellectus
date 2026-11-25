/**
 * Running a child process, now owned by Witness.
 *
 * Both extensions carried a byte-identical copy of this file, and the
 * recorder drivers needed it behind the shared API, so it moved there on
 * 2026-09-23. This re-export keeps every caller in this tree unchanged.
 */
export { runProcess } from '@projectrevivesolutions/witness';
export type { ProcessResult } from '@projectrevivesolutions/witness';
