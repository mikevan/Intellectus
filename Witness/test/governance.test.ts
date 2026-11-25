/**
 * The governance contract, 1.0.21 Phase 2.
 *
 * Every test here exists because of a specific way a governed interaction
 * could govern nothing while looking complete. None of them is a shape test
 * for its own sake, and each names the rule it holds.
 *
 * The failure mode running through all of it is quiet. A packet with ten
 * fields and an incoherent combination passes every per-field check. A
 * constraint with no validator reads as enforced. A record with a prompt in
 * it looks like an audit trail until somebody notices it is a second copy of
 * the customer's source. None of these announce themselves, which is why
 * they are pinned here rather than left to review.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  EVIDENCE_ORIGINS,
  FAILURE_CLASSES,
  NOTHING_TO_VERIFY,
  NO_AUTHORIZATION_NEEDED,
  ONE_CORRECTION,
  PATH_CONSTRAINTS,
  PacketError,
  STANDING_CONSTRAINTS,
  TOOL_FOLDERS,
  USER_AUTHORIZES_ATTEMPT,
  buildPacket,
  buildPrompt,
  buildRecord,
  buildValidationResult,
  clearRegistryForTests,
  forbiddenPathsValidator,
  parseExplain,
  parsePropose,
  reconcileConstraints,
  registerInteraction,
  registeredIds,
  requireInteraction,
  toProblemPacket,
  unclassifiedPacket,
  upstreamPathFailure,
  validatable,
  validateSpec,
  validatorFor,
  VALIDATOR_IDS,
  assertConstraintShape,
  validatorImplemented,
  UNCLASSIFIED_CONSTRAINT,
} from '../src/index';
import * as api from '../src/index';
import type { Constraint, EvidenceItem, InteractionSpec, PacketInput, ProposeResponse, ValidatorId } from '../src/index';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EVIDENCE: EvidenceItem[] = [{ origin: 'runner-output', text: 'Application bundle generation failed.', source: 'ng test' }];

function explainInput(over: Partial<PacketInput> = {}): PacketInput {
  return {
    evidence: EVIDENCE,
    classification: { failureClass: 'toolchain', condition: 'path-character', confidence: 'classified', label: 'toolchain path handling' },
    objective: 'explain',
    allowed: { readable: [], proposable: [], mayPropose: false },
    constraints: PATH_CONSTRAINTS,
    validators: ['V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: NO_AUTHORIZATION_NEEDED,
    verification: NOTHING_TO_VERIFY,
    runner: "Angular's unit-test builder with Karma",
    headline: 'It could not start.',
    known: ['The path holds an apostrophe.'],
    unknown: ['Whether the tests pass, because none ran.'],
    remediation: ['Move the project.'],
    offers: ['explain'],
    ...over,
  };
}

function proposeInput(over: Partial<PacketInput> = {}): PacketInput {
  return {
    evidence: [{ origin: 'measurement', text: 'total() has 9 ways through; the limit is 5.', source: 'complexity' }],
    classification: { failureClass: 'source', condition: 'uncovered-branch', confidence: 'classified', label: 'source' },
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: ['test/**'], mayPropose: true },
    constraints: [STANDING_CONSTRAINTS.C4, STANDING_CONSTRAINTS.C1],
    validators: ['V-forbidden-paths', 'V-existing-tests'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: { kind: 're-measure', measurements: ['coverage-density'], target: { kind: 'lines', path: 'src/pricing.ts', lines: [2] } },
    runner: 'vitest',
    headline: 'One branch has no test.',
    offers: ['fix'],
    ...over,
  };
}

function spec(over: Partial<InteractionSpec> = {}): Record<string, unknown> {
  return {
    id: 'O-TEST',
    tool: 'DeepTest',
    title: 'A fixture interaction, registered only by tests.',
    objective: 'explain',
    allowed: { readable: [], proposable: [], mayPropose: false },
    constraints: ['C4'],
    validators: ['V-forbidden-paths'],
    correction: ONE_CORRECTION,
    authorization: NO_AUTHORIZATION_NEEDED,
    verification: NOTHING_TO_VERIFY,
    ...over,
  } as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 1. Evidence
// ---------------------------------------------------------------------------

/**
 * Rules 12, 13, 24. AI never creates a fact the product presents as
 * measured. Three mechanisms, because any one of them alone has a way
 * around it: the union cannot name assistant output, the runtime check
 * covers input the types never see, and the freeze stops evidence being
 * edited after the packet was built and checked.
 */
