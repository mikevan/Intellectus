/**
 * The editor binding for the kill switch, and nothing else.
 *
 * It answers one question per key: did an installed extension register this
 * property, and if so what does it say. `killswitch.ts` owns the decision;
 * this file owns only the reading, the way `availability.ts` owns only the
 * one question it asks the model API.
 *
 * **Registration is established first, from `inspect`.** A property's
 * `defaultValue` is present exactly when some installed extension
 * contributed it, which was measured rather than assumed. Reading with a
 * fallback default instead would make an uninstalled peer's leftover
 * `false` indistinguishable from a live one, and that stale value would
 * disable this product with nothing in the Settings UI to turn it back on.
 *
 * **It fails open on a throw, and that is the right direction here.** A
 * configuration read that fails tells us nothing about what the person
 * wanted, and rule 89 forbids manufacturing the certainty. The switch is
 * not the safety boundary for reaching a model, since the person still has
 * to press send in the chat, and a product that silently disabled itself
 * because a read failed would be the harder failure to diagnose.
 */
import * as vscode from 'vscode';
import type { SettingReader } from './killswitch';

/** Reads the two kill-switch settings out of the editor. */
export function configurationReader(): SettingReader {
  return {
    registeredValue(key: string): boolean | undefined {
      try {
        const config = vscode.workspace.getConfiguration();
        const state = config.inspect<boolean>(key);
        if (!state || state.defaultValue === undefined) {
          // Nobody installed contributes this property, so any value still
          // sitting in the settings file belongs to nobody and is ignored.
          return undefined;
        }
        return config.get<boolean>(key) !== false;
      } catch {
        return undefined;
      }
    },
  };
}
