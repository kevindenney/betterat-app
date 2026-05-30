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

/**
 * Rotating "Ask the librarian" example prompts. Craft-neutral so they read
 * honestly for any interest — the only interest-specific word is the coach
 * noun, which comes from the vocabulary map. (Earlier these were hardcoded
 * sailing prompts — "light-air starts", "pre-start lanes" — and leaked to
 * nursing/entrepreneur personas.)
 */
export function buildLibrarianExampleQueries(
  coachTerm: string,
): readonly string[] {
  const coach = coachTerm.toLowerCase();
  return [
    'What have I been circling lately?',
    'Which idea haven’t I tested yet?',
    `What did my ${coach} flag last time?`,
    'What keeps coming up in my notes?',
  ];
}
