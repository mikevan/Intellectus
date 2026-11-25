/**
 * The governed sequence, run once.
 *
 * Rule 23 in code: measure, establish evidence, describe the bounded intent,
 * state the protections, the person authorizes the attempt, the agent acts,
 * the deterministic system re-measures, the system determines the result.
 * The first five happen before this function is called and the last two after
 * it. What is here is the middle: send, accumulate, parse, validate, one
 * correction, abandon, render.
 *
 * It lives in Witness and not in either product, under rule 4. Both DeepTest
 * and UntangleIt need exactly this order, and a copy in each is how the
 * behaviour machinery ended up in a peer in the first place (M1). What the
 * products supply is a thin adapter: an object that can send to the model the
 * person selected, and an object that can write to their screen. Neither type
 * mentions an editor, so rule 45 holds and this file is testable without one.
 *
 * Three things are ordered rather than merely present, and each is a way the
 * product could look governed and not be.
 *
 * **Accumulate, then validate, then render.** Nothing the model produced
 * reaches the person's screen before validation has passed. A renderer that
 * streamed and validated afterwards would have already shown the thing
 * (rules 43, 44).
 *
 * **One correction, then abandon.** The correction carries only the
 * constraint that failed. A second failure ends the interaction, renders no
 * model output at all, and leaves the tree untouched (rules 59, 60, 61).
 *
 * **The verdict never consults the authorization.** An authorized attempt
 * that fails validation is a failed attempt. Nothing in this function reads
 * the person's answer when deciding, and `ValidationResult.accepted` is
 * derived rather than settable, so there is no argument to soften it with
 * (rules 26, 92).
 *
 * Deterministic, and the reason rather than the habit (rule 88). This is the
 * order of the boundaries themselves. An agent deciding when to render, how
 * many corrections to try, or whether a failed validation counted would be
 * deciding whether it is allowed to be trusted.
 */
import { authorizationBrief } from './authorization';
import type { AuthorizationEvent } from './authorization';
import { issueInteraction, redeemInteraction } from './capability';
import type { AttemptId } from './capability';

/**
 * What a product is told about an attempt, and the whole of it.
 *
 * Three correlation values and no powers. `attemptId` joins this attempt to
 * the governance record; `interactionId` says what kind of thing it was;
 * `packetId` is a content digest of what was governed. None of them is a
 * secret, and none of them can be used to reach anything.
 */
export interface AttemptIdentity {
  readonly attemptId: AttemptId;
  readonly interactionId: string;
  readonly packetId: string;
}
import type { Constraint } from './constraints';
import type { GovernancePacket } from './packet';
import { buildPrompt } from './prompt';
import { parseResponse } from './response';
import type { ExplainResponse, ProposeResponse, ValidatableResponse } from './response';
import { validatable } from './response';
import { reconcileConstraints } from './reconcile';
import type { EffectiveConstraints } from './reconcile';
import type { InteractionSpec } from './registry';
import { buildValidationResult, requirePrerequisites, validatorFor, validatorImplemented } from './validators';
import type { ValidationResult, ValidatorOutcome } from './validators';
import type { RepositoryPort } from './repository';
import type { SyntaxPort } from './syntax';
import { buildRecord } from './record';
import type { GovernanceRecord } from './record';

/**
 * What the product's adapter must be able to do with the person's model.
 *
 * `send` returns the complete text. Draining a stream is the adapter's job,
 * because streaming is a transport detail; holding the whole answer back
 * until it has been validated is this file's job, because that is a rule.
 */
export interface ModelPort {
  /** The model the person selected. Never one Polyglot chose. */
  readonly id: string;
  readonly vendor?: string;
  readonly family?: string;
  send(prompt: string): Promise<string>;
}

/** Raised by an adapter when the request to the person's model failed. */
export class ModelUnavailable extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

/** What the product's adapter can put on the person's screen. */
export interface SurfacePort {
  /** Our own words, while we wait. Never model text. */
  progress(line: string): void;
  /** Validated output only. */
  markdown(text: string): void;
  /** A file the person may want to open. */
  anchor(path: string): void;
  /** A control. `handle` is opaque and carries no source text. */
  button(title: string, handle: string): void;
  log(line: string): void;
}

