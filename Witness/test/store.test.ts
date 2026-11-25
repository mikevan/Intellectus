/**
 * The governance store: durable, typed, and never quietly empty.
 *
 * Two properties are worth more than the rest. **An unreadable history is
 * never reported as an empty one**, because to a caller that cannot tell
 * them apart those look identical and only one of them means nothing
 * happened. And **the delimiter decides completeness, not the position**: a
 * newline-terminated line was fully written, so a malformed one is corrupt
 * wherever it sits, while a trailing fragment with no newline was never
 * finished and can be ignored.
 *
 * The privacy tests plant markers rather than assert a field list, so the
 * property keeps being proved as the schema grows. No field is added to the
 * record merely so a test can look for its absence: every marker goes into
 * material that is already an input to `buildRecord`.
 */
import { test, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  GOVERNANCE_FILE,
  GovernanceStoreError,
  NOTHING_TO_VERIFY,
  NO_AUTHORIZATION_NEEDED,
  ONE_CORRECTION,
  appendGovernanceRecord,
  attachVerification,
  buildRecord,
  buildValidationResult,
  clearRegistryForTests,
  governancePath,
  readGovernance,
  registerInteraction,
  runGovernedInteraction,
  unclassifiedGovernancePacket,
} from '../src/index';
import { buildPrompt, reconcileConstraints } from '../src/index';
import type { GovernancePacket, GovernanceRecord, InteractionSpec } from '../src/index';

let dir: string;
beforeEach(() => {
  clearRegistryForTests();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-'));
});

const file = (): string => governancePath(dir);
const lines = (): string[] => fs.readFileSync(file(), 'utf8').split('\n').filter((l) => l !== '');

function spec(): InteractionSpec {
  return registerInteraction({
    id: 'failure.explain',
    tool: 'DeepTest',
    title: 'Explain a run that failed before the tests started.',
    objective: 'explain',
    allowed: { readable: [], proposable: [], mayPropose: false },
    constraints: ['C4'],
    validators: ['V-forbidden-paths', 'V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: NO_AUTHORIZATION_NEEDED,
    verification: NOTHING_TO_VERIFY,
  } as unknown as InteractionSpec);
}

function packetWith(evidenceText: string): GovernancePacket {
  // A real condition packet, so the constraint set is real too.
  return unclassifiedGovernancePacket({ runner: 'vitest', evidence: [evidenceText] });
}

function record(over: { attemptId?: string; evidence?: string; response?: string; changeSet?: string; by?: string } = {}): GovernanceRecord {
  const s = spec();
  const packet = packetWith(over.evidence ?? 'exit code 1');
  return buildRecord({
    spec: s,
    packet,
    prompt: buildPrompt(packet, s, reconcileConstraints(s, packet)),
    attemptId: (over.attemptId ?? 'a-1') as never,
    rawResponse: over.response ?? '{"kind":"explain"}',
    validation: buildValidationResult(s.id, [{ id: 'V-response-shape', verdict: 'pass', because: 'fine' }]),
    corrections: 0,
    model: { id: 'the-model-the-user-picked', vendor: 'copilot', family: 'gpt' },
    authorization: { granted: true, at: '2026-09-24T00:00:00.000Z', by: over.by ?? 'mvangeertruy', briefDigest: 'abc123' },
    ...(over.changeSet !== undefined ? { changeSetText: over.changeSet } : {}),
  });
}

// ---------------------------------------------------------------------------
// Round trip
// ---------------------------------------------------------------------------

test('a record is persisted and reloaded field for field', () => {
  const r = record();
  appendGovernanceRecord(dir, r);
  const history = readGovernance(dir);
  assert.equal(history.records.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(history.records[0].record)), JSON.parse(JSON.stringify(r)));
  assert.equal(history.records[0].status, 'unverified');
  assert.equal(history.interruptedAppend, false);
});

test('authorization.by survives persistence exactly as the contract defines it', () => {
  appendGovernanceRecord(dir, record({ by: 'mvangeertruy' }));
  assert.equal(readGovernance(dir).records[0].record.authorization?.by, 'mvangeertruy');
  assert.match(fs.readFileSync(file(), 'utf8'), /"by":"mvangeertruy"/, 'written as itself, not hashed and not omitted');
});

test('an empty directory is an empty history, which is not the same as an unreadable one', () => {
  const history = readGovernance(dir);
  assert.deepEqual([...history.records], []);
  assert.equal(fs.existsSync(file()), false, 'and reading did not create anything');
});

