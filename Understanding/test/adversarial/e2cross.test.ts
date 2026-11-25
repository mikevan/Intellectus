// E2-cross: two independently written programs, nothing shared, every name different. Can evidence beyond the
// source carry the claim that they are substitutable? The predictions are in docs/experiment-log.md, recorded
// before this file was written.
import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctions as py } from "../../src/adapters/python/index.js";
import { encodeFunctions as ts } from "../../src/adapters/typescript/index.js";
import { match, type Correspondence } from "../../src/query/match.js";
import { Journal, literal, declareScope, assertProposal } from "../../src/index.js";

const PYTHON = `
def settle(acct, amount):
    balance = acct.balance
    if balance >= amount:
        post(-amount)
`;

const TYPESCRIPT = `
function settle(account: Account, sum: number) {
  const funds = account.available;
  if (funds >= sum) {
    postEntry(-sum);
  }
}`;

// the negative control: same names as the TypeScript, different behaviour
const CHANGED = `
function settle(account: Account, sum: number) {
  const funds = account.available;
  if (funds >= 25000) {
    postEntry(-sum);
  }
}`;

const OBLIGATIONS = ["A withdrawal is posted only when the available funds cover it."];

async function pair() {
  const a = (await py(PYTHON)).get("settle")!;
  const b = (await ts(TYPESCRIPT)).get("settle")!;
  return { a, b };
}

test("channel 1, structure only: no proposal, and the reason is named", async () => {
  const { a, b } = await pair();
  const p = match(a, b, [], OBLIGATIONS);
  assert.equal(p.verdict, "STRUCTURALLY_SIMILAR", "the shapes match once names are set aside");
  assert.ok(p.unresolved.some((u) => /balance and available/.test(u)), `expected the field gap named, got ${JSON.stringify(p.unresolved)}`);
  assert.ok(p.unresolved.some((u) => /post and postEntry/.test(u)), "expected the operation gap named");
  assert.ok(p.confidence < 0.6, "structure alone must not reach PROBABLE");
});

test("channel 2, a declared schema: the field is bridged, the operation is not", async () => {
  const { a, b } = await pair();
  const schema: Correspondence[] = [{
    kind: "field", left: "balance", right: "available", source: "DECLARED", asserts: "same",
    says: "The owner declares that balance and available are renderings of one account attribute.", assertions: [101],
  }];
  const p = match(a, b, schema, OBLIGATIONS);
  assert.ok(p.evidence.some((e) => e.source === "DECLARED"), "the declaration must be named as evidence");
  assert.ok(p.unresolved.some((u) => /post and postEntry/.test(u)), "the operation must still be unresolved");
  assert.ok(p.verdict !== "PROBABLE_EQUIVALENT", "one bridged difference out of two is not enough");
});

test("channel 3, a declared field and an OBSERVED operation: similar, and short of probable", async () => {
  const { a, b } = await pair();
  const evidence: Correspondence[] = [
    { kind: "field", left: "balance", right: "available", source: "DECLARED", asserts: "same", says: "The owner declares that balance and available are renderings of one account attribute.", assertions: [101] },
    { kind: "operation", left: "post", right: "postEntry", source: "OBSERVED", asserts: "same", says: "Two runs show post and postEntry writing the same ledger entry with the same canonical argument.", assertions: [201, 202] },
  ];
  const p = match(a, b, evidence, OBLIGATIONS);
  assert.equal(p.verdict, "STRUCTURALLY_SIMILAR", "an observation is weaker evidence than a declaration");
  assert.ok(p.confidence < 0.6, `an observed correspondence alone must not reach probable, got ${p.confidence}`);
  assert.equal(p.evidence.length, 3, "structure, the declaration, and the observation");
  assert.deepEqual(p.obligations, OBLIGATIONS, "the claim is scoped to the obligations");
  assert.notEqual(p.fingerprints.a, p.fingerprints.b, "the fingerprints must NOT be made equal");
  assert.ok(p.unresolved.every((u) => /still differ/.test(u)), "every name difference is bridged; the only thing left unresolved is the fingerprint difference itself");
});

test("channel 3b, both correspondences DECLARED by the owner: proposed at probable, difference still shown", async () => {
  const { a, b } = await pair();
  const evidence: Correspondence[] = [
    { kind: "field", left: "balance", right: "available", source: "DECLARED", asserts: "same", says: "The owner declares that balance and available are renderings of one account attribute.", assertions: [101] },
    { kind: "operation", left: "post", right: "postEntry", source: "DECLARED", asserts: "same", says: "The owner declares that post and postEntry write the same ledger entry.", assertions: [102] },
  ];
  const p = match(a, b, evidence, OBLIGATIONS);
  assert.equal(p.verdict, "PROBABLE_EQUIVALENT");
  assert.ok(p.confidence >= 0.6 && p.confidence < 1, `probable but never certain, got ${p.confidence}`);
  assert.equal(p.evidence.length, 3);
  assert.notEqual(p.fingerprints.a, p.fingerprints.b, "the fingerprints must NOT be made equal");
  assert.ok(p.unresolved.some((u) => /still differ/.test(u)), "the remaining difference must be stated, not hidden");
});

