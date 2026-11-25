/**
 * THE CONTRACT.
 *
 * Every language plugs in here, and nothing above this file knows which
 * language it is talking to. The runner, the engine, the overlay, the
 * sidebar, the report, and the configuration screen consume only these
 * types. Adding a language is a new folder under src/languages/, one line
 * in the registry, and zero edits anywhere else. If adding a language needs
 * an edit above this contract, that is a bug in the contract.
 *
 * A plugin supplies four things, and may supply a fifth:
 *   detect     - look at the workspace and pre-fill every setting it can,
 *                so the first run asks the user nothing
 *   coverage   - run the tests and say which tests executed each line
 *   structure  - parse a source file and say what guards each line
 *   configFields - the small language-specific block on the config screen,
 *                rendered by the shared screen from this description
 *   recorder   - optional: run the project's own tests once more with the
 *                Witness boundary recorder attached, for the behaviour
 *                gate on a function handed to an assistant to refactor. A
 *                language without one has no gate, and the gate says so
 *                rather than passing.
 */
import type { BoundarySpec as WitnessBoundarySpec, BoundaryRecorder as WitnessBoundaryRecorder, GovernancePacket } from '@projectrevivesolutions/witness';
import { DepthOptions, FileCoverage, FileStructure } from '../engine/types';

/** One language-specific field on the configuration screen. */
export interface FieldSpec {
  /** Key inside deeptest.languageSettings.<languageId>. */
  key: string;
  label: string;
  kind: 'text' | 'number' | 'checkbox' | 'select';
  placeholder?: string;
  /** One sentence under the field. Plain words. */
  hint?: string;
  options?: Array<{ value: string; label: string }>;
}

/** Everything a plugin worked out about a workspace without asking. */
export interface Detection {
  /** Tests folder relative to the workspace, or empty when unknown. */
  testsPath: string;
  /** Code under test relative to the workspace, or empty for the whole workspace. */
  sourceRoot: string;
  /** Test files found, workspace-relative, for the "found N tests" line. */
  testFiles: string[];
  /** Pre-filled values for this plugin's configFields. */
  fields: Record<string, unknown>;
  /** Plain-language notes shown on the config screen, e.g. "Found pytest in pyproject.toml". */
  notes: string[];
}

/** What the host can do for a plugin during detection. Keeps vscode out of plugins. */
export interface HostServices {
  /** Language id of the active editor, if any. */
  activeLanguageId?: string;
  /**
   * Exports of another installed editor extension, or undefined. Lets a
   * plugin ask e.g. the Python extension which interpreter is selected
   * without the host knowing that such a thing exists.
   */
  extensionApi(extensionId: string): Promise<unknown>;
}

/** The user's answers for one language: the common fields plus the plugin's own. */
export interface LanguageSettings {
  testsPath: string;
  sourceRoot: string;
  fields: Record<string, unknown>;
}

export interface RunContext {
  workspaceRoot: string;
  settings: LanguageSettings;
  log: (line: string) => void;
  /**
   * The person's own surface, as against the log.
   *
   * A driver uses this for the rare thing a person has to be told even
   * though the run itself did not raise it: the project path stopped the
   * runner before a test executed, for instance, which the result alone
   * reports as no evidence and which would otherwise look like their fault.
   *
   * What travels is the governed packet, not a paragraph, and not the 1.0.19
   * view of it: that view is an output only (rule 90). The driver states what
   * it established, what it could not, and what must not be recommended; the
   * product decides how to show it. Nothing down here writes prose for a
   * person to read.
   *
   * Optional because a headless caller has no such surface, and a driver
   * that has nothing to say to a person is the ordinary case.
   */
  report?: (packet: GovernancePacket) => void;
  signal?: AbortSignal;
}

/**
 * The one method a recorded run watches. Witness owns it; DeepTest and
 * UntangleIt both re-export it, so there is one definition in the toolkit.
 */
export type BoundarySpec = WitnessBoundarySpec;

/**
 * Runs the project's own tests once with the Witness boundary recorder
 * attached, and hands back what it recorded.
 *
 * Witness states the contract, generic on the calling product's run
 * context, and DeepTest fixes that to its own. The project still runs its
 * tests the way the project runs them. Nothing here replaces a runner,
 * edits a line of the person's source, or asks the project to install
 * anything.
 */
