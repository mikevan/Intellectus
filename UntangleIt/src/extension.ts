/**
 * Activation and orchestration. Everything the person can press lands here
 * and is routed to the measurer, the loop, or a screen. Nothing in this file
 * names a language or a sibling tool; those live behind the registry and
 * the sibling files.
 */
import * as vscode from 'vscode';
import { UntangleItConfig, readConfig } from './config';
import { deepTestInstalled } from './deeptest';
import { LanguageGuess, countLanguages } from './detect/language';
import { keepSafeInstalled } from './keepsafe';
import { pluginById, pluginForFile } from './languages/registry';
import { setRuntimeEnvironment } from './languages/shared/runtime';
import { HostServices, LanguagePlugin } from './languages/types';
import { LoopDeps, measureAgain, untangle, untangleWorst } from './loop';
import { measureFile, measureFiles, sourceFilesFor } from './measure';
import { absoluteUri, workspaceRootOf } from './paths';
import { loadRuns, saveRuns } from './runs';
import { ResultState } from './state';
import { currentProblem, setCurrentProblem } from './agent/current';
import { collectFindings, handleForRun, packetForHandle, setAvailability } from './agent/findingOffers';
import { onAvailabilityChanged } from './agent/availability';
import { mayOfferAgentic } from './agent/mayOffer';
import { AGENT_KEYS } from './agent/killswitch';
import { lastPrefill, prefillChat } from './agent/prefill';
import { peekPendingAttempt } from './agent/attempt';
import { appendGovernanceRecord, createTypeScriptSyntax, nodeRepository } from '@projectrevivesolutions/witness';
import { governanceDir } from './governance';
import { showGovernanceHistory } from './ui/governanceView';
import type { SyntaxPort } from '@projectrevivesolutions/witness';
import { registerInteractions } from './agent/interactions';
import { registerParticipant } from './agent/participant';
import { registerProposedContentProvider, showProposedChange } from './agent/diff';
import { ConfigDefaults, ConfigPanel } from './ui/configPanel';
import { SidebarMessage, SidebarView } from './ui/sidebarView';

/**
 * The authorized attempt waiting for the person to press send: its
 * interaction, the run it belongs to, and the invocation that was put in their
 * chat input. Identifiers and the visible invocation only.
 *
 * Deliberately not named "handOff". Phase 5 deleted a local function by that
 * name, the old ungoverned path that gave the assistant the brief, and the
 * release governance gate (row A) keeps it from returning. This observes the
 * governed path and hands nothing to anyone.
 */
export interface WaitingAttempt {
  readonly interactionId: string;
  readonly runId: string;
  readonly query: string;
}

export interface UntangleItApi {
  state: ResultState;
  run(): Promise<void>;
  /**
   * The waiting attempt, or `undefined` when nothing is waiting. Reading it
   * spends nothing. It returns `undefined` once the participant has taken the
   * attempt, which is how a caller can tell a send happened.
   */
  waitingAttempt(): WaitingAttempt | undefined;
}

function waitingAttempt(): WaitingAttempt | undefined {
  const waiting = peekPendingAttempt();
  const query = lastPrefill();
  return waiting && query !== undefined ? { interactionId: waiting.interactionId, runId: waiting.runId, query } : undefined;
}

function workspaceFolder(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}

function host(): HostServices {
  return {
    activeLanguageId: vscode.window.activeTextEditor?.document.languageId,
    async extensionApi(extensionId: string): Promise<unknown> {
      const ext = vscode.extensions.getExtension(extensionId);
      if (!ext) {
        return undefined;
      }
      return ext.isActive ? ext.exports : ext.activate();
    },
  };
}

function choosePlugin(config: UntangleItConfig, detected: LanguageGuess[]): LanguagePlugin | undefined {
  if (config.language) {
    return pluginById(config.language);
  }
  for (const guess of detected) {
    const plugin = pluginById(guess.language);
    if (plugin) {
      return plugin;
    }
  }
  return undefined;
}

