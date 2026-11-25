/**
 * Putting the participant's invocation in front of the person, without sending it.
 *
 * The only place in DeepTest that touches `workbench.action.chat.open`, which
 * is PTP-3. It is permitted here for one thing: populating the chat input so
 * the person can see what would be asked. **It never sends.** They press send,
 * our participant handles it, and the interaction is governed end to end.
 * Pre-filling is navigation; sending would be transport, and an automatic send
 * would rebuild the ungoverned hand-off rule 33 exists to remove.
 *
 * A chat participant cannot be invoked from code. `ChatParticipant` exposes an
 * id, an icon, a handler, a followup provider, an event, and dispose, and
 * nothing that starts one. So this is the most a button can do, and the extra
 * press is forced by the platform rather than chosen by us. It is also the
 * moment the person's own model quota starts being spent, which is a
 * reasonable place for a deliberate press.
 */
import * as vscode from 'vscode';

let lastQuery: string | undefined;

/** Populates the chat input with an invocation of DeepTest's participant. */
export async function prefillChat(query: string): Promise<void> {
  // No `isPartialQuery`, no submit, no auto-send. The person reads it and
  // decides.
  await vscode.commands.executeCommand('workbench.action.chat.open', { query });
  // Recorded only after the editor accepted it, so a failed open is never
  // reported as a pre-fill that happened.
  lastQuery = query;
}

/**
 * The last invocation put in front of the person, or `undefined` if none was.
 *
 * Read-only, and it holds only the text already shown in their chat input. A
 * participant cannot be invoked from code and the editor offers no way to read
 * the chat input back, so this is the only place the governed pre-fill can be
 * observed from outside the module.
 */
export function lastPrefill(): string | undefined {
  return lastQuery;
}
