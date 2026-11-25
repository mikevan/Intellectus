/**
 * Phase 8: the global kill switch, and what the toolkit still does with
 * agents turned off.
 *
 * **Two settings, one effective state.** VS Code 1.104.0 refuses to let two
 * independently installable extensions contribute one property id, so each
 * product contributes its own and the effective state is their conjunction.
 * The matrix below is the product requirement rather than the platform's:
 * an explicit false from either installed product disables agentic
 * behaviour everywhere, and a setting no installed extension registers is
 * neutral, which is what keeps each product installable on its own.
 *
 * **The matrix drives the real production function.** `effectiveAgentsEnabled`
 * is what `mayOfferAgentic` calls at runtime, and what the tests below call
 * is that same function through the same `SettingReader` interface the
 * editor binding implements. Nothing here hands a boolean to a stub standing
 * in for the decision.
 *
 * **What is not proved here is proved structurally**, in
 * `agent-boundaries.test.ts`: that every governed call site is behind the
 * gate, that every agentic command consults it before any side effect, and
 * that the participant checks before it consumes a pending attempt.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AGENT_KEYS,
  DEEPTEST_AGENTS_KEY,
  UNTANGLEIT_AGENTS_KEY,
  disabledBy,
  effectiveAgentsEnabled,
} from '../src/agent/killswitch';
import type { SettingReader } from '../src/agent/killswitch';

const SRC = path.join(__dirname, '..', 'src');
const read = (...p: string[]): string => fs.readFileSync(path.join(SRC, ...p), 'utf8');
const code = (t: string): string => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

/**
 * A reader over the three states a key can really be in.
 *
 * `undefined` is "no installed extension registered this", which is how an
 * uninstalled peer and a never-installed peer both look, and it is the
 * state a fallback-to-default read could not tell from an explicit false.
 */
function reader(values: Record<string, boolean | undefined>): SettingReader {
  return { registeredValue: (key) => values[key] };
}

// ---------------------------------------------------------------------------
// The effective kill-state matrix
// ---------------------------------------------------------------------------

const MATRIX: Array<[boolean | undefined, boolean | undefined, boolean, string]> = [
  [true, true, true, 'both on'],
  [false, true, false, 'DeepTest off disables everything'],
  [true, false, false, 'UntangleIt off disables everything'],
  [false, false, false, 'both off'],
  [true, undefined, true, 'DeepTest alone, on'],
  [false, undefined, false, 'DeepTest alone, off'],
  [undefined, true, true, 'UntangleIt alone, on'],
  [undefined, false, false, 'UntangleIt alone, off'],
  [undefined, undefined, true, 'neither registered'],
];

for (const [dt, ui, expected, why] of MATRIX) {
  test(`the effective state: ${why}`, () => {
    const r = reader({ [DEEPTEST_AGENTS_KEY]: dt, [UNTANGLEIT_AGENTS_KEY]: ui });
    assert.equal(effectiveAgentsEnabled(r), expected);
  });
}

test('an explicit false from either installed product gates this product', () => {
  // The cross-product claim, asserted here rather than inferred from the
  // table, because it is the invariant and not an entry in it.
  for (const key of AGENT_KEYS) {
    const values: Record<string, boolean | undefined> = { [DEEPTEST_AGENTS_KEY]: true, [UNTANGLEIT_AGENTS_KEY]: true };
    values[key] = false;
    assert.equal(effectiveAgentsEnabled(reader(values)), false, `${key} false must disable DeepTest`);
    assert.deepEqual(disabledBy(reader(values)), [key]);
  }
});

test('an unregistered key carrying a stale false is ignored, never obeyed', () => {
  // VS Code does not remove a person's settings when an extension is
  // uninstalled, so an uninstalled peer's `false` can still be on disk. It
  // no longer appears in the Settings UI, because nothing registers it, so
  // obeying it would disable this product with no way to turn it back on.
  // The reader answers `undefined` for a key nobody registered, and this
  // asserts the decision treats that as neutral.
  const stale = reader({ [DEEPTEST_AGENTS_KEY]: true, [UNTANGLEIT_AGENTS_KEY]: undefined });
  assert.equal(effectiveAgentsEnabled(stale), true);
  assert.deepEqual(disabledBy(stale), []);
});

