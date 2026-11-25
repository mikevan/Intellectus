/**
 * The constraints, as structure. The prose is a rendering of the structure
 * and never the other way round.
 *
 * In 1.0.19 a constraint was a sentence in a string array. That works
 * exactly as far as the prompt, and stops dead at validation: a validator
 * handed "Do not modify application logic, tests, or project configuration
 * to work around this" has to reinterpret English to decide anything, and
 * two readers of the same sentence will draw the line in two places. Rules
 * 50 to 52 require a violation to be mechanically detectable, which means
 * the authoritative form has to be something a program can decide.
 *
 * So every constraint carries three things. A stable id, which is how a
 * validator names what failed and how a governance record refers to it
 * without storing any text. A rule, which is what the validator reads. And
 * the prose, which is what the prompt renders for the model, generated from
 * the same object so the two cannot drift.
 *
 * Deterministic, with the reason rather than the habit (rule 88). A
 * constraint an agent interprets is not enforced, it is merely mentioned.
 * The prompt's rendering is deterministic too, because the exact constraint
 * text that travelled is what the governance record hashes; a reworded
 * constraint would make the record's proof of what was sent untrue.
 */
import type { ValidatorId } from './validators';

/**
 * The eight standing constraints, plus condition-specific ones.
 *
 * A condition's own constraints get stable ids in the same space, prefixed
 * so nobody mistakes one for a standing constraint. They are as binding as
 * C1 to C8 and are named so a validator and a record can refer to them.
 */
export type StandingConstraintId = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'C8';
export type ConditionConstraintId = `X-${string}`;
export type ConstraintId = StandingConstraintId | ConditionConstraintId;

/** The parts of a public contract C2 protects. */
export type PublicSurface = 'signature' | 'error-message' | 'thrown-type' | 'side-effect-order';

/**
 * What a validator reads.
 *
 * Each member is decidable from the packet and the proposed change set,
 * without asking the model what it thinks it did.
 */
/**
 * What every non-advisory rule may declare about its own limits.
 *
 * `unchecked` is what this rule's validator does **not** decide, in plain
 * words, absent when it decides all of it. It sits on the rule rather than
 * in a document so it cannot drift from the thing it describes, and it is
 * written in the person's language because the authorization brief renders
 * it to them directly (rule 92).
 *
 * This is how a partially enforced constraint says so in the data. Before
 * it, a validator that checked two of four surfaces still returned a bare
 * pass, and nothing anywhere could tell a reader which two.
 */
interface Decidable {
  readonly unchecked?: string;
}

export type ConstraintRule =
  /**
   * C1. A new test may be added to an existing test file, and nothing but a
   * test may be added (rule 67, Part XI).
   */
  | (Decidable & { readonly kind: 'tests-additive-only'; readonly allowNewFiles: true })
  /** C2. */
  | (Decidable & { readonly kind: 'no-change-to'; readonly surfaces: readonly PublicSurface[] })
  /** C3. */
  | (Decidable & { readonly kind: 'paths-confined-to'; readonly allow: readonly string[] })
  /** C4. */
  | (Decidable & { readonly kind: 'paths-forbidden'; readonly deny: readonly string[] })
  /** C8. */
  | (Decidable & { readonly kind: 'must-refuse-when-infeasible' })
  /**
   * A constraint the toolkit states and does not mechanically check.
   *
   * It exists so that an advisory limit cannot masquerade as an enforced
   * one. `why` says what makes it undecidable here, and a reader can then
   * judge it rather than assuming somebody checked. An advisory constraint
   * carries no `decidedBy`, by the invariant in `assertConstraintShape`.
   */
  | { readonly kind: 'advisory'; readonly why: string };

