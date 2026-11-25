// Concepts are identity anchors: a permanent, meaningless id and a kind. Nothing else lives here.
import { randomBytes } from "node:crypto";

export const CONCEPT_KINDS = [
  "application", "scope", "thread", "trace", "component", "module", "class", "executable",
  "entity", "state", "event", "external", "test", "requirement", "intent", "decision",
  "constraint", "invariant", "obligation", "checkpoint",
] as const;
export type ConceptKind = (typeof CONCEPT_KINDS)[number];

export type ConceptId = `C-${string}`;

export interface Concept {
  readonly id: ConceptId;
  readonly kind: ConceptKind;
}

export function isConceptKind(k: string): k is ConceptKind {
  return (CONCEPT_KINDS as readonly string[]).includes(k);
}

/** A new opaque id. It carries no meaning and is never derived from a name or a location. */
export function newConceptId(): ConceptId {
  return `C-${randomBytes(9).toString("base64url")}`;
}

export function isConceptId(v: unknown): v is ConceptId {
  return typeof v === "string" && /^C-[A-Za-z0-9_-]{12}$/.test(v);
}
