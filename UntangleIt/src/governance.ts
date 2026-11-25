/**
 * Where UntangleIt keeps its Governance History.
 *
 * **The product owns the location and Witness owns everything else**, the
 * same split `behaviour/gate.ts` uses, so a shared layer can never write
 * into the wrong product's folder.
 *
 * **One store per product, never one shared file.** A path both products
 * wrote would be cross-product coupling in all but name, would need locking
 * neither has, and would make one product's corruption the other's outage.
 * UntangleIt does not read DeepTest's history and does not know where it is.
 *
 * **Local only.** Not committed: it can carry who authorized an attempt, it
 * carries model identity and operational audit metadata, and it is
 * append-only and unbounded.
 *
 * UntangleIt has no equivalent of DeepTest's `clearWorkDir`, so there is no
 * sweeper to protect the file from, and none is invented for it.
 */
import * as path from 'node:path';

export function governanceDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.untangleit');
}
