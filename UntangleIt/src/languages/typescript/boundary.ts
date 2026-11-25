/**
 * The JavaScript and TypeScript recorder, as UntangleIt plugs it in.
 *
 * The driver itself moved to Witness on 2026-09-23, because DeepTest needs
 * the same recording for its own refactor workflow and a peer product may not
 * import another peer's implementation. What is left here is the adapter: it
 * reads UntangleIt's own settings, names UntangleIt's own folder, identity,
 * and log wording, and calls the shared API.
 */
import * as path from 'node:path';
import { describeTypeScriptRecorder, recordTypeScriptBoundary } from '@projectrevivesolutions/witness';
import type { BoundaryRecord } from '@projectrevivesolutions/witness';
import { runtimeEnvironment } from '../shared/runtime';
import { BoundaryRecorder, BoundarySpec, RunContext } from '../types';
import { tsFields } from './index';

/**
 * The pointer at the run log, in the words of the control a person presses.
 * The sidebar carries a "Show the log" link, so this says "Show the log".
 */
export const SHOW_THE_LOG = 'Press "Show the log" to see the runner\'s own output.';

class TypeScriptBoundaryRecorder implements BoundaryRecorder {
  describe(ctx: Pick<RunContext, 'workspaceRoot' | 'settings'>): string {
    const { runner } = tsFields(ctx.settings);
    return describeTypeScriptRecorder({ workspaceRoot: ctx.workspaceRoot, runner });
  }

  async record(ctx: RunContext & { boundary: BoundarySpec }): Promise<BoundaryRecord[]> {
    const { runner, extraArgs } = tsFields(ctx.settings);
    return recordTypeScriptBoundary({
      workspaceRoot: ctx.workspaceRoot,
      workDir: path.join(ctx.workspaceRoot, '.untangleit'),
      tool: 'UntangleIt',
      sourceRoot: ctx.settings.sourceRoot,
      testsPath: ctx.settings.testsPath,
      boundary: ctx.boundary,
      log: ctx.log,
      report: ctx.report,
      signal: ctx.signal,
      runner,
      extraArgs,
      wasmDir: runtimeEnvironment().wasmDir,
      detailsHint: SHOW_THE_LOG,
    });
  }
}

export function createTypeScriptBoundaryRecorder(): BoundaryRecorder {
  return new TypeScriptBoundaryRecorder();
}
