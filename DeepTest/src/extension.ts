import * as vscode from 'vscode';
import { DeepTestConfig, readConfig } from './config';
import { countLanguages } from './detect/language';
import { pluginById, pluginForExtension, pluginForLanguageId } from './languages/registry';
import { HostServices } from './languages/types';
import { setRuntimeEnvironment } from './languages/shared/runtime';
import { acceptShortfall, decide, fixFunction, fixShortfall, loadDecisionsIntoState, undoDecision, undoFunctionDecision } from './decisions/commands';
import { lineReader, loadDecisions, saveDecisions } from './decisions/store';
import { buildReport } from './report/report';
import { runAnalysis } from './runner';
import { ResultState } from './state';
import { ReportMessage, ReportPanel } from './ui/reportPanel';
import { keepSafeInstalled } from './keepsafe';
import { untangleItInstalled } from './untangleit';
import { ConfigDefaults, ConfigPanel } from './ui/configPanel';
import { OverlayManager } from './ui/decorations';
import { absoluteUri, workspaceRootOf } from './ui/paths';
import { SidebarMessage, SidebarView } from './ui/sidebarView';
import { StatusBar } from './ui/statusBar';
import { onAvailabilityChanged } from './agent/availability';
import { mayOfferAgentic } from './agent/mayOffer';
import { AGENT_KEYS } from './agent/killswitch';
import { registerInteractions } from './agent/interactions';
import { registerParticipant } from './agent/participant';
import { registerProposedContentProvider, showProposedChange } from './agent/diff';
import { lastPrefill, prefillChat } from './agent/prefill';
import { peekPendingAttempt } from './agent/attempt';
import { createDeepTestSyntax } from './agent/syntax';
import { nodeRepository, unclassifiedGovernancePacket } from '@projectrevivesolutions/witness';
import { reportProblem } from './agent/problems';
import { collectFindings, handleFor, packetForHandle, setAvailability } from './agent/findingOffers';
import { appendGovernanceRecord } from '@projectrevivesolutions/witness';
import { governanceDir } from './governance';
import { showGovernanceHistory } from './ui/governanceView';
import type { SyntaxPort } from '@projectrevivesolutions/witness';

let running: vscode.CancellationTokenSource | undefined;

function workspaceFolder(): vscode.WorkspaceFolder | undefined {
  const active = vscode.window.activeTextEditor?.document.uri;
  if (active) {
    const owner = vscode.workspace.getWorkspaceFolder(active);
    if (owner) {
      return owner;
    }
  }
  return vscode.workspace.workspaceFolders?.[0];
}

const host: HostServices = {
  get activeLanguageId(): string | undefined {
    return vscode.window.activeTextEditor?.document.languageId;
  },
  async extensionApi(extensionId: string): Promise<unknown> {
    const ext = vscode.extensions.getExtension(extensionId);
    if (!ext) {
      return undefined;
    }
    return ext.isActive ? ext.exports : ext.activate();
  },
};

/**
 * Pre-fills the configuration screen. The plugin is chosen from the saved
 * setting, else the active editor's language, else the language with the
 * most files in the workspace. The chosen plugin then detects everything
 * else it can.
 */
async function detectDefaults(folder: vscode.WorkspaceFolder, config: DeepTestConfig, languageId?: string): Promise<ConfigDefaults> {
  const detected = countLanguages(workspaceRootOf(folder));
  let id = languageId ?? config.language;
  if (!id) {
    const active = host.activeLanguageId ? pluginForLanguageId(host.activeLanguageId) : undefined;
    if (active) {
      id = active.id;
    }
  }
  if (!id) {
    for (const guess of detected) {
      const plugin = pluginForLanguageId(guess.language) ?? pluginForExtension(`.${guess.language}`);
      if (plugin) {
        id = plugin.id;
        break;
      }
    }
  }
  if (!id && detected.length > 0) {
    id = detected[0].language;
  }
  const plugin = pluginById(id);
  const detection = plugin ? await plugin.detect(workspaceRootOf(folder), host) : undefined;
  const detailedRoutes = vscode.workspace.getConfiguration('deeptest', folder).get<number>('report.detailedRoutes', 5);
  return { detected, languageId: id, detection, detailedRoutes, keepSafeInstalled: keepSafeInstalled(), untangleItInstalled: untangleItInstalled() };
}