export interface Constraint {
  readonly id: ConstraintId;
  /** Authoritative. */
  readonly rule: ConstraintRule;
  /**
   * Which validator answers this constraint.
   *
   * **Present if and only if the rule is not advisory** (A2). An advisory
   * constraint decides nothing, so it names nobody, and the invariant is in
   * the type rather than in a comment. `assertConstraintShape` enforces it
   * and a test asserts it across the whole standing set.
   *
   * An earlier version made this required, so every advisory constraint had
   * to name some validator to satisfy the compiler, and all of them named
   * `V-response-shape` for no reason except that. Eight constraints on the
   * live `failure.explain` interaction therefore depended on a validator
   * that had no body and no business deciding them.
   */
  readonly decidedBy?: ValidatorId;
  /** Rendered into the prompt. Never parsed back into a decision. */
  readonly prose: string;
}

/**
 * How far Polyglot can actually prove a constraint.
 *
 * Derived, never declared, because a hand-written list of what is enforced
 * drifts the first time a validator changes. See `coverageOf`.
 */
export type Coverage = 'checked' | 'partly-checked' | 'stated-only';

/** The A2 invariant, enforced rather than remembered. */
export function assertConstraintShape(c: Constraint): void {
  const advisory = c.rule.kind === 'advisory';
  if (advisory && c.decidedBy !== undefined) {
    throw new Error(`${c.id} is advisory and names ${c.decidedBy} as deciding it. An advisory constraint decides nothing, and naming a validator would let something report it as checked.`);
  }
  if (!advisory && c.decidedBy === undefined) {
    throw new Error(`${c.id} is not advisory and names no validator. A constraint nobody can decide is a suggestion, and it must say so by being advisory.`);
  }
}

/** The folders no proposal may touch, stated once for the whole toolkit. */
export const TOOL_FOLDERS: readonly string[] = Object.freeze(['.deeptest', '.untangleit', '.keepsafe'] as const);

/**
 * C1 to C8.
 *
 * On C1 and rule 67. `allowNewFiles: true` is in the rule rather than only
 * in the prose, because Part XI's line runs between adding coverage for a
 * measured gap and editing the contract that holds the measurement honest.
 * A validator reading the sentence alone would get that wrong in one
 * direction or the other, and both directions are bad: forbid new tests and
 * O-5 cannot exist, allow edits to old ones and a model can manufacture a
 * pass.
 *
 * On C7, honestly. "Minimise unrelated change" is a judgment, and the rule
 * states only the part a program can decide: no file outside the declared
 * scope may appear in the change set. The rest is the agent's to exercise
 * and the reviewer's to weigh. Writing the rule narrower than the sentence
 * is the honest option; the alternative is a validator that pretends to
 * measure restraint.
 */
