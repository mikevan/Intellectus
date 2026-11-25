/**
 * Human decisions about shortfalls. The tool finds and explains; the person
 * who is accountable decides. Nothing here is ever written without a person
 * choosing it, and nothing here is ever acted on by the tool.
 *
 * Two kinds of decision:
 *   accept  - "I know, and here is why." The shortfall leaves the ranked
 *             list and sits in its own section with the reason beside it.
 *   fix     - "Hand this to my AI." The brief was handed over; the next
 *             run reports whether the line cleared its bar, and if not,
 *             says "attempted, still short by N". No retry on the tool's
 *             initiative. The human decides again.
 *
 * A decision is pinned to the text of the line it was made about. When the
 * line changes, the decision no longer applies and says so, because a
 * reason written about one line must not silently cover a different one.
 *
 * Stored in <workspace>/.deeptest/decisions.json, plain JSON, human
 * readable, meant to be committed so the reasons travel with the code.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ApplicationAnchor } from '@projectrevivesolutions/witness';
import { AnalysisResult, FunctionComplexity, LineResult } from '../engine/types';

export type DecisionKind = 'accept' | 'fix';

export interface Decision {
  path: string;
  line: number;
  /** Hash of the trimmed line text at decision time. */
  lineHash: string;
  kind: DecisionKind;
  /** Required for accept. Free text for fix (which assistant, if the person wants to note it). */
  reason: string;
  by: string;
  at: string;
  /** The gap when the decision was made, so "still short by N" can say whether anything moved. */
  gapAtDecision: number;
  /**
   * Present when the decision is about a whole function rather than one
   * line: `line` is then the line the function starts on, and the hash pins
   * that line. gapAtDecision is how many ways through the function was over
   * the limit.
   */
  scope?: 'function';
  functionName?: string;
  /**
   * Whether the behaviour gate governs this decision, and what it managed
   * at the hand-off. Written once, when the decision is created, and never
   * changed afterwards.
   *
   * This field is what tells a 1.0.21 decision from an older one, and it
   * exists because without it they are indistinguishable and a missing
   * before-record becomes a silent bypass.
   *
   *   'recorded'     the boundary was recorded before the assistant was
   *                  handed the work. The gate governs this decision. A
   *                  missing before-record afterwards is a defect in the
   *                  gate, never an absence of evidence, and this decision
   *                  cannot be reported fixed without a verdict.
   *   'not-applicable'  the person asked for tests, not a refactor. The
   *                  shape of the function is not meant to change, so there
   *                  is nothing for the gate to hold. Stated rather than
   *                  left absent, so that a 1.0.21 decision always says
   *                  what the gate did about it.
   *   'unavailable'  no recording could be made: this language has no
   *                  recorder, the parser could not find the method, or the
   *                  recording run failed. The gate governs this decision
   *                  too, and it stays explicitly unverified for the rest
   *                  of its life. It never falls back to the complexity
   *                  number alone.
   *   absent         the decision was made before 1.0.21. Old behaviour,
   *                  unchanged. Nothing is claimed about it either way, and
   *                  no decision can acquire this field later.
   */
  behaviourGate?: 'recorded' | 'unavailable' | 'not-applicable';
  /**
   * The gate's answer at the last measurement, for a decision it governs.
   * Absent until a measurement has compared the two recordings.
   */
  behaviour?: { verdict: 'equivalent' | 'changed' | 'insufficient'; reason?: string; compared?: number; sentence: string };
  /**
   * The governed attempt this decision came from, when it came from one.
   *
   * Three separate identities, and they were confused with one another more
   * than once before they were written down together.
   *
   *   `governedInteractionId`  which KIND of thing was attempted. Semantic
   *                  and stable across releases (rule 91). A person can run
   *                  `coverage.propose-test` against four lines in an
   *                  afternoon, so on its own it correlates nothing.
   *   `attemptId`    WHICH attempt it was. One per run, created by Polyglot
   *                  when the capability was issued, random and content-free.
   *                  This is the join to the governance record.
   *   `anchor`       what would show the authorized change LANDED. Not an
   *                  identity: `lineHash` above pins the decided line so a
   *                  decision can be relocated after code moves, and it says
   *                  nothing about whether work happened. A refactor that
   *                  rewrites a body under an unchanged signature leaves
   *                  `lineHash` untouched, so using it here would report
   *                  work that was done as not done.
   *
   * Absent together on a decision made outside a governed interaction, and
   * a decision never acquires them later.
   */
  governedInteractionId?: string;
  attemptId?: string;
  anchor?: ApplicationAnchor;
  /**
   * What field 10 will re-measure, per target, with the evidence that
   * existed when the proposal was made.
   *
   * **Per targeted line, never one flattened union.** A flattened set would
   * hide a pre-existing test ceasing to exercise one target line while still
   * appearing on another, which is precisely the loss the measurement is
   * there to catch. `testsBefore` is that line's `LineResult.tests` at
   * proposal time, which the ordinary run already produces: nothing new is
   * collected for this.
   */
  verificationTargets?: Array<{ path: string; line: number; testsBefore: string[] }>;
  /** The outcome of the later re-measurement. Absent while unresolved. */
  verification?: { outcome: 'held' | 'changed' | 'insufficient' | 'not-run'; at: string };
}

