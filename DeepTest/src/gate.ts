/**
 * The behaviour gate, as DeepTest's function-level refactor flow uses it.
 *
 * DeepTest already tells a person when a function has more ways through it
 * than their limit, and already lets them hand that function to an assistant
 * to break up. What it could not do until 1.0.21 is say whether the function
 * still does what it did. `functionDecisionState` read the new complexity
 * number, saw it under the limit, and reported `fixed`. A refactor that
 * lowered the number and changed the answer passed.
 *
 * The gate closes that. At the hand-off the function's boundary is recorded
 * while the project's own tests run. At the next measurement it is recorded
 * again and the two are compared. A lower number with changed behaviour is
 * not a fix, and is not reported as one.
 *
 * The machinery is Witness's, shared with UntangleIt, which has run this
 * same gate since 1.0.19. What is here is the adapter: DeepTest's own
 * folder, DeepTest's own wasm layout, DeepTest's own plugin lookup, and
 * DeepTest's own canonical identity for what the person authorized.
 *
 * DeepTest does not edit source. It does not restore anything. It removes no
 * permission point and adds no new one.
 */
import * as path from 'node:path';
import type { BoundaryRecord, GovernancePacket } from '@projectrevivesolutions/witness';
import { clearBefore as clearBeforeIn, loadBefore as loadBeforeIn, locateBoundary as locateIn, recordBoundary as recordIn, saveBefore as saveBeforeIn, verdictFor } from '@projectrevivesolutions/witness';
import type { BeforeRecord } from '@projectrevivesolutions/witness';
import type { BoundarySpec, LanguagePlugin, LanguageSettings } from './languages/types';
import { runtimeEnvironment } from './languages/shared/runtime';

export { verdictFor };
export type { BeforeRecord };

/** DeepTest's own folder for generated files. Never inferred in the shared layer. */
function workDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.deeptest');
}

/**
 * What a kept recording is filed under.
 *
 * This is the decision's own identity, the one `recordDecision` and
 * `removeDecision` already key by: the file, the line the function starts
 * on, and the scope. It is deliberately not the function's name, and
 * deliberately not a hash of the path and the name together. That pair does
 * not uniquely identify a behavioural boundary. Two functions called
 * `format` in one file collide under it, and a rename breaks the pairing
 * with nothing to show for it.
 *
 * The identity used is the one that was authorized. A person decided about
 * a function at a place in a file. That decision is what the recording
 * belongs to. Which method that resolved to is recorded separately, inside
 * the kept file, so the run afterwards can find the same method again once
 * the assistant has moved it off its line.
 */
export function decisionKey(relativePath: string, startLine: number): string {
  return `function:${relativePath}:${startLine}`;
}

/**
 * The method starting on a line, by name and by the class it belongs to.
 *
 * Undefined for a language with no line locator, and for a file the parser
 * could not take. The caller then records nothing and claims nothing, which
 * is what `'unavailable'` on the decision means.
 */
export async function locateBoundary(workspaceRoot: string, relativePath: string, startLine: number): Promise<BoundarySpec | undefined> {
  return locateIn({ workspaceRoot, relativePath, startLine, wasmDir: runtimeEnvironment().wasmDir });
}

/**
 * Records the boundary while the project's own tests run.
 *
 * Returns undefined when this language has no recorder at all, which is not
 * the same as a recording that found nothing. The caller says which it was,
 * and the gate makes no claim either way.
 */
export async function recordBoundary(
  plugin: LanguagePlugin,
  options: { workspaceRoot: string; settings: LanguageSettings; boundary: BoundarySpec; log: (line: string) => void; report?: (packet: GovernancePacket) => void; signal?: AbortSignal },
): Promise<BoundaryRecord[] | undefined> {
  const recorder = plugin.createBoundaryRecorder?.();
  return recordIn(
    recorder ? () => recorder.record({ workspaceRoot: options.workspaceRoot, settings: options.settings, log: options.log, report: options.report, signal: options.signal, boundary: options.boundary }) : undefined,
    options.log,
  );
}

/** Keeps the run made at the hand-off, under the decision's own identity. */
export function saveBefore(workspaceRoot: string, relativePath: string, startLine: number, boundary: BoundarySpec, records: BoundaryRecord[]): void {
  saveBeforeIn(workDir(workspaceRoot), decisionKey(relativePath, startLine), boundary, records);
}

/**
 * The run kept at the hand-off, with the method it was made about.
 *
 * Undefined means there is none to be had, and for a decision the gate
 * governs that is a defect in the gate, not an absence of evidence. See
 * `functionDecisionState`, which will not report such a decision fixed.
 */
export function loadBefore(workspaceRoot: string, relativePath: string, startLine: number): BeforeRecord | undefined {
  return loadBeforeIn(workDir(workspaceRoot), decisionKey(relativePath, startLine));
}

/** Removes a kept run once its verdict has been recorded. */
export function clearBefore(workspaceRoot: string, relativePath: string, startLine: number): void {
  clearBeforeIn(workDir(workspaceRoot), decisionKey(relativePath, startLine));
}
