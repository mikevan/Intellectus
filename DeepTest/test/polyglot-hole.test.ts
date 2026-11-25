/**
 * M6 at the evidence hole: which refusals DeepTest can prove are Polyglot's.
 *
 * The second gate in `runner.ts` refuses to score a run whose attribution has
 * a hole. Three of those holes are shapes Polyglot's own counts establish as
 * Polyglot's own doing, and those now carry a governed packet classified
 * `polyglot` so the panel can offer to have the failure explained. The rest
 * carry none, and that is the point of the class rather than a gap in it: a
 * run whose counts cannot be lined up at all does not prove whose the gap is,
 * and Polyglot does not name a cause its measurements do not establish.
 *
 * These tests pair the two functions the runner site pairs, over the same
 * evidence values, so the wiring is tested rather than the wiring's comment.
 * Nothing new is collected for any of it: every field here is a count the
 * ordinary run already produced.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { instrumentationFailure, unclassifiedGovernancePacket } from '@projectrevivesolutions/witness';
import { evidenceProblemSentence } from '../src/ui/words';
import type { Evidence } from '../src/languages/types';

const HEALTHY: Evidence = { testsFinished: 9, testsRecorded: 9, recordsWithEvidence: 7, filesWithHits: 4, brokenBoundaries: 0, reconcilable: true };

function evidence(over: Partial<Evidence>): Evidence {
  return { ...HEALTHY, ...over };
}

/** Exactly what `runner.ts` does at the second gate, and nothing else. */
function atTheGate(e: Evidence): { hole: string | undefined; condition: string | undefined; failureClass: string | undefined } {
  const hole = evidenceProblemSentence(e);
  const packet = hole ? instrumentationFailure({ runner: 'vitest', evidence: e, sentence: hole }) : undefined;
  return { hole, condition: packet?.classification.condition, failureClass: packet?.classification.failureClass };
}

// ---------------------------------------------------------------------------
// The three shapes Polyglot can prove are its own
// ---------------------------------------------------------------------------

test('tests finished and nothing at all was instrumented is Polyglot`s own failure', () => {
  const { hole, condition, failureClass } = atTheGate(evidence({ recordsWithEvidence: 0, filesWithHits: 0 }));
  assert.ok(hole, 'it is refused');
  assert.equal(condition, 'instrumented-nothing');
  assert.equal(failureClass, 'polyglot');
});

test('a broken test boundary is Polyglot`s own failure', () => {
  const { hole, condition, failureClass } = atTheGate(evidence({ brokenBoundaries: 2 }));
  assert.ok(hole);
  assert.equal(condition, 'broken-boundary');
  assert.equal(failureClass, 'polyglot');
});

test('records missing against a count that reconciles is Polyglot`s own failure', () => {
  const { hole, condition, failureClass } = atTheGate(evidence({ testsRecorded: 2, recordsWithEvidence: 2 }));
  assert.ok(hole);
  assert.equal(condition, 'records-missing');
  assert.equal(failureClass, 'polyglot');
});

test('the shape that instrumented nothing is proved even when the counts do not reconcile', () => {
  // Deliberate: this is the one check that runs before reconcilability,
  // because no healthy run of any runner can finish tests and touch no line.
  const { condition, failureClass } = atTheGate(evidence({ recordsWithEvidence: 0, filesWithHits: 0, reconcilable: false }));
  assert.equal(condition, 'instrumented-nothing');
  assert.equal(failureClass, 'polyglot');
});

// ---------------------------------------------------------------------------
// What does not become `polyglot`
// ---------------------------------------------------------------------------

test('a run whose counts cannot be lined up is not classified at all', () => {
  for (const unreconcilable of [evidence({ reconcilable: false, brokenBoundaries: 3 }), evidence({ reconcilable: false, testsRecorded: 1, recordsWithEvidence: 1 })]) {
    assert.equal(
      instrumentationFailure({ runner: 'pytest', evidence: unreconcilable, sentence: 'something was wrong' }),
      undefined,
      'Polyglot cannot say whose the gap is, so it names nobody',
    );
  }
});

test('a healthy run is refused by nothing and classified as nothing', () => {
  const { hole, condition } = atTheGate(HEALTHY);
  assert.equal(hole, undefined, 'there is no hole');
  assert.equal(condition, undefined, 'and so there is no packet');
  assert.equal(instrumentationFailure({ runner: 'vitest', evidence: HEALTHY, sentence: 'unused' }), undefined);
});

test('the packet accuses nobody and asks for nothing to be changed', () => {
  const packet = instrumentationFailure({ runner: 'vitest', evidence: evidence({ brokenBoundaries: 1 }), sentence: 'a test was cut off' })!;
  assert.equal(packet.allowed.mayPropose, false, 'an explanation does not propose');
  assert.deepEqual([...packet.allowed.proposable], [], 'and has nothing it may change');
  assert.ok(packet.unknown.some((u) => /says nothing either way about the project/.test(u)), 'the project is neither accused nor cleared');
});

// ---------------------------------------------------------------------------
// The wiring itself
// ---------------------------------------------------------------------------