export interface DecisionFile {
  version: 1;
  decisions: Decision[];
}

export type DecisionState =
  | { kind: 'none' }
  | { kind: 'accepted'; decision: Decision }
  | { kind: 'fix-pending'; decision: Decision; stillShortBy: number; moved: boolean }
  | { kind: 'fixed'; decision: Decision }
  /**
   * The function is within the limit and the gate cannot say it still does
   * what it did. This is not `fixed` and must never be shown as one. From
   * 1.0.21; only a decision the gate governs can reach it.
   */
  | { kind: 'unverified'; decision: Decision; why: UnverifiedReason }
  /** The function is within the limit and the gate says its behaviour changed. */
  | { kind: 'behaviour-changed'; decision: Decision; sentence: string }
  | { kind: 'stale'; decision: Decision };

/**
 * Why a function that is now within the limit still cannot be called fixed.
 *
 *   'not-recorded'  nothing could be recorded at the hand-off, so there is
 *                   nothing to compare against and never will be.
 *   'not-compared'  the gate governs this decision and no verdict has been
 *                   reached yet. Either the measurement after the hand-off
 *                   has not happened, or the recording that was kept has
 *                   gone missing, which is a defect and not a pass.
 *   'insufficient'  both runs were made and the comparison could not reach
 *                   a verdict. The verdict's own reason says why.
 */
export type UnverifiedReason = 'not-recorded' | 'not-compared' | 'insufficient';

export function hashLine(text: string): string {
  return createHash('sha1').update(text.trim()).digest('hex').slice(0, 16);
}

export function emptyDecisionFile(): DecisionFile {
  return { version: 1, decisions: [] };
}

export function parseDecisionFile(json: string): DecisionFile {
  const parsed = JSON.parse(json) as Partial<DecisionFile>;
  if (parsed.version !== 1 || !Array.isArray(parsed.decisions)) {
    throw new Error('decisions.json is not a DeepTest decisions file');
  }
  return { version: 1, decisions: parsed.decisions };
}

