/**
 * What used to live here: two brief builders, deleted in Phase 5.
 *
 * `buildBrief` and `buildFunctionBrief` assembled prose and handed it to an
 * assistant through the clipboard and the editor chat. Nothing recorded what
 * limits travelled, nothing validated what came back, and the confirmation in
 * front of them told the person the assistant "may change your code and your
 * tests", which under diff-only is not what happens at all.
 *
 * They were **deleted rather than wrapped**, because hand-written prose
 * inside a governed packet is the thing rule 87 was written about: a sentence
 * written by hand is a sentence nothing checks against the limits actually in
 * force, and the drift would live one layer below where rule 93 can see it.
 *
 * What replaced them is `agent/packets.ts`, which turns the measured evidence
 * into the ten fields, and Witness's `authorizationBrief`, which generates
 * what the person reads from that packet.
 *
 * Only the mode survives, because the person still chooses between two
 * different pieces of work, and that choice now selects between two
 * registered interactions rather than two paragraphs.
 */

/**
 * The two honest answers to a function that is harder to test than the limit.
 *
 * `test` writes tests for every way through it as it is.
 * `refactor` breaks it into smaller pieces without changing what it does.
 *
 * They are different work under different constraints with different
 * verification, which is why they are two registered interactions and not one
 * with a flag.
 */
export type FunctionFixMode = 'test' | 'refactor';