export function activate(context: vscode.ExtensionContext): UntangleItApi {
  setRuntimeEnvironment({ wasmDir: vscode.Uri.joinPath(context.extensionUri, 'dist').fsPath });
  const output = vscode.window.createOutputChannel('UntangleIt');
  const state = new ResultState();
  let config = readConfig(workspaceFolder());
  const version = String((context.extension.packageJSON as { version?: string }).version ?? '');

  const currentPlugin = (): LanguagePlugin | undefined => {
    const folder = workspaceFolder();
    if (!folder) {
      return undefined;
    }
    return choosePlugin(config, countLanguages(workspaceRootOf(folder)));
  };

  const deps: LoopDeps = {
    state,
    output,
    workspaceRoot: () => {
      const folder = workspaceFolder();
      return folder ? workspaceRootOf(folder) : undefined;
    },
    plugin: currentPlugin,
    config: () => config,
  };

  async function detectDefaults(folder: vscode.WorkspaceFolder, languageId?: string): Promise<ConfigDefaults> {
    const root = workspaceRootOf(folder);
    const detected = countLanguages(root);
    const plugin = languageId ? pluginById(languageId) : choosePlugin(config, detected);
    const id = plugin?.id ?? languageId ?? config.language ?? detected[0]?.language ?? '';
    const detection = plugin ? await plugin.detect(root, host()) : undefined;
    return { detected, languageId: id, detection, keepSafeInstalled: keepSafeInstalled(), deepTestInstalled: deepTestInstalled() };
  }

  async function run(): Promise<void> {
    const folder = workspaceFolder();
    if (!folder) {
      void vscode.window.showInformationMessage('UntangleIt needs an open folder to measure. Open your project folder first.');
      return;
    }
    config = readConfig(folder);
    const root = workspaceRootOf(folder);
    const plugin = currentPlugin();
    if (!plugin) {
      state.setError(`UntangleIt cannot measure ${config.language || 'this language'} yet. Press "Change the setup" to pick a language it can.`);
      return;
    }
    if (!config.language && !config.testsPath && !config.sourceRoot) {
      // First contact: the setup screen, pre-filled, so the person sees what will happen.
      await openConfig();
      return;
    }
    const started = Date.now();
    output.appendLine(`\n=== UntangleIt measure: ${new Date().toISOString()} (${plugin.displayName}, limit ${config.limit}) ===`);
    state.setRunning();
    try {
      const files = sourceFilesFor(plugin, config, root);
      if (files.length === 0) {
        state.setNoCode(`UntangleIt looked ${config.sourceRoot ? `in the folder "${config.sourceRoot}"` : 'in the whole project'} for ${plugin.displayName} files and found none.`);
        return;
      }
      const result = await measureFiles(plugin, root, files, config.limit, (l) => output.appendLine(l));
      try {
        state.setRuns(loadRuns(root, (l) => output.appendLine(l)));
      } catch (err) {
        // A store it cannot read leaves the panel as it was. An empty list
        // would say the person's untanglings are gone; they are on disk.
        output.appendLine(`${(err as Error).message} What is on screen is from the last time it could be read.`);
      }
      state.setResults(result.measure, { language: plugin.displayName, finishedAt: new Date(), durationMs: Date.now() - started });
      output.appendLine(`Measured ${result.measure.methods.length} methods in ${result.measure.files} files; ${result.measure.tangled.length} over the limit of ${config.limit}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      output.appendLine(`Measuring failed: ${message}`);
      state.setError(`${message} Press "Show the log" to see what happened.`);
    }
  }

  async function openConfig(languageId?: string): Promise<void> {
    const folder = workspaceFolder();
    if (!folder) {
      void vscode.window.showInformationMessage('UntangleIt needs an open folder to set up. Open your project folder first.');
      return;
    }
    config = readConfig(folder);
    const defaults = await detectDefaults(folder, languageId);
    ConfigPanel.show(
      context.extensionUri,
      config,
      defaults,
      (runAfter) => {
        config = readConfig(folder);
        if (runAfter) {
          void run();
        }
      },
      (id) => detectDefaults(folder, id),
    );
  }

  /**
   * The one handler for every finding UntangleIt can produce.
   *
   * It receives a handle and nothing else. It does not recompute the
   * finding, does not choose the condition, does not choose a class, does
   * not build a packet, does not select a model, and does not send to one.
   * The packet it makes current is the one built when the gate's verdict was
   * recorded, and what leaves here is a sentence in the chat input the
   * person presses send on themselves.
   *
   * An unknown handle does nothing. The offer it came from is gone, which is
   * what an unknown handle means, and showing something anyway would be the
   * interface asserting a finding.
   */
  const explainFinding = async (handle: string | undefined): Promise<void> => {
    const packet = handle ? packetForHandle(handle) : undefined;
    if (!packet) {
      return;
    }
    if (!(await mayOfferAgentic())) {
      // Rule 42, for the window between the panel drawing the button and the
      // person pressing it. Nothing is said, and the finding is unchanged.
      output.appendLine('Polyglot AI assistance is unavailable, so there is nothing to ask. The finding itself is unaffected.');
      return;
    }
    setCurrentProblem(packet);
    await prefillChat('@untangleit explain this finding');
    output.appendLine('Put the question in the chat. Press send when you are ready; nothing is sent for you.');
  };

  const onSidebarMessage = (msg: SidebarMessage): void => {
    switch (msg.type) {
      case 'run':
        void run();
        break;
      case 'configure':
        void openConfig();
        break;
      case 'output':
        output.show(true);
        break;
      case 'toggleNumbers':
        void vscode.workspace.getConfiguration('untangleit', workspaceFolder()).update('showNumbers', !config.showNumbers, vscode.ConfigurationTarget.Workspace).then(() => {
          config = readConfig(workspaceFolder());
          state.fire();
        });
        break;
      case 'open':
        if (msg.path && msg.line) {
          void openLine(msg.path, msg.line);
        }
        break;
      case 'untangle':
        if (msg.path && msg.line) {
          void untangle(deps, msg.path, msg.line);
        }
        break;
      case 'measureAgain':
        if (msg.path && msg.name) {
          void measureAgain(deps, msg.path, msg.name);
        }
        break;
      case 'explainFinding':
        void explainFinding(msg.handle);
        break;
      default:
        break;
    }
  };

  async function openLine(relativePath: string, line: number): Promise<void> {
    const folder = workspaceFolder();
    if (!folder) {
      return;
    }
    const doc = await vscode.workspace.openTextDocument(absoluteUri(folder, relativePath));
    const editor = await vscode.window.showTextDocument(doc, { preview: false });
    const pos = new vscode.Position(Math.max(0, line - 1), 0);
    editor.selection = new vscode.Selection(pos, pos);
    editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
  }

  // Every run's finding gets its packet the moment the runs that produced
  // it land, and before anything draws them. Registered ahead of the panel's
  // own listener, so that by the time the panel asks for a handle the offers
  // behind them exist.
  context.subscriptions.push(state.onDidChange(() => collectFindings(state.runs)));
  const sidebar = new SidebarView(context.extensionUri, state, () => ({ showNumbers: config.showNumbers }), onSidebarMessage, handleForRun, version);
  const folder = workspaceFolder();
  if (folder) {
    try {
      state.setRuns(loadRuns(workspaceRootOf(folder), (l) => output.appendLine(l)));
    } catch (err) {
      output.appendLine(`${(err as Error).message} What is on screen is from the last time it could be read.`);
    }
  }

  // The governed agent. Registered before anything can reach it.
  registerInteractions();

  /**
   * The parser `V-public-contract` needs, built once and used synchronously.
   *
   * Loading a grammar is asynchronous and a validator is not, so the async
   * work happens here rather than inside the governed sequence. It is allowed
   * to be absent: rule 94's gate refuses the attempt before the model when it
   * is, which costs the person nothing, whereas asking for a proposal nobody
   * could have checked costs them a request against their own quota.
   *
   * `testStructures` is on the same port and UntangleIt never reaches it:
   * this product proposes source changes and never test changes, so C1 is
   * decided on the path alone, exactly as before.
   */
  let governedSyntax: SyntaxPort | undefined;
  void createTypeScriptSyntax(vscode.Uri.joinPath(context.extensionUri, 'dist').fsPath)
    .then((port) => {
      governedSyntax = port;
    })
    .catch((err: unknown) => {
      output.appendLine(`No parser for the governed validators: ${err instanceof Error ? err.message : String(err)}. Untangle attempts will be refused before anything is sent.`);
    });

  context.subscriptions.push(
    output,
    state,
    sidebar,
    vscode.window.registerWebviewViewProvider('untangleit.sidebar', sidebar),
    vscode.commands.registerCommand('untangleit.run', run),
    vscode.commands.registerCommand('untangleit.configure', () => openConfig()),
    vscode.commands.registerCommand('untangleit.showOutput', () => output.show(true)),
    registerParticipant({
      currentProblem,
      repository: () => {
        const folder = workspaceFolder();
        return folder ? nodeRepository(workspaceRootOf(folder)) : undefined;
      },
      // UntangleIt proposes source changes and never test changes, so C1 is
      // decided on the path alone and needs no parser. C2 does need one, and
      // this is it.
      syntax: () => governedSyntax,
      // It throws rather than returning quietly: Witness fails the
      // interaction closed on a throw, before the model request, and an
      // attempt whose record does not exist is an attempt no later
      // measurement can be attached to.
      // The governance record, made durable before Witness shows anything the
      // model produced. Witness renders nothing when this throws, which is
      // the durability invariant: a governed result is not presented as
      // governed until its record exists.
      persist: (record) => {
        const folder = workspaceFolder();
        if (!folder) {
          throw new Error('There is no workspace folder open, so there is nowhere to write the Governance History.');
        }
        appendGovernanceRecord(governanceDir(workspaceRootOf(folder)), record);
      },
      recordAttempt: (runId, attempt, anchor) => {
        const folder = workspaceFolder();
        if (!folder) {
          throw new Error('There is no workspace folder open, so UntangleIt has nowhere to record this attempt.');
        }
        const root = workspaceRootOf(folder);
        const runs = loadRuns(root);
        const held = runs.runs.find((r) => r.id === runId);
        if (!held) {
          throw new Error(`UntangleIt has no run ${runId} to record this attempt against.`);
        }
        held.attemptId = attempt.attemptId;
        held.governedInteractionId = attempt.interactionId;
        held.anchor = anchor;
        saveRuns(root, runs);
      },
      log: (l) => output.appendLine(l),
    }),
    registerProposedContentProvider(),
    vscode.commands.registerCommand('untangleit.showProposedChange', (handle: string) => showProposedChange(handle)),
    vscode.commands.registerCommand('untangleit.governance', () => {
      const folder = workspaceFolder();
      showGovernanceHistory(folder ? workspaceRootOf(folder) : undefined, (l) => output.appendLine(l));
    }),
    vscode.commands.registerCommand('untangleit.worst', () => untangleWorst(deps)),
    vscode.commands.registerCommand('untangleit.method', async (args?: { path: string; startLine?: number; line?: number }) => {
      if (!args?.path) {
        return;
      }
      if (state.phase !== 'results') {
        await run();
      }
      await untangle(deps, args.path, args.startLine ?? args.line ?? 0);
    }),
    vscode.commands.registerCommand('untangleit.measureAgain', (args?: { path: string; name: string }) => args && measureAgain(deps, args.path, args.name)),
    // Silent command for sibling tools: measure one file, no screens, one envelope.
    vscode.commands.registerCommand('untangleit.api.measure', async (args?: { path?: string }) => {
      const envelope = (ok: boolean, body: Record<string, unknown>) => ({ protocol: 1, tool: 'untangleit', version, ok, ...body });
      const folder = workspaceFolder();
      if (!folder || !args?.path) {
        return envelope(false, { error: 'UntangleIt needs an open folder and a file path to measure.' });
      }
      const plugin = pluginForFile(args.path) ?? currentPlugin();
      if (!plugin) {
        return envelope(false, { error: `UntangleIt cannot measure ${args.path} yet.` });
      }
      try {
        const methods = await measureFile(plugin, workspaceRootOf(folder), args.path, (l) => output.appendLine(l));
        const limit = readConfig(folder).limit;
        return envelope(true, { result: { path: args.path, limit, methods: methods.map((m) => ({ name: m.name, startLine: m.startLine, endLine: m.endLine, waysThrough: m.complexity, cyclomatic: m.complexity, campbell: m.campbell, mbcc: m.mbcc, over: Math.max(0, m.mbcc - limit) })) } });
      } catch (err) {
        return envelope(false, { error: `UntangleIt could not measure ${args.path}: ${err instanceof Error ? err.message : String(err)}` });
      }
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('untangleit')) {
        config = readConfig(workspaceFolder());
        state.fire();
      }
      // The kill switch. Either product's setting changes the effective
      // state, so both keys are watched, and the offers are re-asked rather
      // than the panel merely redrawn: what changed is whether there is
      // anything to offer.
      if (AGENT_KEYS.some((key) => e.affectsConfiguration(key))) {
        void refreshOffers();
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(() => state.fire()),
  );

  // Whether Polyglot may offer anything at all. Asked once at activation and
  // re-asked when the editor says it may have changed, because the panel
  // draws synchronously and this answer does not arrive that way. With no
  // model the offers disappear and every run reads exactly as it did
  // (rule 42).
  const refreshOffers = async (): Promise<void> => {
    setAvailability(await mayOfferAgentic());
    sidebar.render();
  };
  void refreshOffers();
  context.subscriptions.push(onAvailabilityChanged(() => void refreshOffers()));

  state.fire();
  return { state, run, waitingAttempt };
}

export function deactivate(): void {
  // Nothing to release beyond the subscriptions.
}
