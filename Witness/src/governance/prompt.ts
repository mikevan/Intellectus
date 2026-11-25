/**
 * Prompt construction: policy, and policy lives in Witness.
 *
 * This file states five things and refuses to state a sixth: the objective,
 * the facts, the limits, the required response shape, and that refusing is a
 * correct answer. Everything condition-specific comes out of the packet,
 * which is facts. There is no branch on condition anywhere in this file and
 * no hand-written remediation for any particular failure.
 *
 * That is rule 87 applied. The 1.0.19 path-character message was four
 * paragraphs, rewritten four times, each sentence pinned by its own test,
 * and that was one condition. The shape does not scale and it goes stale;
 * the packet replaced it. A prompt builder that branched per condition would
 * rebuild the same thing one level up.
 *
 * Deterministic, and here the reason is specific rather than habitual (rule
 * 88). A model could write these prompts. It must not, for two reasons. The
 * governance record stores a hash of the prompt instead of the prompt, so
 * the same packet and spec must always produce the same text or the record
 * proves nothing about what was sent. And a generated prompt could soften,
 * reorder, or drop a constraint, which would leave validation enforcing
 * something other than what the model was told. The interpretation of the
 * facts, and the sentences a person reads, are the agent's job and are not
 * here.
 *
 * No transport. Nothing in this file sends anything anywhere.
 */
import { createHash } from 'node:crypto';
import type { GovernancePacket, Objective } from './packet';
import type { EffectiveConstraints } from './reconcile';
import type { InteractionSpec } from './registry';
import { describeResponseShape } from './response';
import { isFindingCondition } from './constraints';

export interface GovernedPrompt {
  readonly interactionId: string;
  readonly objective: Objective;
  /** The whole prompt. Deterministic for a given packet and spec. */
  readonly text: string;
  /** What the governance record stores in place of the text. */
  readonly hash: string;
}

/**
 * `effective` is the reconciled constraint set and is required, not derived.
 *
 * The prompt states the limits the model has to respect, and those are the
 * spec's required constraints combined with the condition's own. Computing
 * that here, from the packet alone, would let this file and the authorization
 * brief and the validators each arrive at a different set. One function
 * reconciles, and its answer is handed to all three (M19).
 */
