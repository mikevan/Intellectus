/**
 * The effective constraint set: one deterministic combination, computed once.
 *
 * A governed interaction has constraints in two places, and both are
 * legitimate. The registered `InteractionSpec` names the ones that always
 * govern it, whatever happened. The `GovernancePacket` adds the ones the
 * particular measured condition established. `failure.explain` requires C4
 * and the path condition carries six of its own, and those coexist.
 *
 * What is not legitimate is the two sets disagreeing, and that is what this
 * file refuses. **A packet may add condition-specific constraints. It may
 * never omit, weaken, replace, or contradict a constraint its registered spec
 * requires.** Without that, a condition could quietly hand the model a
 * narrower rulebook than the interaction was registered with, and every
 * downstream stage would pass: the prompt would carry the weaker set, the
 * person would authorize the weaker set, and the validators would check the
 * weaker set. Nobody would see it happen, because each stage would be
 * internally consistent.
 *
 * So there is one function, and its result is passed to the prompt, to the
 * authorization brief, and to validation. Three consumers each combining
 * constraints for themselves is three chances to combine them differently,
 * and the one that drifts is the one nobody is looking at.
 *
 * **It runs first.** Before the authorization brief is built, before a
 * capability is issued, and before the model is reached. A reconciliation
 * failure is a governance defect, and a governance defect must not cost the
 * person a request against their own quota.
 *
 * **It also binds, and that is new in 1.0.21 Phase 5.** This file was purely
 * a checker and is now a checker that produces one thing: the instance
 * parameters declared in `PARAMETER_BINDINGS`. C3's identity is "stay inside
 * the authorized scope", which never changes; the concrete paths that make up
 * that scope are per attempt, and they live in `allowed.proposable`. The
 * reconciler is the one place holding both the registered spec and the
 * packet, so it is the one place that can bind them without guessing, and a
 * second way to produce a bound constraint would put two answers in the tree
 * to the question of where a scope came from. That is why the change is
 * named here rather than slipped in: a reader who was told this file only
 * checks would not go looking for the binding.
 *
 * Deterministic, and the reason rather than the habit (rule 88). This decides
 * which rules bind an interaction. An agent deciding that would be deciding
 * what it is allowed to do.
 */
import { STANDING_CONSTRAINTS, bindParameter, bindingFor, isStandingConstraintId } from './constraints';
import type { Constraint, ConstraintId, ConstraintRule } from './constraints';
import type { GovernancePacket } from './packet';
import type { InteractionSpec } from './registry';
import { normalizeSegments } from './validators';
import type { ValidatorId } from './validators';

/** The reconciled set, and where each part came from. */
export interface EffectiveConstraints {
  readonly interactionId: string;
  readonly packetId: string;
  /** Every constraint that binds this interaction, spec-required first. */
  readonly constraints: readonly Constraint[];
  /** The ids the registered spec requires. */
  readonly required: readonly ConstraintId[];
  /** The ids the measured condition added on top. */
  readonly conditional: readonly ConstraintId[];
  /** Every validator that has to be available for the set to be checkable. */
  readonly validators: readonly ValidatorId[];
}

export class ReconciliationError extends Error {}

/**
 * Combines the spec's required constraints with the packet's own, or refuses.
 *
 * Five refusals, each a way for an interaction to look governed while being
 * governed by less than it was registered with.
 */
