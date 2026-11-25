import type { ConceptId } from "../concepts/index.js";
import type { Journal } from "../journal/index.js";
export declare function declareScope(j: Journal, name: string, owner: string, description?: string): ConceptId;
export declare function declareAuthorityOver(j: Journal, parent: ConceptId, child: ConceptId, owner: string): number;
/** Does an authority carry standing for an obligation in `scope`? Explicit relations only; no root-scope superuser. */
export declare function hasStanding(j: Journal, authority: {
    level: string;
    scope?: ConceptId;
}, scope: ConceptId): boolean;
