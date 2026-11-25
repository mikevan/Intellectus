/**
 * Reads and writes <workspace>/.deeptest/decisions.json and reads source
 * lines for hashing and display. The only file in the decisions folder
 * that touches the disk or the editor.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { CorruptStoreError, DecisionFile, DecisionsRead, emptyDecisionFile, readDecisionsAt, writeDecisionsAt } from './decisions';

export function decisionsPath(folder: vscode.WorkspaceFolder): string {
  return path.join(folder.uri.fsPath, '.deeptest', 'decisions.json');
}

/** The three states, for a caller that wants to handle them rather than fail. */
export function readDecisions(folder: vscode.WorkspaceFolder): DecisionsRead {
  return readDecisionsAt(decisionsPath(folder));
}

/**
 * The store, or a refusal.
 *
 * **Absent is an empty store; unreadable is not.** This used to return an
 * empty store for both and log that the file was "left untouched", and the
 * next ordinary save then overwrote it. It now throws `CorruptStoreError`
 * for the unreadable case, so a caller fails or preserves rather than
 * manufacturing a history nobody has.
 */
export function loadDecisions(folder: vscode.WorkspaceFolder, log?: (line: string) => void): DecisionFile {
  const read = readDecisions(folder);
  if (read.kind === 'absent') {
    return emptyDecisionFile();
  }
  if (read.kind === 'unreadable') {
    const message = `DeepTest could not read ${decisionsPath(folder)}: ${read.why}. Your decisions are still in that file and nothing will be written over them.`;
    log?.(message);
    throw new CorruptStoreError(message);
  }
  return read.file;
}

/** Writes the store, refusing over a file that could not be read. */
export function saveDecisions(folder: vscode.WorkspaceFolder, decisions: DecisionFile): void {
  writeDecisionsAt(decisionsPath(folder), decisions);
}

export function whoAmI(): string {
  try {
    return os.userInfo().username;
  } catch {
    return 'unknown';
  }
}

/** Line reader that prefers the open (possibly unsaved) editor buffer. */
export function lineReader(folder: vscode.WorkspaceFolder): (relativePath: string, line: number) => string | undefined {
  const cache = new Map<string, string[] | undefined>();
  return (relativePath, line) => {
    let lines = cache.get(relativePath);
    if (!cache.has(relativePath)) {
      const abs = path.join(folder.uri.fsPath, ...relativePath.split('/'));
      const open = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === abs);
      try {
        lines = (open ? open.getText() : fs.readFileSync(abs, 'utf8')).split(/\r?\n/);
      } catch {
        lines = undefined;
      }
      cache.set(relativePath, lines);
    }
    return lines?.[line - 1];
  };
}
