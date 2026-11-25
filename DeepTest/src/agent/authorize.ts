/**
 * Putting the authorization brief in front of the person, and recording
 * their answer.
 *
 * **This replaced a modal that made a promise Polyglot could not keep.** It
 * said the assistant "may change your code and your tests", which under
 * diff-only is not what happens at all: Polyglot renders a validated proposal
 * and the person applies it. It also named no limits, so a yes was a yes to
 * something unstated.
 *
 * Rule 92 is what this file exists for. The person authorizes **intent and
 * bounded consequence**, not correctness: Polyglot does not get to treat
 * their click as review. So the five points are put to them in the words
 * Witness generated from the packet, and every one of them is a fact about
 * what is about to happen rather than an assurance about the result.
 *
 * **Nothing here writes prose.** `briefLines` renders the brief, and this
 * carries it to a modal. A sentence written here would be a sentence nothing
 * checks against the packet, which is the drift rule 93 exists to stop living
 * one layer below where rule 93 can see it.
 */
import * as vscode from 'vscode';
import { authorizationBrief, authorizationEvent, briefLines, reconcileConstraints } from '@projectrevivesolutions/witness';
import type { AuthorizationEvent, GovernancePacket, InteractionSpec } from '@projectrevivesolutions/witness';
import { whoAmI } from '../decisions/store';

const YES = 'Yes, try this';

/**
 * Asks, and returns what they said.
 *
 * `undefined` means no: a dismissed modal is a no, and treating silence as
 * consent is the failure this whole boundary exists to prevent.
 */
export async function askToAuthorize(spec: InteractionSpec, packet: GovernancePacket, log: (line: string) => void): Promise<AuthorizationEvent | undefined> {
  const effective = reconcileConstraints(spec, packet);
  const brief = authorizationBrief(packet, spec, effective);

  // The integration suite cannot press a modal button, so the harness sets
  // this variable in the test host only. Nothing else sets it, and the check
  // is on the process environment rather than on a setting a user could flip.
  const answer =
    process.env.DEEPTEST_TEST_HOST === '1'
      ? YES
      : await vscode.window.showWarningMessage(brief.question, { modal: true, detail: briefLines(brief).join('\n') }, YES);

  if (answer !== YES) {
    log(`${spec.id} was not authorized. Nothing was sent.`);
    return undefined;
  }
  return authorizationEvent(brief, true, whoAmI());
}
