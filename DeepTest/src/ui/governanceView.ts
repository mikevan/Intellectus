/**
 * Governance History: what Polyglot governed, and what it established.
 *
 * **A display of stored governed facts, and nothing else.** It recomputes
 * no verdict, re-derives no class, explains nothing, and reaches no model.
 * It has no packet, no interaction and no transport. If a fact is not in the
 * record it is not on this screen, and the screen says so rather than
 * filling the gap.
 *
 * **"What Polyglot established", not "what Polyglot knew."** The second
 * implies the original evidence could be recovered, and it deliberately
 * cannot: the record holds a condition and a classification and a set of
 * digests, never the evidence bodies, the prompt, the response, the proposed
 * source, or the paths and lines a verification target would carry. Saying
 * "knew" would invite the reader to ask for material that was never kept.
 *
 * **The privacy property is inherited, not added.** There is nothing here to
 * redact, because `GovernanceRecord` has no field that can hold any of it.
 */
import * as vscode from 'vscode';
import { GovernanceStoreError, readGovernance } from '@projectrevivesolutions/witness';
import type { FoldedRecord } from '@projectrevivesolutions/witness';
import { governanceDir } from '../governance';

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GOVERNANCE_TITLE = 'Governance History';

/** Opens the panel, or says why it could not be read. One panel, reused. */
export function showGovernanceHistory(folder: vscode.WorkspaceFolder | undefined, log: (line: string) => void): void {
  const panel = vscode.window.createWebviewPanel('deeptest.governance', GOVERNANCE_TITLE, vscode.ViewColumn.One, { enableScripts: false });
  panel.webview.html = html(folder, log);
}

function html(folder: vscode.WorkspaceFolder | undefined, log: (line: string) => void): string {
  if (!folder) {
    return page('<p>Open the folder you are working in, and DeepTest will show what it governed there.</p>');
  }
  try {
    const history = readGovernance(governanceDir(folder));
    if (history.records.length === 0) {
      return page('<p>Nothing has been governed in this project yet. When you hand a brief to your assistant, what happened is recorded here.</p>');
    }
    const note = history.interruptedAppend
      ? '<p class="muted">The history ends part-way through a write, so the last entry was left out. Everything above it is complete.</p>'
      : '';
    return page(`${history.records.map(entry).join('')}${note}${footer()}`);
  } catch (err) {
    // An unreadable history is never shown as an empty one. Those look
    // identical to a reader, and only one of them means nothing happened.
    log(`${GOVERNANCE_TITLE} could not be read: ${(err as Error).message}`);
    const why = err instanceof GovernanceStoreError ? err.message : (err as Error).message;
    return page(
      `<p><strong>The Governance History could not be read, so DeepTest is not showing one.</strong></p><p class="muted">${esc(why)}</p><p class="muted">Nothing has been written over it.</p>`,
    );
  }
}

/** One attempt. Every line comes from a stored field. */
function entry(r: FoldedRecord): string {
  const rec = r.record;
  const rows: Array<[string, string]> = [
    ['Interaction', `${rec.interactionId} in ${rec.tool}, to ${rec.objective}`],
    ['What Polyglot established', `${rec.conditionId}, classified as ${rec.classification.failureClass} (${rec.classification.confidence})`],
    ['Authorized', rec.authorization ? `${rec.authorization.granted ? 'yes' : 'no'}, at ${rec.authorization.at}` : 'no authorization was required'],
    ...(rec.authorization?.by ? ([['Authorized by', rec.authorization.by]] as Array<[string, string]>) : []),
    ['Limits that bound it', rec.constraintIds.length > 0 ? rec.constraintIds.join(', ') : 'none'],
    ['Checks that ran', rec.validators.length > 0 ? rec.validators.map(validator).join('; ') : 'none'],
    ['Model that answered', `${rec.model.id}${rec.model.vendor ? ` (${rec.model.vendor}${rec.model.family ? `, ${rec.model.family}` : ''})` : ''}`],
    ['Answer accepted', rec.accepted ? 'yes' : 'no'],
    ['Asked again after a failed check', rec.corrections === 1 ? 'once' : 'no'],
    ['Checked again afterwards', verification(r)],
  ];
  return `<section class="attempt ${r.status}">
    <h2>${esc(rec.at)}</h2>
    <table>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
  </section>`;
}

function validator(v: { id: string; verdict: string; constraint?: string; cause?: string }): string {
  return v.verdict === 'fail' ? `${v.id} failed ${v.constraint ?? ''}`.trim() : v.verdict === 'invalid' ? `${v.id} could not decide (${v.cause ?? 'unknown'})` : `${v.id} ${v.verdict}`;
}

/**
 * The verification line, including the one state that is neither yes nor no.
 *
 * Two deterministic measurements that disagreed are both here. Nothing
 * chooses between them, because choosing would delete the interesting half
 * of a fact about Polyglot's own verification.
 */
function verification(r: FoldedRecord): string {
  if (r.status === 'unverified') {
    return 'not yet';
  }
  if (r.status === 'conflicted') {
    return `two different answers, both kept: ${r.outcomes.map((o) => `${o.outcome} at ${o.at}`).join(', ')}. Nothing has chosen between them.`;
  }
  const o = r.outcomes[0];
  return `${o.outcome}, at ${o.at}`;
}

/** Said once, plainly, so nobody looks for material that was never kept. */
function footer(): string {
  return `<p class="muted">The source, the brief, the assistant's answer and any proposed code were deliberately not kept. This history records what was governed and what was established, not what was said.</p>`;
}

function page(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 16px 20px; line-height: 1.5; }
  h1 { font-size: 1.3em; margin: 0 0 4px; }
  h2 { font-size: 0.95em; margin: 0 0 6px; color: var(--vscode-descriptionForeground); font-weight: normal; }
  .muted { color: var(--vscode-descriptionForeground); }
  section.attempt { border: 1px solid var(--vscode-widget-border, #444); border-radius: 4px; padding: 10px 12px; margin: 12px 0; }
  section.conflicted { border-color: var(--vscode-inputValidation-warningBorder, #b58900); }
  table { border-collapse: collapse; width: 100%; }
  th { text-align: left; font-weight: 600; padding: 2px 10px 2px 0; vertical-align: top; white-space: nowrap; width: 1%; }
  td { padding: 2px 0; }
</style></head><body>
<h1>${GOVERNANCE_TITLE}</h1>
<p class="muted">What DeepTest governed in this project, newest first.</p>
${body}
</body></html>`;
}
