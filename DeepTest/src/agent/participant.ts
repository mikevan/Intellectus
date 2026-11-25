/**
 * The governed chat participant: transport, and nothing else.
 *
 * The only place in DeepTest that touches `vscode.lm`, and the only place a
 * request is sent. What it does is move values between VS Code and Witness:
 * the model the person selected goes in, a validated answer comes out, and
 * every decision in between belongs to `runGovernedInteraction`. Rule 47
 * says an adapter carries transport and not product policy, and the way to
 * hold that is to leave no policy here to carry.
 *
 * **The model is always `request.model`.** That is the only API surface
 * exposing the person's choice, and it is documented as the model currently
 * selected in the UI. Polyglot does not select, rank, default to, fall back
 * to, or recommend one (rules 36 to 38). Routing to a model they did not pick
 * spends their quota on our decision, and with premium-request multipliers
 * that is a financial act.
 *
 * **Draining the stream is this file's job; holding it back is Witness's.**
 * `sendRequest` returns text as an async iterable, and the adapter reads it
 * whole into a string before anybody sees anything. Nothing is written to the
 * chat while it drains. That is rules 43 and 44 held where they can be held.
 *
 * **No `followupProvider`.** It would be a second model-access path, and a
 * second path is a second thing to govern. If follow-ups are wanted they come
 * from the already-validated response and make no new request.
 *
 * **Two kinds of interaction reach here since Phase 5**, and the difference
 * is entirely in what the caller prepared. An explanation needs a packet. A
 * proposal needs a packet, the person's recorded answer to the brief that
 * packet produced, a read-only repository, and a parser, because C1 and C2
 * cannot be decided without them and rule 94 refuses the attempt rather than
 * asking a model for something nobody could check. This file still decides
 * nothing: it hands `runGovernedInteraction` what the product prepared.
 *
 * **An authorized attempt is spent on use.** `takePendingAttempt` clears the
 * slot, so pressing send twice cannot run twice on one yes.
 */
import * as vscode from 'vscode';
import { agentsEnabled } from './mayOffer';
import { ModelUnavailable, requireInteraction, runGovernedInteraction } from '@projectrevivesolutions/witness';
import type { ApplicationAnchor, AttemptIdentity, GovernancePacket, GovernanceRecord, ModelPort, RepositoryPort, SurfacePort, SyntaxPort } from '@projectrevivesolutions/witness';
import { explainInteractionFor } from './explainInteraction';
import { keep } from './proposals';
import { takePendingAttempt } from './attempt';

/** How the product hands this file the evidence it should explain. */
export interface ParticipantDeps {
  /** The governed packet for the failure on screen, or undefined if none. */
  currentProblem(): GovernancePacket | undefined;
  /**
   * A read-only view of the workspace, and a parser, for the validators that
   * need them. Undefined when there is no workspace open, in which case rule
   * 94's gate refuses a proposal before the model rather than after it.
   */
  repository(): RepositoryPort | undefined;
  syntax(): SyntaxPort | undefined;
  /**
   * Records an authorized attempt's identity against the product's own
   * decision, once that identity exists.
   *
   * **It must throw rather than swallow a failure.** Witness fails the
   * interaction closed when this does, before the model request, because an
   * attempt whose correlation record does not exist is an attempt no later
   * measurement can be attached to, and sending anyway would spend the
   * person's quota on a result nothing could be joined to.
   */
  recordAttempt(decision: { path: string; line: number }, attempt: AttemptIdentity, anchor: ApplicationAnchor): void;
  /**
   * Makes the governance record durable, before anything the model produced
   * is shown.
   *
   * Witness calls this and renders nothing if it throws, which is how the
   * durability invariant is held: a governed result is not presented as
   * successfully governed until its record exists. The product supplies the
   * directory; Witness owns the format.
   */
  persist(record: GovernanceRecord): void;
  log(line: string): void;
}

export const PARTICIPANT_ID = 'prs.deeptest.governed';

