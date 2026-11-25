import type { ConceptId } from "../concepts/index.js";
import type { Journal } from "../journal/index.js";
import type { FunctionIR } from "../ir/index.js";
export type Verdict = "EXACT_FINGERPRINT" | "PROBABLE_EQUIVALENT" | "STRUCTURALLY_SIMILAR" | "NONE";
export interface EvidenceItem {
    /** Which channel carried it. PARSED is the source itself; DECLARED is a person with authority; OBSERVED is a run. */
    source: "PARSED" | "DECLARED" | "OBSERVED";
    /** What it says, in one plain sentence, for a person reading the report. */
    says: string;
    /** The assertion ids this rests on, so the proposal can be traced back. */
    assertions: number[];
    /** How far this channel alone gets us, in [0, 1]. */
    weight: number;
}
export interface Proposal {
    verdict: Verdict;
    confidence: number;
    /** The obligations the claim is scoped to. Substitutability is never unqualified. */
    obligations: string[];
    evidence: EvidenceItem[];
    /** What still differs after the claim. Never empty when the fingerprints differ, and never hidden. */
    unresolved: string[];
    /** Evidence that contradicts a bridge. Present means the claim is capped, whatever else was found. */
    contradictions: string[];
    fingerprints: {
        a: string;
        b: string;
    };
}
/** A declared or observed correspondence between two names, read from the store. */
export interface Correspondence {
    kind: "field" | "operation";
    left: string;
    right: string;
    source: "DECLARED" | "OBSERVED";
    /** "same" affirms the two names denote one thing; "different" denies it. A denial is never outvoted by an
     * affirmation: the two are a contradiction, and a contradiction is a finding, not a tie to be broken. */
    asserts: "same" | "different";
    says: string;
    assertions: number[];
}
/**
 * Propose whether B can stand in for A, from the fingerprints plus whatever correspondences the store holds.
 * `obligations` names what the claim is scoped to; without at least one, nothing is proposed.
 */
export declare function match(a: FunctionIR, b: FunctionIR, correspondences: Correspondence[], obligations: string[]): Proposal;
/** Write an accepted proposal into the store as an INFERRED claim. It is never VERIFIED here. */
export declare function assertProposal(j: Journal, left: ConceptId, right: ConceptId, p: Proposal, asserter: string): number;
