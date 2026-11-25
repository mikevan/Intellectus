/**
 * Orchestrates one run through the language contract: look the plugin up,
 * check its environment, discover tests, run them with per-test coverage,
 * parse structure for every measured file, join in the engine, publish.
 *
 * This file must never name a language. A grep for any plugin id here
 * returning anything is a bug.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { DeepTestConfig, settingsFor } from './config';
import { analyze } from './engine/density';
import { FileStructure } from './engine/types';
import { pluginById } from './languages/registry';
import { resolveGovernedVerifications, verifyBehaviour } from './decisions/verify';
import { runProcess } from './languages/shared/process';
import { runtimeEnvironment } from './languages/shared/runtime';
import { LanguagePlugin, LanguageSettings } from './languages/types';
import { ResultState } from './state';
import { workspaceRootOf } from './ui/paths';
import { evidenceProblemSentence, nothingToScoreSentence, testsRan } from './ui/words';
import { DiagnosedError } from './languages/typescript/coverage';
import { instrumentationFailure, unclassifiedGovernancePacket } from '@projectrevivesolutions/witness';
import type { GovernancePacket } from '@projectrevivesolutions/witness';

export interface RunnerDeps {
  extensionUri: vscode.Uri;
  output: vscode.OutputChannel;
  state: ResultState;
  /**
   * Where a governed packet from the behaviour gate's recorder goes (M12).
   *
   * Handed in rather than imported, because rule 40 keeps the measuring
   * product free of any dependency on the agent folder and `extension.ts`
   * is already the place that wires the two together. Optional, so the
   * runner still runs whole with nothing to report to.
   */
  report?: (packet: GovernancePacket) => void;
}

async function parseStructures(
  deps: RunnerDeps,
  plugin: LanguagePlugin,
  folder: vscode.WorkspaceFolder,
  files: string[],
  config: DeepTestConfig,
): Promise<FileStructure[]> {
  const source = await plugin.createStructureSource({ wasmDir: runtimeEnvironment().wasmDir });
  const out: FileStructure[] = [];
  try {
    for (const rel of files) {
      const abs = path.join(workspaceRootOf(folder), ...rel.split('/'));
      let text: string;
      try {
        text = fs.readFileSync(abs, 'utf8');
      } catch (err) {
        deps.output.appendLine(`Could not read ${rel}: ${(err as Error).message}`);
        continue;
      }
      try {
        out.push(source.analyze(rel, text, config.depth));
      } catch (err) {
        deps.output.appendLine(`Could not read the structure of ${rel}: ${(err as Error).message}`);
      }
    }
  } finally {
    source.dispose();
  }
  return out;
}

/**
 * The governed packet for a refusal at the environment gate.
 *
 * M5. **No runner is named**, because none was selected: the gate refuses
 * before a runner is chosen, so the packet carries no runner identity and
 * says the failure came first. The problems stay strings and are carried as
 * evidence exactly as they were written; nothing here types them, and no
 * class is guessed. `insufficient-evidence` / `unclassified` is the answer,
 * and it is the true one: an environment problem establishes that something
 * is missing or wrong in the setup, and not whose doing that is.
 */
function environmentRefusal(problems: readonly string[], summary: string): GovernancePacket {
  return unclassifiedGovernancePacket({
    evidence: [summary, ...problems],
    headline: 'DeepTest could not start the check, and the toolkit could not work out why.',
  });
}