export const STANDING_CONSTRAINTS: Readonly<Record<StandingConstraintId, Constraint>> = Object.freeze({
  C1: Object.freeze({
    id: 'C1',
    rule: Object.freeze({
      kind: 'tests-additive-only',
      allowNewFiles: true,
      // The honest residue, and it belongs to field 10 rather than here.
      // Structural validation shows that nothing in the file's shared scope
      // changed, which closes the ordinary routes. It cannot show that a new
      // test will not mutate an object an earlier test depends on, exhaust a
      // shared resource, or leave state behind. `existing-tests-still-ran`
      // addresses that with evidence the ordinary run already collects.
      unchecked: 'whether a new test affects an existing one while the tests run, which the syntax cannot show',
    }),
    decidedBy: 'V-existing-tests',
    // Refined in Phase 5, from "do not change an existing test file".
    //
    // **A refinement, and the claim is narrow.** Before, C1 refused every
    // edit to an existing test file, and so refused the ordinary engineering
    // action along with the dangerous ones: the flagship case is a density
    // shortfall on a branch of an already-tested function, whose test file
    // exists, which the project's own convention derives exactly, and which
    // the old C1 forbade touching. After, C1 refuses every edit except one
    // it can prove is structurally additive.
    //
    // C1 preserves the structural protection objective by allowing only
    // changes deterministically proven structurally additive. Runtime
    // interaction remains outside C1 and is addressed by field-10 evidence.
    // It is **not** a claim that no accepted proposal can affect an existing
    // test.
    //
    // What replaced the old boundary is not a relaxation of it. The proof is
    // an allowlist over a parsed structure: every pre-existing structure
    // identical, every addition a test case and nothing else, at any depth.
    // A byte-prefix rule would have been weaker, because appended code can
    // change what the tests above it do; a denylist would have been weaker
    // still, because the construct that gets through is the one nobody
    // listed. No assertion-strength analysis is implemented here and none is
    // planned: deciding whether an assertion was weakened means
    // understanding the assertion, and being wrong in the permissive
    // direction means a model manufactured a pass and Polyglot signed it.
    prose: 'Do not change any test that is already there. You may add a new test to an existing test file, and you may add a new test file. You may not add anything but a test.',
  }),
  C2: Object.freeze({
    id: 'C2',
    rule: Object.freeze({
      kind: 'no-change-to',
      surfaces: Object.freeze(['signature', 'error-message', 'thrown-type', 'side-effect-order'] as const),
      // All four are protected and all four are stated to the model. Only
      // some of them are decided, and this sentence is what the person is
      // shown so the brief does not present the whole of C2 as proven.
      //
      // Side-effect ordering is not decided by anything in 1.0.21. It is not
      // caught by the behaviour gate either, except where it happens to
      // change a recorded argument, a recorded outcome, or the order of
      // entries into a boundary Witness was asked to watch. An Observation
      // holds args and one outcome; it records no side effects.
      unchecked: 'whether the order of side effects changed, or a message or thrown value that is not written as plain text in the code',
    }),
    decidedBy: 'V-public-contract',
    prose: 'Do not change a public signature, an error message, a thrown type, or the order of side effects, unless this brief asks you to.',
  }),
  C3: Object.freeze({
    id: 'C3',
    rule: Object.freeze({ kind: 'paths-confined-to', allow: Object.freeze([] as const) }),
    decidedBy: 'V-scope-paths',
    prose: 'Do not touch any path outside the scope this brief gives you.',
  }),
  C4: Object.freeze({
    id: 'C4',
    rule: Object.freeze({ kind: 'paths-forbidden', deny: TOOL_FOLDERS }),
    decidedBy: 'V-forbidden-paths',
    prose: 'Do not touch anything inside .deeptest, .untangleit, or .keepsafe. Those folders belong to the tools, and .keepsafe is the recovery boundary.',
  }),
  // C5, C6, and C7 are advisory, and each one says why in the rule itself.
  //
  // All three ask a semantic question. Whether a fix is platform-specific,
  // whether removed code was a workaround, and whether a change was larger
  // than necessary cannot be decided by a program, and a detector that
  // pretended otherwise would be a heuristic wearing a guarantee. They still
  // travel to the model and still bind the person's expectation, which is
  // what a constraint is for; what they do not do is claim to be checked.
  //
  // They are advisory rather than "unimplemented" on purpose. An
  // unimplemented validator is a gap somebody should close. These are
  // decisions nobody should be making in static code (rule 88), and the
  // consequence of each is caught by something honest: a platform-specific
  // fix fails a build on the other platform, and removing code that
  // mattered changes what the tests observe.
  C5: Object.freeze({
    id: 'C5',
    rule: Object.freeze({
      kind: 'advisory',
      why: 'Whether a fix works on one operating system only needs understanding of the code. Code with no platform token in it can be platform-specific, and code full of them can be correctly cross-platform, which is what a well-written path helper looks like. Running the project on the other platform is what catches this.',
    }),
    prose: 'Do not write a fix that works on one operating system only, in a project that runs on more than one.',
  }),
  C6: Object.freeze({
    id: 'C6',
    rule: Object.freeze({
      kind: 'advisory',
      why: 'That a change removes lines is decidable. That the removed lines were a workaround is not. A marker convention would decide it exactly, and no customer\'s code carries our marker, so a validator built on one would pass everything and report a guarantee it never exercised.',
    }),
    prose: 'Do not remove code that works around a known limitation. Somebody solved a real problem with it.',
  }),
  C7: Object.freeze({
    id: 'C7',
    rule: Object.freeze({
      kind: 'advisory',
      why: 'Necessity is semantic. A second file can be entirely legitimate even when it was not obvious before the model reasoned about the task, and refusing a correct solution because it touched one more file inside the authorized scope would be worse than the change it prevented. C3 is the hard boundary; this is the request to stay inside it lightly.',
    }),
    // The second sentence used to read "Do not bring in a file the brief did
    // not name", which is a path-containment rule and therefore C3's job,
    // not C7's. C7 is about size, and size is a judgment.
    prose: 'Keep the change small. Do not change more than the objective needs.',
  }),
  C8: Object.freeze({
    id: 'C8',
    rule: Object.freeze({
      kind: 'must-refuse-when-infeasible',
      // The requirement is real and the enforcement is partial. A validator
      // can decide the shape of a refusal. Nothing can decide whether the
      // objective could have been met, so nothing claims to.
      unchecked: 'whether refusing was the right answer',
    }),
    decidedBy: 'V-refusal-wellformed',
    prose: 'If you cannot meet the objective inside these limits, say so plainly and stop. Refusing is a correct answer here.',
  }),
});

