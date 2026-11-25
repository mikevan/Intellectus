/**
 * The behaviour gate, as the loop uses it.
 *
 * It sits inside the workflow that already exists and changes nothing about
 * it. At the existing "Yes, send it", after the person has confirmed and
 * before the brief reaches the clipboard and the editor chat, the selected
 * method's boundary is recorded while the project's own tests run. At the
 * existing "Measure again" it is recorded a second time and compared.
 *
 * UntangleIt does not edit source. It does not restore anything. It removes
 * no permission point and adds no new one. KeepSafe and the person keep
 * control exactly as they have it today.
 *
 * The machinery itself moved to Witness on 2026-09-23, because DeepTest's
 * function-level refactor flow needs the same gate and a peer product may
 * not import another peer's implementation. What is left here is the
 * adapter. It names UntangleIt's own folder and its own wasm layout, looks
 * the recorder up through UntangleIt's own plugin contract, and keys the
 * kept run by UntangleIt's own canonical identity, the run id.
 */
import * as path from 'node:path';
import type { BoundaryRecord, GovernancePacket } from '@projectrevivesolutions/witness';
import { clearBefore as clearBeforeIn, loadBefore as loadBeforeIn, locateBoundary as locateIn, recordBoundary as recordIn, saveBefore as saveBeforeIn, verdictFor } from '@projectrevivesolutions/witness';
import type { BoundarySpec } from './languages/types';
import { LanguagePlugin, LanguageSettings } from './languages/types';
import { runtimeEnvironment } from './languages/shared/runtime';

export { verdictFor };

/** UntangleIt's own folder for generated files. Never inferred in the shared layer. */
function workDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.untangleit');
}

/**
 * The method starting on a line, by name and by the class it belongs to.
 * Undefined for a language with no line locator, and for a file the parser
 * could not take. The caller then records nothing and claims nothing.
 */
export async function locateBoundary(workspaceRoot: string, relativePath: string, startLine: number): Promise<BoundarySpec | undefined> {
  return locateIn({ workspaceRoot, relativePath, startLine, wasmDir: runtimeEnvironment().wasmDir });
}

/**
 * Records the boundary while the project's own tests run.
 *
 * Returns undefined when this language has no recorder at all, which is not
 * the same as a recording that found nothing: the caller says so, and the
 * gate makes no claim either way.
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

/** Keeps the run before the hand-off, for the run at "Measure again" to compare against. */
export function saveBefore(workspaceRoot: string, runId: string, boundary: BoundarySpec, records: BoundaryRecord[]): void {
  saveBeforeIn(workDir(workspaceRoot), runId, boundary, records);
}

export function loadBefore(workspaceRoot: string, runId: string): BoundaryRecord[] | undefined {
  return loadBeforeIn(workDir(workspaceRoot), runId)?.records;
}

export function clearBefore(workspaceRoot: string, runId: string): void {
  clearBeforeIn(workDir(workspaceRoot), runId);
}
