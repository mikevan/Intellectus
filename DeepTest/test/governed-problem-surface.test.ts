/**
 * M12: the behaviour gate's classified failure reaches the person.
 *
 * Witness's recorder already decides what stopped it. A project path holding
 * a character the runner's own build cannot survive is `toolchain` /
 * `path-character`, classified from deterministic evidence and built in
 * Phase 2. UntangleIt has shown that packet since then. DeepTest recorded at
 * two sites and passed no `report` callback at either, so the packet was
 * built, classified, and thrown away: the person was told a recording could
 * not be made and never told why.
 *
 * What M12 adds is a surface. **It adds no classification.** The packet is
 * the recorder's own and is passed through unchanged, and the assertions
 * below are mostly about what is absent: no second classifier, no class
 * named anywhere on the path, and no new dependency from the measuring
 * product on the agent folder.
 *
 * These are source assertions because `state.ts` and `problems.ts` both
 * import `vscode`, which does not exist outside the editor. What can be
 * proved without it is proved without it.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { upstreamPathFailure } from '@projectrevivesolutions/witness';

const SRC = path.join(__dirname, '..', 'src');
const read = (...p: string[]): string => fs.readFileSync(path.join(SRC, ...p), 'utf8');

// ---------------------------------------------------------------------------
// Both call sites are wired
// ---------------------------------------------------------------------------

test('the hand-off recording reports what stopped it', () => {
  const code = read('decisions', 'commands.ts');
  assert.match(code, /recordBoundary\(plugin, \{[^}]*report: \(packet\) => reportProblem\(deps, packet\)/, 'the packet arrives and is passed on as it is');
});

test('the verification recording reports what stopped it', () => {
  const verify = read('decisions', 'verify.ts');
  assert.match(verify, /recordBoundary\(plugin, \{[^}]*report: deps\.report/, 'the second site, through the caller`s surface');
  assert.match(verify, /report\?: \(packet: GovernancePacket\) => void/, 'typed as the packet, not as a string');
  const runner = read('runner.ts');
  assert.match(runner, /verifyBehaviour\(\{ output, folder, report: deps\.report \}/, 'and the runner hands its own surface down');
});

// ---------------------------------------------------------------------------
// The surface classifies nothing
// ---------------------------------------------------------------------------

test('the surface names no class and builds no packet', () => {
  const code = read('agent', 'problems.ts');
  assert.doesNotMatch(code, /from '\.\.\/diagnosis'|buildPacket|unclassifiedGovernancePacket|instrumentationFailure/, 'nothing here decides anything');
  assert.doesNotMatch(code, /'toolchain'|'polyglot'|'insufficient-evidence'|failureClass/, 'and no class is written down');
  assert.match(code, /toProblemPacket\(governed\)/, 'it renders the packet it was given');
});

test('the gate`s packet is the one that travels, unchanged', () => {
  // The packet the recorder would produce. Nothing on DeepTest's path
  // rebuilds, re-labels or re-decides it; the surface renders it.
  const shown = upstreamPathFailure({
    workspaceRoot: "C:\\workspace\\MikeVan's AI Development Toolkit\\app",
    runner: 'ng-karma',
    output: "✘ [ERROR] Expected \";\" but found \"s\"\n      1 │ import 'C:/workspace/MikeVan's AI Development Toolkit/app/polyfills.js';",
    succeeded: false,
  })!;
  assert.equal(shown.governed.classification.failureClass, 'toolchain');
  assert.equal(shown.governed.classification.condition, 'path-character');
  assert.equal(shown.governed.classification.confidence, 'classified');
  assert.ok(shown.governed.offers.includes('explain'), 'which is what makes the offer worth showing');
});

// ---------------------------------------------------------------------------
// It does not take the panel over, and it does not move rule 40's boundary
// ---------------------------------------------------------------------------

test('noting a problem changes neither the phase nor the result', () => {
  const state = read('state.ts');
  const body = state.slice(state.indexOf('noteProblem('), state.indexOf('clear(): void'));
  assert.match(body, /this\.governedProblem = packet;/);
  assert.match(body, /this\.problem = toProblemPacket\(packet\);/);
  assert.doesNotMatch(body, /this\.phase|this\.result|this\.message/, 'the check may still be running, and its result is still the person`s');
});

test('the measuring product still does not depend on the agent', () => {
  for (const file of ['runner.ts', path.join('decisions', 'verify.ts')]) {
    assert.doesNotMatch(read(file), /from '[^']*agent\//, `${file} reaches nothing in agent/`);
  }
  assert.match(read('extension.ts'), /import \{ reportProblem \} from '\.\/agent\/problems';/, 'the wiring stays where the wiring already was');
});
