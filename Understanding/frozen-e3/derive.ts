// derivePath: a generic path search over the store. Written and frozen before any corpus ground truth exists, so
// that "semantic path" cannot come to mean whatever connects an answer already known.
//
// It knows nothing about any application, any language, or any experiment. It takes two concepts and a set of
// relations it may traverse, and returns the shortest path, the assertions that support every step, or the reason
// there is none. Provenance survives derivation: a derived path names its supporting PARSED assertions, and the
// store's own invalidation rule is what makes a derived conclusion disappear when its evidence is retracted.
import type { ConceptId } from "../concepts/index.js";
import type { AssertEvent, Journal } from "../journal/index.js";

export type Outcome = "FOUND" | "NOT_FOUND" | "UNKNOWN" | "AMBIGUOUS" | "CONTRADICTED";

export interface Step { from: ConceptId; relation: string; to: ConceptId; assertion: number }

export interface Derivation {
  outcome: Outcome;
  /** The steps, in order, when FOUND. */
  path: Step[];
  /** Every PARSED assertion the path rests on. Pass these as derived_from when storing a conclusion. */
  supporting: number[];
  /** Assertions that contradict a step, when CONTRADICTED. */
  conflicting: number[];
  /** One plain sentence saying what happened, for a person reading a report. */
  says: string;
}

export interface DeriveOptions {
  /** Only these relations may be traversed. There is no default: a search must say what it is allowed to follow. */
  allowedRelations: string[];
  /** Follow inverses as well as forwards. Off by default: direction is usually part of the question. */
  bidirectional?: boolean;
  maxDepth?: number;
  /** A step must rest on an assertion from one of these sources. Defaults to PARSED alone, which is what makes a
   * derivation a derivation rather than a restatement of something somebody declared. */
  allowedSources?: AssertEvent["source"][];
}

export function derivePath(j: Journal, start: ConceptId, end: ConceptId, options: DeriveOptions): Derivation {
  const allowed = new Set(options.allowedRelations);
  const sources = new Set<AssertEvent["source"]>(options.allowedSources ?? ["PARSED"]);
  const maxDepth = options.maxDepth ?? 24;
  const none = (outcome: Outcome, says: string): Derivation => ({ outcome, path: [], supporting: [], conflicting: [], says });

  if (!j.getConcept(start)) return none("UNKNOWN", "The starting concept is not in the store.");
  if (!j.getConcept(end)) return none("UNKNOWN", "The ending concept is not in the store.");
  if (allowed.size === 0) return none("UNKNOWN", "No relations were allowed, so nothing could be traversed.");

  const live = j.liveAssertions();
  const usable = live.filter((a) => allowed.has(a.relation) && sources.has(a.source) && typeof a.object === "string");
  const edges = new Map<ConceptId, { to: ConceptId; relation: string; assertion: number }[]>();
  const push = (from: ConceptId, e: { to: ConceptId; relation: string; assertion: number }): void => {
    const list = edges.get(from) ?? []; list.push(e); edges.set(from, list);
  };
  for (const a of usable) {
    push(a.subject, { to: a.object as ConceptId, relation: a.relation, assertion: a.id });
    if (options.bidirectional) push(a.object as ConceptId, { to: a.subject, relation: a.relation, assertion: a.id });
  }

  // breadth first, so the path found is the shortest and the result does not depend on insertion order
  const cameFrom = new Map<ConceptId, Step>();
  const seen = new Set<ConceptId>([start]);
  let frontier: ConceptId[] = [start];
  let depth = 0;
  while (frontier.length > 0 && depth < maxDepth) {
    const next: ConceptId[] = [];
    for (const node of frontier) {
      for (const e of (edges.get(node) ?? []).slice().sort((x, y) => x.assertion - y.assertion)) {
        if (seen.has(e.to)) continue;
        seen.add(e.to);
        cameFrom.set(e.to, { from: node, relation: e.relation, to: e.to, assertion: e.assertion });
        if (e.to === end) {
          const path: Step[] = [];
          for (let at: ConceptId | undefined = end; at && cameFrom.has(at); at = cameFrom.get(at)!.from) path.unshift(cameFrom.get(at)!);
          const supporting = path.map((s) => s.assertion);
          const conflicting = live.filter((a) => a.relation === "CONFLICTS_WITH" && supporting.includes(Number(a.subject))).map((a) => a.id);
          if (conflicting.length > 0)
            return { outcome: "CONTRADICTED", path, supporting, conflicting, says: `A path of ${path.length} steps exists, and ${conflicting.length} assertion(s) contradict a step in it.` };
          return { outcome: "FOUND", path, supporting, conflicting: [], says: `A path of ${path.length} steps, resting on ${supporting.length} parsed assertion(s).` };
        }
        next.push(e.to);
      }
    }
    frontier = next;
    depth++;
  }
  return none("NOT_FOUND", `No path within ${maxDepth} steps using ${[...allowed].join(", ")}.`);
}

/** The single concept a relation points to from `from`, or why it cannot be named. Never a guess. */
export function only(j: Journal, from: ConceptId, relation: string, attributes?: Record<string, unknown>): { outcome: "FOUND" | "UNKNOWN" | "AMBIGUOUS"; concept?: ConceptId; assertion?: number; says: string } {
  const matches = j.liveAssertions().filter((a) =>
    a.subject === from && a.relation === relation && a.source === "PARSED" && typeof a.object === "string" &&
    (attributes === undefined || Object.entries(attributes).every(([k, v]) => a.attributes?.[k] === v)));
  if (matches.length === 0) return { outcome: "UNKNOWN", says: `Nothing in the store says ${from} ${relation}.` };
  if (matches.length > 1) return { outcome: "AMBIGUOUS", says: `${matches.length} assertions say ${from} ${relation}; the store will not choose between them.` };
  return { outcome: "FOUND", concept: matches[0].object as ConceptId, assertion: matches[0].id, says: `One assertion, ${matches[0].id}.` };
}
