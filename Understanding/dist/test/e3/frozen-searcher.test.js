// The path searcher was written and frozen before any corpus ground truth was established, so that "semantic path"
// could not come to mean whatever connects an answer already known. This test fails if it changes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
test("the E3 path searcher is unchanged since it was frozen", () => {
    const d = (p) => createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16);
    assert.equal(d("src/query/derive.ts"), d("frozen-e3/derive.ts"), "derive.ts differs from its frozen copy. A searcher changed after ground truth exists is apparatus tuned to an answer; if the change is intended, record it in the log and re-run every E3 control.");
});