export interface GovernedDeps {
  readonly model: ModelPort;
  readonly surface: SurfacePort;
  /**
   * Called once, when the attempt's identity exists and before the model is
   * reached, so a product can write that identity onto its own record of the
   * same attempt.
   *
   * **Narrowly typed on purpose.** It receives the attempt's identity and
   * nothing else: no capability value, no packet, no constraints, no prompt.
   * The capability value is a one-use secret and has no business in a
   * product's durable store, and a callback that could see the packet would
   * be a callback that could be mistaken for a place to influence one. This
   * cannot alter the reconciled constraints, the authorization, the prompt,
   * the model, or the validation, because it is handed none of them and its
   * return value is ignored.
   *
   * **It fails closed.** If it throws, the interaction stops before the model
   * request. A product whose correlation record could not be written would
   * otherwise have an attempt it cannot later join to a verification, and
   * sending anyway would spend the person's quota on a result nothing could
   * be attached to.
   *
   * It runs after the rule 94 gate and after authorization, so an attempt
   * that never ran leaves no record claiming it did.
   */
  readonly onCapability?: (attempt: AttemptIdentity) => void;
  /**
   * Makes the governance record durable, before anything the model produced
   * is shown.
   *
   * **Why this is a hook and not the product's own next line.** The plan's
   * ordering says the record is durable before the governed result is
   * presented, and the product cannot hold that on its own: rendering
   * happens here, inside this function, and the product only sees the record
   * after the explanation is already on the person's screen. So the sequence
   * is enforced where the sequence actually is.
   *
   * **Witness owns the format; the product owns the location.** This
   * callback is the seam: it receives the record and nothing else, and the
   * product decides which directory it goes in.
   *
   * **It fails closed.** If it throws, the interaction returns
   * `not-recorded` and **nothing the model produced is rendered**. A
   * governed result shown as successfully governed, whose record was never
   * written, is the one outcome the durability invariant forbids: there
   * would be no evidence it was governed at all.
   */
  readonly persist?: (record: GovernanceRecord) => void;
  /**
   * Keeps a validated proposal and returns an opaque handle for it.
   *
   * The handle goes on a button; the proposal does not. A command argument
   * ends up in rendered state, and proposed source text has no business
   * being scattered there. Only ever called with a validated proposal.
   */
  keepProposal?(proposal: ProposeResponse, result: ValidationResult): string;
  /** The authorization the person already gave, for a consequential attempt. */
  readonly authorization?: AuthorizationEvent;
  /**
   * The repository, read-only, for validators that check a proposal against
   * what is actually on disk.
   *
   * Optional because an explain interaction needs none. An interaction that
   * will produce a change set does need one, and rule 94's gate refuses
   * before the model when it is missing rather than discovering it while
   * validating the answer.
   */
  readonly repository?: RepositoryPort;
  /**
   * A parser, read-only, for validators that need a file's structure.
   *
   * Built once by the product, because loading a grammar is asynchronous and
   * a validator is not. Same fail-closed rule as `repository`: an
   * interaction that needs one and has none is refused before the model.
   */
  readonly syntax?: SyntaxPort;
}

export type GovernedOutcome =
  | { readonly kind: 'explained'; readonly response: ExplainResponse; readonly record: GovernanceRecord }
  | { readonly kind: 'proposed'; readonly response: ProposeResponse; readonly handle?: string; readonly record: GovernanceRecord }
  | { readonly kind: 'refused'; readonly reason: string; readonly record: GovernanceRecord }
  /**
   * Two failures, or one that cannot be corrected.
   *
   * `cause` says which, because the person is owed a different sentence for
   * each and because blaming the model for our unreadable repository would
   * be a lie. `constraints`: a validator proved a limit was broken.
   * `response`: the model sent something unusable, twice. `evidence`: a
   * check that applies could not obtain what it needed, which the model
   * cannot fix (rule 94).
   */
  | { readonly kind: 'abandoned'; readonly cause: 'constraints' | 'response' | 'evidence'; readonly problems: readonly string[]; readonly record: GovernanceRecord }
  | { readonly kind: 'model-unavailable'; readonly code: string; readonly sentence: string }
  /**
   * The attempt completed and its governance record could not be made
   * durable, so nothing the model produced was shown.
   *
   * Not a model failure and not a validation failure: the answer may have
   * been perfectly good. What failed is the evidence that it was governed,
   * and without that the result is not a governed result. The product says
   * so; `why` is the storage error, preserved rather than summarised.
   */
  | { readonly kind: 'not-recorded'; readonly why: string; readonly record: GovernanceRecord };

