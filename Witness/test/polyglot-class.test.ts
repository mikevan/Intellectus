/**
 * M6: the one failure class Polyglot can prove about itself.
 *
 * The constitution's Part X carries the row *a known Polyglot-originated
 * failure is classified `polyglot`, never promoted by AI*. This is that
 * controlled test, and it is deliberately as interested in what does **not**
 * classify as in what does. A mechanism that classified everything it was
 * shown would not be evidence, it would be a habit.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { FAILURE_CLASSES, POLYGLOT_CONSTRAINTS, instrumentationFailure, unclassifiedGovernancePacket } from '../src/index';
import * as apiSurface from '../src/index';
import type { InstrumentationEvidence } from '../src/index';

/** A run where everything went right. Every case below is a departure from this. */
const HEALTHY: InstrumentationEvidence = {
  testsFinished: 12,
  testsRecorded: 12,
  recordsWithEvidence: 12,
  filesWithHits: 5,
  brokenBoundaries: 0,
  reconcilable: true,
};

const evidence = (over: Partial<InstrumentationEvidence>): InstrumentationEvidence => ({ ...HEALTHY, ...over });

function packetFor(e: InstrumentationEvidence) {
  return instrumentationFailure({ runner: 'vitest', evidence: e, sentence: 'Polyglot refused to score this run.' });
}

/**
 * The condition a run classifies as, asked the only way a consumer can ask
 * it: through the governed result.
 *
 * `instrumentationCondition` is private to `diagnosis.ts`, and these tests
 * go through the public contract for the same reason a product would. A test
 * reaching past `instrumentationFailure` would be proving a predicate nobody
 * is allowed to call, and it would let the classification policy drift out
 * of the module that owns it without any test noticing.
 */
function conditionOf(e: InstrumentationEvidence): string | undefined {
  return packetFor(e)?.classification.condition;
}

// ---------------------------------------------------------------------------
// The three shapes that classify
// ---------------------------------------------------------------------------

/**
 * The shape Angular under Vitest took from 1.0.12 to 1.0.14: a fully tested
 * project reported as entirely untested, while the record count reconciled
 * perfectly. It is checked first and on every runner for that reason.
 */
test('tests finished and nothing recorded is a polyglot instrumentation failure', () => {
  const e = evidence({ recordsWithEvidence: 0, filesWithHits: 0 });
  assert.equal(conditionOf(e), 'instrumented-nothing');

  const packet = packetFor(e)!;
  assert.ok(packet, 'a packet is produced');
  assert.equal(packet.classification.failureClass, 'polyglot');
  assert.equal(packet.classification.condition, 'instrumented-nothing');
  assert.equal(packet.classification.confidence, 'classified');
});

test('a broken test boundary is a polyglot instrumentation failure', () => {
  const e = evidence({ brokenBoundaries: 3 });
  assert.equal(conditionOf(e), 'broken-boundary');
  const packet = packetFor(e)!;
  assert.equal(packet.classification.failureClass, 'polyglot');
  assert.equal(packet.classification.condition, 'broken-boundary');
  assert.equal(packet.classification.confidence, 'classified');
});

test('fewer records than tests finished is a polyglot instrumentation failure', () => {
  const e = evidence({ testsRecorded: 7 });
  assert.equal(conditionOf(e), 'records-missing');
  const packet = packetFor(e)!;
  assert.equal(packet.classification.failureClass, 'polyglot');
  assert.equal(packet.classification.condition, 'records-missing');
  assert.equal(packet.classification.confidence, 'classified');
});

test('the three conditions are three, and each names itself', () => {
  const conditions = [
    conditionOf(evidence({ recordsWithEvidence: 0, filesWithHits: 0 })),
    conditionOf(evidence({ brokenBoundaries: 3 })),
    conditionOf(evidence({ testsRecorded: 7 })),
  ];
  assert.deepEqual(conditions, ['instrumented-nothing', 'broken-boundary', 'records-missing']);
  assert.equal(new Set(conditions).size, 3, 'three distinct condition ids, so a record says which shape it was');
});

// ---------------------------------------------------------------------------
// The fourth shape does not classify, and that is the point
// ---------------------------------------------------------------------------

/**
 * Polyglot cannot line the runner's count up with its own records, so it
 * cannot say whose fault the gap is. Absence of a class, not a class of
 * absence.
 */
test('a run that cannot be reconciled classifies nothing', () => {
  const e = evidence({ reconcilable: false, testsRecorded: 7, brokenBoundaries: 2 });
  assert.equal(packetFor(e), undefined, 'no packet, even with a broken boundary and missing records');
  assert.equal(conditionOf(e), undefined, 'so there is no condition to read');
});

test('the unreconcilable case falls through to the unclassified packet', () => {
  const e = evidence({ reconcilable: false, testsRecorded: 7 });
  assert.equal(packetFor(e), undefined);

  // What the caller reaches for instead, which M5 will wire.
  const fallback = unclassifiedGovernancePacket({ runner: 'vitest', evidence: ['Polyglot refused to score this run.'] });
  assert.equal(fallback.classification.failureClass, 'insufficient-evidence');
  assert.equal(fallback.classification.confidence, 'unclassified');
});

