/**
 * Which explanation interaction a packet is.
 *
 * **Pure, and separate from the participant on purpose.** The participant
 * imports `vscode`, so a decision written inline there could only be tested
 * through the extension host. This is the decision, and nothing else, so the
 * product can prove it holds without one.
 *
 * **Two explanations, not one.** `failure.explain` owns every case where the
 * requested analysis could not complete. `finding.explain` owns the cases
 * where it completed and produced a finding. Both are registered, and both
 * were always meant to be reachable. Routing a finding through the failure
 * spec recorded the wrong interaction id and ran one validator short, because
 * `V-response-shape` is declared by the finding spec and not by the other.
 *
 * **The discriminator is `isFindingCondition`**, the same predicate Witness
 * uses to give a finding packet its constraints. Asking the one predicate
 * means the interaction and the packet cannot come to different conclusions
 * about what is being explained.
 */
import { isFindingCondition } from '@projectrevivesolutions/witness';
import type { GovernancePacket } from '@projectrevivesolutions/witness';
import { FAILURE_EXPLAIN, FINDING_EXPLAIN } from './interactions';

export function explainInteractionFor(packet: GovernancePacket): string {
  return isFindingCondition(packet.classification.condition) ? FINDING_EXPLAIN : FAILURE_EXPLAIN;
}
