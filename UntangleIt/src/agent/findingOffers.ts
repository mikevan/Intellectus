/**
 * The offer to explain a finding, and the handle that stands for it.
 *
 * **The deterministic product decides that a finding exists and builds the
 * packet. This only offers to explain one that is already established.** The
 * panel never asserts a finding, never chooses a condition, and never
 * assembles a packet from what is on screen. It asks for a handle, and gets
 * one only when a governed packet is already built and waiting behind it.
 *
 * **Why a handle rather than a path and a name.** Every other action in the
 * panel is addressed by `path`, `line` and `name`, and the extension
 * re-resolves it. That is right for "open this method" and wrong for this:
 * re-resolving would mean rebuilding a finding from co-ordinates the
 * interface supplied, and the interface would then be a place a finding
 * could be asserted from. A handle is content-free, local, and good only for
 * looking up a packet this process already built from its own measurements.
 *
 * **UntangleIt reaches two of the five conditions**, because the behaviour
 * gate is the measurement it takes part in. A decision's verification state,
 * unreachable lines and density shortfalls come from an engine it does not
 * have, and there is no affordance for them here because there is nothing
 * for one to sit beside.
 */
import { randomUUID } from 'node:crypto';
import type { GovernancePacket } from '@projectrevivesolutions/witness';
import type { RunFile } from '../runs';
import { behaviourFinding } from './findings';

const OFFERS = new Map<string, GovernancePacket>();
const BY_RUN = new Map<string, string>();
let available = false;

/**
 * Whether Polyglot may offer anything at all.
 *
 * Told to this module rather than asked by it. The panel renders
 * synchronously and the editor's answer is asynchronous, so the wiring point
 * asks `modelsAvailable` and hands the answer here, which keeps this a
 * registry with no editor in it and leaves the one place that touches
 * `lm.selectChatModels` where it was.
 */
export function setAvailability(value: boolean): void {
  available = value;
}

export function offersAreAvailable(): boolean {
  return available;
}

/**
 * Builds a packet for every run whose behaviour gate produced a finding, and
 * forgets the last set.
 *
 * `behaviourFinding` returns undefined for `equivalent` and for a gate that
 * did not run, so a run with neither gets no packet and therefore no offer.
 * That decision is the gate's, read here rather than made here.
 */
export function collectFindings(runs: RunFile | undefined): void {
  OFFERS.clear();
  BY_RUN.clear();
  if (!runs) {
    return;
  }
  for (const run of runs.runs) {
    const packet = behaviourFinding(run);
    if (packet) {
      const handle = randomUUID();
      OFFERS.set(handle, packet);
      BY_RUN.set(run.id, handle);
    }
  }
}

/**
 * The handle for a run the panel is about to draw, or undefined.
 *
 * Undefined means no offer and therefore no button: either the gate produced
 * no finding for this run, or there is no model to ask. The panel does not
 * learn which, because neither changes what it draws.
 */
export function handleForRun(runId: string): string | undefined {
  return available ? BY_RUN.get(runId) : undefined;
}

export function packetForHandle(handle: string): GovernancePacket | undefined {
  return OFFERS.get(handle);
}

export function clearFindingsForTests(): void {
  OFFERS.clear();
  BY_RUN.clear();
  available = false;
}
