export declare const CONCEPT_KINDS: readonly ["application", "scope", "thread", "trace", "component", "module", "class", "executable", "entity", "state", "event", "external", "test", "requirement", "intent", "decision", "constraint", "invariant", "obligation", "checkpoint", "invocation", "value"];
export type ConceptKind = (typeof CONCEPT_KINDS)[number];
export type ConceptId = `C-${string}`;
export interface Concept {
    readonly id: ConceptId;
    readonly kind: ConceptKind;
}
export declare function isConceptKind(k: string): k is ConceptKind;
/** A new opaque id. It carries no meaning and is never derived from a name or a location. */
export declare function newConceptId(): ConceptId;
export declare function isConceptId(v: unknown): v is ConceptId;
