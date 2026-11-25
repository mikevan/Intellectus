/**
 * A stub language model for UntangleIt's integration suite, loaded into the
 * test editor and nowhere else.
 *
 * Why it exists: Phase 8's gate refuses every propose action when the editor
 * has no model, and the test editor has none, so without this the suite can
 * never reach the governed hand-off. Experiment E7 (2026-11-02, VS Code
 * 1.144.1, `_stubmodel-experiments` at the toolkit root) measured that a
 * model registered through `vscode.lm.registerLanguageModelChatProvider` is
 * returned by `selectChatModels()` in the test editor, under
 * `--disable-extensions`, and that asking for the list never calls the
 * response handler. Production code is unchanged and runs its real gate.
 *
 * It never answers. A request sent to it is counted and then throws, so a
 * send can never pass quietly, and the suite asserts the count is zero.
 *
 * Plain JavaScript on purpose: the editor loads it from source, so there is
 * no build step, and `tsconfig.test.json` does not compile it.
 */
const vscode = require('vscode');

const calls = { information: 0, response: 0 };

const MODEL = {
  id: 'untangleit-test-model-1',
  name: 'UntangleIt test stub',
  family: 'polyglot-test-model',
  version: '1',
  maxInputTokens: 1000,
  maxOutputTokens: 1000,
  capabilities: {},
};

function activate(context) {
  context.subscriptions.push(
    vscode.lm.registerLanguageModelChatProvider('polyglot-test-model', {
      provideLanguageModelChatInformation() {
        calls.information += 1;
        return [MODEL];
      },
      async provideLanguageModelChatResponse() {
        calls.response += 1;
        throw new Error('A request was sent to the integration suite stub model. Nothing in the suite may send to a model.');
      },
      async provideTokenCount() {
        return 0;
      },
    }),
  );
  return { calls: () => ({ ...calls }) };
}

module.exports = { activate };
