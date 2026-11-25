/**
 * The three choices on a shortfall, and the governed attempt. The person
 * picks; the tool records and asks. It never picks, and it never retries.
 *
 * **Phase 5 replaced the hand-off with a governed interaction**, and the
 * difference is not cosmetic. Before, a brief was assembled here as prose,
 * put on the clipboard, and dropped into the editor chat: nothing recorded
 * what limits travelled, nothing validated what came back, and the modal in
 * front of it promised the assistant "may change your code and your tests",
 * which under diff-only is not what happens at all. Now the measured evidence
 * becomes a packet, the person authorizes a brief Witness generated from that
 * packet, and the participant runs the interaction end to end. `buildBrief`,
 * `buildFunctionBrief`, the local `handOff` and the old modal are gone rather
 * than wrapped, because hand-written prose inside a governed packet is the
 * thing rule 87 was written about.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { DeepTestConfig, settingsFor } from '../config';
import { pluginById } from '../languages/registry';
import { clearBefore, locateBoundary, recordBoundary, saveBefore } from '../gate';
import { reportProblem } from '../agent/problems';
import { KEEPSAFE_EXTENSION_ID, keepSafeInstalled, offerCheckpoint } from '../keepsafe';
import { UNTANGLEIT_EXTENSION_ID, handToUntangleIt, untangleItInstalled } from '../untangleit';
import { functionFixRoute, refactorChoiceDescription, untangleFailedSentence, untangleSentSentence } from '../ui/words';
import type { FunctionFixMode } from '../report/brief';
import { detectRunner } from '../languages/typescript/coverage';
import { requireInteraction } from '@projectrevivesolutions/witness';
import type { Runner } from '@projectrevivesolutions/witness';
import { COVERAGE_PROPOSE_TEST, FUNCTION_PROPOSE_REFACTOR, FUNCTION_PROPOSE_TESTS } from '../agent/interactions';
import { refactorProposalPacket, testProposalPacket } from '../agent/packets';
import { attributedPairs } from '../agent/testPath';
import { askToAuthorize } from '../agent/authorize';
import { setPendingAttempt } from '../agent/attempt';
import { prefillChat } from '../agent/prefill';
import { mayOfferAgentic } from '../agent/mayOffer';
import { ResultState } from '../state';
import { hashLine, recordDecision, removeDecision } from './decisions';
import { lineReader, loadDecisions, saveDecisions, whoAmI } from './store';

export interface DecisionDeps {
  state: ResultState;
  output: vscode.OutputChannel;
  folder: () => vscode.WorkspaceFolder | undefined;
  config: () => DeepTestConfig;
}

function reload(deps: DecisionDeps, folder: vscode.WorkspaceFolder): void {
  deps.state.setDecisions(loadDecisions(folder, (l) => deps.output.appendLine(l)), lineReader(folder));
}

interface GateResult {
  proceed: boolean;
  checkpointNote: string;
}

/**
 * The KeepSafe checkpoint offer, which comes before anything else because it
 * is the undo.
 *
 * **The confirmation modal that used to follow it is gone.** It asked one
 * sentence with no limits in it, and the sentence was wrong about what
 * happens. What replaced it is the authorization brief, built by Witness from
 * the packet, and it is asked later, once there is a packet to ask about.
 * Nothing is recorded and nothing is sent until the person answers that.
 */
