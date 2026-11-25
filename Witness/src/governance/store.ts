/**
 * The governance store: the record, made durable.
 *
 * Phase 2 built the schema and said persistence was Phase 7's. This is it.
 * Witness owns the format, the schema check, the fold and the integrity
 * rules; the product injects the directory and owns nothing else. That is
 * the same split `behaviour/gate.ts` already uses, and it exists for the
 * same reason: a shared layer that inferred a directory could write into the
 * wrong product's folder.
 *
 * **Not best-effort, and this is the whole difference from the boundary
 * writer.** `boundary.ts` swallows its errors on purpose, because a missing
 * observation costs one comparison and failing a person's test run over it
 * would be worse. That reasoning does not transfer. A missing governance
 * record is a governed act with no evidence it was governed, and a store
 * whose failures are invisible reports a success it did not achieve. Every
 * failure here is typed, and none of them can be read as success.
 *
 * **Append-only, two entry kinds.** A record is written once. A later
 * verification is a second entry joined by `attemptId`, never a rewrite of
 * the first. That makes the immutability of the original facts a property of
 * the storage rather than a convention somebody has to keep: nothing in this
 * file rewrites a line, and the only write is an append.
 *
 * **The delimiter is part of the record.** The writer appends `<json>\n` in
 * one call, and a record is complete only when its terminating newline is
 * there. That is what lets a torn append be told apart from a corrupt
 * record, which matters more here than in the boundary log: there, a lost
 * line is one observation; here, tolerating a malformed line would mean
 * quietly accepting an audit history that is wrong.
 *
 * No database. Writes are appends of a few hundred bytes at human speed,
 * reads are whole-file when somebody opens the history, and there is no
 * query, no index and no concurrent writer.
 *
 * `vscode`-free, like the rest of Witness (rule 45).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AttemptId } from './capability';
import type { VerificationRule } from './packet';
import type { GovernanceRecord } from './record';
import { recordVerification } from './record';
import type { VerificationOutcome } from './verification';

/** The file, inside whatever directory the product injects. */
export const GOVERNANCE_FILE = 'governance.jsonl';

export function governancePath(dir: string): string {
  return path.join(dir, GOVERNANCE_FILE);
}

// ---------------------------------------------------------------------------
// Failures
// ---------------------------------------------------------------------------

/**
 * Why a store operation did not happen.
 *
 * Each one is a different thing to tell the person and a different thing for
 * the product to do, so they stay apart rather than collapsing into "it
 * failed".
 */
export type StoreFailure =
  /** The directory or the file could not be written. */
  | 'write'
  /** A second record for an attempt the store already holds. */
  | 'duplicate-attempt'
  /** The file exists and cannot be trusted. Never reported as an empty history. */
  | 'corrupt'
  /** A line is not a shape this version writes. */
  | 'schema'
  /** The stored record and the product's record disagree about the interaction. */
  | 'consistency'
  /** There is no record for this attempt, which is sometimes legitimate. */
  | 'missing-record';

export class GovernanceStoreError extends Error {
  readonly reason: StoreFailure;
  constructor(reason: StoreFailure, message: string) {
    super(message);
    this.reason = reason;
    this.name = 'GovernanceStoreError';
  }
}

// ---------------------------------------------------------------------------
// The two entry kinds
// ---------------------------------------------------------------------------

interface RecordEntry {
  readonly entry: 'record';
  readonly v: 1;
  readonly record: GovernanceRecord;
}

interface VerificationEntry {
  readonly entry: 'verification';
  readonly v: 1;
  readonly attemptId: string;
  readonly kind: VerificationRule['kind'];
  readonly outcome: VerificationOutcome;
  readonly at: string;
}

type Entry = RecordEntry | VerificationEntry;

// ---------------------------------------------------------------------------
// The fold
// ---------------------------------------------------------------------------

/** One attempt's verification as the history reports it. */
export interface RecordedOutcome {
  readonly kind: VerificationRule['kind'];
  readonly outcome: VerificationOutcome;
  readonly at: string;
}

/**
 * One attempt, as the viewer shows it.
 *
 * `conflicted` is a state of its own rather than a winner and a loser.
 * Two deterministic verifications that disagree are evidence about
 * Polyglot's own verification history, and choosing one would delete the
 * interesting half. Both are here, in the order they were observed.
 */
export interface FoldedRecord {
  readonly record: GovernanceRecord;
  readonly status: 'unverified' | 'verified' | 'conflicted';
  readonly outcomes: readonly RecordedOutcome[];
}

