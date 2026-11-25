/**
 * The Phase 3 architectural boundaries, checked at build time.
 *
 * Every one of these is load-bearing and invisible when reading one file, and
 * every one of them was true by accident before this test existed. Nothing
 * would have failed if a later change broke them, which is the definition of
 * an unguarded invariant.
 *
 * The intermediate state is stated honestly rather than hidden. Phase 3 does
 * not remove the three legacy proposal hand-offs: they are proposal
 * workflows, their validators arrive in Phase 4, and deleting a working path
 * before its governed replacement exists would ship a regression. So this
 * test asserts the surviving clipboard and chat-open sites are exactly the
 * known legacy locations and no others. Rule 33 binds the completed 1.0.21
 * release, not this phase, and **Phase 9's release test is stricter and stays
 * stricter: no legacy ungoverned hand-off anywhere.** An intermediate state
 * does not get to weaken the final invariant.
 *
 * Deliberately static rather than agentic: these are build-time architectural
 * rules that must be decidable and able to fail a release, which is not a
 * judgement call.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SRC = path.join(__dirname, '..', 'src');
const AGENT = path.join(SRC, 'agent');

const WIRING = ['extension.ts', 'loop.ts'];
function sources(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      sources(full, found);
    } else if (entry.name.endsWith('.ts')) {
      found.push(full);
    }
  }
  return found;
}

const rel = (f: string): string => path.relative(SRC, f).split(path.sep).join('/');

/** A file's code, with comment lines removed, so prose about a thing is not a use of it. */
function codeOf(file: string): string {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
    .join('\n');
}

/** Files mentioning a thing, excluding the ones that only talk about it in a comment. */
function filesUsing(pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const file of sources(SRC)) {
    if (pattern.test(codeOf(file))) {
      hits.push(rel(file));
    }
  }
  return hits.sort();
}

// ---------------------------------------------------------------------------
// PTP-1: the model
// ---------------------------------------------------------------------------

/**
 * Rule 48. A request goes to the model the person selected, from one place,
 * and that place is the participant handler.
 */