// ---------------------------------------------------------------------------
// Instance parameters (M21)
// ---------------------------------------------------------------------------

/**
 * The per-interaction parameters a rule kind carries, and where each one is
 * bound from.
 *
 * Standing C3 mixes two concepts that look alike and are not. Its
 * **identity** is that a change must stay inside the authorized scope, and
 * that is stable forever. Its **instance parameter** is the concrete list of
 * paths that constitute that scope for this one attempt. `allow: []` above
 * is neither: it is an unbound template, and before this registry existed
 * `assertSameMeaning` read it as immutable meaning and refused every real
 * scope a caller supplied. That was M21.
 *
 * A rule kind **absent from this registry has no parameters**: every field
 * of its rule is part of its immutable meaning. `paths-forbidden` is absent,
 * deliberately and permanently, because C4's deny list is what C4 means.
 * There is no interaction for which a different deny list is right.
 *
 * Keyed by rule **kind**, never by constraint id. There is no
 * `if (id === 'C3')` anywhere in the governance layer, and adding one would
 * be the defect this registry exists to avoid.
 *
 * **One declaration, two consumers.** `assertSameMeaning` elides the named
 * field on both sides and compares everything else exactly.
 * `reconcileConstraints` binds the field by calling `read`. Two tables
 * describing one relationship would be two places to disagree, and the
 * disagreement would be silent.
 *
 * Nothing is generically ignored. The elision is exactly one named field of
 * exactly one named rule kind, declared here and asserted by its own test.
 */
export interface ParameterBinding {
  /** The rule field that is an instance parameter. */
  readonly field: string;
  /** The single authoritative packet field it is bound from. */
  readonly from: 'allowed.proposable';
  /** Read from a packet, typed, so the source cannot drift from the name. */
  read(packet: ParameterSource): readonly string[];
}

/**
 * The part of a packet a binding may read.
 *
 * Narrower than `GovernancePacket` on purpose, and declared here so that
 * this module does not import the packet module it is imported by. A
 * binding that could read the whole packet could bind a constraint from the
 * evidence or the headline, and then "where did this scope come from" would
 * have as many answers as the packet has fields.
 */
export interface ParameterSource {
  readonly allowed: { readonly proposable: readonly string[] };
}

export const PARAMETER_BINDINGS: Readonly<Partial<Record<ConstraintRule['kind'], ParameterBinding>>> = Object.freeze({
  'paths-confined-to': Object.freeze({
    field: 'allow',
    from: 'allowed.proposable',
    read: (packet: ParameterSource) => packet.allowed.proposable,
  }),
});

