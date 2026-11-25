/**
 * Is this proposal a provably additive change to a test file?
 *
 * The invariant, stated once:
 *
 * > The model may add a new test to an existing test file. It may not alter
 * > the meaning of any pre-existing test, and it may not use a change to
 * > shared test infrastructure to manufacture a pass.
 *
 * **Why byte-prefix preservation is not enough**, which is the whole reason
 * this file exists. `after.startsWith(before)` proves that existing bytes
 * were not edited. It does not prove their behaviour was preserved. Appended
 * code can register a `beforeEach`, mutate a global, reconfigure a shared
 * mock, monkey-patch a dependency, or set a timeout, and every one of those
 * changes what the tests above it do while leaving their bytes untouched.
 *
 * **And it is not a denylist either.** The list of dangerous constructs is
 * long, and it is the wrong shape: hooks, mock configuration, imports,
 * module-scope statements of any kind, globals, runner configuration,
 * modifiers on an existing suite. A denylist protects against what somebody
 * thought of, and the thing that gets through is by definition the thing
 * nobody listed. So the rule is default-deny:
 *
 * > **An addition is allowed only if it is a test case, or a suite containing
 * > nothing but allowed additions. Everything else is refused, at every
 * > scope.**
 *
 * That list of dangerous constructs stops being the rule and becomes the
 * explanation of why the rule is shaped this way.
 *
 * **Recursive, not top-level**, because the ordinary addition is a new `it`
 * inside an existing `describe`, which changes that `describe` node's text. A
 * top-level comparison would refuse the one action the refinement exists to
 * permit.
 *
 * **What this proves, exactly.** That no pre-existing test or shared-scope
 * structure was altered, deleted, reordered, or supplemented, and that every
 * new structure is an allowed test case or a suite containing only allowed
 * test cases.
 *
 * **What it does not prove.** That a new test cannot affect a pre-existing
 * test when the tests actually run. Nothing added is in the file's shared
 * scope, so the ordinary routes are closed, but a new test can still mutate
 * an object an earlier test depends on, exhaust a shared resource, or leave
 * state behind. Structural validation does not decide runtime interaction
 * between tests, and C1 does not claim it does. That residue belongs to field
 * 10, where `existing-tests-still-ran` addresses it with evidence the
 * ordinary run already collects.
 *
 * Deterministic, and the reason rather than the habit (rule 88). This decides
 * whether a model was allowed to touch the tests that hold its own work
 * honest. Rule 26 inverted is a model grading that.
 */
import type { TestStructure } from './syntax';

export type AdditiveVerdict =
  /** Provably additive. */
  | { readonly kind: 'additive' }
  /** Provably not additive, with what changed, in words a person can act on. */
  | { readonly kind: 'not-additive'; readonly because: string }
  /**
   * The question could not be answered: a parse failed, or the matching was
   * ambiguous. **Never a pass.** Rule 94: a result Polyglot could not
   * validate is not a validated result, and this is not a violation either,
   * so it must not be reported as one.
   */
  | { readonly kind: 'undecidable'; readonly because: string };

/**
 * Compares the structures of a test file before and after a proposal.
 *
 * `undefined` on either side means the file could not be parsed, which is
 * `undecidable` and not a pass. An empty list is a different thing from
 * `undefined` and is compared normally.
 */
export function isProvablyAdditive(before: readonly TestStructure[] | undefined, after: readonly TestStructure[] | undefined): AdditiveVerdict {
  if (before === undefined || after === undefined) {
    return {
      kind: 'undecidable',
      because: 'Polyglot could not parse this test file, so it cannot show that the tests already in it are untouched. Nothing is being alleged about the proposal; it simply cannot be checked.',
    };
  }
  return compare(before, after, []);
}

/**
 * One sibling sequence, at one depth.
 *
 * Pre-existing structures are matched to proposed ones **by identity, in
 * order**. Order-preserving matching is what refuses a reordering of existing
 * tests: the bytes are all still there and the meaning of the file is not,
 * and a set comparison would call that additive.
 */