async function offerUndoFirst(deps: DecisionDeps, logName: string): Promise<GateResult> {
  let checkpointNote = '';
  const installed = keepSafeInstalled();
  const offer = deps.config().keepSafe.offerCheckpoint;
  deps.output.appendLine(`KeepSafe (${KEEPSAFE_EXTENSION_ID}) is ${installed ? 'installed' : 'not installed'}; the checkpoint offer is ${offer ? 'on' : 'off'}.`);
  if (installed && offer) {
    const outcome = await offerCheckpoint((l) => deps.output.appendLine(l));
    if (outcome === 'failed') {
      void vscode.window.showWarningMessage('KeepSafe could not create the checkpoint. Nothing was sent to the assistant. Press "Fix this" again when KeepSafe is ready, or press "Skip" next time to go on without one.');
      return { proceed: false, checkpointNote };
    }
    checkpointNote = outcome === 'created' ? ' A KeepSafe checkpoint was taken first; "KeepSafe: Restore Latest Checkpoint" undoes everything the assistant changes.' : '';
  }
  deps.output.appendLine(`Preparing a governed attempt for ${logName}.`);
  return { proceed: true, checkpointNote };
}

/**
 * The agentic gate, asked before anything at all happens.
 *
 * **Before the checkpoint offer, the packet, the authorization question and
 * any store write**, because every one of those changes the person's project
 * or asks them something, and none of it should happen for a button that
 * cannot work. Before this existed the propose commands asked the editor
 * nothing: with no model at all, pressing "Fix this" took a KeepSafe
 * checkpoint, wrote a decision, asked the rule 92 question and pre-filled a
 * chat nobody could answer.
 *
 * It is silent, per rule 42, beyond the log. The person pressed a button
 * that should not have been drawn, and the finding on screen is unchanged.
 */
async function agenticGateOpen(deps: DecisionDeps, what: string): Promise<boolean> {
  if (await mayOfferAgentic()) {
    return true;
  }
  deps.output.appendLine(`Polyglot AI assistance is unavailable, so no attempt was prepared for ${what}. Nothing was recorded and the measurement is unaffected.`);
  return false;
}

export async function fixShortfall(deps: DecisionDeps, relativePath: string, lineNo: number): Promise<void> {
  if (!(await agenticGateOpen(deps, `${relativePath}:${lineNo}`))) {
    return;
  }
  const folder = deps.folder();
  if (!folder) {
    return;
  }
  const file = deps.state.fileResult(relativePath);
  const line = file?.lines.find((l) => l.line === lineNo);
  const result = deps.state.result;
  if (!file || !line || !result) {
    void vscode.window.showErrorMessage('Check your code first, and then decide about its lines.');
    return;
  }

  // The destination is decided from measured attribution before any packet
  // exists, so a source exercised by several test files refuses here, with
  // zero model calls and nothing spent.
  const proposal = testProposalPacket({
    source: relativePath,
    gaps: [{ path: relativePath, line: lineNo, tests: line.tests, gap: line.gap, because: routeSentence(line) }],
    pairsForSource: attributedPairs([file]),
    pairsInProject: attributedPairs(result.files),
    runner: runnerOf(deps, folder),
    read: (p) => wholeFile(folder, p),
    exists: (p) => wholeFile(folder, p) !== undefined,
  });
  if (!proposal.ok) {
    deps.output.appendLine(`No attempt for ${relativePath}:${lineNo}. ${proposal.why}`);
    void vscode.window.showWarningMessage(proposal.why);
    return;
  }

  const gate = await offerUndoFirst(deps, `${relativePath}:${lineNo}`);
  if (!gate.proceed) {
    return;
  }

  const spec = requireInteraction(COVERAGE_PROPOSE_TEST);
  const authorization = await askToAuthorize(spec, proposal.packet, (l) => deps.output.appendLine(l));
  if (!authorization) {
    return;
  }

  const read = lineReader(folder);
  const decisions = recordDecision(loadDecisions(folder), {
    path: relativePath,
    line: lineNo,
    lineHash: hashLine(read(relativePath, lineNo) ?? ''),
    kind: 'fix',
    reason: '',
    by: whoAmI(),
    at: new Date().toISOString(),
    gapAtDecision: line.gap,
    governedInteractionId: spec.id,
    anchor: proposal.anchor,
    // The before-set, per targeted line, which the ordinary run already
    // produced. Keeping it per line rather than flattening it is what lets a
    // later check see a test stop reaching one target while still reaching
    // another.
    verificationTargets: [{ path: relativePath, line: lineNo, testsBefore: [...line.tests] }],
  });
  saveDecisions(folder, decisions);
  reload(deps, folder);

  setPendingAttempt({
    interactionId: spec.id,
    packet: proposal.packet,
    authorization,
    anchor: proposal.anchor,
    decision: { path: relativePath, line: lineNo },
  });
  await prefillChat(`@deeptest ${proposal.packet.headline}`);
  deps.output.appendLine(`Authorized ${spec.id} for ${relativePath}:${lineNo}, ${proposal.operation} ${proposal.destination}.`);
  void vscode.window.showInformationMessage(
    `Press send in the chat and DeepTest will ask your assistant, then check the answer against the limits you agreed to. Nothing changes on disk until you apply it.${gate.checkpointNote}`,
  );
}