/** The binding for a rule, or `undefined` when every field is meaning. */
export function bindingFor(rule: ConstraintRule): ParameterBinding | undefined {
  return PARAMETER_BINDINGS[rule.kind];
}

/**
 * The constraint with its instance parameter bound, for this attempt.
 *
 * Called by `reconcileConstraints` and by nothing else. The reconciler is
 * the one place holding both the registered spec and the packet, so it is
 * the one place that can bind without guessing, and a second way to produce
 * a bound C3 would be exactly the ambiguity M21 exists to end. That is why
 * `scopedConstraint` was removed rather than kept beside it.
 */
export function bindParameter(constraint: Constraint, source: ParameterSource): Constraint {
  const binding = bindingFor(constraint.rule);
  if (binding === undefined) {
    return constraint;
  }
  const value = binding.read(source);
  const rule = Object.freeze({ ...constraint.rule, [binding.field]: Object.freeze([...value]) }) as ConstraintRule;
  return Object.freeze({ ...constraint, rule }) as Constraint;
}

/**
 * The six constraints the path-character condition carries.
 *
 * They were six sentences in `compatibility.ts` and are now six constraints
 * with ids. Every one of them is advisory, and that is worth being plain
 * about: the condition's objective is `explain`, so there is no change set
 * to check any of them against. The ids exist so that a governance record
 * can say which limits travelled, and so that these become checkable
 * unchanged if a later objective ever proposes a change here.
 *
 * The prose is byte-identical to 1.0.19, in the same order, because the
 * derived `ProblemPacket` still carries it and its tests still pin it.
 */
export const PATH_CONSTRAINTS: readonly Constraint[] = Object.freeze([
  advisory('X-PATH-1', 'Do not recommend or write Windows-specific path handling. Hard-coded drive letters, backslash rules, or Windows-only escaping can make the project fail on Linux.'),
  advisory('X-PATH-2', 'Do not modify application logic, tests, or project configuration to work around this. Nothing in the project caused it.'),
  advisory('X-PATH-3', 'Do not propose patching Angular, Playwright, Vite, or any other dependency, and do not propose editing generated files.'),
  advisory('X-PATH-4', 'Do not suggest changing DeepTest or UntangleIt settings. Where the project sits on disk is the whole of it.'),
  advisory('X-PATH-5', 'If the project already contains code that quotes, escapes, or normalises paths, leave it alone. That code solves a real problem and is not the cause of this.'),
  advisory('X-PATH-6', 'Do not offer to make this change in code. The remedy is moving a folder, which the person does outside the editor.'),
]);

/**
 * The six constraints a Polyglot instrumentation failure carries.
 *
 * These travel when the measurements prove that **Polyglot's own
 * instrumentation** failed to produce the evidence a run needed. That is the
 * one place in the toolkit where the `polyglot` failure class is provable,
 * and the constraints exist because being right about the cause makes the
 * wrong answers more tempting rather than less.
 *
 * **Three distinctions have to survive at once**, and losing any one of them
 * makes the explanation worse than saying nothing:
 *
 *   1. the instrumentation failure is provably Polyglot's;
 *   2. the person's project is **not** thereby proved faulty;
 *   3. the person's project is **also not** thereby proved correct.
 *
 * The third is the one that slips. Told the fault is ours, the natural next
 * sentence is a reassuring one, and reassurance here overshoots into a clean
 * bill of health nobody measured: the instrumentation hole means the project
 * was not examined either way. X-POLY-1 states the three together and
 * X-POLY-4 forbids rounding them off, which is why they are separate.
 *
 * Every one is advisory, for the reason the type already gives: the
 * interaction proposes no change, so there is no change set to decide them
 * against. They still travel to the model and still bind the person's
 * expectation, which is what a constraint is for. What they do not do is
 * claim to be checked.
 *
 * **Six rather than one**, the same shape `PATH_CONSTRAINTS` arrived at, and
 * for the same reason: each closes one specific wrong answer a capable model
 * would otherwise give. Change the code. Change the tests. Reassure them.
 * Guess a cause. Blame the settings.
 */