export function serializeDecisionFile(file: DecisionFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
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
 * The three states a decisions file can be in, and they are three.
 *
 * **`absent` is a legitimate empty store.** Nobody has decided anything yet,
 * and an empty store is the honest answer.
 *
 * **`unreadable` is not.** The file is there, somebody's decisions are in it,
 * and we cannot read them. Before Phase 7 this returned an empty store and
 * logged that the file was "left untouched", and the next ordinary save then
 * overwrote it. The message was true for about a second. Giving this state
 * its own name is the whole repair: a caller can no longer reach for the
 * empty one by accident, because the types do not let it.
 */
export type DecisionsRead =
  | { readonly kind: 'absent' }
  | { readonly kind: 'loaded'; readonly file: DecisionFile }
  | { readonly kind: 'unreadable'; readonly why: string };

/** Reads the store at an absolute path, saying which of the three states it is in. */
export function readDecisionsAt(file: string): DecisionsRead {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    // Not there is not the same as not readable, and only one of them is fine.
    return (err as NodeJS.ErrnoException).code === 'ENOENT' ? { kind: 'absent' } : { kind: 'unreadable', why: (err as Error).message };
  }
  try {
    return { kind: 'loaded', file: parseDecisionFile(text) };
  } catch (err) {
    return { kind: 'unreadable', why: (err as Error).message };
  }
}

/**
 * Writes the store, unless what is already there could not be read.
 *
 * The guard is here rather than only at the call sites because this is the
 * one place every write passes through, and a rule enforced at the door is
 * a rule. The corrupt bytes are left exactly as they are: they are the
 * person's decisions, they may be recoverable by hand, and overwriting them
 * to make the tool feel tidy is the defect this exists to close.
 */
export function writeDecisionsAt(file: string, decisions: DecisionFile): void {
  const existing = readDecisionsAt(file);
  if (existing.kind === 'unreadable') {
    throw new CorruptStoreError(
      `${path.basename(file)} exists and could not be read (${existing.why}), so DeepTest will not overwrite it. Your decisions are still in that file. Move it aside or repair it, and DeepTest will start using it again.`,
    );
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, serializeDecisionFile(decisions), 'utf8');
}

/** Replaces any earlier decision about the same line. One line, one current decision. */
export function recordDecision(file: DecisionFile, decision: Decision): DecisionFile {
  const others = file.decisions.filter((d) => !(d.path === decision.path && d.line === decision.line && (d.scope ?? 'line') === (decision.scope ?? 'line')));
  return { version: 1, decisions: [...others, decision] };
}

export function removeDecision(file: DecisionFile, path: string, line: number, scope: 'line' | 'function' = 'line'): DecisionFile {
  return { version: 1, decisions: file.decisions.filter((d) => !(d.path === path && d.line === line && (d.scope ?? 'line') === scope)) };
}

export function findDecision(file: DecisionFile, path: string, line: number): Decision | undefined {
  return file.decisions.find((d) => d.path === path && d.line === line && d.scope !== 'function');
}

/**
 * What a decision means for a line as it stands now. `currentLineText` is
 * the line's text today; undefined when the file could not be read.
 */
export function decisionState(decision: Decision | undefined, line: LineResult, currentLineText: string | undefined): DecisionState {
  if (!decision) {
    return { kind: 'none' };
  }
  if (currentLineText !== undefined && hashLine(currentLineText) !== decision.lineHash) {
    return { kind: 'stale', decision };
  }
  if (decision.kind === 'accept') {
    return { kind: 'accepted', decision };
  }
  if (line.gap === 0) {
    return { kind: 'fixed', decision };
  }
  return { kind: 'fix-pending', decision, stillShortBy: line.gap, moved: line.gap < decision.gapAtDecision };
}

/**
 * What a function-level fix decision means for a function as it stands
 * now. "Short" here is ways through above the limit, not tests.
 *
 * Being within the limit is not on its own a fix, and from 1.0.21 this
 * stops saying that it is. A refactor can lower the number and change the
 * answer, and reporting that as success is the one outcome this whole gate
 * exists to prevent. So for a decision the gate governs, the number gets
 * the function as far as the door and the verdict decides whether it goes
 * through.
 *
 * Decisions made before 1.0.21 carry no `behaviourGate` and keep the old
 * behaviour exactly. No claim is made about them in either direction.
 */
