/**
 * What a recorder driver needs, owned by Witness.
 *
 * The drivers used to take UntangleIt's `RunContext` and read its settings,
 * which meant the shared layer depended on one product's plugin contract. A
 * peer's type cannot travel into Witness, so the driver's needs are stated
 * here instead, as plain data.
 *
 * Two fields exist because of specific mistakes that were available to make.
 *
 * `workDir` is supplied by the caller. The driver used to compute
 * `<workspaceRoot>/.untangleit` itself, and moving that as it stood would
 * have had DeepTest writing its recordings into UntangleIt's private folder:
 * a peer-boundary break that would have looked like a successful relocation.
 * UntangleIt passes `.untangleit`; DeepTest passes `.deeptest`.
 *
 * `tool` is supplied by the caller for the same reason. Witness must not work
 * out who is calling from a path, and generated configs name their author.
 *
 * Settings interpretation stays with the products. `tsFields`, `pythonFields`,
 * and each product's runtime environment read a product's own configuration
 * shape, so they remain product adapters and hand resolved values in here.
 */
import type { ToolName } from '../delivery';
import type { GovernancePacket } from '../governance/packet';

/** The one method a recorded run watches. */
export interface BoundarySpec {
  /** The file holding it, workspace-relative, forward slashes. */
  path: string;
  /** The method name. */
  name: string;
  /** The class it belongs to, when it has one. */
  container?: string;
}

/**
 * Runs the project's own tests once with the Witness boundary recorder
 * attached, and hands back what it recorded.
 *
 * Generic on the calling product's own run context. The concept is shared,
 * which is why it is stated here once rather than written out in each
 * product. The context is not shared, because a product's run context is
 * part of that product's own plugin contract and a peer's type may not
 * travel into Witness. So each product instantiates this with its own.
 *
 * The project still runs its tests the way the project runs them. Witness
 * supplies the path in and nothing here replaces a runner, edits a line of
 * the person's source, or asks the project to install anything.
 */
export interface BoundaryRecorder<Ctx extends { workspaceRoot: string }> {
  /**
   * Plain-language description of what will run, for the log.
   *
   * It takes the run context without the channels a run uses, because it is
   * answered before anything runs and there is nothing yet to log, report,
   * or cancel. The setup screen asks this question too, and it has no run.
   */
  describe(ctx: Omit<Ctx, 'log' | 'report' | 'signal'>): string;
  record(ctx: Ctx & { boundary: BoundarySpec }): Promise<import('../boundary').BoundaryRecord[]>;
}

/** Common to every recorder driver. */
export interface RecorderContext {
  workspaceRoot: string;
  /** The calling tool's own folder for generated files. Never inferred here. */
  workDir: string;
  /** Who is calling. Never inferred here. */
  tool: ToolName;
  /** Code to measure, workspace-relative, or empty for the whole workspace. */
  sourceRoot: string;
  /** Tests folder, workspace-relative, or empty. */
  testsPath: string;
  boundary: BoundarySpec;
  log: (line: string) => void;
  /**
   * The person's own surface, as against the log. A driver uses it for the
   * rare thing they have to be told even though the run itself did not raise
   * it. What travels is a packet, never a paragraph.
   *
   * The governed packet, not the 1.0.19 view. It is the authoritative one, it
   * is what a governed explanation consumes, and a product that wants the old
   * shape for a screen renders it with `toProblemPacket` (rule 90).
   */
  report?: (packet: GovernancePacket) => void;
  signal?: AbortSignal;
}

/** The JavaScript and TypeScript driver's own inputs. */
export interface TypeScriptRecorderContext extends RecorderContext {
  /** The runner to use, or 'auto' to detect one. */
  runner: 'auto' | import('../delivery').Runner;
  /** Extra arguments the person set, as one string. */
  extraArgs: string;
  /** Absolute folder holding the tree-sitter runtime and grammar wasm files. */
  wasmDir: string;
  /**
   * The caller's own pointer at its log, in the words of the control a person
   * presses. It names a product's screen, so the product supplies it; Witness
   * does not invent user-facing wording about somebody else's UI.
   */
  detailsHint: string;
}

/** The Python driver's own inputs. */
export interface PythonRecorderContext extends RecorderContext {
  interpreter: string;
  pytestArgs: string;
}
