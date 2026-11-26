import type { ConceptId } from "../concepts/index.js";
import type { Journal } from "../journal/index.js";
export type LossCategory = "REPRESENTATION_LOSS" | "EXTERNAL_UNMODELED" | "INTERNAL_UNRESOLVED" | "INTERNAL_AMBIGUOUS" | "INTERNAL_NONEXECUTABLE" | "RECEIVER_UNRESOLVED" | "DYNAMIC" | "UNKNOWN";
/** Categories frozen on 2026-09-14 before any occurrence was read; see docs/experiment-log.md, E3-loss-2. */
export declare const CATEGORY_DEFINITIONS: Readonly<Record<LossCategory, string>>;
/** The only knowledge in this file that does not come from the corpus. Every entry carries where it came from and
 * what kind of claim it is, because a classification resting on an undeclared belief is not a measurement. */
export declare const EXTERNAL_KNOWLEDGE: {
    readonly operations: readonly string[];
    readonly source: string;
    readonly status: "DECLARED_BY_AUTHOR";
    readonly note: string;
};
/** The second and last piece of knowledge from outside the store. A class declared in the corpus is visible in the
 * corpus text and absent from the store, because the encoder produces functions and the store has no concept for a
 * class, so the classifier cannot read these from the evidence it is classifying. Declared here with its source so
 * an INTERNAL_NONEXECUTABLE classification can be audited, and confined to class names that appear in the two
 * committed corpora. */
export declare const DECLARED_CLASSES: {
    readonly names: readonly string[];
    readonly source: string;
    readonly status: "DECLARED_BY_AUTHOR";
    readonly note: string;
};
export interface LossRecord {
    category: LossCategory;
    operation: string;
    /** The executable the call site sits in, for auditing. */
    caller: ConceptId;
    invocation: ConceptId;
    /** What this unresolved call prevented: its arguments, its outcome, and the flows that could not be written. */
    arguments: number;
    outcome: 1;
    /** Flows a resolved callee would have produced: one per argument plus one for the return. */
    lostFlows: number;
    /** Why this category and not another, in one sentence. */
    because: string;
    /** For EXTERNAL_UNMODELED: the declared knowledge it rests on. Empty for every other category. */
    restsOn?: string;
}
export interface LossReport {
    invocations: number;
    resolved: number;
    classified: number;
    byCategory: Record<LossCategory, {
        occurrences: number;
        arguments: number;
        lostFlows: number;
        operations: string[];
    }>;
    records: LossRecord[];
    externalKnowledge: typeof EXTERNAL_KNOWLEDGE;
    declaredClasses: typeof DECLARED_CLASSES;
    /** Stated limits of this instrument, printed with its output. */
    limits: string[];
}
/** Classify from the store alone: the invocations, their arguments, their operations, and which names the corpus
 * declares. An operation is DYNAMIC only when the IR recorded that the callee came from a value. */
export declare function classifyLoss(j: Journal): LossReport;
