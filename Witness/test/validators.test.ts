/**
 * The validators, one mutation each, and the repository boundary.
 *
 * Every test here is a way a governed proposal could be accepted while
 * breaking something, or refused while breaking nothing. The second failure
 * matters as much as the first: a validator that failed everything would
 * pass a test written only for violations, and it would make O-5 impossible
 * to build in Phase 5.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { STANDING_CONSTRAINTS, coverageOf, bindingFor, memoryRepository, nodeRepository, validatorFor, UNREADABLE, buildPacket, ONE_CORRECTION, USER_AUTHORIZES_ATTEMPT } from '../src/index';
import { scopedC3 } from './support/constraints';
import type { Constraint, GovernancePacket, ProposedEdit, ValidatorOutcome } from '../src/index';

// ---------------------------------------------------------------------------

function packetFor(constraints: readonly Constraint[]): GovernancePacket {
  // A packet carries at least one constraint, so when filtering leaves none
  // C4 stands in. It is inert here: these tests run one named validator
  // directly over the `constraints` they pass, not over the packet's.
  const carried = constraints.filter((c) => bindingFor(c.rule) === undefined);
  const packetConstraints = carried.length > 0 ? carried : [STANDING_CONSTRAINTS.C4];
  return buildPacket({
    evidence: [{ origin: 'measurement', text: 'total() has 9 ways through; the limit is 5.', source: 'complexity' }],
    classification: { failureClass: 'source', condition: 'over-limit', confidence: 'classified', label: 'source' },
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: ['src/pricing.ts'], mayPropose: true },
    constraints: [...packetConstraints],
    validators: [...new Set([...constraints, ...packetConstraints].map((c) => c.decidedBy).filter((v): v is NonNullable<typeof v> => v !== undefined))],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: { kind: 're-measure', measurements: ['behaviour-equivalence'], target: { kind: 'function', path: 'src/pricing.ts', name: 'total', startLine: 1 } },
    runner: 'vitest',
    headline: 'Break total() into smaller pieces without changing what it does.',
    known: ['total() has 9 ways through it, and your limit is 5.'],
    offers: ['fix'],
  });
}

function run(id: Parameters<typeof validatorFor>[0], constraints: readonly Constraint[], changeSet: ProposedEdit[], extra: Record<string, unknown> = {}): ValidatorOutcome {
  return validatorFor(id).run({ packet: packetFor(constraints), constraints, response: { kind: 'propose', changeSet }, ...extra });
}

const PRICING = 'export function total(a: number, b: number): number {\n  return a + b;\n}\n';

// ---------------------------------------------------------------------------
// C1
// ---------------------------------------------------------------------------

/**
 * C1's structural cases moved to `additive.test.ts` in Phase 5, where they
 * run against a real parser over real framework shapes. What stays here is
 * the part that belongs beside the other validators: a create always passes,
 * and a modify with no parser fails closed rather than guessing.
 */
test('C1: a new test file passes, which is the thing C1 exists to allow', () => {
  const added = run('V-existing-tests', [STANDING_CONSTRAINTS.C1], [{ path: 'src/total.test.ts', operation: 'create', after: 'it("adds", () => {});' }]);
  assert.equal(added.verdict, 'pass', 'O-5 needs this');
});

test('C1: a modify with no parser is invalid/evidence, never a pass and never a violation', () => {
  // Phase 4 refused every modify of a test file on the path alone. Phase 5
  // proves the change additive instead, which needs a parser, so the honest
  // answer without one is that Polyglot could not check (rule 94). A pass
  // here would be the permissive failure C1 exists to prevent, and a fail
  // would accuse a proposal of something nobody looked at.
  const outcome = run('V-existing-tests', [STANDING_CONSTRAINTS.C1], [{ path: 'src/total.test.ts', operation: 'modify', before: 'a', after: 'it("adds", () => {});' }]);
  assert.equal(outcome.verdict, 'invalid');
  if (outcome.verdict === 'invalid') {
    assert.equal(outcome.cause, 'evidence');
  }
  assert.equal('constraint' in outcome, false, 'nothing is accused of violating anything');
});

test('C1: the prose says what the rule enforces, and names what it does not', () => {
  assert.equal(
    STANDING_CONSTRAINTS.C1.prose,
    'Do not change any test that is already there. You may add a new test to an existing test file, and you may add a new test file. You may not add anything but a test.',
  );
  const rule = STANDING_CONSTRAINTS.C1.rule;
  assert.equal(rule.kind, 'tests-additive-only');
  // The residue is stated in the rule, in the person's words, because the
  // authorization brief renders it to them directly (rule 92).
  assert.ok(rule.kind !== 'advisory' && rule.unchecked && /while the tests run/.test(rule.unchecked));
});

test('C1: an ordinary source file is not a test file', () => {
  const ok = run('V-existing-tests', [STANDING_CONSTRAINTS.C1], [{ path: 'src/pricing.ts', operation: 'modify', before: 'a + b', after: 'a + b + 0' }]);
  assert.equal(ok.verdict, 'pass');
  // And the segment rule, so `__tests__` in a filename is not a directory.
  const notADir = run('V-existing-tests', [STANDING_CONSTRAINTS.C1], [{ path: 'src/my__tests__helper.ts', operation: 'modify', before: 'x', after: 'y' }]);
  assert.equal(notADir.verdict, 'pass');
});

