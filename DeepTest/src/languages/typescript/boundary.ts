/**
 * The JavaScript and TypeScript recorder, as DeepTest plugs it in.
 *
 * The driver is Witness's, and so is the gate around it. What is here is the
 * adapter: it reads DeepTest's own settings, names DeepTest's own folder and
 * identity, and points at DeepTest's own log.
 *
 * `.deeptest` is passed explicitly and is not a detail. The shared driver
 * never works out whose folder to write into, so that a peer product cannot
 * end up writing its recordings into another peer's private folder.
 */
import * as path from 'node:path';
import { describeTypeScriptRecorder, recordTypeScriptBoundary } from '@projectrevivesolutions/witness';
import type { BoundaryRecord } from '@projectrevivesolutions/witness';
import { runtimeEnvironment } from '../shared/runtime';
import { BoundaryRecorder, BoundarySpec, RunContext } from '../types';
import { SHOW_THE_LOG, tsFields } from './coverage';

class TypeScriptBoundaryRecorder implements BoundaryRecorder {
  describe(ctx: Pick<RunContext, 'workspaceRoot' | 'settings'>): string {
    const { runner } = tsFields(ctx.settings);
    return describeTypeScriptRecorder({ workspaceRoot: ctx.workspaceRoot, runner });
  }

  async record(ctx: RunContext & { boundary: BoundarySpec }): Promise<BoundaryRecord[]> {
    const { runner, extraArgs } = tsFields(ctx.settings);
    return recordTypeScriptBoundary({
      workspaceRoot: ctx.workspaceRoot,
      workDir: path.join(ctx.workspaceRoot, '.deeptest'),
      tool: 'DeepTest',
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