test('records come back newest first', () => {
  appendGovernanceRecord(dir, record({ attemptId: 'a-1' }));
  appendGovernanceRecord(dir, record({ attemptId: 'a-2' }));
  assert.deepEqual(readGovernance(dir).records.map((r) => r.record.attemptId), ['a-2', 'a-1']);
});

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

test('no marker material survives serialization', () => {
  const markers = {
    evidence: 'ZZMARKER-EVIDENCE-ZZ',
    response: 'ZZMARKER-RESPONSE-ZZ',
    changeSet: 'ZZMARKER-CHANGESET-ZZ',
  };
  appendGovernanceRecord(dir, record({ evidence: markers.evidence, response: markers.response, changeSet: markers.changeSet }));
  const bytes = fs.readFileSync(file(), 'utf8');
  for (const [what, marker] of Object.entries(markers)) {
    assert.equal(bytes.includes(marker), false, `${what} reached the disk`);
  }
});

test('the prompt, the verification target and the capability value have nowhere to be', () => {
  appendGovernanceRecord(dir, record());
  const bytes = fs.readFileSync(file(), 'utf8');
  // The prompt is hashed by the record contract, so its text cannot be here.
  assert.equal(bytes.includes('What the toolkit established'), false, 'no prompt body');
  assert.equal(bytes.includes('Runner or framework'), false);
  // A target would carry a path and a line. The record has no field for one.
  assert.doesNotMatch(bytes, /src\/[a-z]+\.ts/, 'no source path');
  assert.doesNotMatch(bytes, /"line"\s*:/, 'no line number');
  assert.doesNotMatch(bytes, /"capability"|"secret"|"token"/, 'no capability value');
});

// ---------------------------------------------------------------------------
// The four ending and corruption cases
// ---------------------------------------------------------------------------

test('1. a valid, newline-terminated final record succeeds, with no special treatment for being last', () => {
  appendGovernanceRecord(dir, record({ attemptId: 'a-1' }));
  appendGovernanceRecord(dir, record({ attemptId: 'a-2' }));
  assert.ok(fs.readFileSync(file(), 'utf8').endsWith('\n'));
  const history = readGovernance(dir);
  assert.equal(history.records.length, 2);
  assert.equal(history.interruptedAppend, false);
});

test('2. an unparsable fragment with no delimiter is an interrupted append and is ignored', () => {
  appendGovernanceRecord(dir, record({ attemptId: 'a-1' }));
  fs.appendFileSync(file(), '{"entry":"record","v":1,"rec', 'utf8');
  const history = readGovernance(dir);
  assert.equal(history.records.length, 1, 'the complete record survives');
  assert.equal(history.interruptedAppend, true, 'and the read says the file ends mid-write');
});

test('3. a malformed final record that IS newline-terminated is corruption', () => {
  appendGovernanceRecord(dir, record({ attemptId: 'a-1' }));
  fs.appendFileSync(file(), '{"entry":"record","v":1,"rec\n', 'utf8');
  assert.throws(() => readGovernance(dir), (err: unknown) => err instanceof GovernanceStoreError && err.reason === 'corrupt');
});

test('4. a malformed record in the middle is corruption', () => {
  appendGovernanceRecord(dir, record({ attemptId: 'a-1' }));
  const good = fs.readFileSync(file(), 'utf8');
  fs.writeFileSync(file(), `${good}not json at all\n${good}`, 'utf8');
  assert.throws(() => readGovernance(dir), (err: unknown) => err instanceof GovernanceStoreError && err.reason === 'corrupt');
});

test('no corruption case ever reads as an empty history, and none rewrites the file', () => {
  for (const bad of ['not json\n', '{"entry":"record","v":2,"record":{}}\n', '{"entry":"mystery","v":1}\n', '[]\n']) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-bad-'));
    fs.writeFileSync(path.join(d, GOVERNANCE_FILE), bad, 'utf8');
    assert.throws(() => readGovernance(d), GovernanceStoreError, bad);
    assert.equal(fs.readFileSync(path.join(d, GOVERNANCE_FILE), 'utf8'), bad, 'the bytes are untouched');
  }
});

test('a version this build does not write is a schema failure, not a skipped line', () => {
  fs.writeFileSync(file(), '{"entry":"record","v":2,"record":{"attemptId":"a","interactionId":"x"}}\n', 'utf8');
  assert.throws(() => readGovernance(dir), (err: unknown) => err instanceof GovernanceStoreError && err.reason === 'schema');
});

// ---------------------------------------------------------------------------
// Duplicates
// ---------------------------------------------------------------------------

