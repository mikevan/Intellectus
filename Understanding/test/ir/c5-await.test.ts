// C-5. The last `other` in any corpus was `await ready;` at ir0-typescript adapters/treeSitter.ts line 11. The
// adapter unwrapped the await, found a bare identifier, and had nothing to say. What the syntax proves is that
// continuation past the statement depends on completion of the awaited computation, so that is the category.
//
// The boundary is the point of this file. C-5 names the dependency ONLY where no richer representation exists. A
// standalone `await foo()` stays a represented call effect with its await erased, `x = await foo()` stays a
// binding, `return await foo()` stays a return. Those three erasures are the evidence R-1 opens on: await is not
// yet a composable property of an expression in this IR, and C-5 must not buy a label with a represented fact.
import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctions as py } from "../../src/adapters/python/index.js";
import { encodeFunctions as ts } from "../../src/adapters/typescript/index.js";
import type { Stmt } from "../../src/ir/index.js";

const body = async (enc: typeof ts, source: string, fn = "f"): Promise<Stmt[]> => (await enc(source)).get(fn)!.body;
const kinds = (b: Stmt[]) => b.map((s) => (s.kind === "opaque" ? `opaque:${s.category}` : s.kind));

test("control 1: a plain call statement is a represented call effect", async () => {
  assert.deepEqual(kinds(await body(ts, "async function f(x) { foo(x); }")), ["effect"]);
  assert.deepEqual(kinds(await body(py, "async def f(x):\n    foo(x)\n")), ["effect"]);
});

// Under C-5 this control asserted the ERASURE: the awaited call encoded as a plain effect, identical to the unawaited
// call. R-1A flipped it by design (frozen negative control N1). The call is still represented; the dependency now is too.
test("control 2 (flipped by R-1A): a standalone awaited call keeps its call and gains its completion dependency", async () => {
  const t = await body(ts, "async function f(x) { await foo(x); }");
  const p = await body(py, "async def f(x):\n    await foo(x)\n");
  assert.deepEqual(kinds(t), ["evaluate"], "the scoped carrier for a standalone awaited expression");
  assert.deepEqual(kinds(p), ["evaluate"]);
  assert.notDeepEqual(t, await body(ts, "async function f(x) { foo(x); }"), "N1: no longer identical to the unawaited call");
});

// Under C-5 this was an opaque `completion-dependency` statement. R-1A represents it: the legacy category is never
// emitted by a schema-6 adapter.
test("control 3 (superseded by R-1A): a standalone await of a non-call is represented, not opaque", async () => {
  assert.deepEqual(kinds(await body(ts, "async function f(ready) { await ready; }")), ["evaluate"]);
});

test("control 4: Python and TypeScript agree on both standalone forms", async () => {
  // Under C-5 this line asserted the opaque legacy category; R-1A represents the statement (superseded by design).
  assert.deepEqual(kinds(await body(py, "async def f(ready):\n    await ready\n")), ["evaluate"]);
  assert.deepEqual(kinds(await body(py, "async def f(x):\n    await foo(x)\n")), kinds(await body(ts, "async function f(x) { await foo(x); }")));
  assert.deepEqual(kinds(await body(py, "async def f(r):\n    await r\n")), kinds(await body(ts, "async function f(r) { await r; }")));
});

// Under C-5 this asserted that TypeScript erased the await in a binding and that Python lost the call as well.
// R-1A flipped both by design (frozen N2 and X1).
test("control 5 (flipped by R-1A): a bound await stays a binding, keeps the call, and is distinguishable", async () => {
  const t = await body(ts, "async function f(x) { const y = await foo(x); return y; }");
  assert.deepEqual(kinds(t), ["bind", "return"]);
  assert.notDeepEqual(t, await body(ts, "async function f(x) { const y = foo(x); return y; }"), "N2");
  const p = await body(py, "async def f(x):\n    y = await foo(x)\n    return y\n");
  assert.deepEqual(kinds(p), ["bind", "return"]);
  assert.equal(p[0]!.kind === "bind" && p[0]!.expr.kind, "awaited", "X1: Python now keeps the call under the dependency");
});

// Under C-5 this asserted the returned await was identical to the unawaited return. Flipped by R-1A (frozen N3).
test("control 6 (flipped by R-1A): a returned await stays on the return path and is distinguishable", async () => {
  const t = await body(ts, "async function f(x) { return await foo(x); }");
  assert.deepEqual(kinds(t), ["return"]);
  assert.notDeepEqual(t, await body(ts, "async function f(x) { return foo(x); }"), "N3");
});

test("control 7: async context alone creates no completion dependency; the explicit await is the evidence", async () => {
  assert.deepEqual(kinds(await body(ts, "async function f(x) { foo(x); return x; }")), ["effect", "return"]);
  assert.deepEqual(kinds(await body(py, "async def f(x):\n    foo(x)\n    return x\n")), ["effect", "return"]);
});

// Under C-5: ["effect", "bind", "return"] with every await missing. Under R-1A the standalone form uses the scoped
// `evaluate` carrier; nothing represented was removed (frozen monotonicity, tested at the projection level in r1a-await).
test("C-5's closing count, as R-1A leaves it: every awaited call is still represented, and now so is each dependency", async () => {
  const t = await body(ts, "async function f(x) { await foo(x); const y = await bar(x); return await baz(y); }");
  assert.deepEqual(kinds(t), ["evaluate", "bind", "return"]);
});