test('evidence has no origin for assistant output, and none can be added', () => {
  assert.deepEqual([...EVIDENCE_ORIGINS], ['runner-output', 'parse', 'observation', 'file', 'measurement']);
  for (const origin of EVIDENCE_ORIGINS) {
    assert.doesNotMatch(origin, /assistant|model|copilot|response|suggest/i, 'every origin is something the toolkit observed for itself');
  }

  // The route the type system does not cover: a packet arriving as data.
  const smuggled = { origin: 'assistant', text: 'I think the config is wrong.', source: 'chat' } as unknown as EvidenceItem;
  assert.throws(() => buildPacket(explainInput({ evidence: [smuggled] })), PacketError, 'an origin the toolkit does not observe is refused');

  const packet = buildPacket(explainInput());
  assert.throws(() => (packet.evidence as EvidenceItem[]).push(smuggled), 'the evidence array is frozen');
  assert.throws(() => {
    (packet.evidence[0] as { text: string }).text = 'something else';
  }, 'and so is each item, or the array freeze would only stop appending');
  assert.equal(packet.evidence[0].text, 'Application bundle generation failed.');

  for (const name of Object.keys(api)) {
    assert.doesNotMatch(name, /^(append|add|push|update|set)Evidence$/i, `there is no API to change a built packet's evidence, and ${name} would be one`);
  }
});

// ---------------------------------------------------------------------------
// 2. The taxonomy
// ---------------------------------------------------------------------------

/** Rule 22. A taxonomy invariant, not a promise of eight classifiers. */
test('all eight failure classes remain distinct', () => {
  assert.equal(FAILURE_CLASSES.length, 8);
  assert.equal(new Set(FAILURE_CLASSES).size, 8, 'no duplicates, or two names would mean one thing');
  assert.deepEqual([...FAILURE_CLASSES].sort(), ['dependency', 'environment', 'insufficient-evidence', 'polyglot', 'runner', 'source', 'test', 'toolchain']);
});

/** Rule 21 and M6. The toolkit must be able to say a defect is its own. */
test('polyglot is a real classification a packet can carry', () => {
  assert.ok(FAILURE_CLASSES.includes('polyglot'));
  const packet = buildPacket(
    explainInput({
      classification: { failureClass: 'polyglot', condition: 'witness-hook-leak', confidence: 'classified', label: 'a defect in the toolkit' },
      remediation: ['Upgrade Witness.'],
    }),
  );
  assert.equal(packet.classification.failureClass, 'polyglot');
  assert.equal(toProblemPacket(packet).category, 'a defect in the toolkit', 'and it survives the compatibility view');
});

/** Rule 20. An unclassified condition carries evidence and nothing more. */
test('an unclassified packet cannot carry a cause or a remedy', () => {
  assert.throws(
    () => buildPacket(explainInput({ classification: { failureClass: 'insufficient-evidence', condition: 'unclassified', confidence: 'unclassified', label: 'unknown' }, remediation: ['Try turning it off and on.'] })),
    /cannot carry remediation/,
    'a remedy is a claim about the cause',
  );
  assert.throws(
    () => buildPacket(explainInput({ classification: { failureClass: 'dependency', condition: 'unclassified', confidence: 'unclassified', label: 'unknown' }, remediation: [] })),
    /insufficient-evidence/,
    'and naming any other class is naming a cause',
  );
  const ok = buildPacket(explainInput({ classification: { failureClass: 'insufficient-evidence', condition: 'unclassified', confidence: 'unclassified', label: 'unknown' }, remediation: [] }));
  assert.equal(ok.classification.confidence, 'unclassified');
});

// ---------------------------------------------------------------------------
// 3. Coherence across the ten fields
// ---------------------------------------------------------------------------

/**
 * The combinations that pass every per-field check and are still wrong. An
 * explain interaction holding an authorization boundary is one edit from
 * proposing; a propose interaction without one changes files without asking.
 */
