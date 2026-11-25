/**
 * `finding.explain`: five conditions, one interaction, and one distinction
 * that has to survive every one of them.
 *
 * **The finding happened. Why it happened is not established.** Those are
 * two different facts, and `insufficient-evidence` / `unclassified` says
 * only the second. A model handed the word "unclassified" and nothing else
 * will reach for the familiar reading, that the measurement may be wrong,
 * and hedge a check that worked perfectly. The person then learns nothing.
 * Every test below is some form of that one rule.
 *
 * The other half is the registry. One semantic id serves all five
 * conditions, because the id names the action and the condition names what
 * was measured. Five ids would put the occasion in the identity, which is
 * what rule 91 warns against.
 */
import { test, beforeEach } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CAUSE_NOT_ESTABLISHED,
  FINDING_CONDITIONS,
  NOTHING_TO_VERIFY,
  NO_AUTHORIZATION_NEEDED,
  ONE_CORRECTION,
  buildPrompt,
  clearRegistryForTests,
  findingConstraints,
  findingPacket,
  isFindingCondition,
  parseResponse,
  reconcileConstraints,
  registerInteraction,
  toProblemPacket,
} from '../src/index';
import type { FindingCondition, GovernancePacket, InteractionSpec } from '../src/index';

const ID = 'finding.explain';

beforeEach(() => {
  clearRegistryForTests();
});

/** The one registration, exactly as both products register it. */
function register(): InteractionSpec {
  return registerInteraction({
    id: ID,
    tool: 'DeepTest',
    title: 'Explain a finding a completed measurement produced.',
    objective: 'explain',
    allowed: { readable: [], proposable: [], mayPropose: false },
    constraints: ['C4'],
    validators: ['V-forbidden-paths', 'V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: NO_AUTHORIZATION_NEEDED,
    verification: NOTHING_TO_VERIFY,
  } as unknown as InteractionSpec);
}

/**
 * One packet per condition, each carrying a measured detail unique enough
 * that a test can look for it by name.
 */
const MEASURED: Readonly<Record<FindingCondition, { text: string; known: string; headline: string }>> = Object.freeze({
  'behaviour-changed': { text: 'total() returned 12 before and 14 after, for the same arguments.', known: '7 calls were compared and one disagreed.', headline: 'total() does not do what it did.' },
  'behaviour-insufficient': { text: 'The comparator reported: unstable-pairing.', known: 'The comparison ran and stopped short of a verdict.', headline: 'No verdict on total().' },
  'decision-unverified': { text: 'The gate watched this method and the second recording has not happened yet.', known: 'Unverified means the confirmation has not happened.', headline: 'The fix to total() is not confirmed.' },
  'coverage-unreachable': { text: 'The lines are 41, 42, 43.', known: 'No test can cover these lines.', headline: '3 lines in src/pricing.ts can never run.' },
  'coverage-density-shortfall': { text: 'Line 12 of src/pricing.ts has 4 ways through it and 1 test reaching it.', known: 'Both numbers were measured.', headline: 'Line 12 has fewer tests than ways through it.' },
});

function packetFor(condition: FindingCondition): GovernancePacket {
  const m = MEASURED[condition];
  return findingPacket({
    condition,
    measured: [{ text: m.text, source: 'witness' }],
    headline: m.headline,
    known: [m.known],
  });
}

// ---------------------------------------------------------------------------
// 1. The measured finding is preserved exactly
// ---------------------------------------------------------------------------

test('every condition carries its measured fact through the packet unchanged', () => {
  for (const condition of FINDING_CONDITIONS) {
    const packet = packetFor(condition);
    const m = MEASURED[condition];
    assert.equal(packet.classification.condition, condition, 'the condition names the finding that occurred');
    assert.deepEqual(packet.evidence.map((e) => e.text), [m.text], 'verbatim, not summarised');
    assert.deepEqual([...packet.known], [m.known]);
    assert.equal(packet.headline, m.headline);
    assert.equal(packet.evidence[0].origin, 'measurement', 'measured, not read out of somebody`s output');
  }
});

test('the measured fact survives the 1.0.19 view as well', () => {
  for (const condition of FINDING_CONDITIONS) {
    const view = toProblemPacket(packetFor(condition));
    assert.equal(view.condition, condition);
    assert.deepEqual(view.evidence, [MEASURED[condition].text]);
  }
});

test('a finding with nothing measured, or nothing known, is refused rather than built', () => {
  assert.throws(() => findingPacket({ condition: 'behaviour-changed', measured: [], headline: 'x', known: ['y'] }), /not a finding/);
  assert.throws(() => findingPacket({ condition: 'behaviour-changed', measured: [{ text: 'x', source: 'witness' }], headline: 'x', known: [] }), /pure uncertainty/);
});

// ---------------------------------------------------------------------------
// 2. The causal classification stays unclassified
// ---------------------------------------------------------------------------

test('every condition is insufficient-evidence and unclassified, and none names a cause', () => {
  for (const condition of FINDING_CONDITIONS) {
    const packet = packetFor(condition);
    assert.equal(packet.classification.failureClass, 'insufficient-evidence');
    assert.equal(packet.classification.confidence, 'unclassified');
    assert.equal(packet.classification.label, 'measured finding');
    assert.deepEqual([...packet.remediation], [], 'a cause nobody established has no remedy the toolkit stands behind');
    assert.deepEqual([...packet.unknown], [CAUSE_NOT_ESTABLISHED]);
  }
});

test('what is unknown is the cause, and never the finding', () => {
  assert.match(CAUSE_NOT_ESTABLISHED, /^Why this happened\./, 'the cause is what is open');
  for (const condition of FINDING_CONDITIONS) {
    for (const u of packetFor(condition).unknown) {
      assert.doesNotMatch(u, /whether .* (happened|occurred)|may not have|might not have|if it happened/i, `"${u}" would put the measurement in doubt`);
    }
  }
});

test('the caller cannot choose the class: it is written in one place', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'governance', 'finding.ts'), 'utf8');
  assert.match(source, /failureClass: 'insufficient-evidence'/);
  assert.doesNotMatch(source, /failureClass: input\.|confidence: input\.|classification: input\./, 'no caller supplies a classification');
});

