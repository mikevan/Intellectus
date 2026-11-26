export const EMITTER_NEEDS = [
    "per step: the operation performed, and for a call the identity of the callee",
    "per step: every operand with its identity, including receivers",
    "per step: the control condition under which it runs, with its predicate and operands",
    "per step: the value produced, and where it goes next",
    "per effect: the target, the operation's identity and semantics, the arguments, the ordering relative to other effects, and any externally observable behaviour required for equivalence",
    "per thread: the entry point and its parameters",
    "per thread: the exit and its value",
    "per thread: the semantic entity identity of anything constructed (a class or structured object; NOT a programming-language type)",
];
export const MISSING_FACT_DEFINITIONS = {
    CALLEE_UNIDENTIFIED: "A call whose callee the store does not identify, so the emitter cannot know what to call.",
    RECEIVER_UNIDENTIFIED: "A receiver whose identity the store does not establish, so the emitter cannot know what the operation acts on.",
    OPERAND_UNIDENTIFIED: "An operand the store records as unknown, so the emitter cannot know what value is used.",
    EXPRESSION_UNREPRESENTED: "A transformation with no concept in the store, so the emitter has nothing to render it from.",
    EFFECT_UNDERSPECIFIED: "An effect whose invocation is known and whose semantics are not: no target identity, no operation semantics, no externally observable behaviour. Enough to say it happened, not enough to reproduce it.",
    ENTITY_UNREPRESENTED: "A constructed entity with no concept in the store, because the store has no concept for a class or structured object. Semantic entity identity, not a programming-language type.",
    ORDER_UNSPECIFIED: "Two or more effects whose relative order the store does not fix, so the emitter cannot know the sequence.",
    TYPE_REQUIRED: "Equivalent regeneration actually requires type information that cannot be recovered from the semantic facts present. Convenience does not count.",
};
/**
 * R-1B0: order accounting. A pair of observable effects in one executable is FIXED when facts of a relation
 * designated in ORDER_RELATIONS connect the two occurrences on one control path, directly or by a chain. Frozen in
 * the log before this code existed. No relation is designated yet, and effects are stored as literals with no
 * occurrence identity, so nothing could be named by an order fact: every pair is unordered by construction.
 */
