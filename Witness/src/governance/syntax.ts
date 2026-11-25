/**
 * Parsing a file, synchronously, for the validators that need structure.
 *
 * **Why a port.** Loading a tree-sitter grammar is asynchronous, and a
 * validator is synchronous. Making the whole validation chain asynchronous
 * to accommodate one validator would change the shape of the governed
 * sequence, and the sequence is the thing rule 23 is about. So the async
 * work happens once, before the interaction runs, and what reaches a
 * validator is a thing that parses now.
 *
 * That is not a new idea here. `createInstrumenter(wasmDir)` is the same
 * shape: build it once with the grammars, then use it synchronously. This
 * port mirrors it.
 *
 * **It has a prerequisite, and that is the point.** An interaction that will
 * produce a change set needs one of these, and rule 94's gate refuses before
 * the model when it is missing, rather than asking a model for a proposal
 * nobody could have checked.
 *
 * `vscode`-free (rule 45) and peer-free (rule 2).
 */

/** One declaration a change could alter, as text a program can compare. */
export interface Declaration {
  /** The declared name, when there is one. */
  readonly name: string;
  /**
   * The declaration's header, normalised: everything that states the
   * contract, without the body that implements it.
   *
   * Compared as text rather than understood. See `publicContract.ts` for why
   * that is the conservative choice and what it costs.
   */
  readonly header: string;
}

/**
 * One structure in a test file, as the language's adapter classifies it.
 *
 * Witness reads only `kind`, `identity`, `text`, and `children`. Whether
 * `test.describe` is a suite and whether `def test_x` is a case are the
 * adapter's answers, because Witness may not contain Jest or pytest
 * semantics (rules 2 and 4) and the products already hold the grammars.
 *
 * **`other` is the default, and it is a positive allowlist that produces the
 * other two.** A root identifier match is not enough: `test.only(...)` and
 * `describe.only(...)` are calls whose roots are `test` and `describe`, and
 * both are catastrophic as additions, because `.only` makes every other test
 * in the run not run. A proposal adding one would produce a green suite in
 * which the pre-existing tests were never executed, which is the purest form
 * of a manufactured pass and survives byte-prefix preservation, survives
 * "existing nodes unchanged", and survives any rule that classifies by root
 * identifier. So an adapter recognises exact invocation forms and calls
 * everything else `other`.
 */
export type TestStructure =
  | { readonly kind: 'test-case'; readonly identity: string; readonly text: string }
  | { readonly kind: 'suite'; readonly identity: string; readonly headerText: string; readonly children: readonly TestStructure[] }
  /** Anything else at any scope: imports, hooks, module statements, configuration. */
  | { readonly kind: 'other'; readonly identity: string; readonly text: string };

export interface SyntaxPort {
  /**
   * The exported declarations in this text, or undefined when this port has
   * no parser for that path's language.
   *
   * Undefined is not an empty list. A file we cannot parse is a file we know
   * nothing about, and a validator that treated the two the same would
   * report a pass for every language it did not support.
   */
  exportedDeclarations(relativePath: string, text: string): readonly Declaration[] | undefined;
  /** Whether this port can parse that path's language at all. */
  supports(relativePath: string): boolean;
  /**
   * The ordered structures of a test file, or undefined when it cannot be
   * parsed.
   *
   * Undefined is not an empty list, for the same reason as above and with
   * sharper consequences: an empty list would say "this file contains no
   * tests", and comparing two empty lists would accept any change at all.
   */
  testStructures(relativePath: string, text: string): readonly TestStructure[] | undefined;
}
