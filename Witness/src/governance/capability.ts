/**
 * The interaction capability: permission to make one governed model request.
 *
 * Rule 49 requires registry authorization and identity before a governed
 * request is sent. This is that identity, in a form the transport adapter
 * cannot manufacture for itself. The adapter holds a string; only this module
 * can turn one into permission, and only from a registered spec and a built
 * packet. So a capability cannot exist for an interaction nobody registered,
 * or for a packet that never passed `buildPacket`.
 *
 * One kind, not two. An earlier design had a second capability authorizing
 * the application of a validated change set. Under the Phase 3 answer to M10
 * nothing is applied by us, so that capability would have authorized nothing,
 * and a type in the shared layer whose name promises a power the product does
 * not have is worse than no type at all. If a later release gains an apply
 * path it gets its own capability, issued from a validated result, and this
 * one still will not serve for it.
 *
 * One use. A capability is spent on redemption, so a leaked or replayed value
 * buys nothing. It expires as well, because a value that is valid forever is
 * a value that outlives the reason it was issued.
 *
 * Deterministic, and the reason rather than the habit (rule 88). This is the
 * authorization boundary for spending the person's model quota. Rules 48 and
 * 49 are unenforceable if any part of it is a judgment.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import type { GovernancePacket } from './packet';
import type { InteractionId, InteractionSpec } from './registry';
import { isRegistered } from './registry';

/**
 * One attempt at one governed interaction.
 *
 * Created by Polyglot when a capability is issued, which is the moment an
 * attempt is authorized to proceed. **Never by the model**, which never sees
 * it, and never derived from customer content.
 *
 * Random rather than derived, and that is the opposite of every other
 * identity in the governance record. The others are hashes because a hash
 * proves identity without holding the material. An attempt has no material to
 * prove, so a digest of content here would be strictly worse: it would be the
 * one field in the record that somebody holding a guess at the content could
 * correlate back to it. Random is content-free by construction (rule 70).
 *
 * It is not the interaction id, which names a **type** and stays semantic and
 * stable under rule 91. It is not the capability value, which is a one-use
 * secret and must never reach a product's durable store. It is not the packet
 * id, which is a content digest. And it is deliberately not the application
 * anchor: an identity that also carried evidence would be a digest of
 * content, which is what this paragraph rules out.
 */
export type AttemptId = string;

/** A fresh attempt identity. */
export function newAttemptId(): AttemptId {
  return randomUUID();
}

/** Permission to make one governed model request and its single correction. */
export interface InteractionCapability {
  readonly kind: 'interaction';
  /** Opaque. Carries no meaning outside this module. */
  readonly value: string;
  readonly interactionId: InteractionId;
  readonly packetId: string;
  /**
   * Which attempt this is. Safe to write into a product's durable store,
   * unlike `value`, and it is the join between a governance record and the
   * product's own record of the same attempt.
   */
  readonly attemptId: AttemptId;
  readonly issuedAt: string;
}

export type Redeemed<T> = { readonly ok: true; readonly capability: T } | { readonly ok: false; readonly why: string };

export class CapabilityError extends Error {}

/** How long a capability is good for. Long enough for a slow model, short enough to expire. */
const LIFETIME_MS = 15 * 60 * 1000;

const issued = new Map<string, { capability: InteractionCapability; expiresAt: number; spent: boolean }>();

/**
 * Issues a capability for one governed request.
 *
 * Both arguments are checked rather than trusted. An unregistered spec has no
 * objective, no constraints, and no validators, so a request made under it
 * would be governed by nothing; and a packet whose id does not match its
 * content did not come from `buildPacket`.
 */
export function issueInteraction(spec: InteractionSpec, packet: GovernancePacket): InteractionCapability {
  if (!isRegistered(spec.id)) {
    throw new CapabilityError(`${spec.id} is not registered, so there is nothing to authorize. An unregistered interaction has no objective, no constraints, and no validators.`);
  }
  if (spec.objective !== packet.objective) {
    throw new CapabilityError(`The packet declares the objective ${packet.objective} and ${spec.id} declares ${spec.objective}. One of them is wrong and neither is safe to guess at.`);
  }
  const capability: InteractionCapability = Object.freeze({
    kind: 'interaction',
    value: randomBytes(24).toString('hex'),
    interactionId: spec.id,
    packetId: packet.id,
    attemptId: newAttemptId(),
    issuedAt: new Date().toISOString(),
  });
  issued.set(capability.value, { capability, expiresAt: Date.now() + LIFETIME_MS, spent: false });
  return capability;
}

/**
 * Spends a capability, or says why it cannot be spent.
 *
 * Returns a result rather than throwing, because every one of these is a
 * condition the caller has to report to a person rather than a crash.
 */
export function redeemInteraction(value: string): Redeemed<InteractionCapability> {
  const held = issued.get(value);
  if (!held) {
    return { ok: false, why: 'This is not a capability this session issued. Nothing was sent.' };
  }
  if (held.spent) {
    return { ok: false, why: 'This capability has already been used. Each one authorizes a single request.' };
  }
  if (Date.now() > held.expiresAt) {
    issued.delete(value);
    return { ok: false, why: 'This capability has expired. Ask again and a fresh one is issued.' };
  }
  held.spent = true;
  return { ok: true, capability: held.capability };
}

/** Whether a value is a live, unspent capability. Does not spend it. */
export function capabilityIsLive(value: string): boolean {
  const held = issued.get(value);
  return Boolean(held && !held.spent && Date.now() <= held.expiresAt);
}

/** Test support. Production code never clears the store. */
export function clearCapabilitiesForTests(): void {
  issued.clear();
}
