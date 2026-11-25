/**
 * The loop, with a person at every gate:
 *
 *   1. Show      the method, its tangle, the limit (the card).
 *   2. Checkpoint the KeepSafe offer, when KeepSafe is installed.
 *   3. Confirm   one modal sentence; nothing is sent before "Yes, send it".
 *   4. Transform the assistant works from the brief. UntangleIt waits.
 *   5. Verify    "Measure again": run the suite, measure every piece, and
 *                compare the selected method's recorded behaviour with what
 *                was recorded at the hand-off.
 *   6. Decide    within the limit, or another round, or stop. The person.
 *
 * UntangleIt never edits code, never restores a checkpoint, never retries
 * on its own, and never accepts its own result.
 */
import * as vscode from 'vscode';
import { UntangleItConfig, settingsFor } from './config';
import { Comparison, compare, snapshot } from './engine/tangle';
import { KEEPSAFE_EXTENSION_ID, keepSafeInstalled, offerCheckpoint } from './keepsafe';
import { deepTestInstalled } from './deeptest';
import { loadBefore, locateBoundary, recordBoundary, saveBefore, verdictFor } from './gate';
import { sentence as behaviourSentence } from './engine/behaviour';
import type { BoundaryRecord } from '@projectrevivesolutions/witness';
import { LanguagePlugin, TestRunSummary } from './languages/types';
import { measureFile } from './measure';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { attachVerification, nodeRepository, requireInteraction } from '@projectrevivesolutions/witness';
import type { VerificationOutcome } from '@projectrevivesolutions/witness';
import { governanceDir } from './governance';
import type { Runner } from '@projectrevivesolutions/witness';
import { METHOD_PROPOSE_UNTANGLE } from './agent/interactions';
import { untangleProposalPacket } from './agent/packets';
import { askToAuthorize } from './agent/authorize';
import { setPendingAttempt } from './agent/attempt';
import { resolveGovernedRun } from './verification';
import { detectRunner } from './languages/typescript/index';
import { toProblemPacket, unclassifiedGovernancePacket } from '@projectrevivesolutions/witness';
import type { GovernancePacket } from '@projectrevivesolutions/witness';
import { mayOfferAgentic } from './agent/mayOffer';
import { setCurrentProblem } from './agent/current';
import { prefillChat } from './agent/prefill';
import { RunRecord, loadRuns, newRunId, openRunFor, saveRuns, upsertRun, whoAmI } from './runs';
import { ResultState } from './state';
import { outcomeSentence, tangle } from './ui/words';

export interface LoopDeps {
  state: ResultState;
  output: vscode.OutputChannel;
  workspaceRoot: () => string | undefined;
  plugin: () => LanguagePlugin | undefined;
  config: () => UntangleItConfig;
}

interface GateResult {
  proceed: boolean;
  checkpointNote: string;
}

/**
 * The KeepSafe checkpoint offer, which comes first because it is the undo.
 *
 * **The confirmation modal that used to follow it is gone.** It asked one
 * sentence with no limits in it, and it said "the assistant will change your
 * code", which under diff-only is not what happens. What replaced it is the
 * authorization brief, built by Witness from the packet, asked once there is
 * a packet to ask about.
 */
async function offerUndoFirst(deps: LoopDeps): Promise<GateResult> {
  let checkpointNote = '';
  const installed = keepSafeInstalled();
  const offer = deps.config().keepSafe.offerCheckpoint;
  deps.output.appendLine(`KeepSafe (${KEEPSAFE_EXTENSION_ID}) is ${installed ? 'installed' : 'not installed'}; the checkpoint offer is ${offer ? 'on' : 'off'}.`);
  if (installed && offer) {
    const outcome = await offerCheckpoint((l) => deps.output.appendLine(l));
    if (outcome === 'failed') {
      void vscode.window.showWarningMessage('KeepSafe could not create the checkpoint. Nothing was sent to the assistant. Press "Untangle it" again when KeepSafe is ready, or press "Skip" next time to go on without one.');
      return { proceed: false, checkpointNote };
    }
    checkpointNote = outcome === 'created' ? ' A KeepSafe checkpoint was taken first; "KeepSafe: Restore Latest Checkpoint" undoes everything the assistant changes.' : '';
  }
  return { proceed: true, checkpointNote };
}

