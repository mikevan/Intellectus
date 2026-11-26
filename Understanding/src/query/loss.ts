// Classify what each unresolved or ambiguous invocation cost, and why.
//
// Measurement only. This file changes no representation, resolves no name, and adds no semantics. It classifies by
// occurrence rather than by operation name, because an operation name is a symptom and not a cause, and it reports
// lost composition alongside the counts, because a category with few occurrences and many arguments costs more
// than a category with many trivial ones.
//
// Knowledge from outside the corpus is confined to EXTERNAL_KNOWLEDGE below, declared as data with its source and
// its evidentiary status, so a classification that rests on it can be audited. Nothing else here knows anything
// about any language's library.
import type { ConceptId } from "../concepts/index.js";
import type { Journal } from "../journal/index.js";

export type LossCategory =
  | "REPRESENTATION_LOSS"    // the operation was lost inside an opaque construct
  | "EXTERNAL_UNMODELED"     // an external or runtime target identifiable from declared external evidence
  | "INTERNAL_UNRESOLVED"    // a target exists in the corpus, and the resolver did not identify it
  | "INTERNAL_AMBIGUOUS"     // several corpus targets remain possible
  | "INTERNAL_NONEXECUTABLE" // a declared corpus entity exists, and the model cannot represent it as callable
  | "RECEIVER_UNRESOLVED"    // the operation belongs to a receiver whose identity or type is not represented
  | "DYNAMIC"                // the target genuinely depends on runtime behaviour static evidence cannot determine
  | "UNKNOWN";               // the available evidence does not justify any stronger claim

/** Categories frozen on 2026-09-14 before any occurrence was read; see docs/experiment-log.md, E3-loss-2. */
export const CATEGORY_DEFINITIONS: Readonly<Record<LossCategory, string>> = {
  REPRESENTATION_LOSS: "The call sat inside a construct the IR could not represent, so it was lost before resolution could be attempted.",
  EXTERNAL_UNMODELED: "An external or runtime target identifiable from declared external evidence but absent from the semantic model.",
  INTERNAL_UNRESOLVED: "A declared corpus function exists, and the resolver did not identify it.",
  INTERNAL_AMBIGUOUS: "Several declared corpus targets remain possible, and the store will not choose between them.",
  INTERNAL_NONEXECUTABLE: "A declared corpus entity exists, and the current semantic model cannot represent it as a callable target.",
  RECEIVER_UNRESOLVED: "The operation belongs to an object or receiver whose identity or type is not statically represented.",
  DYNAMIC: "The target genuinely depends on runtime behaviour that the available static evidence cannot determine.",
  UNKNOWN: "The available evidence does not justify any stronger claim.",
};

/** The only knowledge in this file that does not come from the corpus. Every entry carries where it came from and
 * what kind of claim it is, because a classification resting on an undeclared belief is not a measurement. */
export const EXTERNAL_KNOWLEDGE: {
  readonly operations: readonly string[];
  readonly source: string;
  readonly status: "DECLARED_BY_AUTHOR";
  readonly note: string;
} = {
  // Methods of the built-in types of Python and JavaScript, and nothing else. No project-specific names.
  operations: [
    // Python str / list / dict / general builtins
    "split", "strip", "rstrip", "lstrip", "join", "replace", "startswith", "endswith", "find", "rfind", "index",
    "append", "extend", "insert", "pop", "keys", "values", "items", "update", "copy", "isdigit", "isalpha",
    "lower", "upper", "encode", "decode", "format", "str", "int", "float", "len", "range", "enumerate", "zip",
    "isinstance", "getattr", "setattr", "hasattr", "sorted", "reversed", "list", "dict", "set", "tuple", "repr",
    "utcoffset", "dst", "tzname",
    // JavaScript / TypeScript array, string, map, set, object
    "filter", "map", "forEach", "reduce", "some", "every", "slice", "splice", "concat", "push", "shift", "unshift",
    "includes", "indexOf", "get", "set", "has", "add", "delete", "sort", "flatMap", "trim", "padStart", "padEnd",
    "toFixed", "digest", "update", "localeCompare", "endsWith", "startsWith", "test", "exec", "match", "stringify",
    "parse", "from", "of", "assign", "entries", "toString",
  ],
  source: "The author's knowledge of the Python and JavaScript standard libraries, 2026-09-14.",
  status: "DECLARED_BY_AUTHOR",
  note: "Not parsed from the corpus and not verified against any specification. A classification of EXTERNAL_UNMODELED rests on this list and is only as good as it. An operation absent from the list falls to UNKNOWN rather than being guessed.",
};