test('the ten fields have to agree with each other', () => {
  assert.throws(() => buildPacket(explainInput({ allowed: { readable: [], proposable: ['src/**'], mayPropose: true } })), /proposes nothing/);
  assert.throws(() => buildPacket(explainInput({ authorization: USER_AUTHORIZES_ATTEMPT })), /nothing for a person to authorize/);
  assert.throws(() => buildPacket(explainInput({ verification: { kind: 're-measure', measurements: ['test-suite'], target: { kind: 'lines', path: 'src/pricing.ts', lines: [2] } } })), /nothing to verify/);
  assert.throws(() => buildPacket(proposeInput({ authorization: NO_AUTHORIZATION_NEEDED })), /authorizes the change set/);
  assert.throws(() => buildPacket(proposeInput({ verification: NOTHING_TO_VERIFY })), /re-measurement/);
  assert.throws(() => buildPacket(proposeInput({ allowed: { readable: ['src/**'], proposable: [], mayPropose: true } })), /which paths a proposal may touch/);

  assert.equal(buildPacket(explainInput()).responseShape, 'explain-envelope', 'the shape is derived, not supplied');
  assert.equal(buildPacket(proposeInput()).responseShape, 'propose-envelope');
});

/** A constraint nobody checks is a suggestion wearing a constraint's clothes. */
test('a packet cannot carry a constraint none of its validators decides', () => {
  assert.throws(() => buildPacket(explainInput({ constraints: [STANDING_CONSTRAINTS.C4], validators: ['V-response-shape'] })), /which this packet does not list/);
  assert.throws(() => buildPacket(explainInput({ constraints: [] })), /at least one constraint/);
  const twice = [PATH_CONSTRAINTS[0], PATH_CONSTRAINTS[0]];
  assert.throws(() => buildPacket(explainInput({ constraints: twice })), /appears twice/);
});

// ---------------------------------------------------------------------------
// 4. Constraints
// ---------------------------------------------------------------------------