/** Exposed for integration tests and for other extensions that want the numbers. */
export interface DeepTestApi {
  state: ResultState;
  run(): Promise<void>;
  /** The current report model, or undefined before the first run. */
  report(): ReturnType<typeof buildReport> | undefined;
  /**
   * The authorized attempt waiting for the person to press send, or
   * `undefined` when nothing is waiting. Reading it spends nothing. It returns
   * `undefined` once the participant has taken the attempt, which is how a
   * caller can tell a send happened.
   */
  waitingAttempt(): WaitingAttempt | undefined;
}

/**
 * The authorized attempt waiting for the person to press send: its
 * interaction, the decision it belongs to, and the invocation that was put in
 * their chat input. Identifiers and the visible invocation only.
 *
 * Deliberately not named "handOff". Phase 5 deleted a local function by that
 * name, the old ungoverned path that gave the assistant the brief, and the
 * release governance gate (row A) keeps it from returning. This observes the
 * governed path and hands nothing to anyone.
 */
export interface WaitingAttempt {
  readonly interactionId: string;
  readonly decision: { readonly path: string; readonly line: number };
  readonly query: string;
}

function waitingAttempt(): WaitingAttempt | undefined {
  const waiting = peekPendingAttempt();
  const query = lastPrefill();
  return waiting && query !== undefined ? { interactionId: waiting.interactionId, decision: waiting.decision, query } : undefined;
}

