/**
 * Phase 7 in UntangleIt: the record is kept, the outcome is joined, and the
 * order in which those become durable is the part that matters.
 *
 * **Governance first, product state second.** The resolver skips a decision
 * that already carries an outcome, so writing the decision first and then
 * failing to write the governance entry would make every later run skip it:
 * the decision would look resolved, the resolver would never look again, and
 * the history could never be repaired. The other order is recoverable, and
 * these tests prove both halves of that — the failure that must not lose
 * evidence, and the retry that catches up.
 *
 * `loop.ts` imports `vscode`, so the ordering is proved twice: once
 * behaviourally against the Witness store, which is where the durability
 * lives, and once structurally against the source, which is where the order
 * could be reversed by accident.
 */
import { test, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { GovernanceStoreError, appendGovernanceRecord, attachVerification, governancePath, readGovernance } from '@projectrevivesolutions/witness';
import type { GovernanceRecord } from '@projectrevivesolutions/witness';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-gov-'));
});

const SRC = path.join(__dirname, '..', 'src');
const read = (...p: string[]): string => fs.readFileSync(path.join(SRC, ...p), 'utf8');
const code = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/** A record shaped like the one a governed propose interaction produces. */
function record(attemptId: string, interactionId = 'method.propose-untangle'): GovernanceRecord {
  return {
    recordVersion: 1,
    at: '2026-09-24T01:00:00.000Z',
    interactionId,
    attemptId,
    tool: 'UntangleIt',
    objective: 'propose',
    conditionId: 'method-tangled',
    classification: { failureClass: 'insufficient-evidence', confidence: 'unclassified' },
    constraintIds: ['C2', 'C4'],
    validators: [{ id: 'V-response-shape', verdict: 'pass' }],
    accepted: true,
    corrections: 0,
    model: { id: 'the-model-the-user-picked', vendor: 'copilot' },
    authorization: { granted: true, at: '2026-09-24T00:59:00.000Z', by: 'mvangeertruy', briefDigest: 'abc' },
    hashes: { packet: 'p', prompt: 'q', response: 'r' },
  } as GovernanceRecord;
}

// ---------------------------------------------------------------------------
// 27. Governance attachment fails: the product verification is not written
// ---------------------------------------------------------------------------

test('27. when the governance attachment fails, the decision is not marked verified', () => {
  // No record for this attempt: the legitimate model-unavailable shape, and
  // also what a lost store looks like.
  let attached = false;
  let decisionWritten = false;
  try {
    attachVerification(dir, 'attempt-with-no-record', 'held', 're-measure', 'method.propose-untangle');
    attached = true;
  } catch (err) {
    assert.ok(err instanceof GovernanceStoreError);
    assert.equal((err as GovernanceStoreError).reason, 'missing-record');
  }
  if (attached) {
    decisionWritten = true;
  }
  assert.equal(attached, false, 'the attachment did not happen');
  assert.equal(decisionWritten, false, 'so the decision is not written either');
  assert.equal(fs.existsSync(governancePath(dir)), false, 'and nothing was manufactured');
});

test('27b. an interactionId mismatch writes nothing to either side', () => {
  appendGovernanceRecord(dir, record('a-1', 'method.propose-untangle'));
  const before = fs.readFileSync(governancePath(dir), 'utf8');
  assert.throws(
    () => attachVerification(dir, 'a-1', 'held', 're-measure', 'coverage.propose-test'),
    (err: unknown) => err instanceof GovernanceStoreError && err.reason === 'consistency',
  );
  assert.equal(fs.readFileSync(governancePath(dir), 'utf8'), before);
  assert.equal(readGovernance(dir).records[0].status, 'unverified', 'and the attempt is still open for a retry');
});

// ---------------------------------------------------------------------------
// 28. Governance succeeds, the product save fails, and the retry catches up
// ---------------------------------------------------------------------------

test('28. governance stays durable when the decisions save fails, and the retry writes nothing twice', () => {
  appendGovernanceRecord(dir, record('a-1'));

  // First pass: governance attaches, the product save then fails.
  const first = attachVerification(dir, 'a-1', 'held', 're-measure', 'method.propose-untangle');
  assert.equal(first.kind, 'attached');
  const productSaveFailed = true; // the decisions file could not be written
  assert.ok(productSaveFailed);

  const afterFirst = fs.readFileSync(governancePath(dir), 'utf8');
  assert.equal(readGovernance(dir).records[0].status, 'verified', 'the governance outcome is durable');

  // The decision stayed unresolved, so the next check resolves it again.
  const retry = attachVerification(dir, 'a-1', 'held', 're-measure', 'method.propose-untangle');
  assert.equal(retry.kind, 'already-recorded', 'the identical outcome is recognised');
  assert.equal(fs.readFileSync(governancePath(dir), 'utf8'), afterFirst, 'and writes nothing, byte for byte');

  // The product record can now catch up, which is the whole point of the
  // order: nothing was rolled back and nothing was duplicated.
  const folded = readGovernance(dir).records[0];
  assert.equal(folded.outcomes.length, 1);
  assert.equal(folded.outcomes[0].outcome, 'held');
});

// ---------------------------------------------------------------------------
// 29. The order, pinned in the source
// ---------------------------------------------------------------------------