export function reconcileConstraints(spec: InteractionSpec, packet: GovernancePacket): EffectiveConstraints {
  if (spec.objective !== packet.objective) {
    throw new ReconciliationError(`The packet declares the objective ${packet.objective} and ${spec.id} declares ${spec.objective}. One of them is wrong and neither is safe to guess at.`);
  }

  const byId = new Map<ConstraintId, Constraint>();
  const conditional: ConstraintId[] = [];

  // 1. The packet's own. A standing id here must BE the standing constraint,
  //    not a redefinition of it. Otherwise a condition could ship a C4 whose
  //    deny list is empty and the name would still read as protection.
  for (const c of packet.constraints) {
    if (isStandingConstraintId(c.id)) {
      const standing = STANDING_CONSTRAINTS[c.id];
      // M21. A parameterised standing constraint is bound here, from one
      // named packet field. A packet may not supply its own bound copy, so
      // there is never a second one to compare and `assertSameMeaning` is
      // never asked the question it gets wrong. `buildPacket` refuses this
      // too; the refusal is in both places because an effective set can be
      // built from a packet that was not built here.
      const binding = bindingFor(c.rule);
      if (binding !== undefined) {
        throw new ReconciliationError(
          `The packet carries ${c.id}, whose ${binding.field} is bound from ${binding.from} when the interaction is reconciled. Reconciliation owns that binding, and a packet supplying it independently would be a second source for one scope. Put the paths in allowed.proposable.`,
        );
      }
      assertSameMeaning(standing, c, `The packet carries a constraint called ${c.id}, but it does not mean what ${c.id} means.`);
    }
    if (byId.has(c.id)) {
      throw new ReconciliationError(`The packet carries ${c.id} twice. A stable id is how a validator names what failed, so it cannot mean two things.`);
    }
    byId.set(c.id, c);
    conditional.push(c.id);
  }

  // 2. The spec's required ones. Resolvable, and identical where the packet
  //    also carries them.
  const required: ConstraintId[] = [];
  for (const id of spec.constraints) {
    const fromPacket = byId.get(id);
    const standing = isStandingConstraintId(id) ? STANDING_CONSTRAINTS[id] : undefined;
    if (!fromPacket && !standing) {
      // A required constraint nobody can produce. The interaction was
      // registered with a protection that does not exist.
      throw new ReconciliationError(
        `${spec.id} requires the constraint ${id}, and nothing can supply it: it is not one of the standing constraints and the packet does not carry it. A required constraint that cannot be resolved is a protection in name only.`,
      );
    }
    if (fromPacket && standing) {
      assertSameMeaning(standing, fromPacket, `${spec.id} requires ${id} and the packet carries a different ${id}.`);
    }
    if (!fromPacket) {
      // M21, the binding. A standing constraint resolved from its definition
      // is an unbound template where its rule kind declares an instance
      // parameter, and this is where the template becomes an instance. A
      // packet-supplied constraint is never bound here: it arrived complete,
      // and a parameterised standing one cannot arrive at all.
      byId.set(id, bindStanding(standing!, packet, spec));
    }
    required.push(id);
    const index = conditional.indexOf(id);
    if (index >= 0) {
      conditional.splice(index, 1);
    }
  }

  // 3. Every required id is in the effective set. Belt and braces: the loop
  //    above puts them there, and this is the assertion a later refactor
  //    would have to defeat on purpose.
  const missing = required.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new ReconciliationError(`The effective constraint set is missing ${missing.join(', ')}, which ${spec.id} requires. A packet may add constraints; it may never drop one.`);
  }

  const constraints = [...required.map((id) => byId.get(id)!), ...conditional.map((id) => byId.get(id)!)];

  // 3a. M16. The scope enforced is the scope the person was shown.
  //
  //     `brief.mayChange` is `packet.allowed.proposable`, and the binding
  //     above reads the same field, so today the two cannot differ: there is
  //     one authoritative list. That is structure, and structure can be
  //     undone by a later change that introduces a second source, at which
  //     point the person would authorize one list and a validator would
  //     enforce another and nothing would say so. This is the assertion that
  //     change would have to defeat on purpose.
  assertScopeCoherence(constraints, packet, spec);

  // 4. No pair of them may contradict.
  assertNoContradiction(constraints, packet);

  // 5. Every constraint has to be checkable by something the interaction
  //    names. A constraint whose validator is nowhere is a suggestion.
  const validators = [...new Set<ValidatorId>([...spec.validators, ...packet.validators])];
  for (const c of constraints) {
    // An advisory constraint names no validator, by the invariant in
    // `constraints.ts`. It is not an oversight to be caught here: it is a
    // constraint that says, in its own type, that nothing decides it (A2).
    if (c.decidedBy !== undefined && !validators.includes(c.decidedBy)) {
      throw new ReconciliationError(`${c.id} is decided by ${c.decidedBy}, which neither ${spec.id} nor the packet lists. A constraint nobody checks is a suggestion.`);
    }
  }

  return Object.freeze({
    interactionId: spec.id,
    packetId: packet.id,
    constraints: Object.freeze(constraints),
    required: Object.freeze(required),
    conditional: Object.freeze(conditional),
    validators: Object.freeze(validators),
  });
}