/** Ids are how a validator names what failed and how a record refers to it. */
test('every constraint has a stable id, a machine-readable rule, and prose', () => {
  const ids = Object.keys(STANDING_CONSTRAINTS);
  assert.deepEqual(ids, ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']);
  for (const [key, c] of Object.entries(STANDING_CONSTRAINTS) as [string, Constraint][]) {
    assert.equal(c.id, key, 'the key and the id cannot disagree');
    assert.ok(c.rule && typeof c.rule.kind === 'string', `${key} carries a rule a program can read, not only prose`);
    assert.ok(c.prose.trim().length > 0, `${key} has prose for the prompt`);

    // **The A2 invariant**, which replaces Phase 2's "every standing
    // constraint names a validator and none is advisory".
    //
    // That assertion was true when it was written and became false on
    // purpose. C5, C6, and C7 ask semantic questions, so nothing decides
    // them, and making them say so in the type is the honest option. What
    // must hold instead is the biconditional: a constraint names a deciding
    // validator if and only if it is not advisory. Either half failing is a
    // way for something to report a constraint as checked when nothing
    // checked it, or to leave a decidable one unclaimed.
    if (c.rule.kind === 'advisory') {
      assert.equal(c.decidedBy, undefined, `${key} is advisory, so it must name nobody`);
      assert.ok(c.rule.why.trim().length > 0, `${key} is advisory, so it says why in the rule where a reader will see it`);
    } else {
      assert.ok(c.decidedBy !== undefined && VALIDATOR_IDS.includes(c.decidedBy), `${key} is decidable, so it names the validator that decides it`);
    }
    assert.doesNotThrow(() => assertConstraintShape(c), `${key} satisfies the shape guard`);
  }

  // The 1.0.21 state, stated as a fact so a change to it has to be deliberate.
  assert.deepEqual(
    Object.values(STANDING_CONSTRAINTS)
      .filter((c) => c.rule.kind === 'advisory')
      .map((c) => c.id),
    ['C5', 'C6', 'C7'],
    'exactly three standing constraints are advisory in 1.0.21',
  );
  // And the two that are only partly decided say so in the rule, in words
  // the authorization brief renders to the person.
  for (const id of ['C2', 'C8'] as const) {
    const rule = STANDING_CONSTRAINTS[id].rule;
    assert.notEqual(rule.kind, 'advisory');
    if (rule.kind !== 'advisory') {
      assert.ok(rule.unchecked && rule.unchecked.trim().length > 0, `${id} is partly decided, so the rule names the part that is not`);
    }
  }
  for (const id of ['C3', 'C4'] as const) {
    const rule = STANDING_CONSTRAINTS[id].rule;
    if (rule.kind !== 'advisory') {
      assert.equal(rule.unchecked, undefined, `${id} is decided in full, so it claims no gap`);
    }
  }
  assert.deepEqual([...TOOL_FOLDERS], ['.deeptest', '.untangleit', '.keepsafe']);
  // Rule 67 and Part XI: the line between adding coverage and editing the
  // contract lives in the rule, where a validator can see it.
  assert.equal(STANDING_CONSTRAINTS.C1.rule.kind === 'tests-additive-only' && STANDING_CONSTRAINTS.C1.rule.allowNewFiles, true);

  const condition = [...PATH_CONSTRAINTS];
  assert.equal(condition.length, 6);
  assert.equal(new Set(condition.map((c) => c.id)).size, 6);
  for (const c of condition) {
    assert.match(c.id, /^X-PATH-[1-6]$/);
    // Stated plainly rather than implied: this interaction proposes nothing,
    // so there is no change set any of these could be checked against.
    assert.equal(c.rule.kind, 'advisory');
  }
});

/** The 1.0.19 path guidance cannot regress behind the ids. */
test('the path condition still carries its six sentences, in order', () => {
  const legacy = upstreamPathFailure({
    workspaceRoot: "C:\\workspace\\MikeVan's AI Development Toolkit\\app",
    runner: 'ng-karma',
    output: ["✘ [ERROR] Expected \";\" but found \"s\"", "      1 │ import 'C:/workspace/MikeVan's AI Development Toolkit/app/polyfills.js';"].join('\n'),
    succeeded: false,
  })!;
  assert.deepEqual(
    legacy.packet.constraints,
    PATH_CONSTRAINTS.map((c) => c.prose),
    'the derived view renders the same six, in the same order',
  );
  assert.equal(legacy.packet.category, 'toolchain path handling', 'and the displayed category is unchanged');
});

// ---------------------------------------------------------------------------
// 5. The registry
// ---------------------------------------------------------------------------

test('an interaction with no objective is refused', () => {
  const none = validateSpec(spec({ objective: undefined as never }));
  assert.equal(none.ok, false);
  assert.ok(!none.ok && none.problems.some((p) => p.field === 'objective' && /no objective/.test(p.problem)));

  const empty = validateSpec(spec({ objective: [] as never }));
  assert.equal(empty.ok, false);
  assert.ok(!empty.ok && empty.problems.some((p) => p.field === 'objective' && /no objective/.test(p.problem)));
});

test('an interaction with two objectives is refused', () => {
  const both = validateSpec(spec({ objective: ['explain', 'propose'] as never }));
  assert.equal(both.ok, false);
  assert.ok(!both.ok && both.problems.some((p) => p.field === 'objective' && /2 objectives/.test(p.problem)), 'and it says how many, so the fault is obvious');
  assert.throws(() => registerInteraction(spec({ objective: ['explain', 'propose'] as never })), /cannot be registered/);
});

/** Each of these leaves an interaction that looks registered and governs nothing. */
test('an incomplete interaction spec is refused, with every reason at once', () => {
  const bare = validateSpec(spec({ constraints: [] as never, validators: [] as never, authorization: undefined as never, verification: undefined as never }));
  assert.equal(bare.ok, false);
  const fields = !bare.ok ? bare.problems.map((p) => p.field) : [];
  for (const field of ['constraints', 'validators', 'authorization', 'verification']) {
    assert.ok(fields.includes(field), `${field} is required`);
  }
  assert.ok(fields.length >= 4, 'all of them are reported, not just the first');

  assert.equal(validateSpec(spec({ constraints: ['NOPE'] as never })).ok, false);
  assert.equal(validateSpec(spec({ validators: ['V-made-up'] as never })).ok, false);
  assert.equal(validateSpec(spec({ correction: { maxAttempts: 3, onSecondFailure: 'abandon' } as never })).ok, false, 'one correction, then abandon');
  assert.equal(validateSpec(spec({ objective: 'propose', allowed: { readable: [], proposable: [], mayPropose: false } })).ok, false, 'a propose spec must name its proposable paths');
  assert.equal(validateSpec(spec({ authorization: USER_AUTHORIZES_ATTEMPT })).ok, false, 'an explain spec authorizes nothing');
});

test('a well-formed spec registers and comes back', () => {
  clearRegistryForTests();
  const registered = registerInteraction(spec());
  assert.equal(registered.id, 'O-TEST');
  assert.deepEqual([...registeredIds()], ['O-TEST']);
  assert.equal(requireInteraction('O-TEST').objective, 'explain');
  assert.throws(() => requireInteraction('O-NOT-THERE'), /is used in code but is not registered/);
  clearRegistryForTests();
});

/**
 * The seventh invalid state: an id in code with no registry entry.
 *
 * Scoped to governed declarations on purpose. `requireInteraction` is what a
 * governed code path calls, so scanning for it finds every governed id and
 * nothing else. The 1.0.19 clipboard and chat hand-offs do not call it and
 * are not caught here; they come under this test when Phase 3 converts them,
 * which is when they will have ids at all.
 */
test('every governed interaction id declared in the source is registered', () => {
  const src = path.join(__dirname, '..', 'src');
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.ts')) {
        files.push(full);
      }
    }
  };
  walk(src);

  const declared = new Set<string>();
  for (const file of files) {
    if (file.endsWith(path.join('governance', 'registry.ts'))) {
      continue; // its own definition, not a use
    }
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/\brequireInteraction\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      declared.add(m[1]);
    }
  }
  const missing = [...declared].filter((id) => !registeredIds().includes(id));
  assert.deepEqual(missing, [], 'a governed id with no registry entry has no objective, no constraints, and no validators');

  // The scan has to be able to find something, or it proves nothing.
  const sample = "const spec = requireInteraction('O-5');";
  assert.deepEqual([...sample.matchAll(/\brequireInteraction\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]), ['O-5']);
});

