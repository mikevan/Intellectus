/**
 * Runs the integration suite inside a real editor against the Vitest
 * fixture. `npm run test:vscode`. UNTANGLEIT_VSCODE_PATH points at an
 * existing VS Code or VSCodium executable; otherwise @vscode/test-electron
 * downloads a build into .vscode-test/.
 *
 * Two launches, because "a model exists" and "no model exists" are
 * different editors rather than different steps in one:
 *
 *   governed   the stub model in test/integration/stub-model is loaded
 *              beside UntangleIt, so Phase 8's gate opens and the suite
 *              walks measure, authorize, the governed hand-off, and
 *              "Measure again".
 *   no-model   UntangleIt alone. The gate must refuse, record nothing, and
 *              leave the measurement whole (rules 40 and 42).
 *
 * Experiment E7 established that the stub is visible to selectChatModels()
 * in this editor; see the stub's own header.
 */
import * as path from 'node:path';
import { runTests } from '@vscode/test-electron';

type Mode = 'governed' | 'no-model';

async function launch(mode: Mode): Promise<void> {
  const untangleIt = path.resolve(__dirname, '..', '..', '..');
  const stub = path.join(untangleIt, 'test', 'integration', 'stub-model');
  const workspace = path.resolve(untangleIt, 'test', 'fixtures', 'tsproject-vitest');
  console.log(`UntangleIt integration suite, ${mode} launch.`);
  await runTests({
    extensionDevelopmentPath: mode === 'governed' ? [untangleIt, stub] : [untangleIt],
    extensionTestsPath: path.resolve(__dirname, 'suite'),
    vscodeExecutablePath: process.env.UNTANGLEIT_VSCODE_PATH,
    launchArgs: [workspace, '--disable-extensions', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
    // UNTANGLEIT_TEST_HOST answers the authorization question yes, which no
    // script can press. Set here and nowhere else. UNTANGLEIT_SUITE_MODE
    // tells the suite which launch it is in, and the suite checks the claim
    // against which extensions are actually loaded.
    extensionTestsEnv: { UNTANGLEIT_TEST_HOST: '1', UNTANGLEIT_SUITE_MODE: mode },
  });
}

async function main(): Promise<void> {
  await launch('governed');
  await launch('no-model');
}

main().catch((err) => {
  console.error('Integration tests failed:', err);
  process.exit(1);
});
