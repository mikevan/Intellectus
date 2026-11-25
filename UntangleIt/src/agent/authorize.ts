/**
 * Putting the authorization brief in front of the person, and recording
 * their answer.
 *
 * **This replaced a modal that made a promise Polyglot could not keep.** It
 * said "the assistant will change your code", which under diff-only is not
 * what happens: Polyglot renders a validated proposal and the person applies
 * it. It also named no limits, so a yes was a yes to something unstated.
 *
 * Rule 92: the person authorizes intent and bounded consequence, not
 * correctness, and Polyglot does not get to treat their click as review. The
 * five points are put to them in the words Witness generated from the packet.
 *
 * **Nothing here writes prose.** A sentence written here would be a sentence
 * nothing checks against the packet, which is the drift rule 93 exists to
 * stop, living one layer below where rule 93 can see it.
 */
import * as vscode from 'vscode';
import { authorizationBrief, authorizationEvent, briefLines, reconcileConstraints } from '@projectrevivesolutions/witness';
import type { AuthorizationEvent, GovernancePacket, InteractionSpec } from '@projectrevivesolutions/witness';

const YES = 'Yes, try this';

/** Asks, and returns what they said. `undefined` means no; a dismissed modal is a no. */
export async function askToAuthorize(spec: InteractionSpec, packet: GovernancePacket, who: string, log: (line: string) => void): Promise<AuthorizationEvent | undefined> {
  const brief = authorizationBrief(packet, spec, reconcileConstraints(spec, packet));

  // The integration suite cannot press a modal button, so the harness sets
  // this variable in the test host only. It is read from the process
  // environment, never from a setting a user could flip.
  const answer =
    process.env.UNTANGLEIT_TEST_HOST === '1'
      ? YES
      : await vscode.window.showWarningMessage(brief.question, { modal: true, detail: briefLines(brief).join('\n') }, YES);

  if (answer !== YES) {
    log(`${spec.id} was not authorized. Nothing was sent.`);
    return undefined;
  }
  return authorizationEvent(brief, true, who);
}
