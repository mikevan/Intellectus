// Canonical literals: two machines must seed the same store from the same source.
import { test } from "node:test";
import assert from "node:assert/strict";
import { canonNumber, canonPath, canonString } from "../../src/ir/index.js";

test("a path is stored the same way on Windows and on Linux", () => {
  assert.equal(canonPath("src\\journal\\index.ts"), "src/journal/index.ts");
  assert.equal(canonPath("src/journal/index.ts"), "src/journal/index.ts");
  assert.equal(canonPath("./src/ir/index.ts"), "src/ir/index.ts");
  assert.equal(canonPath("c:/workspace/Understanding/src/x.ts"), "C:/workspace/Understanding/src/x.ts");
});

test("numbers canonicalise across spellings", () => {
  for (const spelling of ["25000", "25_000", "25,000", "$25,000", "25000.00", "25000.0", " 25000 "])
    assert.deepEqual(canonNumber(spelling), { type: "number", value: "25000" }, spelling);
  assert.deepEqual(canonNumber("-0.0"), { type: "number", value: "0" });
});

test("a quoted string loses its quotes and nothing else", () => {
  assert.deepEqual(canonString('"ACCOUNT_CLOSED"'), { type: "string", value: "ACCOUNT_CLOSED" });
  assert.deepEqual(canonString("'APPROVED'"), { type: "string", value: "APPROVED" });
});
