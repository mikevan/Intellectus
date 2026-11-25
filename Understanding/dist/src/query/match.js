import { effectProjection, fingerprint } from "../ir/index.js";
/** Every named place read and every operation called, with the path condition it happens under. */
function surface(fn) {
    const reads = new Set();
    const operations = new Set();
    const walkOperand = (o) => {
        if (!o)
            return;
        if (o.kind === "read") {
            reads.add(o.property);
            walkOperand(o.object);
        }
        else if (o.kind === "negated")
            walkOperand(o.operand);
        else if (o.kind === "computed") {
            if (o.expr.kind === "call" && o.expr.operation)
                operations.add(o.expr.operation);
        }
    };
    const walkPredicate = (p) => {
        if (p.kind === "compare") {
            walkOperand(p.left);
            walkOperand(p.right);
        }
        else if (p.kind === "absent" || p.kind === "truthy")
            walkOperand(p.operand);
        else if (p.kind === "and" || p.kind === "or")
            p.operands.forEach(walkPredicate);
        else if (p.kind === "not")
            walkPredicate(p.operand);
    };
    for (const o of effectProjection(fn)) {
        if (o.under)
            walkPredicate(o.under);
        if (o.what.kind === "CALL_EXTERNAL" || o.what.kind === "WRITE" || o.what.kind === "EMIT") {
            if (o.what.operation)
                operations.add(o.what.operation);
            o.what.args.forEach(walkOperand);
        }
        else if (o.what.kind === "return" || o.what.kind === "throw")
            walkOperand(o.what.value);
        else if (o.what.kind === "bind") { /* expressions inside binds reach reads through operands */ }
    }
    // the shape is the projection with every name blanked: what is left when only structure remains
    const shape = JSON.stringify(effectProjection(fn), (k, v) => k === "property" || k === "operation" ? "*" : v);
    return { reads: [...reads].sort(), operations: [...operations].sort(), shape };
}
/**
 * Propose whether B can stand in for A, from the fingerprints plus whatever correspondences the store holds.
 * `obligations` names what the claim is scoped to; without at least one, nothing is proposed.
 */
export function match(a, b, correspondences, obligations) {
    const fa = fingerprint(a), fb = fingerprint(b);
    const sa = surface(a), sb = surface(b);
    const evidence = [];
    const unresolved = [];
    const contradictions = [];
    if (fa === fb) {
        return {
            verdict: "EXACT_FINGERPRINT", confidence: 1, obligations,
            evidence: [{ source: "PARSED", says: "Both encode to the same intrinsic fingerprint.", assertions: [], weight: 1 }],
            unresolved: [], contradictions: [], fingerprints: { a: fa, b: fb },
        };
    }
    // Structure first: if the shapes differ once every name is blanked, no correspondence can bridge it.
    if (sa.shape !== sb.shape) {
        return {
            verdict: "NONE", confidence: 0, obligations, evidence: [], contradictions: [],
            unresolved: ["The structures differ once names are set aside, so no correspondence between names can make these substitutable."],
            fingerprints: { a: fa, b: fb },
        };
    }
    evidence.push({ source: "PARSED", says: "The structures are identical once names are set aside.", assertions: [], weight: 0.5 });
    const about = (kind, left, right) => correspondences.filter((c) => c.kind === kind && ((c.left === left && c.right === right) || (c.left === right && c.right === left)));
    const pairUp = (kind, xs, ys, label) => {
        for (let i = 0; i < Math.max(xs.length, ys.length); i++) {
            const x = xs[i], y = ys[i];
            if (x === y)
                continue;
            if (x === undefined || y === undefined) {
                unresolved.push(`One side has a ${label} the other does not.`);
                continue;
            }
            const said = about(kind, x, y);
            const affirms = said.filter((c) => c.asserts === "same");
            const denies = said.filter((c) => c.asserts === "different");
            if (denies.length > 0) {
                // Contradiction. The bridge is refused whatever else affirms it, and both sides are reported.
                contradictions.push(affirms.length > 0
                    ? `The ${label} ${x} and ${y} are contradicted: ${denies.map((d) => d.says).join(" ")} against ${affirms.map((c) => c.says).join(" ")}`
                    : `The ${label} ${x} and ${y} are declared to be different things: ${denies.map((d) => d.says).join(" ")}`);
                unresolved.push(`The ${label} ${x} and ${y} cannot be bridged while the contradiction stands.`);
            }
            else if (affirms.length > 0) {
                const c = affirms[0];
                evidence.push({ source: c.source, says: c.says, assertions: c.assertions, weight: c.source === "DECLARED" ? 0.4 : 0.25 });
            }
            else
                unresolved.push(`Nothing says the ${label} ${x} and ${y} are the same thing.`);
        }
    };
    pairUp("field", sa.reads, sb.reads, "field");
    pairUp("operation", sa.operations, sb.operations, "operation");
    if (unresolved.length > 0) {
        // The shapes match, so these are structurally similar whatever the names; what is missing is evidence that the
        // names denote the same things, and every missing bridge is listed. Saying NONE here would hide a finding.
        return {
            verdict: "STRUCTURALLY_SIMILAR",
            confidence: contradictions.length > 0 ? 0 : Number(Math.min(0.55, 0.2 + 0.15 * (evidence.length - 1)).toFixed(2)),
            obligations, evidence, unresolved, contradictions,
            fingerprints: { a: fa, b: fb },
        };
    }
    // Every difference is bridged by named evidence. Confidence is the weakest link, never the sum, and the
    // fingerprints stay different: the claim is laid beside the difference, not over it.
    // The weakest link decides, with a small credit for corroboration. An OBSERVED correspondence is deliberately
    // worth less than a DECLARED one: a run shows what happened under its conditions, not what must hold. So a claim
    // resting on an observation alone cannot reach PROBABLE, and that is a property of the evidence, not a dial.
    const confidence = Math.min(...evidence.map((e) => e.weight)) + (evidence.length - 1) * 0.15;
    return {
        verdict: confidence >= 0.6 ? "PROBABLE_EQUIVALENT" : "STRUCTURALLY_SIMILAR",
        confidence: Math.min(0.95, Number(confidence.toFixed(2))),
        obligations, evidence, contradictions,
        unresolved: [`The intrinsic fingerprints still differ (${fa} against ${fb}); this is a claim about substitutability, not sameness.`],
        fingerprints: { a: fa, b: fb },
    };
}
/** Write an accepted proposal into the store as an INFERRED claim. It is never VERIFIED here. */
export function assertProposal(j, left, right, p, asserter) {
    return j.assert({
        subject: left, relation: "SUBSTITUTABLE_UNDER", object: right,
        attributes: { obligations: p.obligations, verdict: p.verdict, evidence: p.evidence.map((e) => `${e.source}: ${e.says}`), unresolved: p.unresolved },
        source: "INFERRED", verification: "NONE", asserter, confidence: p.confidence,
        // The claim depends on the assertions that carried it. The store's one invalidation rule then does the rest:
        // retract a correspondence and the proposal goes with it, in the same transaction.
        derived_from: p.evidence.flatMap((e) => e.assertions),
        evidence: { fingerprints: p.fingerprints, assertions: p.evidence.flatMap((e) => e.assertions), contradictions: p.contradictions },
    });
}
