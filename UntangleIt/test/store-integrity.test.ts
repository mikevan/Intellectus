/**
 * Step 0: a corrupt runs file is never turned into an empty one.
 *
 * The same defect DeepTest had, in UntangleIt's own store: `loadRuns` caught
 * every read and parse failure, logged "Starting a fresh record", and
 * returned an empty file. The next ordinary `saveRuns` then overwrote the
 * unparsed one, and every untangling the person had in flight was gone.
 *
 * **Three states, and they are three.** Absent is a legitimate empty store.
 * Loaded is the store. Unreadable is neither, and it has its own type so
 * that nobody can reach for the empty one by accident.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CorruptStoreError, emptyRunFile, readRunsAt, runFilePath, writeRunsAt } from '../src/runs';

function workspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ui-store-'));
}

function put(root: string, text: string): string {
  const file = runFilePath(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
  return file;
}

test('no file at all is a legitimate empty store', () => {
  assert.equal(readRunsAt(runFilePath(workspace())).kind, 'absent');
});

test('a file that parses is the store', () => {
  const read = readRunsAt(put(workspace(), JSON.stringify({ version: 1, runs: [{ id: 'r1' }] })));
  assert.equal(read.kind, 'loaded');
  assert.equal(read.kind === 'loaded' ? read.file.runs.length : -1, 1);
});

test('a file that does not parse is its own state, not an empty store', () => {
  const read = readRunsAt(put(workspace(), '{ not json'));
  assert.equal(read.kind, 'unreadable');
  assert.notEqual(read.kind, 'absent');
  assert.ok(read.kind === 'unreadable' && read.why.length > 0);
});

test('a file with the wrong shape is unreadable, not empty', () => {
  for (const bad of ['{"version":2,"runs":[]}', '{"version":1}', '[]', 'null']) {
    assert.equal(readRunsAt(put(workspace(), bad)).kind, 'unreadable', bad);
  }
});

test('an ordinary save refuses to overwrite a file it could not read, and the bytes survive', () => {
  const root = workspace();
  const original = '{ this is not json, and it is the person`s untanglings';
  const file = put(root, original);

  assert.throws(() => writeRunsAt(file, emptyRunFile()), CorruptStoreError);
  assert.equal(fs.readFileSync(file, 'utf8'), original, 'byte for byte');
});

test('the refusal names the file and says the work is still in it', () => {
  const file = put(workspace(), 'not json');
  try {
    writeRunsAt(file, emptyRunFile());
    assert.fail('it should have refused');
  } catch (err) {
    assert.ok(err instanceof CorruptStoreError);
    assert.match((err as Error).message, /runs\.json/);
    assert.match((err as Error).message, /could not be read/i);
  }
});

test('saving over a readable file still works, and a first write still works', () => {
  const root = workspace();
  const file = put(root, JSON.stringify({ version: 1, runs: [] }));
  writeRunsAt(file, { version: 1, runs: [{ id: 'r1' } as never] });
  assert.equal(readRunsAt(file).kind, 'loaded');

  const fresh = runFilePath(workspace());
  writeRunsAt(fresh, emptyRunFile());
  assert.equal(readRunsAt(fresh).kind, 'loaded', 'absent is not corrupt');
});

test('no compatibility machinery for a version that never existed', () => {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'runs.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /migrat|upgradeFrom|version === 0|version === 2/i);
});