/** The untaken route, in the words the report already uses. */
function routeSentence(line: { route: { steps: Array<{ testsPast: number }>; reached: number } }): string {
  const stuck = line.route.steps[line.route.reached];
  return stuck ? `Nothing got past the decision before it.` : `Nothing reaches it.`;
}

/** The whole text of a workspace-relative file, or undefined. */
function wholeFile(folder: vscode.WorkspaceFolder, relativePath: string): string | undefined {
  try {
    return fs.readFileSync(path.join(folder.uri.fsPath, relativePath), 'utf8');
  } catch {
    return undefined;
  }
}

/**
 * The runner this project uses, for the packet.
 *
 * Taken from the detected settings rather than guessed, and falling back to
 * the configured one. It reaches the packet so a model is told which
 * framework's shapes to write, and nothing else depends on it: the test-path
 * derivation deliberately does not take a runner, because "is this source a
 * component" is a semantic judgement and no deterministic predicate for it
 * exists.
 */
function runnerOf(deps: DecisionDeps, folder: vscode.WorkspaceFolder): Runner {
  const settings = settingsFor(deps.config(), deps.state.run?.language ?? deps.config().language) as { runner?: string };
  return (settings.runner && settings.runner !== 'auto' ? settings.runner : detectRunner(folder.uri.fsPath)) as Runner;
}

/**
 * "Fix this" on a function that is harder to test than the limit. The
 * person picks which of the two honest answers they want, then the same
 * gates and hand-off as for a line. The decision is pinned to the line the
 * function starts on.
 */
