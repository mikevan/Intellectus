import { effectProjection, unwrapAwaited } from "../ir/index.js";
/** Every receiver operand in a function, with the operand kind the encoder recorded. */
function receiversOf(fn) {
    const out = [];
    for (const o of effectProjection(fn)) {
        const w = o.what;
        if (w.kind === "CALL_EXTERNAL" && w.receiver)
            out.push({ operation: w.operation ?? "", receiver: w.receiver });
        if (w.kind === "bind" && w.expr) {
            const { inner } = unwrapAwaited(w.expr);
            if (inner.kind === "call" && inner.receiver)
                out.push({ operation: inner.operation ?? "", receiver: inner.receiver });
        } // R-1A: see through the wrapper; preserves, adds nothing
    }
    return out;
}
/** The bindings of a function, by value id, so a receiver recorded as a value can be looked up. */
function bindingsOf(fn) {
    const found = new Map();
    const walk = (body) => {
        for (const s of body) {
            if (s.kind === "bind") {
                const list = found.get(s.id) ?? [];
                list.push(s.expr);
                found.set(s.id, list);
            }
            else if (s.kind === "branch") {
                walk(s.then);
                walk(s.else);
            }
        }
    };
    walk(fn.body);
    return found;
}
function kindOf(e) {
    switch (e.kind) {
        case "call": return "invocation";
        case "member": return "member-read";
        case "arith": return "arithmetic";
        case "index": return "index";
        case "test": return "test";
        case "choose": return "choose";
        default: return "other";
    }
}
/** Classify producers from the IR itself, per function. The store holds no edge for these, which is the point. */
export function classifyProducers(functions) {
    const group = () => ({ total: 0, identifiable: 0, ambiguous: 0, unavailable: 0, invocationProducers: 0, otherProducers: 0 });
    const groups = { LOCAL_BINDING: group(), MEMBER_VALUE: group(), COMPUTED: group() };
    const records = [];
    let receivers = 0;
    for (const [name, fn] of functions) {
        const bindings = bindingsOf(fn);
        for (const { operation, receiver } of receiversOf(fn)) {
            receivers++;
            let rec;
            if (receiver.kind === "value") {
                // The receiver is a bound value. Its producer is the expression bound to that id, when exactly one exists.
                const bound = bindings.get(receiver.id) ?? [];
                if (bound.length === 1) {
                    const k = kindOf(bound[0]);
                    rec = { group: "LOCAL_BINDING", outcome: "IDENTIFIABLE", producerKind: k, operation, executable: name,
                        because: `The receiver is value ${receiver.id}, bound exactly once in this executable, by ${k}.` };
                }
                else if (bound.length > 1) {
                    rec = { group: "LOCAL_BINDING", outcome: "AMBIGUOUS", operation, executable: name,
                        because: `Value ${receiver.id} is bound ${bound.length} times in this executable, so no single producer can be named.` };
                }
                else {
                    rec = { group: "LOCAL_BINDING", outcome: "UNAVAILABLE", operation, executable: name,
                        because: `Value ${receiver.id} has no binding in this executable's IR, so its producer is not present.` };
                }
            }
            else if (receiver.kind === "read") {
                // The producer EXPRESSION is identifiable; the entity stored in the field is not, and that is recorded.
                const inner = receiver.object;
                rec = { group: "MEMBER_VALUE", outcome: "IDENTIFIABLE", producerKind: "member-read", operation, executable: name,
                    because: `The receiver is a read of "${receiver.property}" from a ${inner.kind} operand, so the producing expression is identifiable while the entity stored in that place is not.` };
            }
            else if (receiver.kind === "computed") {
                const k = kindOf(receiver.expr);
                rec = { group: "COMPUTED", outcome: "IDENTIFIABLE", producerKind: k, operation, executable: name,
                    because: `The receiver is computed where it is used, by ${k}, so its producer is the expression itself.` };
            }
            if (!rec)
                continue;
            const g = groups[rec.group];
            g.total++;
            if (rec.outcome === "IDENTIFIABLE") {
                g.identifiable++;
                if (rec.producerKind === "invocation")
                    g.invocationProducers++;
                else
                    g.otherProducers++;
            }
            else if (rec.outcome === "AMBIGUOUS")
                g.ambiguous++;
            else
                g.unavailable++;
            records.push(rec);
        }
    }
    return {
        receivers,
        groups,
        records,
        limits: [
            "A producer is an expression, not an entity. MEMBER_VALUE identifies the read that produced the receiver and says nothing about what is stored in the field.",
            "This instrument reads the IR directly rather than the store, because the store holds no assertion joining a binding or a computed expression to a receiver use. That absence is what IR-8 would address; nothing here writes it.",
            "A receiver recorded as `unknown` (a free name) is outside these three groups entirely: there is no producer in the function to identify, which is the import and module gap stated in E3-origin.",
        ],
    };
}