/**
 * Nothing fires on an ordinary result. Asserted because a classifier that
 * reported on healthy runs would make every run look like a defect.
 */
test('a healthy run classifies nothing and produces no packet', () => {
  assert.equal(packetFor(HEALTHY), undefined);
  assert.equal(conditionOf(HEALTHY), undefined);
});

test('an empty run, with no tests finished, classifies nothing', () => {
  // Zero tests is the "nothing to score" refusal, which is about the
  // person's project rather than about Polyglot's instrumentation.
  const e = evidence({ testsFinished: 0, testsRecorded: 0, recordsWithEvidence: 0, filesWithHits: 0 });
  assert.equal(packetFor(e), undefined, 'no tests ran, so Polyglot instrumented nothing because there was nothing to instrument');
});

/**
 * A record carrying no files is ordinary on its own: a test of a constant
 * reaches nothing the instrumenter watches. It is damning only when it is
 * every record in the run, which is the first condition.
 */
test('some records without evidence is ordinary and classifies nothing', () => {
  assert.equal(packetFor(evidence({ recordsWithEvidence: 4 })), undefined);
  assert.equal(packetFor(evidence({ recordsWithEvidence: 0, filesWithHits: 5 })), undefined, 'files were hit, so the instrumenter was working');
});

// ---------------------------------------------------------------------------
// The class is Polyglot's and only Polyglot's
// ---------------------------------------------------------------------------

test('polyglot is one of the eight classes, not a catch-all invented here', () => {
  assert.ok(FAILURE_CLASSES.includes('polyglot'));
  const packet = packetFor(evidence({ brokenBoundaries: 1 }))!;
  assert.notEqual(packet.classification.failureClass, 'insufficient-evidence', 'this is a named cause, not an absence of one');
});

/**
 * Five of the eight classes still have no selection rule, and that is
 * recorded rather than hidden. M6 proves two: `polyglot` here, and
 * `toolchain` which Phase 2 already proved via the path-character condition.
 */
test('M6 selects polyglot and nothing else', () => {
  const selected = new Set<string>();
  for (const e of [
    evidence({ recordsWithEvidence: 0, filesWithHits: 0 }),
    evidence({ brokenBoundaries: 3 }),
    evidence({ testsRecorded: 7 }),
  ]) {
    selected.add(packetFor(e)!.classification.failureClass);
  }
  assert.deepEqual([...selected], ['polyglot'], 'one class, and no rule here selects any other');
  for (const unproven of ['source', 'test', 'environment', 'dependency', 'runner'] as const) {
    assert.equal(selected.has(unproven), false, `${unproven} has no selection rule and M6 does not invent one`);
  }
});

// ---------------------------------------------------------------------------
// Never promoted by AI
// ---------------------------------------------------------------------------

/**
 * The classification is decided before the model is reached and there is no
 * field a response could set to change it.
 */
test('the packet proposes nothing, so no response can alter what it claims', () => {
  const packet = packetFor(evidence({ brokenBoundaries: 1 }))!;
  assert.equal(packet.objective, 'explain');
  assert.equal(packet.allowed.mayPropose, false);
  assert.deepEqual([...packet.allowed.proposable], []);
  assert.deepEqual([...packet.allowed.readable], [], 'an explanation reads nothing: everything it needs is in the packet');
  assert.equal(packet.responseShape, 'explain-envelope');
  assert.deepEqual([...packet.offers], ['explain'], 'no fix is offered, because the fault is ours');
});

test('the packet is frozen, so nothing downstream can rewrite the class', () => {
  const packet = packetFor(evidence({ brokenBoundaries: 1 }))!;
  assert.throws(() => {
    (packet.classification as { failureClass: string }).failureClass = 'source';
  });
  assert.equal(packet.classification.failureClass, 'polyglot');
});

// ---------------------------------------------------------------------------
// The three distinctions the constraints have to preserve
// ---------------------------------------------------------------------------

/**
 * The instrumentation failure is provably Polyglot's; the project is not
 * thereby proved faulty; and the project is **also not** thereby proved
 * correct. The third is the one that slips, because the natural reassuring
 * sentence overshoots into a clean bill of health nobody measured.
 */
test('the constraints preserve all three distinctions', () => {
  const packet = packetFor(evidence({ brokenBoundaries: 1 }))!;
  const ids = packet.constraints.map((c) => c.id);
  assert.deepEqual([...ids], ['X-POLY-1', 'X-POLY-2', 'X-POLY-3', 'X-POLY-4', 'X-POLY-5', 'X-POLY-6']);

  const first = packet.constraints[0].prose;
  assert.match(first, /establish that as a Polyglot instrumentation failure/, '1: the failure is ours');
  assert.match(first, /do not establish that this project is defective/, '2: not thereby faulty');
  assert.match(first, /do not establish that it is free of defects either/, '3: not thereby correct');

  const fourth = packet.constraints[3].prose;
  assert.match(fourth, /Do not tell the person their code is fine/, 'and the model may not round it off');
  assert.match(fourth, /the question remains open/);
});

