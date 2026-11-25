/**
 * Where a validated proposal waits while the person decides to look at it.
 *
 * `Command.arguments` is `any[]` and ends up in the chat response's rendered
 * state, so proposed source text must not travel through it. The button
 * carries an opaque handle; the proposal sits here, keyed by it.
 *
 * **This is not a capability.** It authorizes nothing, because under the
 * Phase 3 answer to M10 nothing is applied: the person makes the change. It
 * is multi-use, because they may reopen the diff as often as they like. And
 * it lives in the extension rather than in Witness, because it is a transport
 * detail and not governance. Three differences from the interaction
 * capability, written down so nobody upgrades it by accident.
 *
 * Only a validated proposal is ever put here. `keep` takes the validation
 * result and refuses one that did not pass, so an unvalidated change set
 * cannot reach a surface the person could act on.
 */
import { randomBytes } from 'node:crypto';
import type { ProposeResponse, ValidationResult } from '@projectrevivesolutions/witness';

export interface KeptProposal {
  readonly handle: string;
  readonly proposal: ProposeResponse;
  readonly interactionId: string;
  readonly keptAt: string;
}

const kept = new Map<string, KeptProposal>();

/** Keeps a validated proposal and returns the handle the button will carry. */
export function keep(interactionId: string, proposal: ProposeResponse, result: ValidationResult): string {
  if (!result.accepted) {
    throw new Error('A proposal that did not pass validation is never kept, because nothing may offer the person a way to act on it.');
  }
  const handle = randomBytes(18).toString('hex');
  kept.set(handle, Object.freeze({ handle, proposal, interactionId, keptAt: new Date().toISOString() }));
  return handle;
}

/** The proposal a handle refers to, or undefined. */
export function find(handle: string): KeptProposal | undefined {
  return kept.get(handle);
}

/** Dropped when the participant is disposed. Nothing outlives the session. */
export function clearProposals(): void {
  kept.clear();
}
