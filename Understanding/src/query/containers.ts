// I-1: what an opaque container conceals.
//
// The measure counts a loop, a try, a with, or a nested def as ONE opaque statement and never looks inside it,
// because the IR gives an opaque statement no body. So a `yield` inside a `with` inside a loop is not counted at
// all, and the top-level opaque count understates what the IR fails to expose. This instrument reads the source
// again and counts those statements.
//
// A HIDDEN STATEMENT is a semantic source statement that lies beneath an opaque container and therefore has no
// independently represented semantic statement in the current IR. Counted exactly ONCE, however many opaque
// ancestors it has, and attributed to its nearest one. A statement inside a nested function is NOT hidden: the
// adapters encode nested functions as executables of their own, so those statements are represented elsewhere.
//
// Observational only. It writes nothing, changes no encoder, and makes no claim that a hidden statement belongs in
// the flattened statement count. What to do about them is representation work, later, and not this instrument's.
//
// The classification tables below are a deliberate SECOND COPY of the adapters' rules. Exporting the adapters'
// own functions would change their bytes, and those bytes are frozen by test/ir/frozen.test.ts so that no result
// can come from a tuned encoder. A copy that agrees is worth more than a freeze that does not hold: the agreement
// is proved by measurement in test/ir/containers.test.ts, which requires this instrument's counts of represented
// statements to equal the adapters' own on all three corpora.
import type { Node } from "web-tree-sitter";
import { parse, children } from "../adapters/treeSitter.js";
import type { StatementClass } from "../ir/index.js";

export type Language = "python" | "typescript";

/** Node types the adapters turn into an opaque statement. A container is one of these that holds statements. */
const OPAQUE: Record<Language, Set<string>> = {
  python: new Set(["for_statement", "while_statement", "match_statement", "try_statement", "with_statement",
    "class_definition", "function_definition", "import_statement", "import_from_statement", "global_statement",
    "nonlocal_statement", "decorated_definition", "pass_statement", "delete_statement", "assert_statement"]),
  typescript: new Set(["for_statement", "for_in_statement", "while_statement", "do_statement", "switch_statement",
    "try_statement", "labeled_statement", "empty_statement", "class_declaration", "function_declaration",
    "interface_declaration", "type_alias_declaration", "enum_declaration", "import_statement", "export_statement",
    "ambient_declaration"]),
};

/** Where a statement sits: the node types whose named children are statements. */
const BODY: Record<Language, Set<string>> = {
  python: new Set(["block", "module"]),
  typescript: new Set(["statement_block", "program", "switch_case", "switch_default"]),
};

/** Functions the adapters encode as executables in their own right. Their statements are represented there. */
const ENCODED: Record<Language, Set<string>> = {
  python: new Set(["function_definition"]),
  typescript: new Set(["function_declaration", "method_definition"]),
};

const NON_SEMANTIC: Record<Language, Set<string>> = {
  python: new Set(["pass_statement", "comment"]),
  typescript: new Set(["empty_statement", "comment"]),
};
const METADATA: Record<Language, Set<string>> = {
  python: new Set(["import_statement", "import_from_statement", "global_statement", "nonlocal_statement", "future_import_statement"]),
  typescript: new Set(["import_statement", "export_statement", "type_alias_declaration", "interface_declaration", "ambient_declaration", "declare_statement"]),
};

function classOf(lang: Language, node: Node): StatementClass {
  if (NON_SEMANTIC[lang].has(node.type)) return "NON_SEMANTIC";
  if (METADATA[lang].has(node.type)) return "METADATA";
  if (node.type === "expression_statement") {
    const inner = children(node)[0];
    if (lang === "python") {
      if (inner && (inner.type === "string" || inner.type === "concatenated_string")) return "NON_SEMANTIC";
      if (inner && inner.type === "type") return "METADATA";
    } else if (inner && (inner.type === "string" || inner.type === "template_string")) return "NON_SEMANTIC";
  }
  return "SEMANTIC";
}

/** What the statement actually is: an expression statement is named by what it holds, so a `yield` reads as one. */
function constructOf(node: Node): string {
  if (node.type !== "expression_statement") return node.type;
  const inner = children(node)[0];
  if (!inner) return "empty";
  if (inner.type === "await_expression") return "await";
  return inner.type;
}

export interface HiddenStatement {
  file: string;
  line: number;
  column: number;
  nodeType: string;
  construct: string;
  classification: StatementClass;
  /** The opaque container immediately above it, with its line: what conceals this statement. */
  nearestContainer: string;
  nearestContainerLine: number;
  /** How many opaque containers are above it, within the same function. 1 means directly inside one. */
  depth: number;
}

