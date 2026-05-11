/**
 * BetterAt Vocabulary System
 *
 * Maps universal terms to interest-specific language so the entire app
 * adapts its copy to the user's chosen interest (sail-racing, nursing,
 * drawing, fitness, etc.).
 *
 * The vocabulary is stored in the `betterat_vocabulary` Supabase table and
 * fetched per-interest at runtime. A static fallback for sail-racing is
 * embedded so the app works offline or before the DB call resolves.
 */

import { supabase } from '@/services/supabase';

// Module-level flag: skip Supabase calls once the table is confirmed missing
let tableUnavailable = false;
const emptyVocabularyLoggedInterests = new Set<string>();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Universal term → interest-specific term */
export type VocabularyMap = Record<string, string>;

// ---------------------------------------------------------------------------
// Fallback (sail-racing defaults)
// ---------------------------------------------------------------------------

export const FALLBACK_VOCABULARY: VocabularyMap = {
  'Learning Event': 'Race',
  'Plan Phase': 'Race Prep',
  'Do Phase': 'On the Water',
  'Review Phase': 'Debrief',
  'Practice': 'Practice Session',
  'Institution': 'Yacht Club',
  'Coach': 'Sailing Coach',
  'Coaches': 'Coaches',
  'Passport': 'Sailor Record',
  'Period': 'Season',
  'Milestone': 'First Win',
  'Skill': 'Tactical Skill',
  'Community': 'Venue / Class Forum',
  'Equipment': 'Boat / Sails',
  'Competency': 'Skill',
  'Supervision': 'Requires Coach',
};

// ---------------------------------------------------------------------------
// Per-interest fallback vocabularies (used when Supabase has no rows)
// ---------------------------------------------------------------------------

const NURSING_VOCABULARY: VocabularyMap = {
  'Learning Event': 'Clinical',
  'Plan Phase': 'Pre-Clinical',
  'Do Phase': 'On Shift',
  'Review Phase': 'Debrief',
  'Practice': 'Skills Lab',
  'Institution': 'Clinical Site',
  'Coach': 'Preceptor',
  'Coaches': 'Preceptors',
  'Passport': 'Clinical Portfolio',
  'Period': 'Rotation',
  'Milestone': 'Competency',
  'Skill': 'Clinical Skill',
  'Community': 'Forum',
  'Equipment': 'Clinical Gear',
  'Competency': 'Competency',
  'Supervision': 'Requires Supervision',
};

const DRAWING_VOCABULARY: VocabularyMap = {
  'Learning Event': 'Session',
  'Plan Phase': 'Planning',
  'Do Phase': 'In Session',
  'Review Phase': 'Critique',
  'Practice': 'Study Sketch',
  'Institution': 'Studio',
  'Coach': 'Instructor',
  'Passport': 'Portfolio',
  'Period': 'Series',
  'Milestone': 'Portfolio Piece',
  'Skill': 'Technique',
  'Community': 'Critique Group',
  'Equipment': 'Medium & Tools',
  'Competency': 'Technique',
  'Supervision': '',
};

const DESIGN_VOCABULARY: VocabularyMap = {
  'Learning Event': 'Project',
  'Plan Phase': 'Research',
  'Do Phase': 'Creating',
  'Review Phase': 'Critique',
  'Practice': 'Study',
  'Institution': 'Studio',
  'Coach': 'Mentor',
  'Passport': 'Portfolio',
  'Period': 'Series',
  'Milestone': 'Portfolio Piece',
  'Skill': 'Technique',
  'Community': 'Design Community',
  'Equipment': 'Tools & Media',
};

const FITNESS_VOCABULARY: VocabularyMap = {
  'Learning Event': 'Workout',
  'Plan Phase': 'Pre-Workout',
  'Do Phase': 'Training',
  'Review Phase': 'Recovery',
  'Practice': 'Drill',
  'Institution': 'Gym',
  'Coach': 'Trainer',
  'Passport': 'Training Log',
  'Period': 'Training Block',
  'Milestone': 'PR',
  'Skill': 'Movement',
  'Community': 'Training Group',
  'Equipment': 'Gym Equipment',
};

