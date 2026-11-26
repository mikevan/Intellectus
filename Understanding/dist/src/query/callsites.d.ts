import type { Journal } from "../journal/index.js";
import { type FunctionIR, type Operand, type Predicate } from "../ir/index.js";
export type Carrier = "effect" | "bind" | "evaluate" | "return" | "throw" | "argument" | "receiver" | "predicate" | "expression";
export type UnmatchedReason = "nested-argument" | "receiver" | "predicate" | "expression-operand" | "behaviour" | "unreachable" | "no-operation";
export type RowClass = "wrapper" | "grouping-merge" | "grouping-duplication" | "ingestion-discrepancy" | "other";
export type Mapping = "unique" | "multiplicity" | "ambiguous" | "coarse-ambiguous";
/** One call expression or CALL_EXTERNAL effect statement in the canonicalised IR. */
export interface Occurrence {
    path: string;
    carrier: Carrier;
    wrapper: string[];
    operation: string | null;
    args: Operand[];
    receiver?: Operand;
    under: Predicate | null;
    reachable: boolean;
    inBehaviour: boolean;
    key: string | null;
    coarse: string | null;
    statementLevel: boolean;
    inRule: boolean;
    returned: boolean;
    reason?: UnmatchedReason;
}
/** One projected site key, with the outcomes that fell in each group of the effect/bind rule. */
export interface ProjectedKey {
    key: string;
    coarse: string;
    operation: string;
    count: number;
    pseudo: boolean;
    effects: string[];
    binds: string[];
    kept: "effects" | "binds";
    dropped: number;
}
export interface Step {
    kind: "call" | "write" | "emit" | "opaque";
    match: string;
    returned: boolean;
    path: string;
}
export interface ExecutableReport {
    file: string;
    name: string;
    ordinal: number;
    counts: {
        O: number;
        Opp: number;
        S: number;
        P: number;
        T: number;
        pseudoP: number;
        pseudoT: number;
    };
    visibility: {
        valuelessThrows: number;
        opaqueStatements: number;
    };
    rows: Row[];
    mappings: Mapping[];
    keysByMapping: Record<Mapping, number>;
    unmatched: {
        path: string;
        operation: string | null;
        carrier: Carrier;
        wrapper: string[];
        reason: UnmatchedReason;
    }[];
    a1: A1Report;
}
export interface Row {
    key: string;
    coarse: string;
    operation: string | null;
    Opp: number;
    S: number;
    P: number;
    T: number | null;
    Tcoarse: number;
    Pcoarse: number;
    classes: RowClass[];
    mapping: Mapping;
    occurrences: {
        path: string;
        carrier: Carrier;
        wrapper: string[];
        reachable: boolean;
        statementLevel: boolean;
    }[];
    contributing: {
        effects: string[];
        binds: string[];
        kept: string;
        dropped: number;
    } | null;
}
export interface A1Report {
    callSteps: number;
    callEffects: number;
    writeSteps: number;
    writeEffects: number;
    emitSteps: number;
    emitEffects: number;
    opaqueSteps: number;
    opaqueEffects: number;
    /** Counts only. Steps and effects are compared per matching group (kind, operation, argument count, conditional),
     * because those fields can match several distinct occurrences; traversal order never decides which one is unmatched. */
    unmatchedSteps: number;
    unmatchedEffects: number;
    returnedCallSteps: number;
    /** Every group whose counts differ, with all candidate step paths. */
    groups: A1Group[];
    /** Unmatched steps named individually, only from groups where every step is unmatched. */
    attributed: {
        path: string;
        returned: boolean;
        match: string;
    }[];
}
export interface A1Group {
    match: string;
    steps: number;
    effects: number;
    unmatchedSteps: number;
    unmatchedEffects: number;
    returnedSteps: number;
    candidates: {
        path: string;
        returned: boolean;
    }[];
    attribution: "unique" | "ambiguous";
}
export interface CallSiteReport {
    executables: ExecutableReport[];
    totals: {
        O: number;
        Opp: number;
        S: number;
        P: number;
        T: number;
        Tmatched: number;
        TstoreOnly: number;
        pseudoP: number;
        pseudoT: number;
        rows: number;
        byClass: Record<RowClass, number>;
        byMapping: Record<Mapping, number>;
        keysByMapping: Record<Mapping, number>;
        unmatchedByReason: Record<string, number>;
        valuelessThrows: number;
        opaqueStatements: number;
    };
    a1: {
        executablesCompared: number;
        executablesEqual: number;
        returnedCallSteps: number;
        stepPairs: number;
        effectPairs: number;
        unmatchedSteps: number;
        unmatchedEffects: number;
        groups: number;
        groupsAmbiguous: number;
        attributedReturned: number;
        attributedOther: number;
        groupsWhereUnmatchedEqualsReturned: number;
        kindMismatches: string[];
    };
    unpaired: {
        inIrOnly: string[];
        inStoreOnly: string[];
    };
    limits: string[];
}
export interface Walked {
    occurrences: Occurrence[];
    steps: Step[];
    valuelessThrows: number;
    opaqueStatements: number;
}
export declare function walkOccurrences(input: FunctionIR): Walked;
export declare function projectedSites(fn: FunctionIR): ProjectedKey[];
export declare function classify(c: {
    Opp: number;
    S: number;
    P: number;
    T: number | null;
    wrapperOnlyInRule?: number;
}): RowClass[];
interface StoredExecutable {
    file: string;
    name: string;
    ordinal: number;
    invocations: {
        operation: string;
        coarse: string;
    }[];
    effects: string[];
}
export declare function reconcileExecutable(file: string, name: string, ordinal: number, fn: FunctionIR, stored: StoredExecutable | null): ExecutableReport;
export declare function reconcileCallSites(j: Journal, fns: {
    file: string;
    name: string;
    fn: FunctionIR;
}[]): CallSiteReport;
export {};