/** The whole text of a workspace-relative file, or undefined. */
function wholeFile(root: string, relativePath: string): string | undefined {
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
  } catch {
    return undefined;
  }
}


/**
 * A driver hit something the person has to be told about, and the verdict
 * alone would not tell them.
 *
 * UntangleIt shows the one-line headline and offers to have it explained.
 * The explaining is the assistant's job: the packet carries what was
 * established, what was not, and what must not be recommended, and the brief
 * built from it says so in as many words. UntangleIt does not write the
 * explanation, and it does not offer to fix what the packet says cannot be
 * fixed in code.
 */
function reportProblem(deps: LoopDeps, governed: GovernancePacket): void {
  const packet = toProblemPacket(governed);
  // So the chat participant can answer about the failure that is on screen.
  setCurrentProblem(governed);
  for (const line of [packet.headline, ...packet.known.map((k) => `  ${k}`)]) {
    deps.output.appendLine(line);
  }
  void (async () => {
    // Rule 42: the offer only exists when there is a model to ask. With none,
    // nothing is said about it and the person still gets the whole verdict.
    const canAsk = packet.actions.includes('explain') && (await mayOfferAgentic());
    const actions = [...(canAsk ? ['Explain with Copilot'] : []), 'Show the log'];
    const choice = await vscode.window.showWarningMessage(packet.headline, ...actions);
    if (choice === 'Explain with Copilot') {
      // Nothing is handed over here. A chat participant cannot be invoked
      // from code, so this puts the question in the chat input and the person
      // presses send. The evidence stays in the packet the participant reads.
      await prefillChat('@untangleit explain what stopped this run');
      deps.output.appendLine('Put the question in the chat. Press send when you are ready; nothing is sent for you.');
    } else if (choice === 'Show the log') {
      await vscode.commands.executeCommand('untangleit.showOutput');
    }
  })();
}

/**
 * `sourceOf` is gone with the brief builder it fed.
 *
 * It quoted the method into hand-written prose. A governed packet carries
 * measured evidence and a readable-paths list; the model reads the file
 * through those rather than being handed a transcription of it, which is one
 * fewer copy of the customer's source in one fewer place (rule 70).
 */

/**
 * The behaviour gate's "before", taken at the existing "Yes, send it".
 *
 * It runs the project's own tests once, with the Witness recorder watching
 * the selected method and nothing else. That is real time on a large suite
 * and there is no fast path that skips it, because a before-and-after
 * comparison with no before is not a comparison. The log says so rather
 * than hiding it.
 *
 * Nothing here can stop the hand-off. A recording that could not be made is
 * reported at "Measure again" as no evidence, which is not a pass and not a
 * failure, and the person decides as they do now.
 */
async function recordAtHandOff(
  deps: LoopDeps,
  plugin: LanguagePlugin,
  root: string,
  config: UntangleItConfig,
  relativePath: string,
  name: string,
  startLine: number,
): Promise<{ records: BoundaryRecord[]; boundary: { path: string; name: string; container?: string } } | undefined> {
  const recorder = plugin.createBoundaryRecorder?.();
  if (!recorder) {
    return undefined;
  }
  const settings = settingsFor(config, plugin.id);
  const boundary = (await locateBoundary(root, relativePath, startLine)) ?? { path: relativePath, name };
  const records = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `UntangleIt is recording what ${name}() does now (${recorder.describe({ workspaceRoot: root, settings })}).` }, () =>
    recordBoundary(plugin, { workspaceRoot: root, settings, boundary, log: (l) => deps.output.appendLine(l), report: (p) => reportProblem(deps, p) }),
  );
  if (!records) {
    return undefined;
  }
  deps.output.appendLine(`Recorded ${records.length} observation${records.length === 1 ? '' : 's'} of ${boundary.container ? `${boundary.container}.` : ''}${boundary.name} before the hand-off.`);
  return { records, boundary };
}

/** "Untangle it" on a method: the gates, the brief, the record. */
/**
 * The agentic gate, asked before anything at all happens.
 *
 * **Before the checkpoint offer, the packet, the authorization question and
 * any run write**, because every one of those changes the person's project
 * or asks them something, and none of it should happen for a button that
 * cannot work. Before this existed the untangle paths asked the editor
 * nothing: with no model at all, "Untangle this method" took a KeepSafe
 * checkpoint, wrote a run record, asked the rule 92 question and pre-filled
 * a chat nobody could answer.
 *
 * It is silent, per rule 42, beyond the log.
 */