test('a second record for one attempt is refused, never merged', () => {
  appendGovernanceRecord(dir, record({ attemptId: 'a-1' }));
  assert.throws(
    () => appendGovernanceRecord(dir, record({ attemptId: 'a-1' })),
    (err: unknown) => err instanceof GovernanceStoreError && err.reason === 'duplicate-attempt',
  );
  assert.equal(lines().length, 1, 'and nothing was appended');
});

test('a file that already holds two records for one attempt fails to fold', () => {
  const r = record({ attemptId: 'a-1' });
  const line = `${JSON.stringify({ entry: 'record', v: 1, record: r })}\n`;
  fs.writeFileSync(file(), line + line, 'utf8');
  assert.throws(() => readGovernance(dir), (err: unknown) => err instanceof GovernanceStoreError && err.reason === 'duplicate-attempt');
});

// ---------------------------------------------------------------------------
// attachVerification
// ---------------------------------------------------------------------------

test('a verification joins the attempt that produced it', () => {
  appendGovernanceRecord(dir, record({ attemptId: 'a-1' }));
  appendGovernanceRecord(dir, record({ attemptId: 'a-2' }));
  const result = attachVerification(dir, 'a-1', 'held', 're-measure', 'failure.explain');
  assert.equal(result.kind, 'attached');

  const history = readGovernance(dir);
  const one = history.records.find((r) => r.record.attemptId === 'a-1')!;
  const two = history.records.find((r) => r.record.attemptId === 'a-2')!;
  assert.equal(one.status, 'verified');
  assert.equal(one.outcomes[0].outcome, 'held');
  assert.equal(two.status, 'unverified', 'one attempt cannot update another');
});

test('the identical verification writes nothing', () => {
  appendGovernanceRecord(dir, record({ attemptId: 'a-1' }));
  attachVerification(dir, 'a-1', 'held', 're-measure', 'failure.explain');
  const before = fs.readFileSync(file(), 'utf8');

  const again = attachVerification(dir, 'a-1', 'held', 're-measure', 'failure.explain');
  assert.equal(again.kind, 'already-recorded');
  assert.equal(fs.readFileSync(file(), 'utf8'), before, 'byte for byte');
});

test('a conflicting verification preserves both and folds to conflicted', () => {
  appendGovernanceRecord(dir, record({ attemptId: 'a-1' }));
  attachVerification(dir, 'a-1', 'held', 're-measure', 'failure.explain');
  const result = attachVerification(dir, 'a-1', 'changed', 're-measure', 'failure.explain');

  assert.equal(result.kind, 'conflicted');
  const folded = readGovernance(dir).records[0];
  assert.equal(folded.status, 'conflicted');
  assert.deepEqual(folded.outcomes.map((o) => o.outcome), ['held', 'changed'], 'both, in the order observed');
});

test('nothing chooses a winner between conflicting outcomes', () => {
  appendGovernanceRecord(dir, record({ attemptId: 'a-1' }));
  attachVerification(dir, 'a-1', 'held', 're-measure', 'failure.explain');
  attachVerification(dir, 'a-1', 'changed', 're-measure', 'failure.explain');
  const folded = readGovernance(dir).records[0];
  assert.equal(folded.outcomes.length, 2);
  assert.notEqual(folded.status, 'verified', 'conflicted is its own state, not a verified one');
});

test('an interactionId mismatch writes nothing at all', () => {
  appendGovernanceRecord(dir, record({ attemptId: 'a-1' }));
  const before = fs.readFileSync(file(), 'utf8');
  assert.throws(
    () => attachVerification(dir, 'a-1', 'held', 're-measure', 'coverage.propose-test'),
    (err: unknown) => err instanceof GovernanceStoreError && err.reason === 'consistency',
  );
  assert.equal(fs.readFileSync(file(), 'utf8'), before, 'byte for byte');
  assert.equal(readGovernance(dir).records[0].status, 'unverified');
});

test('a missing record manufactures nothing, which is the model-unavailable case', () => {
  appendGovernanceRecord(dir, record({ attemptId: 'a-1' }));
  const before = fs.readFileSync(file(), 'utf8');
  assert.throws(
    () => attachVerification(dir, 'orphan-attempt', 'held', 're-measure', 'failure.explain'),
    (err: unknown) => err instanceof GovernanceStoreError && err.reason === 'missing-record',
  );
  assert.equal(fs.readFileSync(file(), 'utf8'), before, 'no placeholder record, no synthesized history');
});

test('attaching to an unreadable store fails rather than starting a fresh one', () => {
  fs.writeFileSync(file(), 'not json\n', 'utf8');
  assert.throws(() => attachVerification(dir, 'a-1', 'held', 're-measure', 'failure.explain'), GovernanceStoreError);
  assert.equal(fs.readFileSync(file(), 'utf8'), 'not json\n');
});

