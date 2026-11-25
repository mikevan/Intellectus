/**
 * The problem packet: what the toolkit knows about a failure, in a shape an
 * assistant can turn into guidance.
 *
 * The division of labour, ruled 2026-09-23. Polyglot owns detection,
 * evidence, and guardrails. Copilot owns the human explanation and the
 * guided remediation. Neither does the other's job.
 *
 * The reason for the split is what the old design cost. Every recognised
 * failure carried a hand-written paragraph, and that paragraph had to be
 * rewritten for every audience, every runner, and every wording change,
 * with a test pinning each sentence. Four rounds of that on one condition
 * was enough to see where it ends: an encyclopedia of prose inside a
 * measurement tool, maintained by hand, out of date the week it ships.
 *
 * So the toolkit stops writing prose. It writes down what it established,
 * what it could not establish, and what must not be recommended, and it
 * hands that over. A packet is facts and boundaries. The sentences are
 * somebody else's job.
 *
 * The two rules that keep this honest:
 *
 *   Copilot is never asked to diagnose from scratch. When the toolkit has
 *   deterministic evidence, the classification comes from the toolkit, and
 *   the assistant translates it. An assistant guessing at a cause we already
 *   know is how a person gets sent to the wrong place.
 *
 *   When the toolkit cannot classify a failure, it says so in the packet
 *   rather than inventing a category. The brief then tells the assistant to
 *   explain what the evidence shows and to stop there. "We do not know" is
 *   an answer; a confident wrong answer is not.
 *
 * Phase 2 note, 2026-09-23. `ProblemPacket` is now a compatibility VIEW of
 * the governance packet in `governance/packet.ts`, not a model of its own.
 * Its shape has not changed and both products consume it unaltered, but
 * everything that produces one now builds a governance packet first and
 * renders this shape from it. The direction is one way: there is no
 * conversion back, because this shape carries no typed evidence, no
 * structured constraints, no objective, no validators, no authorization
 * boundary, and no verification rule, and a reverse conversion would have to
 * invent all six. See the header of `governance/packet.ts`.
 */
import type { Runner } from './delivery';
import { POLYGLOT_CONSTRAINTS, UNCLASSIFIED_CONSTRAINT } from './governance/constraints';
import { NOTHING_TO_VERIFY, NO_AUTHORIZATION_NEEDED, ONE_CORRECTION, buildPacket, toProblemPacket } from './governance/packet';
import type { EvidenceItem, GovernancePacket } from './governance/packet';

/** What the toolkit established about a failure, and what it did not. */
export interface ProblemPacket {
  /**
   * The condition, by name, stable enough for a product or a test to refer
   * to it. `unclassified` when the toolkit could not place the failure.
   */
  condition: string;
  /** Broad kind of failure, for the assistant to frame its answer around. */
  category: string;
  /**
   * Whether the classification rests on deterministic evidence. An
   * unclassified packet carries evidence and nothing more; nothing
   * downstream may present it as a diagnosis.
   */
  confidence: 'classified' | 'unclassified';
  /**
   * The runner that failed, in words a person would recognise.
   *
   * **Absent when the failure happened before a runner was selected.** The
   * view does not fill it in, and nothing downstream may put a stand-in
   * where a measured name would go.
   */
  runner?: string;
  /** One line for a notification. Not an explanation, and never a wall. */
  headline: string;
  /**
   * What the person may be offered. `explain` is always available.
   * `fix` only where a code change is genuinely the remedy, which is why
   * the path condition does not carry it: the fix is moving a folder, and
   * an assistant writing code to compensate is the outcome we forbid.
   */
  actions: Array<'explain' | 'fix'>;
  /** Verbatim lines from the runner. Never paraphrased. */
  evidence: string[];
  /** Path and configuration facts the explanation needs. */
  context: Array<{ name: string; value: string }>;
  /** Statements the toolkit is prepared to stand behind. */
  known: string[];
  /** Questions this run cannot answer, so that nobody fills them in. */
  unknown: string[];
  /** Remediation the toolkit is confident in. Empty when unclassified. */
  remediation: string[];
  /** Binding limits on what may be recommended or changed. */
  constraints: string[];
}

/**
 * A packet for a failure the toolkit could not place.
 *
 * This exists so that "we do not know" travels in the same shape as
 * everything else. The alternative is a product that falls silent whenever
 * its rules miss, which leaves the person with a raw log and no help at all.
 */
