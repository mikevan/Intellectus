import { parse, children } from "../adapters/treeSitter.js";
/** Node types the adapters turn into an opaque statement. A container is one of these that holds statements. */
const OPAQUE = {
    python: new Set(["for_statement", "while_statement", "match_statement", "try_statement", "with_statement",
        "class_definition", "function_definition", "import_statement", "import_from_statement", "global_statement",
        "nonlocal_statement", "decorated_definition", "pass_statement", "delete_statement", "assert_statement"]),
    typescript: new Set(["for_statement", "for_in_statement", "while_statement", "do_statement", "switch_statement",
        "try_statement", "labeled_statement", "empty_statement", "class_declaration", "function_declaration",
        "interface_declaration", "type_alias_declaration", "enum_declaration", "import_statement", "export_statement",
        "ambient_declaration"]),
};
/** Where a statement sits: the node types whose named children are statements. */
const BODY = {
    python: new Set(["block", "module"]),
    typescript: new Set(["statement_block", "program", "switch_case", "switch_default"]),
};
/** Functions the adapters encode as executables in their own right. Their statements are represented there. */
const ENCODED = {
    python: new Set(["function_definition"]),
    typescript: new Set(["function_declaration", "method_definition"]),
};
const NON_SEMANTIC = {
    python: new Set(["pass_statement", "comment"]),
    typescript: new Set(["empty_statement", "comment"]),
};
const METADATA = {
    python: new Set(["import_statement", "import_from_statement", "global_statement", "nonlocal_statement", "future_import_statement"]),
    typescript: new Set(["import_statement", "export_statement", "type_alias_declaration", "interface_declaration", "ambient_declaration", "declare_statement"]),
};
function classOf(lang, node) {
    if (NON_SEMANTIC[lang].has(node.type))
        return "NON_SEMANTIC";
    if (METADATA[lang].has(node.type))
        return "METADATA";
    if (node.type === "expression_statement") {
        const inner = children(node)[0];
        if (lang === "python") {
            if (inner && (inner.type === "string" || inner.type === "concatenated_string"))
                return "NON_SEMANTIC";
            if (inner && inner.type === "type")
                return "METADATA";
        }
        else if (inner && (inner.type === "string" || inner.type === "template_string"))
            return "NON_SEMANTIC";
    }
    return "SEMANTIC";
}
/** What the statement actually is: an expression statement is named by what it holds, so a `yield` reads as one. */
function constructOf(node) {
    if (node.type !== "expression_statement")
        return node.type;
    const inner = children(node)[0];
    if (!inner)
        return "empty";
    if (inner.type === "await_expression")
        return "await";
    return inner.type;
}
const emptyClasses = () => ({ SEMANTIC: 0, NON_SEMANTIC: 0, METADATA: 0 });
export async function measureContainers(files) {
    const hidden = [];
    const sourceStatementsRepresented = emptyClasses();
    const byNearestContainer = {};
    const byClassification = emptyClasses();
    const byConstruct = {};
    let outsideAnyFunction = 0;
    let inUnencodedFunctionBodies = 0;
    const seen = new Set(); // file:line:column, so a statement under three containers is still one statement
    for (const { path: file, source, language: lang } of files) {
        const root = await parse(lang, source);
        /** Walk one function body. `stack` holds the opaque containers above, within this function only. */
        const walkFunction = (node, stack, inUnencoded) => {
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
                        const nearest = stack[stack.length - 1];
                        const classification = classOf(lang, child);
                        const construct = constructOf(child);
                        hidden.push({ file, line: child.startPosition.row + 1, column: child.startPosition.column, nodeType: child.type, construct, classification, nearestContainer: nearest.type, nearestContainerLine: nearest.startPosition.row + 1, depth: stack.length });
                        const bucket = byNearestContainer[nearest.type] ?? (byNearestContainer[nearest.type] = { total: 0, ...emptyClasses() });
                        bucket.total++;
                        bucket[classification]++;
                        byClassification[classification]++;
                        byConstruct[construct] = (byConstruct[construct] ?? 0) + 1;
                    }
                    else if (stack.length === 0 && !inUnencoded) {
                        sourceStatementsRepresented[classOf(lang, child)]++;
                    }
                    else if (stack.length === 0 && inUnencoded) {
                        inUnencodedFunctionBodies++;
                    }
                }
                // A nested encoded function is a statement here, and was counted as one above; its BODY belongs to its own
                // executable, so this walk stops at it and the nested function is walked as a root of its own.
                if (ENCODED[lang].has(child.type)) {
                    walkFunction(child.childForFieldName("body"), [], false);
                    continue;
                }
                if (opaque) {
                    stack.push(child);
                    walkFunction(child, stack, inUnencoded);
                    stack.pop();
                    continue;
                }
                const entersUnencoded = child.type === "arrow_function" || child.type === "function_expression" || child.type === "generator_function";
                walkFunction(child, stack, inUnencoded || entersUnencoded);
            }
        };
        // Module level: statements outside any function are encoded by nobody, and are counted apart.
        const walkModule = (node) => {
            for (const child of children(node)) {
                if (ENCODED[lang].has(child.type)) {
                    walkFunction(child.childForFieldName("body"), [], false);
                    continue;
                }
                if (BODY[lang].has(node.type))
                    outsideAnyFunction++;
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