/** Registers the participant. One per extension, disposed with it. */
export function registerParticipant(deps: ParticipantDeps): vscode.Disposable {
  const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, async (request, _context, stream, _token) => {
    // The kill switch, checked BEFORE the pending attempt is taken.
    //
    // `takePendingAttempt` is a take, not a read: one yes authorizes one
    // attempt. Checking after it would burn the person's authorization on a
    // turn that does nothing, and the next turn would find nothing pending.
    //
    // This layer cannot be removed. VS Code shows a manifest-contributed
    // participant whatever we do, which E2 measured rather than assumed, so
    // this is the only thing between a disabled state and a direct
    // invocation. The person asked, so unlike an ambient absence it speaks.
    //
    // It names no single product's setting, because either installed one
    // may be the false one and naming the wrong one sends them to a switch
    // that is already on.
    if (!agentsEnabled()) {
      deps.log('A chat turn arrived while Polyglot AI assistance is disabled. Nothing was sent and no authorized attempt was consumed.');
      return { errorDetails: { message: 'Polyglot AI assistance is disabled. Enable AI assistance in the installed Polyglot extension settings to use this feature.' } };
    }

    // An authorized proposal, if the person just said yes to one. Taken
    // rather than read: one yes authorizes one attempt.
    const authorized = takePendingAttempt();
    if (authorized) {
      const spec = requireInteraction(authorized.interactionId);
      const outcome = await runGovernedInteraction(spec, authorized.packet, {
        model: modelPort(request.model),
        surface: surfacePort(stream, deps.log),
        keepProposal: (proposal, result) => keep(spec.id, proposal, result),
        authorization: authorized.authorization,
        ...(deps.repository() ? { repository: deps.repository()! } : {}),
        ...(deps.syntax() ? { syntax: deps.syntax()! } : {}),
        onCapability: (attempt) => deps.recordAttempt(authorized.decision, attempt, authorized.anchor),
        persist: (record) => deps.persist(record),
      });
      return notGoverned(outcome, deps);
    }

    const packet = deps.currentProblem();
    if (!packet) {
      stream.markdown('There is nothing for me to explain yet. Run "Check my code" first, and if it stops before the tests start I will have something to work from.');
      return {};
    }
    // Which explanation this is, decided by what is being explained. See
    // `explainInteraction.ts` for why that decision does not live here.
    const spec = requireInteraction(explainInteractionFor(packet));
    const outcome = await runGovernedInteraction(spec, packet, {
      model: modelPort(request.model),
      surface: surfacePort(stream, deps.log),
      keepProposal: (proposal, result) => keep(spec.id, proposal, result),
      persist: (record) => deps.persist(record),
    });
    return notGoverned(outcome, deps);
  });
  return participant;
}

/**
 * What the chat turn returns, for the two outcomes that are not a governed
 * answer.
 *
 * `not-recorded` is the durability invariant speaking: the model may have
 * answered perfectly, and Witness showed none of it, because the record that
 * would prove the answer was governed could not be written. The person is
 * told that in those words rather than being shown an ungoverned result with
 * no note that it is one, and the storage error goes to the log intact.
 */
function notGoverned(outcome: { kind: string; sentence?: string; why?: string }, deps: ParticipantDeps): vscode.ChatResult {
  if (outcome.kind === 'model-unavailable') {
    return { errorDetails: { message: outcome.sentence ?? '' } };
  }
  if (outcome.kind === 'not-recorded') {
    deps.log(`Governance History could not be written, so the answer was not shown: ${outcome.why ?? ''}`);
    return { errorDetails: { message: 'Governance History could not be written, so DeepTest did not show this answer as a governed result. The log has the reason.' } };
  }
  return {};
}

/**
 * The person's selected model, wrapped.
 *
 * `request.model` and nothing else. The wrapper exists so Witness can send
 * without importing `vscode`, and it drains the whole response before
 * returning, which is where rules 43 and 44 are actually enforced.
 */
function modelPort(model: vscode.LanguageModelChat): ModelPort {
  return {
    id: model.id,
    vendor: model.vendor,
    family: model.family,
    async send(prompt: string): Promise<string> {
      try {
        const response = await model.sendRequest([vscode.LanguageModelChatMessage.User(prompt)]);
        let whole = '';
        for await (const part of response.text) {
          whole += part;
        }
        return whole;
      } catch (err) {
        // Rule 39. The trigger is a failing request, not a missing field:
        // `ChatRequest.model` is non-optional, so it is always there and the
        // failure is always here.
        if (err instanceof vscode.LanguageModelError) {
          throw new ModelUnavailable(err.code, err.message);
        }
        throw new ModelUnavailable('Unknown', err instanceof Error ? err.message : String(err));
      }
    },
  };
}

/** The chat response surface, wrapped. Validated output only reaches it. */
function surfacePort(stream: vscode.ChatResponseStream, log: (line: string) => void): SurfacePort {
  return {
    progress: (line) => stream.progress(line),
    markdown: (text) => stream.markdown(new vscode.MarkdownString(text)),
    anchor: (path) => {
      const folder = vscode.workspace.workspaceFolders?.[0];
      if (folder) {
        stream.anchor(vscode.Uri.joinPath(folder.uri, path), path);
      }
    },
    button: (title, handle) => stream.button({ title, command: 'deeptest.showProposedChange', arguments: [handle] }),
    log,
  };
}