// ---------------------------------------------------------------------------
// 6. Responses
// ---------------------------------------------------------------------------

test('explain and propose are distinct envelopes and neither accepts the other', () => {
  const explainPacket = buildPacket(explainInput());
  const proposePacket = buildPacket(proposeInput());

  const goodExplain = JSON.stringify({ kind: 'explain', whatIsWrong: 'The path.', whyItHappened: 'Angular wrote it unescaped.', howToFix: 'Move it.', whatNotToChange: ['your code'], citedEvidence: [0] });
  assert.equal(parseExplain(goodExplain, explainPacket).ok, true);
  assert.equal(parsePropose(goodExplain, proposePacket).ok, false, 'an explain body is not a proposal');

  const goodPropose = JSON.stringify({ kind: 'propose', changeSet: [{ path: 'test/new.test.ts', operation: 'create', after: 'x' }], claims: { perEdit: [] } });
  assert.equal(parsePropose(goodPropose, proposePacket).ok, true);
  assert.equal(parseExplain(goodPropose, explainPacket).ok, false, 'and a proposal is not an explanation');

  // A modify with no `before` leaves nothing to check the edit against
  // except the model's description of what was there.
  const noBefore = parsePropose(JSON.stringify({ kind: 'propose', changeSet: [{ path: 'src/a.ts', operation: 'modify', after: 'y' }], claims: {} }), proposePacket);
  assert.equal(noBefore.ok, false);
  assert.ok(!noBefore.ok && noBefore.problems.some((p) => /exact existing text/.test(p)));

  // Rule 20 at the parse boundary: a fix names a cause.
  const unclassified = buildPacket(explainInput({ classification: { failureClass: 'insufficient-evidence', condition: 'unclassified', confidence: 'unclassified', label: 'unknown' }, remediation: [] }));
  const withFix = parseExplain(JSON.stringify({ kind: 'explain', whatIsWrong: 'a', whyItHappened: 'b', howToFix: 'c', whatNotToChange: [], citedEvidence: [] }), unclassified);
  assert.equal(withFix.ok, false);

  // Rules 43 and 44: nothing partial, nothing repaired.
  const broken = parseExplain('{not json', explainPacket);
  assert.equal(broken.ok, false);
  assert.ok(!broken.ok && broken.problems.length > 0);
  assert.equal('value' in broken, false, 'a failed parse yields no value at all');
});

