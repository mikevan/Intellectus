/**
 * The second half of the behaviour gate: after the assistant has been at it.
 *
 * At the hand-off, `recordBeforeHandOff` watched the function while the
 * project's own tests ran and kept what it saw. This runs after the next
 * check, watches it again, and compares. The answer is written onto the
 * decision, and `functionDecisionState` reads it there.
 *
 * Only decisions the gate governs are touched, and only once their function
 * is back within the limit. A function still over the limit has not been
 * fixed yet, so there is nothing to confirm, and running the suite again to
 * confirm nothing would cost the person time for no answer.
 *
 * Nothing here changes a decision the gate does not govern, and nothing here
 * turns a decision into a fix. It records what was observed. The rule about
 * what that means lives in one place, in `decisions.ts`.
 *
 * **Field 10 is resolved here too, since Phase 5**, in the same place and for
 * the same reason: this is the point in the ordinary check where a
 * measurement has been made and a decision can be told what it came to. The
 * rule for what a set of measurements means is Witness's, in
 * `resolveVerification`, so the two products and the four interactions cannot
 * resolve it four ways.
 *
 * **It runs after the behaviour gate, deliberately.** A refactor's field 10
 * names `behaviour-equivalence`, and that answer is written onto the decision
 * by the loop above. Resolving before it would read an absent verdict as
 * insufficient on every first check, which is true but useless.
 */
import * as vscode from 'vscode';
import { sentence as behaviourSentence, nodeRepository, verdictFor } from '@projectrevivesolutions/witness';
import type { GovernancePacket } from '@projectrevivesolutions/witness';
import { DeepTestConfig, settingsFor } from './../config';
import { AnalysisResult } from '../engine/types';
import { LanguagePlugin } from '../languages/types';
import { clearBefore, loadBefore, recordBoundary } from '../gate';
import { Decision, DecisionFile, recordDecision } from './decisions';
import { loadDecisions, lineReader, saveDecisions } from './store';
import { resolveGovernedDecisions, withVerifications } from './verification';
import type { ResolvedVerification } from './verification';
import { attachVerification } from '@projectrevivesolutions/witness';
import { governanceDir } from '../governance';

/**
 * Decisions waiting on a verdict: the gate governs them, their function is
 * within the limit now, the line they were pinned to has not changed, and
 * nothing has been compared yet.
 *
 * The staleness check is here for the same reason it is in
 * `functionDecisionState`. A decision whose line has moved under it is not
 * about this function any more, and recording against it would attach a
 * verdict to something nobody authorized.
 */
function awaitingVerdict(file: DecisionFile, result: AnalysisResult, read: (path: string, line: number) => string | undefined): Decision[] {
  const limit = result.summary.thresholds.maxFunctionComplexity;
  const out: Decision[] = [];
  for (const f of result.files) {
    for (const fn of f.functions) {
      if (fn.complexity - limit > 0) {
        continue;
      }
      const d = file.decisions.find((x) => x.scope === 'function' && x.path === f.path && x.line === fn.startLine);
      // An insufficient verdict is retried. It says the comparison could
      // not reach an answer, not that it reached one, and the next run of
      // the suite may exercise the method where the last one did not.
      if (d && d.behaviourGate === 'recorded' && (!d.behaviour || d.behaviour.verdict === 'insufficient') && read(f.path, fn.startLine) !== undefined) {
        out.push(d);
      }
    }
  }
  return out;
}

/**
 * Watches every function awaiting a verdict a second time and records what
 * the comparison came to.
 *
 * A recording that cannot be made leaves the decision as it is, waiting.
 * That reads as unverified, which is the honest answer, and the next check
 * tries again. It never becomes a pass by default.
 */
export async function verifyBehaviour(
  // `report` is M12: the recorder's own classified packet, handed back to
  // whoever can show it. Optional so a caller with no surface (a test) is
  // not forced to invent one, and the recorder simply reports to nobody.
  deps: { output: vscode.OutputChannel; folder: vscode.WorkspaceFolder; report?: (packet: GovernancePacket) => void },
  plugin: LanguagePlugin,
  config: DeepTestConfig,
  result: AnalysisResult,
  signal?: AbortSignal,
): Promise<void> {
  if (!plugin.createBoundaryRecorder?.()) {
    return;
  }
  const root = deps.folder.uri.fsPath;
  const read = lineReader(deps.folder);
  let file = loadDecisions(deps.folder, (l) => deps.output.appendLine(l));
  const waiting = awaitingVerdict(file, result, read);
  if (waiting.length === 0) {
    return;
  }
  const settings = settingsFor(config, plugin.id);
  for (const decision of waiting) {
    const before = loadBefore(root, decision.path, decision.line);
    if (!before) {
      // The gate governs this decision and the recording it was meant to
      // keep is gone. That is a defect in the gate, not evidence about the
      // person's code, and it stays unverified until one of us fixes it.
      deps.output.appendLine(`The recording kept for ${decision.path}:${decision.line} is missing, so DeepTest cannot confirm ${decision.functionName ?? 'this function'}() still does what it did.`);
      continue;
    }
    const label = `${before.boundary.container ? `${before.boundary.container}.` : ''}${before.boundary.name}`;
    const after = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `DeepTest is checking that ${before.boundary.name}() still does what it did.` }, () =>
      recordBoundary(plugin, { workspaceRoot: root, settings, boundary: before.boundary, log: (l) => deps.output.appendLine(l), report: deps.report, signal }),
    );
    const verdict = verdictFor(before.records, after);
    if (!verdict) {
      deps.output.appendLine(`DeepTest could not record ${label} a second time, so the fix is not confirmed yet. It will try again on the next check.`);
      continue;
    }
    const sentence = behaviourSentence(verdict, label);
    deps.output.appendLine(`Behaviour gate for ${decision.path} ${label}: ${verdict.verdict}. ${sentence}`);
    file = recordDecision(file, {
      ...decision,
      behaviour: { verdict: verdict.verdict, ...(verdict.verdict === 'insufficient' ? { reason: verdict.reason } : { compared: verdict.compared }), sentence },
    });
    saveDecisions(deps.folder, file);
    if (verdict.verdict !== 'insufficient') {
      // The verdict is on the decision now, so the recording has done its
      // job. An insufficient one is kept: the next check may reach a real
      // answer against the same before-evidence.
      clearBefore(root, decision.path, decision.line);
    }
  }
}