/**
 * A source assertion, because what matters is that the packet produced at the
 * second gate is the one handed to the error state. A behavioural test of
 * `runAnalysis` needs a live workspace and a runner; this needs neither and
 * fails the moment somebody drops the second argument.
 */
/**
 * The runner in the packet is a factual field and follows the same evidence
 * discipline as the classification. It comes from the run, which knows which
 * runner it used, and not from the setting, which may still say `auto`, and
 * not from the language, which is not a runner at all.
 */
test('the packet names the runner the run used, not the configured word and not the language', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'runner.ts'), 'utf8');
  assert.match(source, /instrumentationFailure\(\{ runner: run\.runner\b/, 'the measured runner, from the run');
  assert.doesNotMatch(source, /runner: plugin\.displayName|runnerLabel\(/, 'a language name is not a runner');
  assert.doesNotMatch(source, /runner: .*settings\.fields/, 'and neither is a setting that may still say auto');
});

test('the second gate hands its packet to setError', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'runner.ts'), 'utf8');
  const gate = source.indexOf('evidenceProblemSentence(run.evidence)');
  assert.ok(gate > 0, 'the second gate is still there');
  const block = source.slice(gate, gate + 2600);
  assert.match(block, /instrumentationFailure\(\{ runner: run\.runner, evidence: run\.evidence, sentence: hole \}\)/, 'the hole sentence and the measured evidence both travel');
  assert.match(block, /state\.setError\(hole, classified \?\? unclassifiedGovernancePacket\(/, 'and the fall-through is not left silent');
});

// ---------------------------------------------------------------------------
// M5: the refusals that establish no class say so, rather than saying nothing
// ---------------------------------------------------------------------------

test('a run whose tests did not run carries the unclassified packet, not a guess', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'runner.ts'), 'utf8');
  const first = source.indexOf('nothingToScoreSentence(run.tests)');
  const gate = source.indexOf('evidenceProblemSentence(run.evidence)');
  const block = source.slice(first, gate);
  assert.match(block, /state\.setError\(why, unclassifiedGovernancePacket\(\{ runner: run\.runner/, 'governed, and named by the runner that ran');
  assert.doesNotMatch(block, /instrumentationFailure/, 'a run that did not run is not an instrumentation failure');
});

test('the unclassified packet names no cause and offers no remedy', () => {
  const packet = unclassifiedGovernancePacket({
    runner: 'vitest',
    evidence: ['0 passed, 0 failed, 2 errors, 0 skipped, exit code 1', 'Nothing finished, so there is nothing to score.'],
    headline: 'vitest did not run your tests, and the toolkit could not work out why.',
  });
  assert.equal(packet.classification.failureClass, 'insufficient-evidence');
  assert.equal(packet.classification.confidence, 'unclassified');
  assert.equal(packet.allowed.mayPropose, false);
  assert.deepEqual([...packet.remediation], [], 'nothing is recommended for a cause nobody established');
  assert.ok(packet.unknown.some((u) => /genuinely not established/.test(u)));
});

test('a refusal before a runner was selected names no runner at all', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'runner.ts'), 'utf8');
  const helper = source.slice(source.indexOf('function environmentRefusal('), source.indexOf('export async function runAnalysis'));
  assert.ok(helper.length > 0, 'the environment gate has a governed refusal');
  assert.doesNotMatch(helper, /\brunner:/, 'and it passes no runner, because none was selected');
  const extension = fs.readFileSync(path.join(__dirname, '..', 'src', 'extension.ts'), 'utf8');
  const at = extension.indexOf('The check did not finish:');
  assert.match(extension.slice(at, at + 900), /unclassifiedGovernancePacket\(\{ evidence: \[message\]/, 'the last catch is governed');
  assert.doesNotMatch(extension.slice(at, at + 900), /\brunner:/, 'and names no runner either');
});

test('the environment refusal carries the problems as written and types none of them', () => {
  const packet = unclassifiedGovernancePacket({
    evidence: ['Node 20, no test runner', 'Install Vitest or Jest, or pick one on the setup screen.'],
    headline: 'DeepTest could not start the check, and the toolkit could not work out why.',
  });
  assert.equal(packet.runner, undefined, 'no runner had been selected');
  assert.equal(packet.classification.failureClass, 'insufficient-evidence');
  assert.equal(packet.classification.confidence, 'unclassified');
  assert.deepEqual(
    packet.evidence.map((e) => e.text),
    ['Node 20, no test runner', 'Install Vitest or Jest, or pick one on the setup screen.'],
    'the strings travel verbatim and stay strings',
  );
  assert.ok(packet.known.some((k) => /before a test runner was selected/.test(k)), 'and the person is told the failure came first');
});

test('the two packets are different packets, and neither can become the other', () => {
  const holed = evidence({ brokenBoundaries: 1 });
  const classified = instrumentationFailure({ runner: 'vitest', evidence: holed, sentence: 'a test was cut off' })!;
  const unclassified = unclassifiedGovernancePacket({ runner: 'vitest', evidence: ['a test was cut off'] });
  assert.equal(classified.classification.failureClass, 'polyglot');
  assert.equal(unclassified.classification.failureClass, 'insufficient-evidence');
  assert.notEqual(classified.classification.confidence, unclassified.classification.confidence);
});
