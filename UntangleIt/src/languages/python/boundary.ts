/**
 * The Python recorder, as UntangleIt plugs it in.
 *
 * The driver itself moved to Witness on 2026-09-23, because DeepTest needs
 * the same recording for its own refactor workflow and a peer product may not
 * import another peer's implementation. What is left here is the adapter: it
 * reads UntangleIt's own settings, names UntangleIt's own folder and identity,
 * and calls the shared API.
 */
import * as path from 'node:path';
import { describePythonRecorder, moduleNameFor, recordPythonBoundary } from '@projectrevivesolutions/witness';
import type { BoundaryRecord } from '@projectrevivesolutions/witness';
import { BoundaryRecorder, BoundarySpec, RunContext } from '../types';
import { pythonFields } from './index';

export { moduleNameFor };

class PythonBoundaryRecorder implements BoundaryRecorder {
  describe(ctx: Pick<RunContext, 'workspaceRoot' | 'settings'>): string {
    const { interpreter } = pythonFields(ctx.settings, ctx.workspaceRoot);
    return describePythonRecorder({ interpreter });
  }

  async record(ctx: RunContext & { boundary: BoundarySpec }): Promise<BoundaryRecord[]> {
    const { interpreter, pytestArgs } = pythonFields(ctx.settings, ctx.workspaceRoot);
    return recordPythonBoundary({
      workspaceRoot: ctx.workspaceRoot,
      workDir: path.join(ctx.workspaceRoot, '.untangleit'),
      tool: 'UntangleIt',
      sourceRoot: ctx.settings.sourceRoot,
      testsPath: ctx.settings.testsPath,
      boundary: ctx.boundary,
      log: ctx.log,
      report: ctx.report,
      signal: ctx.signal,
      interpreter,
      pytestArgs,
    });
  }
}

export function createPythonBoundaryRecorder(): BoundaryRecorder {
  return new PythonBoundaryRecorder();
}
