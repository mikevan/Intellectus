/**
 * Step 0: a corrupt decisions file is never turned into an empty one.
 *
 * The defect this pins: `loadDecisions` caught every read and parse failure,
 * logged that the file was "left untouched", and returned an **empty**
 * store. The next ordinary `saveDecisions` then overwrote the unparsed file,
 * so the message was true for about a second and the person's decisions were
 * gone. Phase 7 adds a durable audit store beside this one, and a new
 * crash-safe store must not sit next to a durable product store that
 * destroys unreadable state on the next save.
 *
 * **Three states, and they are three, not two.** A file that is not there is
 * a legitimate empty store. A file that is there and parses is the store. A
 * file that is there and does not parse is **neither**, and the whole point
 * is that it has its own type rather than borrowing the empty one.
 *
 * These are pure-node tests. `store.ts` imports `vscode` for the editor
 * buffer in `lineReader`, so the corruption logic under test lives in
 * `decisions.ts`, which imports nothing from the editor.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CorruptStoreError, emptyDecisionFile, readDecisionsAt, serializeDecisionFile, writeDecisionsAt } from '../src/decisions/decisions';

function workspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dt-store-'));
}

function put(root: string, text: string): string {
  const file = path.join(root, '.deeptest', 'decisions.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
  return file;
}

// ---------------------------------------------------------------------------
// The three states
// ---------------------------------------------------------------------------

test('no file at all is a legitimate empty store', () => {
  const read = readDecisionsAt(path.join(workspace(), '.deeptest', 'decisions.json'));
  assert.equal(read.kind, 'absent');
});

test('a file that parses is the store', () => {
  const root = workspace();
  const file = put(root, serializeDecisionFile({ version: 1, decisions: [{ path: 'src/a.ts', line: 3 } as never] }));
  const read = readDecisionsAt(file);
  assert.equal(read.kind, 'loaded');
  assert.equal(read.kind === 'loaded' ? read.file.decisions.length : -1, 1);
});

test('a file that does not parse is its own state, not an empty store', () => {
  const file = put(workspace(), '{ this is not json');
  const read = readDecisionsAt(file);
  assert.equal(read.kind, 'unreadable', 'corrupt is distinguishable from absent');
  assert.notEqual(read.kind, 'absent');
  assert.ok(read.kind === 'unreadable' && read.why.length > 0, 'and it says why');
});

test('a file with the wrong shape is unreadable, not empty', () => {
  for (const bad of ['{"version":2,"decisions":[]}', '{"version":1}', '[]', 'null']) {
    const file = put(workspace(), bad);
    assert.equal(readDecisionsAt(file).kind, 'unreadable', bad);
  }
});

// ---------------------------------------------------------------------------
// The defect itself
// ---------------------------------------------------------------------------

test('an ordinary save refuses to overwrite a file it could not read, and the bytes survive', () => {
  const root = workspace();
  const original = '{ this is not json, and it is the person`s decisions';
  const file = put(root, original);

  assert.throws(() => writeDecisionsAt(file, emptyDecisionFile()), CorruptStoreError, 'the save refuses');
  assert.equal(fs.readFileSync(file, 'utf8'), original, 'and the corrupt bytes are still there, byte for byte');
});

test('the refusal says what to do rather than only that it failed', () => {
  const file = put(workspace(), 'not json');
  try {
    writeDecisionsAt(file, emptyDecisionFile());
    assert.fail('it should have refused');
  } catch (err) {
    assert.ok(err instanceof CorruptStoreError);
    assert.match((err as Error).message, /could not be read/i);
    assert.match((err as Error).message, /decisions\.json/);
  }
});

test('saving over a readable file still works, and saving a new file still works', () => {
  const root = workspace();
  const file = put(root, serializeDecisionFile(emptyDecisionFile()));
  writeDecisionsAt(file, { version: 1, decisions: [{ path: 'src/a.ts', line: 1 } as never] });
  assert.equal(readDecisionsAt(file).kind, 'loaded');

  const fresh = path.join(workspace(), '.deeptest', 'decisions.json');
  writeDecisionsAt(fresh, emptyDecisionFile());
  assert.equal(readDecisionsAt(fresh).kind, 'loaded', 'absent is not corrupt, so a first write is allowed');
});

// ---------------------------------------------------------------------------
// What was deliberately not done
// ---------------------------------------------------------------------------

test('no compatibility machinery for a version that never existed', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'decisions', 'decisions.ts'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /migrat|upgradeFrom|version === 0|version === 2/i, 'a reader for a file nobody ever wrote cannot be tested');
});
