import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  applyDecisions,
  decisionState,
  emptyDecisionFile,
  findDecision,
  functionDecisionState,
  hashLine,
  openShortfalls,
  parseDecisionFile,
  recordDecision,
  removeDecision,
  serializeDecisionFile,
  Decision,
} from '../src/decisions/decisions';
import { analyze, scoreLine } from '../src/engine/density';
import { FileCoverage, FileStructure, RouteStep } from '../src/engine/types';
import { functionDecisionSentence } from '../src/ui/words';
import { classifyEnding, describeAction, describeMeaning, describeReach, describeRouteSteps, describeStep } from '../src/report/plain';
import { buildReport, renderMarkdown, verdictFor } from '../src/report/report';
import { decisionKey } from '../src/gate';

function cov(path: string, lines: Record<number, string[]>): FileCoverage {
  const map = new Map<number, Set<string>>();
  const executed = new Set<number>();
  for (const [line, tests] of Object.entries(lines)) {
    map.set(Number(line), new Set(tests));
    if (tests.length) {
      executed.add(Number(line));
    }
  }
  return { path, lines: map, executed };
}

function struct(path: string, depth: Record<number, number>, routes: Record<number, RouteStep[]> = {}, unreachable: number[] = []): FileStructure {
  return {
    path,
    depth: new Map(Object.entries(depth).map(([k, v]) => [Number(k), v])),
    routes: new Map(Object.entries(routes).map(([k, v]) => [Number(k), v])),
    unreachable: new Set(unreachable),
    functions: [{ name: 'f', startLine: 1, endLine: 20, complexity: 12, campbell: 5, mbcc: 8 }],
    declarations: new Set([1]),
  };
}

const step = (line: number, condition: string, outcome = 'is true', kind: RouteStep['kind'] = 'if'): RouteStep => ({ line, kind, condition, outcome });

// A small program:
//  1 def f(x, y):
//  2     if x > 0:           <- 2 tests
//  3         if y > 0:       <- 1 test   (bar 2 -> short by 1)
//  4             return 1    <- 0 tests   (route: x>0 true, y>0 true) bar 2
//  5     elif y > 0 and x == 0:  <- 0 tests (route: x>0 false, y>0 true, x==0 also true) bar 3
//  6         return 2        <- 0 tests   bar 3
//  7     return 3            <- 2 tests   bar 1 -> over
//  8     print("dead")       <- unreachable
const SRC: Record<number, string> = {
  1: 'def f(x, y):',
  2: '    if x > 0:',
  3: '        if y > 0:',
  4: '            return 1',
  5: '    elif y > 0 and x == 0:',
  6: '        return 2',
  7: '    return 3',
  8: '    print("dead")',
};
const readLine = (_p: string, l: number): string | undefined => SRC[l];

function sampleResult() {
  const routes: Record<number, RouteStep[]> = {
    2: [step(2, 'x > 0')],
    3: [step(2, 'x > 0'), step(3, 'y > 0')],
    4: [step(2, 'x > 0'), step(3, 'y > 0')],
    5: [step(2, 'x > 0', 'is false'), step(5, 'y > 0', 'is true', 'elif'), step(5, 'x == 0', 'is also true', 'and')],
    6: [step(2, 'x > 0', 'is false'), step(5, 'y > 0', 'is true', 'elif'), step(5, 'x == 0', 'is also true', 'and')],
    7: [],
  };
  return analyze(
    [cov('a.py', { 1: [], 2: ['t1', 't2'], 3: ['t1'], 4: [], 5: [], 6: [], 7: ['t1', 't2'] })],
    [struct('a.py', { 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 0 }, routes, [8])],
  );
}

const run = { tests: { passed: 2, failed: 0, errors: 0, skipped: 0, exitCode: 0 }, language: 'Python', finishedAt: new Date('2026-09-05T12:00:00Z') };

test('hashLine ignores surrounding whitespace only', () => {
  assert.equal(hashLine('  return 1  '), hashLine('return 1'));
  assert.notEqual(hashLine('return 1'), hashLine('return 2'));
});