test('sending to a model happens only in the participant adapter', () => {
  assert.deepEqual(filesUsing(/\.sendRequest\s*\(/), ['agent/participant.ts']);
});

/**
 * Rules 36 to 38. `selectChatModels` is permitted outside the handler for one
 * thing only: zero against non-zero. If its result were ever indexed, sorted,
 * kept, or returned, Polyglot would be choosing a model on the customer's
 * behalf, which spends their quota on our decision.
 */
test('availability detection never becomes model selection', () => {
  assert.deepEqual(filesUsing(/selectChatModels/), ['agent/availability.ts']);
  const code = codeOf(path.join(AGENT, 'availability.ts'));
  const uses = [...code.matchAll(/selectChatModels\(\)[^\n]*/g)].map((m) => m[0]);
  assert.equal(uses.length, 1, 'asked once');
  assert.match(uses[0], /\.length\s*>\s*0/, 'and the only thing asked of the answer is whether it is empty');
  for (const forbidden of [/selectChatModels\(\)\s*\)\s*\[/, /\bmodels\s*\[\s*0\s*\]/, /\.sort\(/, /return\s+models\b/]) {
    assert.doesNotMatch(code, forbidden, 'nothing here indexes, sorts, keeps, or returns a model');
  }
});

/** Rule 38. The model an actual request uses comes from the person's choice. */
test('the request model is always request.model', () => {
  const code = codeOf(path.join(AGENT, 'participant.ts'));
  assert.match(code, /modelPort\(request\.model\)/, 'the only model the handler wraps is the one the person selected');
  assert.doesNotMatch(code, /selectChatModels/, 'and the handler never asks for a different one');
});

/** A second model-access path is a second thing to govern. */
test('no followup provider is registered', () => {
  assert.deepEqual(filesUsing(/followupProvider/), []);
});

// ---------------------------------------------------------------------------
// Nothing writes the customer's source
// ---------------------------------------------------------------------------

/**
 * The Phase 3 answer to M10. A validated proposal is shown, never applied:
 * we measured that the stable confirm-then-apply path did not apply on VS
 * Code 1.104.0, so the mechanism we ship is the one we could demonstrate.
 *
 * This is scoped to what we tested and is an implementation decision rather
 * than the permanent product design (rule 92 is the permanent statement).
 * While it holds, nothing in this product may write a project file.
 */
test('no code path applies a change to the person\'s files', () => {
  assert.deepEqual(filesUsing(/\bapplyEdit\b/), [], 'no applyEdit');
  assert.deepEqual(filesUsing(/new\s+vscode\.WorkspaceEdit\b/), [], 'no WorkspaceEdit');
  assert.deepEqual(filesUsing(/\bTextEditorEdit\b/), [], 'no editor edit builder');
  // Scoped to the agent, deliberately. The product writes its own files, a
  // saved report among them, and always has. What rule 92 forbids is a
  // MODEL-DERIVED change reaching the customer's source, so the line is drawn
  // around the agent rather than around the whole product. A broader
  // assertion here would fail on the report writer and teach somebody to
  // delete the test.
  const agentWrites = filesUsing(/\bworkspace\.fs\.writeFile\b|\bfs\.writeFileSync\b/).filter((f) => f.startsWith('agent/'));
  assert.deepEqual(agentWrites, [], 'and nothing in the agent writes a file at all');
});

/** The proposed text is served read only. A content provider has no write path. */
test('proposed text reaches the person through a read-only provider', () => {
  const code = codeOf(path.join(AGENT, 'diff.ts'));
  assert.match(code, /registerTextDocumentContentProvider/);
  assert.match(code, /vscode\.diff/);
  assert.doesNotMatch(code, /applyEdit|writeFile/);
});

// ---------------------------------------------------------------------------
// The intermediate legacy state, stated
// ---------------------------------------------------------------------------

/**
 * M3 and M4, closed.
 *
 * Phase 3 listed every surviving ungoverned hand-off by file and allowed the
 * debt to persist without growing. Phase 5 removed the sites: `copilot.ts` is
 * deleted, and `buildUntangleBrief` is deleted rather than wrapped, because
 * hand-written prose inside a governed packet is the thing rule 87 was
 * written about.
 *
 * **Zero PTP-2 sites, and exactly one PTP-3 site**, that one being the
 * governed pre-fill, which never sends.
 */
test('no ungoverned hand-off survives', () => {
  assert.deepEqual(filesUsing(/env\.clipboard/), [], 'PTP-2: M3 and M4 are closed, and the clipboard hand-off is gone');
  assert.deepEqual(filesUsing(/workbench\.action\.chat\.open/), ['agent/prefill.ts'], 'PTP-3: exactly one site, and it is the pre-fill');
  assert.equal(fs.existsSync(path.join(SRC, 'copilot.ts')), false, 'copilot.ts is deleted, not kept beside the governed path');
  assert.equal(fs.existsSync(path.join(SRC, 'report', 'brief.ts')), false, 'and so is the brief builder');
});

/** PTP-3's permitted use is pre-fill, and pre-fill never sends. */
test('the governed pre-fill never sends', () => {
  const code = codeOf(path.join(AGENT, 'prefill.ts'));
  assert.match(code, /executeCommand\('workbench\.action\.chat\.open', \{ query \}\)/);
  assert.doesNotMatch(code, /submit|sendToNew|isPartialQuery\s*:\s*false/, 'nothing here asks the editor to send it');
});

// ---------------------------------------------------------------------------
// The deterministic product
// ---------------------------------------------------------------------------

/**
 * Rule 40. With no model the product is whole, and this makes that a
 * build-time fact rather than a hope: nothing outside the agent folder
 * depends on anything inside it, except the handful of wiring points that
 * must.
 */
test('the deterministic product does not depend on the agent', () => {
  const offenders: string[] = [];
  for (const file of sources(SRC)) {
    if (file.startsWith(AGENT)) {
      continue;
    }
    const specifiers = [...fs.readFileSync(file, 'utf8').matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    if (specifiers.some((s) => /(^|\/)agent\//.test(s)) && !WIRING.includes(rel(file))) {
      offenders.push(rel(file));
    }
  }
  assert.deepEqual(offenders, [], `only the wiring points may reach into agent/: ${WIRING.join(', ')}`);
});

/**
 * And `loop.ts` is a wiring point, not a second transport.
 *
 * The boundary is not "only `extension.ts` may know the agent layer"; it is
 * that product workflow code must not become another way to reach a model.
 * The loop may prepare an attempt, ask the person to authorize it, and
 * correlate it afterwards. It may not select a model, send a request, or
 * route around the participant.
 */
test('the loop prepares governed work and cannot send it', () => {
  const code = codeOf(path.join(SRC, 'loop.ts'));
  for (const forbidden of [/vscode\.lm\b/, /\.sendRequest\s*\(/, /selectChatModels/, /LanguageModelChat/, /createChatParticipant/]) {
    assert.doesNotMatch(code, forbidden, 'workflow code prepares governed work; it does not reach a model');
  }
  assert.match(code, /askToAuthorize\(/, 'it asks the person');
  assert.match(code, /setPendingAttempt\(/, 'it hands the authorized attempt to the participant');
  assert.match(code, /prefillChat\(/, 'and it pre-fills, which never sends');
});

/** The two workflow modules the plan did not name reach no model. */
test('the attempt and authorization modules reach no model', () => {
  for (const name of ['attempt.ts', 'authorize.ts']) {
    const code = codeOf(path.join(AGENT, name));
    for (const forbidden of [/vscode\.lm\b/, /\.sendRequest\s*\(/, /selectChatModels/, /workbench\.action\.chat\.open/]) {
      assert.doesNotMatch(code, forbidden, `${name} is workflow, not transport`);
    }
  }
});

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

/**
 * An interaction id in code with no registry entry has no objective, no
 * constraints, and no validators, so nothing about it can be checked. The
 * scan looks for governed declarations and nothing else, so the legacy
 * proposal briefs are not failed for work Phase 5 has not done yet.
 */
test('every governed interaction id declared in the source is registered', () => {
  const declared = new Set<string>();
  for (const file of sources(SRC)) {
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/\brequireInteraction\s*\(\s*([A-Za-z_$][\w$]*|['"][^'"]+['"])\s*\)/g)) {
      declared.add(m[1].replace(/['"]/g, ''));
    }
  }
  const constants = fs.readFileSync(path.join(AGENT, 'interactions.ts'), 'utf8');
  for (const id of declared) {
    const literal = /^[A-Z_]+$/.test(id) ? new RegExp(`export const ${id} = '([^']+)'`).exec(constants)?.[1] : id;
    assert.ok(literal, `${id} does not resolve to an interaction id`);
    assert.ok(constants.includes(`id: ${/^[A-Z_]+$/.test(id) ? id : `'${id}'`}`), `${literal} is used in code but is not registered`);
  }
  assert.ok(declared.size > 0, 'and the scan found something, or it proves nothing');
});

// ---------------------------------------------------------------------------
// Phase 8: the agentic gate
// ---------------------------------------------------------------------------

test('every governed interaction is reachable only through the agentic gate', () => {
  // The switch needs no representation in Witness, because the gate runs
  // before `runGovernedInteraction` is ever called. What replaces a shared
  // flag is this: every production call site is behind the gate, asserted
  // over the parsed sources, which fails at build time rather than at run
  // time and cannot be undone by a later edit nobody noticed.
  const callers = filesUsing(/runGovernedInteraction/).filter((f) => f !== 'agent/mayOffer.ts');
  assert.ok(callers.length > 0, 'there are governed call sites to check');
  for (const f of callers) {
    const c = codeOf(path.join(SRC, f));
    assert.match(c, /agentsEnabled\(\)|mayOfferAgentic\(\)/, `${f} reaches a governed interaction and must consult the gate`);
  }
});

test('the gate is one answer, asked the same way everywhere', () => {
  // Two settings are not two policies. The platform made us contribute
  // twice; nothing reads a key directly, so the answer is computed once.
  const readers = filesUsing(/registeredValue|getConfiguration\(\)\.inspect/).sort();
  assert.deepEqual(readers, ['agent/killswitch.ts', 'agent/killswitchReader.ts'], 'only the switch modules read the settings');
  const deciders = filesUsing(/effectiveAgentsEnabled/).sort();
  assert.deepEqual(deciders, ['agent/killswitch.ts', 'agent/mayOffer.ts'], 'and only one place combines them');
});

test('the switch introduces no peer import and no shared runtime', () => {
  // Each product reads both key names as strings, which is not a dependency.
  // VS Code left no other shape: it refuses two extensions one property id,
  // refuses a property nobody contributed, and refuses two extensions one
  // command id. All three were measured rather than assumed.
  for (const f of ['agent/killswitch.ts', 'agent/killswitchReader.ts', 'agent/mayOffer.ts']) {
    const c = codeOf(path.join(SRC, f));
    assert.doesNotMatch(c, /^import .*(untangleit|deeptest|keepsafe)/im, `${f} imports no peer`);
    assert.doesNotMatch(c, /getExtension|executeCommand/, `${f} reaches no other extension`);
  }
});

test('the PTP boundaries are unchanged by the switch', () => {
  // The gate decides whether to begin. It never becomes a second way to
  // reach a model, and it never unregisters the participant, which would be
  // trying to hide platform-owned UI that E2 measured as unhideable.
  for (const f of ['agent/killswitch.ts', 'agent/killswitchReader.ts', 'agent/mayOffer.ts']) {
    const c = codeOf(path.join(SRC, f));
    assert.doesNotMatch(c, /vscode\.lm|sendRequest|createChatParticipant|chat\.open|env\.clipboard/, `${f} touches no protected transport primitive`);
  }
  const participant = codeOf(path.join(AGENT, 'participant.ts'));
  assert.doesNotMatch(participant, /agentsEnabled[\s\S]{0,200}?\bdispose\(\)/, 'a disabled state does not unregister the participant');
});
