import type { IngestReport } from "../ingest/index.js";
import type { LossReport } from "./loss.js";
import type { OriginReport } from "./origin.js";
import type { ProducerReport } from "./producer.js";
/** One population, its definition, and the figure the report prints for it. */
export interface Population {
    name: string;
    definition: string;
    count: number;
}
/** One identity that must hold between populations, with the arithmetic that was checked. */
export interface Identity {
    name: string;
    holds: boolean;
    left: number;
    right: number;
    arithmetic: string;
}
export interface ReconciliationReport {
    populations: Population[];
    identities: Identity[];
    /** True only when every identity holds. The graph script prints it and a test asserts it. */
    reconciles: boolean;
}
export declare function reconcile(report: IngestReport, loss: LossReport, origins: OriginReport, producers: ProducerReport): ReconciliationReport;