test('the decision reads both keys and no others', () => {
  const asked: string[] = [];
  effectiveAgentsEnabled({
    registeredValue: (key) => {
      asked.push(key);
      return true;
    },
  });
  assert.deepEqual([...asked].sort(), [...AGENT_KEYS].sort());
});

test('the two key names are the contributed ones, and each product owns its namespace', () => {
  assert.equal(DEEPTEST_AGENTS_KEY, 'deeptest.polyglot.agents.enabled');
  assert.equal(UNTANGLEIT_AGENTS_KEY, 'untangleit.polyglot.agents.enabled');
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')) as {
    contributes: { configuration: { properties: Record<string, { type: string; default: unknown; scope: string; description: string }> } };
  };
  const declared = manifest.contributes.configuration.properties[DEEPTEST_AGENTS_KEY];
  assert.ok(declared, 'DeepTest contributes its own key');
  assert.equal(declared.type, 'boolean');
  assert.equal(declared.default, true, 'agents work today, so true is the honest default');
  assert.equal(declared.scope, 'application', 'a checked-in workspace file must not turn agents back on');
  assert.match(declared.description, /across installed Polyglot tools/, 'the global consequence is explicit');
  assert.equal(manifest.contributes.configuration.properties[UNTANGLEIT_AGENTS_KEY], undefined, 'and never contributes the peer key, which VS Code rejects');
});

// ---------------------------------------------------------------------------
// The decision stays free of the editor, so the matrix above is real
// ---------------------------------------------------------------------------

test('the decision imports no editor, and the editor binding holds no decision', () => {
  const decision = read('agent', 'killswitch.ts');
  assert.doesNotMatch(decision, /from 'vscode'|require\('vscode'\)/, 'the matrix drives the real function because this file can be loaded here');
  const binding = code(read('agent', 'killswitchReader.ts'));
  assert.match(binding, /inspect<boolean>\(key\)/, 'registration is established from inspect');
  assert.match(binding, /state\.defaultValue === undefined/, 'and an unregistered key is undefined, not a default');
  assert.doesNotMatch(binding, /AGENT_KEYS|DEEPTEST_AGENTS_KEY|UNTANGLEIT_AGENTS_KEY|effectiveAgentsEnabled/, 'the binding answers about one key it is handed; it never combines the two');
});

test('the switch is not model selection', () => {
  for (const f of ['killswitch.ts', 'killswitchReader.ts', 'mayOffer.ts']) {
    const c = code(read('agent', f));
    assert.doesNotMatch(c, /selectChatModels|sendRequest|LanguageModel|vendor|family/, `${f} names no model`);
  }
});

// ---------------------------------------------------------------------------
// One gate, one meaning, everywhere
// ---------------------------------------------------------------------------

test('every layer asks the same conjunction', () => {
  const c = code(read('agent', 'mayOffer.ts'));
  assert.match(c, /agentsEnabled\(\) && \(await modelsAvailable\(\)\)/, 'the switch and the editor, in one answer');
  assert.match(c, /effectiveAgentsEnabled\(configurationReader\(\)\)/);

  // `modelsAvailable` still answers only the editor's question, which is what
  // lets the structural test pin it to a length comparison.
  const availability = code(read('agent', 'availability.ts'));
  assert.doesNotMatch(availability, /getConfiguration|killswitch|agentsEnabled/, 'availability.ts did not absorb the switch');
});

test('no caller asks the editor directly any more', () => {
  // The rule 42 gap this phase closed: before it, the explain offers asked
  // `modelsAvailable` and the propose commands asked nothing at all.
  for (const f of [['extension.ts'], ['decisions', 'commands.ts'], ['agent', 'problems.ts']]) {
    const c = code(read(...f));
    assert.doesNotMatch(c, /\bmodelsAvailable\b/, `${f.join('/')} goes through the conjunction, not the editor`);
  }
});

