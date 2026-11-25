/**
 * The architectural boundaries Witness must hold, checked at build time.
 *
 * Witness is the shared evidence layer every product depends on. Two things
 * about it are load-bearing and neither is visible when reading one file:
 *
 *   It must never depend on `vscode`. The moment it does, it stops being a
 *   plain library, the products can no longer be tested without an editor,
 *   and a capability that belongs here starts drifting back into whichever
 *   product happened to need it first.
 *
 *   It must never depend on a peer product. DeepTest and UntangleIt are
 *   peers. If Witness imported either, every product would transitively
 *   depend on that one, which is the coupling the shared layer exists to
 *   prevent.
 *
 * Both were true by accident before this test existed. Nothing would have
 * failed if a later change broke them, which is the definition of an
 * unguarded invariant. This is deliberately static rather than agentic: it
 * enforces a build-time architectural rule and must be decidable and able to
 * fail a release, which is not a judgement call.
 */
import { test } from 'vitest';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Every TypeScript file under src, recursively. */
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

/** Every module specifier a file imports from, however it spells the import. */
function specifiers(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
    found.push(m[1]);
  }
  for (const m of text.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    found.push(m[1]);
  }
  for (const m of text.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    found.push(m[1]);
  }
  return found;
}

const SRC = path.join(__dirname, '..', 'src');

test('Witness does not depend on vscode', () => {
  const offenders: string[] = [];
  for (const file of sources(SRC)) {
    for (const spec of specifiers(fs.readFileSync(file, 'utf8'))) {
      if (spec === 'vscode' || spec.startsWith('vscode/')) {
        offenders.push(`${path.relative(SRC, file)} imports ${spec}`);
      }
    }
  }
  assert.deepEqual(offenders, [], 'Witness is a plain Node library; an editor dependency here would make every product untestable without one');
});

test('Witness does not depend on a peer product', () => {
  const peers = [/(^|[\\/])DeepTest([\\/]|$)/i, /(^|[\\/])UntangleIt([\\/]|$)/i, /(^|[\\/])KeepSafe([\\/]|$)/i, /^@projectrevivesolutions\/(deeptest|untangleit|keepsafe)/i];
  const offenders: string[] = [];
  for (const file of sources(SRC)) {
    for (const spec of specifiers(fs.readFileSync(file, 'utf8'))) {
      if (peers.some((p) => p.test(spec))) {
        offenders.push(`${path.relative(SRC, file)} imports ${spec}`);
      }
    }
  }
  assert.deepEqual(offenders, [], 'DeepTest, UntangleIt, and KeepSafe are peers; Witness importing one would make every product depend on it');
});

/** The check has to be able to fail, or it proves nothing. */
test('the boundary check catches an offender', () => {
  const vscodeish = "import * as vscode from 'vscode';\nconst x = require('vscode');\n";
  assert.ok(specifiers(vscodeish).includes('vscode'), 'both import spellings are seen');

  const peerish = "import { thing } from '../../UntangleIt/src/gate';\nawait import('../../DeepTest/src/state');\n";
  const seen = specifiers(peerish);
  assert.ok(seen.some((s) => /UntangleIt/i.test(s)) && seen.some((s) => /DeepTest/i.test(s)), 'a relative reach into a peer is seen, in every import form');
});

// ---------------------------------------------------------------------------
// Phase 4 structural invariants
// ---------------------------------------------------------------------------

/** Source with comment lines stripped, so a test cannot pass on its own prose. */
function codeOf(file: string): string {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('*/'));
    })
    .join('\n');
}

/**
 * Exactly two model requests, and no loop around them.
 *
 * The counting test in `rule94.test.ts` proves the number for the cases it
 * runs. This proves there is no third path at all, which a behavioural test
 * cannot: it would have to guess which input reaches it.
 */
