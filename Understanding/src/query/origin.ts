// Where does a preserved receiver come from? Apparatus only: this file adds no inference, resolves no call, and
// infers no type. It reads what IR-7 already recorded about the receiver operand and classifies its ORIGIN, which
// is a different and prior question to its type. UNRESOLVED is a legitimate answer and is not to be squeezed.
import type { ConceptId } from "../concepts/index.js";
import type { Journal } from "../journal/index.js";

export type ReceiverOrigin =
  | "PARAMETER"               // the receiver is a parameter of the executable
  | "LOCAL_BINDING"           // it came from a local binding
  | "CALL_OUTCOME"            // it came from another invocation
  | "MEMBER_VALUE"            // it came from a member access
  | "MODULE_OR_IMPORTED"      // it refers to module or import identity, where preserved
  | "LITERAL_OR_CONSTRUCTED"  // a directly created value, where mechanically visible
  | "UNRESOLVED";             // the origin cannot be established from IR-7

/** Frozen 2026-09-14 before any occurrence was read; see docs/experiment-log.md, E3-origin. */
export const ORIGIN_DEFINITIONS: Readonly<Record<ReceiverOrigin, string>> = {
  PARAMETER: "The receiver is a parameter of the executable the call sits in, so its identity arrives from the caller.",
  LOCAL_BINDING: "The receiver came from a value bound earlier in this executable.",
  CALL_OUTCOME: "The receiver is the outcome of another invocation in this executable.",
  MEMBER_VALUE: "The receiver was read from a named place on something else.",
  MODULE_OR_IMPORTED: "The receiver names module or import identity rather than a value in this executable.",
  LITERAL_OR_CONSTRUCTED: "The receiver is a value created where it is used, visible mechanically.",
  UNRESOLVED: "IR-7 does not record enough about this receiver to establish where it came from.",
};

export interface OriginRecord {
  origin: ReceiverOrigin;
  operation: string;
  caller: ConceptId;
  invocation: ConceptId;
  receiverValue: ConceptId;
  /** True when the receiver value is joined to something else by FLOWS_TO, in either direction. */
  participatesInFlow: boolean;
  /** How many steps of the existing value graph the receiver can be followed back through. */
  traceableSteps: number;
  because: string;
  /** The assertions this classification rests on. */
  supporting: number[];
}

export interface OriginReport {
  receivers: number;
  byOrigin: Record<ReceiverOrigin, { occurrences: number; inFlow: number; operations: string[] }>;
  records: OriginRecord[];
  /** The prediction this measurement tests: how many receivers have a mechanically traceable origin. */
  traceable: number;
  limits: string[];
}

export function classifyReceiverOrigins(j: Journal): OriginReport {
  const live = j.liveAssertions();
  const receiverArgs = live.filter((a) => a.relation === "HAS_ARGUMENT" && a.attributes?.role === "receiver");
  const invocationOf = new Map<ConceptId, { caller: ConceptId; operation: string }>();
  for (const a of live.filter((x) => x.relation === "HAS_INVOCATION"))
    invocationOf.set(a.object as ConceptId, { caller: a.subject, operation: String((a.evidence as { operation?: string }).operation ?? "") });
  const parameters = new Set(live.filter((a) => a.relation === "HAS_PARAMETER").map((a) => String(a.object)));
  const outcomes = new Set(live.filter((a) => a.relation === "HAS_OUTCOME").map((a) => String(a.object)));
  const flowsInto = new Map<string, { from: string; assertion: number }[]>();
  const flowsOutOf = new Set<string>();
  for (const f of live.filter((a) => a.relation === "FLOWS_TO")) {
    const to = String(f.object);
    const list = flowsInto.get(to) ?? []; list.push({ from: f.subject, assertion: f.id }); flowsInto.set(to, list);
    flowsOutOf.add(f.subject);
  }

  const empty = () => ({ occurrences: 0, inFlow: 0, operations: [] as string[] });
  const byOrigin: OriginReport["byOrigin"] = {
    PARAMETER: empty(), LOCAL_BINDING: empty(), CALL_OUTCOME: empty(), MEMBER_VALUE: empty(),
    MODULE_OR_IMPORTED: empty(), LITERAL_OR_CONSTRUCTED: empty(), UNRESOLVED: empty(),
  };
  const records: OriginRecord[] = [];

  for (const ra of receiverArgs) {
    const value = String(ra.object);
    const inv = invocationOf.get(ra.subject) ?? { caller: ra.subject, operation: "" };
    const from = ra.attributes?.from;                       // the operand kind the encoder recorded
    const incoming = flowsInto.get(value) ?? [];
    const supporting = [ra.id, ...incoming.map((i) => i.assertion)];

    // Follow the value graph backwards as far as it goes, counting steps. No inference: these are FLOWS_TO
    // assertions ingestion wrote from parsed evidence.
    let steps = 0; let at = value; const seen = new Set<string>([value]);
    for (;;) {
      const back = flowsInto.get(at);
      if (!back || back.length !== 1 || seen.has(back[0].from)) break;
      at = back[0].from; seen.add(at); steps++;
    }

    let origin: ReceiverOrigin;
    let because: string;
    if (incoming.length === 1 && parameters.has(at)) {
      origin = "PARAMETER";
      because = `The receiver is traceable back ${steps} step${steps === 1 ? "" : "s"} to a parameter of the executable, so its identity arrives from the caller.`;
    } else if (incoming.length === 1 && outcomes.has(at)) {
      origin = "CALL_OUTCOME";
      because = "The receiver is traceable back to the outcome of another invocation in this executable.";
    } else if (from === "value") {
      origin = "LOCAL_BINDING";
      because = "The encoder recorded the receiver as a value bound earlier in this executable, though no flow edge joins it to its binding.";
    } else if (from === "read") {
      origin = "MEMBER_VALUE";
      because = "The receiver was read from a named place on something else.";
    } else if (from === "literal") {
      origin = "LITERAL_OR_CONSTRUCTED";
      because = "The receiver is a literal value where it is used.";
    } else if (from === "input") {
      origin = "PARAMETER";
      because = "The encoder recorded the receiver as a parameter of the executable.";
    } else {
      origin = "UNRESOLVED";
      because = `IR-7 recorded the receiver as ${String(from)}, which does not say where it came from. Establishing that needs information IR-7 does not hold.`;
    }

    const participatesInFlow = incoming.length > 0 || flowsOutOf.has(value);
    const bucket = byOrigin[origin];
    bucket.occurrences++;
    if (participatesInFlow) bucket.inFlow++;
    if (!bucket.operations.includes(inv.operation)) bucket.operations.push(inv.operation);
    records.push({ origin, operation: inv.operation, caller: inv.caller, invocation: ra.subject, receiverValue: value as ConceptId, participatesInFlow, traceableSteps: steps, because, supporting });
  }

  return {
    receivers: receiverArgs.length,
    byOrigin,
    records,
    traceable: records.filter((r) => r.origin !== "UNRESOLVED").length,
    limits: [
      "MODULE_OR_IMPORTED cannot be populated: the store holds module concepts, and the encoder records an imported name as a free name rather than as the module it came from, so an imported receiver is indistinguishable from any other unbound name.",
      "An origin is not a type. PARAMETER says the identity arrives from the caller; it says nothing about what the caller passed.",
      "LOCAL_BINDING and MEMBER_VALUE are read from the operand kind the encoder recorded, not followed through the value graph, because ingestion writes no flow edge from a binding to a receiver use.",
    ],
  };
}