const KNITTING_VOCABULARY: VocabularyMap = {
  'Learning Event': 'Session',
  'Plan Phase': 'Planning',
  'Do Phase': 'In Session',
  'Review Phase': 'Review',
  'Practice': 'Technique Practice',
  'Institution': 'Knitting Circle',
  'Coach': 'Instructor',
  'Passport': 'Project Log',
  'Period': 'Season',
  'Milestone': 'Finished Object',
  'Skill': 'Technique',
  'Community': 'Knitting Group',
  'Equipment': 'Yarn & Needles',
};

const FIBER_ARTS_VOCABULARY: VocabularyMap = {
  'Learning Event': 'Session',
  'Plan Phase': 'Planning',
  'Do Phase': 'Creating',
  'Review Phase': 'Review',
  'Practice': 'Technique Practice',
  'Institution': 'Fiber Arts Studio',
  'Coach': 'Instructor',
  'Passport': 'Project Log',
  'Period': 'Season',
  'Milestone': 'Finished Piece',
  'Skill': 'Technique',
  'Community': 'Fiber Arts Group',
  'Equipment': 'Fiber & Tools',
};

const GLOBAL_HEALTH_VOCABULARY: VocabularyMap = {
  'Learning Event': 'Field Session',
  'Plan Phase': 'Preparation',
  'Do Phase': 'In Field',
  'Review Phase': 'Debrief',
  'Practice': 'Skills Practice',
  'Institution': 'Organization',
  'Coach': 'Supervisor',
  'Passport': 'Field Portfolio',
  'Period': 'Program Cycle',
  'Milestone': 'Competency',
  'Skill': 'Clinical Skill',
  'Community': 'Program Forum',
  'Equipment': 'Field Kit',
};

const PAINTING_VOCABULARY: VocabularyMap = {
  'Learning Event': 'Session',
  'Plan Phase': 'Planning',
  'Do Phase': 'Painting',
  'Review Phase': 'Critique',
  'Practice': 'Study',
  'Institution': 'Studio',
  'Coach': 'Instructor',
  'Passport': 'Portfolio',
  'Period': 'Series',
  'Milestone': 'Exhibition Piece',
  'Skill': 'Technique',
  'Community': 'Art Community',
  'Equipment': 'Paints & Tools',
};

const LIFELONG_LEARNING_VOCABULARY: VocabularyMap = {
  'Learning Event': 'Session',
  'Plan Phase': 'Planning',
  'Do Phase': 'Learning',
  'Review Phase': 'Reflection',
  'Practice': 'Practice',
  'Institution': 'Learning Community',
  'Coach': 'Mentor',
  'Passport': 'Learning Journal',
  'Period': 'Quarter',
  'Milestone': 'Achievement',
  'Skill': 'Skill',
  'Community': 'Study Group',
  'Equipment': 'Resources',
};

const REGEN_AG_VOCABULARY: VocabularyMap = {
  'Learning Event': 'Field Session',
  'Plan Phase': 'Planning',
  'Do Phase': 'In Field',
  'Review Phase': 'Review',
  'Practice': 'Practice',
  'Institution': 'Farm',
  'Coach': 'Mentor',
  'Passport': 'Field Journal',
  'Period': 'Growing Season',
  'Milestone': 'Harvest',
  'Skill': 'Practice',
  'Community': 'Farm Network',
  'Equipment': 'Tools & Inputs',
};

const LAC_CRAFT_VOCABULARY: VocabularyMap = {
  'Learning Event': 'Activity',
  'Plan Phase': 'Planning',
  'Do Phase': 'Working',
  'Review Phase': 'Review',
  'Practice': 'Activity',
  'Institution': 'Organization',
  'Coach': 'Field Coordinator',
  'Passport': 'Progress Record',
  'Period': 'Season',
  'Milestone': 'Achievement',
  'Skill': 'Skill',
  'Community': 'Self-Help Group',
  'Equipment': 'Tools & Materials',
  'Competency': 'Skill',
  'Supervision': '',
};

const SELF_MASTERY_VOCABULARY: VocabularyMap = {
  'Learning Event': 'Practice',
  'Plan Phase': 'Planning',
  'Do Phase': 'Doing',
  'Review Phase': 'Reflect',
  'Practice': 'Practice',
  'Institution': 'Community',
  'Coach': 'Coach',
  'Passport': 'Journal',
  'Period': 'Season',
  'Milestone': 'Breakthrough',
  'Skill': 'Skill',
  'Community': 'Community',
  'Equipment': 'Tools',
};

