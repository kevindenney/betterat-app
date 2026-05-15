/**
 * Per-interest beat names for the iOS register Race Prep surface.
 *
 * Sibling to lib/vocabulary.ts — follows the same per-interest-with-
 * generic-fallback pattern, but holds structured {title, meta} pairs
 * rather than the string→string maps vocabulary.ts handles.
 *
 * Beats are the three named planning sections on Race Prep iOS
 * (BeatCard components). Each interest defines its own beat naming
 * scheme; unmapped interests fall to numbered generic placeholders
 * until they earn a designed map.
 *
 * Lookup follows the STEP's interest, not the viewer's active interest.
 * Same precedent as useVocabulary(overrideInterestId): the surface
 * speaks the domain of the artifact, not the language of the visitor.
 *
 * Adding a new interest: drop a const + add to BEATS_BY_INTEREST.
 * Drawing is intentionally absent — falls to generic until a drawing
 * user surfaces with real beat-naming preferences.
 */

export interface BeatDef {
  /** Beat title rendered as the 22pt semibold header on BeatCard */
  title: string;
  /** Right-aligned meta in the BeatCard header (13pt secondary) */
  meta: string;
}

const SAILING_BEATS: BeatDef[] = [
  { title: 'Start', meta: '5-min sequence' },
  { title: 'First beat', meta: 'to the windward mark' },
  { title: 'Contingency', meta: 'your rule' },
];

const CLINICAL_BEATS: BeatDef[] = [
  { title: 'Briefing', meta: 'pre-shift report' },
  { title: 'Shift', meta: 'on the floor' },
  { title: 'Debrief', meta: 'post-shift handoff' },
];

const BEATS_BY_INTEREST: Record<string, BeatDef[]> = {
  'sail-racing': SAILING_BEATS,
  nursing: CLINICAL_BEATS,
};

/**
 * Generic fallback for unmapped interests (drawing, fitness, golf,
 * knitting, design, self-mastery, anything not yet in BEATS_BY_INTEREST).
 * Numbered placeholders signal "this interest hasn't earned a designed
 * vocabulary yet" rather than borrowing sailing language.
 */
const GENERIC_BEATS: BeatDef[] = [
  { title: 'Beat 1', meta: 'first phase' },
  { title: 'Beat 2', meta: 'second phase' },
  { title: 'Beat 3', meta: 'third phase' },
];

/**
 * Get the beat definitions for an interest slug.
 *
 * @param interestSlug The step's interest slug (e.g. 'sail-racing',
 *   'nursing'). May be null/undefined if the step has no interest
 *   association or the slug hasn't been resolved yet — both fall to
 *   GENERIC_BEATS.
 * @returns An array of exactly three BeatDef entries, always. The
 *   length is stable so consumers can rely on indexed access without
 *   length checks.
 */
export function getBeatsForInterest(
  interestSlug?: string | null,
): BeatDef[] {
  if (!interestSlug) return GENERIC_BEATS;
  return BEATS_BY_INTEREST[interestSlug] ?? GENERIC_BEATS;
}
