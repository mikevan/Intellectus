/**
 * The last failure worth explaining, so the participant can find it.
 *
 * UntangleIt reports a problem through the run's own report channel rather
 * than holding it on its result state, so there is nowhere else for the chat
 * participant to read it from. The person invokes the participant seconds
 * after seeing the warning, and this is what connects the two.
 *
 * Deliberately one slot and not a history. The question is always "what just
 * stopped this run", and a queue would let the participant answer about a
 * failure that is no longer on screen.
 */
import type { GovernancePacket } from '@projectrevivesolutions/witness';

let current: GovernancePacket | undefined;

export function setCurrentProblem(packet: GovernancePacket | undefined): void {
  current = packet;
}

export function currentProblem(): GovernancePacket | undefined {
  return current;
}
