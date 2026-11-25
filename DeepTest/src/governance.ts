/**
 * Where DeepTest keeps its Governance History.
 *
 * **The product owns the location and Witness owns everything else.** That
 * is the same split `behaviour/gate.ts` uses, and it exists so a shared
 * layer can never write into the wrong product's folder: Witness is handed a
 * directory and infers nothing.
 *
 * `.deeptest` rather than anywhere else, because that is already the folder
 * DeepTest owns, and because `WORK_DIR_KEEP` is the one list that protects a
 * file there from the sweeper that empties the folder at the start of every
 * measured run. The governance file is on that list.
 *
 * **Local only.** The file is not committed. It can carry `authorization.by`,
 * it carries model identity and operational audit metadata, and it is
 * append-only and unbounded. Rule 70 makes what is in it safe to keep;
 * that is not the same as appropriate to publish through somebody's
 * repository.
 */
import * as path from 'node:path';
import * as vscode from 'vscode';

export function governanceDir(folder: vscode.WorkspaceFolder): string {
  return path.join(folder.uri.fsPath, '.deeptest');
}