export const ORDER_RELATIONS = [];
export const ORDER_DEFINITION = "A pair of observable effects in one executable is fixed when facts of a designated order relation connect the two occurrences on one control path, directly or by a chain.";
function index(j) {
    const live = j.liveAssertions();
    const names = new Map();
    for (const a of live)
        if (a.relation === "RENDERS_AS" && a.object.type === "identifier")
            names.set(a.subject, String(a.object.value));
    const calls = new Map();
    for (const a of live.filter((x) => x.relation === "CALLS")) {
        const l = calls.get(a.subject) ?? [];
        l.push(a.object);
        calls.set(a.subject, l);
    }
    const invocationsOf = new Map();
    for (const a of live.filter((x) => x.relation === "HAS_INVOCATION")) {
        const l = invocationsOf.get(a.subject) ?? [];
        l.push(a);
        invocationsOf.set(a.subject, l);
    }
    return { live, nameOf: (c) => names.get(c) ?? String(c), calls, invocationsOf };
}
/** A thread: an entry executable and everything reachable from it through resolved calls. */
function membersOf(entry, s) {
    const seen = new Set([entry]);
    const stack = [entry];
    while (stack.length) {
        const at = stack.pop();
        for (const to of s.calls.get(at) ?? [])
            if (!seen.has(to)) {
                seen.add(to);
                stack.push(to);
            }
    }
    return [...seen];
}
const OBSERVABLE = new Set(["CALL_EXTERNAL", "WRITE", "EMIT"]);
export function checkSufficiency(j) {
    const s = index(j);
    const executables = s.live.filter((a) => a.relation === "MEMBER_OF").map((a) => a.subject);
    const calledBy = new Set(s.live.filter((a) => a.relation === "CALLS").map((a) => String(a.object)));
    // an entry is an executable nothing in the corpus calls: the head of a thread
    const entries = executables.filter((e) => !calledBy.has(String(e)));
    const threads = [];
    for (const entry of entries) {
        const members = membersOf(entry, s);
        const occurrences = [];
        let branches = 0, observableEffects = 0, boundaryCrossings = 0, opaqueStatements = 0;
        const effectsPerExecutable = new Map();
        for (const m of members) {
            const where = s.nameOf(m);
            for (const a of s.live.filter((x) => x.subject === m)) {
                if (a.relation === "HAS_PREDICATE")
                    branches++;
                if (a.relation === "HAS_EFFECT") {
                    const kind = String(a.attributes?.kind ?? "");
                    const eff = a.object;
                    const operation = eff.value?.operation ?? "";
                    if (operation.startsWith("opaque:")) {
                        opaqueStatements++;
                        continue;
                    }
                    if (OBSERVABLE.has(kind)) {
                        observableEffects++;
                        effectsPerExecutable.set(m, (effectsPerExecutable.get(m) ?? 0) + 1);
                        // an effect is recorded as an operation, an argument count and a path condition, and nothing else:
                        // no target identity, no operation semantics, no observable behaviour
                        occurrences.push({ fact: "EFFECT_UNDERSPECIFIED", where: `${where}: ${operation}`,
                            because: "The store records the operation, an argument count and the path condition. It holds no target identity, no semantics for the operation, and no externally observable behaviour, so an equivalent effect cannot be produced from it." });
                    }
                }
            }
            // calls whose callee is not identified
            for (const inv of s.invocationsOf.get(m) ?? []) {
                const invId = inv.object;
                const operation = String(inv.evidence.operation ?? "");
                if (operation.startsWith("opaque:")) {
                    opaqueStatements++;
                    continue;
                }
                const resolved = s.live.some((x) => x.relation === "INVOKES" && x.subject === invId);
                const receiver = s.live.find((x) => x.relation === "HAS_ARGUMENT" && x.subject === invId && x.attributes?.role === "receiver");
                if (!resolved) {
                    occurrences.push({ fact: "CALLEE_UNIDENTIFIED", where: `${where}: ${operation}`,
                        because: `The store does not identify what ${operation} refers to, so an emitter cannot know what to call.` });
                }
                if (receiver) {
                    const from = String(receiver.attributes?.from ?? "");
                    const inFlow = s.live.some((x) => x.relation === "FLOWS_TO" && String(x.object) === String(receiver.object));
                    if (!inFlow && from !== "input") {
                        occurrences.push({ fact: "RECEIVER_UNIDENTIFIED", where: `${where}: ${operation}`,
                            because: `The receiver of ${operation} is recorded as ${from} and is joined to nothing, so an emitter cannot know what the operation acts on.` });
                    }
                    if (from === "read") {
                        occurrences.push({ fact: "EXPRESSION_UNREPRESENTED", where: `${where}: receiver of ${operation}`,
                            because: "The receiver is a member read, which the store holds as an operand kind and not as a concept, so there is nothing to render the transformation from." });
                    }
                }
                // arguments recorded as unknown
                for (const arg of s.live.filter((x) => x.relation === "HAS_ARGUMENT" && x.subject === invId && x.attributes?.role !== "receiver")) {
                    if (String(arg.attributes?.from ?? "") === "unknown")
                        occurrences.push({ fact: "OPERAND_UNIDENTIFIED", where: `${where}: argument of ${operation}`,
                            because: "The store records this operand as unknown, so an emitter cannot know which value is passed." });
                }
                // a constructed entity: the operation names nothing callable and the store has no concept for a class
                if (!resolved && /^[A-Z]/.test(operation))
                    occurrences.push({ fact: "ENTITY_UNREPRESENTED", where: `${where}: ${operation}`,
                        because: `${operation} is constructed and the store has no concept for a class or structured object, so its semantic entity identity is absent.` });
            }
            if (boundaryCrossingsIn(m, s))
                boundaryCrossings++;
        }
        // two or more observable effects in one executable and nothing fixing their order
        for (const [m, n] of effectsPerExecutable)
            if (n >= 2)
                occurrences.push({ fact: "ORDER_UNSPECIFIED", where: s.nameOf(m),
                    because: `${n} observable effects in one executable, and the store fixes no order between them.` });
        const failed = [];
        if (members.length < 3)
            failed.push(`only ${members.length} executable(s), needs 3`);
        if (branches < 1)
            failed.push("no branch");
        if (observableEffects < 1)
            failed.push("no observable effect");
        if (boundaryCrossings < 1)
            failed.push("no value crosses an executable boundary");
        if (opaqueStatements > 0)
            failed.push(`${opaqueStatements} opaque construct(s)`);
        const qualification = { executables: members.length, branches, observableEffects, boundaryCrossings, opaqueStatements, qualifies: failed.length === 0, failed };
        const byFact = new Map();
        for (const o of occurrences) {
            const l = byFact.get(o.fact) ?? [];
            l.push(o.where);
            byFact.set(o.fact, l);
        }
        threads.push({
            entry: s.nameOf(entry), entryConcept: entry, members: members.map((m) => s.nameOf(m)),
            qualification, sufficient: qualification.qualifies && occurrences.length === 0,
            missing: [...byFact].map(([fact, where]) => ({ fact, count: where.length, where: [...new Set(where)].slice(0, 6) })).sort((a, b) => b.count - a.count),
            occurrences,
            order: pairsOf(effectsPerExecutable),
        });
    }
    const qualifying = threads.filter((t) => t.qualification.qualifies);
    const rankMap = new Map();
    for (const t of qualifying)
        for (const o of t.occurrences) {
            const r = rankMap.get(o.fact) ?? { occurrences: 0, threads: new Set() };
            r.occurrences++;
            r.threads.add(t.entry);
            rankMap.set(o.fact, r);
        }
    // R-1B0: the same accounting over every executable in the corpus, not only those inside threads.
    const corpusEffects = new Map();
    for (const a of s.live)
        if (a.relation === "HAS_EFFECT" && OBSERVABLE.has(String(a.attributes?.kind ?? "")))
            corpusEffects.set(a.subject, (corpusEffects.get(a.subject) ?? 0) + 1);
    const corpusPairs = pairsOf(corpusEffects);
    const order = {
        orderRelations: ORDER_RELATIONS,
        definition: ORDER_DEFINITION,
        executables: [...corpusEffects.values()].filter((n) => n >= 2).length,
        pairs: corpusPairs.pairs,
        fixed: corpusPairs.pairs - corpusPairs.unordered,
        unordered: corpusPairs.unordered,
        limits: [
            "No relation is designated as an order relation yet, so no pair can be fixed. That is the starting point R-1B measures from, not a result.",
            "Effects are stored as literals on HAS_EFFECT, with no occurrence identity, so there is no node an order fact could name. R-1B1 must give effect occurrences an identity before any candidate relation can be tried.",
            "HAS_EFFECT records only whether an effect is under a condition, and HAS_PREDICATE is not linked to any particular effect, so the store cannot tell whether two effects can run on the same path. Pairs on mutually exclusive branches are counted as unordered, which inflates the count until path membership is represented.",
        ],
    };
    return {
        emitterNeeds: EMITTER_NEEDS,
        order,
        threads,
        qualifying: qualifying.length,
        sufficientThreads: threads.filter((t) => t.sufficient).length,
        ranked: [...rankMap].map(([fact, r]) => ({ fact, occurrences: r.occurrences, threads: r.threads.size })).sort((a, b) => b.occurrences - a.occurrences),
        limits: [
            "A thread here is an entry executable and everything reachable from it through RESOLVED calls. With 12 and 16 resolved calls in the two corpora, threads are short, and a thread's members understate the work the source actually does.",
            "TYPE_REQUIRED is not populated by this checker. It is counted only where equivalent regeneration actually requires type information that cannot be recovered from the semantic facts present, and deciding that needs an emitter to fail for that reason. Convenience does not count, and nothing here guesses.",
            "A verdict is only as good as EMITTER_NEEDS. If an emitter later fails for a reason not on that list, the list was incomplete and the log records that as a finding about the checklist.",
        ],
    };
}
/**
 * Pairs of observable effects per executable, and how many are unordered. With no designated order relation and no
 * occurrence identity for effects, every pair is unordered; the function exists so R-1B2 changes one place.
 */
function pairsOf(effectsPerExecutable) {
    let pairs = 0;
    for (const n of effectsPerExecutable.values())
        pairs += (n * (n - 1)) / 2;
    return { pairs, unordered: pairs };
}
/** Does any value cross an executable boundary in this executable's invocations? */
function boundaryCrossingsIn(m, s) {
    for (const inv of s.invocationsOf.get(m) ?? []) {
        const invId = inv.object;
        const args = s.live.filter((x) => x.relation === "HAS_ARGUMENT" && x.subject === invId).map((x) => String(x.object));
        if (s.live.some((x) => x.relation === "FLOWS_TO" && args.includes(String(x.object))))
            return true;
        if (s.live.some((x) => x.relation === "FLOWS_TO" && args.includes(x.subject)))
            return true;
    }
    return false;
}
