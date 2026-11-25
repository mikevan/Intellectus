import { type Concept, type ConceptId, type ConceptKind } from "../concepts/index.js";
import { type AssertionInput, type Literal } from "../schema/index.js";
export interface ConceptEvent {
    kind: "CONCEPT";
    id: number;
    tx: number;
    schema: number;
    at: string;
    concept: Concept;
}
export interface AssertEvent extends AssertionInput {
    kind: "ASSERT";
    id: number;
    tx: number;
    schema: number;
    at: string;
    verification: NonNullable<AssertionInput["verification"]>;
}
export interface RetractEvent {
    kind: "RETRACT";
    id: number;
    tx: number;
    schema: number;
    at: string;
    target: number;
    reason: {
        source: string;
        asserter: string;
        evidence?: Record<string, unknown>;
    };
}
export interface TxEvent {
    kind: "BEGIN" | "COMMIT";
    tx: number;
    schema: number;
    at: string;
    label?: string;
}
export type Event = ConceptEvent | AssertEvent | RetractEvent | TxEvent;
export declare class JournalError extends Error {
}
export declare class Journal {
    private readonly path?;
    private seq;
    private txSeq;
    private open?;
    private tornTail;
    private readonly concepts;
    private readonly live;
    private readonly all;
    private readonly dependents;
    constructor(path?: string);
    /** Replay a journal text. Uncommitted transactions are ignored; nothing else is validated again, because it was
     * validated when written. A torn line is treated as the crash it is: it and everything after it are discarded, and
     * the transaction it belongs to is discarded whole, because appendFileSync is one call and not an atomic durable
     * append across a process, OS, or power failure. A torn line anywhere but the tail is corruption, not a crash, and
     * is refused. */
    private replay;
    /** True when the last line of the journal was incomplete on load, so a transaction was discarded. */
    get hadTornTail(): boolean;
    private apply;
    begin(label?: string): number;
    private inTx;
    private lookup;
    concept(kind: ConceptKind): Concept;
    assert(a: AssertionInput): number;
    /** Retract a live assertion. Derived assertions that depend on it are retracted in the same transaction: one rule, applied by the store. */
    retract(target: number, reason: RetractEvent["reason"]): number[];
    commit(): void;
    abort(): void;
    getConcept(id: ConceptId): Concept | undefined;
    liveAssertions(): readonly AssertEvent[];
    about(id: ConceptId): readonly AssertEvent[];
    history(): readonly Event[];
    get sequence(): number;
}
export declare function literal(type: string, value: unknown): Literal;