export const POLYGLOT_CONSTRAINTS: readonly Constraint[] = Object.freeze([
  advisory(
    'X-POLY-1',
    "Polyglot's instrumentation failed to produce the evidence this run needed. The measurements establish that as a Polyglot instrumentation failure. They do not establish that this project is defective, and they do not establish that it is free of defects either, because the measurement that would have shown one did not happen.",
  ),
  advisory(
    'X-POLY-2',
    "Do not recommend changing this project's code to remedy this. The failure being explained is in Polyglot's instrumentation; these measurements do not establish a project-code cause.",
  ),
  advisory(
    'X-POLY-3',
    "Do not recommend changing this project's tests, its test configuration, or its build setup to work around this. Nothing in the project has been shown to have caused it.",
  ),
  advisory(
    'X-POLY-4',
    'Do not tell the person their code is fine. Polyglot did not obtain the evidence needed to establish that. Say what failed to be measured or attributed, and say that the question remains open.',
  ),
  advisory(
    'X-POLY-5',
    'Explain the measured instrumentation failure: what was expected, what was observed, and what that gap means. Do not state a cause the counts do not support.',
  ),
  advisory(
    'X-POLY-6',
    'Do not suggest changing DeepTest or UntangleIt settings to make this go away. This is a defect to be reported, not a configuration to be tuned.',
  ),
]);

/**
 * The five findings a completed measurement can produce, and what each one
 * is.
 *
 * **A finding is not a failure.** Nothing went wrong: a check ran, finished,
 * and produced a result the person may want explained. That is the whole of
 * the line between `finding.explain` and `failure.explain`, and it is why
 * these carry their own constraint sets rather than reusing the unclassified
 * one.
 */
export type FindingCondition = 'behaviour-changed' | 'behaviour-insufficient' | 'decision-unverified' | 'coverage-unreachable' | 'coverage-density-shortfall';

export const FINDING_CONDITIONS: readonly FindingCondition[] = Object.freeze([
  'behaviour-changed',
  'behaviour-insufficient',
  'decision-unverified',
  'coverage-unreachable',
  'coverage-density-shortfall',
] as const);

/** Whether a packet's condition names a measured finding rather than a failure. */
export function isFindingCondition(condition: string): condition is FindingCondition {
  return (FINDING_CONDITIONS as readonly string[]).includes(condition);
}

/**
 * The four constraints every finding carries, whichever finding it is.
 *
 * **The distinction they exist to protect**: the finding happened, and why
 * it happened is not established. Those are two different facts, and a
 * packet that carries `insufficient-evidence` says only the second. A model
 * handed "unclassified" will reach for the reading that the measurement
 * itself might be wrong, because that is the more familiar shape, and the
 * person then learns nothing from a check that worked perfectly.
 *
 * X-FIND-1 is the one that carries the rule. The other three close the
 * wrong answers: inventing a cause, hedging the measurement, and reaching
 * for the toolkit's settings when the toolkit is not the subject.
 */
const FINDING_SHARED: readonly Constraint[] = Object.freeze([
  advisory(
    'X-FIND-1',
    'The finding below was measured and it happened. What is not established is why. Explain what was measured and what it means, and say plainly that the cause is not established. Do not present the finding itself as uncertain, as possibly a measurement error, or as something that may not have occurred.',
  ),
  advisory(
    'X-FIND-2',
    'Do not name a cause for the finding. Nothing here establishes one. You may describe what would have to be true for a given cause to hold, as long as you say it is not established.',
  ),
  advisory(
    'X-FIND-3',
    'Do not tell the person the finding is nothing to worry about, and do not tell them it is certainly a defect. Neither is established. Say what was measured, and say what the person could look at next.',
  ),
  advisory(
    'X-FIND-4',
    'Do not suggest changing DeepTest or UntangleIt settings to make the finding go away. The measurement is the product working, not a configuration to be tuned.',
  ),
]);

