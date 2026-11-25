import { type RelationSchema } from "./relations.js";
import { type Concept, type ConceptId } from "../concepts/index.js";
export { RELATIONS, SCHEMA_VERSION, type RelationSchema, type Layer } from "./relations.js";
export type Source = "PARSED" | "OBSERVED" | "DECLARED" | "RECORDED" | "INFERRED";
export type Verification = "NONE" | "HUMAN" | "REPLAY" | "PROOF";
export type AuthorityLevel = "NONE" | "CONTRIBUTOR" | "OWNER";
export interface Authority {
    readonly level: AuthorityLevel;
    readonly scope?: ConceptId;
}
export type Literal = {
    readonly type: string;
    readonly value: unknown;
};
export interface AssertionInput {
    subject: ConceptId;
    relation: string;
    object: ConceptId | Literal;
    attributes?: Record<string, unknown>;
    source: Source;
    verification?: Verification;
    asserter: string;
    authority?: Authority;
    confidence: number;
    evidence?: Record<string, unknown>;
    derived_from?: readonly number[];
    ir_schema?: number;
    encoder?: string;
    supersedes?: number;
}
export declare class SchemaViolation extends Error {
    readonly rule: string;
    constructor(rule: string, message: string);
}
/** The rule every assertion must pass before it reaches the journal. Throws SchemaViolation naming the rule. */
export declare function checkAssertion(a: AssertionInput, lookup: (id: ConceptId) => Concept | undefined): RelationSchema;