test("the negative control: different behaviour is never proposed, whatever the evidence", async () => {
  const a = (await py(PYTHON)).get("settle")!;
  const changed = (await ts(CHANGED)).get("settle")!;
  const evidence: Correspondence[] = [
    { kind: "field", left: "balance", right: "available", source: "DECLARED", asserts: "same", says: "declared", assertions: [101] },
    { kind: "operation", left: "post", right: "postEntry", source: "OBSERVED", asserts: "same", says: "observed", assertions: [201] },
  ];
  const p = match(a, changed, evidence, OBLIGATIONS);
  assert.equal(p.verdict, "NONE", "a changed threshold is a changed program");
  assert.equal(p.confidence, 0);
  assert.equal(p.evidence.length, 0, "no evidence may be cited for a claim that is not made");
});

test("a proposal enters the store as INFERRED, scoped, traceable, and never verified", async () => {
  const { a, b } = await pair();
  const evidence: Correspondence[] = [
    { kind: "field", left: "balance", right: "available", source: "DECLARED", asserts: "same", says: "declared by the owner", assertions: [101] },
    { kind: "operation", left: "post", right: "postEntry", source: "OBSERVED", asserts: "same", says: "observed in two runs", assertions: [201] },
  ];
  const p = match(a, b, evidence, OBLIGATIONS);

  const j = new Journal();
  j.begin("E2-cross");
  const scope = declareScope(j, "ledger", "michael");
  const left = j.concept("executable"); const right = j.concept("executable");
  j.assert({ subject: left.id, relation: "RENDERS_AS", object: literal("identifier", "settle"), attributes: { language: "python" }, source: "PARSED", asserter: "python-adapter/0.1", confidence: 1 });
  j.assert({ subject: right.id, relation: "RENDERS_AS", object: literal("identifier", "settle"), attributes: { language: "typescript" }, source: "PARSED", asserter: "typescript-adapter/0.1", confidence: 1 });
  const id = assertProposal(j, left.id, right.id, p, "match/0.1");
  j.commit();

  const stored = j.liveAssertions().find((x) => x.id === id)!;
  assert.equal(stored.relation, "SUBSTITUTABLE_UNDER");
  assert.equal(stored.source, "INFERRED");
  assert.equal(stored.verification, "NONE", "match must never verify its own proposal");
  assert.ok(stored.confidence < 1, "a proposal from evidence is never certain");
  assert.deepEqual(stored.attributes?.obligations, OBLIGATIONS);
  assert.ok(String(stored.attributes?.evidence).includes("DECLARED"), "the evidence travels with the claim");
  assert.ok(scope.length > 0);

  // and a person with authority raises it; nothing else can
  j.begin("verify");
  const raised = j.assert({
    subject: stored.subject, relation: stored.relation, object: stored.object, attributes: stored.attributes,
    source: "INFERRED", verification: "HUMAN", asserter: "michael", authority: { level: "OWNER", scope },
    confidence: 1, evidence: stored.evidence, supersedes: id,
  });
  j.commit();
  const now = j.liveAssertions().find((x) => x.id === raised)!;
  assert.equal(now.verification, "HUMAN");
  assert.equal(j.history().filter((e) => e.kind === "ASSERT" && (e as { relation?: string }).relation === "SUBSTITUTABLE_UNDER").length, 2, "the INFERRED original survives in history");
});

// ---- the three conditions Michael required: zero opacity, evidence removal, contradictory evidence ----

import { effectProjection, type FunctionIR, type Stmt } from "../../src/ir/index.js";

function opaqueCount(fn: FunctionIR): number {
  let n = 0;
  const walk = (body: Stmt[]): void => {
    for (const s of body) { if (s.kind === "opaque") n++; if (s.kind === "branch") { walk(s.then); walk(s.else); } }
  };
  walk(fn.body);
  return n;
}

test("the E2 programs contain zero opacity, so the known switch and loop gaps cannot confound the result", async () => {
  const { a, b } = await pair();
  const changed = (await ts(CHANGED)).get("settle")!;
  for (const [name, fn] of [["python", a], ["typescript", b], ["control", changed]] as [string, FunctionIR][]) {
    assert.equal(opaqueCount(fn), 0, `${name} must encode with nothing opaque; it has ${opaqueCount(fn)}`);
    assert.ok(effectProjection(fn).length > 0, `${name} must project at least one outcome`);
    const json = JSON.stringify(effectProjection(fn));
    assert.ok(!json.includes('"opaque"'), `${name}'s projection must contain no opaque node`);
    assert.ok(!json.includes('"unknown"'), `${name}'s projection must contain no unknown operand: every operand is traced`);
  }
});

