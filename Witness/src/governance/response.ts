/**
 * The two response envelopes, and the parse boundary.
 *
 * Schemas and parsing only. Nothing here contacts a model, opens a chat
 * surface, or knows an editor exists. Transport is Phase 3 and lives in the
 * products' adapters.
 *
 * The rule this file exists to hold: validation examines the actual proposal
 * and the resulting change set, never the model's statement that it complied
 * (rule 51). A model that says "I respected C1" and edited a test is the
 * ordinary case, not the adversarial one, because a model reporting on its
 * own work is doing the thing rule 26 forbids.
 *
 * So a compliance claim is kept, and quarantined. It lives on `claims`, and
 * `ValidatableResponse` omits that field, so a validator is handed a type
 * that does not contain it and cannot read it. Not a comment, not a code
 * review item, not a convention somebody remembers: the claim is absent from
 * the value a validator receives.
 *
 * Why keep it at all. A mismatch between what a model claimed and what the
 * validators found is itself worth recording, and Phase 4 may record it.
 * Nothing may act on it.
 *
 * Deterministic, with the reason (rule 88). This is the boundary where
 * unvalidated output is stopped (rules 43, 44). A schema an agent negotiates
 * at runtime is not a schema, and a parser that repairs malformed output is
 * a parser that invents content nobody sent.
 */
import type { ConstraintId } from './constraints';
import type { GovernancePacket } from './packet';

// ---------------------------------------------------------------------------
// explain
// ---------------------------------------------------------------------------

/**
 * The four questions, in the order the contract states them, plus what the
 * answer rests on.
 *
 * `howToFix` is null rather than absent when the packet is unclassified. The
 * shape then makes the absence deliberate and visible, instead of leaving a
 * reader to wonder whether the field went missing.
 */
export interface ExplainResponse {
  readonly kind: 'explain';
  readonly whatIsWrong: string;
  readonly whyItHappened: string;
  readonly howToFix: string | null;
  readonly whatNotToChange: readonly string[];
  /** Indices into `packet.evidence`, so a claim can be traced to what it rests on. */
  readonly citedEvidence: readonly number[];
}

// ---------------------------------------------------------------------------
// propose
// ---------------------------------------------------------------------------

/**
 * One edit, with enough of the world in it to check the edit itself.
 *
 * `before` is the exact existing text of what is being replaced, required on
 * a modify. Phase 4 compares it against the file on disk, which is how a
 * change set is validated against reality rather than against a description
 * of reality. A summary of an edit is a claim; the text of an edit is not.
 */
export interface ProposedEdit {
  /** Workspace-relative, forward slashes. */
  readonly path: string;
  readonly operation: 'create' | 'modify';
  /** Required for modify, absent for create. */
  readonly before?: string;
  readonly after: string;
}

/** What the model says about its own compliance. Quarantined. See the header. */
export interface ResponseClaims {
  readonly perEdit: readonly { readonly path: string; readonly respects: readonly ConstraintId[] }[];
  readonly summary?: string;
}

export interface ProposeResponse {
  readonly kind: 'propose';
  readonly changeSet: readonly ProposedEdit[];
  /** Refusal is a first-class outcome (rule 64), not an error. */
  readonly refusal?: { readonly reason: string };
  readonly claims: ResponseClaims;
}

/**
 * What a validator is handed.
 *
 * `claims` is omitted, which is the whole mechanism. A validator cannot
 * consult the model's account of its own work because that account is not
 * in the type it receives.
 */
export type ValidatableResponse = ExplainResponse | Omit<ProposeResponse, 'claims'>;

/** Strips the claims. The only supported route from a response to a validator. */
export function validatable(response: ExplainResponse | ProposeResponse): ValidatableResponse {
  if (response.kind === 'explain') {
    return response;
  }
  const { claims: _claims, ...rest } = response;
  return rest;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export type ParseResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly problems: readonly string[] };

/**
 * Parses an explain response, or says why it could not.
 *
 * Never throws, never returns a partial value, and never repairs. A response
 * that does not parse is a response nobody sees, which is rules 43 and 44
 * applied at the only place they can be applied.
 */