/**
 * X-POLY-4 says "measured or attributed" rather than "measured", because in
 * the broken-boundary case Polyglot did measure something and could not
 * attribute it. "Did not measure it" would be false for one of the three
 * conditions this set governs.
 */
test('the wording holds for all three conditions, not just two', () => {
  const fourth = POLYGLOT_CONSTRAINTS[3].prose;
  assert.match(fourth, /failed to be measured or attributed/);
  assert.equal(/did not measure it/.test(fourth), false, 'that phrasing is false for a broken boundary');

  const second = POLYGLOT_CONSTRAINTS[1].prose;
  assert.match(second, /these measurements do not establish a project-code cause/, 'a claim about the evidence, not about where the fault is not');
});

test('every polyglot constraint is advisory and names no validator', () => {
  for (const c of POLYGLOT_CONSTRAINTS) {
    assert.equal(c.rule.kind, 'advisory', `${c.id} decides nothing, and says so in its type`);
    assert.equal(c.decidedBy, undefined, `${c.id} names no validator`);
    assert.ok(c.prose.trim().length > 0);
    assert.match(c.prose, /\.$/, `${c.id} is a complete sentence`);
  }
});

test('no polyglot constraint tells the person their project is at fault', () => {
  for (const c of POLYGLOT_CONSTRAINTS) {
    for (const wrong of [/your code caused/i, /the project caused/i, /your fault/i]) {
      assert.equal(wrong.test(c.prose), false, `${c.id} must not assert a project cause`);
    }
  }
});

// ---------------------------------------------------------------------------
// What the person is told
// ---------------------------------------------------------------------------

test('the headline says whose fault it is, in the person\'s words', () => {
  for (const [e, expected] of [
    [evidence({ recordsWithEvidence: 0, filesWithHits: 0 }), /recorded none of your code/],
    [evidence({ brokenBoundaries: 2 }), /could not keep your tests apart/],
    [evidence({ testsRecorded: 3 }), /did not record every test that ran/],
  ] as const) {
    const packet = packetFor(e)!;
    assert.match(packet.headline, expected);
    assert.match(packet.headline, /fault in Polyglot, not in your project/);
  }
});

test('what is not established is stated, not left to be inferred', () => {
  const packet = packetFor(evidence({ brokenBoundaries: 1 }))!;
  assert.equal(packet.unknown.length, 1);
  assert.match(packet.unknown[0], /Whether anything in this project is at fault/);
  assert.match(packet.unknown[0], /says nothing either way/);
  assert.deepEqual([...packet.remediation], [], 'there is nothing for the person to do about a defect in our code');
});

test('the evidence is measured, never parsed from output', () => {
  const packet = packetFor(evidence({ brokenBoundaries: 1 }))!;
  assert.ok(packet.evidence.length >= 4);
  for (const e of packet.evidence) {
    assert.equal(e.origin, 'measurement', 'these are counts Polyglot produced about its own run');
    assert.equal(e.source, 'witness');
  }
  assert.ok(packet.evidence.some((e) => /tests finished/.test(e.text)));
  assert.ok(packet.evidence.some((e) => /boundaries were broken/.test(e.text)));
});

test('the sentence the person already sees is carried as evidence rather than rewritten', () => {
  const said = 'Polyglot refused to score this run for a very specific reason.';
  const packet = instrumentationFailure({ runner: 'vitest', evidence: evidence({ brokenBoundaries: 1 }), sentence: said })!;
  assert.equal(packet.evidence[0].text, said);
});

/**
 * The contract is one function, and this is what stops it quietly becoming
 * two.
 *
 * `instrumentationCondition` is private on purpose: a consumer able to call
 * it could ask for the predicate, act on the answer, and rebuild
 * classification policy outside the module that owns it. Consumers ask for
 * the governed result; the result carries the condition.
 */
test('M6 exposes one function, and the predicate underneath it is not public', () => {
  const api = apiSurface as Record<string, unknown>;
  assert.equal(typeof api.instrumentationFailure, 'function', 'the contract');
  assert.equal(api.instrumentationCondition, undefined, 'and not the predicate underneath it');
  for (const name of Object.keys(api)) {
    assert.doesNotMatch(name, /^classifyInstrumentation|^instrumentationClass/, `${name} would be a second route to the same decision`);
  }
});

test('the condition is readable from the governed result, which is how a product gets it', () => {
  const packet = packetFor(evidence({ brokenBoundaries: 1 }))!;
  assert.equal(packet.classification.condition, 'broken-boundary');
  assert.equal(packet.classification.failureClass, 'polyglot');
});