export async function fixFunction(deps: DecisionDeps, relativePath: string, startLine: number): Promise<void> {
  if (!(await agenticGateOpen(deps, `${relativePath}:${startLine}`))) {
    return;
  }
  const folder = deps.folder();
  if (!folder) {
    return;
  }
  const file = deps.state.fileResult(relativePath);
  const fn = file?.functions.find((f) => f.startLine === startLine);
  const result = deps.state.result;
  const limit = result?.summary.thresholds.maxFunctionComplexity;
  if (!file || !fn || !result || limit === undefined) {
    void vscode.window.showErrorMessage('Check your code first, and then decide about its functions.');
    return;
  }
  const over = fn.complexity - limit;
  const untangler = untangleItInstalled();
  deps.output.appendLine(`UntangleIt (${UNTANGLEIT_EXTENSION_ID}) is ${untangler ? 'installed' : 'not installed'}.`);
  const pick = await vscode.window.showQuickPick<vscode.QuickPickItem & { mode: FunctionFixMode }>(
    [
      {
        label: 'Break it into smaller pieces',
        description: refactorChoiceDescription(fn.name, limit, untangler),
        mode: 'refactor',
      },
      {
        label: 'Test every way through it as it is',
        description: `Leave ${fn.name}() alone and write tests for each of its ${fn.complexity} ways through.`,
        mode: 'test',
      },
    ],
    {
      title: `${fn.name}() has ${fn.complexity} ways through it; your limit is ${limit}.`,
      placeHolder: 'What should the assistant do? This is your call.',
    },
  );
  if (!pick) {
    return;
  }
  if (functionFixRoute(pick.mode, untangler) === 'untangleit') {
    // UntangleIt runs its own gates (the KeepSafe offer, then its modal)
    // and keeps its own record of the run, so DeepTest records no decision
    // here: the person has not yet said yes to anything. DeepTest judges
    // the pieces on the next check like any other change.
    const outcome = await handToUntangleIt(relativePath, fn.startLine, (l) => deps.output.appendLine(l));
    if (outcome === 'sent') {
      void vscode.window.showInformationMessage(untangleSentSentence(fn.name));
    } else {
      void vscode.window.showWarningMessage(untangleFailedSentence(fn.name));
    }
    return;
  }
  // Two objectives under one name until Phase 5. "Write tests for every way
  // through it" and "break it into smaller pieces" are different work under
  // different constraints with different verification, so they are two
  // registered interactions and the pick chooses between them.
  const spec = requireInteraction(pick.mode === 'refactor' ? FUNCTION_PROPOSE_REFACTOR : FUNCTION_PROPOSE_TESTS);

  const gaps = file.lines.filter((l) => l.line >= fn.startLine && l.line <= fn.endLine && l.gap > 0);
  const proposal =
    pick.mode === 'refactor'
      ? refactorProposalPacket({
          source: relativePath,
          functionName: fn.name,
          startLine: fn.startLine,
          complexity: fn.complexity,
          limit,
          runner: runnerOf(deps, folder),
          read: (p) => wholeFile(folder, p),
        })
      : testProposalPacket({
          source: relativePath,
          // Every gap line that justifies the proposal, and the union of
          // their attributed test files must be exactly one destination.
          // Three lines resolving to three suites is three destinations, and
          // picking one would silently attach tests for the other two gaps to
          // a file that does not exercise them.
          gaps: gaps.map((l) => ({ path: relativePath, line: l.line, tests: l.tests, gap: l.gap, because: routeSentence(l) })),
          pairsForSource: attributedPairs([file]),
          pairsInProject: attributedPairs(result.files),
          runner: runnerOf(deps, folder),
          read: (p) => wholeFile(folder, p),
          exists: (p) => wholeFile(folder, p) !== undefined,
          functionName: fn.name,
        });

  if (!proposal.ok) {
    deps.output.appendLine(`No attempt for ${relativePath} ${fn.name}(). ${proposal.why}`);
    void vscode.window.showWarningMessage(proposal.why);
    return;
  }

  const gate = await offerUndoFirst(deps, `${relativePath}:${fn.name}()`);
  if (!gate.proceed) {
    return;
  }

  const authorization = await askToAuthorize(spec, proposal.packet, (l) => deps.output.appendLine(l));
  if (!authorization) {
    return;
  }

  const read = lineReader(folder);
  const behaviourGate = pick.mode === 'refactor' ? await recordBeforeHandOff(deps, folder, relativePath, fn.startLine) : 'not-applicable';
  const decisions = recordDecision(loadDecisions(folder), {
    path: relativePath,
    line: fn.startLine,
    lineHash: hashLine(read(relativePath, fn.startLine) ?? ''),
    kind: 'fix',
    reason: pick.mode === 'refactor' ? `refactor to at most ${limit} ways through` : 'tests for every way through',
    by: whoAmI(),
    at: new Date().toISOString(),
    gapAtDecision: over,
    scope: 'function',
    functionName: fn.name,
    behaviourGate,
    governedInteractionId: spec.id,
    anchor: proposal.anchor,
    ...(pick.mode === 'refactor' ? {} : { verificationTargets: gaps.map((l) => ({ path: relativePath, line: l.line, testsBefore: [...l.tests] })) }),
  });
  saveDecisions(folder, decisions);
  reload(deps, folder);

  setPendingAttempt({
    interactionId: spec.id,
    packet: proposal.packet,
    authorization,
    anchor: proposal.anchor,
    decision: { path: relativePath, line: fn.startLine },
  });
  await prefillChat(`@deeptest ${proposal.packet.headline}`);
  deps.output.appendLine(`Authorized ${spec.id} for ${relativePath} ${fn.name}().`);
  void vscode.window.showInformationMessage(
    `Press send in the chat and DeepTest will ask your assistant, then check the answer against the limits you agreed to. Nothing changes on disk until you apply it.${gate.checkpointNote}`,
  );
}

