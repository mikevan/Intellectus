/**
 * The one answer every layer asks: may Polyglot offer anything agentic?
 *
 * Two reasons, one answer. The editor may have no usable model, or the
 * person may have turned Polyglot's AI assistance off. **Both mean the same
 * thing to every affordance**, which is the whole point: before this
 * existed, model absence suppressed the explanation offers and left the
 * propose affordances alone, so pressing "Fix this" with no model took a
 * checkpoint, wrote a decision and asked the person to authorize an attempt
 * that could not proceed. One gate, one meaning, everywhere.
 *
 * **`modelsAvailable` is not changed and must not be.** It answers a
 * question about the editor and nothing else, which is what lets the
 * structural test pin the one file permitted to touch `lm.selectChatModels`
 * outside the participant handler to a length comparison. The conjunction
 * lives here instead, beside it.
 */
import { modelsAvailable } from './availability';
import { effectiveAgentsEnabled } from './killswitch';
import { configurationReader } from './killswitchReader';

/** Whether the person has left Polyglot's AI assistance on, toolkit-wide. */
export function agentsEnabled(): boolean {
  return effectiveAgentsEnabled(configurationReader());
}

/**
 * Whether an agentic affordance may be offered or begun at all.
 *
 * The switch is asked first because it is free and because a person who
 * turned agents off should not have the editor queried about models on
 * their behalf.
 */
export async function mayOfferAgentic(): Promise<boolean> {
  return agentsEnabled() && (await modelsAvailable());
}
