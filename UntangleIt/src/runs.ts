/**
 * The run record: one entry per untangling, in .untangleit/runs.json at the
 * workspace root. Plain JSON, human readable, meant to be committed so the
 * history of what was untangled, by whose decision, and with what result
 * travels with the code. This is the public record other tools may read
 * (see docs/toolkit/toolkit-api.md); its shape only grows.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ApplicationAnchor } from '@projectrevivesolutions/witness';
import { Piece, Snapshot } from './engine/tangle';

/**
 * 'behaviour-changed' is from 1.0.19: the gate compared the method's
 * recorded behaviour before the hand-off with its behaviour now and they
 * disagreed. It is a blocking outcome, whatever the tangle came down to and
 * whatever the suite reported, and readers written before 1.0.19 that do
 * not know it should treat it as not within limit.
 */
export type RunStatus = 'sent' | 'within-limit' | 'still-over' | 'tests-fail' | 'behaviour-changed' | 'stopped';

export interface RunRecord {
  id: string;
  path: string;
  name: string;
  startLine: number;
  /** The number the run was judged by, before. See `measure` for which number. */
  before: number;
  /**
   * Which measure `before`, `limit`, and the pieces' `over` were judged by.
   * 'mbcc' (tangle) from 0.1.11. Absent on records written by 0.1.x, which
   * judged by ways through; readers treat a missing value as 'ways'. Added
   * without a file-version bump because the shape only grew.
   */
  measure?: 'ways' | 'mbcc';
  limit: number;
  by: string;
  startedAt: string;
  /** Rounds handed to the assistant so far. */
  rounds: number;
  status: RunStatus;
  /** Filled in by each "Measure again". */
  measuredAt?: string;
  pieces?: Piece[];
  tests?: { passed: number; failed: number; errors: number };
  /** Plain sentence for the person, kept so the record reads on its own. */
  outcome?: string;
  /**
   * The behaviour gate's answer for the latest round, when the gate ran.
   * Absent on records written before 1.0.19 and on languages with no
   * recorder; readers treat absent as "the gate did not run", which is not
   * a pass. Added without a file-version bump because the shape only grew.
   */
  behaviour?: { verdict: 'equivalent' | 'changed' | 'insufficient'; reason?: string; compared?: number; sentence: string };
  /**
   * The method the behaviour gate is watching, resolved at the hand-off. The
   * container is what lets the run at "Measure again" find the method again
   * after the assistant moved it. Absent when this language has no recorder.
   */
  boundary?: { path: string; name: string; container?: string };
  /**
   * The governed attempt this run came from, when it came from one.
   *
   * Three separate identities, and the distinctions are load-bearing rather
   * than tidy.
   *
   *   `governedInteractionId`  which KIND of thing was attempted. Semantic
   *                  and stable across releases (rule 91). On its own it
   *                  correlates nothing: a person can untangle four methods
   *                  in an afternoon.
   *   `attemptId`    WHICH attempt it was. Created by Polyglot when the
   *                  capability was issued, random and content-free, and the
   *                  join to the governance record.
   *   `anchor`       what would show the authorized change LANDED.
   *
   * **The anchor is also the first content identity of the source this record
   * has ever carried.** Until Phase 5 a `RunRecord` held a path, a name, a
   * line and some numbers, and nothing that could say whether the file had
   * changed. The existence of an after-record was being read as that, and it
   * is not: an after-record is produced by the next ordinary measurement,
   * which runs whether or not the person applied anything, so it proves a
   * measurement happened and nothing else.
   *
   * Absent together on a run made outside a governed interaction, and a run
   * never acquires them later. Added without a file-version bump because the
   * shape only grew.
   */
  governedInteractionId?: string;
  attemptId?: string;
  anchor?: ApplicationAnchor;
  /** The outcome of the later re-measurement. Absent while unresolved. */
  verification?: { outcome: 'held' | 'changed' | 'insufficient' | 'not-run'; at: string };
  snapshot: Snapshot;
}

export interface RunFile {
  version: 1;
  runs: RunRecord[];
}

export function runFilePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.untangleit', 'runs.json');
}

export function emptyRunFile(): RunFile {
  return { version: 1, runs: [] };
}

