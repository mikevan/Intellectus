/**
 * DeepTest's `SyntaxPort`: Witness's TypeScript answers plus DeepTest's
 * Python ones, behind one interface.
 *
 * The split is not a design preference. Witness ships
 * `tree-sitter-typescript`, `tree-sitter-tsx` and `tree-sitter-javascript`
 * and parses with them already, and both products need the same answers about
 * a TypeScript file for `V-public-contract`, so that half belongs there.
 * Witness has no Python grammar and does not depend on `complexity`, which is
 * where `tree-sitter-python.wasm` ships, so that half belongs here. This
 * module is the seam, and it is the only place that knows there is one.
 *
 * Built once, asynchronously, used synchronously, the same shape as
 * `createInstrumenter` and `createTypeScriptSyntax`. A validator is
 * synchronous, and making the governed sequence asynchronous to accommodate
 * one would change the shape of the sequence rule 23 is about.
 *
 * **UntangleIt needs none of this.** It proposes source changes and never
 * test changes, so a proposal of its that touched a test file fails C1 on the
 * path alone, with no parsing. `testStructures` is a DeepTest prerequisite,
 * not a toolkit-wide one.
 */
import * as path from 'node:path';
import { createTypeScriptSyntax } from '@projectrevivesolutions/witness';
import type { Declaration, SyntaxPort, TestStructure } from '@projectrevivesolutions/witness';
import { createParser, initTreeSitter } from '../languages/shared/treeSitter';
import { pythonTestStructures, supportsPython } from '../languages/python/testStructure';

/**
 * @param wasmDir holds `web-tree-sitter.wasm`, the three JavaScript-family
 * grammars, and `tree-sitter-python.wasm`.
 */
export async function createDeepTestSyntax(wasmDir: string): Promise<SyntaxPort> {
  const typescript = await createTypeScriptSyntax(wasmDir);
  await initTreeSitter(path.join(wasmDir, 'web-tree-sitter.wasm'));
  const python = await createParser(path.join(wasmDir, 'tree-sitter-python.wasm'));

  return Object.freeze({
    supports(relativePath: string): boolean {
      return typescript.supports(relativePath) || supportsPython(relativePath);
    },
    exportedDeclarations(relativePath: string, text: string): readonly Declaration[] | undefined {
      // Python is not answered here. `V-public-contract` compares exported
      // declarations, and DeepTest has no Python implementation of that
      // question; returning an empty list would report "this file exports
      // nothing" and pass every Python source change, which is the
      // permissive failure the port's `undefined` exists to prevent.
      return typescript.exportedDeclarations(relativePath, text);
    },
    testStructures(relativePath: string, text: string): readonly TestStructure[] | undefined {
      if (supportsPython(relativePath)) {
        return pythonTestStructures(python, text);
      }
      return typescript.testStructures(relativePath, text);
    },
  });
}
