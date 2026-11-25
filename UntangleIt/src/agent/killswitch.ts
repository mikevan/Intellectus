/**
 * The global kill switch: one effective state, read from two settings.
 *
 * **Rule 71 asks for one switch. The platform gave us two rows.** VS Code
 * 1.104.0 refuses to let two independently installable extensions contribute
 * the same configuration property, refuses to let anybody write a property
 * nobody contributed, and refuses to let two extensions contribute the same
 * command id. All three were measured, in the extension development host,
 * with disposable extensions and real manifest shapes. So each product
 * contributes its own setting and the effective state is their conjunction.
 *
 * **Two settings are not two policies.** Nothing reads a key directly. Every
 * layer asks this function, so what the platform made us contribute twice is
 * answered once, and there is no state in which one installed product holds
 * an explicit false while another installed Polyglot product goes on
 * reaching a model. Turning it off anywhere turns it off everywhere.
 *
 * **An unregistered key is true, and that is not the same as reading a
 * default.** VS Code does not remove a person's settings when an extension
 * is uninstalled, so `deeptest.polyglot.agents.enabled: false` can sit in
 * the settings file after DeepTest is gone, where it no longer appears in
 * the Settings UI because nothing registers it. A reader that fell back
 * through a default would return that stale false and disable this product
 * permanently, with no visible way to turn it back on. So `SettingReader`
 * answers `undefined` for a key no installed extension registered, and a
 * value belonging to nobody is ignored rather than obeyed.
 *
 * **No `vscode` import here, on purpose.** This is the decision, and the
 * decision has to be provable in a plain node suite against the real
 * function rather than against a boolean handed to a stub. The editor
 * binding is `killswitchReader.ts`, which is the only file that knows what
 * a configuration is.
 */

/** UntangleIt's own setting. */
export const UNTANGLEIT_AGENTS_KEY = 'untangleit.polyglot.agents.enabled';

/** DeepTest's, read by name and never through its code. */
export const DEEPTEST_AGENTS_KEY = 'deeptest.polyglot.agents.enabled';

/** Both, in the order the conjunction reads them. */
export const AGENT_KEYS: readonly string[] = [UNTANGLEIT_AGENTS_KEY, DEEPTEST_AGENTS_KEY];

/**
 * How the conjunction learns what a setting says.
 *
 * `undefined` means no installed extension registered this key, which is
 * how an uninstalled peer and a never-installed peer both look, and it is
 * deliberately distinct from `false`.
 */
export interface SettingReader {
  registeredValue(key: string): boolean | undefined;
}

/**
 * May Polyglot reach a model at all, across every installed Polyglot product?
 *
 * False when either registered setting says false. True when both say true,
 * and true when the only registered setting says true, which is what keeps
 * each product independently installable.
 */
export function effectiveAgentsEnabled(reader: SettingReader): boolean {
  for (const key of AGENT_KEYS) {
    if (reader.registeredValue(key) === false) {
      return false;
    }
  }
  return true;
}

/**
 * Which installed product turned it off, for the log and for nothing else.
 *
 * **The person is never told to change one named key**, because either
 * installed setting may be the false one and naming the wrong one sends
 * them to a switch that is already on.
 */
export function disabledBy(reader: SettingReader): readonly string[] {
  return AGENT_KEYS.filter((key) => reader.registeredValue(key) === false);
}