/** Map of interest slug → client-side fallback vocabulary */
export const INTEREST_FALLBACK_VOCABULARIES: Record<string, VocabularyMap> = {
  'sail-racing': FALLBACK_VOCABULARY,
  nursing: NURSING_VOCABULARY,
  drawing: DRAWING_VOCABULARY,
  design: DESIGN_VOCABULARY,
  fitness: FITNESS_VOCABULARY,
  'health-and-fitness': FITNESS_VOCABULARY,
  knitting: KNITTING_VOCABULARY,
  'fiber-arts': FIBER_ARTS_VOCABULARY,
  'global-health': GLOBAL_HEALTH_VOCABULARY,
  'painting-printing': PAINTING_VOCABULARY,
  'lifelong-learning': LIFELONG_LEARNING_VOCABULARY,
  'regenerative-agriculture': REGEN_AG_VOCABULARY,
  'self-mastery': SELF_MASTERY_VOCABULARY,
  'lac-craft-business': LAC_CRAFT_VOCABULARY,
};

/** Generic fallback for interests without a specific vocabulary */
const GENERIC_VOCABULARY: VocabularyMap = {
  'Learning Event': 'Practice',
  'Plan Phase': 'Planning',
  'Do Phase': 'Doing',
  'Review Phase': 'Review',
  'Practice': 'Practice',
  'Institution': 'Organization',
  'Coach': 'Coach',
  'Passport': 'Journal',
  'Period': 'Season',
  'Milestone': 'Milestone',
  'Skill': 'Skill',
  'Community': 'Community',
  'Equipment': 'Equipment',
};

/**
 * Get the fallback vocabulary for a given interest slug.
 * Returns generic vocabulary for unknown interests (not sailing-specific).
 */
export function getFallbackVocabulary(interestSlug?: string | null): VocabularyMap {
  if (!interestSlug) return GENERIC_VOCABULARY;
  return INTEREST_FALLBACK_VOCABULARIES[interestSlug] ?? GENERIC_VOCABULARY;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

/**
 * Fetch the vocabulary mapping for a given interest from Supabase.
 *
 * Returns a `VocabularyMap` keyed by `universal_term` with values of
 * `interest_term`. Falls back to `FALLBACK_VOCABULARY` when the query
 * fails or returns no rows.
 */
export async function fetchVocabulary(interestId: string, interestSlug?: string): Promise<VocabularyMap> {
  const fallback = getFallbackVocabulary(interestSlug);
  if (tableUnavailable) return fallback;

  try {
    const { data, error } = await supabase
      .from('betterat_vocabulary')
      .select('universal_term, interest_term')
      .eq('interest_id', interestId)
      .order('sort_order', { ascending: true });

    if (error) {
      console.warn('[vocabulary] Supabase query failed, using fallback (suppressing future calls):', error.message);
      tableUnavailable = true;
      return fallback;
    }

    if (!data || data.length === 0) {
      if (!emptyVocabularyLoggedInterests.has(interestId)) {
        emptyVocabularyLoggedInterests.add(interestId);
        // eslint-disable-next-line no-console
        console.debug('[vocabulary] No rows returned for interest; using fallback', {
          interestId,
          interestSlug: interestSlug ?? null,
        });
      }
      return fallback;
    }

    const map: VocabularyMap = {};
    for (const row of data) {
      map[row.universal_term] = row.interest_term;
    }
    return map;
  } catch (err) {
    console.warn('[vocabulary] Unexpected error, using fallback:', err);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Lookup helper
// ---------------------------------------------------------------------------

/**
 * Translate a universal term into its interest-specific equivalent.
 *
 * Returns the mapped term when found, or the original `term` unchanged so
 * the UI never renders an empty string.
 *
 * @example
 * vocab('Learning Event', vocabulary) // => "Race" (sail-racing)
 * vocab('Learning Event', vocabulary) // => "Clinical Shift" (nursing)
 */
export function vocab(term: string, vocabulary: VocabularyMap): string {
  return vocabulary[term] ?? term;
}
