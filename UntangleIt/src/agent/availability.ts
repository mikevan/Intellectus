/**
 * Is there a model at all?
 *
 * The only place in UntangleIt that touches `lm.selectChatModels`, and the only
 * thing it asks is zero against non-zero. PTP-1 permits that outside the
 * participant handler for exactly this purpose, because whether to offer an
 * agentic affordance has to be known before anybody has invoked one, and a
 * handler exists only after they have.
 *
 * What it must never become. The returned models are not indexed, not sorted,
 * not ranked, not kept, and never sent to. Polyglot does not choose a model
 * (rules 36, 37): routing a request to one the customer did not pick spends
 * their quota on our decision, and with premium-request multipliers that is a
 * financial act rather than a technical one. The model an actual request uses
 * always comes from `ChatRequest.model`, in `participant.ts`, and nowhere
 * else. The structural test asserts this file compares the length and does
 * nothing else with the array.
 */
import * as vscode from 'vscode';

/**
 * Whether the editor has any usable model right now.
 *
 * False means Polyglot suppresses every affordance it controls: no button, no
 * chat pre-fill, nothing said. The deterministic product is untouched and
 * every verdict, measurement, and log line is exactly as it was.
 *
 * It does not mean the chat participant disappears. VS Code shows a
 * manifest-contributed participant whether or not a model is available, which
 * we measured rather than assumed, so we cannot hide it and do not pretend to.
 * If somebody invokes it directly with no model, the handler tells them what
 * is wrong and changes nothing.
 */
export async function modelsAvailable(): Promise<boolean> {
  try {
    return (await vscode.lm.selectChatModels()).length > 0;
  } catch {
    // Consent not granted, provider away, quota gone. All the same answer
    // here: offer nothing. The person is told only if they ask for something.
    return false;
  }
}

/** Fires when availability may have changed, so a product can re-ask. */
export function onAvailabilityChanged(listener: () => void): vscode.Disposable {
  return vscode.lm.onDidChangeChatModels(listener);
}
