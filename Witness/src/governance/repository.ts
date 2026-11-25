/**
 * Reading the repository, so a proposal can be checked against what is
 * actually there rather than against a description of it.
 *
 * **Read-only, and it stays read-only.** There is no write operation and
 * there will not be one in 1.0.21. Its purpose is validating a proposal, not
 * applying one. M10 resolved to diff-only on the evidence in Part XIII of
 * the constitution: a validated proposal is rendered, its files are named,
 * its content is shown through a read-only diff, and the person makes the
 * change. A write method here would be the first step in quietly undoing
 * that, and it would be added by somebody reasonable, with a good story.
 *
 * **It fails closed on its own operations.** `read` refuses a path that does
 * not resolve inside the root rather than reading it and trusting that a
 * validator checked first. That ordering is exactly the kind of thing that
 * holds until somebody adds a second caller, and by then the mistake reads
 * as a feature. `resolveInside` exists so a validator can report the bad
 * path with a sentence a person can follow, not so containment depends on
 * being asked.
 *
 * **Synchronous**, because a validator is synchronous. Making the whole
 * validation chain asynchronous to read a handful of small files would be a
 * large change to the governed sequence for no gain, and the sequence is the
 * thing rule 23 is about.
 *
 * `node:fs` only. No `vscode` (rule 45), no peer product (rule 2), and
 * `test/boundaries.test.ts` proves both.
 *
 * Deterministic, with the reason rather than the habit (rule 88). This is
 * the boundary between what a model said and what is true. An agent deciding
 * whether a file matched would be deciding whether its own answer was
 * checkable.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export type ReadResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reason: 'outside-root' | 'not-found' | 'unreadable'; readonly why: string };

export type ResolveResult = { readonly ok: true; readonly absolute: string } | { readonly ok: false; readonly why: string };

export interface RepositoryPort {
  /** The canonical workspace root. Absolute, with symlinks already resolved. */
  readonly root: string;
  /**
   * The file's exact current text.
   *
   * Refuses rather than reads when the path does not resolve inside the
   * root. A caller cannot reach outside by mistake.
   */
  read(relative: string): ReadResult;
  /**
   * Whether the path lands inside the root, and where.
   *
   * For a path naming a file that does not exist yet, containment is
   * established from the canonical nearest existing parent, because a
   * missing file has nothing to resolve. A `create` is a legitimate
   * proposal and must not be refused for naming a file that is not there.
   */
  resolveInside(relative: string): ResolveResult;
}

/** The reason an absolute path in a workspace-relative field is refused. */
const ABSOLUTE = 'A change set holds workspace-relative paths. This one is absolute, so it names a place on somebody\'s machine rather than a place in the project.';

/**
 * Containment, decided lexically first and then against the filesystem.
 *
 * The lexical pass catches an absolute path and a `..` that escapes, and it
 * works with no filesystem at all. The filesystem pass catches the case
 * lexical work cannot: a path made entirely of ordinary segments where one
 * of them is a symlink pointing somewhere else. Both are needed, and the
 * order matters only in that the cheap one rules out the obvious.
 */
function containedIn(root: string, relative: string): ResolveResult {
  if (relative.trim() === '') {
    return { ok: false, why: 'The path is empty.' };
  }
  if (path.isAbsolute(relative) || /^[a-zA-Z]:[\\/]/.test(relative)) {
    return { ok: false, why: ABSOLUTE };
  }
  const joined = path.resolve(root, relative);
  if (!isUnder(root, joined)) {
    return { ok: false, why: `${relative} leads outside the project folder. A change set may only name paths inside it.` };
  }

  // Now the part lexical work cannot do. Resolve the deepest ancestor that
  // exists, which for an existing file is the file itself and for a `create`
  // is whichever directory above it is already there.
  let probe = joined;
  const climbed: string[] = [];
  for (;;) {
    if (fs.existsSync(probe)) {
      break;
    }
    const parent = path.dirname(probe);
    if (parent === probe) {
      return { ok: false, why: `Nothing above ${relative} exists inside the project folder, so there is no place for it.` };
    }
    climbed.push(path.basename(probe));
    probe = parent;
  }

  let real: string;
  try {
    real = fs.realpathSync(probe);
  } catch (err) {
    return { ok: false, why: `Polyglot could not follow ${relative} to a real place on disk: ${err instanceof Error ? err.message : String(err)}` };
  }
  // Put the segments we climbed over back on, so a create is judged where it
  // would actually land rather than at its parent.
  const target = climbed.length > 0 ? path.join(real, ...climbed.reverse()) : real;
  if (!isUnder(canonicalRoot(root), target)) {
    return { ok: false, why: `${relative} resolves to somewhere outside the project folder. A link along the way points out of it.` };
  }
  return { ok: true, absolute: target };
}

