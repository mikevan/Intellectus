/**
 * Drives the real extension in a real editor against the Vitest fixture:
 * measure, find the tangled methods, authorize an untangle attempt on the
 * worst (the harness answers the authorization modal), prove the governed
 * hand-off pre-filled the chat and sent nothing, then "Measure again"
 * against an unchanged file and check that UntangleIt reports "not done"
 * rather than taking anyone's word for it.
 *
 * It runs in two launches (see runTests.ts). The governed launch has the
 * stub model loaded, so Phase 8's gate opens; it walks the whole loop and
 * finally checks that nothing was ever sent to the stub. The no-model
 * launch has no model at all; the measurement must still work, and
 * "Untangle it" must refuse before it writes, asks, or pre-fills anything.
 *
 * Membership is decided by tangle (MBCC), so every tangled method is
 * asserted by name, MBCC, and ways through. The fixture has two over a limit
 * of 5: describeNumber (MBCC 8) on purpose, and classify (MBCC 6) since
 * complexity 0.1.1 charged the k-th branch of an if / else-if chain k plus
 * nesting. Before that rule classify scored 5 and sat at the limit.
 */
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { UntangleItApi } from '../../src/extension';

async function waitFor(check: () => boolean, ms: number, what: string): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) {
      throw new Error(`Timed out waiting for ${what}`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

const STUB_ID = 'prs.untangleit-test-model';

export async function run(): Promise<void> {
  const mode = process.env.UNTANGLEIT_SUITE_MODE;
  const stub = vscode.extensions.getExtension(STUB_ID);
  // The launch's claim is checked against what is actually loaded, so a
  // harness mistake cannot make one launch quietly test the other's case.
  if (mode === 'governed') {
    assert.ok(stub, 'the governed launch must load the stub model');
    await runGoverned();
    const calls = (stub.exports as { calls(): { information: number; response: number } }).calls();
    assert.equal(calls.response, 0, 'nothing in the suite may send a request to a model');
    console.log('UntangleIt integration suite passed (governed launch)');
  } else if (mode === 'no-model') {
    assert.equal(stub, undefined, 'the no-model launch must not load the stub model');
    await runNoModel();
    console.log('UntangleIt integration suite passed (no-model launch)');
  } else {
    throw new Error(`UNTANGLEIT_SUITE_MODE is ${JSON.stringify(mode)}. runTests.ts sets it to governed or no-model.`);
  }
}

/** Activates UntangleIt on the fixture with a clean run store and the suite's settings. */
async function setUp(): Promise<{ api: UntangleItApi; folder: vscode.WorkspaceFolder }> {
  const ext = vscode.extensions.getExtension('prs.untangleit');
  assert.ok(ext, 'extension not found');
  const api = (await ext.activate()) as UntangleItApi;
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert.ok(folder, 'no workspace folder');
  fs.rmSync(path.join(folder.uri.fsPath, '.untangleit'), { recursive: true, force: true });

  const cfg = vscode.workspace.getConfiguration('untangleit', folder);
  await cfg.update('language', 'typescript', vscode.ConfigurationTarget.Workspace);
  await cfg.update('testsPath', 'test', vscode.ConfigurationTarget.Workspace);
  await cfg.update('sourceRoot', 'src', vscode.ConfigurationTarget.Workspace);
  await cfg.update('limit', 5, vscode.ConfigurationTarget.Workspace);
  await cfg.update('keepSafe.offerCheckpoint', false, vscode.ConfigurationTarget.Workspace);
  return { api, folder };
}

/** Measures the fixture and checks the tangled set, the same in both launches. */
async function measureFixture(api: UntangleItApi) {
  await api.run();
  await waitFor(() => api.state.phase === 'results' || api.state.phase === 'error', 60_000, 'measure to finish');
  assert.equal(api.state.phase, 'results', `measure ended in phase ${api.state.phase}: ${api.state.message}`);
  const tangled = api.state.measure?.tangled ?? [];
  assert.deepEqual(
    tangled.map((t) => [t.name, t.mbcc, t.complexity]),
    [
      ['describeNumber', 8, 8],
      ['classify', 6, 5],
    ],
  );
  return tangled;
}

/**
 * No model: the measurement is whole (rule 40) and "Untangle it" refuses
 * before the checkpoint offer, the packet, the authorization question, any
 * run write, and the pre-fill (Phase 8).
 */
async function runNoModel(): Promise<void> {
  const { api, folder } = await setUp();
  const tangled = await measureFixture(api);
  // The command awaits untangle(), so when it returns the gate has decided.
  await vscode.commands.executeCommand('untangleit.method', { path: 'src/calc.ts', startLine: tangled[0].startLine });
  assert.equal(api.state.runs.runs.length, 0, 'no run record is written without a model');
  assert.equal(fs.existsSync(path.join(folder.uri.fsPath, '.untangleit', 'runs.json')), false, 'and nothing reaches disk');
  assert.equal(api.waitingAttempt(), undefined, 'nothing is authorized or pre-filled');
}

async function runGoverned(): Promise<void> {
  const { api, folder } = await setUp();
  const tangled = await measureFixture(api);

  // Authorize it. The harness sets UNTANGLEIT_TEST_HOST=1, so the modal is answered yes.
  await vscode.commands.executeCommand('untangleit.method', { path: 'src/calc.ts', startLine: tangled[0].startLine });
  await waitFor(() => api.state.runs.runs.length === 1, 10_000, 'run record');
  const record = api.state.runs.runs[0];
  assert.equal(record.status, 'sent');
  // "before" is the tangle the run starts from, which is MBCC.
  assert.equal(record.before, tangled[0].mbcc);
  assert.equal(record.before, 8);

  // The governed hand-off. The chat input holds the participant's invocation,
  // the authorized attempt belongs to this run, and it is still waiting: the
  // participant takes it when the person presses send, so a waiting attempt
  // proves nothing was sent.
  const waiting = api.waitingAttempt();
  assert.ok(waiting, 'an authorized attempt is waiting for the person to press send');
  assert.equal(waiting.interactionId, 'method.propose-untangle');
  assert.equal(waiting.runId, record.id);
  assert.equal(waiting.query, '@untangleit Break describeNumber() into smaller pieces without changing what it does.');
  assert.deepEqual(api.waitingAttempt(), waiting, 'reading the waiting attempt spends nothing');
  const onDisk = JSON.parse(fs.readFileSync(path.join(folder.uri.fsPath, '.untangleit', 'runs.json'), 'utf8')) as { runs: Array<{ status: string }> };
  assert.equal(onDisk.runs[0].status, 'sent');

  // Measure again without any change: the tests pass, the method is still over, and the
  // loop must say so (it is round 1 of 3, so it offers another round; nobody answers).
  void vscode.commands.executeCommand('untangleit.measureAgain', { path: 'src/calc.ts', name: 'describeNumber' });
  await waitFor(() => api.state.runs.runs[0]?.status === 'still-over', 120_000, 'measure again');
  const after = api.state.runs.runs[0];
  assert.equal(after.tests?.failed, 0);
  assert.ok((after.tests?.passed ?? 0) >= 4);
  assert.match(after.outcome ?? '', /^Not done\. 1 piece: describeNumber\(\) 8\. 1 piece is still over your limit of 5\. All \d+ tests pass\. Your call\.$/);

  // The silent command for sibling tools.
  const envelope = (await vscode.commands.executeCommand('untangleit.api.measure', { path: 'src/calc.ts' })) as { ok: boolean; protocol: number; tool: string; result: { methods: Array<{ name: string; startLine: number; waysThrough: number; mbcc: number; over: number }> } };
  assert.equal(envelope.ok, true);
  assert.equal(envelope.protocol, 1);
  assert.equal(envelope.tool, 'untangleit');
  assert.deepEqual(
    envelope.result.methods
      .filter((m) => m.over > 0)
      .sort((a, b) => a.startLine - b.startLine)
      .map((m) => [m.name, m.waysThrough, m.mbcc, m.over]),
    [
      ['classify', 5, 6, 1],
      ['describeNumber', 8, 8, 3],
    ],
  );
  const bad = (await vscode.commands.executeCommand('untangleit.api.measure', {})) as { ok: boolean; error: string };
  assert.equal(bad.ok, false);
  assert.match(bad.error, /\.$/);

}