const EXTERNAL = new Set(EXTERNAL_KNOWLEDGE.operations);

/** The second and last piece of knowledge from outside the store. A class declared in the corpus is visible in the
 * corpus text and absent from the store, because the encoder produces functions and the store has no concept for a
 * class, so the classifier cannot read these from the evidence it is classifying. Declared here with its source so
 * an INTERNAL_NONEXECUTABLE classification can be audited, and confined to class names that appear in the two
 * committed corpora. */
export const DECLARED_CLASSES: {
  readonly names: readonly string[];
  readonly source: string;
  readonly status: "DECLARED_BY_AUTHOR";
  readonly note: string;
} = {
  names: [
    // toml-python: class declarations in decoder.py, encoder.py, ordered.py, tz.py
    "TomlDecoder", "TomlDecodeError", "CommentValue", "InlineTableDict", "DynamicInlineTableDict",
    "TomlEncoder", "TomlPreserveInlineDictEncoder", "TomlArraySeparatorEncoder", "TomlNumpyEncoder",
    "TomlPreserveCommentEncoder", "TomlPathlibEncoder", "TomlOrderedDecoder", "TomlOrderedEncoder",
    "TomlTz",
  ],
  source: "The class declarations of the committed corpora, read from the corpus text on 2026-09-14 because the store holds no concept for a class.",
  status: "DECLARED_BY_AUTHOR",
  note: "This list exists because the encoder does not produce a concept for a class. That absence is the finding; the list is the measurement's way of counting it rather than leaving it in UNKNOWN. Nothing outside the two committed corpora is in it.",
};

export interface LossRecord {
  category: LossCategory;
  operation: string;
  /** The executable the call site sits in, for auditing. */
  caller: ConceptId;
  invocation: ConceptId;
  /** What this unresolved call prevented: its arguments, its outcome, and the flows that could not be written. */
  arguments: number;
  outcome: 1;
  /** Flows a resolved callee would have produced: one per argument plus one for the return. */
  lostFlows: number;
  /** Why this category and not another, in one sentence. */
  because: string;
  /** For EXTERNAL_UNMODELED: the declared knowledge it rests on. Empty for every other category. */
  restsOn?: string;
}

export interface LossReport {
  invocations: number;
  resolved: number;
  classified: number;
  byCategory: Record<LossCategory, { occurrences: number; arguments: number; lostFlows: number; operations: string[] }>;
  records: LossRecord[];
  externalKnowledge: typeof EXTERNAL_KNOWLEDGE;
  declaredClasses: typeof DECLARED_CLASSES;
  /** Stated limits of this instrument, printed with its output. */
  limits: string[];
}

/** Classify from the store alone: the invocations, their arguments, their operations, and which names the corpus
 * declares. An operation is DYNAMIC only when the IR recorded that the callee came from a value. */
