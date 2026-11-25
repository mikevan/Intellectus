// Concepts are identity anchors: a permanent, meaningless id and a kind. Nothing else lives here.
import { randomBytes } from "node:crypto";
export const CONCEPT_KINDS = [
    "application", "scope", "thread", "trace", "component", "module", "class", "executable",
    "entity", "state", "event", "external", "test", "requirement", "intent", "decision",
    "constraint", "invariant", "obligation", "checkpoint",
];
export function isConceptKind(k) {
    return CONCEPT_KINDS.includes(k);
}
/** A new opaque id. It carries no meaning and is never derived from a name or a location. */
export function newConceptId() {
    return `C-${randomBytes(9).toString("base64url")}`;
}
export function isConceptId(v) {
    return typeof v === "string" && /^C-[A-Za-z0-9_-]{12}$/.test(v);
}
