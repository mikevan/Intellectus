/**
 * The pytest half of `SyntaxPort.testStructures`.
 *
 * In DeepTest rather than in Witness, and not by preference. Witness has no
 * Python grammar and does not depend on `@projectrevivesolutions/complexity`,
 * which is where `tree-sitter-python.wasm` ships. Getting it there would mean
 * vendoring a second copy of a grammar or adding a dependency, and neither is
 * worth doing when DeepTest already loads it to produce Python structure and
 * complexity. So the language lives with the grammar, and
 * `DeepTest/src/agent/syntax.ts` composes this with Witness's TypeScript half
 * into one port.
 *
 * **The allowlist, as deliberate here as it is for JavaScript.**
 *
 * A case is an **undecorated** module-level `def test_*`, or such a method
 * inside a `Test`-prefixed class. A suite is a `Test`-prefixed class
 * containing only allowed structures. Everything else is `other`.
 *
 * **Any decorator makes it `other`**, and that is conservative on purpose.
 * `@pytest.fixture` turns a function into shared infrastructure rather than a
 * test, so it must not be addable; distinguishing it from a benign
 * `@pytest.mark.parametrize` means classifying decorator expressions, which
 * is more surface than 1.0.21 needs and more places to be subtly wrong.
 * `parametrize` is the obvious candidate to add later, and adding it later is
 * cheap. Accepting it now and finding out it let a fixture through would not
 * be.
 *
 * `setup_method`, `teardown_method` and module-level statements are `other`
 * by the same default-deny rule that governs the JavaScript side: they are
 * not test cases, so they may not be added.
 *
 * Deterministic, with the reason (rule 88). What counts as a test decides
 * what a model may add to the file holding its own work honest.
 */
import type { TestStructure } from '@projectrevivesolutions/witness';
import type { Parser, Node } from 'web-tree-sitter';

const TEST_FUNCTION = /^test_/;
const TEST_CLASS = /^Test/;

/** Whether this module can answer for that path at all. */
export function supportsPython(relativePath: string): boolean {
  return relativePath.split('\\').join('/').toLowerCase().endsWith('.py');
}

/**
 * The ordered structures of a Python test file, or undefined when it did not
 * parse cleanly.
 *
 * Undefined rather than an empty list: an empty list would say "this file
 * contains no tests", and comparing two empty lists would accept any change
 * at all.
 */
export function pythonTestStructures(parser: Parser, text: string): readonly TestStructure[] | undefined {
  const tree = parser.parse(text);
  if (tree === null || tree.rootNode === null || tree.rootNode.hasError) {
    return undefined;
  }
  return structuresIn(tree.rootNode, text);
}

function structuresIn(container: Node, text: string): TestStructure[] {
  const out: TestStructure[] = [];
  for (let i = 0; i < container.namedChildCount; i += 1) {
    const child = container.namedChild(i);
    if (child === null) {
      continue;
    }
    out.push(classify(child, text));
  }
  return out;
}

function classify(node: Node, text: string): TestStructure {
  const extent = text.slice(node.startIndex, node.endIndex);

  if (node.type === 'function_definition') {
    const name = node.childForFieldName('name');
    if (name !== null && TEST_FUNCTION.test(name.text)) {
      return { kind: 'test-case', identity: `def:${name.text}`, text: extent };
    }
    return { kind: 'other', identity: `other:${node.startIndex}:${extent}`, text: extent };
  }

  if (node.type === 'class_definition') {
    const name = node.childForFieldName('name');
    const body = node.childForFieldName('body');
    if (name !== null && body !== null && TEST_CLASS.test(name.text)) {
      return {
        kind: 'suite',
        identity: `class:${name.text}`,
        // Everything up to the start of the body: the `class` line and any
        // base classes, which is where a change to how the whole class
        // behaves would land.
        headerText: text.slice(node.startIndex, body.startIndex),
        children: structuresIn(body, text),
      };
    }
    return { kind: 'other', identity: `other:${node.startIndex}:${extent}`, text: extent };
  }

  // A decorated definition. Any decorator at all makes it `other`, per the
  // header: `@pytest.fixture` is shared infrastructure, and telling it apart
  // from a harmless mark means classifying decorator expressions.
  if (node.type === 'decorated_definition') {
    return { kind: 'other', identity: `other:${node.startIndex}:${extent}`, text: extent };
  }

  return { kind: 'other', identity: `other:${node.startIndex}:${extent}`, text: extent };
}
