import { Journal } from "../journal/index.js";
export interface IngestReport {
    files: number;
    modules: number;
    executables: number;
    assertions: number;
    byRelation: Record<string, number>;
    /** Names a call site could not be resolved to a concept in this corpus, with how many times. */
    unresolvedCalls: Record<string, number>;
    resolvedCalls: number;
    /** IR-6 Composition. */
    invocations: number;
    values: number;
    flows: number;
    /** Call sites whose callee did not resolve: recorded, never guessed. */
    unresolvedInvocations: number;
    ambiguousInvocations: number;
    /** I-0 accounting. An invocation whose only candidate callee is the caller itself: direct recursion. No CALLS
     * edge is written for it (a self-loop says nothing about composition), so it belongs to none of the three
     * buckets above and used to be the invocation that made their sum one short of `invocations`. */
    selfInvocations: number;
    /** I-0 accounting. Call sites merged by the effect/bind rule above: one call in the source reported twice by the
     * projection becomes one invocation. The difference between invocations in the store and receiver or call
     * occurrences read straight from the IR is accounted for here and nowhere else. */
    sitesMerged: number;
    /** I-0 accounting. Of the merged sites, those carrying a receiver: the whole difference between the store’s
     * receiver arguments and the receiver occurrences the producer instrument reads from the IR. */
    sitesMergedWithReceiver: number;
    /** I-0 accounting. Receiver-bearing call sites read straight from the semantic projection, before the merge:
     * the population the producer instrument counts. */
    receiverSitesFromProjection: number;
    /** I-0 accounting. Receiver-bearing call sites the ingestion additionally finds inside returned and thrown
     * operands, which the producer instrument does not walk. The two receiver totals differ by this and the merge. */
    receiverSitesFromOperand: number;
    /** I-0 accounting. HAS_ARGUMENT assertions carrying role=receiver: the population the origin instrument reads. */
    receiverArguments: number;
}
export declare function ingest(j: Journal, files: string[], corpusRoot: string): Promise<IngestReport>;