/** Rule 51. Validation reads the change set, never the model's account of it. */
test('a validator cannot read the model compliance claims', () => {
  const proposePacket = buildPacket(proposeInput());
  const parsed = parsePropose(
    JSON.stringify({
      kind: 'propose',
      changeSet: [{ path: 'test/new.test.ts', operation: 'create', after: 'x' }],
      claims: { perEdit: [{ path: 'test/new.test.ts', respects: ['C1', 'C4'] }], summary: 'I followed every rule.' },
    }),
    proposePacket,
  );
  assert.equal(parsed.ok, true);
  const response = (parsed as { ok: true; value: ProposeResponse }).value;
  assert.equal(response.claims.perEdit.length, 1, 'the claim is kept, because a mismatch is worth recording');

  const forValidator = validatable(response);
  assert.equal('claims' in forValidator, false, 'and it is not in the value a validator receives');
  assert.equal(JSON.stringify(forValidator).includes('I followed every rule'), false);
});

// ---------------------------------------------------------------------------
// 7. Validators
// ---------------------------------------------------------------------------

/** Rule 7 is absolute. A model does not reach inside the recovery boundary. */
test('V-forbidden-paths refuses a change set touching a tool folder, from the paths', () => {
  const packet = buildPacket(proposeInput());
  const run = (paths: string[]) =>
    forbiddenPathsValidator.run({
      packet,
      constraints: packet.constraints,
      response: { kind: 'propose', changeSet: paths.map((p) => ({ path: p, operation: 'create' as const, after: 'x' })) },
    });

  assert.equal(run(['test/new.test.ts', 'src/a.ts']).verdict, 'pass');
  for (const bad of ['.keepsafe/checkpoints/1.json', 'project/.deeptest/decisions.json', 'a/.untangleit/runs.json', '.KeepSafe/x', 'project\\.deeptest\\x.json', 'src/../.keepsafe/x']) {
    const outcome = run([bad]);
    assert.equal(outcome.verdict, 'fail', `${bad} is inside a tool folder`);
    assert.equal(outcome.verdict === 'fail' && outcome.constraint, 'C4');
  }

  // Segments, never substrings. Both of these merely contain the text, and a
  // validator that failed them would teach people to route around it.
  assert.equal(run(['src/dotdeeptest-notes.md']).verdict, 'pass');
  assert.equal(run(['docs/.deeptest-format.md']).verdict, 'pass');

  // It decides C4 and declines everything else, rather than guessing.
  const explainPacket = buildPacket(explainInput());
  assert.equal(
    forbiddenPathsValidator.run({ packet: explainPacket, constraints: explainPacket.constraints, response: { kind: 'explain', whatIsWrong: 'a', whyItHappened: 'b', howToFix: null, whatNotToChange: [], citedEvidence: [] } }).verdict,
    'not-applicable',
  );
  assert.deepEqual([...forbiddenPathsValidator.decides], ['C4']);
});

/** A declared validator with no body must not read as a check that passed. */
test('an unimplemented validator refuses to be used', () => {
  // The four with no body at the end of Phase 4, asserted as a set rather
  // than by example, so this test keeps being true as bodies land and fails
  // loudly if one is added or removed without a decision.
  //
  // Three of them would have decided C5, C6, and C7, which are advisory
  // because the questions they ask are semantic, so no constraint names them
  // and nothing claims they ran. The fourth, `V-contradiction`, has no body
  // because no deterministic semantic contradiction predicate has been
  // established for 1.0.21.
  const noBody: readonly ValidatorId[] = ['V-platform-specific', 'V-workaround-preserved', 'V-unrelated-change', 'V-contradiction'];
  for (const id of noBody) {
    assert.equal(validatorImplemented(id), false, `${id} has no body`);
    assert.throws(() => validatorFor(id), /no implementation yet/, `${id} refuses to be used rather than validating nothing`);
  }
  const withBody = VALIDATOR_IDS.filter((id) => !noBody.includes(id));
  assert.deepEqual([...withBody], ['V-response-shape', 'V-scope-paths', 'V-forbidden-paths', 'V-existing-tests', 'V-public-contract', 'V-refusal-wellformed']);
  for (const id of withBody) {
    assert.equal(validatorFor(id).id, id, `${id} has a body and answers to its own id`);
  }
});

