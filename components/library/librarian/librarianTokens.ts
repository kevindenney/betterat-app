/**
 * Librarian voice tokens.
 *
 * The librarian reads the user's corpus and never invents. Its register
 * is locked: italic Georgia serif, purple-tinted — the same vocabulary
 * used by the AI synthesis on Concept detail. Never sans, never blue,
 * never sparkles, never robot iconography.
 */

export const LIBRARIAN_PURPLE = '#7C4DFF';
export const LIBRARIAN_PURPLE_INK = '#5B36D4';
export const LIBRARIAN_PURPLE_TINT_12 = 'rgba(124,77,255,0.12)';
export const LIBRARIAN_PURPLE_TINT_08 = 'rgba(124,77,255,0.08)';
export const LIBRARIAN_PURPLE_TINT_18 = 'rgba(124,77,255,0.18)';

export const LIBRARIAN_SERIF = 'Georgia';

export const LIBRARIAN_EXAMPLE_QUERIES = [
  'Have I written about light-air starts before?',
  'What did Sam say about pre-start lanes?',
  'Where did I last touch on shift-vs-side?',
  'Have I tested "boat speed is permission to think"?',
] as const;