/**
 * Each finding's own first constraint, stating what was measured.
 *
 * One sentence per condition, and it is the sentence the shared four
 * protect. They are written from the measurement, not from a guess about
 * what caused it.
 */
const FINDING_FIRST: Readonly<Record<FindingCondition, Constraint>> = Object.freeze({
  'behaviour-changed': advisory(
    'X-FIND-BEHAVIOUR-CHANGED',
    'The behaviour gate compared what this method did before the change with what it does now, and they differ. The comparison is deterministic: the same tests, the same calls, the same arguments, and a different result. Do not suggest the comparison may be unreliable.',
  ),
  'behaviour-insufficient': advisory(
    'X-FIND-BEHAVIOUR-INSUFFICIENT',
    'The behaviour gate ran and could not reach a verdict, and the evidence names which of its six reasons applied. That is a fact about the comparison, not about the method: the method is neither shown to have changed nor shown to be the same. Say which it is and say that the question is open.',
  ),
  'decision-unverified': advisory(
    'X-FIND-DECISION-UNVERIFIED',
    'This decision is recorded as unverified, and the evidence names which of the three reasons applied. Unverified means the confirmation has not happened, not that it failed. Do not describe the change as confirmed and do not describe it as broken.',
  ),
  'coverage-unreachable': advisory(
    'X-FIND-COVERAGE-UNREACHABLE',
    'These lines were found unreachable by reading the structure of the code, not by running it: nothing that executes can arrive at them. The finding is the structure. Why those lines are there is not established, and dead code is sometimes deliberate.',
  ),
  'coverage-density-shortfall': advisory(
    'X-FIND-COVERAGE-DENSITY-SHORTFALL',
    'This line is exercised by fewer tests than the ways through it, and both numbers were measured. A shortfall says how many ways through the line no test distinguishes. It does not say the line is wrong, and it does not say a test is missing for any particular one of those ways.',
  ),
});

/** The constraints a finding's packet carries: its own, then the four shared. */
export function findingConstraints(condition: FindingCondition): readonly Constraint[] {
  return Object.freeze([FINDING_FIRST[condition], ...FINDING_SHARED]);
}

/** The constraint the unclassified packet carries. */
export const UNCLASSIFIED_CONSTRAINT: Constraint = advisory(
  'X-UNCLASSIFIED-1',
  'Do not state a cause the evidence does not support. Explaining what the evidence shows, and saying plainly what it does not establish, is the whole job here.',
);

/**
 * A condition's constraint that nothing mechanically checks.
 *
 * It names no validator, which is the A2 correction. It used to name
 * `V-response-shape` for one reason only: `decidedBy` was required, so every
 * advisory constraint had to name somebody. That made eight constraints on
 * the live `failure.explain` interaction depend on a validator with no body
 * and no business deciding them, and it gave `V-response-shape` two
 * meanings. It now has one: the validity of the returned response.
 */
function advisory(id: ConditionConstraintId, prose: string): Constraint {
  return Object.freeze({
    id,
    rule: Object.freeze({ kind: 'advisory', why: 'This interaction proposes no change, so there is no change set to decide it against.' }),
    prose,
  }) as Constraint;
}

/** Whether an id names a standing constraint. */
export function isStandingConstraintId(id: string): id is StandingConstraintId {
  return Object.prototype.hasOwnProperty.call(STANDING_CONSTRAINTS, id);
}

/** Whether an id is well formed at all: C1 to C8, or an X- prefixed condition id. */
export function isConstraintId(id: string): id is ConstraintId {
  return isStandingConstraintId(id) || (id.startsWith('X-') && id.length > 2);
}