async function agenticGateOpen(deps: LoopDeps, what: string): Promise<boolean> {
  if (await mayOfferAgentic()) {
    return true;
  }
  deps.output.appendLine(`Polyglot AI assistance is unavailable, so no attempt was prepared for ${what}. Nothing was recorded and the measurement is unaffected.`);
  return false;
}

export async function untangle(deps: LoopDeps, relativePath: string, startLine: number): Promise<void> {
  if (!(await agenticGateOpen(deps, `${relativePath}:${startLine}`))) {
    return;
  }
  const root = deps.workspaceRoot();
  const plugin = deps.plugin();
  const config = deps.config();
  if (!root || !plugin) {
    void vscode.window.showErrorMessage('Open the folder that holds the method, and then choose a method to untangle.');
    return;
  }
  // A sibling tool (DeepTest's "Break it into smaller pieces") calls this
  // command before UntangleIt has measured anything, so a method that is
  // not in the last measure is measured on demand from its own file. Only
  // when the file has no method starting on that line is the person asked
  // to run "Find the tangled methods" themselves.
  let measured = deps.state.measure?.methods.find((m) => m.path === relativePath && m.startLine === startLine);
  if (!measured) {
    const fresh = await measureFile(plugin, root, relativePath, (l) => deps.output.appendLine(l));
    const found = fresh.find((m) => m.startLine === startLine);
    if (found) {
      measured = { ...found, path: relativePath };
      deps.output.appendLine(`Measured ${relativePath} on demand for ${found.name}() at line ${startLine}.`);
    }
  }
  if (!measured) {
    void vscode.window.showErrorMessage(`No method starts on line ${startLine} of ${relativePath}. Press "Find the tangled methods", and then choose a method to untangle.`);
    return;
  }
  if (measured.mbcc <= config.limit) {
    void vscode.window.showInformationMessage(`${measured.name}() has ${tangle(measured.mbcc)}, which is within your limit of ${config.limit}. There is nothing to untangle.`);
    return;
  }
  const target = { ...measured, limit: config.limit, over: measured.mbcc - config.limit };
  const existing = openRunFor(deps.state.runs, relativePath, target.name);
  if (existing && existing.status === 'sent') {
    const answer = await vscode.window.showInformationMessage(`${target.name}() was already sent to your assistant on ${existing.startedAt.slice(0, 10)}. Press "Measure again" to see what came back, or send it again.`, 'Measure again', 'Send again');
    if (answer === 'Measure again') {
      await measureAgain(deps, relativePath, target.name);
      return;
    }
    if (answer !== 'Send again') {
      return;
    }
  }
  const spec = requireInteraction(METHOD_PROPOSE_UNTANGLE);
  const proposal = untangleProposalPacket({
    path: relativePath,
    name: target.name,
    startLine: target.startLine,
    before: target.mbcc,
    limit: config.limit,
    measure: 'mbcc',
    runner: (detectRunner(root) ?? 'vitest') as Runner,
    read: (p) => wholeFile(root, p),
  });
  if (!proposal.ok) {
    deps.output.appendLine(`No attempt for ${relativePath} ${target.name}(). ${proposal.why}`);
    void vscode.window.showWarningMessage(proposal.why);
    return;
  }

  const gate = await offerUndoFirst(deps);
  if (!gate.proceed) {
    return;
  }
  // The behaviour gate's "before", at the gate that already exists: the
  // person has confirmed, and nothing has been sent yet. It costs one run of
  // the project's tests, which the report names rather than hides.
  const before = await recordAtHandOff(deps, plugin, root, config, relativePath, target.name, target.startLine);
  const fileMethods = await measureFile(plugin, root, relativePath, (l) => deps.output.appendLine(l));
  const authorization = await askToAuthorize(spec, proposal.packet, whoAmI(), (l) => deps.output.appendLine(l));
  if (!authorization) {
    return;
  }
  const run: RunRecord = {
    id: newRunId(),
    path: relativePath,
    name: target.name,
    startLine: target.startLine,
    before: target.mbcc,
    measure: 'mbcc',
    limit: config.limit,
    by: whoAmI(),
    startedAt: new Date().toISOString(),
    rounds: 1,
    status: 'sent',
    snapshot: snapshot(target, fileMethods),
  };
  const runs = upsertRun(loadRuns(root), run);
  saveRuns(root, runs);
  deps.state.setRuns(runs);
  if (before) {
    run.boundary = before.boundary;
    saveBefore(root, run.id, before.boundary, before.records);
    const saved = upsertRun(runs, run);
    saveRuns(root, saved);
    deps.state.setRuns(saved);
  }
  setPendingAttempt({ interactionId: spec.id, packet: proposal.packet, authorization, anchor: proposal.anchor, runId: run.id });
  await prefillChat(`@untangleit ${proposal.packet.headline}`);
  deps.output.appendLine(`Authorized ${spec.id} for ${relativePath} ${target.name}() (tangle ${target.mbcc} by MBCC, ${target.campbell} by Campbell, ${target.complexity} ways through; limit ${config.limit}).`);
  void vscode.window.showInformationMessage(
    `Press send in the chat and UntangleIt will ask your assistant, then check the answer against the limits you agreed to. Nothing changes on disk until you apply it, and when you have, press "Measure again" on ${target.name}().${gate.checkpointNote}`,
  );
}

