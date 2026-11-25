import { literal } from "../journal/index.js";
export function declareScope(j, name, owner, description) {
    const scope = j.concept("scope");
    j.assert({ subject: scope.id, relation: "RENDERS_AS", object: literal("string", name), attributes: { language: "en", audience: "owner" }, source: "DECLARED", asserter: owner, authority: { level: "OWNER" }, confidence: 1 });
    if (description)
        j.assert({ subject: scope.id, relation: "RENDERS_AS", object: literal("string", description), attributes: { language: "en", audience: "reader", role: "description" }, source: "DECLARED", asserter: owner, authority: { level: "OWNER" }, confidence: 1 });
    return scope.id;
}
export function declareAuthorityOver(j, parent, child, owner) {
    return j.assert({ subject: parent, relation: "AUTHORITATIVE_OVER", object: child, source: "DECLARED", asserter: owner, authority: { level: "OWNER", scope: parent }, confidence: 1 });
}
/** Does an authority carry standing for an obligation in `scope`? Explicit relations only; no root-scope superuser. */
export function hasStanding(j, authority, scope) {
    if (authority.level !== "OWNER" || !authority.scope)
        return false;
    if (authority.scope === scope)
        return true;
    const seen = new Set();
    const stack = [authority.scope];
    while (stack.length) {
        const s = stack.pop();
        if (seen.has(s))
            continue;
        seen.add(s);
        for (const a of j.liveAssertions())
            if (a.relation === "AUTHORITATIVE_OVER" && a.subject === s) {
                if (a.object === scope)
                    return true;
                stack.push(a.object);
            }
    }
    return false;
}
