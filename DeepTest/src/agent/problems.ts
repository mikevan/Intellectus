/**
 * Surfacing a governed packet the behaviour gate placed.
 *
 * M12. The gate's recorder already classifies what stopped it: a project
 * path with a character the runner's own build cannot survive is
 * `toolchain` / `path-character`, decided from deterministic evidence in
 * Witness and wired since Phase 2. UntangleIt has always shown that packet.
 * DeepTest passed no `report` callback at either of its recording sites, so
 * the same failure arrived, was classified, and went nowhere: the recording
 * came back empty, the decision stayed unverified, and the person was told
 * a second recording could not be made without being told why.
 *
 * **Nothing here classifies anything.** The packet arrives already decided
 * and is reused exactly as given. This file is a surface, not a second
 * classification path, and the absence of any call into `diagnosis` is the
 * proof.
 *
 * The shape follows UntangleIt's, deliberately, so the person meets the same
 * failure the same way in both tools: the headline and what is known go to
 * the log, the packet goes onto the result state where the chat participant
 * reads it, and a warning offers the explanation and the log. Rule 42
 * governs the offer: with no model available, nothing is said about asking
 * one, and the deterministic product is exactly as it was.
 */
import * as vscode from 'vscode';
import { toProblemPacket } from '@projectrevivesolutions/witness';
import type { GovernancePacket } from '@projectrevivesolutions/witness';
import { mayOfferAgentic } from './mayOffer';
import { prefillChat } from './prefill';
import { ResultState } from '../state';

export interface ProblemDeps {
  output: vscode.OutputChannel;
  state: ResultState;
}

export function reportProblem(deps: ProblemDeps, governed: GovernancePacket): void {
  const view = toProblemPacket(governed);
  // So the chat participant can answer about the failure that is on screen.
  // This does not put the panel into its error state: the check itself may
  // still be running and its result is still the person's result. What the
  // gate found is a problem beside that, not instead of it.
  deps.state.noteProblem(governed);
  for (const line of [view.headline, ...view.known.map((k) => `  ${k}`)]) {
    deps.output.appendLine(line);
  }
  void (async () => {
    const canAsk = view.actions.includes('explain') && (await mayOfferAgentic());
    const actions = [...(canAsk ? ['Explain with Copilot'] : []), 'Show the log'];
    const choice = await vscode.window.showWarningMessage(view.headline, ...actions);
    if (choice === 'Explain with Copilot') {
      // Nothing is handed over here. A chat participant cannot be invoked
      // from code, so this puts the question in the chat input and the
      // person presses send. The evidence stays in the packet the
      // participant reads.
      await prefillChat('@deeptest explain what stopped this run');
      deps.output.appendLine('Put the question in the chat. Press send when you are ready; nothing is sent for you.');
    } else if (choice === 'Show the log') {
      await vscode.commands.executeCommand('deeptest.showOutput');
    }
  })();
}
