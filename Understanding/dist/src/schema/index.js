import { RELATIONS } from "./relations.js";
import { isConceptId } from "../concepts/index.js";
export { RELATIONS, SCHEMA_VERSION } from "./relations.js";
export class SchemaViolation extends Error {
    rule;
    constructor(rule, message) {
        super(message);
        this.rule = rule;
        this.name = "SchemaViolation";
    }
}
/** The rule every assertion must pass before it reaches the journal. Throws SchemaViolation naming the rule. */
export function checkAssertion(a, lookup) {
    const rel = RELATIONS.get(a.relation);
    if (!rel)
        throw new SchemaViolation("unknown-relation", `Relation ${a.relation} is not in the vocabulary.`);
    const subj = lookup(a.subject);
    if (!subj)
        throw new SchemaViolation("unknown-subject", `Subject ${a.subject} is not a concept.`);
    if (!rel.subject.includes(subj.kind))
        throw new SchemaViolation("subject-kind", `${rel.name} does not accept a ${subj.kind} as subject.`);
    if (isConceptId(a.object)) {
        const obj = lookup(a.object);
        if (!obj)
            throw new SchemaViolation("unknown-object", `Object ${a.object} is not a concept.`);
        if (!rel.object.includes(obj.kind))
            throw new SchemaViolation("object-kind", `${rel.name} does not accept a ${obj.kind} as object.`);
        if (rel.symmetric === undefined && rel.layer === "lineage" && obj.kind !== subj.kind)
            throw new SchemaViolation("lineage-kind", `Lineage relates concepts of one kind; ${subj.kind} and ${obj.kind} differ.`);
    }
    else {
        if (!rel.object.includes("literal"))
            throw new SchemaViolation("object-literal", `${rel.name} does not accept a literal as object.`);
    }
    for (const attr of rel.requiredAttributes ?? []) {
        if (a.attributes === undefined || !(attr in a.attributes))
            throw new SchemaViolation("missing-attribute", `${rel.name} requires attribute ${attr}.`);
    }
    if (!(a.confidence >= 0 && a.confidence <= 1))
        throw new SchemaViolation("confidence-range", "Confidence must be within [0, 1].");
    if (a.source === "DECLARED" && !a.authority)
        throw new SchemaViolation("declared-needs-authority", "A DECLARED assertion must carry an authority.");
    if (a.source !== "INFERRED" && a.verification && a.verification !== "NONE")
        throw new SchemaViolation("verification-of-nonlinferred", "Only INFERRED assertions carry a verification other than NONE.");
    if (rel.layer === "derived" && !a.derived_from)
        throw new SchemaViolation("derived-needs-dependencies", `${rel.name} is derived and must carry derived_from.`);
    if (a.authority?.scope) {
        const sc = lookup(a.authority.scope);
        if (!sc || sc.kind !== "scope")
            throw new SchemaViolation("authority-scope", "An authority scope must be a concept of kind scope.");
    }
    return rel;
}
