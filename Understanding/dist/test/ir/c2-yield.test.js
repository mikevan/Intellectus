// C-2. `other` was not a category; it was a failure to understand. Every one of radon's 23 was a `yield`, and a
// yield does two different jobs: a generator hands a value to a consumer, and a @contextmanager hands a resource to
// the caller's scope and resumes to release it. These tests pin the distinction AND its evidence rule: only the
// declared decorator justifies the handoff classification. Nothing here represents a yield; both remain opaque.
import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctions } from "../../src/adapters/python/index.js";
const categories = async (source, fn) => (await encodeFunctions(source)).get(fn).body.filter((s) => s.kind === "opaque").map((s) => s.category);
test("a generator's yield is value-stream emission", async () => {
    const c = await categories("def gen(xs):\n    yield xs\n", "gen");
    assert.deepEqual(c, ["value-stream-emission"]);
});
test("a @contextmanager's yield is scoped resource handoff", async () => {
    const c = await categories("@contextmanager\ndef opened(p):\n    yield p\n", "opened");
    assert.deepEqual(c, ["scoped-resource-handoff"]);
});
test("a dotted decorator is the same declaration", async () => {
    const c = await categories("@contextlib.contextmanager\ndef opened(p):\n    yield p\n", "opened");
    assert.deepEqual(c, ["scoped-resource-handoff"]);
});
test("the negative control: shape never justifies handoff, only the declaration does", async () => {
    // One yield, wrapped in try/finally, named like a resource: everything a shape-based rule would take as a context
    // manager, and no decorator. It stays emission.
    const source = "def opened(p):\n    fh = open(p)\n    try:\n        yield fh\n    finally:\n        fh.close()\n";
    const c = await categories(source, "opened");
    assert.ok(!c.includes("scoped-resource-handoff"), "no try/finally, single-yield, or naming heuristic may produce a handoff");
});
test("a decorator that is not contextmanager leaves the yield as emission", async () => {
    const c = await categories("@staticmethod\ndef gen(xs):\n    yield xs\n", "gen");
    assert.deepEqual(c, ["value-stream-emission"]);
});
test("the classification is evidence of a declaration, not of program semantics, and the limitation is real", async () => {
    // An alias, an imported rename, a wrapper, or a hand-written context manager is NOT recognised. This test pins
    // that limitation as a known property of C-2 rather than leaving it as an assumption.
    const aliased = await categories("@cm\ndef opened(p):\n    yield p\n", "opened");
    assert.deepEqual(aliased, ["value-stream-emission"], "an aliased decorator is not recognised by the name rule");
});
test("C-2 represents nothing: both kinds of yield are still opaque and still semantic", async () => {
    const fn = (await encodeFunctions("@contextmanager\ndef opened(p):\n    yield p\n")).get("opened");
    const y = fn.body.find((s) => s.kind === "opaque");
    assert.equal(y.statementClass, "SEMANTIC", "a yield is execution behaviour and still counts toward opacity");
    assert.equal(y.kind, "opaque", "naming a construct is not representing it");
});
test("the IR's category vocabulary carries both names, and `other` still exists for what is still not understood", async () => {
    const { OPAQUE_CATEGORIES } = await import("../../src/ir/index.js");
    for (const c of ["value-stream-emission", "scoped-resource-handoff", "other"])
        assert.ok(OPAQUE_CATEGORIES.includes(c));
});