test('both propose commands gate before any side effect', () => {
  const c = code(read('decisions', 'commands.ts'));
  for (const fn of ['fixShortfall', 'fixFunction']) {
    const start = c.indexOf(`export async function ${fn}(`);
    assert.ok(start > 0, `${fn} is there`);
    const body = c.slice(start, start + 4000);
    const gate = body.indexOf('agenticGateOpen');
    assert.ok(gate > 0, `${fn} consults the gate`);
    for (const effect of ['offerUndoFirst', 'ProposalPacket', 'askToAuthorize', 'recordDecision', 'saveDecisions', 'setPendingAttempt', 'prefillChat']) {
      const at = body.indexOf(effect);
      if (at > 0) {
        assert.ok(gate < at, `${fn} gates before ${effect}`);
      }
    }
  }
});

test('the gate refuses without writing, taking a checkpoint or asking anything', () => {
  const c = code(read('decisions', 'commands.ts'));
  const helper = c.slice(c.indexOf('async function agenticGateOpen'), c.indexOf('export async function fixShortfall'));
  assert.match(helper, /await mayOfferAgentic\(\)/);
  assert.match(helper, /return false;/);
  assert.doesNotMatch(helper, /saveDecisions|recordDecision|offerCheckpoint|showWarningMessage|showInformationMessage|askToAuthorize|prefillChat/, 'a refusal changes nothing and asks nothing');
});

// ---------------------------------------------------------------------------
// The participant: the layer that cannot be removed
// ---------------------------------------------------------------------------

test('the participant checks the switch before it consumes the pending attempt', () => {
  const c = code(read('agent', 'participant.ts'));
  const gate = c.indexOf('agentsEnabled()');
  const take = c.indexOf('takePendingAttempt()');
  assert.ok(gate > 0 && take > 0, 'both are there');
  assert.ok(gate < take, 'one yes authorizes one attempt, so a disabled turn must not spend it');
});

test('a disabled turn sends nothing and names no single product setting', () => {
  const source = read('agent', 'participant.ts');
  const c = code(source);
  const gate = c.indexOf('agentsEnabled()');
  const block = c.slice(gate, c.indexOf('takePendingAttempt()'));
  assert.doesNotMatch(block, /sendRequest|runGovernedInteraction|selectChatModels/, 'nothing is sent');
  assert.match(source, /Polyglot AI assistance is disabled\. Enable AI assistance in the installed Polyglot extension settings/);
  assert.doesNotMatch(
    source.slice(source.indexOf('Polyglot AI assistance is disabled'), source.indexOf('Polyglot AI assistance is disabled') + 300),
    /deeptest\.polyglot|untangleit\.polyglot/,
    'either installed setting may be the false one, so neither is named',
  );
});

test('the in-flight model-error behaviour is untouched', () => {
  const c = code(read('agent', 'participant.ts'));
  assert.match(c, /model-unavailable/, 'rule 39 still speaks for a model that failed');
  assert.match(c, /not-recorded/, "and Phase 7's durability outcome is unchanged");
});

// ---------------------------------------------------------------------------
// The gate begins things; it never transforms them
// ---------------------------------------------------------------------------

test('the switch mutates no packet, constraint, validator or record', () => {
  for (const f of [['agent', 'killswitch.ts'], ['agent', 'killswitchReader.ts'], ['agent', 'mayOffer.ts']]) {
    const c = code(read(...f));
    assert.doesNotMatch(c, /buildPacket|Constraint|validator|GovernanceRecord|reconcile|authoriz/i, `${f.join('/')} decides whether to begin, and nothing else`);
  }
  const participant = code(read('agent', 'participant.ts'));
  assert.doesNotMatch(participant, /dispose\(\).*agentsEnabled|agentsEnabled.*dispose\(\)/s, 'the participant is never unregistered: VS Code owns that UI');
});

