/**
 * The offer to explain a finding, where the finding already is.
 *
 * **The rule this holds in place**: the deterministic product decides that a
 * finding exists and builds the packet; the panel only offers to explain one
 * that is already established. The offer is a button beside a finding the
 * person can already see, the message it posts carries a content-free handle
 * and nothing else, and the handler looks the handle up rather than
 * rebuilding anything from what was on screen. If the panel could describe a
 * finding back to the extension, the interface would be a place a finding
 * could be asserted from, and every measurement in the toolkit would be one
 * step less trustworthy.
 *
 * The other half is rule 42. With no model the offer is not there, and the
 * finding is exactly as it was: same sentence, same numbers, same buttons.
 *
 * These are source and unit assertions because the panel and the store both
 * import `vscode`, which does not exist outside the editor. What can be
 * proved without it is proved without it.
 */
import { test, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { clearFindingsForTests, collectFindings, handleFor, packetForHandle, setAvailability } from '../src/agent/findingOffers';
import type { DecidedFunction, Decision } from '../src/decisions/decisions';
import type { AnalysisResult } from '../src/engine/types';

const SRC = path.join(__dirname, '..', 'src');
const read = (...p: string[]): string => fs.readFileSync(path.join(SRC, ...p), 'utf8');
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const VIEW = read('ui', 'sidebarView.ts');
const EXTENSION = read('extension.ts');
const STORE = read('agent', 'findingOffers.ts');

const decision = (over: Partial<Decision> = {}): Decision => ({ path: 'src/pricing.ts', line: 12, functionName: 'total', ...over }) as Decision;

function decided(state: DecidedFunction['state'], startLine = 12): DecidedFunction {
  return { path: 'src/pricing.ts', fn: { startLine } as DecidedFunction['fn'], state };
}

function result(over: Partial<AnalysisResult> = {}): AnalysisResult {
  return { files: [], shortfalls: [], summary: {} as AnalysisResult['summary'], ...over } as AnalysisResult;
}

beforeEach(() => {
  clearFindingsForTests();
  setAvailability(true);
});

// ---------------------------------------------------------------------------
// 1. Every reachable condition gets the offer, at the surface it already has
// ---------------------------------------------------------------------------

test('a behaviour that changed is offered at the function row that already says so', () => {
  const changed = decision({ behaviour: { verdict: 'changed', compared: 7, sentence: 'total() does not behave the same.' } });
  collectFindings(result(), [decided({ kind: 'behaviour-changed', decision: changed, sentence: 'total() does not behave the same.' })]);
  const handle = handleFor({ kind: 'function', path: 'src/pricing.ts', startLine: 12 });
  assert.ok(handle, 'there is an offer');
  assert.equal(packetForHandle(handle!)!.classification.condition, 'behaviour-changed');
  assert.match(VIEW, /findingHandle\(\{ kind: 'function', path: hardest\.path, startLine: hardest\.startLine \}\)/, 'and the row asks for it');
});

test('a fix that is not confirmed is offered at the same row, in all three of its reasons', () => {
  for (const why of ['not-recorded', 'not-compared', 'insufficient'] as const) {
    clearFindingsForTests();
    setAvailability(true);
    collectFindings(result(), [decided({ kind: 'unverified', decision: decision(), why })]);
    const handle = handleFor({ kind: 'function', path: 'src/pricing.ts', startLine: 12 });
    assert.ok(handle, why);
    assert.equal(packetForHandle(handle!)!.classification.condition, 'decision-unverified');
  }
});

test('a density shortfall is offered on the card that already shows it', () => {
  collectFindings(result({ shortfalls: [{ path: 'src/pricing.ts', line: 12, density: 1, bar: 4, gap: 3, status: 'short' }] }), []);
  const handle = handleFor({ kind: 'line', path: 'src/pricing.ts', line: 12 });
  assert.ok(handle);
  assert.equal(packetForHandle(handle!)!.classification.condition, 'coverage-density-shortfall');
  assert.match(VIEW, /data-act="fix"[\s\S]{0,400}explainFinding\(this\.findingHandle\(\{ kind: 'line'/, 'in the card`s own action row, beside Fix this');
});

test('unreachable code is offered in the block that already lists it', () => {
  collectFindings(result({ files: [{ path: 'src/pricing.ts', unreachableLines: [41, 42] }] as AnalysisResult['files'] }), []);
  const handle = handleFor({ kind: 'file', path: 'src/pricing.ts' });
  assert.ok(handle);
  assert.equal(packetForHandle(handle!)!.classification.condition, 'coverage-unreachable');
  assert.match(VIEW, /Code that can never run[\s\S]{0,300}unreachableOffer/, 'in the same details block');
});

test('a decision that is not a finding is offered nothing', () => {
  collectFindings(result(), [decided({ kind: 'none' })]);
  assert.equal(handleFor({ kind: 'function', path: 'src/pricing.ts', startLine: 12 }), undefined, 'no finding, no offer');
});

// ---------------------------------------------------------------------------
// 2 and 8. The packet is the built one, and nothing describes it back
// ---------------------------------------------------------------------------

test('the handle leads to the packet the product built, not to a rebuilt one', () => {
  collectFindings(result({ shortfalls: [{ path: 'src/pricing.ts', line: 12, density: 1, bar: 4, gap: 3, status: 'short' }] }), []);
  const packet = packetForHandle(handleFor({ kind: 'line', path: 'src/pricing.ts', line: 12 })!)!;
  assert.ok(packet.evidence.some((e) => /4 ways through it and 1 test reaching it/.test(e.text)), 'the engine`s own numbers');
  assert.equal(packet.classification.failureClass, 'insufficient-evidence');
  assert.equal(packet.classification.confidence, 'unclassified');
});

test('the handle is content-free, and a message carries nothing else about the finding', () => {
  collectFindings(result({ shortfalls: [{ path: 'src/pricing.ts', line: 12, density: 1, bar: 4, gap: 3, status: 'short' }] }), []);
  const handle = handleFor({ kind: 'line', path: 'src/pricing.ts', line: 12 })!;
  assert.match(handle, /^[0-9a-f-]{36}$/, 'a random id, not a path, a line, a sentence or a number');
  assert.doesNotMatch(handle, /pricing|short|density|12/, 'nothing of the finding is in it');
});

test('no source text and no model output can enter the message', () => {
  // The panel posts what is on a `data-` attribute, and the only new one is
  // the handle. Nothing renders the code, the finding sentence or anything a
  // model wrote into an attribute.
  assert.match(VIEW, /handle: el\.getAttribute\('data-handle'\) \|\| undefined/);
  assert.doesNotMatch(VIEW, /data-sentence|data-finding|data-evidence|data-condition|data-packet|data-code/);
  const message = VIEW.slice(VIEW.indexOf('export interface SidebarMessage'), VIEW.indexOf('const esc ='));
  assert.deepEqual(
    [...message.matchAll(/^\s{2}(\w+)\??:/gm)].map((m) => m[1]).sort(),
    ['handle', 'line', 'path', 'type'],
    'four fields, and the handle is the only one added',
  );
});

test('the handler reads the handle and rebuilds nothing', () => {
  const handler = EXTENSION.slice(EXTENSION.indexOf('const explainFinding ='), EXTENSION.indexOf('const onSidebarMessage ='));
  assert.match(handler, /packetForHandle\(handle\)/, 'it looks the packet up');
  assert.doesNotMatch(code(handler), /behaviourFinding|unreachableFinding|densityShortfallFinding|decisionUnverifiedFinding|findingPacket|buildPacket/, 'and builds nothing');
  assert.doesNotMatch(code(handler), /'behaviour-changed'|'coverage-|'decision-unverified'|failureClass|confidence/, 'and chooses no condition and no class');
  assert.match(handler, /if \(!packet\) \{\s*return;\s*\}/, 'an unknown handle does nothing at all');
});

// ---------------------------------------------------------------------------
// 3, 4 and 5. One handler, no new model transport, no proposal path
// ---------------------------------------------------------------------------

test('one handler serves every condition in this product', () => {
  assert.equal([...EXTENSION.matchAll(/case 'explainFinding':/g)].length, 1, 'one case');
  assert.equal([...EXTENSION.matchAll(/const explainFinding =/g)].length, 1, 'one handler');
  assert.equal([...VIEW.matchAll(/data-act="explainFinding"/g)].length, 1, 'one button template, used at every surface');
});

test('no new model transport and no model selection appears', () => {
  for (const file of ['extension.ts', path.join('agent', 'findingOffers.ts'), path.join('ui', 'sidebarView.ts')]) {
    assert.doesNotMatch(code(read(file)), /selectChatModels|sendRequest|lm\.invoke/, `${file} reaches no model`);
  }
  // The store has no editor in it at all: it is told whether an offer may
  // be made, and the one place that asks `lm.selectChatModels` is where it
  // always was.
  assert.doesNotMatch(code(STORE), /vscode|modelsAvailable|mayOfferAgentic/);
  // Phase 8: the same one question, now answered by the conjunction of the
  // kill switch and the editor rather than by the editor alone.
  assert.match(code(EXTENSION), /setAvailability\(await mayOfferAgentic\(\)\)/);
});

test('the explanation cannot become a proposal', () => {
  collectFindings(result({ shortfalls: [{ path: 'src/pricing.ts', line: 12, density: 1, bar: 4, gap: 3, status: 'short' }] }), []);
  const packet = packetForHandle(handleFor({ kind: 'line', path: 'src/pricing.ts', line: 12 })!)!;
  assert.equal(packet.objective, 'explain');
  assert.equal(packet.responseShape, 'explain-envelope');
  assert.equal(packet.allowed.mayPropose, false);
  assert.deepEqual([...packet.allowed.proposable], []);
  const handler = EXTENSION.slice(EXTENSION.indexOf('const explainFinding ='), EXTENSION.indexOf('const onSidebarMessage ='));
  assert.doesNotMatch(code(handler), /USER_AUTHORIZES|askToAuthorize|setPendingAttempt|proposal|applyEdit/, 'no authorization and no change set on this path');
});

// ---------------------------------------------------------------------------
// 6. No model removes the offer and nothing else
// ---------------------------------------------------------------------------

test('with no model there is no offer, and the finding is untouched', () => {
  collectFindings(result({ shortfalls: [{ path: 'src/pricing.ts', line: 12, density: 1, bar: 4, gap: 3, status: 'short' }] }), []);
  const handle = handleFor({ kind: 'line', path: 'src/pricing.ts', line: 12 })!;
  setAvailability(false);
  assert.equal(handleFor({ kind: 'line', path: 'src/pricing.ts', line: 12 }), undefined, 'the offer is gone');
  assert.ok(packetForHandle(handle), 'the packet is still there; it was the measurement, not the offer');
  // And the button is the only thing an absent handle removes: the template
  // returns an empty string and the row renders as it always did.
  assert.match(VIEW, /handle \? `<button class="small" data-act="explainFinding"[^`]*` : ''/, 'no handle, no button, nothing else changed');
});

test('the handler asks again before it acts, for the window between drawing and pressing', () => {
  const handler = EXTENSION.slice(EXTENSION.indexOf('const explainFinding ='), EXTENSION.indexOf('const onSidebarMessage ='));
  assert.match(handler, /await mayOfferAgentic\(\)/);
  assert.match(handler, /The finding itself is unaffected/, 'and says nothing that changes the finding');
});

// ---------------------------------------------------------------------------
// The boundary that was already there
// ---------------------------------------------------------------------------

test('the panel still depends on nothing in the agent folder', () => {
  assert.doesNotMatch(code(VIEW), /from '[^']*agent\//, 'the handle arrives as an injected string');
  assert.match(VIEW, /private readonly findingHandle:/, 'injected, not imported');
});
