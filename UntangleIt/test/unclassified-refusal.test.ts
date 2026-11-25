/**
 * M5 in UntangleIt: the failed test run says it does not know.
 *
 * When the project's runner throws, UntangleIt has one piece of evidence,
 * the runner's own message, and that message establishes that something
 * stopped the run and nothing about whose doing it was. Before M5 the person
 * got a line in the output channel and nothing to ask about. Now the same
 * refusal carries a governed packet in the one class that means no class was
 * established, so the failure can be explained without being attributed.
 *
 * Nothing new is measured for it. The runner description in the packet is the
 * string the progress notification was already built from.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { unclassifiedGovernancePacket } from '@projectrevivesolutions/witness';

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'src', 'loop.ts'), 'utf8');

test('a run the runner could not start is reported, and reported as unclassified', () => {
  const packet = unclassifiedGovernancePacket({
    runner: 'vitest test',
    evidence: ['UntangleIt tried to run vitest test.', 'Command failed: vitest --run'],
    headline: 'UntangleIt could not run your tests, and could not work out why.',
  });
  assert.equal(packet.classification.failureClass, 'insufficient-evidence');
  assert.equal(packet.classification.confidence, 'unclassified');
  assert.equal(packet.classification.condition, 'unclassified');
  assert.equal(packet.allowed.mayPropose, false, 'an explanation proposes nothing');
  assert.ok(packet.offers.includes('explain'), 'and can be asked about');
  assert.ok(
    packet.evidence.some((e) => e.text === 'Command failed: vitest --run'),
    'the runner`s own message is the evidence, carried rather than interpreted',
  );
});

test('the catch in runTests reports the packet instead of only logging', () => {
  const at = SOURCE.indexOf('async function runTests(');
  assert.ok(at > 0, 'runTests is still there');
  const body = SOURCE.slice(at, SOURCE.indexOf('\n}', at));
  assert.match(body, /catch \(err\)/, 'the catch is still the refusal');
  assert.match(body, /reportProblem\(\s*deps,\s*unclassifiedGovernancePacket\(/s, 'and it now surfaces a governed packet');
  assert.match(body, /runner: describes/, 'named by what would have run');
  assert.doesNotMatch(body, /failureClass|classification/, 'no class is decided at the call site');
});

test('nothing at this site invents a class', () => {
  // The only classifier in the toolkit that can name `polyglot` is Witness`s,
  // and it is not reachable from here. A grep is the test: a class named in
  // this file would be a class decided outside the module that owns the
  // decision.
  assert.doesNotMatch(SOURCE, /'polyglot'|'toolchain'|'dependency'|'environment'/, 'loop.ts names no failure class');
});
