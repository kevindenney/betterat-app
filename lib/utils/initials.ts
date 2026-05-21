/**
 * Derive a 1-2 character avatar initials string from a person's name.
 *
 * Strips non-letter / non-digit characters (so a stray leading "/" or
 * email-style "@" won't surface in the avatar circle), splits on
 * whitespace, and takes the first letter of the first two words.
 * Returns "?" as a deterministic fallback for empty / missing names.
 */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).slice(0, 2);
  const out = parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
  return out || '?';
}