/** "Untangle it" on the worst method in the workspace. */
export async function untangleWorst(deps: LoopDeps): Promise<void> {
  const worst = deps.state.measure?.tangled[0];
  if (!worst) {
    void vscode.window.showInformationMessage('There is nothing to untangle. Every measured method is within your limit.');
    return;
  }
  await untangle(deps, worst.path, worst.startLine);
}

async function runTests(deps: LoopDeps, plugin: LanguagePlugin, root: string, config: UntangleItConfig): Promise<TestRunSummary | undefined> {
  const settings = settingsFor(config, plugin.id);
  const runner = plugin.createTestRunner();
  // What would run, as the runner itself describes it. This is the same
  // string the progress notification already shows, so nothing new is
  // measured to name it, and it is what actually would have run rather than
  // the language it is written in.
  const describes = runner.describe({ workspaceRoot: root, settings });
  try {
    return await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `UntangleIt is running your tests (${describes}).` }, () =>
      runner.run({ workspaceRoot: root, settings, log: (l) => deps.output.appendLine(l) }),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    deps.output.appendLine(`The tests could not run: ${message}`);
    // M5. The tests did not run at all, and nothing here establishes why or
    // whose doing it was: the runner threw, and its message is the whole of
    // the evidence. So the person gets a governed packet that says the cause
    // is not established, and can ask about it, instead of a line in a log
    // they have to go looking for. No class is guessed, and the measurement
    // this comparison needed is simply missing, which is what the caller
    // already reports as an unverified round.
    reportProblem(
      deps,
      unclassifiedGovernancePacket({
        runner: describes,
        evidence: [`UntangleIt tried to run ${describes}.`, message],
        headline: 'UntangleIt could not run your tests, and could not work out why.',
      }),
    );
    return undefined;
  }
}

/**
 * Attaches one resolved outcome to the governance history.
 *
 * Returns whether the run's own verification may now be written. False means
 * the governance attachment did not happen, so the run stays unresolved and
 * the next measurement tries again.
 *
 * Three failures, each reported and none silent: no record for this attempt,
 * which is legitimate when the model was never reached; a stored interaction
 * that disagrees with the run's, which writes nothing anywhere; and a store
 * that could not be read or written.
 */
function attachGovernanceVerification(deps: LoopDeps, root: string, run: RunRecord, outcome: VerificationOutcome): boolean {
  if (!run.attemptId || !run.governedInteractionId) {
    // Not a governed attempt. The run record is the whole of the record.
    return true;
  }
  try {
    const attach = attachVerification(governanceDir(root), run.attemptId, outcome, 're-measure', run.governedInteractionId);
    if (attach.kind === 'conflicted') {
      deps.output.appendLine(
        `Governance History already held a different outcome for this attempt (${attach.existing.map((o) => o.outcome).join(', ')}) and now holds ${attach.incoming} as well. Both are kept; nothing chooses between them.`,
      );
    }
    return true;
  } catch (err) {
    deps.output.appendLine(`Governance History was not updated for ${run.path} ${run.name}(): ${(err as Error).message} The run stays unverified and will be retried.`);
    return false;
  }
}