// ---------------------------------------------------------------------------
// Storage integrity (Phase 7, step 0)
// ---------------------------------------------------------------------------

/**
 * A store that exists and cannot be read.
 *
 * Its own error type, because the one thing that must never happen to it is
 * being handled the same way as "there is nothing here yet".
 */
export class CorruptStoreError extends Error {}

/**
 * The three states a runs file can be in, and they are three.
 *
 * **`absent` is a legitimate empty store.** Nobody has untangled anything
 * yet. **`unreadable` is not.** The file is there, the person's untanglings
 * are in it, and we cannot read them. This used to return an empty store and
 * log "Starting a fresh record", and the next ordinary save then overwrote
 * it. Giving the state its own name is the repair: the types no longer let a
 * caller reach for the empty one by accident.
 */
export type RunsRead =
  | { readonly kind: 'absent' }
  | { readonly kind: 'loaded'; readonly file: RunFile }
  | { readonly kind: 'unreadable'; readonly why: string };

function parseRunFile(text: string): RunFile {
  const parsed = JSON.parse(text) as Partial<RunFile>;
  if (parsed.version !== 1 || !Array.isArray(parsed.runs)) {
    throw new Error('not a UntangleIt run file');
  }
  return { version: 1, runs: parsed.runs };
}

/** Reads the store at an absolute path, saying which of the three states it is in. */
export function readRunsAt(file: string): RunsRead {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    // Not there is not the same as not readable, and only one of them is fine.
    return (err as NodeJS.ErrnoException).code === 'ENOENT' ? { kind: 'absent' } : { kind: 'unreadable', why: (err as Error).message };
  }
  try {
    return { kind: 'loaded', file: parseRunFile(text) };
  } catch (err) {
    return { kind: 'unreadable', why: (err as Error).message };
  }
}

/**
 * Writes the store, unless what is already there could not be read.
 *
 * The guard is at the one door every write passes through. The corrupt bytes
 * are left exactly as they are: they are the person's record of work in
 * flight, they may be recoverable by hand, and overwriting them to make the
 * tool feel tidy is the defect this exists to close.
 */
export function writeRunsAt(file: string, runs: RunFile): void {
  const existing = readRunsAt(file);
  if (existing.kind === 'unreadable') {
    throw new CorruptStoreError(
      `${path.basename(file)} exists and could not be read (${existing.why}), so UntangleIt will not overwrite it. Your untanglings are still in that file. Move it aside or repair it, and UntangleIt will start using it again.`,
    );
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(runs, null, 2)}\n`, 'utf8');
}

/** The three states, for a caller that wants to handle them rather than fail. */
export function readRuns(workspaceRoot: string): RunsRead {
  return readRunsAt(runFilePath(workspaceRoot));
}

/**
 * The store, or a refusal.
 *
 * Absent is an empty store; unreadable throws, so a caller fails or
 * preserves rather than manufacturing a history nobody has.
 */
export function loadRuns(workspaceRoot: string, log?: (line: string) => void): RunFile {
  const read = readRuns(workspaceRoot);
  if (read.kind === 'absent') {
    return emptyRunFile();
  }
  if (read.kind === 'unreadable') {
    const message = `UntangleIt could not read ${runFilePath(workspaceRoot)}: ${read.why}. Your untanglings are still in that file and nothing will be written over them.`;
    log?.(message);
    throw new CorruptStoreError(message);
  }
  return read.file;
}

/** Writes the store, refusing over a file that could not be read. */
export function saveRuns(workspaceRoot: string, file: RunFile): void {
  writeRunsAt(runFilePath(workspaceRoot), file);
}

/** The open run for a method, if any: the newest one not yet within the limit or stopped. */
export function openRunFor(file: RunFile, relativePath: string, name: string): RunRecord | undefined {
  return [...file.runs].reverse().find((r) => r.path === relativePath && r.name === name && (r.status === 'sent' || r.status === 'still-over' || r.status === 'tests-fail'));
}

export function upsertRun(file: RunFile, run: RunRecord): RunFile {
  const others = file.runs.filter((r) => r.id !== run.id);
  return { version: 1, runs: [...others, run] };
}

export function newRunId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function whoAmI(): string {
  return process.env.USERNAME || process.env.USER || 'someone';
}