export function buildPrompt(packet: GovernancePacket, spec: InteractionSpec, effective: EffectiveConstraints): GovernedPrompt {
  if (effective.interactionId !== spec.id || effective.packetId !== packet.id) {
    throw new Error(`This constraint set was reconciled for a different interaction or packet. It is not safe to render limits that were worked out for something else.`);
  }
  if (spec.objective !== packet.objective) {
    throw new Error(`This packet declares the objective ${packet.objective} and the interaction ${spec.id} declares ${spec.objective}. One of them is wrong and neither is safe to guess at.`);
  }
  const lines: string[] = [];
  const classified = packet.classification.confidence === 'classified';
  // A finding is a third thing, and the prompt has to say so. `unclassified`
  // on a failure means the checks did not match it. On a finding it means
  // something narrower: the check ran, it produced this result, and what is
  // not established is why. Rendering the second as the first invites the
  // model to hedge a measurement that is not in doubt, and the person then
  // learns nothing from a check that worked.
  const finding = !classified && isFindingCondition(packet.classification.condition);

  // 1. The objective.
  lines.push(packet.objective === 'explain' ? '# Explain what the toolkit found' : '# Propose a change');
  lines.push('');
  lines.push(
    packet.objective === 'explain'
      ? 'Turn the facts below into something a person can act on. The facts come from checks that have already run.'
      : 'Propose a change that meets the objective below, inside the limits below, and nothing more.',
  );
  lines.push('');
  lines.push(
    classified
      ? 'This has already been classified from deterministic evidence. Do not diagnose it again, and do not go looking for a different cause.'
      : finding
        ? 'The finding below was MEASURED and it happened. Treat it as established. What is NOT established is why it happened: no rule matched a cause for it. Explain what was measured and what it means, say plainly that the cause is not established, and do not suggest the finding itself may be wrong or may not have occurred.'
        : 'This has NOT been classified. The checks that ran did not match it, so the cause is not established. Say what the evidence shows and say plainly what it does not. Do not name a cause it does not support.',
  );
  lines.push('');
  lines.push('Use only what is in this brief. If something is not here, say it is not known rather than filling the gap.');
  lines.push('');

  // 2. The facts.
  lines.push(finding ? '## What the toolkit measured' : '## What the toolkit established');
  lines.push('');
  // Same rule as the 1.0.19 brief: absence is stated, never rendered as an
  // empty label or filled with a stand-in.
  lines.push(packet.runner === undefined ? '- Runner or framework: none. The failure happened before a test runner was selected.' : `- Runner or framework: ${packet.runner}`);
  if (finding) {
    // Two facts, kept apart, because collapsing them into one "classified:
    // no" line is exactly the confusion this branch exists to prevent.
    lines.push(`- Finding: ${packet.classification.condition}`);
    lines.push('- The finding itself: measured, and established.');
    lines.push('- The cause of the finding: not established.');
  } else {
    lines.push(`- Failure class: ${packet.classification.label}`);
    lines.push(`- Classified from deterministic evidence: ${classified ? 'yes' : 'no'}`);
  }
  lines.push('');
  if (packet.context.length > 0) {
    lines.push('### Context');
    lines.push('');
    for (const c of packet.context) {
      lines.push(`- ${c.name}: ${c.value}`);
    }
    lines.push('');
  }
  if (packet.known.length > 0) {
    lines.push('### Known');
    lines.push('');
    for (const k of packet.known) {
      lines.push(`- ${k}`);
    }
    lines.push('');
  }
  if (packet.unknown.length > 0) {
    lines.push('### Not known');
    lines.push('');
    lines.push('Genuinely unknown. Do not guess at any of it, and do not offer a guess as something worth acting on.');
    lines.push('');
    for (const u of packet.unknown) {
      lines.push(`- ${u}`);
    }
    lines.push('');
  }
  if (packet.remediation.length > 0) {
    lines.push('### The remediation to explain');
    lines.push('');
    lines.push('This is the fix. Explain it in your own words so the person understands why it works. Do not replace it with a different one.');
    lines.push('');
    for (const r of packet.remediation) {
      lines.push(`- ${r}`);
    }
    lines.push('');
  }

  // 3. The limits, rendered from the structured constraints.
  lines.push('## Limits');
  lines.push('');
  lines.push('Every line is binding. Do not recommend or do anything that breaks one, however reasonable it looks.');
  lines.push('');
  for (const c of effective.constraints) {
    lines.push(`- [${c.id}] ${c.prose}`);
  }
  lines.push('');
  // The scope is always stated, including when it is empty. "You may propose
  // no changes at all" is the sentence that stops an explanation drifting
  // into a suggested edit, and leaving it out whenever the lists were empty
  // would have removed it from exactly the interactions that need it.
  lines.push('### Scope');
  lines.push('');
  lines.push(packet.allowed.readable.length > 0 ? `- You may read: ${packet.allowed.readable.join(', ')}` : '- This brief carries everything you have. There are no files to read.');
  lines.push(packet.allowed.mayPropose ? `- You may propose changes to: ${packet.allowed.proposable.join(', ')}` : '- You may propose no changes at all. This is an explanation.');
  lines.push('');

  // 4. The required response shape, from the parser rather than from prose.
  lines.push('## How to reply');
  lines.push('');
  for (const line of describeResponseShape(packet)) {
    lines.push(line);
  }
  lines.push('');

  // 5. Refusal, which rule 64 makes a correct outcome and which a model will
  // not take unless it is told so in as many words.
  lines.push('## If you cannot');
  lines.push('');
  lines.push(
    packet.objective === 'explain'
      ? 'If the facts here do not support an answer, say which part you cannot answer and why. An honest gap is worth more than a confident guess.'
      : 'If the objective cannot be met inside these limits, reply with an empty change set and a refusal that says why. That is a correct answer, not a failure.',
  );
  lines.push('');

  // The evidence, verbatim, last, so it cannot push the instructions out of view.
  lines.push('## Evidence');
  lines.push('');
  lines.push('Verbatim from the toolkit. Quote from it if it helps; do not rewrite it. The numbers are what citedEvidence refers to.');
  lines.push('');
  lines.push('```');
  packet.evidence.forEach((e, i) => {
    lines.push(`[${i}] (${e.origin}) ${e.text}`);
  });
  lines.push('```');

  const text = lines.join('\n');
  return Object.freeze({ interactionId: spec.id, objective: packet.objective, text, hash: hashOf(text) });
}

/** The digest the governance record keeps in place of the text. */
export function hashOf(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