export function activate(context: vscode.ExtensionContext): DeepTestApi {
  setRuntimeEnvironment({
    wasmDir: vscode.Uri.joinPath(context.extensionUri, 'dist').fsPath,
  });
  const output = vscode.window.createOutputChannel('DeepTest');
  const state = new ResultState();
  let config = readConfig(workspaceFolder());
  const overlay = new OverlayManager(state, config);
  const statusBar = new StatusBar(state);

  const decisionDeps = { state, output, folder: workspaceFolder, config: () => config };
  /**
   * Offers the failure to the editor's assistant, through the governed path.
   *
   * It does not hand anything over. A chat participant cannot be invoked from
   * code, so the most this can do is put the invocation in the chat input and
   * let the person press send. That extra press is forced by the platform
   * rather than chosen by us, and it is also the moment their own model quota
   * starts being spent, which is a reasonable place for a deliberate press.
   *
   * What leaves here is a sentence, not a brief. The evidence stays in the
   * packet on `state`, and the participant reads it there when the person
   * sends. Nothing reaches the clipboard, and nothing is sent automatically.
   */
  const explainFailure = async (): Promise<void> => {
    if (!state.governedProblem) {
      return;
    }
    if (!(await mayOfferAgentic())) {
      // Rule 42: ambient absence is silent. The person asked for nothing and
      // nothing failed, so nothing is said, and the deterministic product is
      // exactly as it was. The switch reads the same way: one gate, one
      // meaning, whether the cause is no model or Polyglot's AI assistance
      // being turned off.
      output.appendLine('Polyglot AI assistance is unavailable, so there is nothing to ask. The check itself is unaffected.');
      return;
    }
    await prefillChat('@deeptest explain what stopped this run');
    output.appendLine('Put the question in the chat. Press send when you are ready; nothing is sent for you.');
  };

  /**
   * The one handler for every finding, in every condition.
   *
   * It receives a handle and nothing else. It does not recompute the
   * finding, does not choose the condition, does not choose a class, does
   * not build a packet, does not select a model, and does not send to one.
   * The packet it puts on the state is the packet the deterministic product
   * built when the results landed, and what leaves here is a sentence in the
   * chat input that the person presses send on themselves.
   *
   * An unknown handle does nothing at all. The offer it came from is gone,
   * which is what an unknown handle means, and inventing something to show
   * would be the interface asserting a finding.
   */
  const explainFinding = async (handle: string | undefined): Promise<void> => {
    const packet = handle ? packetForHandle(handle) : undefined;
    if (!packet) {
      return;
    }
    if (!(await mayOfferAgentic())) {
      // Rule 42 again, for the window between the panel drawing the button
      // and the person pressing it. Nothing is said, and the finding on
      // screen is exactly as it was.
      output.appendLine('Polyglot AI assistance is unavailable, so there is nothing to ask. The finding itself is unaffected.');
      return;
    }
    // The governed transport, the same one a failure uses: the packet goes
    // where the chat participant reads it, and the question goes into the
    // chat input unsent.
    state.noteProblem(packet);
    await prefillChat('@deeptest explain this finding');
    output.appendLine('Put the question in the chat. Press send when you are ready; nothing is sent for you.');
  };

  const onSidebarMessage = (msg: SidebarMessage): void => {
    const { path: p, line } = msg;
    switch (msg.type) {
      case 'run':
        void vscode.commands.executeCommand('deeptest.run');
        break;
      case 'configure':
        void vscode.commands.executeCommand('deeptest.configure');
        break;
      case 'report':
        void vscode.commands.executeCommand('deeptest.report');
        break;
      case 'output':
        output.show(true);
        break;
      case 'explain':
        void explainFailure();
        break;
      case 'explainFinding':
        void explainFinding(msg.handle);
        break;
      case 'toggleNumbers':
        void vscode.commands.executeCommand('deeptest.toggleNumbers');
        break;
      case 'toggleOverlay':
        state.toggleOverlay();
        break;
      case 'open':
        if (p && line) {
          void vscode.commands.executeCommand('deeptest.openLine', p, line);
        }
        break;
      case 'fix':
        if (p && line) {
          void fixShortfall(decisionDeps, p, line);
        }
        break;
      case 'accept':
        if (p && line) {
          void acceptShortfall(decisionDeps, p, line);
        }
        break;
      case 'undo':
        if (p && line) {
          void undoDecision(decisionDeps, p, line);
        }
        break;
      case 'fixFunction':
        if (p && line) {
          void fixFunction(decisionDeps, p, line);
        }
        break;
      case 'undoFunction':
        if (p && line) {
          void undoFunctionDecision(decisionDeps, p, line);
        }
        break;
      case 'decide':
        if (p && line) {
          void decide(decisionDeps, p, line);
        }
        break;
      default:
        break;
    }
  };
  /**
   * Every finding gets its packet the moment the results that produced it
   * land, and before anything draws them.
   *
   * Registered ahead of the panel's own listener, deliberately, so that by
   * the time the panel asks for a handle the offers behind them exist. The
   * deterministic product decides here what is a finding; the panel only
   * asks whether there is an offer for something it is already drawing.
   */
  context.subscriptions.push(state.onDidChange(() => collectFindings(state.result, state.decidedFunctions)));
  const sidebar = new SidebarView(
    context.extensionUri,
    state,
    () => ({ showNumbers: config.showNumbers }),
    () => {
      const folder = workspaceFolder();
      return folder ? lineReader(folder) : () => undefined;
    },
    onSidebarMessage,
    handleFor,
    String((context.extension.packageJSON as { version?: string }).version ?? ''),
  );
  loadDecisionsIntoState(decisionDeps);
  state.fire();

  const reportModel = () => {
    const folder = workspaceFolder();
    if (!folder || !state.result || !state.run) {
      return undefined;
    }
    return buildReport({
      result: state.result,
      decided: state.decided,
      decidedFunctions: state.decidedFunctions,
      run: state.run,
      readLine: lineReader(folder),
      detailCount: Math.max(1, vscode.workspace.getConfiguration('deeptest', folder).get<number>('report.detailedRoutes', 5)),
    });
  };

  const onReportMessage = (msg: ReportMessage): void => {
    const { path: p, line } = msg;
    switch (msg.type) {
      case 'open':
        if (p && line) {
          void vscode.commands.executeCommand('deeptest.openLine', p, line);
        }
        break;
      case 'fix':
        if (p && line) {
          void fixShortfall(decisionDeps, p, line);
        }
        break;
      case 'accept':
        if (p && line) {
          void acceptShortfall(decisionDeps, p, line);
        }
        break;
      case 'undo':
        if (p && line) {
          void undoDecision(decisionDeps, p, line);
        }
        break;
      case 'fixFunction':
        if (p && line) {
          void fixFunction(decisionDeps, p, line);
        }
        break;
      case 'undoFunction':
        if (p && line) {
          void undoFunctionDecision(decisionDeps, p, line);
        }
        break;
      case 'decide':
        if (p && line) {
          void decide(decisionDeps, p, line);
        }
        break;
      case 'run':
        void vscode.commands.executeCommand('deeptest.run');
        break;
      default:
        break;
    }
  };

  const openReport = (): void => {
    const model = reportModel();
    if (!model) {
      void vscode.window.showInformationMessage('Check your code first, and then the report will have something to say.', 'Check my code').then((c) => {
        if (c) {
          void vscode.commands.executeCommand('deeptest.run');
        }
      });
      return;
    }
    ReportPanel.show(context.extensionUri, model, onReportMessage);
  };

  // Keep an open report current as results and decisions change.
  context.subscriptions.push(
    state.onDidChange(() => {
      if (ReportPanel.isOpen) {
        const model = reportModel();
        if (model) {
          ReportPanel.update(model);
        }
      }
    }),
  );

  const openConfig = async (): Promise<void> => {
    const folder = workspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('DeepTest needs an open folder to check.');
      return;
    }
    config = readConfig(folder);
    const defaults = await detectDefaults(folder, config);
    ConfigPanel.show(
      context.extensionUri,
      config,
      defaults,
      (run) => {
        config = readConfig(folder);
        overlay.updateConfig(config);
        if (run) {
          void vscode.commands.executeCommand('deeptest.run');
        }
      },
      (languageId) => detectDefaults(folder, readConfig(folder), languageId),
    );
  };

  const run = async (): Promise<void> => {
    const folder = workspaceFolder();
    if (!folder) {
      void vscode.window.showErrorMessage('DeepTest needs an open folder to check.');
      return;
    }
    config = readConfig(folder);
    overlay.updateConfig(config);

    if (!config.language) {
      // First run: show the configuration screen, pre-filled from what the
      // workspace looks like. "Save and run tests" comes back through here.
      await openConfig();
      return;
    }

    if (running) {
      running.cancel();
    }
    running = new vscode.CancellationTokenSource();
    const token = running.token;
    loadDecisionsIntoState(decisionDeps);
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: 'DeepTest: checking your code', cancellable: true },
      async (_progress, progressToken) => {
        progressToken.onCancellationRequested(() => running?.cancel());
        try {
          await runAnalysis({ extensionUri: context.extensionUri, output, state, report: (packet) => reportProblem({ output, state }, packet) }, folder, config, token);
        } catch (err) {
          const message = (err as Error).message ?? String(err);
          output.appendLine(`The check did not finish: ${message}`);
          // M5. The last catch. Whatever got here escaped every gate that
          // knows what it is looking at, so the thrown message is the whole
          // of the evidence and it establishes nothing about a cause. No
          // runner is named: this catch wraps the whole check, including the
          // part that runs before a runner is selected, so there is no
          // runner it could honestly claim. The packet says that, and the
          // person can ask about the failure instead of reading a log line.
          state.setError(message, unclassifiedGovernancePacket({ evidence: [message], headline: 'The check did not finish, and the toolkit could not work out why.' }));
        }
      },
    );
    if (state.phase === 'noTests') {
      void vscode.window.showInformationMessage(`DeepTest could not find any tests ${state.message}.`, 'Tell me where the tests are').then((c) => {
        if (c) {
          void openConfig();
        }
      });
    }
  };

  // The governed agent. Registered before anything can reach it, so an
  // interaction id in code always has a registry entry behind it.
  registerInteractions();

  /**
   * The parser the governed validators need, built once and used
   * synchronously.
   *
   * Loading a grammar is asynchronous and a validator is not, so the async
   * work happens here rather than inside the governed sequence. It is
   * deliberately allowed to be absent: rule 94's gate refuses a proposal
   * before the model when it is, which costs the person nothing, whereas
   * asking for a proposal nobody could have checked costs them a request
   * against their own quota.
   */
  let governedSyntax: SyntaxPort | undefined;
  void createDeepTestSyntax(vscode.Uri.joinPath(context.extensionUri, 'dist').fsPath)
    .then((port) => {
      governedSyntax = port;
    })
    .catch((err: unknown) => {
      output.appendLine(`No parser for the governed validators: ${err instanceof Error ? err.message : String(err)}. Proposals that would change an existing test file will be refused before anything is sent.`);
    });

  context.subscriptions.push(
    output,
    state,
    registerParticipant({
      currentProblem: () => state.governedProblem,
      repository: () => {
        const folder = workspaceFolder();
        return folder ? nodeRepository(folder.uri.fsPath) : undefined;
      },
      syntax: () => governedSyntax,
      // The attempt's identity exists only once the capability is issued, so
      // this is how it reaches the product's own record of the same attempt.
      // It throws rather than returning quietly: Witness fails the
      // interaction closed on a throw, before the model request, and an
      // attempt whose record does not exist is an attempt no later
      // measurement can be attached to.
      recordAttempt: (decision, attempt, anchor) => {
        const folder = workspaceFolder();
        if (!folder) {
          throw new Error('There is no workspace folder open, so DeepTest has nowhere to record this attempt.');
        }
        const file = loadDecisions(folder);
        const held = file.decisions.find((d) => d.path === decision.path && d.line === decision.line);
        if (!held) {
          throw new Error(`DeepTest has no decision at ${decision.path}:${decision.line} to record this attempt against.`);
        }
        held.attemptId = attempt.attemptId;
        held.governedInteractionId = attempt.interactionId;
        held.anchor = anchor;
        saveDecisions(folder, file);
      },
      // The governance record, made durable before Witness shows anything
      // the model produced. It throws on failure and Witness renders nothing
      // when it does, which is the durability invariant: a governed result is
      // not presented as governed until its record exists.
      persist: (record) => {
        const folder = workspaceFolder();
        if (!folder) {
          throw new Error('There is no workspace folder open, so there is nowhere to write the Governance History.');
        }
        appendGovernanceRecord(governanceDir(folder), record);
      },
      log: (l) => output.appendLine(l),
    }),
    registerProposedContentProvider(),
    vscode.commands.registerCommand('deeptest.showProposedChange', (handle: string) => showProposedChange(handle)),
    vscode.commands.registerCommand('deeptest.governance', () => showGovernanceHistory(workspaceFolder(), (l) => output.appendLine(l))),
    overlay,
    sidebar,
    statusBar,
    vscode.window.registerWebviewViewProvider(SidebarView.viewId, sidebar, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('deeptest.toggleNumbers', async () => {
      const folder = workspaceFolder();
      const current = vscode.workspace.getConfiguration('deeptest', folder).get<boolean>('showNumbers', false);
      await vscode.workspace.getConfiguration('deeptest', folder).update('showNumbers', !current, vscode.ConfigurationTarget.Global);
    }),
    vscode.commands.registerCommand('deeptest.run', run),
    vscode.commands.registerCommand('deeptest.configure', openConfig),
    vscode.commands.registerCommand('deeptest.clear', () => state.clear()),
    vscode.commands.registerCommand('deeptest.toggleOverlay', () => state.toggleOverlay()),
    vscode.commands.registerCommand('deeptest.showOutput', () => output.show(true)),
    vscode.commands.registerCommand('deeptest.report', openReport),
    vscode.commands.registerCommand('deeptest.decide', (p?: string | { path: string; line: number }, line?: number) => {
      const target = typeof p === 'object' ? p : p && line ? { path: p, line } : undefined;
      if (target) {
        void decide(decisionDeps, target.path, target.line);
      }
    }),
    vscode.commands.registerCommand('deeptest.fix', (node?: { path: string; line: number }) => node && fixShortfall(decisionDeps, node.path, node.line)),
    vscode.commands.registerCommand('deeptest.fixFunction', (node?: { path: string; line: number }) => node && fixFunction(decisionDeps, node.path, node.line)),
    vscode.commands.registerCommand('deeptest.undoFunctionDecision', (node?: { path: string; line: number }) => node && undoFunctionDecision(decisionDeps, node.path, node.line)),
    vscode.commands.registerCommand('deeptest.accept', (node?: { path: string; line: number }) => node && acceptShortfall(decisionDeps, node.path, node.line)),
    vscode.commands.registerCommand('deeptest.undoDecision', (node?: { path: string; line: number }) => node && undoDecision(decisionDeps, node.path, node.line)),
    vscode.commands.registerCommand('deeptest.openLine', async (relativePath: string, line: number) => {
      const folder = workspaceFolder();
      if (!folder) {
        return;
      }
      const doc = await vscode.workspace.openTextDocument(absoluteUri(folder, relativePath));
      const editor = await vscode.window.showTextDocument(doc, { preserveFocus: false });
      const pos = new vscode.Position(Math.max(0, line - 1), 0);
      editor.selection = new vscode.Selection(pos, pos);
      editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('deeptest')) {
        config = readConfig(workspaceFolder());
        overlay.updateConfig(config);
        sidebar.render();
      }
      // The kill switch. Either product's setting changes the effective
      // state, so both keys are watched, and the offers are re-asked rather
      // than the panel merely redrawn: what changed is whether there is
      // anything to offer.
      if (AGENT_KEYS.some((key) => e.affectsConfiguration(key))) {
        void refreshOffers();
      }
    }),
  );

  // Whether Polyglot may offer anything at all. Asked once at activation and
  // re-asked when the editor says it may have changed, because the panel
  // draws synchronously and this answer does not arrive that way. With no
  // model the offers disappear and every finding stays exactly as it was
  // (rule 42).
  const refreshOffers = async (): Promise<void> => {
    setAvailability(await mayOfferAgentic());
    sidebar.render();
  };
  void refreshOffers();
  context.subscriptions.push(onAvailabilityChanged(() => void refreshOffers()));

  return { state, run, report: reportModel, waitingAttempt };
}

export function deactivate(): void {
  running?.cancel();
}
