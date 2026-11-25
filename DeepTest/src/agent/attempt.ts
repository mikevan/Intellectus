/**
 * The one authorized attempt waiting for the person to press send.
 *
 * A chat participant cannot be invoked from code, so a governed proposal
 * happens in two moves: a command builds the packet, shows the person the
 * authorization brief, records their answer, and pre-fills the chat; then the
 * person presses send and the participant runs the interaction. This is what
 * connects the two, and it holds exactly what the second half needs and
 * nothing more.
 *
 * **Deliberately one slot and not a queue.** Two pending attempts would let
 * the participant run the one the person is no longer looking at, and the
 * authorization they gave was for a particular brief.
 *
 * **The capability is not here.** It is issued inside the governed sequence,
 * is one-use, and has no business sitting in a module waiting. What is here
 * is the packet, the interaction it is for, the person's recorded answer, and
 * the anchor that will later show whether their change landed.
 *
 * **It is spent on use.** `takePending` clears the slot, so a second send
 * cannot rerun an attempt the person authorized once. That matters because
 * the authorization event is for one brief and a governed request spends
 * their own model quota.
 */
import type { ApplicationAnchor, AuthorizationEvent, GovernancePacket } from '@projectrevivesolutions/witness';

export interface PendingAttempt {
  readonly interactionId: string;
  readonly packet: GovernancePacket;
  /** The person's answer to the brief this packet produced. */
  readonly authorization: AuthorizationEvent;
  /** What would later show the authorized change landed. */
  readonly anchor: ApplicationAnchor;
  /**
   * Where the product's own record of this attempt lives, so the participant
   * can write the attempt id onto it once the capability exists.
   */
  readonly decision: { readonly path: string; readonly line: number };
}

let pending: PendingAttempt | undefined;

export function setPendingAttempt(attempt: PendingAttempt | undefined): void {
  pending = attempt;
}

/** The pending attempt, cleared by the read. One authorization, one attempt. */
export function takePendingAttempt(): PendingAttempt | undefined {
  const held = pending;
  pending = undefined;
  return held;
}

/**
 * Which attempt is waiting, without spending it.
 *
 * A look, not a take, like `hasPendingAttempt`, but it says which attempt:
 * its interaction and the decision it belongs to. Identifiers only, so no
 * packet, evidence, or authorization text leaves this module through it. It
 * exists so the integration suite can prove the governed pre-fill happened
 * and that nothing was sent: the participant takes the attempt when the
 * person presses send, so an attempt still waiting is the evidence.
 */
export function peekPendingAttempt(): { readonly interactionId: string; readonly decision: { readonly path: string; readonly line: number } } | undefined {
  return pending ? { interactionId: pending.interactionId, decision: { path: pending.decision.path, line: pending.decision.line } } : undefined;
}

/** Whether one is waiting. Does not spend it. */
export function hasPendingAttempt(): boolean {
  return pending !== undefined;
}

/** Dropped when the participant is disposed. Nothing outlives the session. */
export function clearPendingAttempt(): void {
  pending = undefined;
}
