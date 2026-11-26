import type { ConceptId } from "../concepts/index.js";
import type { AssertEvent, Journal } from "../journal/index.js";
export type Outcome = "FOUND" | "NOT_FOUND" | "UNKNOWN" | "AMBIGUOUS" | "CONTRADICTED";
export interface Step {
    from: ConceptId;
    relation: string;
    to: ConceptId;
    assertion: number;
}
export interface Derivation {
    outcome: Outcome;
    /** The steps, in order, when FOUND. */
    path: Step[];
    /** Every PARSED assertion the path rests on. Pass these as derived_from when storing a conclusion. */
    supporting: number[];
    /** Assertions that contradict a step, when CONTRADICTED. */
    conflicting: number[];
    /** One plain sentence saying what happened, for a person reading a report. */
    says: string;
}
export interface DeriveOptions {
    /** Only these relations may be traversed. There is no default: a search must say what it is allowed to follow. */
    allowedRelations: string[];
    /** Follow inverses as well as forwards. Off by default: direction is usually part of the question. */
    bidirectional?: boolean;
    maxDepth?: number;
    /** A step must rest on an assertion from one of these sources. Defaults to PARSED alone, which is what makes a
     * derivation a derivation rather than a restatement of something somebody declared. */
    allowedSources?: AssertEvent["source"][];
}
export declare function derivePath(j: Journal, start: ConceptId, end: ConceptId, options: DeriveOptions): Derivation;
/** The single concept a relation points to from `from`, or why it cannot be named. Never a guess. */
export declare function only(j: Journal, from: ConceptId, relation: string, attributes?: Record<string, unknown>): {
    outcome: "FOUND" | "UNKNOWN" | "AMBIGUOUS";
    concept?: ConceptId;
    assertion?: number;
    says: string;
};
