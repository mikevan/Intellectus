const impl = ["application", "component", "module", "class", "executable", "entity", "state", "event", "external", "test"];
const any = [
    "application", "scope", "thread", "trace", "component", "module", "class", "executable", "entity", "state",
    "event", "external", "test", "requirement", "intent", "decision", "constraint", "invariant", "obligation", "checkpoint",
];
const table = [
    { name: "CALLS", subject: ["executable"], object: ["executable"], layer: "structural", inverse: "CALLED_BY" },
    { name: "IMPORTS", subject: ["module"], object: ["module"], layer: "structural", inverse: "IMPORTED_BY" },
    { name: "MEMBER_OF", subject: ["executable", "entity"], object: ["class", "module"], layer: "structural", inverse: "HAS_MEMBER" },
    { name: "DEPENDS_ON", subject: impl, object: impl, layer: "structural", inverse: "DEPENDED_ON_BY" }, // direct only; closure is a query
    { name: "HAS_EFFECT", subject: ["executable"], object: ["literal"], layer: "structural", requiredAttributes: ["kind"] },
    { name: "HAS_PREDICATE", subject: ["executable"], object: ["literal"], layer: "structural" },
    { name: "HAS_TRANSFORM", subject: ["executable"], object: ["literal"], layer: "structural" },
    { name: "HAS_FINGERPRINT", subject: any, object: ["literal"], layer: "derived", requiredAttributes: ["kind", "valid_from"] },
    { name: "RENDERS_AS", subject: any, object: ["literal"], layer: "rendering", requiredAttributes: ["language"] },
    { name: "PARTICIPATES_IN", subject: ["executable", "entity", "event"], object: ["thread", "trace"], layer: "execution", inverse: "HAS_STEP", requiredAttributes: ["position"] },
    { name: "FOLLOWS", subject: ["executable"], object: ["executable"], layer: "execution", inverse: "PRECEDES", requiredAttributes: ["control", "within"] },
    { name: "TESTED_BY", subject: ["executable", "obligation"], object: ["test"], layer: "execution", inverse: "TESTS" },
    { name: "OBSERVED_IN", subject: ["executable"], object: ["trace"], layer: "execution" },
    { name: "SATISFIES", subject: ["executable", "component"], object: ["requirement", "obligation"], layer: "intent", inverse: "SATISFIED_BY" },
    { name: "SUPPORTS", subject: ["requirement"], object: ["thread"], layer: "intent", inverse: "SUPPORTED_BY" },
    { name: "SERVES", subject: ["thread"], object: ["intent"], layer: "intent", inverse: "SERVED_BY" },
    { name: "CONSTRAINS", subject: ["invariant", "constraint"], object: any, layer: "intent", inverse: "CONSTRAINED_BY", requiredAttributes: ["modality"] },
    { name: "REQUIRES", subject: ["requirement", "intent"], object: ["requirement", "obligation"], layer: "intent", inverse: "REQUIRED_BY" },
    { name: "EXPLAINS", subject: ["decision"], object: any, layer: "intent", inverse: "EXPLAINED_BY" },
    { name: "IN_SCOPE", subject: ["obligation", "requirement", "invariant", "constraint", "intent"], object: ["scope"], layer: "intent" },
    { name: "AUTHORITATIVE_OVER", subject: ["scope"], object: ["scope"], layer: "intent" }, // explicit only; never implied by a root scope
    { name: "DERIVED_FROM", subject: any, object: any, layer: "derived" },
    { name: "SUBSTITUTABLE_UNDER", subject: any, object: any, layer: "judgement", symmetric: true, requiredAttributes: ["obligations"] },
    { name: "SIMILAR_TO", subject: any, object: any, layer: "judgement", symmetric: true, requiredAttributes: ["distance", "space"] },
    { name: "VIOLATES", subject: ["trace", "executable"], object: ["obligation", "invariant"], layer: "judgement", inverse: "VIOLATED_BY" },
    { name: "SPLIT_FROM", subject: any, object: any, layer: "lineage" },
    { name: "MERGED_FROM", subject: any, object: any, layer: "lineage" },
    { name: "COPIED_FROM", subject: any, object: any, layer: "lineage" },
    { name: "EXTRACTED_FROM", subject: any, object: any, layer: "lineage" },
    { name: "DESCENDED_FROM", subject: any, object: any, layer: "lineage" },
    { name: "RESTORED_TO", subject: ["application"], object: ["checkpoint"], layer: "history" },
];
export const SCHEMA_VERSION = 1;
export const RELATIONS = new Map(table.map((r) => [r.name, r]));
