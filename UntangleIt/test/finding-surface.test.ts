/**
 * The offer to explain a finding, where the finding already is.
 *
 * Same rule as DeepTest's, and the same reason: the deterministic product
 * decides that a finding exists and builds the packet, and the panel only
 * offers to explain one that is already established. The message carries a
 * content-free handle and nothing about the finding, so the panel is never a
 * place a finding could be asserted from.
 *
 * The part that is UntangleIt's own: **two of the five conditions, and no
 * pretending at the other three.** The behaviour gate is the measurement
 * this product takes part in. A decision's verification state, unreachable
 * lines and density shortfalls come from an engine it does not have, and
 * there is no affordance for them because there is nothing for one to sit
 * beside.
 */
import { test, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { clearFindingsForTests, collectFindings, handleForRun, packetForHandle, setAvailability } from '../src/agent/findingOffers';
import type { RunFile, RunRecord } from '../src/runs';

const SRC = path.join(__dirname, '..', 'src');
const read = (...p: string[]): string => fs.readFileSync(path.join(SRC, ...p), 'utf8');
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const VIEW = read('ui', 'sidebarView.ts');
const EXTENSION = read('extension.ts');
const STORE = read('agent', 'findingOffers.ts');

function runs(...list: Array<Partial<RunRecord>>): RunFile {
  return { runs: list.map((r, i) => ({ id: `run-${i}`, path: 'src/pricing.ts', name: 'total', startLine: 4, ...r })) } as RunFile;
}

beforeEach(() => {
  clearFindingsForTests();
  setAvailability(true);
});

// ---------------------------------------------------------------------------
// 1. Both reachable conditions get the offer, at the card that already shows them
// ---------------------------------------------------------------------------

test('a behaviour that changed is offered on the run card that already says so', () => {
  collectFindings(runs({ status: 'behaviour-changed', behaviour: { verdict: 'changed', compared: 9, sentence: 'total() does not behave the same.' } }));
  const handle = handleForRun('run-0');
  assert.ok(handle);
  assert.equal(packetForHandle(handle!)!.classification.condition, 'behaviour-changed');
  assert.match(VIEW, /data-act="measureAgain"[\s\S]{0,300}explainFinding\(this\.findingHandle\(r\.id\)\)/, 'in the open run`s own action row');
});

test('a gate that could not reach a verdict is offered on the row that carries its sentence', () => {
  collectFindings(runs({ status: 'within-limit', behaviour: { verdict: 'insufficient', reason: 'never-exercised', sentence: 'No test reached total().' } }));
  const handle = handleForRun('run-0');
  assert.ok(handle);
  assert.equal(packetForHandle(handle!)!.classification.condition, 'behaviour-insufficient');
  assert.match(VIEW, /Untangled so far[\s\S]{0,600}explainFinding\(this\.findingHandle\(r\.id\)\)/, 'in the finished list, where that sentence is shown');
});

test('a run with no finding is offered nothing', () => {
  collectFindings(runs({ status: 'within-limit', behaviour: { verdict: 'equivalent', compared: 3, sentence: 'x' } }, { status: 'sent' }));
  assert.equal(handleForRun('run-0'), undefined, 'equivalent is not a finding');
  assert.equal(handleForRun('run-1'), undefined, 'and a gate that did not run is not one either');
});

// ---------------------------------------------------------------------------
// 7. Only the conditions this product can produce
// ---------------------------------------------------------------------------

test('UntangleIt offers two conditions and invents no affordance for the other three', () => {
  for (const notHere of ['decision-unverified', 'coverage-unreachable', 'coverage-density-shortfall']) {
    assert.doesNotMatch(code(STORE), new RegExp(notHere), `${notHere} has no engine here`);
    assert.doesNotMatch(code(VIEW), new RegExp(notHere));
    assert.doesNotMatch(code(EXTENSION), new RegExp(notHere));
  }
  assert.doesNotMatch(code(STORE), /unreachableFinding|densityShortfallFinding|decisionUnverifiedFinding/, 'and no builder for them is reachable');
});

// ---------------------------------------------------------------------------
// 2, 8. The built packet, and nothing described back
// ---------------------------------------------------------------------------

test('the handle leads to the packet the gate`s verdict produced', () => {
  collectFindings(runs({ behaviour: { verdict: 'changed', compared: 9, sentence: 'total() does not behave the same.' } }));
  const packet = packetForHandle(handleForRun('run-0')!)!;
  assert.ok(packet.evidence.some((e) => e.text === 'total() does not behave the same.'), 'the comparator`s own sentence');
  assert.ok(packet.evidence.some((e) => /9 calls were compared/.test(e.text)));
  assert.equal(packet.classification.failureClass, 'insufficient-evidence');
});

test('the handle is content-free, and the message carries nothing else about the finding', () => {
  collectFindings(runs({ behaviour: { verdict: 'changed', compared: 9, sentence: 's' } }));
  const handle = handleForRun('run-0')!;
  assert.match(handle, /^[0-9a-f-]{36}$/);
  assert.doesNotMatch(handle, /pricing|total|changed/);
  assert.match(VIEW, /handle: el\.getAttribute\('data-handle'\) \|\| undefined/);
  assert.doesNotMatch(VIEW, /data-sentence|data-finding|data-evidence|data-condition|data-packet/);
});

test('the handler reads the handle and rebuilds nothing', () => {
  const handler = EXTENSION.slice(EXTENSION.indexOf('const explainFinding ='), EXTENSION.indexOf('const onSidebarMessage ='));
  assert.match(handler, /packetForHandle\(handle\)/);
  assert.doesNotMatch(code(handler), /behaviourFinding|findingPacket|buildPacket|failureClass|confidence/, 'nothing is built and no class is chosen');
  assert.match(handler, /if \(!packet\) \{\s*return;\s*\}/, 'an unknown handle does nothing');
});

// ---------------------------------------------------------------------------
// 3, 4, 5. One handler, no new model transport, no proposal path
// ---------------------------------------------------------------------------

test('one handler serves both conditions', () => {
  assert.equal([...EXTENSION.matchAll(/case 'explainFinding':/g)].length, 1);
  assert.equal([...EXTENSION.matchAll(/const explainFinding =/g)].length, 1);
  assert.equal([...VIEW.matchAll(/data-act="explainFinding"/g)].length, 1, 'one button template, used at both surfaces');
});

test('no new model transport and no model selection appears', () => {
  for (const file of ['extension.ts', path.join('agent', 'findingOffers.ts'), path.join('ui', 'sidebarView.ts')]) {
    assert.doesNotMatch(code(read(file)), /selectChatModels|sendRequest|lm\.invoke/, `${file} reaches no model`);
  }
  assert.doesNotMatch(code(STORE), /vscode|modelsAvailable/, 'the store has no editor in it');
  assert.match(code(EXTENSION), /setAvailability\(await mayOfferAgentic\(\)\)/, 'and the wiring point asks the one function that may');
});

test('the explanation cannot become a proposal', () => {
  collectFindings(runs({ behaviour: { verdict: 'changed', compared: 1, sentence: 's' } }));
  const packet = packetForHandle(handleForRun('run-0')!)!;
  assert.equal(packet.objective, 'explain');
  assert.equal(packet.responseShape, 'explain-envelope');
  assert.equal(packet.allowed.mayPropose, false);
  assert.deepEqual([...packet.allowed.proposable], []);
  const handler = EXTENSION.slice(EXTENSION.indexOf('const explainFinding ='), EXTENSION.indexOf('const onSidebarMessage ='));
  assert.doesNotMatch(code(handler), /askToAuthorize|setPendingAttempt|USER_AUTHORIZES|applyEdit/, 'no authorization and no change set on this path');
});

// ---------------------------------------------------------------------------
// 6. No model removes the offer and nothing else
// ---------------------------------------------------------------------------

test('with no model there is no offer, and the run reads exactly as it did', () => {
  collectFindings(runs({ behaviour: { verdict: 'changed', compared: 1, sentence: 's' } }));
  const handle = handleForRun('run-0')!;
  setAvailability(false);
  assert.equal(handleForRun('run-0'), undefined, 'the offer is gone');
  assert.ok(packetForHandle(handle), 'the packet is still there; it was the measurement, not the offer');
  assert.match(VIEW, /handle \? `<button class="small" data-act="explainFinding"[^`]*` : ''/, 'no handle, no button, nothing else changed');
});

test('the handler asks again before it acts', () => {
  const handler = EXTENSION.slice(EXTENSION.indexOf('const explainFinding ='), EXTENSION.indexOf('const onSidebarMessage ='));
  assert.match(handler, /await mayOfferAgentic\(\)/);
  assert.match(handler, /The finding itself is unaffected/);
});

test('the panel still depends on nothing in the agent folder', () => {
  assert.doesNotMatch(code(VIEW), /from '[^']*agent\//);
  assert.match(VIEW, /private readonly findingHandle:/, 'injected, not imported');
});
