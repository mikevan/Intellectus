// Authority scopes are persistent concepts declared by the application's owner. A root scope is authoritative over a
// child only when the owner has declared AUTHORITATIVE_OVER explicitly; nothing is implied.
import type { ConceptId } from "../concepts/index.js";
import type { Journal } from "../journal/index.js";
import { literal } from "../journal/index.js";

export function declareScope(j: Journal, name: string, owner: string, description?: string): ConceptId {
  const scope = j.concept("scope");
  j.assert({ subject: scope.id, relation: "RENDERS_AS", object: literal("string", name), attributes: { language: "en", audience: "owner" }, source: "DECLARED", asserter: owner, authority: { level: "OWNER" }, confidence: 1 });
  if (description) j.assert({ subject: scope.id, relation: "RENDERS_AS", object: literal("string", description), attributes: { language: "en", audience: "reader", role: "description" }, source: "DECLARED", asserter: owner, authority: { level: "OWNER" }, confidence: 1 });
  return scope.id;
}

export function declareAuthorityOver(j: Journal, parent: ConceptId, child: ConceptId, owner: string): number {
  return j.assert({ subject: parent, relation: "AUTHORITATIVE_OVER", object: child, source: "DECLARED", asserter: owner, authority: { level: "OWNER", scope: parent }, confidence: 1 });
}

/** Does an authority carry standing for an obligation in `scope`? Explicit relations only; no root-scope superuser. */
export function hasStanding(j: Journal, authority: { level: string; scope?: ConceptId }, scope: ConceptId): boolean {
  if (authority.level !== "OWNER" || !authority.scope) return false;
  if (authority.scope === scope) return true;
  const seen = new Set<ConceptId>(); const stack: ConceptId[] = [authority.scope];
  while (stack.length) {
    const s = stack.pop()!; if (seen.has(s)) continue; seen.add(s);
    for (const a of j.liveAssertions()) if (a.relation === "AUTHORITATIVE_OVER" && a.subject === s) { if (a.object === scope) return true; stack.push(a.object as ConceptId); }
  }
  return false;
}
