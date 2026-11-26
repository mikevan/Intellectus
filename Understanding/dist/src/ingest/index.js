// Ingestion: turn a corpus into PARSED assertions and nothing else.
//
// The rule E3 rests on: every assertion carries the source construct it was mechanically derived from and the
// adapter rule that produced it, so any assertion can be audited backwards to a location and a rule. Nothing is
// asserted because it is obviously true, nothing is inferred, and no relation is used that the vocabulary did not
// already have. If this file ever writes a relationship a human or a model concluded, E3 is measuring the wrong
// thing and the result is void.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { literal } from "../journal/index.js";
import { canonPath, effectProjection, unwrapAwaited, fingerprint, IR_SCHEMA } from "../ir/index.js";
import { encodeFunctions as encodePython, ENCODER as PY_ENCODER } from "../adapters/python/index.js";
import { encodeFunctions as encodeTypeScript, ENCODER as TS_ENCODER } from "../adapters/typescript/index.js";
export async function ingest(j, files, corpusRoot) {
    const report = { files: files.length, modules: 0, executables: 0, assertions: 0, byRelation: {}, unresolvedCalls: {}, resolvedCalls: 0, invocations: 0, values: 0, flows: 0, unresolvedInvocations: 0, ambiguousInvocations: 0, selfInvocations: 0, sitesMerged: 0, sitesMergedWithReceiver: 0, receiverSitesFromProjection: 0, receiverSitesFromOperand: 0, receiverArguments: 0 };
    const count = (rel) => { report.byRelation[rel] = (report.byRelation[rel] ?? 0) + 1; report.assertions++; };
    // pass 1: concepts and everything derivable from one function in isolation
    const byName = new Map(); // declared name -> concepts with that name
    const irs = [];
    for (const file of files) {
        const rel = canonPath(file.startsWith(corpusRoot) ? file.slice(corpusRoot.length).replace(/^[\\/]+/, "") : file);
        const text = readFileSync(file, "utf8");
        const sourceHash = createHash("sha256").update(text).digest("hex").slice(0, 12);
        const isPython = file.endsWith(".py");
        const encoder = isPython ? PY_ENCODER : TS_ENCODER;
        const base = { source: "PARSED", asserter: encoder, confidence: 1, ir_schema: IR_SCHEMA, encoder };
        const mod = j.concept("module");
        report.modules++;
        j.assert({ ...base, subject: mod.id, relation: "RENDERS_AS", object: literal("path", rel), attributes: { language: isPython ? "python" : "typescript" }, evidence: { rule: "module-from-file", file: rel, sourceHash } });
        count("RENDERS_AS");
        for (const [name, fn] of isPython ? await encodePython(text) : await encodeTypeScript(text)) {
            const ex = j.concept("executable");
            report.executables++;
            const nameId = j.assert({ ...base, subject: ex.id, relation: "RENDERS_AS", object: literal("identifier", name), attributes: { language: isPython ? "python" : "typescript" }, evidence: { rule: "name-from-declaration", file: rel, construct: "function definition", sourceHash } });
            count("RENDERS_AS");
            j.assert({ ...base, subject: ex.id, relation: "MEMBER_OF", object: mod.id, evidence: { rule: "member-from-enclosing-module", file: rel, sourceHash } });
            count("MEMBER_OF");
            j.assert({ ...base, subject: ex.id, relation: "HAS_FINGERPRINT", object: literal("fingerprint", fingerprint(fn)), attributes: { kind: "intrinsic", valid_from: j.sequence + 1 }, derived_from: [nameId], evidence: { rule: "fingerprint-from-ir", file: rel, sourceHash } });
            count("HAS_FINGERPRINT");
            for (const o of effectProjection(fn)) {
                if (o.what.kind === "CALL_EXTERNAL" || o.what.kind === "WRITE" || o.what.kind === "EMIT") {
                    j.assert({ ...base, subject: ex.id, relation: "HAS_EFFECT", object: literal("effect", { operation: o.what.operation, args: o.what.args.length, under: o.under !== null }), attributes: { kind: o.what.kind }, evidence: { rule: "effect-from-projection", file: rel, sourceHash } });
                    count("HAS_EFFECT");
                }
                if (o.under) {
                    j.assert({ ...base, subject: ex.id, relation: "HAS_PREDICATE", object: literal("predicate", o.under), evidence: { rule: "predicate-from-projection", file: rel, sourceHash } });
                    count("HAS_PREDICATE");
                }
            }
            // IR-6: the boundary values. Parameters come from the arity the encoder recorded; the return comes from the
            // projection's return outcomes. Nothing here is inferred: a function of two inputs has two parameters.
            const params = [];
            for (let i = 0; i < fn.inputs; i++) {
                const v = j.concept("value");
                report.values++;
                j.assert({ ...base, subject: ex.id, relation: "HAS_PARAMETER", object: v.id, attributes: { position: i }, evidence: { rule: "parameter-from-arity", file: rel, construct: `parameter ${i}`, sourceHash } });
                count("HAS_PARAMETER");
                params.push(v.id);
            }
            let ret;
            if (effectProjection(fn).some((o) => o.what.kind === "return" && o.what.value !== undefined)) {
                const v = j.concept("value");
                report.values++;
                ret = v.id;
                j.assert({ ...base, subject: ex.id, relation: "HAS_RETURN", object: v.id, evidence: { rule: "return-from-projection", file: rel, construct: "return with a value", sourceHash } });
                count("HAS_RETURN");
            }
            const list = byName.get(name) ?? [];
            list.push(ex.id);
            byName.set(name, list);
            irs.push({ fn, concept: ex, file: rel, name, params, ret, sourceHash });
        }
    }
    // pass 2: every call in a projection becomes an invocation concept, because two calls to one callee are two
    // flows and a function-to-function edge cannot tell them apart. Its callee resolves only when the operation
    // names exactly one declared function in this corpus; otherwise the invocation is recorded as unresolved or
    // ambiguous and NO callee edge and NO flow is written. A guess about which function was meant is an inference.
    // What the IR-8 pass needs, collected as pass 2 writes it. Reading the store back mid-transaction would see
    // nothing, because events are applied at commit; that was a real defect and this is the fix.
    const siteFacts = [];
    /** A call site's identity: what it calls, with what, on what. The same key pass 2 deduplicates sites on. */
    const siteKeyOf = (operation, args, receiver) => JSON.stringify([operation ?? null, args, receiver ?? null]);
    const valueOf = new Map(); // executable -> parameter values, for the flow lookup
    for (const r of irs)
        valueOf.set(r.concept.id, r.params);
    const returnOf = new Map();
    for (const r of irs)
        returnOf.set(r.concept.id, r.ret);
    for (const { fn, concept, file, params, ret, sourceHash } of irs) {
        const isPython = file.endsWith(".py");
        const encoder = isPython ? PY_ENCODER : TS_ENCODER;
        const base = { source: "PARSED", asserter: encoder, confidence: 1, ir_schema: IR_SCHEMA, encoder };
        const effects = new Map();
        const binds = new Map();
        const key = (operation, args, under) => JSON.stringify([operation, args, under]);
        const add = (m, operation, args, under, returned, receiver, source = "projection") => {
            if (!operation)
                return;
            if (receiver) {
                if (source === "operand")
                    report.receiverSitesFromOperand++;
                else
                    report.receiverSitesFromProjection++;
            }
            const k = key(operation, args, under) + JSON.stringify(receiver ?? null);
            const list = m.get(k) ?? [];
            list.push({ operation, args, isOutcomeReturned: returned, receiver });
            m.set(k, list);
        };
        const fromOperand = (o, under, returned) => {
            if (!o)
                return;
            if (o.kind === "computed") {
                const { inner } = unwrapAwaited(o.expr);
                if (inner.kind === "call")
                    add(binds, inner.operation, inner.args, under, returned, inner.receiver, "operand");
            }
            else if (o.kind === "negated")
                fromOperand(o.operand, under, returned);
            else if (o.kind === "read")
                fromOperand(o.object, under, returned);
        };
        for (const o of effectProjection(fn)) {
            if (o.what.kind === "CALL_EXTERNAL")
                add(effects, o.what.operation, o.what.args, o.under, false, o.what.receiver);
            else if (o.what.kind === "return" || o.what.kind === "throw")
                fromOperand(o.what.value, o.under, o.what.kind === "return");
            else if (o.what.kind === "bind") {
                const { inner } = unwrapAwaited(o.what.expr);
                if (inner.kind === "call")
                    add(binds, inner.operation, inner.args, o.under, false, inner.receiver);
            }
        }
        const sites = [];
        for (const k of new Set([...effects.keys(), ...binds.keys()])) {
            const e = effects.get(k) ?? [], b = binds.get(k) ?? [];
            const chosen = e.length >= b.length ? e : b;
            const dropped = chosen === e ? b : e;
            report.sitesMerged += dropped.length;
            report.sitesMergedWithReceiver += dropped.filter((s) => s.receiver).length;
            const returned = [...e, ...b].some((x) => x.isOutcomeReturned);
            for (const site of chosen)
                sites.push({ ...site, isOutcomeReturned: returned });
        }
        sites.sort((x, y) => key(x.operation, x.args, null).localeCompare(key(y.operation, y.args, null)));
        for (const [index, site] of sites.entries()) {
            const targets = byName.get(site.operation);
            const inv = j.concept("invocation");
            report.invocations++;
            j.assert({ ...base, subject: concept.id, relation: "HAS_INVOCATION", object: inv.id, evidence: { rule: "invocation-from-call-in-projection", file, operation: site.operation, site: index, sourceHash } });
            count("HAS_INVOCATION");
            // IR-7: the receiver, as a boundary value of this invocation. Recorded, not interpreted, and not used to
            // resolve the callee in this round.
            let receiverValue;
            let receiverAssertion;
            if (site.receiver) {
                const rv = j.concept("value");
                report.values++;
                receiverAssertion = j.assert({ ...base, subject: inv.id, relation: "HAS_ARGUMENT", object: rv.id, attributes: { position: -1, role: "receiver", from: site.receiver.kind }, evidence: { rule: "receiver-from-member-call", file, operation: site.operation, site: index, construct: "the entity the operation acts on", sourceHash } });
                receiverValue = rv.id;
                report.receiverArguments++;
                count("HAS_ARGUMENT");
                if (site.receiver.kind === "input" && params[site.receiver.index] !== undefined) {
                    j.assert({ ...base, subject: params[site.receiver.index], relation: "FLOWS_TO", object: rv.id, evidence: { rule: "flow-receiver-to-argument", file, operation: site.operation, site: index, construct: `parameter ${site.receiver.index} is the receiver`, sourceHash } });
                    count("FLOWS_TO");
                    report.flows++;
                }
            }
            // the arguments, whatever the callee turns out to be
            const argValues = [];
            for (const [position, arg] of site.args.entries()) {
                const v = j.concept("value");
                report.values++;
                j.assert({ ...base, subject: inv.id, relation: "HAS_ARGUMENT", object: v.id, attributes: { position, from: arg.kind }, evidence: { rule: "argument-from-call-operand", file, operation: site.operation, site: index, sourceHash } });
                count("HAS_ARGUMENT");
                argValues.push(v.id);
                // a parameter of this function passed straight through as an argument is the same value crossing outward
                if (arg.kind === "input" && params[arg.index] !== undefined) {
                    j.assert({ ...base, subject: params[arg.index], relation: "FLOWS_TO", object: v.id, evidence: { rule: "flow-argument-to-parameter", file, operation: site.operation, site: index, construct: `parameter ${arg.index} passed as argument ${position}`, sourceHash } });
                    count("FLOWS_TO");
                    report.flows++;
                }
            }
            const outcome = j.concept("value");
            report.values++;
            const outcomeAssertion = j.assert({ ...base, subject: inv.id, relation: "HAS_OUTCOME", object: outcome.id, evidence: { rule: "outcome-from-call-site", file, operation: site.operation, site: index, sourceHash } });
            count("HAS_OUTCOME");
            siteFacts.push({ concept: concept.id, fn, file, sourceHash, operation: site.operation, siteKey: siteKeyOf(site.operation, site.args, site.receiver), outcomeId: outcome.id, outcomeAssertion, receiverValue, receiverFrom: site.receiver?.kind, receiverAssertion, receiverOperand: site.receiver });
            if (site.isOutcomeReturned && ret) {
                j.assert({ ...base, subject: outcome.id, relation: "FLOWS_TO", object: ret, evidence: { rule: "flow-outcome-to-return", file, operation: site.operation, site: index, construct: "the call's outcome is returned", sourceHash } });
                count("FLOWS_TO");
                report.flows++;
            }
            if (!targets || targets.length === 0) {
                report.unresolvedCalls[site.operation] = (report.unresolvedCalls[site.operation] ?? 0) + 1;
                report.unresolvedInvocations++;
                continue;
            }
            if (targets.length > 1) {
                report.unresolvedCalls[site.operation] = (report.unresolvedCalls[site.operation] ?? 0) + 1;
                report.ambiguousInvocations++;
                continue;
            }
            if (targets[0] === concept.id) {
                report.selfInvocations++;
                continue;
            } // direct recursion: counted, never a CALLS self-loop
            j.assert({ ...base, subject: inv.id, relation: "INVOKES", object: targets[0], evidence: { rule: "calls-from-resolved-callee", file, operation: site.operation, site: index } });
            count("INVOKES");
            j.assert({ ...base, subject: concept.id, relation: "CALLS", object: targets[0], evidence: { rule: "calls-from-resolved-callee", file, operation: site.operation } });
            count("CALLS");
            report.resolvedCalls++;
            // the crossing: argument i of the site is parameter i of the callee; the callee's return is the outcome
            const calleeParams = valueOf.get(targets[0]) ?? [];
            for (const [position, av] of argValues.entries()) {
                const cp = calleeParams[position];
                if (cp === undefined)
                    continue;
                j.assert({ ...base, subject: av, relation: "FLOWS_TO", object: cp, evidence: { rule: "flow-argument-to-parameter", file, operation: site.operation, site: index, construct: `argument ${position} to parameter ${position}`, sourceHash } });
                count("FLOWS_TO");
                report.flows++;
            }
            const calleeReturn = returnOf.get(targets[0]);
            if (calleeReturn) {
                j.assert({ ...base, subject: calleeReturn, relation: "FLOWS_TO", object: outcome.id, evidence: { rule: "flow-return-to-outcome", file, operation: site.operation, site: index, construct: "the callee's return becomes this call's outcome", sourceHash } });
                count("FLOWS_TO");
                report.flows++;
            }
        }
    }
    // ---- IR-8 Value Continuity ----
    //
    // A receiver value is joined to the value or outcome that produced it, and only where the IR establishes value
    // identity. An identifiable producer expression is necessary and NOT sufficient:
    //
    //   receiver `value N`  -> the outcome of the invocation whose call was bound to N, when N is bound exactly once
    //                          AND that binding is a call, so an outcome exists in the store to flow from.
    //   receiver `computed` -> the outcome of the invocation in the same expression, when that expression IS a call.
    //                          A non-call producer is never converted into an invocation outcome.
    //   receiver `read`     -> nothing: the producer expression is identifiable and the entity in the member is not.
    //
    // Ambiguous or unavailable producers create no edge. Ingestion only: no relation added, no encoder changed, no
    // callee resolved.
    const byExecutable = new Map();
    for (const f of siteFacts) {
        const l = byExecutable.get(f.concept) ?? [];
        l.push(f);
        byExecutable.set(f.concept, l);
    }
    for (const [, facts] of byExecutable) {
        const fn = facts[0].fn;
        const base = { source: "PARSED", asserter: facts[0].file.endsWith(".py") ? PY_ENCODER : TS_ENCODER, confidence: 1, ir_schema: IR_SCHEMA, encoder: facts[0].file.endsWith(".py") ? PY_ENCODER : TS_ENCODER };
        const boundExpr = new Map();
        const walkBind = (body) => {
            for (const st of body) {
                if (st.kind === "bind") {
                    const l = boundExpr.get(st.id) ?? [];
                    l.push(st.expr);
                    boundExpr.set(st.id, l);
                }
                else if (st.kind === "branch") {
                    walkBind(st.then);
                    walkBind(st.else);
                }
            }
        };
        walkBind(fn.body);
        /** The outcome of the call site that IS this producer expression, matched on the site's own identity rather
         * than on its operation name, so a function calling one operation twice can still establish identity. */
        const outcomeOfProducer = (producer) => {
            if (producer.kind !== "call")
                return undefined;
            const key = siteKeyOf(producer.operation, producer.args, producer.receiver);
            const matches = facts.filter((x) => x.siteKey === key);
            if (matches.length !== 1)
                return undefined; // two identical call sites: identity is ambiguous
            return { id: matches[0].outcomeId, assertion: matches[0].outcomeAssertion };
        };
        for (const f of facts) {
            if (!f.receiverValue || f.receiverAssertion === undefined)
                continue;
            if (f.receiverFrom === "value") {
                const id = f.receiverOperand?.kind === "value" ? f.receiverOperand.id : undefined;
                if (id === undefined)
                    continue;
                const bindings = boundExpr.get(id) ?? [];
                if (bindings.length !== 1)
                    continue;
                const producer = bindings[0];
                if (producer.kind !== "call" || !producer.operation)
                    continue;
                const outcome = outcomeOfProducer(producer);
                if (!outcome)
                    continue;
                j.assert({ ...base, subject: outcome.id, relation: "FLOWS_TO", object: f.receiverValue,
                    derived_from: [outcome.assertion, f.receiverAssertion],
                    evidence: { rule: "flow-binding-to-receiver", file: f.file, operation: f.operation, construct: `the outcome of ${producer.operation}() was bound and used as the receiver of ${f.operation}`, sourceHash: f.sourceHash } });
                count("FLOWS_TO");
                report.flows++;
            }
            else if (f.receiverFrom === "computed") {
                const expr = f.receiverOperand?.kind === "computed" ? f.receiverOperand.expr : undefined;
                if (!expr || expr.kind !== "call" || !expr.operation)
                    continue;
                const outcome = outcomeOfProducer(expr);
                if (!outcome)
                    continue;
                j.assert({ ...base, subject: outcome.id, relation: "FLOWS_TO", object: f.receiverValue,
                    derived_from: [outcome.assertion, f.receiverAssertion],
                    evidence: { rule: "flow-invocation-outcome-to-receiver", file: f.file, operation: f.operation, construct: `the outcome of ${expr.operation}() is the receiver of ${f.operation}`, sourceHash: f.sourceHash } });
                count("FLOWS_TO");
                report.flows++;
            }
        }
    }
    return report;
}
/** The value id a receiver was recorded as, for the single call of `operation` in this function. */
function receiverValueIdOf(fn, operation) {
    const found = [];
    for (const o of effectProjection(fn)) {
        const w = o.what;
        const r = w.kind === "CALL_EXTERNAL" && w.operation === operation ? w.receiver
            : w.kind === "bind" && w.expr?.kind === "call" && w.expr.operation === operation ? w.expr.receiver : undefined;
        if (r?.kind === "value")
            found.push(r.id);
    }
    return new Set(found).size === 1 ? found[0] : undefined;
}
/** The expression a computed receiver was, for the single call of `operation` in this function. */
function computedReceiverExprOf(fn, operation) {
    const found = [];
    for (const o of effectProjection(fn)) {
        const w = o.what;
        const r = w.kind === "CALL_EXTERNAL" && w.operation === operation ? w.receiver
            : w.kind === "bind" && w.expr?.kind === "call" && w.expr.operation === operation ? w.expr.receiver : undefined;
        if (r?.kind === "computed")
            found.push(r.expr);
    }
    return found.length === 1 ? found[0] : undefined;
}