export function parseExplain(raw: string, packet: GovernancePacket): ParseResult<ExplainResponse> {
  const parsed = readJson(raw);
  if (!parsed.ok) {
    return parsed;
  }
  const o = parsed.value;
  const problems: string[] = [];
  if (o.kind !== 'explain') {
    problems.push(`This is not an explain response: kind is ${JSON.stringify(o.kind)}.`);
  }
  for (const field of ['whatIsWrong', 'whyItHappened'] as const) {
    if (typeof o[field] !== 'string' || (o[field] as string).trim() === '') {
      problems.push(`${field} is required and must say something.`);
    }
  }
  if (o.howToFix !== null && typeof o.howToFix !== 'string') {
    problems.push('howToFix is a string, or null when there is no established cause to fix.');
  }
  if (packet.classification.confidence === 'unclassified' && o.howToFix !== null) {
    // Rule 20, at the parse boundary. Nothing was established, so a fix is
    // a cause asserted in the shape of a remedy.
    problems.push('This packet is unclassified, so howToFix must be null. A fix names a cause, and none was established.');
  }
  if (!isStringArray(o.whatNotToChange)) {
    problems.push('whatNotToChange is a list of strings.');
  }
  if (!Array.isArray(o.citedEvidence) || (o.citedEvidence as unknown[]).some((n) => !Number.isInteger(n) || (n as number) < 0 || (n as number) >= packet.evidence.length)) {
    problems.push(`citedEvidence holds indices into the packet's ${packet.evidence.length} pieces of evidence.`);
  }
  if (problems.length > 0) {
    return { ok: false, problems };
  }
  return {
    ok: true,
    value: {
      kind: 'explain',
      whatIsWrong: o.whatIsWrong as string,
      whyItHappened: o.whyItHappened as string,
      howToFix: (o.howToFix as string | null) ?? null,
      whatNotToChange: [...(o.whatNotToChange as string[])],
      citedEvidence: [...(o.citedEvidence as number[])],
    },
  };
}

/** Parses a propose response, or says why it could not. Same rules as above. */
export function parsePropose(raw: string, packet: GovernancePacket): ParseResult<ProposeResponse> {
  const parsed = readJson(raw);
  if (!parsed.ok) {
    return parsed;
  }
  const o = parsed.value;
  const problems: string[] = [];
  if (o.kind !== 'propose') {
    problems.push(`This is not a propose response: kind is ${JSON.stringify(o.kind)}.`);
  }
  if (packet.objective !== 'propose') {
    problems.push('This packet did not ask for a proposal, so a change set cannot be accepted against it.');
  }
  const refusal = o.refusal as { reason?: unknown } | undefined;
  if (refusal !== undefined && (typeof refusal !== 'object' || refusal === null || typeof refusal.reason !== 'string' || refusal.reason.trim() === '')) {
    problems.push('A refusal carries a reason a person can read.');
  }
  const edits: ProposedEdit[] = [];
  if (!Array.isArray(o.changeSet)) {
    problems.push('changeSet is a list of edits. An empty list is allowed, and a refusal should carry one.');
  } else {
    (o.changeSet as unknown[]).forEach((raw, i) => {
      const e = raw as Partial<ProposedEdit>;
      if (!e || typeof e !== 'object') {
        problems.push(`Edit ${i} is not an edit.`);
        return;
      }
      if (typeof e.path !== 'string' || e.path.trim() === '') {
        problems.push(`Edit ${i} needs a workspace-relative path.`);
        return;
      }
      if (e.operation !== 'create' && e.operation !== 'modify') {
        problems.push(`Edit ${i} (${e.path}) must be a create or a modify.`);
        return;
      }
      if (typeof e.after !== 'string') {
        problems.push(`Edit ${i} (${e.path}) needs the text it results in.`);
        return;
      }
      if (e.operation === 'modify' && typeof e.before !== 'string') {
        // Without it there is nothing to check the edit against except the
        // model's description of what was there.
        problems.push(`Edit ${i} (${e.path}) is a modify, so it must carry the exact existing text it replaces.`);
        return;
      }
      if (e.operation === 'create' && e.before !== undefined) {
        problems.push(`Edit ${i} (${e.path}) creates a file, so there is nothing it replaces.`);
        return;
      }
      edits.push(e.operation === 'modify' ? { path: e.path, operation: 'modify', before: e.before as string, after: e.after } : { path: e.path, operation: 'create', after: e.after });
    });
  }
  if (problems.length > 0) {
    return { ok: false, problems };
  }
  return {
    ok: true,
    value: {
      kind: 'propose',
      changeSet: edits,
      ...(refusal ? { refusal: { reason: refusal.reason as string } } : {}),
      claims: readClaims(o.claims),
    },
  };
}

