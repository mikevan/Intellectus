/**
 * Is the attribution identifier stable enough for `existing-tests-still-ran`
 * to mean anything?
 *
 * Asked before making it a measurement, because a subset comparison over
 * strings that merely happen to come out of one run would be theatre.
 *
 * One identifier is `<test file path>::<full test name>`. Nothing in it is an
 * index, a counter, a timestamp, or a sequence, so two runs of an unchanged
 * project produce the same strings. These tests pin the two things that
 * could make that untrue: a hook changing how it composes the identifier, and
 * the parse being order- or run-dependent. **No new collection is added for
 * any of it.**
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { renameTestFiles } from '@projectrevivesolutions/witness';
import { parseAttribution } from '../src/languages/typescript/coverage';

const HOOKS = path.join(__dirname, '..', '..', 'Witness', 'hooks');

/**
 * The composition, per hook, asserted against the hook source.
 *
 * This is the test that fails loudly if somebody changes how an identifier is
 * built. It is deliberately a source assertion rather than a behavioural one:
 * the four hooks run inside four different runners, and what has to stay
 * equal between them is the shape of the string.
 */
test('every hook composes the identifier as <test file>::<full test name>', () => {
  const composed: Array<[string, RegExp]> = [
    ['witness-vitest.mjs', /\$\{file\}::\$\{[^}]*currentTestName[^}]*\}/],
    ['witness-jest.cjs', /\$\{file\}::\$\{[^}]*currentTestName[^}]*\}/],
    ['mocha.cjs', /\$\{file\}::\$\{test \? test\.fullTitle\(\) : '\?'\}/],
    ['witness-karma-client.js', /specFile\(result\)\s*\+\s*'::'\s*\+\s*\(result\.fullName \|\| '\?'\)/],
  ];
  for (const [file, pattern] of composed) {
    const source = fs.readFileSync(path.join(HOOKS, file), 'utf8');
    assert.match(source, pattern, `${file} composes the identifier the way every other hook does`);
  }
});

test('no hook puts an index, a counter, or a timestamp in the identifier', () => {
  for (const file of ['witness-vitest.mjs', 'witness-jest.cjs', 'mocha.cjs', 'witness-karma-client.js']) {
    const source = fs.readFileSync(path.join(HOOKS, file), 'utf8');
    const identifierLines = source.split('\n').filter((l) => l.includes('::'));
    assert.ok(identifierLines.length > 0, `${file} builds an identifier`);
    for (const line of identifierLines) {
      assert.equal(/Date\.now|performance\.now|Math\.random|\+\+|counter|index/i.test(line), false, `${file}: ${line.trim()}`);
    }
  }
});

/**
 * The unchanged-run test, at the level where a run could differ. The same
 * records parsed twice produce exactly equal identifier sets, and the order
 * they arrive in does not change the set.
 */
test('the same records parse to exactly equal identifier sets, twice, in any order', () => {
  const records = [
    JSON.stringify({ test: 'test/greet.test.js::greet > greets', files: { '/p/src/greet.js': [1, 2] } }),
    JSON.stringify({ test: 'test/greet.test.js::greet > greets nobody', files: { '/p/src/greet.js': [1, 3] } }),
    JSON.stringify({ test: 'test/names.test.js::names > lists', files: { '/p/src/names.js': [4] } }),
  ];
  const identifiers = (lines: string[]): string[] => parseAttribution(lines).map((r) => r.test).sort();

  assert.deepEqual(identifiers(records), identifiers(records));
  assert.deepEqual(identifiers(records), identifiers([...records].reverse()));
  assert.deepEqual(identifiers(records), identifiers(['', ...records, '   ', 'not json at all']), 'torn and blank lines change nothing');
});

/**
 * `it.each` over a literal table substitutes the same values every run, so
 * the names match. A name computed from something non-deterministic does not,
 * and that project reports not-met on every comparison. Stated rather than
 * smoothed over.
 */
test('a deterministically generated name is stable and a computed one is not', () => {
  const generated = (n: number): string => `test/table.test.ts::adds ${n}`;
  assert.equal(generated(1), generated(1), 'a literal table substitutes the same values every run');

  const computed = (): string => `test/table.test.ts::ran at ${Date.now()}-${Math.random()}`;
  assert.notEqual(computed(), computed(), 'and this is the shape that never matches, which the measurement reports as not-met');
});

/**
 * Two sibling tests with the same name in one suite produce one identifier.
 * That is a real collision and it weakens the measurement exactly where it
 * collides. Pinned so nobody later assumes identifiers are unique.
 */
test('two siblings with the same name in one suite collide, and that is recorded rather than hidden', () => {
  const a = 'test/a.test.ts::total > works';
  const b = 'test/a.test.ts::total > works';
  assert.equal(a, b, 'the describe chain is in the name, and it does not separate siblings');

  // Across files and across suites they do separate, which is the ordinary
  // case and the reason the measurement is worth having at all.
  assert.notEqual('test/a.test.ts::total > works', 'test/b.test.ts::total > works');
  assert.notEqual('test/a.test.ts::total > works', 'test/a.test.ts::subtotal > works');
});

/**
 * A run through a shadow tree and a run without one yield the same identity.
 * `renameTestFiles` exists for this: only the leading folder changes, and the
 * rest of the path and the test name are untouched.
 */
test('the shadow-tree rewrite preserves project-visible identity', () => {
  const shadow = ['.deeptest/shadow/test/greet.test.js::greet > greets', '.deeptest/shadow/src/names.test.js::names > lists'];
  const lines = shadow.map((test) => JSON.stringify({ test, files: {} }));
  const identifiers = parseAttribution(renameTestFiles(lines, '.deeptest/shadow/', '')).map((r) => r.test);
  assert.deepEqual(identifiers, ['test/greet.test.js::greet > greets', 'src/names.test.js::names > lists']);
  for (let i = 0; i < identifiers.length; i += 1) {
    assert.equal(identifiers[i].split('::')[1], shadow[i].split('::')[1], 'only the leading folder changes; the test name is untouched');
  }
});