// ---------------------------------------------------------------------------
// C3
// ---------------------------------------------------------------------------

test('C3: a path outside the authorized scope fails, when scope is available', () => {
  const c = [scopedC3(['src/pricing.ts'])];
  const inside = run('V-scope-paths', c, [{ path: 'src/pricing.ts', operation: 'modify', before: 'a', after: 'b' }]);
  assert.equal(inside.verdict, 'pass');

  const outside = run('V-scope-paths', c, [{ path: 'src/billing.ts', operation: 'modify', before: 'a', after: 'b' }]);
  assert.equal(outside.verdict, 'fail');
  if (outside.verdict === 'fail') {
    assert.equal(outside.constraint, 'C3');
  }
});

test('C3: a folder in the scope permits what is under it, by segment', () => {
  const c = [scopedC3(['src/**'])];
  assert.equal(run('V-scope-paths', c, [{ path: 'src/deep/thing.ts', operation: 'create', after: 'x' }]).verdict, 'pass');
  assert.equal(run('V-scope-paths', c, [{ path: 'srcfoo/thing.ts', operation: 'create', after: 'x' }]).verdict, 'fail', 'srcfoo is not under src');
});

// ---------------------------------------------------------------------------
// C4, unchanged
// ---------------------------------------------------------------------------

test('C4: the tool folders still fail and the look-alikes still pass', () => {
  const c = [STANDING_CONSTRAINTS.C4];
  // The cases that moved with the file. Their answers must not have moved.
  for (const p of ['.keepsafe/checkpoints/x', '.deeptest/runs.json', '.untangleit/state.json', '.KeepSafe/x', 'a\\.keepsafe\\b', 'src/../.keepsafe/checkpoints/x']) {
    const outcome = run('V-forbidden-paths', c, [{ path: p, operation: 'create', after: 'x' }]);
    assert.equal(outcome.verdict, 'fail', `${p} is inside a tool folder`);
    if (outcome.verdict === 'fail') {
      assert.equal(outcome.constraint, 'C4');
    }
  }
  for (const p of ['src/dotdeeptest-notes.md', 'docs/.deeptest-format.md']) {
    assert.equal(run('V-forbidden-paths', c, [{ path: p, operation: 'create', after: 'x' }]).verdict, 'pass', `${p} merely contains the text`);
  }
});

// ---------------------------------------------------------------------------
// C8
// ---------------------------------------------------------------------------

test('C8: refusing and proposing at once fails, and so does answering nothing', () => {
  const c = [STANDING_CONSTRAINTS.C8];
  const both = validatorFor('V-refusal-wellformed').run({
    packet: packetFor(c),
    constraints: c,
    response: { kind: 'propose', changeSet: [{ path: 'src/pricing.ts', operation: 'create', after: 'x' }], refusal: { reason: 'cannot be done' } },
  });
  assert.equal(both.verdict, 'fail');

  const neither = run('V-refusal-wellformed', c, []);
  assert.equal(neither.verdict, 'fail');
  if (neither.verdict === 'fail') {
    assert.equal(neither.constraint, 'C8');
  }

  const refused = validatorFor('V-refusal-wellformed').run({
    packet: packetFor(c),
    constraints: c,
    response: { kind: 'propose', changeSet: [], refusal: { reason: 'The limits do not allow it.' } },
  });
  assert.equal(refused.verdict, 'pass');
  // And it says what it did not decide, so nobody reads C8 as fully enforced.
  assert.match(refused.because ?? '', /not decided here/);
});

// ---------------------------------------------------------------------------
// Response validity and containment
// ---------------------------------------------------------------------------

test('a path that escapes the workspace is invalid, and names no constraint', () => {
  const repository = memoryRepository('/project', { 'src/pricing.ts': PRICING }, { 'linked': '../outside' });
  for (const p of ['/etc/passwd', 'C:\\Windows\\system32\\x.dll', '../outside/thing.ts', 'linked/thing.ts']) {
    const outcome = run('V-response-shape', [STANDING_CONSTRAINTS.C4], [{ path: p, operation: 'create', after: 'x' }], { repository });
    assert.equal(outcome.verdict, 'invalid', `${p} is not a usable workspace-relative path`);
    if (outcome.verdict === 'invalid') {
      assert.equal(outcome.cause, 'response');
      assert.equal((outcome as { constraint?: string }).constraint, undefined, 'containment is response validity, not C4');
    }
  }
});

test('a new file under a directory that does not exist yet is contained through its parent', () => {
  const repository = memoryRepository('/project', { 'src/pricing.ts': PRICING });
  const outcome = run('V-response-shape', [STANDING_CONSTRAINTS.C4], [{ path: 'src/new/deep/thing.test.ts', operation: 'create', after: 'x' }], { repository });
  assert.equal(outcome.verdict, 'pass', 'a create must not be refused for naming a file that is not there yet');
});

