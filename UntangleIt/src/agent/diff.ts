/**
 * Showing a validated proposal, read only.
 *
 * This is the Phase 3 answer to M10, and it rests on evidence rather than on
 * preference. We tested `WorkspaceEdit` with `needsConfirmation: true` on VS
 * Code 1.104.0: the review surface is real, the edit is held, and discarding
 * leaves the tree untouched, but pressing Apply did not apply it and
 * `applyEdit` reported false. So the stable mechanism we could demonstrate is
 * showing the change, and the person makes it.
 *
 * That finding is scoped to what we ran, one version and one host. It is not
 * a claim the API is broken in general, and it is not the permanent product
 * design: rule 92 is the permanent statement, and this is an implementation
 * decision expected to change when the platform does.
 *
 * **Nothing here writes.** There is no `applyEdit`, no `WorkspaceEdit`, no
 * command that applies a proposal, and the right-hand side of the diff comes
 * from a content provider, which has no write path at all. A structural test
 * asserts the absence rather than trusting this comment.
 */
import * as vscode from 'vscode';
import { find } from './proposals';

/** The scheme the proposed text is served on. Read-only by construction. */
const SCHEME = 'untangleit-proposed';

/** Serves the proposed text for the right-hand side of a diff. */
export function registerProposedContentProvider(): vscode.Disposable {
  return vscode.workspace.registerTextDocumentContentProvider(SCHEME, {
    provideTextDocumentContent(uri: vscode.Uri): string {
      const [handle, index] = uri.path.replace(/^\//, '').split('/');
      const kept = find(handle);
      const edit = kept?.proposal.changeSet[Number(index)];
      return edit ? edit.after : '';
    },
  });
}

/**
 * Opens one read-only diff per affected file, and says plainly who applies it.
 *
 * The person is told we do not apply the change, in the same breath as being
 * shown it, so nobody waits for something that is not coming.
 */
export async function showProposedChange(handle: string): Promise<void> {
  const kept = find(handle);
  if (!kept) {
    void vscode.window.showInformationMessage('That proposal is no longer available. Ask again and a fresh one is made.');
    return;
  }
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return;
  }
  for (const [index, edit] of kept.proposal.changeSet.entries()) {
    const left = vscode.Uri.joinPath(folder.uri, edit.path);
    const right = vscode.Uri.from({ scheme: SCHEME, path: `/${handle}/${index}`, query: edit.path });
    await vscode.commands.executeCommand('vscode.diff', left, right, `${edit.path}: now ↔ proposed`, { preview: true });
  }
  void vscode.window.showInformationMessage('This is what your assistant proposes. UntangleIt does not change your files; make the edit yourself, then press "Measure the method again" and it will measure the result.');
}