function canonicalRoot(root: string): string {
  try {
    return fs.realpathSync(root);
  } catch {
    return root;
  }
}

function isUnder(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** The repository as it is on disk. */
export function nodeRepository(root: string): RepositoryPort {
  const canonical = canonicalRoot(path.resolve(root));
  return Object.freeze({
    root: canonical,
    resolveInside(relative: string): ResolveResult {
      return containedIn(canonical, relative);
    },
    read(relative: string): ReadResult {
      const where = containedIn(canonical, relative);
      if (!where.ok) {
        return { ok: false, reason: 'outside-root', why: where.why };
      }
      let text: string;
      try {
        text = fs.readFileSync(where.absolute, 'utf8');
      } catch (err) {
        const code = (err as { code?: string }).code;
        if (code === 'ENOENT') {
          return { ok: false, reason: 'not-found', why: `${relative} is not in the project.` };
        }
        return { ok: false, reason: 'unreadable', why: `Polyglot could not read ${relative}: ${err instanceof Error ? err.message : String(err)}` };
      }
      return { ok: true, text };
    },
  });
}

/**
 * A repository held in memory, for tests.
 *
 * It exists so that no test needs a real disk, and it implements the same
 * containment refusals rather than a relaxed version of them. A test double
 * that is more permissive than the real thing is a test that passes for the
 * wrong reason, so a test asserts the two agree on every escaping case.
 *
 * `links` maps a path segment prefix to where it really points, which is how
 * a symlink is expressed without creating one.
 */
export function memoryRepository(root: string, files: Readonly<Record<string, string>>, links: Readonly<Record<string, string>> = {}): RepositoryPort {
  const canonical = path.resolve(root);
  const resolve = (relative: string): ResolveResult => {
    if (relative.trim() === '') {
      return { ok: false, why: 'The path is empty.' };
    }
    if (path.isAbsolute(relative) || /^[a-zA-Z]:[\\/]/.test(relative)) {
      return { ok: false, why: ABSOLUTE };
    }
    const joined = path.resolve(canonical, relative);
    if (!isUnder(canonical, joined)) {
      return { ok: false, why: `${relative} leads outside the project folder. A change set may only name paths inside it.` };
    }
    const normalized = path.relative(canonical, joined).split(path.sep).join('/');
    for (const [from, to] of Object.entries(links)) {
      if (normalized === from || normalized.startsWith(`${from}/`)) {
        const followed = path.resolve(canonical, to, normalized.slice(from.length).replace(/^\//, ''));
        if (!isUnder(canonical, followed)) {
          return { ok: false, why: `${relative} resolves to somewhere outside the project folder. A link along the way points out of it.` };
        }
        return { ok: true, absolute: followed };
      }
    }
    return { ok: true, absolute: joined };
  };
  return Object.freeze({
    root: canonical,
    resolveInside: resolve,
    read(relative: string): ReadResult {
      const where = resolve(relative);
      if (!where.ok) {
        return { ok: false, reason: 'outside-root', why: where.why };
      }
      const key = path.relative(canonical, where.absolute).split(path.sep).join('/');
      const text = files[key];
      if (text === undefined) {
        return { ok: false, reason: 'not-found', why: `${relative} is not in the project.` };
      }
      // An empty string marks a file the test wants to be unreadable, which
      // is how the `evidence` path is exercised without breaking a real disk.
      if (text === UNREADABLE) {
        return { ok: false, reason: 'unreadable', why: `Polyglot could not read ${relative}.` };
      }
      return { ok: true, text };
    },
  });
}

/** Marks a file in a `memoryRepository` as present and unreadable. */
export const UNREADABLE = '\u0000unreadable';