export interface ContainerReport {
  files: number;
  /** SOURCE statements in encoded function bodies that lie under no opaque container. NOT the same population as
   * the measure's statement count and not comparable one to one with it: one source statement can become several
   * IR statements, because a tuple assignment becomes one binding per target and a conditional expression becomes
   * a branch with two arms. On radon: 430 source statements here against 435 IR statements there. */
  sourceStatementsRepresented: Record<StatementClass, number>;
  hidden: HiddenStatement[];
  /** Hidden statements by the container immediately above them: what each opaque construct conceals. */
  byNearestContainer: Record<string, { total: number } & Record<StatementClass, number>>;
  /** Hidden statements by IR-9 classification: what meaning the IR fails to expose. */
  byClassification: Record<StatementClass, number>;
  /** Hidden statements by construct, worst first, so `yield` and `await` are visible as themselves. */
  byConstruct: Record<string, number>;
  /** Not hidden by the definition above, and not represented either. Counted apart, never mixed in. */
  outsideAnyFunction: number;
  inUnencodedFunctionBodies: number;
  limits: string[];
}

const emptyClasses = (): Record<StatementClass, number> => ({ SEMANTIC: 0, NON_SEMANTIC: 0, METADATA: 0 });

export async function measureContainers(files: { path: string; source: string; language: Language }[]): Promise<ContainerReport> {
  const hidden: HiddenStatement[] = [];
  const sourceStatementsRepresented = emptyClasses();
  const byNearestContainer: ContainerReport["byNearestContainer"] = {};
  const byClassification = emptyClasses();
  const byConstruct: Record<string, number> = {};
  let outsideAnyFunction = 0;
  let inUnencodedFunctionBodies = 0;
  const seen = new Set<string>();   // file:line:column, so a statement under three containers is still one statement

  for (const { path: file, source, language: lang } of files) {
    const root = await parse(lang, source);

    /** Walk one function body. `stack` holds the opaque containers above, within this function only. */
    const walkFunction = (node: Node, stack: Node[], inUnencoded: boolean): void => {
      for (const child of children(node)) {
        // A case label is the value being matched, not a statement: `case "x":` holds a string that is no more a
        // statement than an if's condition is. Counting it made 36 TypeScript case labels read as hidden strings.
        const isCaseLabel = (node.type === "switch_case") && child.id === node.childForFieldName("value")?.id;
        const isStatement = BODY[lang].has(node.type) && !isCaseLabel;
        const opaque = OPAQUE[lang].has(child.type);
        if (isStatement) {
          const key = `${file}:${child.startPosition.row + 1}:${child.startPosition.column}`;
          if (stack.length > 0 && !seen.has(key)) {
            seen.add(key);
            const nearest = stack[stack.length - 1]!;
            const classification = classOf(lang, child);
            const construct = constructOf(child);
            hidden.push({ file, line: child.startPosition.row + 1, column: child.startPosition.column, nodeType: child.type, construct, classification, nearestContainer: nearest.type, nearestContainerLine: nearest.startPosition.row + 1, depth: stack.length });
            const bucket = byNearestContainer[nearest.type] ?? (byNearestContainer[nearest.type] = { total: 0, ...emptyClasses() });
            bucket.total++; bucket[classification]++;
            byClassification[classification]++;
            byConstruct[construct] = (byConstruct[construct] ?? 0) + 1;
          } else if (stack.length === 0 && !inUnencoded) {
            sourceStatementsRepresented[classOf(lang, child)]++;
          } else if (stack.length === 0 && inUnencoded) {
            inUnencodedFunctionBodies++;
          }
        }
        // A nested encoded function is a statement here, and was counted as one above; its BODY belongs to its own
        // executable, so this walk stops at it and the nested function is walked as a root of its own.
        if (ENCODED[lang].has(child.type)) { walkFunction(child.childForFieldName("body")!, [], false); continue; }
        if (opaque) { stack.push(child); walkFunction(child, stack, inUnencoded); stack.pop(); continue; }
        const entersUnencoded = child.type === "arrow_function" || child.type === "function_expression" || child.type === "generator_function";
        walkFunction(child, stack, inUnencoded || entersUnencoded);
      }
    };

    // Module level: statements outside any function are encoded by nobody, and are counted apart.
    const walkModule = (node: Node): void => {
      for (const child of children(node)) {
        if (ENCODED[lang].has(child.type)) { walkFunction(child.childForFieldName("body")!, [], false); continue; }
        if (BODY[lang].has(node.type)) outsideAnyFunction++;
        walkModule(child);
      }
    };
    walkModule(root);
  }

  return {
    files: files.length,
    sourceStatementsRepresented,
    hidden,
    byNearestContainer,
    byClassification,
    byConstruct: Object.fromEntries(Object.entries(byConstruct).sort((a, b) => b[1] - a[1])),
    outsideAnyFunction,
    inUnencodedFunctionBodies,
    limits: [
      "A hidden statement is counted once and attributed to its nearest opaque container. Depth says how many containers are above it; the same statement is never counted per ancestor.",
      "A statement inside a nested function is not hidden: the adapters encode nested functions as executables of their own. What the nested-def container conceals is the construction of the closure, not its body.",
      "This instrument does not claim a hidden statement belongs in the flattened statement count. That is a representation question and is not answered here.",
      "A TypeScript else branch written without braces is a statement outside a body node and is not counted; every such branch in these corpora is braced.",
      "Hidden statements are counted in SOURCE statements. The measure counts IR statements, and the two populations differ by construction: one source statement can become several IR statements. A hidden count is what is concealed, never a number to add to the measure's total.",
    ],
  };
}
