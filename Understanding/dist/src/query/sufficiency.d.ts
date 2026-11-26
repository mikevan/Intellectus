import type { ConceptId } from "../concepts/index.js";
import type { Journal } from "../journal/index.js";
export declare const EMITTER_NEEDS: readonly string[];
export type MissingFact = "CALLEE_UNIDENTIFIED" | "RECEIVER_UNIDENTIFIED" | "OPERAND_UNIDENTIFIED" | "EXPRESSION_UNREPRESENTED" | "EFFECT_UNDERSPECIFIED" | "ENTITY_UNREPRESENTED" | "ORDER_UNSPECIFIED" | "TYPE_REQUIRED";
export declare const MISSING_FACT_DEFINITIONS: Readonly<Record<MissingFact, string>>;
/** The pre-registered criteria a thread must meet to qualify. Fixed before any measurement; see the log. */
export interface Qualification {
    executables: number;
    branches: number;
    observableEffects: number;
    boundaryCrossings: number;
    opaqueStatements: number;
    qualifies: boolean;
    failed: string[];
}
export interface ThreadReport {
    /** The entry executable the thread was walked from, by its rendered name. */
    entry: string;
    entryConcept: ConceptId;
    members: string[];
    qualification: Qualification;
    sufficient: boolean;
    missing: {
        fact: MissingFact;
        count: number;
        where: string[];
    }[];
    /** Every missing fact as its own record, so the ranked list is over occurrences rather than kinds. */
    occurrences: {
        fact: MissingFact;
        where: string;
        because: string;
    }[];
    /** R-1B0: pairs of observable effects within the thread's executables, and how many are unordered. */
    order: {
        pairs: number;
        unordered: number;
    };
}
/**
 * R-1B0: order accounting. A pair of observable effects in one executable is FIXED when facts of a relation
 * designated in ORDER_RELATIONS connect the two occurrences on one control path, directly or by a chain. Frozen in
 * the log before this code existed. No relation is designated yet, and effects are stored as literals with no
 * occurrence identity, so nothing could be named by an order fact: every pair is unordered by construction.
 */
export declare const ORDER_RELATIONS: readonly string[];
export interface OrderAccounting {
    orderRelations: readonly string[];
    definition: string;
    /** Executables with two or more observable effects. */
    executables: number;
    pairs: number;
    fixed: number;
    unordered: number;
    limits: string[];
}
export declare const ORDER_DEFINITION = "A pair of observable effects in one executable is fixed when facts of a designated order relation connect the two occurrences on one control path, directly or by a chain.";
export interface SufficiencyReport {
    emitterNeeds: readonly string[];
    /** R-1B0: corpus-wide pairs of observable effects and how many the store fixes. */
    order: OrderAccounting;
    threads: ThreadReport[];
    qualifying: number;
    sufficientThreads: number;
    /** Ranked over occurrences across qualifying threads: the output this round exists to produce. */
    ranked: {
        fact: MissingFact;
        occurrences: number;
        threads: number;
    }[];
    limits: string[];
}
export declare function checkSufficiency(j: Journal): SufficiencyReport;