// ---------------------------------------------------------------------------
// Not best-effort
// ---------------------------------------------------------------------------

test('a write failure is surfaced, never converted into success or an empty history', () => {
  // A directory where the file should be: the append cannot succeed.
  fs.mkdirSync(file(), { recursive: true });
  assert.throws(
    () => appendGovernanceRecord(dir, record()),
    (err: unknown) => err instanceof GovernanceStoreError && (err.reason === 'write' || err.reason === 'corrupt'),
  );
});

test('the store swallows nothing: every failure is typed', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'governance', 'store.ts'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /catch\s*\{\s*\}/, 'no empty catch');
  assert.doesNotMatch(code, /catch[^)]*\)\s*\{\s*return (undefined|\[\]|null)/, 'no catch that answers with nothing');
  for (const reason of ['write', 'duplicate-attempt', 'corrupt', 'schema', 'consistency', 'missing-record']) {
    assert.ok(code.includes(`'${reason}'`), `${reason} is a reason the store can report`);
  }
});

test('Witness owns the format and infers no directory', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'governance', 'store.ts'), 'utf8');
  assert.doesNotMatch(code, /from 'vscode'/, 'rule 45');
  assert.doesNotMatch(code, /\.deeptest|\.untangleit|\.keepsafe/, 'no product-specific knowledge, and nothing about keepsafe');
  assert.doesNotMatch(code, /sqlite|better-sqlite|lowdb|level\(/i, 'no database');
  assert.match(code, /export function governancePath\(dir: string\)/, 'the directory is injected');
});

// ---------------------------------------------------------------------------
// The durability ordering, at the seam where it is held
// ---------------------------------------------------------------------------

test('26. an initial record that cannot be persisted stops the result being shown, and asks no model again', async () => {
  const s = spec();
  const packet = packetWith('exit code 1');
  const shown: string[] = [];
  let asked = 0;
  const outcome = await runGovernedInteraction(s, packet, {
    model: {
      id: 'the-model-the-user-picked',
      vendor: 'copilot',
      send: async () => {
        asked += 1;
        return JSON.stringify({ kind: 'explain', whatIsWrong: 'x', whyItHappened: 'y', howToFix: null, whatNotToChange: [], citedEvidence: [0] });
      },
    },
    surface: { progress: () => undefined, markdown: (t) => shown.push(t), anchor: () => undefined, button: () => undefined, log: () => undefined },
    persist: () => {
      throw new GovernanceStoreError('write', 'the disk said no');
    },
  });

  assert.equal(outcome.kind, 'not-recorded', 'not presented as a successfully governed result');
  assert.equal(outcome.kind === 'not-recorded' ? outcome.why : '', 'the disk said no', 'the storage error is preserved');
  assert.deepEqual(shown, [], 'nothing the model produced reached the surface');
  assert.equal(asked, 1, 'and the model was not asked again');
});

test('29. the record is durable before anything is rendered, in that order', async () => {
  const s = spec();
  const packet = packetWith('exit code 1');
  const order: string[] = [];
  const outcome = await runGovernedInteraction(s, packet, {
    model: {
      id: 'm',
      send: async () => JSON.stringify({ kind: 'explain', whatIsWrong: 'x', whyItHappened: 'y', howToFix: null, whatNotToChange: [], citedEvidence: [0] }),
    },
    surface: { progress: () => undefined, markdown: () => order.push('rendered'), anchor: () => undefined, button: () => undefined, log: () => undefined },
    persist: (r) => {
      order.push('persisted');
      appendGovernanceRecord(dir, r);
    },
  });

  assert.equal(outcome.kind, 'explained');
  assert.equal(order[0], 'persisted', 'persistence comes first');
  assert.ok(order.includes('rendered'));
  assert.equal(readGovernance(dir).records.length, 1, 'and it really is durable');
});

test('an abandoned attempt is recorded too, because it is a governed act', async () => {
  const s = spec();
  const packet = packetWith('exit code 1');
  const outcome = await runGovernedInteraction(s, packet, {
    model: { id: 'm', send: async () => 'not json at all' },
    surface: { progress: () => undefined, markdown: () => undefined, anchor: () => undefined, button: () => undefined, log: () => undefined },
    persist: (r) => appendGovernanceRecord(dir, r),
  });
  assert.equal(outcome.kind, 'abandoned');
  assert.equal(readGovernance(dir).records.length, 1);
  assert.equal(readGovernance(dir).records[0].record.accepted, false);
});