/** "Measure again" on a method with an open run: verify, compare, decide. */
export async function measureAgain(deps: LoopDeps, relativePath: string, name: string): Promise<void> {
  const root = deps.workspaceRoot();
  const plugin = deps.plugin();
  if (!root || !plugin) {
    return;
  }
  const runs = loadRuns(root, (l) => deps.output.appendLine(l));
  const run = openRunFor(runs, relativePath, name);
  if (!run) {
    void vscode.window.showInformationMessage(`${name}() has no untangling in progress. Press "Untangle it" to start one.`);
    return;
  }
  const config = deps.config();
  const after = await measureFile(plugin, root, relativePath, (l) => deps.output.appendLine(l));
  const comparison = compare(run.snapshot, after, run.limit);
  const tests = await runTests(deps, plugin, root, config);
  // The behaviour gate's "after", beside the test run and the tangle
  // measurement this step already performs. The method is found again by
  // name inside its container, because the assistant moved it and nothing
  // here knows where.
  const behaviour = await compareBehaviour(deps, plugin, root, config, run);
  const sentence = outcomeSentence(comparison, tests, run.limit, name);
  const failing = tests ? tests.failed + tests.errors : 0;
  run.measuredAt = new Date().toISOString();
  run.pieces = comparison.pieces;
  run.tests = tests ? { passed: tests.passed, failed: tests.failed, errors: tests.errors } : undefined;
  run.outcome = sentence;
  run.behaviour = behaviour;
  // A changed behaviour is a blocking gate. The untangling may have brought
  // the tangle down and the suite may be green, and it still does not
  // behave the way it did, so it is not within limit and the person is told
  // in those words. UntangleIt restores nothing and decides nothing.
  run.status = behaviour?.verdict === 'changed' ? 'behaviour-changed' : failing > 0 ? 'tests-fail' : comparison.withinLimit ? 'within-limit' : 'still-over';
  // Field 10, for a run that came from a governed attempt. It reads the
  // anchor rather than the existence of this measurement: a measurement runs
  // whether or not the person applied anything, so its existence proves the
  // third state and not the second.
  const verified = resolveGovernedRun(run, comparison, nodeRepository(root));
  if (verified) {
    deps.output.appendLine(`Verification for ${run.path} ${run.name}() (${run.governedInteractionId}): ${verified.outcome}.${verified.sentence ? ` ${verified.sentence}` : ''}`);
    // M17b, and the order is not arbitrary.
    //
    // Governance history first, product state second. `resolveGovernedRun`
    // skips a run that already carries an outcome, so writing the run first
    // and then failing to write the governance entry would make every later
    // measurement skip it: the run would look resolved, the resolver would
    // never look again, and the governance history could never be repaired.
    // The other order is recoverable, which is the whole argument: an
    // unresolved run is measured again, and the identical outcome writes
    // nothing.
    if (attachGovernanceVerification(deps, root, run, verified.outcome)) {
      run.verification = { outcome: verified.outcome, at: new Date().toISOString() };
    }
  }
  const saved = upsertRun(runs, run);
  saveRuns(root, saved);
  deps.state.setRuns(saved);
  deps.output.appendLine(`Measured ${relativePath} ${name}() after round ${run.rounds}: ${sentence}`);
  if (behaviour) {
    deps.output.appendLine(`Behaviour gate: ${behaviour.sentence}`);
  }
  await vscode.commands.executeCommand('untangleit.run');

  if (run.status === 'behaviour-changed') {
    void vscode.window.showWarningMessage(`${behaviour!.sentence} ${sentence} Restore the checkpoint if you want the original back, or look at what changed and decide.`);
    return;
  }
  if (run.status === 'within-limit') {
    const tail = deepTestInstalled() ? ' Press "Check my code again" in DeepTest to see whether every piece has the tests it needs.' : '';
    const said = behaviour ? ` ${behaviour.sentence}` : '';
    void vscode.window.showInformationMessage(`${sentence}${said}${tail}`);
    return;
  }
  if (run.rounds >= config.rounds) {
    void vscode.window.showWarningMessage(`${sentence} That was round ${run.rounds} of ${config.rounds}, so UntangleIt stops here. Restore the checkpoint if you want the original back, or raise the rounds on the setup screen and press "Untangle it" again.`);
    run.status = 'stopped';
    const stopped = upsertRun(saved, run);
    saveRuns(root, stopped);
    deps.state.setRuns(stopped);
    return;
  }
  const answer = await vscode.window.showWarningMessage(sentence, 'Send another round', 'Stop here');
  if (answer !== 'Send another round') {
    if (answer === 'Stop here') {
      run.status = 'stopped';
      const stopped = upsertRun(saved, run);
      saveRuns(root, stopped);
      deps.state.setRuns(stopped);
    }
    return;
  }
  await anotherRound(deps, plugin, root, config, run, comparison);
}

