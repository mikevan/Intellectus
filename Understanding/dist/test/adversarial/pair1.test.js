// The corpus is designed to make the two adapters disagree. Each pair is the same behaviour in different structure.
// Success: the same effect projection (every effect with the path condition under which it happens) and the same fingerprint.
import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctions as py } from "../../src/adapters/python/index.js";
import { encodeFunctions as ts } from "../../src/adapters/typescript/index.js";
import { effectProjection, fingerprint } from "../../src/ir/index.js";
async function same(name, pySrc, tsSrc) {
    const a = (await py(pySrc)).get(name);
    const b = (await ts(tsSrc)).get(name);
    assert.ok(a && b, `both adapters must find ${name}`);
    assert.deepEqual(effectProjection(a), effectProjection(b), `${name}: effect projections differ`);
    assert.equal(fingerprint(a), fingerprint(b), `${name}: fingerprints differ`);
}
test("pair 1: a conjunction in Python against an early-return chain in TypeScript, Decimal and enum spellings", async () => {
    await same("close", `from decimal import Decimal
def close(amount, status):
    if amount > Decimal("25000.00") and status == "APPROVED":
        publish("ACCOUNT_CLOSED")
`, `enum Status { Approved = "APPROVED", Pending = "PENDING" }
enum AccountEvents { Closed = "ACCOUNT_CLOSED" }
async function close(amount: number, status: Status) {
  if (status !== Status.Approved) return;
  if (amount <= 25_000) return;
  await events.publish(AccountEvents.Closed);
}
`);
});
test("pair 2: five spellings of one constant fingerprint the same", async () => {
    const p = await py(`def a(x):\n    if x > 25000:\n        emit("E")\n\ndef b(x):\n    if x > 25_000:\n        emit("E")\n\ndef c(x):\n    if x > Decimal("25000.00"):\n        emit("E")\n\ndef d(x):\n    if x > 25000.0:\n        emit("E")\n`);
    const t = await ts(`function e(x: number) { if (x > 25_000.00) { emit("E"); } }`);
    const fps = new Set([...["a", "b", "c", "d"].map((k) => fingerprint(p.get(k))), fingerprint(t.get("e"))]);
    assert.equal(fps.size, 1, `expected one fingerprint, got ${[...fps].join(", ")}`);
});
test("pair 3: None against null-or-undefined, with the guard inverted", async () => {
    await same("greet", `def greet(user):
    if user is None:
        return
    say("HELLO")
`, `function greet(user?: User) {
  if (user !== null && user !== undefined) {
    say("HELLO");
  }
}
`);
});
test("pair 4: nested conditional against a flat early-return chain", async () => {
    await same("check", `def check(a, b):
    if a > 1:
        if b == "OK":
            emit("GO")
`, `function check(a: number, b: string) {
  if (a <= 1) return;
  if (b !== "OK") return;
  emit("GO");
}
`);
});
test("a real difference is still a difference: 25000 against 50000", async () => {
    const p = (await py(`def f(x):\n    if x > 25000:\n        emit("E")\n`)).get("f");
    const t = (await ts(`function f(x: number) { if (x > 50000) emit("E"); }`)).get("f");
    assert.notEqual(fingerprint(p), fingerprint(t));
});
test("a different effect is a different function, whatever the control flow", async () => {
    const p = (await py(`def f(x):\n    if x > 1:\n        emit("A")\n`)).get("f");
    const t = (await ts(`function f(x: number) { if (x > 1) emit("B"); }`)).get("f");
    assert.notEqual(fingerprint(p), fingerprint(t));
});
