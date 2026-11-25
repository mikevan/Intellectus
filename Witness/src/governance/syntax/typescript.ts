/**
 * The JavaScript, TypeScript and TSX answers a validator needs about a file.
 *
 * In Witness because Witness already ships `tree-sitter-typescript`,
 * `tree-sitter-tsx` and `tree-sitter-javascript` in `vendor/` and already
 * parses with them through `src/treeSitter.ts`, and because both products
 * need the same answers for `V-public-contract`. Python's grammar is not
 * here and cannot be: it ships in `complexity`, which Witness does not depend
 * on, so `DeepTest/src/languages/python/testStructure.ts` supplies that half
 * and DeepTest composes the two into one port.
 *
 * Built once, asynchronously, and used synchronously, the same shape as
 * `createInstrumenter`. A validator is synchronous, and making the whole
 * governed sequence asynchronous to accommodate one of them would change the
 * shape of the sequence rule 23 is about.
 *
 * **The test classification is a positive allowlist of exact invocation
 * forms, per framework, and everything else is `other`.**
 *
 * A root identifier match is not enough, and this is the reason this file is
 * shaped the way it is rather than as a few identifier comparisons.
 * `test.only(...)` and `describe.only(...)` are calls whose roots are `test`
 * and `describe`, and both are catastrophic as additions: `.only` makes every
 * other test in the run **not run**, so a proposal adding one produces a
 * green suite in which the pre-existing tests were never executed. That is
 * the purest form of a manufactured pass, and it survives byte-prefix
 * preservation, survives "existing nodes unchanged", and survives any rule
 * that classifies by root identifier.
 *
 * The exclusions are deliberate and their reasons are not uniform, which is
 * why each is classified rather than pattern-matched:
 *
 * - **`.only`, `fit`, `fdescribe` change which pre-existing tests run.** They
 *   are the case this allowlist exists for.
 * - **`.skip`, `.todo`, `xit`, `xdescribe` add nothing.** A skipped test
 *   closes no gap, so accepting one would let a proposal satisfy C1 while
 *   satisfying nothing else.
 * - **`.each` is a different invocation shape**, `it.each(table)(name, fn)`:
 *   a call whose callee is a call, with a data table whose contents are
 *   arbitrary. Very likely additive, **not affirmatively provable with the
 *   same comparison**, so `other` for 1.0.21 and the obvious first candidate
 *   if real use asks for it.
 * - **`.concurrent`, `.sequential`, `.shuffle`, `.serial`, `.parallel`,
 *   `.configure` change how the file's tests are scheduled**, which changes
 *   pre-existing tests.
 * - **`.failing`, `.fail`, `.fixme`, `.slow`, `.skipIf`, `.runIf`, `.extend`
 *   change how a result is interpreted** or add conditional machinery.
 * - **`test.use` and `test.beforeEach` are fixtures and hooks** and were
 *   never case forms.
 *
 * **Playwright is the reason the rule cannot be "reject member access".**
 * `test.describe` is a member expression and it is the suite form there. So
 * what follows is a set of exact callee paths, not a rule about shape.
 *
 * Deterministic, with the reason (rule 88). What counts as a test decides
 * what a model is allowed to add to the file that holds its work honest.
 */
import * as path from 'node:path';
import { createParser, initTreeSitter } from '../../treeSitter';
import type { Declaration, SyntaxPort, TestStructure } from '../syntax';
import type { Parser, Node } from 'web-tree-sitter';

/** Bare callee names that are a test case. */
const CASE_CALLEES: ReadonlySet<string> = new Set(['it', 'test', 'specify']);

/** Callee paths that are a suite. `test.describe` is Playwright's. */
const SUITE_CALLEES: ReadonlySet<string> = new Set(['describe', 'context', 'test.describe']);

const EXTENSIONS: ReadonlyMap<string, 'typescript' | 'tsx' | 'javascript'> = new Map([
  ['.ts', 'typescript'],
  ['.mts', 'typescript'],
  ['.cts', 'typescript'],
  ['.tsx', 'tsx'],
  ['.js', 'javascript'],
  ['.mjs', 'javascript'],
  ['.cjs', 'javascript'],
  ['.jsx', 'tsx'],
]);

