/**
 * Shape a step title from free text (an AI suggestion, a plan line).
 *
 * Steps created from suggestions used to store `text.slice(0, 80)` — a hard
 * character cut that left titles ending mid-word ("…perspective to show el").
 * The full text lives in metadata.plan.what_will_you_do; the title is display
 * copy, so cut at a word boundary and mark the elision honestly.
 */
export function stepTitleFromText(text: string, maxChars = 80): string {
  const collapsed = text.trim().replace(/\s+/g, ' ');
  if (collapsed.length <= maxChars) return collapsed;
  const cut = collapsed.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  // Break at the last word boundary unless that discards most of the title
  // (one giant token) — then keep the hard cut.
  const base = lastSpace > maxChars * 0.5 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:.]+$/, '')}…`;
}