export function classifyLoss(j: Journal): LossReport {
  const live = j.liveAssertions();
  const invocations = live.filter((a) => a.relation === "HAS_INVOCATION");
  const invokes = new Set(live.filter((a) => a.relation === "INVOKES").map((a) => a.subject));
  const declaredNames = new Set<string>();
  const nameCount = new Map<string, number>();
  for (const a of live) {
    if (a.relation !== "RENDERS_AS") continue;
    const o = a.object as { type?: string; value?: unknown };
    if (o?.type !== "identifier" || typeof o.value !== "string") continue;
    declaredNames.add(o.value);
    nameCount.set(o.value, (nameCount.get(o.value) ?? 0) + 1);
  }

  const empty = () => ({ occurrences: 0, arguments: 0, lostFlows: 0, operations: [] as string[] });
  const byCategory: LossReport["byCategory"] = {
    REPRESENTATION_LOSS: empty(), EXTERNAL_UNMODELED: empty(), INTERNAL_UNRESOLVED: empty(),
    INTERNAL_AMBIGUOUS: empty(), INTERNAL_NONEXECUTABLE: empty(), RECEIVER_UNRESOLVED: empty(),
    DYNAMIC: empty(), UNKNOWN: empty(),
  };
  const records: LossRecord[] = [];

  for (const inv of invocations) {
    const id = inv.object as ConceptId;
    if (invokes.has(id)) continue;                    // resolved; nothing was lost
    const operation = String((inv.evidence as { operation?: string }).operation ?? "");
    const allArgs = live.filter((a) => a.relation === "HAS_ARGUMENT" && a.subject === id);
    const receiverArg = allArgs.find((a) => a.attributes?.role === "receiver");
    const args = allArgs.filter((a) => a.attributes?.role !== "receiver");
    const argFrom = new Set(args.map((a) => String(a.attributes?.from ?? "")));

    let category: LossCategory;
    let because: string;
    let restsOn: string | undefined;
    if (operation.startsWith("opaque:")) {
      category = "REPRESENTATION_LOSS";
      because = `The call sat inside a construct the IR could not represent (${operation.slice("opaque:".length)}), so the operation and its arguments were lost before resolution could be attempted.`;
    } else if ((nameCount.get(operation) ?? 0) > 1) {
      category = "INTERNAL_AMBIGUOUS";
      because = `${nameCount.get(operation)} functions in this corpus are named ${operation}, and the store will not choose between them.`;
    } else if (declaredNames.has(operation)) {
      category = "INTERNAL_UNRESOLVED";
      because = `A function named ${operation} is declared in this corpus, and the call was not joined to it.`;
    } else if (receiverArg) {
      // IR-7: the call names an operation on an entity. Whether that entity is of the corpus or of the runtime is
      // not knowable without type flow, which this round does not have, so the loss is attributed to the receiver
      // rather than guessed into EXTERNAL_UNMODELED by the operation's name.
      category = "RECEIVER_UNRESOLVED";
      because = `${operation} is called on an entity whose identity or type is not represented, so there is no target to resolve however the operation is named.`;
    } else if (EXTERNAL.has(operation)) {
      category = "EXTERNAL_UNMODELED";
      because = `${operation} is a method of a built-in type rather than a function of this corpus, so there is nothing in the corpus to resolve it to.`;
      restsOn = EXTERNAL_KNOWLEDGE.source;
    } else if (DECLARED_CLASSES.names.includes(operation)) {
      category = "INTERNAL_NONEXECUTABLE";
      because = `${operation} is a class declared in this corpus; a class is not an executable in the store, so a constructor call has no callable target to resolve to.`;
      restsOn = DECLARED_CLASSES.source;
    } else if (argFrom.has("computed") && operation === "") {
      category = "DYNAMIC";
      because = "The callee itself came from a value, so no static target exists.";
    } else {
      category = "UNKNOWN";
      because = `${operation} names nothing in this corpus and is not in the declared list of built-in operations, so it cannot be classified on the evidence available.`;
    }

    const lostFlows = args.length + 1;               // one flow per argument, plus the callee's return to the outcome
    const bucket = byCategory[category];
    bucket.occurrences++;
    bucket.arguments += args.length;
    bucket.lostFlows += lostFlows;
    if (!bucket.operations.includes(operation)) bucket.operations.push(operation);
    records.push({ category, operation, caller: inv.subject, invocation: id, arguments: args.length, outcome: 1, lostFlows, because, restsOn });
  }

  return {
    invocations: invocations.length,
    resolved: invokes.size,
    classified: records.length,
    byCategory,
    records,
    externalKnowledge: EXTERNAL_KNOWLEDGE,
    declaredClasses: DECLARED_CLASSES,
    limits: [
      "RECEIVER_UNRESOLVED is now populated from IR-7's preserved receiver, and it takes precedence over EXTERNAL_UNMODELED when a call has a receiver, because the operation's name cannot tell a runtime method from a method of the corpus. So EXTERNAL_UNMODELED now means a bare call to a built-in name, and the split between runtime receivers and corpus receivers still needs type flow, which this round does not have.",
      "DYNAMIC can only be populated where the IR recorded that the callee came from a value, which the current adapters never do, so it stays at zero for the same reason.",
      "REPRESENTATION_LOSS exposes zero arguments by construction, so its full cost is not measurable by this instrument.",
    ],
  };
}
