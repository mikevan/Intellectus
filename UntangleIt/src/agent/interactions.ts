/**
 * UntangleIt's governed interactions.
 *
 * Two since Phase 5: `failure.explain`, the same runtime id DeepTest registers,
 * because it is the same interaction and a semantic id names what a thing is
 * rather than which product happened to register it (rule 91). O-numbers are
 * roadmap opportunity labels and never registry keys.
 *
 * What is deliberately absent: the untangle brief. It is a proposal workflow,
 * it asks for a method to be broken up, and its validators do not exist until
 * Phase 4. Registering it here as `explain` would put a propose interaction
 * through an explain envelope, stripping the change set, the authorization
 * boundary, and the verification rule from an interaction that needs all
 * three. It migrates in Phase 5, and until then it keeps the transport it
 * has, recorded as M3 and M4.
 *
 * **It migrated, and it is `method.propose-untangle`.** Its verification is
 * two-part and both halves must hold: the complexity measurement reaches its
 * target **and** Witness reports the behaviour equivalent. Equivalent
 * behaviour with no untangling is not success, because the work did not
 * happen. Lower complexity with changed or insufficient behaviour is not
 * success, because something broke or nobody can tell. The second half is why
 * Phase 1 exists, and reporting `held` on complexity alone would undo it.
 *
 * **C1 binds it too**, and it needs no parser for that. UntangleIt proposes
 * source changes and never test changes, so a proposal of its that touched a
 * test file fails C1 on the path alone, exactly as before. The structural
 * additive rule is only reached when an interaction authorizes a test-file
 * modification, which is DeepTest's two test-proposing interactions and
 * nothing else.
 */
import { NOTHING_TO_VERIFY, NO_AUTHORIZATION_NEEDED, ONE_CORRECTION, USER_AUTHORIZES_ATTEMPT, isRegistered, registerInteraction } from '@projectrevivesolutions/witness';

export const FAILURE_EXPLAIN = 'failure.explain';
export const FINDING_EXPLAIN = 'finding.explain';
export const METHOD_PROPOSE_UNTANGLE = 'method.propose-untangle';

/**
 * The guard asks the registry rather than keeping a flag of its own. A flag
 * says what this module did; the registry says what is true.
 */
export function registerInteractions(): void {
  if (isRegistered(FAILURE_EXPLAIN)) {
    return;
  }
  registerInteraction({
    id: FAILURE_EXPLAIN,
    tool: 'UntangleIt',
    title: 'Explain a run that failed before the tests started.',
    objective: 'explain',
    allowed: { readable: [], proposable: [], mayPropose: false },
    // The standing floor. A condition adds its own constraints to the packet
    // it builds. C4 is here because it always applies and because its
    // validator has a body, so at least one check really runs.
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
   * **One registration, and UntangleIt reaches two of its five conditions.**
   * The behaviour gate is the measurement UntangleIt owns a half of, so
   * `behaviour-changed` and `behaviour-insufficient` are the findings that
   * occur here. The other three are DeepTest's: a decision's verification
   * state, unreachable lines and density shortfalls are all produced by an
   * engine UntangleIt does not have. The registration is identical in both
   * products because the interaction is the same interaction; which
   * conditions each product can reach is a fact about the product, not about
   * the id.
   *
   * What separates this from `failure.explain` is what kind of thing is
   * being explained. `failure.explain` owns every case where the requested
   * analysis could not complete; this owns the cases where it completed and
   * produced a finding.
   */
  registerInteraction({
    id: FINDING_EXPLAIN,
    tool: 'UntangleIt',
    title: 'Explain a finding a completed measurement produced.',
    objective: 'explain',
    allowed: { readable: [], proposable: [], mayPropose: false },
    constraints: ['C4'],
    validators: ['V-forbidden-paths', 'V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: NO_AUTHORIZATION_NEEDED,
    verification: NOTHING_TO_VERIFY,
  });

  registerInteraction({
    id: METHOD_PROPOSE_UNTANGLE,
    tool: 'UntangleIt',
    title: 'Propose breaking one tangled method into smaller pieces.',
    objective: 'propose',
    allowed: { readable: ['src/**'], proposable: ['src/**'], mayPropose: true },
    constraints: ['C1', 'C2', 'C3', 'C4', 'C8'],
    validators: ['V-existing-tests', 'V-public-contract', 'V-scope-paths', 'V-forbidden-paths', 'V-refusal-wellformed', 'V-response-shape'],
    correction: ONE_CORRECTION,
    authorization: USER_AUTHORIZES_ATTEMPT,
    verification: {
      kind: 're-measure',
      measurements: ['function-complexity', 'behaviour-equivalence'],
      target: { kind: 'boundary', path: '', name: '' },
    },
  });
}
