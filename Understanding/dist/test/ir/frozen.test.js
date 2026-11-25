// IR-4 is frozen. The encoder is not to change while E2 is being run, so that no E2 result can be the product of
// an IR tuned to produce it. This test fails if any of the three encoder files differs from its frozen copy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const PAIRS = [
    ["src/ir/index.ts", "frozen-ir4/ir-index.ts"],
    ["src/adapters/python/index.ts", "frozen-ir4/python-index.ts"],
    ["src/adapters/typescript/index.ts", "frozen-ir4/typescript-index.ts"],
];
const digest = (p) => createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16);
test("the IR-4 encoder is unchanged: no E2 result may come from a tuned IR", () => {
    for (const [live, frozen] of PAIRS)
        assert.equal(digest(live), digest(frozen), `${live} differs from its frozen IR-4 copy. If the change is intended, it is a new IR version and E2 must be re-run against it.`);
});