test('the governed sequence asks the model at most twice, and not in a loop', () => {
  const code = codeOf(path.join(__dirname, '..', 'src', 'governance', 'interaction.ts'));
  const asks = [...code.matchAll(/await ask\(/g)];
  assert.equal(asks.length, 2, 'one request and one correction, and nothing else');

  // Neither sits inside a loop. A loop here would make the correction bound
  // a number somebody could change rather than a shape of the code. Scoped
  // to the governed sequence itself: helpers elsewhere in the file loop over
  // validators and constraints, which is ordinary work and not a second
  // route to the model.
  const body = governedSequence(code);
  for (const kind of ['for (', 'while (', 'do {']) {
    assert.equal(body.includes(kind), false, `no ${kind.trim()} in runGovernedInteraction, so no request can repeat`);
  }
  assert.equal([...body.matchAll(/await ask\(/g)].length, 2, 'and both requests are in the sequence itself, where they can be read in order');
});

/** The body of `runGovernedInteraction`, by brace depth. */
function governedSequence(code: string): string {
  const at = code.indexOf('export async function runGovernedInteraction');
  assert.notEqual(at, -1);
  let depth = 0;
  for (let i = code.indexOf('{', at); i < code.length; i += 1) {
    if (code[i] === '{') {
      depth += 1;
    } else if (code[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        return code.slice(at, i + 1);
      }
    }
  }
  assert.fail('runGovernedInteraction has no closing brace');
  return '';
}

/**
 * Rule 61. "Apply it anyway" is not a governance fallback.
 *
 * Worth guarding structurally rather than trusting, because the pressure to
 * add that button arrives later, from somebody reasonable, with a good
 * story about a customer who is stuck.
 */
test('nothing offers to apply an unvalidated change', () => {
  for (const file of sources(path.join(__dirname, '..', 'src'))) {
    const code = codeOf(file);
    for (const phrase of ['apply anyway', 'Apply anyway', 'applyAnyway', 'force apply', 'forceApply', 'ignore validation', 'skipValidation']) {
      assert.equal(code.includes(phrase), false, `${path.basename(file)} must not offer ${phrase}`);
    }
  }
});

/** The repository is read-only, and the type is where that is held. */
test('the repository port has no write operation', () => {
  const code = codeOf(path.join(__dirname, '..', 'src', 'governance', 'repository.ts'));
  for (const forbidden of ['writeFileSync', 'appendFileSync', 'mkdirSync', 'rmSync', 'unlinkSync', 'renameSync', 'copyFileSync']) {
    assert.equal(code.includes(forbidden), false, `repository.ts must not call ${forbidden}: it validates a proposal, it does not apply one`);
  }
  // And it reaches the filesystem only through node:fs, so rule 45 holds.
  const imports = [...code.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(
    imports.filter((i) => !i.startsWith('.')).sort(),
    ['node:fs', 'node:path'],
    'the port depends on the standard library and nothing else',
  );
});

/**
 * The verdict never consults the person's answer.
 *
 * Rule 92: an authorized attempt that fails validation is a failed attempt,
 * and it is never softened because somebody agreed to try it.
 */
test('no decision in the governed sequence reads the authorization', () => {
  // Scoped to the sequence, which is where an outcome is chosen.
  // `requireAuthorization` reads it to decide whether to run at all, which
  // is the point of rule 23's ordering and not a verdict.
  const body = governedSequence(codeOf(path.join(__dirname, '..', 'src', 'governance', 'interaction.ts')));
  for (const line of body.split('\n')) {
    if (!line.includes('deps.authorization')) {
      continue;
    }
    // The only two uses: handing it to the pre-flight check, and recording
    // what the person answered.
    const allowed = line.includes('requireAuthorization(') || line.includes('deps.authorization ?');
    assert.ok(allowed, `deps.authorization is read somewhere it could sway an outcome: ${line.trim()}`);
  }
  // And acceptance is never mentioned alongside it.
  for (const line of body.split('\n')) {
    if (line.includes('accepted')) {
      assert.equal(line.includes('authorization'), false, `acceptance and authorization meet on one line: ${line.trim()}`);
    }
  }
});
