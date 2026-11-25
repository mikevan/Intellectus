/**
 * DeepTest's four findings, and the rule that each one reads an answer
 * rather than working one out.
 *
 * Every packet here is built from a value some other part of the toolkit
 * already computed: `Decision.behaviour` from Witness's comparator through
 * `verify.ts`, the `unverified` reason from `withinLimitState`,
 * `FileResult.unreachableLines` and `Shortfall` from the density engine. If
 * the agent layer recomputed any of them the toolkit would have two answers
 * to one question and no rule for which is true, so the tests below check
 * both halves: the measured value survives into the packet exactly, and
 * nothing in `agent/findings.ts` could have produced it independently.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { behaviourFinding, decisionUnverifiedFinding, densityShortfallFinding, unreachableFinding } from '../src/agent/findings';
import type { Decision } from '../src/decisions/decisions';
import type { FileResult, Shortfall } from '../src/engine/types';

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'src', 'agent', 'findings.ts'), 'utf8');
/**
 * The same file with its comments removed, for the assertions that are about
 * what the code does. The comments name the sources this file reads from,
 * deliberately, so matching against them would fail for the right reason
 * being written down.
 */
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

function decision(over: Partial<Decision> = {}): Decision {
  return { path: 'src/pricing.ts', line: 12, functionName: 'total', ...over } as Decision;
}

// ---------------------------------------------------------------------------
// behaviour-changed and behaviour-insufficient: the comparator's own answer
// ---------------------------------------------------------------------------

test('a changed verdict travels with the comparator`s sentence and its comparison count', () => {
  const packet = behaviourFinding(decision({ behaviour: { verdict: 'changed', compared: 7, sentence: 'total() returned something different in 1 of 7 calls.' } }))!;
  assert.equal(packet.classification.condition, 'behaviour-changed');
  assert.ok(packet.evidence.some((e) => e.text === 'total() returned something different in 1 of 7 calls.'), 'the comparator`s sentence, verbatim');
  assert.ok(packet.evidence.some((e) => /7 calls were compared/.test(e.text)), 'and its own count');
  assert.ok(packet.evidence.some((e) => e.source === 'witness'), 'attributed to what measured it');
});

test('an insufficient verdict travels with which of the six reasons it was', () => {
  const packet = behaviourFinding(decision({ behaviour: { verdict: 'insufficient', reason: 'unstable-pairing', sentence: 'The calls could not be paired.' } }))!;
  assert.equal(packet.classification.condition, 'behaviour-insufficient');
  assert.ok(packet.evidence.some((e) => /unstable-pairing/.test(e.text)), 'the reason is named, not summarised away');
  assert.ok(packet.known.some((k) => /neither shown to have changed nor shown to be the same/.test(k)));
});

test('equivalent is not a finding, and neither is a gate that did not run', () => {
  assert.equal(behaviourFinding(decision({ behaviour: { verdict: 'equivalent', compared: 7, sentence: 'x' } })), undefined);
  assert.equal(behaviourFinding(decision()), undefined);
});

// ---------------------------------------------------------------------------
// decision-unverified: withinLimitState's three reasons
// ---------------------------------------------------------------------------

test('each of the three unverified reasons produces its own measured sentence', () => {
  const seen = new Set<string>();
  for (const why of ['not-recorded', 'not-compared', 'insufficient'] as const) {
    const packet = decisionUnverifiedFinding(decision({ behaviourGate: 'recorded' }), why);
    assert.equal(packet.classification.condition, 'decision-unverified');
    const first = packet.evidence[0].text;
    assert.equal(seen.has(first), false, `${why} says something the others do not`);
    seen.add(first);
    assert.ok(packet.known.some((k) => /confirmation has not happened/.test(k)), 'unverified is not a failure and the packet says so');
  }
});

test('an insufficient decision carries the comparator`s own sentence too', () => {
  const packet = decisionUnverifiedFinding(decision({ behaviourGate: 'recorded', behaviour: { verdict: 'insufficient', reason: 'never-exercised', sentence: 'No test reached total().' } }), 'insufficient');
  assert.ok(packet.evidence.some((e) => e.text === 'No test reached total().'), 'carried, not re-derived');
});