export interface GovernanceHistory {
  /** Newest first, which is the order a person reads a log in. */
  readonly records: readonly FoldedRecord[];
  /**
   * Whether the last line was an incomplete append that was ignored.
   *
   * Reported rather than hidden: it is the one tolerated imperfection and
   * the person is entitled to know the file ends mid-write.
   */
  readonly interruptedAppend: boolean;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function parseEntry(line: string, where: string): Entry {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch (err) {
    throw new GovernanceStoreError('corrupt', `${where} is not valid JSON (${(err as Error).message}). The governance history could not be read, and nothing has been written over it.`);
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new GovernanceStoreError('corrupt', `${where} is not a governance entry.`);
  }
  const o = value as Record<string, unknown>;
  if (o.v !== 1) {
    throw new GovernanceStoreError('schema', `${where} declares version ${JSON.stringify(o.v)}, which this build does not write or read.`);
  }
  if (o.entry === 'record') {
    const record = o.record as GovernanceRecord | undefined;
    if (!record || typeof record !== 'object' || typeof record.attemptId !== 'string' || typeof record.interactionId !== 'string') {
      throw new GovernanceStoreError('schema', `${where} is a record entry with no usable record.`);
    }
    return { entry: 'record', v: 1, record };
  }
  if (o.entry === 'verification') {
    if (typeof o.attemptId !== 'string' || typeof o.outcome !== 'string' || typeof o.kind !== 'string' || typeof o.at !== 'string') {
      throw new GovernanceStoreError('schema', `${where} is a verification entry missing one of its four fields.`);
    }
    return { entry: 'verification', v: 1, attemptId: o.attemptId, kind: o.kind as VerificationRule['kind'], outcome: o.outcome as VerificationOutcome, at: o.at };
  }
  throw new GovernanceStoreError('schema', `${where} is neither a record nor a verification entry.`);
}

/**
 * Every entry in the file, in the order it was written.
 *
 * **The delimiter decides, not the position.** A record is complete when its
 * newline is there. So a trailing fragment in a file that does not end with
 * a newline was never fully appended and is ignored; a malformed line that
 * *is* newline-terminated was fully written and is wrong, and fails, whether
 * it sits in the middle or at the end. Revision 1 of the plan tolerated any
 * last line, which would have let a fully written but corrupt final record
 * pass as a torn append.
 *
 * Nothing here writes. A read that cannot complete leaves the bytes exactly
 * as they are and says so.
 */
function readEntries(file: string): { entries: Entry[]; interruptedAppend: boolean } {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { entries: [], interruptedAppend: false };
    }
    throw new GovernanceStoreError('corrupt', `The governance history at ${file} could not be read: ${(err as Error).message}`);
  }
  if (text === '') {
    return { entries: [], interruptedAppend: false };
  }

  const terminated = text.endsWith('\n');
  const parts = text.split('\n');
  // `split` leaves a trailing '' when the text ends with the delimiter. What
  // remains after dropping it is the complete records; anything else in the
  // last slot is an append that did not finish.
  const tail = parts.pop() ?? '';
  const interruptedAppend = !terminated && tail.trim() !== '';

  const entries: Entry[] = [];
  parts.forEach((line, i) => {
    if (line.trim() === '') {
      return;
    }
    entries.push(parseEntry(line, `Line ${i + 1} of ${path.basename(file)}`));
  });
  return { entries, interruptedAppend };
}

/**
 * The history, folded.
 *
 * Throws `GovernanceStoreError` when the file cannot be trusted. **It never
 * reports an unreadable history as an empty one**, which is the failure this
 * whole file is shaped around: an empty audit log and an unreadable audit
 * log look identical to a caller that cannot tell them apart, and only one
 * of them means nothing happened.
 */
export function readGovernance(dir: string): GovernanceHistory {
  const file = governancePath(dir);
  const { entries, interruptedAppend } = readEntries(file);

  const byAttempt = new Map<string, { record: GovernanceRecord; outcomes: RecordedOutcome[] }>();
  const order: string[] = [];
  for (const entry of entries) {
    if (entry.entry === 'record') {
      if (byAttempt.has(entry.record.attemptId)) {
        throw new GovernanceStoreError(
          'duplicate-attempt',
          `The governance history holds two records for attempt ${entry.record.attemptId}. It cannot say which one a verification belongs to, so it will not guess.`,
        );
      }
      byAttempt.set(entry.record.attemptId, { record: entry.record, outcomes: [] });
      order.push(entry.record.attemptId);
      continue;
    }
    const held = byAttempt.get(entry.attemptId);
    if (!held) {
      throw new GovernanceStoreError('corrupt', `The governance history has a verification for attempt ${entry.attemptId} and no record of that attempt.`);
    }
    held.outcomes.push({ kind: entry.kind, outcome: entry.outcome, at: entry.at });
  }

  const records = order
    .map((id) => {
      const held = byAttempt.get(id)!;
      const distinct = new Set(held.outcomes.map((o) => `${o.kind}:${o.outcome}`));
      const status: FoldedRecord['status'] = held.outcomes.length === 0 ? 'unverified' : distinct.size > 1 ? 'conflicted' : 'verified';
      return Object.freeze({ record: held.record, status, outcomes: Object.freeze([...held.outcomes]) }) as FoldedRecord;
    })
    .reverse();

  return Object.freeze({ records: Object.freeze(records), interruptedAppend });
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

function append(file: string, entry: Entry): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // One call, `<json>` and its delimiter together, so a torn write can only
    // ever leave an unterminated fragment and never a terminated lie.
    fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (err) {
    throw new GovernanceStoreError('write', `The governance history could not be written to ${file}: ${(err as Error).message}`);
  }
}

