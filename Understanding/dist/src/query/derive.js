export function derivePath(j, start, end, options) {
    const allowed = new Set(options.allowedRelations);
    const sources = new Set(options.allowedSources ?? ["PARSED"]);
    const maxDepth = options.maxDepth ?? 24;
    const none = (outcome, says) => ({ outcome, path: [], supporting: [], conflicting: [], says });
    if (!j.getConcept(start))
        return none("UNKNOWN", "The starting concept is not in the store.");
    if (!j.getConcept(end))
        return none("UNKNOWN", "The ending concept is not in the store.");
    if (allowed.size === 0)
        return none("UNKNOWN", "No relations were allowed, so nothing could be traversed.");
    const live = j.liveAssertions();
    const usable = live.filter((a) => allowed.has(a.relation) && sources.has(a.source) && typeof a.object === "string");
    const edges = new Map();
    const push = (from, e) => {
        const list = edges.get(from) ?? [];
        list.push(e);
        edges.set(from, list);
    };
    for (const a of usable) {
        push(a.subject, { to: a.object, relation: a.relation, assertion: a.id });
        if (options.bidirectional)
            push(a.object, { to: a.subject, relation: a.relation, assertion: a.id });
    }
    // breadth first, so the path found is the shortest and the result does not depend on insertion order
    const cameFrom = new Map();
    const seen = new Set([start]);
    let frontier = [start];
    let depth = 0;
    while (frontier.length > 0 && depth < maxDepth) {
        const next = [];
        for (const node of frontier) {
            for (const e of (edges.get(node) ?? []).slice().sort((x, y) => x.assertion - y.assertion)) {
                if (seen.has(e.to))
                    continue;
                seen.add(e.to);
                cameFrom.set(e.to, { from: node, relation: e.relation, to: e.to, assertion: e.assertion });
                if (e.to === end) {
                    const path = [];
                    for (let at = end; at && cameFrom.has(at); at = cameFrom.get(at).from)
                        path.unshift(cameFrom.get(at));
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
export function only(j, from, relation, attributes) {
    const matches = j.liveAssertions().filter((a) => a.subject === from && a.relation === relation && a.source === "PARSED" && typeof a.object === "string" &&
        (attributes === undefined || Object.entries(attributes).every(([k, v]) => a.attributes?.[k] === v)));
    if (matches.length === 0)
        return { outcome: "UNKNOWN", says: `Nothing in the store says ${from} ${relation}.` };
    if (matches.length > 1)
        return { outcome: "AMBIGUOUS", says: `${matches.length} assertions say ${from} ${relation}; the store will not choose between them.` };
    return { outcome: "FOUND", concept: matches[0].object, assertion: matches[0].id, says: `One assertion, ${matches[0].id}.` };
}
