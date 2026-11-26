import type { ConceptId } from "../concepts/index.js";
import type { Journal } from "../journal/index.js";
export type ReceiverOrigin = "PARAMETER" | "LOCAL_BINDING" | "CALL_OUTCOME" | "MEMBER_VALUE" | "MODULE_OR_IMPORTED" | "LITERAL_OR_CONSTRUCTED" | "UNRESOLVED";
/** Frozen 2026-09-14 before any occurrence was read; see docs/experiment-log.md, E3-origin. */
export declare const ORIGIN_DEFINITIONS: Readonly<Record<ReceiverOrigin, string>>;
export interface OriginRecord {
    origin: ReceiverOrigin;
    operation: string;
    caller: ConceptId;
    invocation: ConceptId;
    receiverValue: ConceptId;
    /** True when the receiver value is joined to something else by FLOWS_TO, in either direction. */
    participatesInFlow: boolean;
    /** How many steps of the existing value graph the receiver can be followed back through. */
    traceableSteps: number;
    because: string;
    /** The assertions this classification rests on. */
    supporting: number[];
}
export interface OriginReport {
    receivers: number;
    byOrigin: Record<ReceiverOrigin, {
        occurrences: number;
        inFlow: number;
        operations: string[];
    }>;
    records: OriginRecord[];
    /** The prediction this measurement tests: how many receivers have a mechanically traceable origin. */
    traceable: number;
    limits: string[];
}
export declare function classifyReceiverOrigins(j: Journal): OriginReport;