/**
 * What a person is told when their model could not be reached.
 *
 * Static prose, which rule 87 warns against, and deliberately so: three of
 * the four appear when no usable model exists, so there is nothing to
 * generate them with. A product whose error messages need a working model is
 * broken exactly where it has to speak. Rule 39: stop, substitute nothing,
 * change nothing, and report the real condition.
 */
export function modelFailureSentence(code: string, message: string): string {
  switch (code) {
    case 'NoPermissions':
      return 'VS Code has not given Polyglot permission to use a language model. Grant it in VS Code, then try again. Nothing was changed.';
    case 'Blocked':
      return 'Your model provider declined this request, or the quota is spent. Nothing was changed.';
    case 'NotFound':
      return 'The model selected in the chat is not available. Choose another one in the VS Code model picker and send again. Nothing was changed.';
    default:
      return `VS Code reported: ${message} Nothing was changed.`;
  }
}

/** Runs the whole governed middle. See the header for what is ordered and why. */
export async function runGovernedInteraction(spec: InteractionSpec, packet: GovernancePacket, deps: GovernedDeps): Promise<GovernedOutcome> {
  // First, before anything else. A packet may add constraints to the ones its
  // registered interaction requires; it may never omit, weaken, replace, or
  // contradict one (M19). If that does not hold, this is a governance defect,
  // and a governance defect must not cost the person a request against their
  // own model quota, so it fails here: before the authorization brief is
  // built, before a capability exists, and before the model is reached.
  const effective = reconcileConstraints(spec, packet);

  // Second, and for the same reason one step further on. Rule 94: a governed
  // result Polyglot could not validate is not a validated result, so an
  // interaction whose required checks already cannot be completed does not
  // run. Knowable now means refused now: the person is not asked to
  // authorize an attempt Polyglot already knows it cannot check, no
  // capability is issued, and no request is sent against their own quota to
  // discover a defect in how the interaction was assembled.
  //
  // Evidence whose absence only shows up while validating the answer is a
  // different thing, and it lands as `invalid`/`evidence` further down.
  requirePrerequisites(spec, packet, effective, { ...(deps.repository ? { repository: deps.repository } : {}), ...(deps.syntax ? { syntax: deps.syntax } : {}) });

  requireAuthorization(spec, packet, deps, effective);

  const capability = issueInteraction(spec, packet);
  if (deps.onCapability) {
    try {
      deps.onCapability(Object.freeze({ attemptId: capability.attemptId, interactionId: capability.interactionId, packetId: capability.packetId }));
    } catch (err) {
      throw new Error(
        `The attempt ${capability.attemptId} could not be recorded against ${spec.id}, so nothing was sent: ${err instanceof Error ? err.message : String(err)}. An attempt whose record does not exist is an attempt no later measurement can be attached to.`,
      );
    }
  }
  const redeemed = redeemInteraction(capability.value);
  if (!redeemed.ok) {
    throw new Error(`The interaction capability could not be redeemed: ${redeemed.why}`);
  }

  const prompt = buildPrompt(packet, spec, effective);
  deps.surface.progress(packet.objective === 'explain' ? 'Asking the model you selected to explain this.' : 'Asking the model you selected for a proposal.');

  let attempt = await ask(prompt.text, spec, packet, deps, effective);
  if (attempt.kind === 'model-unavailable') {
    return attempt;
  }

  let corrections: 0 | 1 = 0;
  if (!attempt.result.accepted && correctable(attempt.result)) {
    // One correction, carrying only what failed. Nothing is rendered between
    // the two attempts: the person sees one progress line change.
    //
    // Only when the model could actually fix it. A check that could not
    // obtain its evidence is not something a different answer repairs, and
    // asking again would spend the person's own model quota on a condition
    // that has nothing to do with the model (rule 94).
    corrections = 1;
    deps.surface.progress('Its first answer did not hold to the limits. Asking once more.');
    const again = await ask(`${prompt.text}\n\n${correctionNote(attempt.result, effective.constraints)}`, spec, packet, deps, effective);
    if (again.kind === 'model-unavailable') {
      return again;
    }
    attempt = again;
  }

  const record = buildRecord({
    spec,
    packet,
    prompt,
    attemptId: capability.attemptId,
    rawResponse: attempt.raw,
    validation: attempt.result,
    corrections,
    model: { id: deps.model.id, ...(deps.model.vendor ? { vendor: deps.model.vendor } : {}), ...(deps.model.family ? { family: deps.model.family } : {}) },
    ...(deps.authorization ? { authorization: { granted: deps.authorization.granted, at: deps.authorization.at, by: deps.authorization.by, briefDigest: deps.authorization.briefDigest } } : {}),
  });

  // The record becomes durable here, before any branch below renders
  // anything. Every outcome that carries a record passes through this line,
  // so there is one place the ordering can be broken and one place it is
  // held.
  if (deps.persist) {
    try {
      deps.persist(record);
    } catch (err) {
      return { kind: 'not-recorded', why: err instanceof Error ? err.message : String(err), record };
    }
  }

  if (!attempt.result.accepted) {
    // Nothing the model wrote is rendered, at all.
    const cause = abandonmentCause(attempt.result);
    deps.surface.markdown(abandonedSentence(attempt.result, cause));
    deps.surface.log(`Abandoned ${spec.id} (${cause}): ${[...attempt.result.failedConstraints, ...attempt.result.invalidReasons.map((r) => r.id)].join(', ')}`);
    // The problems the person's support case will need. A4: this used to be
    // `attempt.problems`, which is populated only on a parse failure, so the
    // ordinary abandonment returned an empty list exactly when it most
    // needed to say what went wrong.
    return { kind: 'abandoned', cause, problems: problemsOf(attempt), record };
  }

  if (attempt.parsed.kind === 'explain') {
    renderExplanation(attempt.parsed, deps.surface);
    return { kind: 'explained', response: attempt.parsed, record };
  }

  const proposal = attempt.parsed;
  if (proposal.refusal) {
    // Rule 64. A refusal is a correct answer, not a failure.
    deps.surface.markdown(`The model did not propose a change. ${proposal.refusal.reason}`);
    return { kind: 'refused', reason: proposal.refusal.reason, record };
  }
  const handle = deps.keepProposal ? deps.keepProposal(proposal, attempt.result) : undefined;
  renderProposal(proposal, handle, deps.surface);
  return { kind: 'proposed', response: proposal, ...(handle ? { handle } : {}), record };
}