export function unclassifiedPacket(options: { runner?: string; evidence: string[]; context?: Array<{ name: string; value: string }>; headline?: string }): ProblemPacket {
  return toProblemPacket(unclassifiedGovernancePacket(options));
}

/**
 * The same thing in the governed model, which is the authoritative one.
 *
 * A governed interaction consumes this. `unclassifiedPacket` above renders
 * the 1.0.19 view from it, and nothing converts that view back (rule 90).
 */
export function unclassifiedGovernancePacket(options: {
  /**
   * The runner that failed, when one ran. **Omitted when the failure
   * happened before a runner was selected**, which is an environment gate
   * refusing, or an exception thrown before the run began. There is no
   * stand-in: the packet then carries no runner, says so, and the person is
   * told the failure came before a runner was chosen.
   */
  runner?: string;
  evidence: string[];
  context?: Array<{ name: string; value: string }>;
  headline?: string;
}): GovernancePacket {
  // With no runner there is no runner output, so the evidence is what the
  // toolkit observed and is labelled as that. This changes how the same
  // facts are described, and collects nothing new.
  const item = options.runner === undefined
    ? (text: string): EvidenceItem => ({ origin: 'observation', text, source: 'witness' })
    : (text: string): EvidenceItem => ({ origin: 'runner-output', text, source: options.runner! });
  return buildPacket({
    evidence: options.evidence.map(item),
    classification: {
      // The class that says no class was established. Naming any other
      // would be naming a cause, which is exactly what did not happen.
      failureClass: 'insufficient-evidence',
      condition: 'unclassified',
      confidence: 'unclassified',
      label: 'unknown',
    },
    objective: 'explain',
    allowed: { readable: [], proposable: [], mayPropose: false },
    constraints: [UNCLASSIFIED_CONSTRAINT],
    validators: ['V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: NO_AUTHORIZATION_NEEDED,
    verification: NOTHING_TO_VERIFY,
    ...(options.runner === undefined ? {} : { runner: options.runner }),
    headline: options.headline ?? (options.runner === undefined ? 'The check could not start, and the toolkit could not work out why.' : `${options.runner} failed, and the toolkit could not work out why.`),
    context: options.context ?? [],
    known: [options.runner === undefined ? 'The failure happened before a test runner was selected, so no runner ran.' : `${options.runner} did not finish successfully.`],
    unknown: ['What caused the failure. The toolkit has no rule that matches this output, so the cause is genuinely not established.'],
    remediation: [],
    offers: ['explain'],
  });
}

/**
 * The brief handed to the assistant.
 *
 * Same shape of hand-off as the untangle brief: a markdown document stating
 * the job, the facts, and what done looks like. Written so a capable model
 * gets it right and a weak one cannot mistake it for an invitation to
 * speculate.
 */
export function buildFailureBrief(packet: ProblemPacket): string {
  const lines: string[] = [];
  const classified = packet.confidence === 'classified';

  lines.push(`# Explain a test run that failed before the tests started`);
  lines.push('');
  lines.push(
    classified
      ? 'This failure has already been diagnosed. The classification and the evidence below come from deterministic checks that have already run. Do not diagnose it again from scratch, and do not go looking for a different cause. Your job is to turn what is below into guidance a person can act on.'
      : 'This failure has NOT been diagnosed. The checks that ran did not match it, so the cause is not known. Explain what the evidence below shows and say plainly what it does not establish. Do not name a cause it does not support.',
  );
  lines.push('');
  lines.push('Answer these four questions, in this order, in plain language:');
  lines.push('');
  lines.push('1. What is wrong?');
  lines.push('2. Why did it happen?');
  lines.push(classified ? '3. How do I fix it?' : '3. What would narrow this down?');
  lines.push('4. What should I not change?');
  lines.push('');
  lines.push('## How to answer');
  lines.push('');
  lines.push('- Use only the facts in this brief. If something is not here, say it is not known rather than filling the gap.');
  lines.push('- Everything under "What is not known" is genuinely unknown. Do not guess at it, and do not present a guess as a possibility worth acting on.');
  lines.push('- Every line under "What must not change" is binding. Do not recommend anything that breaks one, however reasonable it looks.');
  lines.push('- Keep it short. Somebody is stuck and wants to get unstuck.');
  lines.push('');
  lines.push('## The failure');
  lines.push('');
  // No runner means no runner ran, and the line says that rather than
  // printing an empty label or a substitute for a name nobody measured.
  lines.push(packet.runner === undefined ? '- Runner or framework: none. The failure happened before a test runner was selected.' : `- Runner or framework: ${packet.runner}`);
  lines.push(`- Category: ${packet.category}`);
  lines.push(`- Classified from deterministic evidence: ${classified ? 'yes' : 'no'}`);
  lines.push('');

  if (packet.context.length > 0) {
    lines.push('## Context');
    lines.push('');
    for (const c of packet.context) {
      lines.push(`- ${c.name}: ${c.value}`);
    }
    lines.push('');
  }

  lines.push('## What is known');
  lines.push('');
  for (const k of packet.known) {
    lines.push(`- ${k}`);
  }
  lines.push('');

  lines.push('## What is not known');
  lines.push('');
  for (const u of packet.unknown) {
    lines.push(`- ${u}`);
  }
  lines.push('');

  if (packet.remediation.length > 0) {
    lines.push('## The remediation to explain');
    lines.push('');
    lines.push('This is the fix. Explain it in your own words so the person understands why it works. Do not replace it with a different one.');
    lines.push('');
    for (const r of packet.remediation) {
      lines.push(`- ${r}`);
    }
    lines.push('');
  }

  lines.push('## What must not change');
  lines.push('');
  for (const c of packet.constraints) {
    lines.push(`- ${c}`);
  }
  lines.push('');

  lines.push('## Exact error evidence');
  lines.push('');
  lines.push('Verbatim from the runner. Quote from it if it helps; do not rewrite it.');
  lines.push('');
  lines.push('```');
  for (const e of packet.evidence) {
    lines.push(e);
  }
  lines.push('```');

  return lines.join('\n');
}

/** The runner in the words a person would recognise. */
export function describeRunner(runner: Runner): string {
  switch (runner) {
    case 'ng-karma':
      return "Angular's unit-test builder with Karma";
    case 'ng-vitest':
      return "Angular's unit-test builder with Vitest";
    case 'playwright-ct':
      return 'Playwright component tests';
    default:
      return runner;
  }
}

// ---------------------------------------------------------------------------
// M6: the one failure class Polyglot can prove about itself
// ---------------------------------------------------------------------------

/**
 * The counts a run produces about its own instrumentation.
 *
 * Every field is already computed on every run and already rendered to the
 * person. **Nothing here is new collection**, which is the point: M6 adds a
 * classification, not a measurement.
 */
export interface InstrumentationEvidence {
  /** Tests the runner reported as finished: passed plus failed. */
  readonly testsFinished: number;
  /** Per-test attribution records the hooks wrote. */
  readonly testsRecorded: number;
  /** Records carrying at least one file. */
  readonly recordsWithEvidence: number;
  /** Measured files with at least one line that executed. */
  readonly filesWithHits: number;
  /** Records whose test boundary was broken. */
  readonly brokenBoundaries: number;
  /** Whether the runner's own count and the records can be lined up at all. */
  readonly reconcilable: boolean;
}

/** The three shapes that prove Polyglot's instrumentation failed. */
export type InstrumentationCondition = 'instrumented-nothing' | 'broken-boundary' | 'records-missing';

/**
 * Was this run's failure Polyglot's own instrumentation, provably?
 *
 * **The only place in the toolkit where the `polyglot` failure class is
 * selectable**, and it is selectable here because three of the four shapes
 * a run can be refused on are statements about Polyglot's instrumentation
 * rather than about the person's project.
 *
 * **Tests finished and not one line was recorded.** The person's tests ran
 * and Polyglot observed nothing. No healthy run takes this shape. Angular
 * under Vitest did exactly this from 1.0.12 to 1.0.14, reporting a fully
 * tested project as entirely untested while the record count reconciled
 * perfectly, which is why the check exists at all.
 *
 * **A test boundary was broken.** Witness's own `begin` and `end` machinery
 * failed to keep one test's lines apart from the next test's.
 *
 * **Fewer records than tests finished**, while the counts still reconcile.
 * The runner says N tests finished and Polyglot's hooks wrote fewer than N
 * records. The reconciliation is what makes this a proof rather than a
 * guess, which is why it is checked.
 *
 * **Not reconcilable returns `undefined`.** Polyglot cannot line the counts
 * up, so it cannot say whose fault the gap is, and the caller falls through
 * to the unclassified packet. That case is what keeps this honest: a
 * mechanism that classified everything it was shown would not be evidence,
 * it would be a habit.
 *
 * **A healthy run returns `undefined` too.** Nothing here fires on an
 * ordinary result.
 *
 * `objective: 'explain'`, reading nothing and proposing nothing. There is
 * nothing in the person's code to change, because the fault is ours, and an
 * assistant offering to fix this in code would be writing a workaround for
 * a Polyglot defect. `POLYGLOT_CONSTRAINTS` says so in six sentences.
 *
 * Deterministic, and the reason rather than the habit (rule 88). This
 * decides whether Polyglot blames itself. An agent deciding that would be
 * deciding whether to blame itself.
 */
export function instrumentationFailure(options: {
  readonly runner: string;
  readonly evidence: InstrumentationEvidence;
  /** The sentence the person is already shown, carried as evidence. */
  readonly sentence: string;
  readonly context?: Array<{ name: string; value: string }>;
}): GovernancePacket | undefined {
  const condition = instrumentationCondition(options.evidence);
  if (condition === undefined) {
    return undefined;
  }

  const e = options.evidence;
  return buildPacket({
    // Measured, not parsed from output: these are counts Polyglot produced
    // about its own run, which is what makes the classification provable.
    evidence: [
      { origin: 'measurement', text: options.sentence, source: 'witness' },
      { origin: 'measurement', text: `${e.testsFinished} tests finished and ${e.testsRecorded} left an attribution record.`, source: 'witness' },
      { origin: 'measurement', text: `${e.recordsWithEvidence} records carried at least one file, and ${e.filesWithHits} measured files had a line that executed.`, source: 'witness' },
      { origin: 'measurement', text: `${e.brokenBoundaries} test boundaries were broken.`, source: 'witness' },
    ],
    classification: {
      // The one class Polyglot can prove about itself. Naming any other
      // here would be naming a cause these counts do not establish.
      failureClass: 'polyglot',
      condition,
      confidence: 'classified',
      label: 'polyglot instrumentation',
    },
    objective: 'explain',
    allowed: { readable: [], proposable: [], mayPropose: false },
    constraints: POLYGLOT_CONSTRAINTS,
    validators: ['V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: NO_AUTHORIZATION_NEEDED,
    verification: NOTHING_TO_VERIFY,
    runner: options.runner,
    headline: HEADLINES[condition],
    context: options.context ?? [],
    known: [KNOWN[condition](e)],
    unknown: [
      'Whether anything in this project is at fault. The measurement that would have shown one did not happen, so this says nothing either way about the project.',
    ],
    remediation: [],
    offers: ['explain'],
  });
}

/**
 * Which of the three shapes this is, or `undefined`.
 *
 * **Private, deliberately.** `instrumentationFailure` is the whole of M6's
 * contract. A consumer that could call this would be asking Witness for a
 * lower-level classification predicate and then deciding for itself what to
 * do with the answer, which is how classification policy ends up
 * reconstructed outside the module that owns it. Ask for the governed
 * result; the result carries the condition.
 *
 * The order matters and matches `evidenceProblemSentence`: measuring nothing
 * at all is checked first and on every runner, because it is the one shape
 * no healthy run can take and it can coexist with a record count that
 * reconciles perfectly.
 */
function instrumentationCondition(e: InstrumentationEvidence): InstrumentationCondition | undefined {
  if (e.testsFinished > 0 && e.recordsWithEvidence === 0 && e.filesWithHits === 0) {
    return 'instrumented-nothing';
  }
  if (!e.reconcilable) {
    // Polyglot cannot line the counts up, so it cannot say whose fault the
    // gap is. Absence of a class, not a class of absence.
    return undefined;
  }
  if (e.brokenBoundaries > 0) {
    return 'broken-boundary';
  }
  if (e.testsRecorded < e.testsFinished) {
    return 'records-missing';
  }
  return undefined;
}

const HEADLINES: Readonly<Record<InstrumentationCondition, string>> = Object.freeze({
  'instrumented-nothing': 'Your tests ran and Polyglot recorded none of your code. This is a fault in Polyglot, not in your project.',
  'broken-boundary': 'Polyglot could not keep your tests apart while it watched them. This is a fault in Polyglot, not in your project.',
  'records-missing': 'Polyglot did not record every test that ran. This is a fault in Polyglot, not in your project.',
});

const KNOWN: Readonly<Record<InstrumentationCondition, (e: InstrumentationEvidence) => string>> = Object.freeze({
  'instrumented-nothing': (e) => `${e.testsFinished} tests finished and not one line of the project was recorded as running.`,
  'broken-boundary': (e) => `${e.brokenBoundaries} tests were cut off before they ended, so what they reached cannot be told apart from the next test.`,
  'records-missing': (e) => `${e.testsFinished} tests finished and only ${e.testsRecorded} left a record.`,
});
