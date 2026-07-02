/**
 * Shape a step title from free text (an AI suggestion, a plan line).
 *
 * Steps created from suggestions used to store `text.slice(0, 80)` — a hard
 * character cut that left titles ending mid-word ("…perspective to show el").
 * The full text lives in metadata.plan.what_will_you_do; the title is display
 * copy, so cut at a word boundary and mark the elision honestly.
 */
/**
 * True when a step title is the app's own furniture, carrying no information
 * about the work: "Untitled step", "Step 3", or "<interest name> 1" (the
 * quick-add default). Deliberately narrow — "Back 9" or "Race 2 debrief" are
 * user vocabulary and must never match, so the words-plus-number form only
 * counts when the words are exactly the interest's name.
 */
export function isDefaultStepTitle(title: string, interestLabel?: string | null): boolean {
  const t = title.trim();
  if (/^untitled step$/i.test(t)) return true;
  if (/^step\s+\d{1,4}$/i.test(t)) return true;
  const label = interestLabel?.trim();
  if (label) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`^${escaped}\\s+\\d{1,4}$`, 'i').test(t)) return true;
  }
  return false;
}

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
