/**
 * The behaviour gate's wiring, owned by Witness.
 *
 * The comparison itself is in compare.ts. This file is everything around it:
 * find the method, run the recorder, keep the run made before the assistant
 * was handed the work, and pair it with the run made afterwards.
 *
 * It lived in UntangleIt until 2026-09-23. DeepTest needs the same machinery
 * for its own function-level refactor flow, and a peer product may not import
 * another peer's implementation, so it moved here whole rather than being
 * copied. Three things that were hard-coded to one product are now supplied
 * by the caller, and each of them was a way to get this wrong:
 *
 *   workDir   the folder the records are kept in. The old code wrote
 *             `<workspaceRoot>/.untangleit`. Moving that as it stood would
 *             have had DeepTest writing into UntangleIt's private folder.
 *   wasmDir   the grammars the locator parses with, which each product
 *             ships in its own layout.
 *   key       what the record is filed under. See `saveBefore`.
 *
 * Nothing here knows the editor, and nothing here knows which product is
 * calling beyond the folder it was given.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { createInstrumenter } from '../hook';
import { posixPath } from '../delivery';
import type { BoundaryRecord } from '../boundary';
import type { BoundarySpec } from './context';
import { decide } from './compare';
import type { Verdict } from './compare';

/**
 * The method starting on a line, by name and by the class it belongs to.
 *
 * The caller knows the line, because that is what the person chose. The gate
 * needs the container too: after the hand-off the assistant has moved the
 * method and the second run has only a name to search by, and a name alone
 * resolves to two functions in any file with a `greet` on a class and a
 * `greet` beside it.
 *
 * Undefined for a language with no line locator, and for a file the parser
 * could not take. The caller then records nothing and claims nothing.
 */
export async function locateBoundary(options: { workspaceRoot: string; relativePath: string; startLine: number; wasmDir: string }): Promise<BoundarySpec | undefined> {
  if (!/\.[cm]?[jt]sx?$/i.test(options.relativePath)) {
    // Python is located by module and qualified name, which the recorder
    // works out from the file itself.
    return undefined;
  }
  try {
    const absolute = path.resolve(options.workspaceRoot, options.relativePath);
    const instrumenter = await createInstrumenter(options.wasmDir);
    const found = instrumenter.locateBoundary(posixPath(absolute), fs.readFileSync(absolute, 'utf8'), options.startLine);
    return found ? { path: options.relativePath, name: found.name, ...(found.container ? { container: found.container } : {}) } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * What is kept between the hand-off and the run that checks it.
 *
 * `key` is stored verbatim and `boundary` beside it, and both are here for
 * the same reason: so the run afterwards can prove it is comparing the thing
 * that was authorized. The key says which decision this belongs to. The
 * boundary says which method was qualified, by name and container, so the
 * second run finds it again after the assistant moved it off its line.
 */
export interface BeforeRecord {
  version: 1;
  /** The caller's own canonical identity for what was authorized. */
  key: string;
  boundary: BoundarySpec;
  recordedAt: string;
  records: BoundaryRecord[];
}

/**
 * The file a key is kept in.
 *
 * A key holds path separators, so it cannot be a file name. It is hashed to
 * make one, and that is the only thing the hash does. The key itself is
 * stored inside the file and compared exactly on the way back out, so a
 * collision or a stale file is caught rather than trusted. Identity is never
 * decided by the hash.
 */
function recordsFile(workDir: string, key: string): string {
  const name = createHash('sha256').update(key).digest('hex').slice(0, 32);
  return path.join(workDir, 'behaviour', `${name}.json`);
}

/**
 * Records the boundary while the project's own tests run.
 *
 * `record` is the product's own recorder, already bound to that product's
 * settings. Witness does not look a recorder up, because which plugin serves
 * a workspace is a product's own question.
 *
 * Returns undefined when there is no recorder at all, which is not the same
 * as a recording that found nothing. The caller says which it was, and the
 * gate makes no claim either way.
 */
export async function recordBoundary(record: (() => Promise<BoundaryRecord[]>) | undefined, log: (line: string) => void): Promise<BoundaryRecord[] | undefined> {
  if (!record) {
    return undefined;
  }
  try {
    return await record();
  } catch (err) {
    // A recording that could not be made is not a failure of the person's
    // code and must never read as one. It is reported as no evidence.
    log(`The behaviour recording could not run: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

/**
 * Keeps the run made before the hand-off, for the run afterwards to compare
 * against.
 *
 * A write that fails is swallowed on purpose. A hand-off must never fail
 * over the gate. What a missing file means at the other end is the caller's
 * to decide, and for a decision the gate governs it means the gate did not
 * complete, never that behaviour held.
 */
export function saveBefore(workDir: string, key: string, boundary: BoundarySpec, records: BoundaryRecord[]): void {
  const file = recordsFile(workDir, key);
  const payload: BeforeRecord = { version: 1, key, boundary, recordedAt: new Date().toISOString(), records };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(payload)}\n`, 'utf8');
  } catch {
    // Deliberate. See above.
  }
}

/**
 * The run kept under a key, or undefined when there is none to be had.
 *
 * The stored key must match the key asked for. A file whose key does not
 * match is not this decision's evidence, whatever its name, and is treated
 * as absent rather than read.
 */
export function loadBefore(workDir: string, key: string): BeforeRecord | undefined {
  try {
    const parsed = JSON.parse(fs.readFileSync(recordsFile(workDir, key), 'utf8')) as Partial<BeforeRecord>;
    if (parsed.version !== 1 || parsed.key !== key || !parsed.boundary || !Array.isArray(parsed.records)) {
      return undefined;
    }
    return parsed as BeforeRecord;
  } catch {
    return undefined;
  }
}

/** Removes a kept run. Called once its verdict has been recorded. */
export function clearBefore(workDir: string, key: string): void {
  try {
    fs.rmSync(recordsFile(workDir, key), { force: true });
  } catch {
    // A record that outlives its use is harmless: the next save overwrites
    // it, and the key check rejects it for anything else.
  }
}

/**
 * The verdict for one round: the run kept from the hand-off against the run
 * just made. A missing run on either side is insufficient evidence with a
 * reason the person can act on, never a pass.
 */
export function verdictFor(before: BoundaryRecord[] | undefined, after: BoundaryRecord[] | undefined): Verdict | undefined {
  if (before === undefined || after === undefined) {
    return undefined;
  }
  return decide(before, after);
}
