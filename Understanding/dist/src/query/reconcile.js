export function reconcile(report, loss, origins, producers) {
    const operationOccurrences = Object.values(report.unresolvedCalls).reduce((s, n) => s + n, 0);
    const pseudo = loss.byCategory.REPRESENTATION_LOSS.occurrences;
    const realCalls = loss.classified - pseudo;
    const populations = [
        { name: "invocations", count: report.invocations, definition: "HAS_INVOCATION assertions: one per call site after the effect/bind merge below." },
        { name: "resolved invocations", count: report.resolvedCalls, definition: "Invocations whose operation named exactly one executable in this corpus, other than the caller; each writes INVOKES and CALLS." },
        { name: "unresolved invocations", count: report.unresolvedInvocations, definition: "Invocations whose operation named no executable in this corpus." },
        { name: "ambiguous invocations", count: report.ambiguousInvocations, definition: "Invocations whose operation named more than one executable; never resolved to one of them." },
        { name: "self invocations", count: report.selfInvocations, definition: "Invocations whose only candidate is the caller itself: direct recursion. No CALLS self-loop is written, so these appear in no other bucket." },
        { name: "call-operation occurrences", count: operationOccurrences, definition: "Entries in the operation table: unresolved plus ambiguous invocations, counted by operation name. `opaque:` entries stand for unrepresented statements and are not calls." },
        { name: "invocations with no CALLS edge", count: loss.classified, definition: "The population the cost table classifies: every invocation without an INVOKES edge, which is unresolved plus ambiguous plus self." },
        { name: "of those, pseudo-invocations", count: pseudo, definition: "REPRESENTATION_LOSS rows: one per opaque statement, standing in for a construct the IR cannot represent. Not calls." },
        { name: "of those, calls", count: realCalls, definition: "Invocations with no CALLS edge that are actual call sites." },
        { name: "receiver arguments in the store", count: report.receiverArguments, definition: "HAS_ARGUMENT assertions with role=receiver: one per merged call site that carries a receiver. The population the origin instrument reads." },
        { name: "receiver occurrences in the IR", count: producers.receivers, definition: "Receivers read straight from the semantic projection, before the merge: the population the producer instrument reads." },
        { name: "receiver sites from the projection", count: report.receiverSitesFromProjection, definition: "Receiver-bearing call sites read from the semantic projection before the merge: exactly what the producer instrument counts." },
        { name: "receiver sites from returned or thrown operands", count: report.receiverSitesFromOperand, definition: "Receiver-bearing call sites the ingestion additionally finds inside returned and thrown operands. The producer instrument does not walk these." },
        { name: "call sites merged", count: report.sitesMerged, definition: "Sites the effect/bind rule merged: one call reported twice by the projection becomes one invocation." },
        { name: "of those, carrying a receiver", count: report.sitesMergedWithReceiver, definition: "Merged sites whose call had a receiver: the whole difference between the two receiver populations." },
    ];
    const id = (name, left, right, arithmetic) => ({ name, left, right, holds: left === right, arithmetic });
    const identities = [
        id("invocations account for every call site", report.invocations, report.resolvedCalls + report.unresolvedInvocations + report.ambiguousInvocations + report.selfInvocations, `${report.invocations} = ${report.resolvedCalls} resolved + ${report.unresolvedInvocations} unresolved + ${report.ambiguousInvocations} ambiguous + ${report.selfInvocations} self`),
        id("the operation table counts unresolved and ambiguous only", operationOccurrences, report.unresolvedInvocations + report.ambiguousInvocations, `${operationOccurrences} = ${report.unresolvedInvocations} unresolved + ${report.ambiguousInvocations} ambiguous`),
        id("the cost table classifies every invocation without a CALLS edge", loss.classified, report.invocations - report.resolvedCalls, `${loss.classified} = ${report.invocations} invocations - ${report.resolvedCalls} resolved`),
        id("the cost table separates calls from pseudo-invocations", loss.classified, pseudo + realCalls, `${loss.classified} = ${pseudo} pseudo-invocations + ${realCalls} calls`),
        id("the origin instrument reads the store's receiver arguments", origins.receivers, report.receiverArguments, `${origins.receivers} = ${report.receiverArguments} receiver arguments`),
        id("the producer instrument counts the projection's receiver sites", producers.receivers, report.receiverSitesFromProjection, `${producers.receivers} IR occurrences = ${report.receiverSitesFromProjection} receiver sites from the projection`),
        id("the store's receiver arguments are the sites seen, less those merged", report.receiverArguments, report.receiverSitesFromProjection + report.receiverSitesFromOperand - report.sitesMergedWithReceiver, `${report.receiverArguments} store arguments = ${report.receiverSitesFromProjection} from the projection + ${report.receiverSitesFromOperand} from returned or thrown operands - ${report.sitesMergedWithReceiver} merged`),
    ];
    return { populations, identities, reconciles: identities.every((i) => i.holds) };
}
