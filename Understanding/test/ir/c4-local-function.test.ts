// C-4. A nested `def` was filed under declaration, which described it as a piece of static structure. Executing it
// constructs a function value and binds it in the enclosing scope, which is behaviour. The category says exactly
// that and no more.
//
// It is NOT called closure construction, and the reason is measured rather than assumed: of radon's six nested
// defs, only three capture an enclosing binding (`read_or_stop` takes `readline`, `find_cookie` takes `filename`
// and `bom_found`, `visitors.aux` takes `meth`). The other three capture nothing at all. Capture is a property of
// the constructed callable and its environment, it is derivable from source syntax but not from this IR, which
// keeps no identifiers, and it therefore belongs to a later representation step. See the C-4 log entry.
import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctions } from "../../src/adapters/python/index.js";
import type { Stmt } from "../../src/ir/index.js";

const categories = async (source: string, fn: string): Promise<string[]> =>
  ((await encodeFunctions(source)).get(fn)!.body as Stmt[]).filter((s) => s.kind === "opaque").map((s) => s.category);

test("a nested def is local function construction", async () => {
  const c = await categories("def outer(a):\n    def inner(b):\n        return b + a\n    return inner(a)\n", "outer");
  assert.deepEqual(c, ["local-function-construction"]);
});

test("a nested def that captures nothing is still local function construction", async () => {
  // radon's caching_iterator, get_type and raw.aux are the real instances: they read only their own parameters and
  // module-level names. The category is about the construction, not about what the callable closes over.
  const c = await categories("def outer(xs):\n    def inner(it, r):\n        return r(it)\n    return inner(xs, len)\n", "outer");
  assert.deepEqual(c, ["local-function-construction"]);
});

test("the negative control: a module-level def is not local function construction", async () => {
  const found = await encodeFunctions("def top(a):\n    return a\n\ndef other(b):\n    return b\n");
  assert.deepEqual([...found.keys()].sort(), ["other", "top"], "each is an executable of its own");
  for (const [, ir] of found) assert.equal(ir.body.filter((s) => s.kind === "opaque").length, 0, "nothing is constructed inside another scope, so nothing is classified");
});

test("the negative control: a class-body def is a method, not local function construction", async () => {
  const found = await encodeFunctions("class A:\n    def m(self, x):\n        return x\n");
  assert.deepEqual([...found.keys()], ["m"], "the method is an executable of its own");
  assert.equal(found.get("m")!.body.filter((s) => s.kind === "opaque").length, 0);
});

test("the negative control: a nested class is not local function construction", async () => {
  // toml-python's single declaration is exactly this case, at decoder.py line 644, and C-4 leaves it alone.
  const c = await categories("def outer(a):\n    class Inner:\n        pass\n    return Inner\n", "outer");
  assert.deepEqual(c, ["declaration"], "a constructed class is an entity question, not a function construction");
});

test("C-4 represents nothing: the construction is still opaque, still semantic", async () => {
  const fn = (await encodeFunctions("def outer(a):\n    def inner(b):\n        return b + a\n    return inner(a)\n")).get("outer")!;
  const d = fn.body.find((s) => s.kind === "opaque")!;
  assert.equal(d.kind, "opaque");
  assert.equal(d.statementClass, "SEMANTIC");
  assert.equal(d.category, "local-function-construction");
});

test("the nested function is still encoded as an executable of its own, so its body is not hidden", async () => {
  const found = await encodeFunctions("def outer(a):\n    def inner(b):\n        return b + a\n    return inner(a)\n");
  assert.deepEqual([...found.keys()].sort(), ["inner", "outer"], "I-1 depends on this: the body is represented elsewhere");
});