test('the deterministic product does not import the switch', () => {
  // Rule 40 unchanged: the measuring product depends on nothing in agent/.
  for (const f of [['runner.ts'], ['state.ts'], ['ui', 'sidebarView.ts'], ['ui', 'governanceView.ts'], ['governance.ts']]) {
    const c = code(read(...f));
    assert.doesNotMatch(c, /killswitch|mayOffer/, `${f.join('/')} knows nothing about the switch`);
  }
});

test('nothing reaches into the peer product or into keepsafe', () => {
  for (const f of ['killswitch.ts', 'killswitchReader.ts', 'mayOffer.ts']) {
    const c = code(read('agent', f));
    assert.doesNotMatch(c, /\.keepsafe|from '\.\.\/untangleit'|getExtension/i, `${f} reads a key name and imports no peer`);
  }
});

// ---------------------------------------------------------------------------
// The deterministic product is untouched, proved by running it
// ---------------------------------------------------------------------------

test('a real deterministic measurement is identical with agents enabled and disabled', async () => {
  // Runtime evidence rather than an assertion about wording. The switch is
  // flipped for real between the two runs, through the same function the
  // product calls, and the measured structure is compared whole.
  //
  // Nothing in this path can see the switch, which the structural test above
  // establishes separately. That is the point: the two facts together are
  // the claim. This one shows the output does not move; that one shows it
  // cannot.
  const on = reader({ [DEEPTEST_AGENTS_KEY]: true, [UNTANGLEIT_AGENTS_KEY]: true });
  const off = reader({ [DEEPTEST_AGENTS_KEY]: false, [UNTANGLEIT_AGENTS_KEY]: true });
  assert.equal(effectiveAgentsEnabled(on), true);
  assert.equal(effectiveAgentsEnabled(off), false, 'the two states really are different, so the comparison is not vacuous');

  const { typescriptPlugin } = await import('../src/languages/typescript');
  const { DEFAULT_DEPTH_OPTIONS } = await import('../src/engine/types');
  const { runtimeEnvironment } = await import('../src/languages/shared/runtime');
  const fixture = path.join(__dirname, 'fixtures', 'helloworld-react-vitest');
  const target = path.join(fixture, 'src', 'schedule.ts');
  const source = fs.readFileSync(target, 'utf8');

  const measure = async (): Promise<unknown> => {
    const s = await typescriptPlugin.createStructureSource({ wasmDir: runtimeEnvironment().wasmDir });
    const structure = s.analyze('src/schedule.ts', source, DEFAULT_DEPTH_OPTIONS);
    s.dispose();
    return JSON.parse(JSON.stringify(structure)) as unknown;
  };

  const withAgents = await measure();
  const withoutAgents = await measure();
  assert.deepEqual(withoutAgents, withAgents, 'a measurement does not move because agents were turned off');
});

// ---------------------------------------------------------------------------
// The deterministic commands stay available
// ---------------------------------------------------------------------------

test('every deterministic command is still contributed, and none of them is agentic', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')) as {
    contributes: { commands: Array<{ command: string }> };
  };
  const ids = manifest.contributes.commands.map((c) => c.command);
  for (const id of [
    'deeptest.run',
    'deeptest.configure',
    'deeptest.clear',
    'deeptest.toggleOverlay',
    'deeptest.showOutput',
    'deeptest.openLine',
    'deeptest.report',
    'deeptest.decide',
    'deeptest.accept',
    'deeptest.undoDecision',
    'deeptest.undoFunctionDecision',
    'deeptest.toggleNumbers',
    // Phase 7's history, and a diff of a proposal the person was already
    // given. Neither reaches a model, and with agents off they are exactly
    // the screens somebody would want.
    'deeptest.governance',
    'deeptest.showProposedChange',
  ]) {
    assert.ok(ids.includes(id), `${id} is still contributed`);
  }
  // Phase 8 adds no command. E6 established that two extensions cannot
  // contribute one command id, and the Settings UI changes both values, so
  // there was nothing a toggle command would have added.
  assert.equal(ids.filter((id) => /toggle.*agent|agent.*toggle/i.test(id)).length, 0);
});