// ---------------------------------------------------------------------------

type Attempt =
  | { kind: 'answered'; raw: string; parsed: ExplainResponse | ProposeResponse; result: ValidationResult; problems: readonly string[] }
  | { kind: 'model-unavailable'; code: string; sentence: string };

async function ask(promptText: string, spec: InteractionSpec, packet: GovernancePacket, deps: GovernedDeps, effective: EffectiveConstraints): Promise<Attempt> {
  let raw: string;
  try {
    raw = await deps.model.send(promptText);
  } catch (err) {
    // Rule 39. The person invoked this; they are owed the real reason.
    const code = err instanceof ModelUnavailable ? err.code : 'Unknown';
    const message = err instanceof Error ? err.message : String(err);
    const sentence = modelFailureSentence(code, message);
    deps.surface.markdown(sentence);
    deps.surface.log(`Model request failed (${code}): ${message}`);
    return { kind: 'model-unavailable', code, sentence };
  }

  const parsed = parseResponse(raw, packet);
  if (!parsed.ok) {
    // A response that does not parse is not shown and not repaired.
    //
    // It is `invalid` and it names no constraint (rule 94, A1). An earlier
    // version stamped this on `effective.constraints[0].id`, which for
    // `failure.explain` is C4, so a model returning broken JSON produced a
    // record saying it had violated the `.keepsafe` recovery boundary. It
    // had not. Nothing was proven violated here, so nothing is accused, and
    // the one correction we allow is spent on the real fault.
    //
    // The cause is `response`, because the model sent this and the model can
    // send something else.
    return {
      kind: 'answered',
      raw,
      parsed: emptyFor(packet),
      result: buildValidationResult(spec.id, [{ id: 'V-response-shape', verdict: 'invalid', cause: 'response', because: parsed.problems.join(' ') }]),
      problems: parsed.problems,
    };
  }
  const result = runValidators(spec, packet, validatable(parsed.value), effective, { ...(deps.repository ? { repository: deps.repository } : {}), ...(deps.syntax ? { syntax: deps.syntax } : {}) });
  return { kind: 'answered', raw, parsed: parsed.value, result, problems: [] };
}