export function functionDecisionState(decision: Decision | undefined, fn: FunctionComplexity, limit: number, currentStartLineText: string | undefined): DecisionState {
  if (!decision || decision.scope !== 'function') {
    return { kind: 'none' };
  }
  if (currentStartLineText !== undefined && hashLine(currentStartLineText) !== decision.lineHash) {
    return { kind: 'stale', decision };
  }
  const over = fn.complexity - limit;
  if (over > 0) {
    return { kind: 'fix-pending', decision, stillShortBy: over, moved: over < decision.gapAtDecision };
  }
  return withinLimitState(decision);
}

/**
 * What a decision means once its function is within the limit.
 *
 * Kept apart from the arithmetic above so the rule is readable on its own,
 * and so there is exactly one place that can return `fixed`.
 */
function withinLimitState(decision: Decision): DecisionState {
  if (decision.behaviourGate === undefined) {
    // Made before 1.0.21. The gate never governed it and cannot start now.
    return { kind: 'fixed', decision };
  }
  if (decision.behaviourGate === 'not-applicable') {
    // Tests were asked for, not a refactor. Nothing was meant to move.
    return { kind: 'fixed', decision };
  }
  if (decision.behaviourGate === 'unavailable') {
    return { kind: 'unverified', decision, why: 'not-recorded' };
  }
  if (!decision.behaviour) {
    // The gate governs this one and nothing has been compared. A kept
    // recording that has gone missing lands here too, which is the point:
    // absent evidence under a gate that was meant to produce it is a
    // defect, and a defect is not a pass.
    return { kind: 'unverified', decision, why: 'not-compared' };
  }
  if (decision.behaviour.verdict === 'changed') {
    return { kind: 'behaviour-changed', decision, sentence: decision.behaviour.sentence };
  }
  if (decision.behaviour.verdict === 'insufficient') {
    return { kind: 'unverified', decision, why: 'insufficient' };
  }
  return { kind: 'fixed', decision };
}

export interface DecidedFunction {
  path: string;
  fn: FunctionComplexity;
  state: DecisionState;
}

/** Every function that carries a decision, with what it means now. */
export function applyFunctionDecisions(result: AnalysisResult, file: DecisionFile, readLine: (path: string, line: number) => string | undefined): DecidedFunction[] {
  const out: DecidedFunction[] = [];
  const limit = result.summary.thresholds.maxFunctionComplexity;
  for (const f of result.files) {
    for (const fn of f.functions) {
      const decision = file.decisions.find((d) => d.scope === 'function' && d.path === f.path && d.line === fn.startLine);
      if (decision) {
        out.push({ path: f.path, fn, state: functionDecisionState(decision, fn, limit, readLine(f.path, fn.startLine)) });
      }
    }
  }
  return out;
}

export interface DecidedLine {
  path: string;
  line: LineResult;
  state: DecisionState;
}

/**
 * Joins a result with the decision file. Returns every shortfall with its
 * decision state, so callers can split "open" from "accepted" without
 * re-deriving the rule.
 */
export function applyDecisions(result: AnalysisResult, file: DecisionFile, readLine: (path: string, line: number) => string | undefined): DecidedLine[] {
  const out: DecidedLine[] = [];
  for (const f of result.files) {
    for (const line of f.lines) {
      if (line.status !== 'short' && line.status !== 'untested') {
        continue;
      }
      const decision = findDecision(file, f.path, line.line);
      out.push({ path: f.path, line, state: decisionState(decision, line, decision ? readLine(f.path, line.line) : undefined) });
    }
  }
  return out;
}

/** Shortfalls a person still has to decide on, worst first by the engine's ranking. */
export function openShortfalls(decided: DecidedLine[], ranking: AnalysisResult['shortfalls']): DecidedLine[] {
  const key = (p: string, l: number): string => `${p}:${l}`;
  const byKey = new Map(decided.map((d) => [key(d.path, d.line.line), d]));
  const out: DecidedLine[] = [];
  for (const s of ranking) {
    const d = byKey.get(key(s.path, s.line));
    if (d && d.state.kind !== 'accepted') {
      out.push(d);
    }
  }
  return out;
}
