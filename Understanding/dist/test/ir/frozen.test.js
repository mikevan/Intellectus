// The encoder in force is frozen, so that no experimental result can be the product of an encoder tuned to produce
// it. IR-4 was frozen while E2-cross was first run; IR-5 replaced it on 2026-09-14 by a deliberate act, recorded in
// docs/experiment-log.md, and E2-cross was re-run against it. frozen-ir4/ is kept as the encoder that E2's first
// result belongs to. This test fails if any live encoder file differs from its frozen IR-5 copy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
// An encoder version identifies a semantic change to THAT encoder, not a project-wide milestone. C-2 to C-4 changed
// the Python adapter and the IR's category vocabulary and left the TypeScript adapter frozen at IR-9. C-5 is a
// shared language-neutral classification and changed both adapters, so all three files are frozen at C-5.
// R-1A changed all three: the IR gained a representation, and both adapters produce it.
const PAIRS = [
    ["src/ir/index.ts", "frozen-r1a/ir-index.ts"],
    ["src/adapters/python/index.ts", "frozen-r1a/python-index.ts"],
    ["src/adapters/typescript/index.ts", "frozen-r1a/typescript-index.ts"],
];
const digest = (p) => createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 16);
test("the earlier frozen encoders are kept, so an earlier result still has an encoder to belong to", () => {
    for (const v of ["ir4", "ir5", "ir7", "ir9"])
        for (const f of ["ir-index.ts", "python-index.ts", "typescript-index.ts"])
            assert.ok(digest(`frozen-${v}/${f}`).length === 16, `frozen-${v}/${f} must remain in the repository`);
    // A C-step freezes only the files it changed, which for C-2 and C-3 is the Python adapter and the IR's category
    // vocabulary. The TypeScript adapter is still frozen at IR-9 because C-2 and C-3 did not touch it.
    for (const v of ["c2", "c3", "c4"])
        for (const f of ["ir-index.ts", "python-index.ts"])
            assert.ok(digest(`frozen-${v}/${f}`).length === 16, `frozen-${v}/${f} must remain in the repository`);
    assert.notEqual(digest("frozen-ir4/python-index.ts"), digest("frozen-ir5/python-index.ts"), "IR-5 changed the Python adapter");
    assert.notEqual(digest("frozen-ir5/ir-index.ts"), digest("frozen-ir7/ir-index.ts"), "IR-7 changed the IR");
    assert.notEqual(digest("frozen-ir7/ir-index.ts"), digest("frozen-ir9/ir-index.ts"), "IR-9 changed the IR; if these match, the freeze was not the deliberate act it is recorded as");
    assert.notEqual(digest("frozen-ir9/python-index.ts"), digest("frozen-c2/python-index.ts"), "C-2 changed the Python adapter");
    assert.notEqual(digest("frozen-c2/python-index.ts"), digest("frozen-c3/python-index.ts"), "C-3 changed the Python adapter again");
    assert.notEqual(digest("frozen-c3/python-index.ts"), digest("frozen-c4/python-index.ts"), "C-4 changed the Python adapter again");
    assert.notEqual(digest("frozen-c3/ir-index.ts"), digest("frozen-c4/ir-index.ts"), "C-4 added local-function-construction to the vocabulary");
    for (const f of ["ir-index.ts", "python-index.ts", "typescript-index.ts"])
        assert.ok(digest(`frozen-c5/${f}`).length === 16, `frozen-c5/${f} must remain in the repository`);
    assert.notEqual(digest("frozen-c4/python-index.ts"), digest("frozen-c5/python-index.ts"), "C-5 changed the Python adapter");
    assert.notEqual(digest("frozen-ir9/typescript-index.ts"), digest("frozen-c5/typescript-index.ts"), "C-5 is the first C-step to change the TypeScript adapter");
    assert.notEqual(digest("frozen-c4/ir-index.ts"), digest("frozen-c5/ir-index.ts"), "C-5 added completion-dependency to the vocabulary");
    for (const f of ["ir-index.ts", "python-index.ts", "typescript-index.ts"]) {
        assert.ok(digest(`frozen-r1a/${f}`).length === 16, `frozen-r1a/${f} must remain in the repository`);
        assert.notEqual(digest(`frozen-c5/${f}`), digest(`frozen-r1a/${f}`), `R-1A changed ${f}: the first representational change since IR-9`);
    }
    assert.notEqual(digest("frozen-c2/ir-index.ts"), digest("frozen-c3/ir-index.ts"), "C-3 added the consumer-side category to the vocabulary");
    assert.notEqual(digest("frozen-ir9/ir-index.ts"), digest("frozen-c2/ir-index.ts"), "C-2 widened the IR's category vocabulary");
    // Until C-5 the live TypeScript adapter matched frozen-ir9 byte for byte; C-5 moved it to 0.4 and it is checked
    // against frozen-c5 by the PAIRS test above.
});
test("the encoder in force is unchanged: no experimental result may come from a tuned encoder", () => {
    for (const [live, frozen] of PAIRS)
        assert.equal(digest(live), digest(frozen), `${live} differs from its frozen copy ${frozen}. If the change is intended, it is a new encoder version: copy the files to frozen-ir<n>, point this test at it, append a row to every corpus, and re-run E2-cross against it.`);
});
