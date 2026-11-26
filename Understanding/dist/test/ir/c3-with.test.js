// C-3. A `with` was filed under exception-handling, which described the wrong thing: releasing on an exception is a
// consequence of the resource's lifetime, not the purpose of the construct. It is the consumer side of the protocol
// whose implementer side C-2 named: a scope acquires a resource, runs under its lifetime, and releases it on every
// exit. The two stay separate categories, because merging them would erase which side of the protocol a statement
// is on. Classification only: no lifecycle semantics are represented here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctions } from "../../src/adapters/python/index.js";
const categories = async (source, fn) => (await encodeFunctions(source)).get(fn).body.filter((s) => s.kind === "opaque").map((s) => s.category);
test("a with statement is a scoped resource, not exception handling", async () => {
    const c = await categories("def f(p):\n    with open(p) as fh:\n        return fh.read()\n", "f");
    assert.deepEqual(c, ["scoped-resource"]);
});
test("async with is the same role: the category says what the construct does, not how execution proceeds", async () => {
    const c = await categories("async def f(p):\n    async with acquire(p) as fh:\n        return fh\n", "f");
    assert.deepEqual(c, ["scoped-resource"], "asynchrony is an orthogonal dimension and gets no category of its own");
});
test("try stays exception handling", async () => {
    const c = await categories("def f(p):\n    try:\n        return read(p)\n    except OSError:\n        return None\n", "f");
    assert.deepEqual(c, ["exception-handling"]);
});
test("the negative control: try/finally that acquires and releases by hand is not a scoped resource", async () => {
    // Same behaviour as a with, written out: acquire, use, release on every exit. It is still a try, and the
    // classifier must not infer the role from behaviour that resembles one.
    const source = "def f(p):\n    fh = open(p)\n    try:\n        return fh.read()\n    finally:\n        fh.close()\n";
    const c = await categories(source, "f");
    assert.deepEqual(c, ["exception-handling"], "resemblance is not a declaration and never produces scoped-resource");
});
test("the negative control: open and close calls in an ordinary block are calls, not a scoped resource", async () => {
    const source = "def f(p):\n    fh = open(p)\n    data = fh.read()\n    fh.close()\n    return data\n";
    const c = await categories(source, "f");
    assert.deepEqual(c, [], "nothing here is opaque at all, and naming or shape never manufactures a category");
});
test("C-3 represents nothing: a with is still opaque, still semantic, and still counts toward opacity", async () => {
    const fn = (await encodeFunctions("def f(p):\n    with open(p) as fh:\n        return fh.read()\n")).get("f");
    const w = fn.body.find((s) => s.kind === "opaque");
    assert.equal(w.kind, "opaque");
    assert.equal(w.statementClass, "SEMANTIC");
    assert.equal(w.category, "scoped-resource");
});
test("the two sides of the protocol keep separate identities", async () => {
    const { OPAQUE_CATEGORIES } = await import("../../src/ir/index.js");
    for (const c of ["scoped-resource", "scoped-resource-handoff"])
        assert.ok(OPAQUE_CATEGORIES.includes(c));
    const provider = await categories("@contextmanager\ndef opened(p):\n    yield p\n", "opened");
    const consumer = await categories("def use(p):\n    with opened(p) as fh:\n        return fh\n", "use");
    assert.deepEqual(provider, ["scoped-resource-handoff"], "the implementer hands a resource into a caller's scope");
    assert.deepEqual(consumer, ["scoped-resource"], "the consumer holds the scope the resource lives in");
    assert.notDeepEqual(provider, consumer, "one protocol, two roles, two categories");
});
