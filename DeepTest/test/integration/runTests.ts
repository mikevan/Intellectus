/**
 * Downloads a VS Code build (cached under .vscode-test/) and runs the suites
 * inside it. `npm run test:vscode`.
 *
 * Three launches:
 *
 *   suite, governed    the Python fixture, with the stub model in
 *                      test/integration/stub-model loaded beside DeepTest, so
 *                      Phase 8's gate opens and "Fix this" reaches the
 *                      governed pre-fill.
 *   suite, no-model    the same fixture and suite with no model. "Fix this"
 *                      must refuse and record nothing, and everything else
 *                      must work exactly as it does with a model (rules 40
 *                      and 42).
 *   suite-ts           the Jest fixture. It never reaches an agentic path,
 *                      so it runs as it always has.
 *
 * Experiment E7 established that the stub is visible to selectChatModels()
 * in this editor; see the stub's own header.
 */
import * as path from 'node:path';
import { runTests } from '@vscode/test-electron';

interface Launch {
  suite: string;
  fixture: string;
  mode?: 'governed' | 'no-model';
}

async function main(): Promise<void> {
  const deepTest = path.resolve(__dirname, '..', '..', '..');
  const stub = path.join(deepTest, 'test', 'integration', 'stub-model');
  const launches: Launch[] = [
    { suite: 'suite', fixture: 'pyproject', mode: 'governed' },
    { suite: 'suite', fixture: 'pyproject', mode: 'no-model' },
    { suite: 'suite-ts', fixture: 'jsproject-jest' },
  ];
  const only = process.env.DEEPTEST_IT_ONLY;
  for (const { suite, fixture, mode } of launches) {
    if (only && suite !== only) {
      continue;
    }
    console.log(`DeepTest integration ${suite}${mode ? `, ${mode} launch` : ''}.`);
    const extensionTestsPath = path.resolve(__dirname, suite);
    const workspace = path.resolve(deepTest, 'test', 'fixtures', fixture);
    // DEEPTEST_VSCODE_PATH points at an existing VS Code / VSCodium executable
    // (needed where update.code.visualstudio.com is unreachable). Otherwise
    // @vscode/test-electron downloads a build into .vscode-test/.
    await runTests({
      extensionDevelopmentPath: mode === 'governed' ? [deepTest, stub] : [deepTest],
      extensionTestsPath,
      vscodeExecutablePath: process.env.DEEPTEST_VSCODE_PATH,
      launchArgs: [workspace, '--disable-extensions', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
      // DEEPTEST_TEST_HOST answers the authorization question yes, which no
      // script can press. Set here and nowhere else. DEEPTEST_SUITE_MODE tells
      // the suite which launch it is in, and the suite checks the claim
      // against which extensions are actually loaded.
      extensionTestsEnv: { DEEPTEST_TEST_HOST: '1', ...(mode ? { DEEPTEST_SUITE_MODE: mode } : {}) },
    });
  }
}

main().catch((err) => {
  console.error('Integration tests failed:', err);
  process.exit(1);
});