/**
 * Field 10 for every governed decision whose outcome is still open.
 *
 * Separate from `verifyBehaviour` above and called after it, because the two
 * answer different questions: that one asks whether a method still does what
 * it did, and this one asks whether the objective the person authorized held.
 *
 * **A failed or holed run never reaches here.** `runner.ts` refuses to score
 * a run whose tests did not finish and refuses a run whose attribution has a
 * hole, and both return before `analyze()` produces anything, so there is no
 * `AnalysisResult` to call this with. The verification is then simply
 * unresolved and the decision stays awaiting, which is a different thing from
 * `not-run`: that says the anchor was never applied.
 */
export function resolveGovernedVerifications(deps: { output: vscode.OutputChannel; folder: vscode.WorkspaceFolder }, result: AnalysisResult): void {
  const file = loadDecisions(deps.folder, (l) => deps.output.appendLine(l));
  const repository = nodeRepository(deps.folder.uri.fsPath);
  const resolved = resolveGovernedDecisions(file, result, repository);
  if (resolved.length === 0) {
    return;
  }
  for (const r of resolved) {
    deps.output.appendLine(`Verification for ${r.decision.path}:${r.decision.line} (${r.decision.governedInteractionId}): ${r.outcome}.${r.sentences.length > 0 ? ` ${r.sentences.join(' ')}` : ''}`);
  }

  // M17b, and the order is not arbitrary.
  //
  // Governance history first, product state second. The resolver above skips
  // any decision that already carries an outcome, so writing the decision
  // first and then failing to write the governance entry would make a later
  // run skip that decision forever: the product would believe it was
  // resolved, the resolver would never look at it again, and the governance
  // history would never be repaired. The other order is recoverable, and
  // that asymmetry is the whole argument. A decision whose governance
  // attachment fails stays unresolved on disk and is retried next time,
  // where the identical outcome writes nothing.
  const attached = resolved.filter((r) => attachOne(deps, r));
  if (attached.length === 0) {
    return;
  }
  try {
    saveDecisions(deps.folder, withVerifications(file, attached, new Date().toISOString()));
  } catch (err) {
    // Governance is already durable. It is not rolled back: it is a true
    // record of a measurement that happened. The decision stays unresolved,
    // the next run retries, and `attachVerification` answers that retry with
    // its already-recorded no-op.
    deps.output.appendLine(`The verification was recorded in Governance History and the decisions file could not be saved: ${(err as Error).message} It will be retried on the next check.`);
  }
}

/**
 * Attaches one resolved outcome to the governance history.
 *
 * Returns whether the product record may now be written. False means the
 * governance attachment did not happen, and the decision must stay
 * unresolved so a later run can try again.
 *
 * Three failures, each reported and none of them silent: no record for this
 * attempt, which is legitimate when the model was never reached; a stored
 * interaction that disagrees with the decision's, which writes nothing
 * anywhere; and a store that could not be read or written.
 */
function attachOne(deps: { output: vscode.OutputChannel; folder: vscode.WorkspaceFolder }, r: ResolvedVerification): boolean {
  const { attemptId, governedInteractionId } = r.decision;
  if (!attemptId || !governedInteractionId) {
    // Not a governed attempt. Nothing to attach, and the decision is the
    // whole of the record.
    return true;
  }
  try {
    const attach = attachVerification(governanceDir(deps.folder), attemptId, r.outcome, 're-measure', governedInteractionId);
    if (attach.kind === 'conflicted') {
      deps.output.appendLine(
        `Governance History already held a different outcome for this attempt (${attach.existing.map((o) => o.outcome).join(', ')}) and now holds ${attach.incoming} as well. Both are kept; nothing chooses between them.`,
      );
    }
    return true;
  } catch (err) {
    deps.output.appendLine(`Governance History was not updated for ${r.decision.path}:${r.decision.line}: ${(err as Error).message} The decision stays unverified and will be retried.`);
    return false;
  }
}