test('decision file round-trips, replaces per line, removes, and rejects junk', () => {
  const d: Decision = { path: 'a.py', line: 5, lineHash: hashLine(SRC[5]), kind: 'accept', reason: 'legacy path', by: 'me', at: '2026-09-05T00:00:00Z', gapAtDecision: 3 };
  let file = recordDecision(emptyDecisionFile(), d);
  file = recordDecision(file, { ...d, reason: 'updated' });
  assert.equal(file.decisions.length, 1);
  assert.equal(findDecision(file, 'a.py', 5)?.reason, 'updated');
  const parsed = parseDecisionFile(serializeDecisionFile(file));
  assert.deepEqual(parsed, file);
  assert.equal(removeDecision(file, 'a.py', 5).decisions.length, 0);
  assert.throws(() => parseDecisionFile('{"version":2}'));
  assert.throws(() => parseDecisionFile('{"version":1,"decisions":"no"}'));
});

test('decisionState: none, accepted, fix pending (moved or not), fixed, and stale', () => {
  const base: Decision = { path: 'a.py', line: 5, lineHash: hashLine(SRC[5]), kind: 'accept', reason: 'r', by: 'me', at: '2026-09-05T00:00:00Z', gapAtDecision: 3 };
  const short = scoreLine(5, ['t'], 3);
  const met = scoreLine(5, ['a', 'b', 'c'], 3);
  assert.equal(decisionState(undefined, short, SRC[5]).kind, 'none');
  assert.equal(decisionState(base, short, SRC[5]).kind, 'accepted');
  assert.equal(decisionState(base, short, 'something else').kind, 'stale');
  assert.equal(decisionState(base, short, undefined).kind, 'accepted', 'unreadable file keeps the decision');
  const fix = { ...base, kind: 'fix' as const };
  const pending = decisionState(fix, short, SRC[5]);
  assert.equal(pending.kind, 'fix-pending');
  if (pending.kind === 'fix-pending') {
    assert.equal(pending.stillShortBy, 2);
    assert.equal(pending.moved, true);
  }
  const stuck = decisionState({ ...fix, gapAtDecision: 2 }, short, SRC[5]);
  if (stuck.kind === 'fix-pending') {
    assert.equal(stuck.moved, false);
  }
  assert.equal(decisionState(fix, met, SRC[5]).kind, 'fixed');
});

test('applyDecisions and openShortfalls: accepted lines leave the open list, order follows the ranking', () => {
  const result = sampleResult();
  const file = recordDecision(emptyDecisionFile(), {
    path: 'a.py', line: 6, lineHash: hashLine(SRC[6]), kind: 'accept', reason: 'covered by integration tests', by: 'me', at: '2026-09-05T00:00:00Z', gapAtDecision: 3,
  });
  const decided = applyDecisions(result, file, readLine);
  assert.deepEqual(decided.map((d) => `${d.line.line}:${d.state.kind}`).sort(), ['3:none', '4:none', '5:none', '6:accepted']);
  const open = openShortfalls(decided, result.shortfalls);
  assert.deepEqual(open.map((d) => d.line.line), [5, 4, 3]);
});

test('plain: steps, reach, endings, meaning, action', () => {
  assert.equal(describeStep(step(2, 'x > 0')), 'the check `x > 0` is true');
  assert.equal(describeStep(step(5, 'x == 0', 'is also true', 'and')), 'and also `x == 0` is also true');
  assert.equal(describeStep(step(9, 'ValueError', 'is raised inside the try', 'except')), 'the error handler for `ValueError` is raised inside the try');
  assert.equal(describeStep(step(9, 'v matches 1', 'is false', 'case')), '`v matches 1` does not hold');

  const result = sampleResult();
  const line5 = result.files[0].lines.find((l) => l.line === 5)!;
  assert.match(describeReach(line5.route), /get past none of the decisions/);
  assert.match(describeReach(line5.route), /the check `x > 0` is false/);
  const line4 = result.files[0].lines.find((l) => l.line === 4)!;
  assert.equal(line4.route.reached, 1);
  assert.match(describeReach(line4.route), /get past 1 of 2/);
  assert.deepEqual(describeRouteSteps(line4.route).map((s) => s[0]), ['✓', '✗']);
  const line7 = result.files[0].lines.find((l) => l.line === 7)!;
  assert.match(describeReach(line7.route), /No decision guards/);

  assert.equal(classifyEnding('return x'), 'returns');
  assert.equal(classifyEnding('raise ValueError()'), 'raises');
  assert.equal(classifyEnding('throw new Error()'), 'raises');
  assert.equal(classifyEnding('total = a + b'), 'assigns');
  assert.equal(classifyEnding('save(order)'), 'calls');
  assert.equal(classifyEnding('pass'), 'runs');
  assert.match(describeMeaning('raise X', true, 3), /error path/);
  assert.match(describeMeaning('return 1', false, 2), /short by 2/);
  assert.match(describeMeaning('go()', true, 1), /calls `go\(\)`/);
  assert.match(describeMeaning('y = 1', true, 1), /sets a value/);
  assert.match(describeMeaning('pass', true, 1), /has never run/);
  assert.match(describeAction(line5.route, 3, 0), /Write a test where the check `x > 0` is false/);
  const stopAtOperand = { ...line5.route, reached: 2 };
  assert.match(describeAction(stopAtOperand, 3, 0), /Write a test where `x == 0` is also true/);
  assert.match(describeAction(line7.route, 1, 0), /Write one test that runs this line/);
  assert.match(describeAction(line7.route, 3, 1), /2 more tests that run this line/);
  assert.match(describeAction(line7.route, 2, 1), /1 more test that runs this line/);
  const walked = { steps: line4.route.steps.map((s) => ({ ...s, testsPast: 1 })), reached: 2, total: 2 };
  assert.match(describeReach(walked), /past every one of the 2 decisions/);
  assert.match(describeAction(walked, 2, 1), /1 more test that reaches this line/);
  assert.match(describeAction(walked, 3, 1), /2 more tests that reach this line/);
  assert.match(describeMeaning('return 1', false, 2), /checked from too few directions/);
});