/**
 * A port for the three grammars Witness vendors.
 *
 * `wasmDir` holds `web-tree-sitter.wasm` and the grammars, the same folder
 * `createInstrumenter` takes.
 */
export async function createTypeScriptSyntax(wasmDir: string): Promise<SyntaxPort> {
  await initTreeSitter(path.join(wasmDir, 'web-tree-sitter.wasm'));
  const parsers: Record<'typescript' | 'tsx' | 'javascript', Parser> = {
    typescript: await createParser(path.join(wasmDir, 'tree-sitter-typescript.wasm')),
    tsx: await createParser(path.join(wasmDir, 'tree-sitter-tsx.wasm')),
    javascript: await createParser(path.join(wasmDir, 'tree-sitter-javascript.wasm')),
  };

  function parserFor(relativePath: string): Parser | undefined {
    const grammar = EXTENSIONS.get(path.posix.extname(relativePath.split('\\').join('/')));
    return grammar === undefined ? undefined : parsers[grammar];
  }

  return Object.freeze({
    supports(relativePath: string): boolean {
      return parserFor(relativePath) !== undefined;
    },
    exportedDeclarations(relativePath: string, text: string): readonly Declaration[] | undefined {
      const parser = parserFor(relativePath);
      if (parser === undefined) {
        return undefined;
      }
      const tree = parser.parse(text);
      if (tree === null || tree.rootNode === null) {
        return undefined;
      }
      return exportedDeclarationsOf(tree.rootNode, text);
    },
    testStructures(relativePath: string, text: string): readonly TestStructure[] | undefined {
      const parser = parserFor(relativePath);
      if (parser === undefined) {
        return undefined;
      }
      const tree = parser.parse(text);
      if (tree === null || tree.rootNode === null || tree.rootNode.hasError) {
        // A file that did not parse cleanly is a file nothing is known
        // about. Undefined rather than an empty list, because an empty list
        // would say "this file contains no tests" and would accept any
        // change at all.
        return undefined;
      }
      return structuresIn(tree.rootNode, text);
    },
  });
}

// ---------------------------------------------------------------------------
// Test structures
// ---------------------------------------------------------------------------

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
  const call = callExpressionIn(node);
  if (call !== undefined) {
    const callee = calleePath(call);
    if (callee !== undefined) {
      const name = stringArgument(call);
      if (SUITE_CALLEES.has(callee) && name !== undefined) {
        const body = callbackBody(call);
        if (body !== undefined) {
          return {
            kind: 'suite',
            identity: `${callee}:${name}`,
            // Everything from the start of the statement to the opening brace
            // of the callback. This is where a modifier would land, so
            // comparing it is what refuses `.only` added to an existing
            // group, while the children below are free to grow.
            headerText: text.slice(node.startIndex, body.startIndex + 1),
            children: structuresIn(body, text),
          };
        }
      }
      if (CASE_CALLEES.has(callee) && name !== undefined) {
        return { kind: 'test-case', identity: `${callee}:${name}`, text: text.slice(node.startIndex, node.endIndex) };
      }
    }
  }
  const extent = text.slice(node.startIndex, node.endIndex);
  return { kind: 'other', identity: `other:${node.startIndex}:${extent}`, text: extent };
}

/** The call inside an expression statement, or the node itself when it is one. */
function callExpressionIn(node: Node): Node | undefined {
  if (node.type === 'call_expression') {
    return node;
  }
  if (node.type === 'expression_statement') {
    const inner = node.namedChild(0);
    if (inner !== null && inner.type === 'call_expression') {
      return inner;
    }
  }
  return undefined;
}

/**
 * The callee as a dotted path, when it is one plain identifier or a chain of
 * them. Anything else, including a call as the callee (`it.each(t)(...)`),
 * returns undefined and so classifies as `other`.
 */