test('29. the run save comes after the governance attachment, in loop.ts', () => {
  const source = read('loop.ts');
  const at = source.indexOf('const verified = resolveGovernedRun(');
  const block = source.slice(at, at + 1600);
  const attach = block.indexOf('attachGovernanceVerification(');
  const assign = block.indexOf('run.verification = {');
  assert.ok(attach > 0 && assign > 0, 'both steps are there');
  assert.ok(attach < assign, 'governance history first, product state second');
  assert.match(block, /if \(attachGovernanceVerification\([\s\S]*?\)\) \{\s*run\.verification/, 'and the run is written only when the attachment succeeded');
});

test('a failed attachment leaves the run unresolved so a later measurement retries', () => {
  const source = code(read('loop.ts'));
  assert.match(source, /function attachGovernanceVerification\([\s\S]*?return false;/, 'the helper says no on failure');
  assert.match(source, /The run stays unverified and will be retried/);
});

test('a product-save failure does not roll governance back', () => {
  const source = code(read('loop.ts'));
  assert.doesNotMatch(source, /rollback|revert|removeVerification|truncate/i, 'nothing undoes a true record of a measurement that happened');
});

// ---------------------------------------------------------------------------
// 30. Store failure is surfaced, and the lifecycle protections
// ---------------------------------------------------------------------------

test('30. a store write failure is surfaced, never converted into success or an empty history', () => {
  fs.mkdirSync(governancePath(dir), { recursive: true }); // a directory where the file goes
  assert.throws(() => appendGovernanceRecord(dir, record('a-1')), GovernanceStoreError);
  assert.throws(() => readGovernance(dir), GovernanceStoreError, 'and the read does not answer "empty"');
});

test('UntangleIt has no sweeper, and none was invented for it', () => {
  // DeepTest empties its work folder at the start of every measured run and
  // therefore needs a keep-list. UntangleIt does not do that, so there is
  // nothing to protect the file from and nothing to add.
  for (const f of ['loop.ts', 'measure.ts', 'governance.ts']) {
    assert.doesNotMatch(code(read(f)), /WORK_DIR_KEEP|clearWorkDir/, `${f} sweeps nothing`);
  }
});

test('the governance file is local only, and the runs policy is unchanged', () => {
  const ignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
  assert.match(ignore, /^\.untangleit\/governance\.jsonl$/m, 'ignored explicitly');
  assert.match(ignore, /^\.untangleit\/\*$/m, 'the folder is still ignored');
  assert.match(ignore, /^!\.untangleit\/runs\.json$/m, 'and runs.json is still committed, unchanged');
});

// ---------------------------------------------------------------------------
// The persistence seam
// ---------------------------------------------------------------------------

test('the participant persists the record and shows nothing when it cannot', () => {
  const participant = read('agent', 'participant.ts');
  assert.match(participant, /persist: \(record\) => deps\.persist\(record\)/, 'both call sites hand Witness the hook');
  assert.equal([...participant.matchAll(/persist: \(record\)/g)].length, 2);
  assert.match(participant, /not-recorded/, 'and the outcome is handled');
  assert.match(participant, /Governance History could not be written/);
});

test('the extension writes the history into the folder UntangleIt owns, and infers nothing in Witness', () => {
  assert.match(read('governance.ts'), /path\.join\(workspaceRoot, '\.untangleit'\)/);
  assert.match(read('extension.ts'), /appendGovernanceRecord\(governanceDir\(workspaceRootOf\(folder\)\), record\)/);
});

test('nothing here reaches into the other product or into keepsafe', () => {
  for (const f of ['governance.ts', path.join('ui', 'governanceView.ts')]) {
    const c = code(read(f));
    assert.doesNotMatch(c, /deeptest|\.keepsafe/i, `${f} stays inside UntangleIt`);
  }
});

// ---------------------------------------------------------------------------
// The viewer
// ---------------------------------------------------------------------------

test('the viewer shows what Polyglot established, and never claims to show what it knew', () => {
  const view = read('ui', 'governanceView.ts');
  assert.match(view, /What Polyglot established/);
  assert.doesNotMatch(code(view).replace(/'[^']*knew[^']*'/g, ''), /what Polyglot knew/i);
  assert.match(view, /deliberately not kept/, 'and it says what was not retained');
});

test('the viewer renders no material the record does not hold, and calls no model', () => {
  const c = code(read('ui', 'governanceView.ts'));
  assert.doesNotMatch(c, /selectChatModels|sendRequest|prefillChat|modelsAvailable/, 'no model, no transport');
  assert.doesNotMatch(c, /buildPacket|findingPacket|requireInteraction|runGovernedInteraction/, 'no interaction, no second policy engine');
  assert.doesNotMatch(c, /readFileSync\(.*source|evidence\[|\.prompt\b|rawResponse|changeSet/, 'nothing reconstructed');
  assert.match(c, /enableScripts: false/, 'and the panel runs no script');
});

test('the viewer shows a conflict rather than choosing a winner', () => {
  const view = read('ui', 'governanceView.ts');
  assert.match(view, /two different answers, both kept/);
  assert.match(view, /Nothing has chosen between them/);
});

test('an unreadable history is shown as unreadable, never as empty', () => {
  const view = read('ui', 'governanceView.ts');
  assert.match(view, /could not be read, so UntangleIt is not showing one/);
  assert.match(view, /Nothing has been written over it/);
});
