/**
 * UntangleIt's two findings, and the two it does not have.
 *
 * Both read `RunRecord.behaviour`, which `compareBehaviour` wrote from
 * Witness's comparator. Nothing here compares anything: there is one
 * comparator in the toolkit and it is not in the agent layer. The other
 * three conditions belong to DeepTest's decision store and density engine,
 * and UntangleIt has neither, which is a fact about the product rather than
 * about the interaction. The registration is the same in both.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { behaviourFinding } from '../src/agent/findings';
import type { RunRecord } from '../src/runs';

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'src', 'agent', 'findings.ts'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

function run(over: Partial<RunRecord> = {}): RunRecord {
  return { path: 'src/pricing.ts', name: 'total', boundary: { path: 'src/pricing.ts', name: 'total' }, ...over } as RunRecord;
}

test('a changed verdict travels with the comparator`s sentence and count', () => {
  const packet = behaviourFinding(run({ behaviour: { verdict: 'changed', compared: 9, sentence: 'total() returned something different in 2 of 9 calls.' } }))!;
  assert.equal(packet.classification.condition, 'behaviour-changed');
  assert.ok(packet.evidence.some((e) => e.text === 'total() returned something different in 2 of 9 calls.'), 'verbatim');
  assert.ok(packet.evidence.some((e) => /9 calls were compared/.test(e.text)));
  assert.ok(packet.known.some((k) => /tangle may well have come down/.test(k)), 'and a green tangle number does not make this a pass');
});

test('an insufficient verdict names which of the six reasons it was', () => {
  const packet = behaviourFinding(run({ behaviour: { verdict: 'insufficient', reason: 'arguments-differ', sentence: 'The calls were made with different arguments.' } }))!;
  assert.equal(packet.classification.condition, 'behaviour-insufficient');
  assert.ok(packet.evidence.some((e) => /arguments-differ/.test(e.text)));
});

test('equivalent is not a finding, and a gate that did not run is not one either', () => {
  assert.equal(behaviourFinding(run({ behaviour: { verdict: 'equivalent', compared: 3, sentence: 'x' } })), undefined);
  assert.equal(behaviourFinding(run()), undefined, 'an absent gate is not a pass, and it is not a finding');
});

test('both are unclassified about the cause and certain about what happened', () => {
  for (const behaviour of [
    { verdict: 'changed' as const, compared: 1, sentence: 's' },
    { verdict: 'insufficient' as const, reason: 'never-exercised', sentence: 's' },
  ]) {
    const packet = behaviourFinding(run({ behaviour }))!;
    assert.equal(packet.classification.failureClass, 'insufficient-evidence');
    assert.equal(packet.classification.confidence, 'unclassified');
    assert.equal(packet.allowed.mayPropose, false);
    assert.deepEqual([...packet.remediation], []);
    assert.equal(packet.unknown.length, 1);
    assert.match(packet.unknown[0], /^Why this happened\./);
    assert.ok(packet.known.length > 0);
  }
});

test('the agent layer compares nothing and classifies nothing', () => {
  assert.doesNotMatch(CODE, /verdictFor|\bdecide\(|from '\.\.\/gate'|from '\.\.\/engine\/behaviour'/, 'the comparator is not reached from here');
  assert.doesNotMatch(CODE, /failureClass|confidence:/, 'and no class is written down');
  assert.match(CODE, /findingPacket\(/);
});

test('UntangleIt reaches two of the five conditions, and does not pretend to the other three', () => {
  assert.doesNotMatch(CODE, /decision-unverified|coverage-unreachable|coverage-density-shortfall/, 'no decision store and no density engine here');
});