// ---------------------------------------------------------------------------
// 3. The prompt distinguishes what happened from why
// ---------------------------------------------------------------------------

test('the prompt states the finding as established and the cause as open', () => {
  const spec = register();
  for (const condition of FINDING_CONDITIONS) {
    const packet = packetFor(condition);
    const text = buildPrompt(packet, spec, reconcileConstraints(spec, packet)).text;
    assert.match(text, /was MEASURED and it happened\. Treat it as established\./, condition);
    assert.match(text, /What is NOT established is why it happened/, condition);
    assert.match(text, /do not suggest the finding itself may be wrong or may not have occurred/, condition);
    assert.match(text, new RegExp(`- Finding: ${condition}`), condition);
    assert.match(text, /- The finding itself: measured, and established\./, condition);
    assert.match(text, /- The cause of the finding: not established\./, condition);
  }
});

test('the prompt does not tell the model the checks failed to match, which is the failure wording', () => {
  const spec = register();
  const text = buildPrompt(packetFor('behaviour-changed'), spec, reconcileConstraints(spec, packetFor('behaviour-changed'))).text;
  assert.doesNotMatch(text, /The checks that ran did not match it/, 'that sentence is for a failure nobody could place, not for a measurement that worked');
  assert.match(text, /## What the toolkit measured/, 'and the heading says measured rather than established');
});

test('the constraints carry the same distinction, on every condition', () => {
  for (const condition of FINDING_CONDITIONS) {
    const ids = findingConstraints(condition).map((c) => c.id);
    assert.equal(ids.length, 5, `${condition}: its own, then the four shared`);
    assert.deepEqual(ids.slice(1), ['X-FIND-1', 'X-FIND-2', 'X-FIND-3', 'X-FIND-4'], 'the shared four, in order');
    assert.match(ids[0], /^X-FIND-[A-Z-]+$/, 'and its own first');
    const shared = findingConstraints(condition)[1];
    assert.match(shared.prose, /The finding below was measured and it happened\./);
    assert.match(shared.prose, /Do not present the finding itself as uncertain/);
    for (const c of findingConstraints(condition)) {
      assert.equal(c.rule.kind, 'advisory', 'an explain interaction has no change set to decide any of them against');
      assert.equal(c.decidedBy, undefined);
    }
  }
});

test('the packet carries those constraints, and reconciliation adds the standing floor', () => {
  const spec = register();
  const packet = packetFor('coverage-density-shortfall');
  const effective = reconcileConstraints(spec, packet);
  const ids = effective.constraints.map((c) => c.id);
  assert.ok(ids.includes('C4'), 'the standing floor the interaction registers');
  for (const c of findingConstraints('coverage-density-shortfall')) {
    assert.ok(ids.includes(c.id), `${c.id} travelled`);
  }
});

// ---------------------------------------------------------------------------
// 4 and 5. Nothing the model returns can move the class, the condition, or a file
// ---------------------------------------------------------------------------

const GOOD = JSON.stringify({ kind: 'explain', whatIsWrong: 'The method behaves differently.', whyItHappened: 'Not established.', howToFix: null, whatNotToChange: [], citedEvidence: [0] });

test('a well-formed explanation is accepted and carries no field that could reclassify', () => {
  for (const condition of FINDING_CONDITIONS) {
    const packet = packetFor(condition);
    const parsed = parseResponse(GOOD, packet);
    assert.equal(parsed.ok, true, condition);
    const keys = Object.keys(parsed.ok ? parsed.value : {});
    assert.deepEqual(keys.sort(), ['citedEvidence', 'howToFix', 'kind', 'whatIsWrong', 'whatNotToChange', 'whyItHappened'], 'no condition, no class, no confidence');
    // And the packet is untouched by parsing it.
    assert.equal(packet.classification.condition, condition);
    assert.equal(packet.classification.confidence, 'unclassified');
  }
});

test('a response claiming a class or a different condition cannot express it, so it is simply ignored', () => {
  const packet = packetFor('behaviour-changed');
  const sneaky = JSON.stringify({
    kind: 'explain',
    whatIsWrong: 'x',
    whyItHappened: 'y',
    howToFix: null,
    whatNotToChange: [],
    citedEvidence: [0],
    classification: { failureClass: 'source', confidence: 'classified' },
    condition: 'coverage-unreachable',
  });
  const parsed = parseResponse(sneaky, packet);
  assert.equal(parsed.ok, true, 'the extra fields are not an error, because the parser does not read them');
  assert.equal(Object.prototype.hasOwnProperty.call(parsed.ok ? parsed.value : {}, 'classification'), false, 'and they do not survive parsing');
  assert.equal(Object.prototype.hasOwnProperty.call(parsed.ok ? parsed.value : {}, 'condition'), false);
  assert.equal(packet.classification.failureClass, 'insufficient-evidence', 'the packet is the record, and it did not move');
});

test('an unclassified finding may not come back with a fix, because a fix names a cause', () => {
  for (const condition of FINDING_CONDITIONS) {
    const withFix = JSON.stringify({ kind: 'explain', whatIsWrong: 'x', whyItHappened: 'y', howToFix: 'Change line 12.', whatNotToChange: [], citedEvidence: [0] });
    const parsed = parseResponse(withFix, packetFor(condition));
    assert.equal(parsed.ok, false, condition);
    assert.ok(!parsed.ok && parsed.problems.some((p) => /howToFix must be null/.test(p)));
  }
});

test('a change set is not accepted, because the envelope has nowhere to put one', () => {
  for (const condition of FINDING_CONDITIONS) {
    const packet = packetFor(condition);
    assert.equal(packet.responseShape, 'explain-envelope');
    assert.equal(packet.allowed.mayPropose, false);
    assert.deepEqual([...packet.allowed.proposable], []);
    assert.deepEqual([...packet.allowed.readable], []);
    const proposal = JSON.stringify({ kind: 'propose', edits: [{ path: 'src/pricing.ts', operation: 'modify', before: 'a', after: 'b' }], claims: { perEdit: [] } });
    const parsed = parseResponse(proposal, packet);
    assert.equal(parsed.ok, false, `${condition}: a proposal is not an explanation`);
    assert.ok(!parsed.ok && parsed.problems.some((p) => /not an explain response/.test(p)));
  }
});

// ---------------------------------------------------------------------------
// 6. One registration serves all five
// ---------------------------------------------------------------------------

test('one interaction carries every condition, and there is no second id', () => {
  const spec = register();
  assert.equal(spec.id, ID);
  assert.equal(spec.objective, 'explain');
  assert.equal(spec.allowed.mayPropose, false);
  assert.equal(spec.authorization.kind, NO_AUTHORIZATION_NEEDED.kind, 'no authorization boundary');
  assert.equal(spec.verification.kind, NOTHING_TO_VERIFY.kind, 'nothing to verify, because nothing changes');
  for (const condition of FINDING_CONDITIONS) {
    const packet = packetFor(condition);
    assert.doesNotThrow(() => reconcileConstraints(spec, packet), `${condition} reconciles against the one registration`);
  }
});

test('the five conditions are these five, and the set is what decides a finding from a failure', () => {
  assert.deepEqual([...FINDING_CONDITIONS], ['behaviour-changed', 'behaviour-insufficient', 'decision-unverified', 'coverage-unreachable', 'coverage-density-shortfall']);
  for (const condition of FINDING_CONDITIONS) {
    assert.equal(isFindingCondition(condition), true);
  }
  for (const notAFinding of ['path-character', 'unclassified', 'instrumented-nothing', 'broken-boundary', 'records-missing', 'run-refusal']) {
    assert.equal(isFindingCondition(notAFinding), false, `${notAFinding} belongs to failure.explain`);
  }
});

test('a failure packet still gets the failure wording, not the finding wording', () => {
  const spec = register();
  const failure = findingPacket({ condition: 'behaviour-changed', measured: [{ text: 'x', source: 'witness' }], headline: 'h', known: ['k'] });
  const text = buildPrompt(failure, spec, reconcileConstraints(spec, failure)).text;
  assert.match(text, /Treat it as established/, 'this one is a finding');
  // And the branch is decided by the condition, not by the confidence alone,
  // which is what keeps an unclassified failure out of it.
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'governance', 'prompt.ts'), 'utf8');
  assert.match(source, /!classified && isFindingCondition\(packet\.classification\.condition\)/);
});