/**
 * The response the packet's shape asks for, chosen from the packet rather
 * than from what arrived, so a model cannot pick its own envelope.
 */
export function parseResponse(raw: string, packet: GovernancePacket): ParseResult<ExplainResponse | ProposeResponse> {
  return packet.responseShape === 'explain-envelope' ? parseExplain(raw, packet) : parsePropose(raw, packet);
}

function readJson(raw: string): ParseResult<Record<string, unknown>> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (err) {
    return { ok: false, problems: [`The response is not valid JSON: ${err instanceof Error ? err.message : String(err)}`] };
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, problems: ['The response is a JSON object.'] };
  }
  return { ok: true, value: value as Record<string, unknown> };
}

/** Claims are read permissively because nothing depends on them. */
function readClaims(raw: unknown): ResponseClaims {
  const o = (raw ?? {}) as { perEdit?: unknown; summary?: unknown };
  const perEdit = Array.isArray(o.perEdit)
    ? (o.perEdit as unknown[])
        .map((c) => c as { path?: unknown; respects?: unknown })
        .filter((c) => typeof c?.path === 'string')
        .map((c) => ({ path: c.path as string, respects: (Array.isArray(c.respects) ? (c.respects as unknown[]).filter((r): r is string => typeof r === 'string') : []) as readonly ConstraintId[] }))
    : [];
  return { perEdit, ...(typeof o.summary === 'string' ? { summary: o.summary } : {}) };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

// ---------------------------------------------------------------------------
// The shape, described for the prompt
// ---------------------------------------------------------------------------

/**
 * The required response shape, as text the prompt renders.
 *
 * It lives here, next to the parser, so the instruction and the thing that
 * enforces it cannot drift. A prompt that described a field the parser
 * rejects would fail every response for a reason nobody could see.
 */
export function describeResponseShape(packet: GovernancePacket): string[] {
  if (packet.responseShape === 'explain-envelope') {
    return [
      'Reply with one JSON object and nothing else:',
      '',
      '{',
      '  "kind": "explain",',
      '  "whatIsWrong": "one or two sentences",',
      '  "whyItHappened": "one or two sentences",',
      packet.classification.confidence === 'unclassified' ? '  "howToFix": null,' : '  "howToFix": "what to do about it",',
      '  "whatNotToChange": ["one line per limit that matters here"],',
      `  "citedEvidence": [indices into the evidence above, 0 to ${Math.max(0, packet.evidence.length - 1)}]`,
      '}',
    ];
  }
  return [
    'Reply with one JSON object and nothing else:',
    '',
    '{',
    '  "kind": "propose",',
    '  "changeSet": [',
    '    { "path": "src/example.ts", "operation": "modify", "before": "the exact text you are replacing", "after": "the text it becomes" },',
    '    { "path": "src/new.test.ts", "operation": "create", "after": "the whole new file" }',
    '  ],',
    '  "refusal": { "reason": "only when you cannot meet the objective inside the limits" },',
    '  "claims": { "perEdit": [{ "path": "src/example.ts", "respects": ["C1", "C4"] }] }',
    '}',
    '',
    'On "before": it must be the exact text as it stands today, character for character. The change set is checked against the files themselves.',
    'On "claims": state them if you wish. They are recorded and they are not trusted. Every limit is checked against the change set you actually sent.',
  ];
}