export async function runAnalysis(deps: RunnerDeps, folder: vscode.WorkspaceFolder, config: DeepTestConfig, token: vscode.CancellationToken): Promise<void> {
  const { output, state } = deps;
  const log = (line: string): void => output.appendLine(line);
  const started = Date.now();
  const abort = new AbortController();
  token.onCancellationRequested(() => abort.abort());

  const plugin = pluginById(config.language);
  if (!plugin) {
    state.setError(`DeepTest cannot check ${config.language || 'this language'} yet. Press "Change the setup" to pick a language it can.`);
    return;
  }
  const settings: LanguageSettings = settingsFor(config, plugin.id);
  const workspaceRoot = workspaceRootOf(folder);

  output.appendLine(`\n=== DeepTest check: ${new Date().toISOString()} (${plugin.displayName}) ===`);
  state.setRunning();

  const coverage = plugin.createCoverageSource();
  const tests = await coverage.discoverTests({ workspaceRoot, settings });
  if (tests.length === 0) {
    const where = settings.testsPath ? `in the folder "${settings.testsPath}"` : 'in the whole project';
    state.setNoTests(where);
    log(`No unit tests found ${where}.`);
    return;
  }
  log(`Found ${tests.length} test file(s).`);

  const env = await coverage.checkEnvironment({ workspaceRoot, settings, log });
  log(env.summary);
  if (!env.ok) {
    for (const p of env.problems) {
      log(p);
    }
    if (env.fix) {
      const choice = await vscode.window.showWarningMessage(`DeepTest needs one more thing before it can check this project. ${env.problems.join(' ')}`, env.fix.title, 'Change the setup');
      if (choice === env.fix.title) {
        log(`$ ${env.fix.command} ${env.fix.args.join(' ')}`);
        const install = await runProcess(env.fix.command, env.fix.args, { cwd: workspaceRoot, log, signal: abort.signal });
        if (install.exitCode !== 0) {
          state.setError('The install did not finish. Press "Show the log" to see why.', environmentRefusal([...env.problems, `${env.fix.command} ${env.fix.args.join(' ')} ended with exit code ${install.exitCode}.`], env.summary));
          return;
        }
        const again = await coverage.checkEnvironment({ workspaceRoot, settings, log });
        if (!again.ok) {
          state.setError(again.problems.join(' '), environmentRefusal(again.problems, again.summary));
          return;
        }
      } else {
        if (choice === 'Change the setup') {
          void vscode.commands.executeCommand('deeptest.configure');
        }
        state.setError(env.problems.join(' '), environmentRefusal(env.problems, env.summary));
        return;
      }
    } else {
      state.setError(env.problems.join(' '), environmentRefusal(env.problems, env.summary));
      void vscode.window.showErrorMessage(`DeepTest cannot check this project yet. ${env.problems.join(' ')}`, 'Change the setup').then((c) => {
        if (c) {
          void vscode.commands.executeCommand('deeptest.configure');
        }
      });
      return;
    }
  }

  let run;
  try {
    run = await coverage.run({ workspaceRoot, settings, log, signal: abort.signal });
  } catch (err) {
    const message = (err as Error).message;
    log(message);
    // A failure the toolkit placed carries what it established, so the panel
    // can offer to have it explained rather than leaving the person with a
    // line and a log.
    state.setError(message, err instanceof DiagnosedError ? err.governed : undefined);
    return;
  }
  if (token.isCancellationRequested) {
    state.clear();
    return;
  }
  if (!testsRan(run.tests)) {
    const why = nothingToScoreSentence(run.tests);
    const counts = `${run.tests.passed} passed, ${run.tests.failed} failed, ${run.tests.errors} errors, ${run.tests.skipped} skipped, exit code ${run.tests.exitCode}`;
    log(`Refused to score: ${counts}. ${why}`);
    // M5. The tests did not run, and nothing here establishes whose doing
    // that was: `errors > 0` says a setup error happened and not whose, and
    // an all-skipped run is a choice rather than a fault. So the packet says
    // exactly that, in the one class that means no class was established.
    // It carries a packet rather than nothing so the person can still ask
    // about it, which is the difference between an unexplained refusal and
    // an unexplainable one.
    state.setError(why, unclassifiedGovernancePacket({ runner: run.runner, evidence: [counts, why], headline: `${run.runner} did not run your tests, and the toolkit could not work out why.` }));
    return;
  }
  // The tests ran. Now: did every one of them leave its evidence? A card
  // drawn from a run with a hole in its attribution is a wrong card, and a
  // wrong card is worse than none (1.0.14). The failure state is the one
  // architecture section 7 names, with the reason and the three controls.
  const hole = evidenceProblemSentence(run.evidence);
  if (hole) {
    log(`Refused to score: ${run.evidence.testsFinished} tests finished, ${run.evidence.testsRecorded} records, ${run.evidence.brokenBoundaries} broken boundaries. ${hole}`);
    // M6. Three of these holes are shapes Polyglot's own counts prove are
    // Polyglot's: nothing was instrumented, a boundary was broken, records
    // are missing against a count that reconciles. Those carry a governed
    // packet classified `polyglot`, so the panel can offer to have the
    // failure explained without anybody's code being accused. A hole that
    // does not meet any of those shapes carries the unclassified packet
    // instead: Polyglot could not line the counts up, so it cannot say whose
    // the gap is, and saying so is the honest answer (rule 94).
    // `instrumentationFailure` decides which; this site does not reimplement
    // the test, and it does not leave the fall-through silent.
    // The runner named here is `run.runner`, which is the one that ran, not
    // the one the person configured: a project left on `auto` has resolved to
    // something concrete by the time a run exists, and the packet says which.
    const counts = `${run.evidence.testsFinished} tests finished, ${run.evidence.testsRecorded} attribution records, ${run.evidence.recordsWithEvidence} of them carrying a file, ${run.evidence.filesWithHits} files with a line that ran, ${run.evidence.brokenBoundaries} with a broken test boundary`;
    const classified = instrumentationFailure({ runner: run.runner, evidence: run.evidence, sentence: hole });
    state.setError(hole, classified ?? unclassifiedGovernancePacket({ runner: run.runner, evidence: [counts, hole], headline: `The run under ${run.runner} left a hole in its evidence, and the toolkit could not work out whose.` }));
    return;
  }

  const structures = await parseStructures(deps, plugin, folder, run.measuredFiles, config);
  const result = analyze(run.coverages, structures, config.thresholds);
  const s = result.summary;
  log(
    `Result: ${run.tests.passed} passed, ${run.tests.failed} failed; coverage ${s.coveragePercent}%, density pass rate ${s.densityPassRate}%, average density ${s.averageDensity}, ${result.shortfalls.length} shortfalls, ${s.unreachableLines} unreachable.`,
  );
  // The behaviour gate's second half. A function handed to an assistant to
  // refactor is not fixed because its number came down; it is fixed when it
  // still does what it did. This watches the ones waiting on that answer and
  // writes the verdict onto their decisions, before the result is published,
  // so the sidebar and the report never show a "fixed" that has not been
  // confirmed.
  // M12: the gate's recorder can classify what stopped it, and that answer
  // is shown rather than dropped. The packet is the recorder's own.
  await verifyBehaviour({ output, folder, report: deps.report }, plugin, config, result, abort.signal);
  // Field 10, after the behaviour gate has written its answer, and behind
  // both refusals above: a run that did not score reaches neither.
  resolveGovernedVerifications({ output, folder }, result);
  state.setResults(result, {
    tests: run.tests,
    environment: env.summary,
    language: plugin.displayName,
    testsPath: settings.testsPath,
    finishedAt: new Date(),
    durationMs: Date.now() - started,
  });
}