/**
 * Runs the validators the packet names.
 *
 * A validator with no body yet throws rather than being skipped (M14). A
 * skipped validator would report a constraint as checked while nothing
 * checked it, which is the quietest way for governance to stop governing.
 */
function runValidators(spec: InteractionSpec, packet: GovernancePacket, response: ValidatableResponse, effective: EffectiveConstraints, facilities: { readonly repository?: RepositoryPort; readonly syntax?: SyntaxPort }): ValidationResult {
  const outcomes: ValidatorOutcome[] = [];
  for (const id of effective.validators) {
    if (!validatorImplemented(id)) {
      outcomes.push({ id, verdict: 'not-applicable', because: 'This validator has no implementation yet (Phase 4). It reports nothing rather than reporting a pass.' });
      continue;
    }
    // The reconciled set, so a validator decides against exactly the limits
    // the model was given and the person authorized.
    outcomes.push(validatorFor(id).run({ packet, constraints: effective.constraints, response, ...facilities }));
  }
  return buildValidationResult(spec.id, outcomes);
}

/**
 * The one correction, carrying only what failed.
 *
 * Two shapes, because there are two reasons to be here and telling a model
 * it broke a limit when it actually sent malformed output wastes the single
 * attempt on the wrong instruction (A1).
 *
 * A constraint failure names the constraints and their authoritative prose.
 * A response fault names the fault. Neither carries a constraint that
 * passed, any validator internals, or any advice about how to satisfy a
 * check, because that teaches routing around it rather than compliance.
 */
function correctionNote(result: ValidationResult, constraints: readonly Constraint[]): string {
  const failed = constraints.filter((c) => result.failedConstraints.includes(c.id));
  const lines: string[] = [];

  if (failed.length > 0) {
    lines.push('## Your last answer broke a limit', '', 'Send the whole answer again, in the same shape, respecting this:', '');
    for (const c of failed) {
      lines.push(`- [${c.id}] ${c.prose}`);
    }
    for (const o of result.outcomes) {
      if (o.verdict === 'fail') {
        lines.push(`- What went wrong: ${o.because}`);
      }
    }
  }

  // Response faults. Only `response` ones reach here: an `evidence` invalid
  // is something the model cannot fix, so it never earns a correction.
  const faults = result.invalidReasons.filter((r) => r.cause === 'response');
  if (faults.length > 0) {
    if (lines.length > 0) {
      lines.push('');
    }
    lines.push('## Your last answer could not be used', '', 'Send the whole answer again, in the required shape. What was wrong with it:', '');
    for (const f of faults) {
      lines.push(`- ${f.because}`);
    }
  }

  return lines.join('\n');
}

/** Whether a different answer from the model could fix this. Rule 94. */
function correctable(result: ValidationResult): boolean {
  return !result.invalidReasons.some((r) => r.cause === 'evidence');
}

/** Which of rule 94's three outcomes ended this interaction. */
function abandonmentCause(result: ValidationResult): 'constraints' | 'response' | 'evidence' {
  if (result.invalidReasons.some((r) => r.cause === 'evidence')) {
    return 'evidence';
  }
  if (result.failedConstraints.length > 0) {
    return 'constraints';
  }
  return 'response';
}

/** Everything a person or a support case needs, from whichever field holds it. */
function problemsOf(attempt: Extract<Attempt, { kind: 'answered' }>): readonly string[] {
  const fromValidators = attempt.result.outcomes.filter((o) => o.verdict === 'fail' || o.verdict === 'invalid').map((o) => o.because);
  return Object.freeze([...attempt.problems, ...fromValidators]);
}

