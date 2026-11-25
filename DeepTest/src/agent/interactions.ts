/**
 * DeepTest's governed interactions.
 *
 * Five since Phase 6: `failure.explain`, `finding.explain`, and the three
 * that propose. It is a semantic runtime id and not an
 * O-number, because those are roadmap opportunity labels and never registry
 * keys (rule 91).
 *
 * It is a genuine explanation and always was. The path-character packet
 * carries `explain` and no `fix`, deliberately, because the remedy is moving
 * a folder and an assistant writing code to compensate is the outcome the
 * constraints forbid. The unclassified packet carries `explain` and no
 * remediation at all. Neither proposes anything and neither touches a file.
 *
 * What is deliberately absent: the line brief and the function brief. Those
 * are proposal workflows. Registering them here as `explain` would put a
 * propose interaction through an explain envelope, stripping the change set,
 * the authorization boundary, and the verification rule from an interaction
 * that needs all three, and the ten-field contract would be satisfied on
 * paper and meaningless in fact. They migrate in Phase 5, when their
 * validators exist.
 *
 * **They migrated in Phase 5, and this is what they became.** Three
 * interactions, not two, because the function brief's `pick.mode` was two
 * objectives wearing one name: "write tests for every way through it" and
 * "break it into smaller pieces" are different work under different
 * constraints with different verification, and one registration could not
 * have stated both honestly.
 *
 * **Both test-proposing interactions name two measurements**, and under the
 * field 10 rule every named measurement must hold. `coverage-density` says
 * the targeted gap closed; `existing-tests-still-ran` says the tests that
 * previously exercised those targets still do. A proposal that closes the gap
 * and silences a pre-existing test reports `changed`, not `held`.
 *
 * **Neither test-proposing interaction names C2**, because a test-only
 * addition does not alter the product source's public contract. That is true
 * when a new test file is created and equally true when an existing one is
 * modified additively, since the product source is not in
 * `allowed.proposable` at all. Naming C2 would require a `SyntaxPort`
 * prerequisite for a contract comparison the interaction never performs. The
 * two refactor interactions do name it, and therefore do need one.
 *
 * **C1 binds all four.** A refactor proposal may not change an existing test
 * either: a model that adjusted a test to match its refactor would be
 * manufacturing the pass C1 exists to prevent, and that is the case where C1
 * earns its strictness.
 */
import { NOTHING_TO_VERIFY, NO_AUTHORIZATION_NEEDED, ONE_CORRECTION, USER_AUTHORIZES_ATTEMPT, isRegistered, registerInteraction } from '@projectrevivesolutions/witness';

/** The runtime ids, used by `requireInteraction` and by the registry test. */
export const FAILURE_EXPLAIN = 'failure.explain';
export const FINDING_EXPLAIN = 'finding.explain';
export const COVERAGE_PROPOSE_TEST = 'coverage.propose-test';
export const FUNCTION_PROPOSE_TESTS = 'function.propose-tests';
export const FUNCTION_PROPOSE_REFACTOR = 'function.propose-refactor';

/**
 * Registers what DeepTest can do, once, at activation.
 *
 * The guard asks the registry rather than keeping a flag of its own. A flag
 * says what this module did; the registry says what is true, and after a test
 * clears the registry those were two different answers.
 */