/**
 * Makes one governed attempt durable.
 *
 * Reads first, which is deliberate: it surfaces a corrupt store before
 * adding to it, and it is where a duplicate attempt is caught. Both throw.
 * A caller that cannot tell this failed would present a governed result as
 * recorded when it is not, which is the one outcome the invariant forbids.
 */
export function appendGovernanceRecord(dir: string, record: GovernanceRecord): void {
  const file = governancePath(dir);
  const history = readGovernance(dir);
  if (history.records.some((r) => r.record.attemptId === record.attemptId)) {
    throw new GovernanceStoreError(
      'duplicate-attempt',
      `The governance history already holds attempt ${record.attemptId}. A second record for one attempt would leave it unable to say which one a verification belongs to.`,
    );
  }
  append(file, { entry: 'record', v: 1, record });
}

/** What attaching a verification did. Three outcomes, none of them silent. */
export type AttachResult =
  /** Newly durable. */
  | { readonly kind: 'attached'; readonly outcome: VerificationOutcome }
  /** The identical outcome was already durable. Nothing was written. */
  | { readonly kind: 'already-recorded'; readonly outcome: VerificationOutcome }
  /** A different outcome was already durable. Both are now durable. */
  | { readonly kind: 'conflicted'; readonly existing: readonly RecordedOutcome[]; readonly incoming: VerificationOutcome };

/**
 * Attaches a later deterministic verification to the attempt that produced it.
 *
 * `attemptId` is the key: random, content-free, and written to both this
 * record and the product's own at the same moment. `expectInteractionId` is
 * the consistency check, and a mismatch **writes nothing at all**: if the
 * stored record and the product's record disagree about what was attempted,
 * one of them is wrong and attaching an outcome to either would be recording
 * a fact nobody established.
 *
 * **Idempotence lives here, not in `recordVerification`.** That primitive
 * stays as strict as Phase 5 built it and refuses any second outcome. This
 * function asks the durable question first, so the strict primitive is never
 * handed a question it must refuse for a reason that is not a conflict.
 *
 * **A missing record is sometimes legitimate.** `onCapability` writes the
 * attempt id onto the product's record before the model is asked, and the
 * `model-unavailable` path produces no governance record at all. So a
 * product record can carry an attempt id this store has never seen. That
 * throws `missing-record` and **manufactures nothing**: no placeholder
 * record, no synthesized history.
 */
export function attachVerification(
  dir: string,
  attemptId: AttemptId | string,
  outcome: VerificationOutcome,
  kind: VerificationRule['kind'],
  expectInteractionId: string,
  at: string = new Date().toISOString(),
): AttachResult {
  const history = readGovernance(dir);
  const held = history.records.find((r) => r.record.attemptId === attemptId);
  if (!held) {
    throw new GovernanceStoreError(
      'missing-record',
      `The governance history has no record of attempt ${attemptId}, so there is nothing to attach this outcome to. Nothing was written.`,
    );
  }
  if (held.record.interactionId !== expectInteractionId) {
    throw new GovernanceStoreError(
      'consistency',
      `Attempt ${attemptId} is recorded as ${held.record.interactionId} and the product's record says ${expectInteractionId}. They disagree about what was attempted, so nothing was written.`,
    );
  }

  const identical = held.outcomes.find((o) => o.outcome === outcome && o.kind === kind);
  if (identical && held.outcomes.length === 1) {
    return { kind: 'already-recorded', outcome };
  }
  if (held.outcomes.length > 0) {
    // A different answer to the same question. Both stay: disagreement is
    // evidence about our own verification, and deleting half of it is how a
    // log stops being one. Nothing here chooses a winner.
    append(governancePath(dir), { entry: 'verification', v: 1, attemptId: String(attemptId), kind, outcome, at });
    return { kind: 'conflicted', existing: held.outcomes, incoming: outcome };
  }

  // The strict Phase 5 primitive, used as the guard it is: it refuses a
  // second outcome, and by here we have established there is no first one.
  recordVerification(held.record, outcome, kind);
  append(governancePath(dir), { entry: 'verification', v: 1, attemptId: String(attemptId), kind, outcome, at });
  return { kind: 'attached', outcome };
}