test('report: worst N in full by the gap ranking, the rest in one line, accepted apart, verdict from thresholds', () => {
  const result = sampleResult();
  const file = recordDecision(emptyDecisionFile(), {
    path: 'a.py', line: 6, lineHash: hashLine(SRC[6]), kind: 'accept', reason: 'covered elsewhere', by: 'me', at: '2026-09-05T00:00:00Z', gapAtDecision: 3,
  });
  const decided = applyDecisions(result, file, readLine);
  const model = buildReport({ result, decided, run, readLine, detailCount: 1 });
  assert.equal(model.ready, false);
  assert.match(model.verdict, /This is not ready/);
  assert.match(model.verdict, /1 function is harder to test than your limit/);
  assert.deepEqual(model.detailed.map((d) => d.line), [5]);
  assert.deepEqual(model.rest.map((d) => d.line), [4, 3]);
  assert.deepEqual(model.accepted.map((d) => d.line), [6]);
  assert.deepEqual(model.unreachable, [{ path: 'a.py', line: 8, code: 'print("dead")' }]);
  assert.equal(model.detailed[0].code, 'elif y > 0 and x == 0:');
  assert.equal(model.detailed[0].steps.length, 3);

  const md = renderMarkdown(model);
  assert.match(md, /## This is not ready\./);
  assert.match(md, /### 1\. a\.py, line 5: never tested/);
  assert.match(md, /\| a\.py \| 4 \| 0 \/ 2 \| 1 of 2 \|/);
  assert.match(md, /Accepted by me on 2026-09-05: covered elsewhere/);
  assert.match(md, /Code that can never run \(1\)/);
  assert.match(md, /`f\(\)` in a\.py line 1: 12 ways through, tangle 5 \/ 8/);
  assert.match(md, /## Ways through against tangle \(1 of 1 functions\)/);
  assert.match(md, /\| Function \| Where \| Ways through \| Tangle \(Campbell\) \| Tangle \(MBCC\) \|/);
  assert.match(md, /\| `f\(\)` \| a\.py line 1 \| 12 \| 5 \| 8 \|/);
  assert.deepEqual(model.compared.map((fn) => fn.name), ['f']);
});

test('report: verdict is ready when thresholds pass, and says how many lines are still open', () => {
  const s = sampleResult().summary;
  const passing = { ...s, coverageOk: true, densityPassRateOk: true, averageDensityOk: true, complexityOk: true, complexFunctions: [] };
  assert.deepEqual(verdictFor(passing, 2, run), { ready: true, verdict: 'It meets the limits you set. 2 lines still want more tests; your limits allow that.' });
  assert.deepEqual(verdictFor(passing, 0, run), { ready: true, verdict: 'It meets the limits you set. Every line has the tests it needs.' });
  const failing = verdictFor(passing, 0, { ...run, tests: { ...run.tests, failed: 1 } });
  assert.match(failing.verdict, /1 test fail/);
  assert.equal(failing.ready, false);
});

test('report: fix decisions show as pending, fixed, or stale', () => {
  const result = sampleResult();
  let file = recordDecision(emptyDecisionFile(), { path: 'a.py', line: 5, lineHash: hashLine(SRC[5]), kind: 'fix', reason: '', by: 'me', at: '2026-09-04T00:00:00Z', gapAtDecision: 3 });
  file = recordDecision(file, { path: 'a.py', line: 4, lineHash: 'stalehash', kind: 'accept', reason: 'old', by: 'me', at: '2026-09-01T00:00:00Z', gapAtDecision: 2 });
  const decided = applyDecisions(result, file, readLine);
  const md = renderMarkdown(buildReport({ result, decided, run, readLine, detailCount: 5 }));
  assert.match(md, /A fix was requested on 2026-09-04; still 3 tests short, nothing changed/);
  assert.match(md, /the line has changed since, so it no longer applies/);
});

/**
 * The two brief builders are gone, deleted in Phase 5 rather than wrapped.
 *
 * They assembled prose here and handed it to an assistant: nothing recorded
 * what limits travelled, nothing validated what came back, and the modal in
 * front of them promised the assistant "may change your code and your tests",
 * which under diff-only is not what happens. Hand-written prose inside a
 * governed packet is the thing rule 87 was written about.
 *
 * What replaced them is in `agent/packets.ts`, and the sentence the person
 * reads is built by Witness's `authorizationBrief` from the packet, so it
 * cannot drift from the limits actually in force. Their cases live in
 * `o5.test.ts` now. This assertion is what stops either coming back.
 */
test('the legacy brief builders are gone, and nothing rebuilds them', () => {
  const brief = path.join(__dirname, '..', 'src', 'report', 'brief.ts');
  const source = fs.existsSync(brief) ? fs.readFileSync(brief, 'utf8') : '';
  assert.doesNotMatch(source, /export function buildBrief\b/);
  assert.doesNotMatch(source, /export function buildFunctionBrief\b/);
});

test('function decisions: pinned to the start line, judged by ways over the limit, kept apart from line decisions', () => {
  const fn = { name: 'f', startLine: 1, endLine: 8, complexity: 5, campbell: 0, mbcc: 0 };
  const d = { path: 'a.py', line: 1, lineHash: hashLine(SRC[1]), kind: 'fix' as const, reason: 'refactor', by: 'mike', at: '2026-09-06T10:00:00Z', gapAtDecision: 2, scope: 'function' as const, functionName: 'f' };
  assert.equal(functionDecisionState(undefined, fn, 3, SRC[1]).kind, 'none');
  assert.deepEqual(functionDecisionState(d, fn, 3, SRC[1]), { kind: 'fix-pending', decision: d, stillShortBy: 2, moved: false });
  assert.deepEqual(functionDecisionState(d, { ...fn, complexity: 4 }, 3, SRC[1]), { kind: 'fix-pending', decision: d, stillShortBy: 1, moved: true });
  assert.equal(functionDecisionState(d, { ...fn, complexity: 3 }, 3, SRC[1]).kind, 'fixed');
  assert.equal(functionDecisionState(d, fn, 3, 'def g(x, y):').kind, 'stale');
  // A line decision on the same line number is a different decision.
  const lineDecision = { ...d, scope: undefined, functionName: undefined, kind: 'accept' as const, reason: 'legacy code' };
  let file = recordDecision(emptyDecisionFile(), d);
  file = recordDecision(file, lineDecision);
  assert.equal(file.decisions.length, 2);
  assert.equal(findDecision(file, 'a.py', 1)?.kind, 'accept');
  assert.equal(functionDecisionState(d, fn, 3, SRC[1]).kind, 'fix-pending');
  file = removeDecision(file, 'a.py', 1, 'function');
  assert.equal(file.decisions.length, 1);
  assert.equal(file.decisions[0].kind, 'accept');
  assert.equal(functionDecisionSentence({ kind: 'fix-pending', decision: d, stillShortBy: 2, moved: false }), 'A fix was requested on 2026-09-06. Still 2 ways through over your limit, nothing changed. Your call again.');
  assert.equal(functionDecisionSentence({ kind: 'fixed', decision: d }), 'Fixed after your request on 2026-09-06. It is within your limit now.');
});

/**
 * The behaviour gate, at the one line where it matters.
 *
 * Before 1.0.21 `functionDecisionState` said `fixed` the moment the
 * complexity number came under the limit. A refactor that lowered the
 * number and changed what the function does passed. Everything below is
 * about that one line and the ways round it.
 */
test('behaviour gate: a lower number alone is not a fix, and a missing recording is not a pass', () => {
  const fn = { name: 'f', startLine: 1, endLine: 8, complexity: 3, campbell: 0, mbcc: 0 };
  const base = { path: 'a.py', line: 1, lineHash: hashLine(SRC[1]), kind: 'fix' as const, reason: 'refactor', by: 'mike', at: '2026-09-06T10:00:00Z', gapAtDecision: 2, scope: 'function' as const, functionName: 'f' };

  // A decision made before 1.0.21 carries no marker. Old behaviour exactly:
  // no claim is made about it in either direction.
  assert.equal(functionDecisionState(base, fn, 3, SRC[1]).kind, 'fixed');

  // The gate governs this one and nothing has been compared. This is the
  // bypass: without the marker it is indistinguishable from the line above.
  const gated: Decision = { ...base, behaviourGate: 'recorded' };
  assert.deepEqual(functionDecisionState(gated, fn, 3, SRC[1]), { kind: 'unverified', decision: gated, why: 'not-compared' });

  // No recording could ever be made. It stays unverified for good rather
  // than falling back to the number.
  const ungateable: Decision = { ...base, behaviourGate: 'unavailable' };
  assert.deepEqual(functionDecisionState(ungateable, fn, 3, SRC[1]), { kind: 'unverified', decision: ungateable, why: 'not-recorded' });

  // Both runs happened and the comparison could not reach an answer.
  const unsure: Decision = { ...gated, behaviour: { verdict: 'insufficient', reason: 'never-exercised', sentence: 'No test reached it.' } };
  assert.equal(functionDecisionState(unsure, fn, 3, SRC[1]).kind, 'unverified');

  // The number came down and the answer changed. Not a fix.
  const broke: Decision = { ...gated, behaviour: { verdict: 'changed', compared: 4, sentence: 'It returns something else now.' } };
  assert.deepEqual(functionDecisionState(broke, fn, 3, SRC[1]), { kind: 'behaviour-changed', decision: broke, sentence: 'It returns something else now.' });

  // The only way to fixed under the gate.
  const held: Decision = { ...gated, behaviour: { verdict: 'equivalent', compared: 4, sentence: 'It does what it did.' } };
  assert.equal(functionDecisionState(held, fn, 3, SRC[1]).kind, 'fixed');

  // Tests were asked for, not a refactor. Nothing was meant to move.
  assert.equal(functionDecisionState({ ...base, behaviourGate: 'not-applicable' }, fn, 3, SRC[1]).kind, 'fixed');

  // Still over the limit: the gate has nothing to say yet.
  assert.equal(functionDecisionState(gated, { ...fn, complexity: 5 }, 3, SRC[1]).kind, 'fix-pending');
  // A moved line beats everything. The decision is not about this function.
  assert.equal(functionDecisionState(held, fn, 3, 'def g(x, y):').kind, 'stale');

  // What the person reads. None of these says fixed.
  assert.equal(functionDecisionSentence({ kind: 'unverified', decision: gated, why: 'not-compared' }), 'This function is within your limit now, after your request on 2026-09-06. DeepTest has not compared it against what it did beforehand, so it is not confirmed yet. Run your tests again.');
  assert.equal(functionDecisionSentence({ kind: 'unverified', decision: ungateable, why: 'not-recorded' }), 'This function is within your limit now, after your request on 2026-09-06. DeepTest could not record what it did beforehand, so it cannot tell you whether it still does the same thing. Check it yourself.');
  assert.match(functionDecisionSentence({ kind: 'behaviour-changed', decision: broke, sentence: 'It returns something else now.' }), /does not do what it did/);
  assert.equal(functionDecisionSentence({ kind: 'fixed', decision: held }), 'Fixed after your request on 2026-09-06. It is within your limit now. It still does what it did.');
});

/**
 * The record a kept recording is filed under. `sha1(path + name)` was
 * considered and rejected: two functions of one name in a file collide
 * under it, and a rename breaks the pairing with nothing to show.
 */
test('behaviour gate: the kept recording is keyed by the decision that was authorized', () => {
  assert.equal(decisionKey('src/a.ts', 12), 'function:src/a.ts:12');
  // Same file, two functions: different keys.
  assert.notEqual(decisionKey('src/a.ts', 12), decisionKey('src/a.ts', 40));
  // Same line, two files: different keys.
  assert.notEqual(decisionKey('src/a.ts', 12), decisionKey('src/b.ts', 12));
  // The name plays no part, so renaming the function does not orphan it.
  assert.equal(decisionKey('src/a.ts', 12), decisionKey('src/a.ts', 12));
});