/**
 * A standing constraint, with its declared instance parameter bound.
 *
 * Returns the constraint unchanged when its rule kind declares no parameter,
 * which is every rule kind but one. C4 goes through here and comes out
 * identical, because its deny list is its meaning and `paths-forbidden` is
 * absent from the registry on purpose.
 *
 * **It refuses to produce an unbound instance.** A C3 whose bound list is
 * empty would say "stay inside this scope" and name no scope, which reads as
 * a protection and enforces nothing. That is the second of the three layers
 * standing between an unscoped propose interaction and a model: `buildPacket`
 * refuses an empty proposable list on a propose packet, this refuses to bind
 * one, and `V-scope-paths`'s prerequisite refuses an empty `allow` for the
 * case where a caller assembles an effective set without coming through here.
 */
function bindStanding(standing: Constraint, packet: GovernancePacket, spec: InteractionSpec): Constraint {
  const binding = bindingFor(standing.rule);
  if (binding === undefined) {
    return standing;
  }
  const bound = bindParameter(standing, packet);
  if (packet.objective === 'propose' && binding.read(packet).length === 0) {
    throw new ReconciliationError(
      `${spec.id} requires ${standing.id}, which bounds the change to the paths in ${binding.from}, and that list is empty. A scope naming nothing is not a narrow scope, it is no scope, and the person would be authorizing a limit that cannot refuse anything.`,
    );
  }
  return bound;
}

/**
 * Two constraints sharing an id must mean the same thing.
 *
 * The rule is compared because that is what a validator reads, and the prose
 * because that is what the model and the person read. A weakened sentence
 * under an unchanged rule would pass validation and mislead everybody who
 * was told what the limits were, which is exactly the harm rule 92 is about.
 */
function assertSameMeaning(expected: Constraint, actual: Constraint, lead: string): void {
  if (JSON.stringify(meaningOf(expected.rule)) !== JSON.stringify(meaningOf(actual.rule))) {
    throw new ReconciliationError(`${lead} Its rule differs, so the same id would decide two different things.`);
  }
  if (expected.prose !== actual.prose) {
    throw new ReconciliationError(`${lead} Its wording differs, and the wording is what the model and the person are told the limit is.`);
  }
  // Absent on both sides is a match: two copies of the same advisory
  // constraint agree. Absent on one side only is a meaning change of the
  // worst kind, because it turns an enforced protection into a stated one or
  // the reverse, so it still fails.
  if (expected.decidedBy !== actual.decidedBy) {
    if (expected.decidedBy === undefined || actual.decidedBy === undefined) {
      throw new ReconciliationError(`${lead} One copy is decided by a validator and the other is advisory, so the same id would mean an enforced protection in one place and a stated instruction in the other.`);
    }
    throw new ReconciliationError(`${lead} A different validator decides it.`);
  }
}

/**
 * M16, asserted: the bound scope and the scope in the authorization brief
 * are the same list, element for element and in order.
 *
 * **A mismatch is a rule 93 governance failure, not a C3 violation.** It
 * throws here, before the brief is built, before a capability is issued and
 * before the model is reached: no request, no record, nothing to accuse.
 * Nothing the model did caused it and nothing it could do would fix it, so
 * reporting it as a violation would be the fabrication rule 94's second
 * clause forbids.
 *
 * Order is compared as well as membership. Two lists with the same paths in
 * different orders are the same scope, so comparing order is stricter than
 * the invariant needs. It is deliberate: a difference in order means the two
 * lists were produced by different code, and that is the condition worth
 * catching, whether or not this particular pair happened to be equivalent.
 */
