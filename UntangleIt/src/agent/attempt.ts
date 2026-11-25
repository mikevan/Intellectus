/**
 * The one authorized attempt waiting for the person to press send.
 *
 * A chat participant cannot be invoked from code, so a governed proposal
 * happens in two moves: "Untangle it" builds the packet, shows the person the
 * authorization brief, records their answer, and pre-fills the chat; then the
 * person presses send and the participant runs the interaction. This connects
 * the two, and holds exactly what the second half needs.
 *
 * **One slot, not a queue**, because the authorization they gave was for a
 * particular brief. **Spent on use**, because one yes authorizes one attempt
 * and a governed request spends their own model quota.
 *
 * The capability is not here: it is issued inside the governed sequence, is
 * one-use, and has no business waiting in a module.
 */
import type { ApplicationAnchor, AuthorizationEvent, GovernancePacket } from '@projectrevivesolutions/witness';

export interface PendingAttempt {
  readonly interactionId: string;
  readonly packet: GovernancePacket;
  readonly authorization: AuthorizationEvent;
  readonly anchor: ApplicationAnchor;
  /** The run this attempt belongs to, so its identity can be written there. */
  readonly runId: string;
}

let pending: PendingAttempt | undefined;

export function setPendingAttempt(attempt: PendingAttempt | undefined): void {
  pending = attempt;
}

/**
 * Which attempt is waiting, without spending it.
 *
 * This is a look, not a take: it leaves the slot exactly as it found it, so it
 * cannot use up the person's one yes. It returns the two identifiers and
 * nothing else, so no packet, evidence, or authorization text leaves this
 * module through it. It exists so the integration suite can prove the governed
 * hand-off happened and that nothing was sent: the participant takes the
 * attempt when the person presses send, so an attempt still waiting is the
 * evidence that no send occurred.
 */
export function peekPendingAttempt(): { readonly interactionId: string; readonly runId: string } | undefined {
  return pending ? { interactionId: pending.interactionId, runId: pending.runId } : undefined;
}

/** The pending attempt, cleared by the read. One authorization, one attempt. */
export function takePendingAttempt(): PendingAttempt | undefined {
  const held = pending;
  pending = undefined;
  return held;
}

export function clearPendingAttempt(): void {
  pending = undefined;
}