/**
 * Records what the function does, before the assistant is handed the work.
 *
 * The answer is the decision's `behaviourGate`, and it is written whatever
 * happens here. `'recorded'` means there is something to compare against
 * later. `'unavailable'` means there is not and never will be, which the
 * next measurement reports as unverified rather than quietly treating the
 * complexity number as the whole answer.
 *
 * Nothing in here can stop a hand-off. A person who asked for their code to
 * be worked on gets that, and what the gate could not do is said plainly
 * afterwards rather than held over them beforehand.
 */
async function recordBeforeHandOff(deps: DecisionDeps, folder: vscode.WorkspaceFolder, relativePath: string, startLine: number): Promise<'recorded' | 'unavailable'> {
  const root = folder.uri.fsPath;
  const config = deps.config();
  const plugin = pluginById(deps.state.run?.language ?? config.language);
  if (!plugin?.createBoundaryRecorder?.()) {
    deps.output.appendLine(`No behaviour recorder for this language, so DeepTest cannot check that ${relativePath}:${startLine} still does what it does. It will say so rather than call it fixed.`);
    return 'unavailable';
  }
  const boundary = await locateBoundary(root, relativePath, startLine);
  if (!boundary) {
    deps.output.appendLine(`DeepTest could not work out which method starts at ${relativePath}:${startLine}, so it has nothing to watch. It will say so rather than call it fixed.`);
    return 'unavailable';
  }
  const settings = settingsFor(config, plugin.id);
  const records = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `DeepTest is recording what ${boundary.name}() does now.` }, () =>
    // M12. The recorder classifies what stopped it, and until now DeepTest
    // dropped that answer on the floor. The packet is reused as given.
    recordBoundary(plugin, { workspaceRoot: root, settings, boundary, log: (l) => deps.output.appendLine(l), report: (packet) => reportProblem(deps, packet) }),
  );
  if (!records || records.length === 0) {
    deps.output.appendLine(`The tests never reached ${boundary.name}(), so there is nothing recorded to compare against. DeepTest will say so rather than call it fixed.`);
    return 'unavailable';
  }
  saveBefore(root, relativePath, startLine, boundary, records);
  deps.output.appendLine(`Recorded ${records.length} observation${records.length === 1 ? '' : 's'} of ${boundary.container ? `${boundary.container}.` : ''}${boundary.name} before the hand-off.`);
  return 'recorded';
}

export async function undoFunctionDecision(deps: DecisionDeps, relativePath: string, startLine: number): Promise<void> {
  const folder = deps.folder();
  if (!folder) {
    return;
  }
  saveDecisions(folder, removeDecision(loadDecisions(folder), relativePath, startLine, 'function'));
  // The kept recording belongs to the decision. Removing one removes the
  // other, so a later decision about the same function cannot be compared
  // against evidence nobody authorized it against.
  clearBefore(folder.uri.fsPath, relativePath, startLine);
  reload(deps, folder);
  deps.output.appendLine(`Function decision removed for ${relativePath}:${startLine}.`);
}