// ---------------------------------------------------------------------------
// coverage-unreachable: the engine's line numbers, and no invented reason
// ---------------------------------------------------------------------------

test('the unreachable lines are the engine`s, listed as measured', () => {
  const file = { path: 'src/pricing.ts', unreachableLines: [41, 42, 43] } as FileResult;
  const packet = unreachableFinding(file)!;
  assert.equal(packet.classification.condition, 'coverage-unreachable');
  assert.ok(packet.evidence.some((e) => e.text.includes('41, 42, 43')), 'the numbers themselves');
  assert.ok(packet.known.some((k) => /No test can cover these lines/.test(k)));
});

test('no reason is invented for an unreachable line, because the engine records none', () => {
  // `FileResult` carries line numbers and no per-line reason. The packet
  // must not manufacture one, and this is the assertion that says so.
  assert.doesNotMatch(CODE, /unreachableReason|reasonFor/i);
  assert.equal(unreachableFinding({ path: 'src/a.ts', unreachableLines: [] } as unknown as FileResult), undefined, 'and no lines is no finding');
});

// ---------------------------------------------------------------------------
// coverage-density-shortfall: the engine's three numbers
// ---------------------------------------------------------------------------

test('the shortfall carries the engine`s own density, bar and gap', () => {
  const shortfall: Shortfall = { path: 'src/pricing.ts', line: 12, density: 1, bar: 4, gap: 3, status: 'short' };
  const packet = densityShortfallFinding(shortfall);
  assert.equal(packet.classification.condition, 'coverage-density-shortfall');
  assert.ok(packet.evidence.some((e) => /4 ways through it and 1 test reaching it/.test(e.text)));
  assert.ok(packet.evidence.some((e) => /The shortfall is 3/.test(e.text)), 'the gap the engine worked out, not one computed here');
  assert.ok(packet.known.some((k) => /does not say which way/.test(k)), 'and what the number does not mean');
});

test('an untested line says so rather than reporting a shortfall of zero tests as a shortage', () => {
  const packet = densityShortfallFinding({ path: 'src/pricing.ts', line: 12, density: 0, bar: 2, gap: 2, status: 'untested' });
  assert.match(packet.headline, /is not tested at all/);
});

// ---------------------------------------------------------------------------
// The rule the whole file is built on
// ---------------------------------------------------------------------------

test('every finding is unclassified about its cause and certain about what happened', () => {
  const packets = [
    behaviourFinding(decision({ behaviour: { verdict: 'changed', compared: 2, sentence: 's' } }))!,
    behaviourFinding(decision({ behaviour: { verdict: 'insufficient', reason: 'never-exercised', sentence: 's' } }))!,
    decisionUnverifiedFinding(decision(), 'not-recorded'),
    unreachableFinding({ path: 'a.ts', unreachableLines: [1] } as FileResult)!,
    densityShortfallFinding({ path: 'a.ts', line: 1, density: 0, bar: 1, gap: 1, status: 'untested' }),
  ];
  assert.equal(packets.length, 5, 'four constructors, five conditions');
  for (const packet of packets) {
    assert.equal(packet.classification.failureClass, 'insufficient-evidence');
    assert.equal(packet.classification.confidence, 'unclassified');
    assert.equal(packet.allowed.mayPropose, false);
    assert.deepEqual([...packet.remediation], []);
    assert.ok(packet.known.length > 0, 'something is known, which is the finding itself');
    assert.equal(packet.unknown.length, 1, 'and one thing is not: why');
    assert.match(packet.unknown[0], /^Why this happened\./);
  }
});

test('the agent layer decides nothing it was handed', () => {
  assert.doesNotMatch(CODE, /from '\.\.\/engine\/density'|verdictFor|\bdecide\(|rankShortfalls|withinLimitState/, 'no verdict, reachability or density is recomputed here');
  assert.doesNotMatch(CODE, /failureClass|confidence:|'toolchain'|'polyglot'/, 'and no class is written down');
  assert.match(CODE, /findingPacket\(/, 'it builds through the one builder that writes the class');
});
