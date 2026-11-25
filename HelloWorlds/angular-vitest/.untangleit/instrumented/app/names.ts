/**
 * Name helpers. These have tests, but only one happy path each.
 * DeepTest should flag the branches the tests never reach.
 */

export function cleanName(raw: string): string {
  let name = raw.trim();
  if (!name) {
    return '';
  }
  if (name === name.toUpperCase() || name === name.toLowerCase()) {
    name = name
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(' ');
  }
  return name;
}

/** The initials of a full name, e.g. "Jeff Q Public" -> "J.Q.P." */
export function initials(fullName: string): string {const __wb_1qzghy6: { returned<T>(value: T): T; threw(error: unknown): void; fellThrough(): void } = (globalThis as any).__witnessBoundary__.enter("initials", arguments, false);try {
  const parts = fullName.split(/\s+/).filter((p) => p);
  if (parts.length === 0) {
    return __wb_1qzghy6.returned('');
  }
  if (parts.length === 1) {
    return __wb_1qzghy6.returned(parts[0].charAt(0).toUpperCase() + '.');
  }
  return __wb_1qzghy6.returned(parts.map((p) => p.charAt(0).toUpperCase() + '.').join(''));
__wb_1qzghy6.fellThrough();} catch (__wb_1qzghy6_e) {__wb_1qzghy6.threw(__wb_1qzghy6_e);throw __wb_1qzghy6_e;}}

/** Shorten a first name for a casual greeting. */
export function nickname(fullName: string, maxLen = 8): string {
  const parts = fullName.split(/\s+/).filter((p) => p);
  const first = parts.length > 0 ? parts[0] : '';
  if (first.length > maxLen) {
    return first.slice(0, maxLen) + '.';
  }
  return first;
}
