// R-1B0: the order accounting is an instrument. These tests pin its arithmetic and its scope, so that R-1B2 changes
// the counts only by adding real order facts, never by changing how pairs are counted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Journal } from "../../src/journal/index.js";
import { ingest } from "../../src/ingest/index.js";
import { checkSufficiency, ORDER_RELATIONS } from "../../src/query/sufficiency.js";
async function reportFor(source) {
    const dir = mkdtempSync(join(tmpdir(), "r1b0-"));
    const file = join(dir, "m.ts");
    writeFileSync(file, source);
    const j = new Journal();
    j.begin("r1b0");
    await ingest(j, [file], dir);
    j.commit();
    return checkSufficiency(j);
}
test("no relation is designated as an order relation in R-1B0", () => {
    assert.deepEqual([...ORDER_RELATIONS], []);
});
test("three observable effects in one executable are three pairs, all unordered", async () => {
    const r = await reportFor("export function f(a: any) { a.x(); a.y(); a.z(); }");
    assert.equal(r.order.executables, 1);
    assert.equal(r.order.pairs, 3);
    assert.equal(r.order.unordered, 3);
    assert.equal(r.order.fixed, 0);
});
test("one observable effect forms no pair and raises no ORDER_UNSPECIFIED", async () => {
    const r = await reportFor("export function f(a: any) { a.x(); return 1; }");
    assert.equal(r.order.pairs, 0);
    assert.equal(r.order.executables, 0);
    assert.ok(r.threads.every((t) => !t.occurrences.some((o) => o.fact === "ORDER_UNSPECIFIED")));
});
test("effects in different executables never form a pair", async () => {
    const r = await reportFor("export function f(a: any) { a.x(); }\nexport function g(a: any) { a.y(); }");
    assert.equal(r.order.pairs, 0);
});
test("bindings, returns, and completion dependencies never enter the count", async () => {
    const r = await reportFor("export async function f(a: any) { const v = 1; const w = v + 1; await a.x(); return w; }");
    assert.equal(r.order.pairs, 0, "one observable effect, the awaited call; its dependency outcome is not an effect");
});
test("the limits travel with the report", async () => {
    const r = await reportFor("export function f(a: any) { a.x(); a.y(); }");
    assert.equal(r.order.limits.length, 3);
    assert.ok(r.order.limits.some((l) => /occurrence identity/.test(l)));
    assert.ok(r.order.limits.some((l) => /mutually exclusive branches/.test(l)));
});
