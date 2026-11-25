import type { ConceptKind } from "../concepts/index.js";
export type Layer = "structural" | "derived" | "rendering" | "execution" | "intent" | "judgement" | "lineage" | "history";
export type ObjectKind = ConceptKind | "literal";
export interface RelationSchema {
    readonly name: string;
    readonly subject: readonly ConceptKind[];
    readonly object: readonly ObjectKind[];
    readonly layer: Layer;
    readonly inverse?: string;
    readonly symmetric?: boolean;
    /** Attributes that must be present on the assertion. */
    readonly requiredAttributes?: readonly string[];
}
export declare const SCHEMA_VERSION = 1;
export declare const RELATIONS: ReadonlyMap<string, RelationSchema>;