export type BoundaryRecorder = WitnessBoundaryRecorder<RunContext>;

export interface TestRunSummary {
  passed: number;
  failed: number;
  errors: number;
  skipped: number;
  exitCode: number | null;
}

/**
 * What the run's attribution says about itself. The runner reports how many
 * tests finished; the hooks write one record per test. When the two
 * disagree, or a record says its boundary was cut, the evidence has a hole
 * in it and the runner refuses to draw a card from it (architecture section
 * 7, "The check did not finish.") rather than show a number that looks
 * measured and is not.
 */
export interface Evidence {
  /** Tests the runner reported as finished: passed plus failed. */
  testsFinished: number;
  /** Per-test attribution records the hooks wrote. */
  testsRecorded: number;
  /**
   * Records whose test boundary was broken: a test began while another was
   * still open, or a test was still open when its process ended. Each one
   * is a record that credits lines to a test that did not run them alone.
   */
  brokenBoundaries: number;
  /**
   * Records carrying at least one file. A record with `files: {}` is a test
   * that reached nothing the instrumenter was watching, which is ordinary on
   * its own (a test of a constant, or of a test helper) and damning when it
   * is every record in the run.
   */
  recordsWithEvidence: number;
  /**
   * Measured files with at least one line that executed, under a test or at
   * import time. Zero across a run that finished tests means the run
   * measured nothing at all, whatever the record count says.
   */
  filesWithHits: number;
  /**
   * Whether the two counts can be held against each other. coverage.py's
   * contexts appear only where a test touched a measured line, so a test
   * that touched none leaves no record and the counts are not comparable.
   */
  reconcilable: boolean;
}

export interface CoverageRun {
  coverages: FileCoverage[];
  tests: TestRunSummary;
  /** Source files measured, workspace-relative, forward slashes. */
  measuredFiles: string[];
  evidence: Evidence;
  /**
   * The runner this run actually used, as the plugin resolved it, not as the
   * person configured it. A run that started with `auto` reports whichever
   * runner `auto` turned out to be, because by the time there is a run there
   * is no longer any ambiguity about which one ran.
   *
   * This is a factual field. A governed packet quotes it, so it carries the
   * runner and never the language: "TypeScript" is not a test runner, and
   * writing it here to avoid an empty value would put a guess into a record
   * whose whole point is that everything in it was measured.
   */
  runner: string;
}

export interface EnvironmentCheck {
  ok: boolean;
  /** e.g. "Python 3.12.1, coverage 7.6.1, pytest 8.3.2" */
  summary: string;
  problems: string[];
  /** A command that would fix the problems, offered to the user as a button. */
  fix?: { title: string; command: string; args: string[] };
}

/** Runs the tests and attributes every executed line to the tests that ran it. */
export interface CoverageSource {
  discoverTests(ctx: Pick<RunContext, 'workspaceRoot' | 'settings'>): Promise<string[]>;
  checkEnvironment(ctx: Pick<RunContext, 'workspaceRoot' | 'settings' | 'log'>): Promise<EnvironmentCheck>;
  run(ctx: RunContext): Promise<CoverageRun>;
}

/** Parses one source file into depth, complexity, routes, unreachable, and declarations. */
export interface StructureSource {
  analyze(relativePath: string, text: string, options: DepthOptions): FileStructure;
  dispose(): void;
}

export interface StructureEnvironment {
  /** Absolute folder holding the tree-sitter runtime and grammar wasm files. */
  wasmDir: string;
}

export interface LanguagePlugin {
  /** Stable id used in settings: 'python', 'typescript'. */
  readonly id: string;
  readonly displayName: string;
  /** VS Code language ids this plugin measures (typescript, typescriptreact...). */
  readonly vscodeLanguageIds: string[];
  /** File extensions, with the dot, for workspace detection. */
  readonly extensions: string[];
  readonly configFields: FieldSpec[];

  isTestFile(fileName: string): boolean;
  detect(workspaceRoot: string, host: HostServices): Promise<Detection>;
  createCoverageSource(): CoverageSource;
  /** The behaviour gate's recorder, when this language has one. */
  createBoundaryRecorder?(): BoundaryRecorder | undefined;
  createStructureSource(env: StructureEnvironment): Promise<StructureSource>;
}
