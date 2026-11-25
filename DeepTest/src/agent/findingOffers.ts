/**
 * The offer to explain a finding, and the handle that stands for it.
 *
 * **The deterministic product decides that a finding exists and builds the
 * packet. This only offers to explain one that is already established.** The
 * panel never asserts a finding, never chooses a condition, and never
 * assembles a packet from what is on screen. It asks for a handle, and it
 * gets one only when there is a governed packet already built and waiting
 * behind it.
 *
 * **Why a handle rather than a path and a line.** Every other action in the
 * panel is addressed by `path` and `line`, and the extension re-resolves it.
 * That is right for "open this file" and wrong for this: re-resolving would
 * mean rebuilding a finding from co-ordinates the interface supplied, and the
 * interface would then be a route by which a finding could be asserted. A
 * handle is content-free, local, and good only for looking up a packet this
 * process already built from its own measurements. Nothing in the message
 * carries source text, model text, or any part of the finding.
 *
 * **The handle is not a capability and is not secret.** It names an offer, it
 * expires the moment the next set of results replaces it, and the worst a
 * forged one can do is fail to find anything.
 *
 * **Rule 42, ambient absence.** With no model, `handleFor` returns undefined
 * and the panel renders the finding with no button. The finding itself is
 * untouched: same sentence, same numbers, same decision. Nothing is said
 * about the absence.
 */
import { randomUUID } from 'node:crypto';
import type { GovernancePacket } from '@projectrevivesolutions/witness';
import type { AnalysisResult, FileResult, Shortfall } from '../engine/types';
import type { DecidedFunction } from '../decisions/decisions';
import { behaviourFinding, decisionUnverifiedFinding, densityShortfallFinding, unreachableFinding } from './findings';

/**
 * What the panel asks about. Co-ordinates of something already on screen,
 * never a description of it.
 */
export type FindingRef =
  | { readonly kind: 'function'; readonly path: string; readonly startLine: number }
  | { readonly kind: 'line'; readonly path: string; readonly line: number }
  | { readonly kind: 'file'; readonly path: string };

const OFFERS = new Map<string, GovernancePacket>();
const BY_REF = new Map<string, string>();
let available = false;

function key(ref: FindingRef): string {
  return ref.kind === 'function' ? `fn:${ref.path}:${ref.startLine}` : ref.kind === 'line' ? `ln:${ref.path}:${ref.line}` : `fi:${ref.path}`;
}

/**
 * Whether Polyglot may offer anything at all.
 *
 * Told to this module rather than asked by it. The panel renders
 * synchronously and the editor's answer is asynchronous, so the wiring point
 * asks `modelsAvailable` and hands the answer here, which keeps this a
 * registry with no editor in it and leaves the one place that touches
 * `lm.selectChatModels` where it was. Nothing here selects a model or
 * reaches one.
 */
export function setAvailability(value: boolean): void {
  available = value;
}

export function offersAreAvailable(): boolean {
  return available;
}

/**
 * Builds a packet for every finding in this result, and forgets the last
 * set.
 *
 * Called when results land, from the wiring point, so that by the time the
 * panel renders every offer it can make is already backed by a packet. A
 * finding with no packet gets no offer, which is the same rule as a finding
 * with no model.
 */
export function collectFindings(result: AnalysisResult | undefined, decidedFunctions: readonly DecidedFunction[]): void {
  OFFERS.clear();
  BY_REF.clear();
  if (!result) {
    return;
  }
  for (const decided of decidedFunctions) {
    // The deterministic decision state chooses the condition. Two of its
    // kinds are findings and the rest are not, so this reads the state
    // rather than deciding anything, and the decision it passes on is the
    // one that state already carries.
    const state = decided.state;
    const packet = state.kind === 'behaviour-changed' ? behaviourFinding(state.decision) : state.kind === 'unverified' ? decisionUnverifiedFinding(state.decision, state.why) : undefined;
    if (packet) {
      remember({ kind: 'function', path: decided.path, startLine: decided.fn.startLine }, packet);
    }
  }
  for (const shortfall of result.shortfalls) {
    remember({ kind: 'line', path: shortfall.path, line: shortfall.line }, densityShortfallFinding(shortfall as Shortfall));
  }
  for (const file of result.files as readonly FileResult[]) {
    const packet = unreachableFinding(file);
    if (packet) {
      remember({ kind: 'file', path: file.path }, packet);
    }
  }
}

function remember(ref: FindingRef, packet: GovernancePacket): void {
  const handle = randomUUID();
  OFFERS.set(handle, packet);
  BY_REF.set(key(ref), handle);
}

/**
 * The handle for a finding the panel is about to draw, or undefined.
 *
 * Undefined means no offer and therefore no button: either nothing was
 * measured here, or there is no model to ask. The panel does not learn which,
 * because neither changes what it draws.
 */
export function handleFor(ref: FindingRef): string | undefined {
  return available ? BY_REF.get(key(ref)) : undefined;
}

/** The governed packet a handle stands for. Undefined for an unknown handle. */
export function packetForHandle(handle: string): GovernancePacket | undefined {
  return OFFERS.get(handle);
}

export function clearFindingsForTests(): void {
  OFFERS.clear();
  BY_REF.clear();
  available = false;
}