function compare(before: readonly TestStructure[], after: readonly TestStructure[], path: readonly string[]): AdditiveVerdict {
  const ambiguous = firstDuplicateIdentity(before) ?? firstDuplicateIdentity(after);
  if (ambiguous !== undefined) {
    // A rule that guessed here would be guessing about the very thing it
    // exists to prove.
    return {
      kind: 'undecidable',
      because: `${where(path)} contains more than one structure called ${JSON.stringify(ambiguous)}, so Polyglot cannot tell which one a change refers to. It will not guess about which test was altered.`,
    };
  }

  let cursor = 0;
  for (const original of before) {
    // Find this pre-existing structure in the proposal, at or after the
    // cursor. Anything skipped over is an addition and is checked below.
    let found = -1;
    for (let i = cursor; i < after.length; i += 1) {
      if (after[i].identity === original.identity && after[i].kind === original.kind) {
        found = i;
        break;
      }
    }
    if (found === -1) {
      const earlier = after.findIndex((s) => s.identity === original.identity && s.kind === original.kind);
      if (earlier !== -1) {
        return {
          kind: 'not-additive',
          because: `${describe(original)} has moved. ${where(path)} runs its tests in the order they are written, so reordering them is a change to what already exists, not an addition to it.`,
        };
      }
      // A structure that is gone may have been deleted, or it may still be
      // there wearing a modifier: `describe.only(...)` is classified `other`
      // by the adapter, so it stops being the suite it was. Both are
      // refusals and they are different things to be told, and "you removed
      // the group" is the wrong thing to tell somebody who added `.only` to
      // it.
      const wearingSomething = after.find((s) => s.kind === 'other' && s.text.includes(nameOf(original)));
      if (wearingSomething !== undefined) {
        return {
          kind: 'not-additive',
          because: `${describe(original)} is no longer an ordinary ${original.kind === 'suite' ? 'group' : 'test'}: the proposal changed the line that opens it, and that line decides whether and how it runs. A modifier such as .only there stops every other test in the file from running at all.`,
        };
      }
      return {
        kind: 'not-additive',
        because: `${describe(original)} is not in the proposal. Removing something that is already there is not an addition.`,
      };
    }

    // Everything the proposal inserted before this match.
    for (let i = cursor; i < found; i += 1) {
      const verdict = allowedAddition(after[i], path);
      if (verdict.kind !== 'additive') {
        return verdict;
      }
    }

    const verdict = identical(original, after[found], path);
    if (verdict.kind !== 'additive') {
      return verdict;
    }
    cursor = found + 1;
  }

  // Everything after the last match is an addition too.
  for (let i = cursor; i < after.length; i += 1) {
    const verdict = allowedAddition(after[i], path);
    if (verdict.kind !== 'additive') {
      return verdict;
    }
  }
  return { kind: 'additive' };
}

/**
 * A matched pre-existing structure has to be the same structure.
 *
 * A leaf is compared byte for byte in its own extent. A suite is compared by
 * its **header** and then recursively over its children, because its full
 * text necessarily changes when a test is added inside it, and that addition
 * is the thing being permitted.
 *
 * Comparing the header is what refuses `.only` added to an existing
 * `describe`: the header is where the modifier lands.
 */
function identical(original: TestStructure, proposed: TestStructure, path: readonly string[]): AdditiveVerdict {
  if (original.kind === 'suite' && proposed.kind === 'suite') {
    if (original.headerText !== proposed.headerText) {
      return {
        kind: 'not-additive',
        because: `The line that opens ${describe(original)} has changed. That line decides how every test inside it runs, so a change to it is a change to tests that are already there.`,
      };
    }
    return compare(original.children, proposed.children, [...path, original.identity]);
  }
  if (original.kind === 'suite' || proposed.kind === 'suite') {
    return { kind: 'not-additive', because: `${describe(original)} is not the same kind of thing in the proposal.` };
  }
  if (original.text !== proposed.text) {
    return {
      kind: 'not-additive',
      because: `${describe(original)} has been changed. Tests are the record of what the code is supposed to do, so a proposal may add to them and may not rewrite them.`,
    };
  }
  return { kind: 'additive' };
}

/**
 * Default-deny, at every scope.
 *
 * A test case is allowed. A suite is allowed when everything it contains is
 * allowed. Anything else is refused, whatever it is, including things nobody
 * has thought of.
 */
function allowedAddition(structure: TestStructure, path: readonly string[]): AdditiveVerdict {
  if (structure.kind === 'test-case') {
    return { kind: 'additive' };
  }
  if (structure.kind === 'suite') {
    for (const child of structure.children) {
      const verdict = allowedAddition(child, [...path, structure.identity]);
      if (verdict.kind !== 'additive') {
        return verdict;
      }
    }
    return { kind: 'additive' };
  }
  return {
    kind: 'not-additive',
    because: `The proposal adds something to ${where(path)} that is not a test: ${firstLine(structure.text)}. Anything outside a test runs before the tests that are already in this file, so it can change what they do. Add the test on its own, or add what it needs yourself first and ask again.`,
  };
}

// ---------------------------------------------------------------------------

function firstDuplicateIdentity(structures: readonly TestStructure[]): string | undefined {
  const seen = new Set<string>();
  for (const s of structures) {
    if (seen.has(s.identity)) {
      return s.identity;
    }
    seen.add(s.identity);
  }
  return undefined;
}

/** The name literal inside a structure's identity, for a readable message. */
function nameOf(structure: TestStructure): string {
  const cut = structure.identity.indexOf(':');
  return cut === -1 ? structure.identity : structure.identity.slice(cut + 1);
}

function describe(structure: TestStructure): string {
  return structure.kind === 'suite' ? `the group ${JSON.stringify(structure.identity)}` : `the test ${JSON.stringify(structure.identity)}`;
}

function where(path: readonly string[]): string {
  return path.length === 0 ? 'this file' : `the group ${JSON.stringify(path[path.length - 1])}`;
}

function firstLine(text: string): string {
  const line = text.split('\n')[0].trim();
  return line.length > 80 ? `${line.slice(0, 77)}...` : line;
}