function calleePath(call: Node): string | undefined {
  const callee = call.childForFieldName('function');
  if (callee === null) {
    return undefined;
  }
  if (callee.type === 'identifier') {
    return callee.text;
  }
  if (callee.type === 'member_expression') {
    const object = callee.childForFieldName('object');
    const property = callee.childForFieldName('property');
    if (object === null || property === null || object.type !== 'identifier' || property.type !== 'property_identifier') {
      return undefined;
    }
    return `${object.text}.${property.text}`;
  }
  return undefined;
}

/** The first argument when it is a plain string literal, unquoted. */
function stringArgument(call: Node): string | undefined {
  const args = call.childForFieldName('arguments');
  const first = args === null ? null : args.namedChild(0);
  if (first === null || (first.type !== 'string' && first.type !== 'template_string')) {
    return undefined;
  }
  // A template string with a substitution is not a stable identity, so it is
  // left unnamed and the call classifies as `other`.
  if (first.type === 'template_string' && first.namedChildCount > 0) {
    return undefined;
  }
  return first.text.slice(1, -1);
}

/** The body of the last argument, when that argument is a function. */
function callbackBody(call: Node): Node | undefined {
  const args = call.childForFieldName('arguments');
  if (args === null || args.namedChildCount === 0) {
    return undefined;
  }
  const last = args.namedChild(args.namedChildCount - 1);
  if (last === null || (last.type !== 'arrow_function' && last.type !== 'function_expression' && last.type !== 'function')) {
    return undefined;
  }
  const body = last.childForFieldName('body');
  return body !== null && body.type === 'statement_block' ? body : undefined;
}

// ---------------------------------------------------------------------------
// Exported declarations, for V-public-contract
// ---------------------------------------------------------------------------

/**
 * Every exported declaration's name and header.
 *
 * The header is the declaration's text up to its body, normalised for
 * whitespace: everything that states the contract, without the code that
 * implements it. Compared as text rather than understood, which is the
 * conservative choice and costs a false failure on a reformatted signature
 * rather than a false pass on a changed one.
 */
function exportedDeclarationsOf(root: Node, text: string): Declaration[] {
  const out: Declaration[] = [];
  for (let i = 0; i < root.namedChildCount; i += 1) {
    const child = root.namedChild(i);
    if (child === null || child.type !== 'export_statement') {
      continue;
    }
    const declaration = child.childForFieldName('declaration');
    if (declaration === null) {
      continue;
    }
    for (const named of namesOf(declaration)) {
      out.push({ name: named.name, header: normalise(text.slice(child.startIndex, named.headerEnd)) });
    }
  }
  return out;
}

function namesOf(declaration: Node): Array<{ name: string; headerEnd: number }> {
  if (declaration.type === 'function_declaration' || declaration.type === 'class_declaration') {
    const name = declaration.childForFieldName('name');
    const body = declaration.childForFieldName('body');
    if (name === null) {
      return [];
    }
    return [{ name: name.text, headerEnd: body === null ? declaration.endIndex : body.startIndex }];
  }
  if (declaration.type === 'lexical_declaration' || declaration.type === 'variable_declaration') {
    const out: Array<{ name: string; headerEnd: number }> = [];
    for (let i = 0; i < declaration.namedChildCount; i += 1) {
      const declarator = declaration.namedChild(i);
      if (declarator === null || declarator.type !== 'variable_declarator') {
        continue;
      }
      const name = declarator.childForFieldName('name');
      const value = declarator.childForFieldName('value');
      if (name === null) {
        continue;
      }
      // For a function-valued binding the header stops at the body, the same
      // as a function declaration. For anything else the whole declarator is
      // the contract.
      const body = value === null ? null : value.childForFieldName('body');
      out.push({ name: name.text, headerEnd: body === null ? declarator.endIndex : body.startIndex });
    }
    return out;
  }
  const name = declaration.childForFieldName('name');
  return name === null ? [] : [{ name: name.text, headerEnd: declaration.endIndex }];
}

function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