test("evidence removal: retract the declaration and the claim goes with it, in the same transaction", async () => {
  const { a, b } = await pair();
  const j = new Journal();
  j.begin("declare the correspondences");
  const scope = declareScope(j, "ledger", "michael");
  const left = j.concept("executable"); const right = j.concept("executable");
  // The correspondence is itself a claim about two concepts: the two fields are state, the two operations are
  // external. SUBSTITUTABLE_UNDER already means exactly this, so no new relation is needed.
  const balance = j.concept("state"); const available = j.concept("state");
  const post = j.concept("external"); const postEntry = j.concept("external");
  const fieldSame = j.assert({
    subject: balance.id, relation: "SUBSTITUTABLE_UNDER", object: available.id,
    attributes: { obligations: OBLIGATIONS },
    source: "DECLARED", asserter: "michael", authority: { level: "OWNER", scope }, confidence: 1,
    evidence: { says: "balance and available are one account attribute" },
  });
  const opSame = j.assert({
    subject: post.id, relation: "SUBSTITUTABLE_UNDER", object: postEntry.id,
    attributes: { obligations: OBLIGATIONS },
    source: "DECLARED", asserter: "michael", authority: { level: "OWNER", scope }, confidence: 1,
    evidence: { says: "post and postEntry write the same ledger entry" },
  });
  j.commit();

  const evidence: Correspondence[] = [
    { kind: "field", left: "balance", right: "available", source: "DECLARED", asserts: "same", says: "declared", assertions: [fieldSame] },
    { kind: "operation", left: "post", right: "postEntry", source: "DECLARED", asserts: "same", says: "declared", assertions: [opSame] },
  ];
  const p = match(a, b, evidence, OBLIGATIONS);
  assert.equal(p.verdict, "PROBABLE_EQUIVALENT", "with both declarations the claim is proposed");

  j.begin("store the claim");
  const claim = assertProposal(j, left.id, right.id, p, "match/0.1");
  j.commit();
  assert.ok(j.liveAssertions().some((x) => x.id === claim), "the claim is live");

  // the owner withdraws one declaration
  j.begin("withdraw the field declaration");
  const gone = j.retract(fieldSame, { source: "DECLARED", asserter: "michael", evidence: { why: "the fields are not the same attribute after all" } });
  j.commit();

  assert.ok(gone.includes(claim), `retracting the declaration must retract the claim derived from it; retracted ${JSON.stringify(gone)}`);
  assert.equal(j.liveAssertions().some((x) => x.id === claim), false, "the claim must not survive its evidence");
  assert.ok(j.history().some((e) => e.kind === "ASSERT" && e.id === claim), "but the claim stays in history, with what it rested on");

  // and re-running match without that correspondence agrees: the claim is no longer supportable
  const after = match(a, b, evidence.slice(1), OBLIGATIONS);
  assert.notEqual(after.verdict, "PROBABLE_EQUIVALENT");
  assert.ok(after.unresolved.some((u) => /balance and available/.test(u)), "and it says which bridge is missing");
});

test("contradictory evidence: a denial is never outvoted, and both sides are reported", async () => {
  const { a, b } = await pair();
  const contradicted: Correspondence[] = [
    { kind: "field", left: "balance", right: "available", source: "DECLARED", asserts: "same", says: "The owner declared them one attribute.", assertions: [301] },
    { kind: "field", left: "balance", right: "available", source: "OBSERVED", asserts: "different", says: "A run shows the two fields holding different values at the same moment.", assertions: [302] },
    { kind: "operation", left: "post", right: "postEntry", source: "DECLARED", asserts: "same", says: "The owner declared them one entry.", assertions: [303] },
  ];
  const p = match(a, b, contradicted, OBLIGATIONS);
  assert.notEqual(p.verdict, "PROBABLE_EQUIVALENT", "a contradicted bridge cannot carry a claim");
  assert.equal(p.confidence, 0, "and the confidence is zero while the contradiction stands, not merely reduced");
  assert.equal(p.contradictions.length, 1, "the contradiction is reported as its own finding");
  assert.ok(/against/.test(p.contradictions[0]), "with both sides in it");
  assert.ok(p.unresolved.some((u) => /cannot be bridged while the contradiction stands/.test(u)));
});

test("a denial alone, with nothing affirming it, is also a finding and not silence", async () => {
  const { a, b } = await pair();
  const denied: Correspondence[] = [
    { kind: "field", left: "balance", right: "available", source: "DECLARED", asserts: "different", says: "The owner declares these are different attributes.", assertions: [401] },
    { kind: "operation", left: "post", right: "postEntry", source: "DECLARED", asserts: "same", says: "declared", assertions: [402] },
  ];
  const p = match(a, b, denied, OBLIGATIONS);
  assert.equal(p.confidence, 0);
  assert.ok(p.contradictions[0].includes("declared to be different things"), p.contradictions[0]);
});