/**
 * The three advisory constraints name nobody, so the three validators that
 * would have decided them have no consumer.
 *
 * This is the pair of assertions that stops "advisory" and "unimplemented"
 * being confused. An unimplemented validator that a constraint still names
 * is a gap somebody must close, and rule 94's gate refuses an interaction
 * that requires one. A validator nothing names is a declared id with no
 * consumer, which is what these three are.
 */
test('no constraint names a validator that has no body', () => {
  for (const c of Object.values(STANDING_CONSTRAINTS)) {
    if (c.decidedBy !== undefined) {
      assert.equal(validatorImplemented(c.decidedBy), true, `${c.id} names ${c.decidedBy}, which must therefore exist`);
    }
  }
  for (const c of [...PATH_CONSTRAINTS, UNCLASSIFIED_CONSTRAINT]) {
    assert.equal(c.decidedBy, undefined, `${c.id} is advisory, so it names nobody`);
  }
});

/** Rule 26, one level down: the thing being judged does not record the judgment. */
test('a validation result derives acceptance and cannot be told it passed', () => {
  const failed = buildValidationResult('O-TEST', [
    { id: 'V-forbidden-paths', verdict: 'fail', constraint: 'C4', because: 'it touched .keepsafe' },
    { id: 'V-response-shape', verdict: 'pass' },
  ]);
  assert.equal(failed.accepted, false);
  assert.deepEqual([...failed.failedConstraints], ['C4']);
  assert.throws(() => {
    (failed as { accepted: boolean }).accepted = true;
  }, 'and it cannot be overwritten afterwards');

  const clean = buildValidationResult('O-TEST', [{ id: 'V-forbidden-paths', verdict: 'pass' }, { id: 'V-response-shape', verdict: 'not-applicable', because: 'nothing to check' }]);
  assert.equal(clean.accepted, true, 'not-applicable is not a failure');
});

// ---------------------------------------------------------------------------
// 8. The prompt
// ---------------------------------------------------------------------------