function assertScopeCoherence(constraints: readonly Constraint[], packet: GovernancePacket, spec: InteractionSpec): void {
  for (const c of constraints) {
    const binding = bindingFor(c.rule);
    if (binding === undefined || binding.from !== 'allowed.proposable') {
      continue;
    }
    const bound = (c.rule as unknown as Record<string, readonly string[]>)[binding.field] ?? [];
    const shown = packet.allowed.proposable;
    const same = bound.length === shown.length && bound.every((p, i) => p === shown[i]);
    if (!same) {
      throw new ReconciliationError(
        `${spec.id}'s ${c.id} would enforce [${bound.join(', ')}] and the authorization brief would show [${shown.join(', ')}]. The person's yes is for the paths they were shown, so a scope that is enforced and a scope that is displayed cannot be two lists.`,
      );
    }
  }
}

/**
 * A rule with its declared instance parameter elided, which is what is left
 * when you take the attempt out of it: the meaning.
 *
 * Elided on **both** sides of every comparison, from the one registry, so
 * the same field is removed from each and everything else is compared
 * exactly. A rule kind with no entry is returned whole, which is what keeps
 * C4 immutable: change C4's deny list and the comparison still sees it.
 *
 * This is not generic field-ignoring. Exactly one named field of exactly one
 * named rule kind is elided, the registry says which, and a test asserts the
 * registry's contents so that a second entry cannot be added quietly.
 */
function meaningOf(rule: ConstraintRule): unknown {
  const binding = bindingFor(rule);
  if (binding === undefined) {
    return rule;
  }
  const { [binding.field]: _parameter, ...meaning } = rule as unknown as Record<string, unknown>;
  return meaning;
}

/**
 * The contradiction we can actually decide.
 *
 * A path that one constraint permits and another forbids. It is a real
 * condition rather than a theoretical one: a condition that widened the
 * allowed scope to include a tool folder would produce an interaction telling
 * the model both "you may change this" and "never touch this", and whichever
 * validator ran last would decide the answer.
 *
 * Narrow on purpose. Contradiction between arbitrary rules is not decidable,
 * and a check that pretended otherwise would be a guess wearing a guarantee.
 * What is checked is stated; what is not checked is not implied.
 */
function assertNoContradiction(constraints: readonly Constraint[], packet: GovernancePacket): void {
  const denied = new Set<string>();
  for (const c of constraints) {
    if (c.rule.kind === 'paths-forbidden') {
      for (const d of c.rule.deny) {
        denied.add(d.toLowerCase());
      }
    }
  }
  if (denied.size === 0) {
    return;
  }
  const allowed: Array<{ path: string; from: string }> = [];
  for (const c of constraints) {
    if (c.rule.kind === 'paths-confined-to') {
      allowed.push(...c.rule.allow.map((p) => ({ path: p, from: c.id })));
    }
    // `no-file-outside-scope` is gone. It was C7's rule, and C7 is now
    // advisory: "keep the change small" is a judgment, and giving it a path
    // list had made it a second copy of C3's containment check. C3 is the
    // one path boundary, and it is the one checked here.
  }
  allowed.push(...packet.allowed.proposable.map((p) => ({ path: p, from: 'the packet\'s proposable paths' })));

  for (const { path, from } of allowed) {
    const hit = normalizeSegments(path).find((segment) => denied.has(segment.toLowerCase()));
    if (hit !== undefined) {
      throw new ReconciliationError(
        `${from} permits ${path}, which is inside ${hit}, and another constraint forbids ${hit}. The interaction would tell the model both that it may change this and that it must never touch it.`,
      );
    }
  }
}
