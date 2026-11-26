import { type FunctionIR } from "../ir/index.js";
export type ProducerOutcome = "IDENTIFIABLE" | "AMBIGUOUS" | "UNAVAILABLE";
export interface ProducerRecord {
    group: "LOCAL_BINDING" | "MEMBER_VALUE" | "COMPUTED";
    outcome: ProducerOutcome;
    /** For COMPUTED: whether the producer is an invocation or something else. */
    producerKind?: "invocation" | "member-read" | "arithmetic" | "index" | "test" | "choose" | "other";
    operation: string;
    executable: string;
    because: string;
}
export interface ProducerReport {
    receivers: number;
    groups: Record<ProducerRecord["group"], {
        total: number;
        identifiable: number;
        ambiguous: number;
        unavailable: number;
        /** COMPUTED only: of the identifiable, how many produce from an invocation. */
        invocationProducers: number;
        otherProducers: number;
    }>;
    records: ProducerRecord[];
    limits: string[];
}
/** Classify producers from the IR itself, per function. The store holds no edge for these, which is the point. */
export declare function classifyProducers(functions: Map<string, FunctionIR>): ProducerReport;