export async function acceptShortfall(deps: DecisionDeps, relativePath: string, lineNo: number): Promise<void> {
  const folder = deps.folder();
  if (!folder) {
    return;
  }
  const line = deps.state.fileResult(relativePath)?.lines.find((l) => l.line === lineNo);
  if (!line) {
    void vscode.window.showErrorMessage('Check your code first, and then decide about its lines.');
    return;
  }
  const reason = await vscode.window.showInputBox({
    title: `Accept ${path.basename(relativePath)} line ${lineNo} as it is`,
    prompt: 'Why is it acceptable for this line to keep fewer tests than it needs? Your name and the date will be recorded next to your answer.',
    placeHolder: 'For example: the nightly integration run exercises this path, and unit tests cannot reach it without a live device.',
    validateInput: (v) => (v.trim().length < 8 ? 'Please give a reason that someone else could read later.' : undefined),
  });
  if (!reason) {
    return;
  }
  const read = lineReader(folder);
  const decisions = recordDecision(loadDecisions(folder), {
    path: relativePath,
    line: lineNo,
    lineHash: hashLine(read(relativePath, lineNo) ?? ''),
    kind: 'accept',
    reason: reason.trim(),
    by: whoAmI(),
    at: new Date().toISOString(),
    gapAtDecision: line.gap,
  });
  saveDecisions(folder, decisions);
  reload(deps, folder);
  deps.output.appendLine(`Accepted ${relativePath}:${lineNo}: ${reason.trim()}`);
}

export async function undoDecision(deps: DecisionDeps, relativePath: string, lineNo: number): Promise<void> {
  const folder = deps.folder();
  if (!folder) {
    return;
  }
  saveDecisions(folder, removeDecision(loadDecisions(folder), relativePath, lineNo));
  reload(deps, folder);
  deps.output.appendLine(`Decision removed for ${relativePath}:${lineNo}.`);
}

/** The single entry point: Fix, Accept, or Leave. */
export async function decide(deps: DecisionDeps, relativePath: string, lineNo: number): Promise<void> {
  const line = deps.state.fileResult(relativePath)?.lines.find((l) => l.line === lineNo);
  if (!line) {
    void vscode.window.showErrorMessage('Check your code first, and then decide about its lines.');
    return;
  }
  const current = deps.state.decisionFor(relativePath, lineNo);
  const items: Array<vscode.QuickPickItem & { action: 'fix' | 'accept' | 'undo' | 'leave' }> = [
    { label: '$(tools) Fix this', description: 'Hand a precise brief to your assistant. DeepTest checks the result; it does not accept it for you.', action: 'fix' },
    { label: '$(check) Accept as it is', description: 'Record why this line may stay as it is, in your name.', action: 'accept' },
    { label: '$(clock) Leave for now', description: 'Decide later; the line stays in the list.', action: 'leave' },
  ];
  if (current.kind !== 'none') {
    items.push({ label: '$(discard) Remove the earlier decision', description: `Currently: ${current.kind}`, action: 'undo' });
  }
  const pick = await vscode.window.showQuickPick(items, {
    title: `${relativePath} line ${lineNo}: ${line.status === 'untested' ? 'never tested' : `${line.density} of the ${line.bar} tests it needs`}`,
    placeHolder: 'This is your call. DeepTest reports; you decide.',
  });
  switch (pick?.action) {
    case 'fix':
      await fixShortfall(deps, relativePath, lineNo);
      break;
    case 'accept':
      await acceptShortfall(deps, relativePath, lineNo);
      break;
    case 'undo':
      await undoDecision(deps, relativePath, lineNo);
      break;
    default:
      break;
  }
}

/**
 * Refreshes the panel's view of the decisions.
 *
 * **A store it cannot read leaves the panel exactly as it was.** Showing an
 * empty list would be the display half of the defect step 0 closed: the
 * person's decisions are on disk, we could not read them, and an empty list
 * says they are gone. Preserve and say so, rather than manufacture.
 */
export function loadDecisionsIntoState(deps: DecisionDeps): void {
  const folder = deps.folder();
  if (!folder) {
    return;
  }
  try {
    reload(deps, folder);
  } catch (err) {
    deps.output.appendLine(`${(err as Error).message} What is on screen is from the last time it could be read.`);
  }
}