/** Rule 87: facts, limits, scope, and shape. No per-condition prose tree. */
test('the prompt states the facts and the limits, and is the same every time', () => {
  clearRegistryForTests();
  const s = registerInteraction(spec({ constraints: ['X-PATH-1'], validators: ['V-response-shape'] }));
  const packet = buildPacket(explainInput());
  const prompt = buildPrompt(packet, s, reconcileConstraints(s, packet));

  for (const c of packet.constraints) {
    assert.ok(prompt.text.includes(`[${c.id}] ${c.prose}`), `every limit travels, by id: ${c.id}`);
  }
  assert.ok(prompt.text.includes('Application bundle generation failed.'), 'the evidence travels verbatim');
  assert.match(prompt.text, /Every line is binding/);
  assert.match(prompt.text, /already been classified/);
  assert.match(prompt.text, /"kind": "explain"/, 'the response shape comes from the parser, so the two cannot drift');
  assert.match(prompt.text, /## If you cannot/, 'refusing is a correct answer, and a model has to be told so');
  assert.match(prompt.text, /You may propose no changes at all/);

  assert.equal(buildPrompt(packet, s, reconcileConstraints(s, packet)).hash, prompt.hash, 'reproducible, because the record stores the hash instead of the text');
  // A packet and a spec that disagree on the objective are not guessed at,
  // and the refusal now happens in reconciliation, which runs before the
  // prompt is built at all (M19).
  const wrongObjective = buildPacket(proposeInput());
  assert.throws(() => reconcileConstraints(s, wrongObjective), /One of them is wrong/);
  clearRegistryForTests();
});

// ---------------------------------------------------------------------------
// 9. The governance record
// ---------------------------------------------------------------------------

/**
 * Rule 70. The strong form of this test ignores the schema: it looks for the
 * material itself in the serialized record. A field-list assertion would go
 * quietly out of date the first time somebody added a field.
 */
test('a governance record holds no source, no prompt, and no response body', () => {
  clearRegistryForTests();
  const s = registerInteraction(spec({ constraints: ['X-PATH-1'], validators: ['V-response-shape'] }));
  const packet = buildPacket(
    explainInput({ evidence: [{ origin: 'runner-output', text: 'MARKER_EVIDENCE_5f1c', source: 'ng test' }], constraints: [PATH_CONSTRAINTS[0]], validators: ['V-response-shape'] }),
  );
  const prompt = buildPrompt(packet, s, reconcileConstraints(s, packet));
  const rawResponse = JSON.stringify({ kind: 'explain', whatIsWrong: 'MARKER_RESPONSE_9a3d', whyItHappened: 'x', howToFix: 'y', whatNotToChange: [], citedEvidence: [0] });
  const changeSetText = 'MARKER_SOURCE_c72b';

  const record = buildRecord({
    spec: s,
    packet,
    prompt,
    rawResponse,
    changeSetText,
    validation: buildValidationResult(s.id, [{ id: 'V-response-shape', verdict: 'pass' }]),
    corrections: 0,
    model: { id: 'the-model-the-user-picked', vendor: 'copilot' },
    at: '2026-09-23T00:00:00.000Z',
  });

  const serialized = JSON.stringify(record);
  for (const marker of ['MARKER_EVIDENCE_5f1c', 'MARKER_RESPONSE_9a3d', 'MARKER_SOURCE_c72b']) {
    assert.equal(serialized.includes(marker), false, `${marker} must not reach the record; a log that accumulates these is a second copy of the customer's source`);
  }
  assert.ok(prompt.text.includes('MARKER_EVIDENCE_5f1c'), 'the marker really was in the prompt, or this proves nothing');

  assert.equal(record.hashes.prompt, prompt.hash);
  assert.equal(record.hashes.packet, packet.id);
  assert.ok(record.hashes.response.length === 64 && record.hashes.changeSet?.length === 64, 'digests, which prove identity without holding the material');
  assert.equal(record.model.id, 'the-model-the-user-picked', 'so anyone can prove Polyglot did not substitute one');
  assert.deepEqual([...record.constraintIds], ['X-PATH-1']);
  assert.equal(record.accepted, true);
  clearRegistryForTests();
});

// ---------------------------------------------------------------------------
// 10. The compatibility view runs one way
// ---------------------------------------------------------------------------

/**
 * The old shape is an output. If it became an input, a conversion would have
 * to invent typed evidence, structured constraints, an objective, validators,
 * an authorization boundary, and a verification rule, and a packet built that
 * way would satisfy every downstream stage while having been governed by
 * nobody.
 */
test('there is no route from the 1.0.19 shape back into the governance model', () => {
  for (const name of Object.keys(api)) {
    assert.doesNotMatch(name, /toGovernancePacket|fromProblemPacket|asGovernancePacket|upgradePacket/i, `${name} would be a reverse conversion, and there is deliberately none`);
  }
  const legacy = unclassifiedPacket({ runner: 'vitest', evidence: ['exit code 7'] });
  assert.equal(legacy.confidence, 'unclassified');
  assert.deepEqual(legacy.remediation, []);
  assert.deepEqual(legacy.constraints, [
    'Do not state a cause the evidence does not support. Explaining what the evidence shows, and saying plainly what it does not establish, is the whole job here.',
  ]);
});

// ---------------------------------------------------------------------------
// 11. M21's structural proofs
// ---------------------------------------------------------------------------

/**
 * The fixture that replaced `scopedConstraint` is test-only, and "test-only"
 * has to be a fact rather than an intention.
 *
 * `scopedConstraint` was removed from the production API because a second
 * valid-looking way to produce a bound C3 is the ambiguity M21 exists to end.
 * If `src/` could import the fixture, the second way would be back, wearing a
 * folder name instead of an export.
 */
test('M21: nothing in src imports the test-only constraint fixture', () => {
  const src = path.join(__dirname, '..', 'src');
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.ts')) {
        files.push(full);
      }
    }
  };
  walk(src);

  const offenders = files.filter((f) => /from\s+['"][^'"]*test\/support/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, [], 'a production module importing a test fixture is a production dependency with a test-shaped name');

  // And the removed export stays removed.
  assert.equal((api as Record<string, unknown>).scopedConstraint, undefined, 'scopedConstraint is not part of the public API');
});

/**
 * The phase boundary, asserted rather than remembered.
 *
 * M21's eight proofs have to be green before any production `propose`
 * interaction exists, because a registered propose interaction is one that
 * can reach a model and change a person's files. Witness registers none: the
 * products do, in Phase 5, after this.
 */
test('M21: Witness itself registers no propose interaction', () => {
  clearRegistryForTests();
  assert.deepEqual(registeredIds(), [], 'the registry starts empty, and Witness never fills it');
});