export function registerInteractions(): void {
  if (isRegistered(FAILURE_EXPLAIN)) {
    return;
  }
  registerInteraction({
    id: FAILURE_EXPLAIN,
    tool: 'DeepTest',
    title: 'Explain a run that failed before the tests started.',
    objective: 'explain',
    // An explanation reads nothing and proposes nothing. Everything it needs
    // is already in the packet, which is why it can run on a project the
    // model never sees.
    allowed: { readable: [], proposable: [], mayPropose: false },
    // The standing floor. A condition adds its own constraints to the packet
    // it builds, and the path condition carries six. C4 is here because it
    // always applies and because its validator has a body, so the interaction
    // has at least one check that really runs rather than a list of ids that
    // all report not-applicable.
    //
    // What binds a run is neither this list nor the packet's alone. It is the
    // effective set `reconcileConstraints` computes from both, before the
    // prompt, the authorization brief, the capability, or the model (M19,
    // closed in 1.0.21 Phase 3). This list may be added to by a condition; it
    // may never be omitted, weakened, replaced, or contradicted by one.
    constraints: ['C4'],
    validators: ['V-forbidden-paths'],
    correction: ONE_CORRECTION,
    authorization: NO_AUTHORIZATION_NEEDED,
    verification: NOTHING_TO_VERIFY,
  });

  /**
   * The second explanation interaction, and the last one.
   *
   * **One registration for five conditions, not five registrations.** The id
   * names the semantic action, and the packet's condition names what was
   * measured. Turning `behaviour-changed`, `behaviour-insufficient`,
   * `decision-unverified`, `coverage-unreachable` and
   * `coverage-density-shortfall` into five registry keys would put the
   * occasion in the identity, which is what rule 91 warns against, and would
   * give one semantic action five governance shapes to keep in step. The
   * condition is field 2 of the packet and is already in the record, so
   * nothing is lost by having one id.
   *
   * **What separates this from `failure.explain` is what kind of thing is
   * being explained**, not how bad it is. `failure.explain` owns every case
   * where the requested analysis could not complete. This owns the cases
   * where it completed and produced a finding. Nothing went wrong here; a
   * check worked, and its answer is worth explaining.
   *
   * It proposes nothing, needs no authorization, and verifies nothing, for
   * the same reason `failure.explain` does none of those: an explanation
   * changes no file, so there is no change set, no boundary to cross, and
   * nothing to re-measure afterwards.
   */
  registerInteraction({
    id: FINDING_EXPLAIN,
    tool: 'DeepTest',
    title: 'Explain a finding a completed measurement produced.',
    objective: 'explain',
    allowed: { readable: [], proposable: [], mayPropose: false },
    // The same standing floor, for the same reason, and the condition adds
    // its own five through the ordinary rule 93 reconciliation.
    constraints: ['C4'],
    validators: ['V-forbidden-paths', 'V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: NO_AUTHORIZATION_NEEDED,
    verification: NOTHING_TO_VERIFY,
  });

  registerInteraction({
    id: COVERAGE_PROPOSE_TEST,
    tool: 'DeepTest',
    title: 'Propose one test for a measured coverage gap on one line.',
    objective: 'propose',
    // The packet narrows both lists per attempt. What is registered is the
    // shape: this interaction reads source and proposes into one test file,
    // and it never proposes a change to a source file.
    allowed: { readable: ['src/**'], proposable: ['**/*.test.*'], mayPropose: true },
    constraints: ['C1', 'C3', 'C4', 'C8'],
    validators: ['V-existing-tests', 'V-scope-paths', 'V-forbidden-paths', 'V-refusal-wellformed', 'V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: {
      kind: 're-measure',
      measurements: ['coverage-density', 'existing-tests-still-ran'],
      target: { kind: 'lines', path: '', lines: [] },
    },
  });

  registerInteraction({
    id: FUNCTION_PROPOSE_TESTS,
    tool: 'DeepTest',
    title: 'Propose tests for the measured gaps in one function.',
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: ['**/*.test.*'], mayPropose: true },
    constraints: ['C1', 'C3', 'C4', 'C8'],
    validators: ['V-existing-tests', 'V-scope-paths', 'V-forbidden-paths', 'V-refusal-wellformed', 'V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: {
      kind: 're-measure',
      measurements: ['coverage-density', 'existing-tests-still-ran'],
      target: { kind: 'lines', path: '', lines: [] },
    },
  });

  registerInteraction({
    id: FUNCTION_PROPOSE_REFACTOR,
    tool: 'DeepTest',
    title: 'Propose breaking one function into smaller pieces.',
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: ['src/**'], mayPropose: true },
    // C2 is here and not on the two above: this one changes product source,
    // so its public contract is exactly what must not move.
    constraints: ['C1', 'C2', 'C3', 'C4', 'C8'],
    validators: ['V-existing-tests', 'V-public-contract', 'V-scope-paths', 'V-forbidden-paths', 'V-refusal-wellformed', 'V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    // Both must hold. Equivalent behaviour with no untangling is not success,
    // because the work did not happen; lower complexity with changed
    // behaviour is not success, because something broke.
    verification: {
      kind: 're-measure',
      measurements: ['function-complexity', 'behaviour-equivalence'],
      target: { kind: 'function', path: '', name: '', startLine: 0 },
    },
  });

}
