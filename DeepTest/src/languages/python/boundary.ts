/**
 * The Python recorder, as DeepTest plugs it in.
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
import { describePythonRecorder, recordPythonBoundary } from '@projectrevivesolutions/witness';
import type { BoundaryRecord } from '@projectrevivesolutions/witness';
import { BoundaryRecorder, BoundarySpec, RunContext } from '../types';
import { pythonFields } from './coverage';

class PythonBoundaryRecorder implements BoundaryRecorder {
  describe(ctx: Pick<RunContext, 'workspaceRoot' | 'settings'>): string {
    const { interpreter } = pythonFields(ctx.settings, ctx.workspaceRoot);
    return describePythonRecorder({ interpreter });
  }

  async record(ctx: RunContext & { boundary: BoundarySpec }): Promise<BoundaryRecord[]> {
    const { interpreter, pytestArgs } = pythonFields(ctx.settings, ctx.workspaceRoot);
    return recordPythonBoundary({
      workspaceRoot: ctx.workspaceRoot,
      workDir: path.join(ctx.workspaceRoot, '.deeptest'),
      tool: 'DeepTest',
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