/**
 * The gate's answer for this round: the run kept from the hand-off against
 * a run made now.
 *
 * Undefined when the gate did not run at all, which is not a verdict and is
 * never shown as one. A before that was never kept reports as insufficient
 * evidence with the reason, because a comparison with no before is not a
 * comparison.
 */
async function compareBehaviour(deps: LoopDeps, plugin: LanguagePlugin, root: string, config: UntangleItConfig, run: RunRecord): Promise<RunRecord['behaviour']> {
  const recorder = plugin.createBoundaryRecorder?.();
  if (!recorder || !run.boundary) {
    return undefined;
  }
  const settings = settingsFor(config, plugin.id);
  const after = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `UntangleIt is recording what ${run.name}() does now (${recorder.describe({ workspaceRoot: root, settings })}).` }, () =>
    recordBoundary(plugin, { workspaceRoot: root, settings, boundary: run.boundary!, log: (l) => deps.output.appendLine(l), report: (p) => reportProblem(deps, p) }),
  );
  const before = loadBefore(root, run.id);
  const verdict = verdictFor(before, after);
  if (!verdict) {
    return undefined;
  }
  const label = `${run.boundary.container ? `${run.boundary.container}.` : ''}${run.boundary.name}`;
  return {
    verdict: verdict.verdict,
    ...(verdict.verdict === 'insufficient' ? { reason: verdict.reason } : { compared: verdict.compared }),
    sentence: behaviourSentence(verdict, label),
  };
}

async function anotherRound(deps: LoopDeps, plugin: LanguagePlugin, root: string, config: UntangleItConfig, run: RunRecord, comparison: Comparison): Promise<void> {
  if (!(await agenticGateOpen(deps, `${run.path}, another round`))) {
    return;
  }
  const spec = requireInteraction(METHOD_PROPOSE_UNTANGLE);
  const gate = await offerUndoFirst(deps);
  if (!gate.proceed) {
    return;
  }
  const at = comparison.original ?? comparison.pieces[0];
  const proposal = untangleProposalPacket({
    path: run.path,
    name: run.name,
    startLine: at?.startLine ?? run.startLine,
    before: at?.mbcc ?? run.before,
    limit: run.limit,
    measure: run.measure ?? 'ways',
    runner: (detectRunner(root) ?? 'vitest') as Runner,
    read: (p) => wholeFile(root, p),
  });
  if (!proposal.ok) {
    deps.output.appendLine(`No further round for ${run.path} ${run.name}(). ${proposal.why}`);
    void vscode.window.showWarningMessage(proposal.why);
    return;
  }
  const authorization = await askToAuthorize(spec, proposal.packet, whoAmI(), (l) => deps.output.appendLine(l));
  if (!authorization) {
    return;
  }
  // Each round is its own attempt: a new anchor over the file as it is now,
  // so a round that changed nothing cannot be read as one that did.
  run.anchor = proposal.anchor;
  run.governedInteractionId = spec.id;
  // The snapshot from before round 1 stays: every piece created since the
  // start is still a piece, whichever round created it.
  run.rounds += 1;
  run.status = 'sent';
  const saved = upsertRun(loadRuns(root), run);
  saveRuns(root, saved);
  deps.state.setRuns(saved);
  setPendingAttempt({ interactionId: spec.id, packet: proposal.packet, authorization, anchor: proposal.anchor, runId: run.id });
  await prefillChat(`@untangleit ${proposal.packet.headline}`);
  deps.output.appendLine(`Round ${run.rounds} authorized for ${run.path} ${run.name}().`);
  void vscode.window.showInformationMessage(
    `Press send in the chat and UntangleIt will ask your assistant, then check the answer against the limits you agreed to. When you have applied it, press "Measure again" on ${run.name}().${gate.checkpointNote}`,
  );
}