/**
 * What the person is told, and it is a different sentence for each cause.
 *
 * Telling somebody the assistant broke the limits when the truth is that
 * Polyglot could not read their file blames the model for our condition, and
 * they would go and try a different model.
 */
function abandonedSentence(result: ValidationResult, cause: 'constraints' | 'response' | 'evidence'): string {
  if (cause === 'evidence') {
    const why = result.invalidReasons
      .filter((r) => r.cause === 'evidence')
      .map((r) => r.because)
      .join(' ');
    return `Polyglot could not check this change against your files, so it did not accept it. ${why} Nothing was changed, and nothing the assistant wrote is shown here.`;
  }
  if (cause === 'response') {
    return `The assistant did not send something Polyglot could use, twice. Nothing was changed, and nothing it wrote is shown here.`;
  }
  const which = result.failedConstraints.length > 0 ? ` It kept breaking: ${result.failedConstraints.join(', ')}.` : '';
  return `The assistant's answer did not hold to the limits this change has to respect, twice.${which} Nothing was changed, and nothing it wrote is shown here.`;
}

function renderExplanation(response: ExplainResponse, surface: SurfacePort): void {
  const lines = [`**What is wrong.** ${response.whatIsWrong}`, '', `**Why it happened.** ${response.whyItHappened}`, ''];
  if (response.howToFix) {
    lines.push(`**How to fix it.** ${response.howToFix}`, '');
  }
  if (response.whatNotToChange.length > 0) {
    lines.push('**What not to change.**', '');
    for (const w of response.whatNotToChange) {
      lines.push(`- ${w}`);
    }
  }
  surface.markdown(lines.join('\n'));
}

/**
 * Renders a validated proposal.
 *
 * The summary and the file list, then one control. **The proposed text is not
 * written into the chat and not put in the button.** It lives behind the
 * handle and is shown through a read-only diff, which is the Phase 3 answer
 * to M10 and rests on the evidence in Part XIII of the constitution.
 */
function renderProposal(proposal: ProposeResponse, handle: string | undefined, surface: SurfacePort): void {
  const files = [...new Set(proposal.changeSet.map((e) => e.path))];
  surface.markdown(`The assistant proposes a change to ${files.length === 1 ? 'one file' : `${files.length} files`}. Polyglot has checked it against the limits and does not apply it for you.`);
  for (const f of files) {
    surface.anchor(f);
  }
  if (handle) {
    surface.button('Show me the change', handle);
  }
}

function emptyFor(packet: GovernancePacket): ExplainResponse | ProposeResponse {
  return packet.responseShape === 'explain-envelope'
    ? { kind: 'explain', whatIsWrong: '', whyItHappened: '', howToFix: null, whatNotToChange: [], citedEvidence: [] }
    : { kind: 'propose', changeSet: [], claims: { perEdit: [] } };
}

/**
 * Refuses to run a consequential interaction that nobody authorized.
 *
 * Rules 23 and 92: the authorization comes first, and it is an authorization
 * of a bounded attempt rather than approval of a change the agent has not
 * made yet. Checking it here, before the capability is issued, is what stops
 * a caller from reaching the model and asking afterwards.
 */
function requireAuthorization(spec: InteractionSpec, packet: GovernancePacket, deps: GovernedDeps, effective: EffectiveConstraints): void {
  if (packet.authorization.kind === 'none-required') {
    return;
  }
  const brief = authorizationBrief(packet, spec, effective);
  if (!deps.authorization) {
    throw new Error(`${spec.id} changes the person's project, so it cannot run until they have authorized the attempt (rules 23, 92).`);
  }
  if (!deps.authorization.granted) {
    throw new Error(`${spec.id} was not authorized. Nothing is sent and nothing is changed.`);
  }
  if (deps.authorization.briefDigest !== brief.digest) {
    // They answered a different question from the one this packet asks.
    throw new Error(`The authorization on hand is for a different brief. What the person agreed to is not what this interaction would do, so it does not run.`);
  }
}