test('a before that does not match is the response\'s fault; an unreadable file is not', () => {
  const repository = memoryRepository('/project', { 'src/pricing.ts': PRICING, 'src/locked.ts': UNREADABLE });

  const mismatch = run('V-response-shape', [STANDING_CONSTRAINTS.C4], [{ path: 'src/pricing.ts', operation: 'modify', before: 'nowhere in the file', after: 'x' }], { repository });
  assert.equal(mismatch.verdict, 'invalid');
  if (mismatch.verdict === 'invalid') {
    assert.equal(mismatch.cause, 'response', 'the model described a file it got wrong, and it can send another answer');
  }

  const unreadable = run('V-response-shape', [STANDING_CONSTRAINTS.C4], [{ path: 'src/locked.ts', operation: 'modify', before: 'anything', after: 'x' }], { repository });
  assert.equal(unreadable.verdict, 'invalid');
  if (unreadable.verdict === 'invalid') {
    assert.equal(unreadable.cause, 'evidence', 'nothing the model writes makes our file readable');
  }

  const good = run('V-response-shape', [STANDING_CONSTRAINTS.C4], [{ path: 'src/pricing.ts', operation: 'modify', before: 'a + b', after: 'a + b + 0' }], { repository });
  assert.equal(good.verdict, 'pass');
});

test('a create naming a file that already exists is refused', () => {
  const repository = memoryRepository('/project', { 'src/pricing.ts': PRICING });
  const outcome = run('V-response-shape', [STANDING_CONSTRAINTS.C4], [{ path: 'src/pricing.ts', operation: 'create', after: 'everything else is gone' }], { repository });
  assert.equal(outcome.verdict, 'invalid', 'creating over a file would replace all of it, silently');
});

test('the repository refuses an escaping read on its own, and both implementations agree', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'witness-repo-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'pricing.ts'), PRICING);
  const real = nodeRepository(root);
  const fake = memoryRepository(root, { 'src/pricing.ts': PRICING });

  for (const p of ['../outside.ts', '/etc/passwd', '']) {
    const a = real.read(p);
    const b = fake.read(p);
    assert.equal(a.ok, false, `${p} refused by nodeRepository`);
    assert.equal(b.ok, false, `${p} refused by memoryRepository`);
    if (!a.ok && !b.ok) {
      assert.equal(a.reason, b.reason, `${p}: the test double must not be more permissive than the real thing`);
    }
  }
  assert.equal(real.read('src/pricing.ts').ok, true);
  assert.equal(fake.read('src/pricing.ts').ok, true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('the repository has no way to write', () => {
  const fake = memoryRepository('/project', {});
  for (const name of ['write', 'writeFile', 'apply', 'save', 'create', 'delete', 'mkdir']) {
    assert.equal(name in fake, false, `RepositoryPort must not grow a ${name}: it validates a proposal, it does not apply one`);
  }
});

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

test('what the model says about its own compliance cannot save it', () => {
  // The claim is not even in the type a validator receives, so this is
  // really a test that the change set is what decides. It is worth having
  // anyway: it is the case somebody would try.
  const outcome = run('V-forbidden-paths', [STANDING_CONSTRAINTS.C4], [{ path: '.keepsafe/notes.md', operation: 'create', after: 'x' }]);
  assert.equal(outcome.verdict, 'fail');
  if (outcome.verdict === 'fail') {
    assert.equal(outcome.constraint, 'C4');
  }
});

// ---------------------------------------------------------------------------
// Coverage, derived
// ---------------------------------------------------------------------------

test('coverage comes from the constraint and the registry, not from a list somebody wrote', () => {
  assert.equal(coverageOf(STANDING_CONSTRAINTS.C4), 'checked');
  // C1 became partly-checked in Phase 5, and that is the refinement being
  // honest rather than a regression. The structural rule proves nothing in
  // the file's shared scope changed; it cannot prove a new test will not
  // affect an existing one while the tests run, and the rule's `unchecked`
  // says so in the person's words.
  assert.equal(coverageOf(STANDING_CONSTRAINTS.C1), 'partly-checked');
  assert.equal(coverageOf(STANDING_CONSTRAINTS.C2), 'partly-checked');
  assert.equal(coverageOf(STANDING_CONSTRAINTS.C8), 'partly-checked');
  for (const id of ['C5', 'C6', 'C7'] as const) {
    assert.equal(coverageOf(STANDING_CONSTRAINTS[id]), 'stated-only', `${id} is advisory`);
  }

  // The case that proves it reads the registry: a constraint naming a
  // validator that has no body is stated-only, whatever it would like to be.
  const declaredButUnbuilt: Constraint = Object.freeze({
    id: 'X-MADE-UP',
    rule: Object.freeze({ kind: 'paths-forbidden', deny: ['x'] }),
    decidedBy: 'V-contradiction',
    prose: 'A constraint naming a validator nobody built.',
  }) as Constraint;
  assert.equal(coverageOf(declaredButUnbuilt), 'stated-only');
});
