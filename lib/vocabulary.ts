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
  // Unit noun for atlas peer clusters ("+12 sessions" at Victoria
  // Harbour reads as "12 things other sailors did here", whereas
  // the platform's "+12 steps" is jargon to a Dragon sailor.
  'Step': 'session',
  // The person practising this craft — used wherever the UI counts or
  // refers to other practitioners (blueprint subscribers, nearby people).
  'Peer': 'sailor',
  'Peers': 'sailors',
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
  'Step': 'shift',
  'Peer': 'practitioner',
  'Peers': 'practitioners',
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
  'Peer': 'artist',
  'Peers': 'artists',
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
  'Peer': 'designer',
  'Peers': 'designers',
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
  'Peer': 'athlete',
  'Peers': 'athletes',
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
  'Peer': 'knitter',
  'Peers': 'knitters',
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
  'Peer': 'maker',
  'Peers': 'makers',
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
  'Peer': 'practitioner',
  'Peers': 'practitioners',
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
  'Peer': 'artist',
  'Peers': 'artists',
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
  'Peer': 'learner',
  'Peers': 'learners',
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
  'Peer': 'grower',
  'Peers': 'growers',
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
  'Peer': 'member',
  'Peers': 'members',
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
  'Peer': 'practitioner',
  'Peers': 'practitioners',
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
  'Plan Phase': 'Before',
  'Do Phase': 'During',
  'Review Phase': 'After',
  'Practice': 'Practice',
  'Institution': 'Organization',
  'Coach': 'Coach',
  'Passport': 'Journal',
  'Period': 'Season',
  'Milestone': 'Milestone',
  'Skill': 'Skill',
  'Community': 'Community',
  'Equipment': 'Equipment',
  'Step': 'log',
  'Peer': 'member',
  'Peers': 'members',
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
// Admin-domain vocabulary (org-admin chrome)
// ---------------------------------------------------------------------------

// The admin surfaces (/admin/[orgId]/*) describe org-level structure —
// cohorts, programs, sites, members — not the personal learning loop the
// fallback maps above cover. These read off the *org's* interest_slug rather
// than the viewer's active interest, so they're resolved synchronously from a
// dedicated slug-keyed table instead of the runtime useVocabulary fetch.

const ADMIN_GENERIC_VOCABULARY: VocabularyMap = {
  Cohort: 'Cohort',
  Cohorts: 'Cohorts',
  Program: 'Program',
  Programs: 'Programs',
  Site: 'Site',
  Sites: 'Sites',
  Member: 'Member',
  Members: 'Members',
  member: 'member',
  members: 'members',
};

const SHG_ADMIN_VOCABULARY: VocabularyMap = {
  Cohort: 'SHG Section',
  Cohorts: 'SHG Sections',
  Program: 'Livelihood Program',
  Programs: 'Livelihood Programs',
  Site: 'Village',
  Sites: 'Villages',
  Member: 'Member',
  Members: 'Members',
  member: 'member',
  members: 'members',
};

const ADMIN_VOCABULARY_BY_SLUG: Record<string, VocabularyMap> = {
  nursing: {
    Cohort: 'Cohort',
    Cohorts: 'Cohorts',
    Program: 'Program',
    Programs: 'Programs',
    Site: 'Clinical Site',
    Sites: 'Clinical Sites',
    Member: 'Student',
    Members: 'Students',
    member: 'student',
    members: 'students',
  },
  'sail-racing': {
    Cohort: 'Fleet',
    Cohorts: 'Fleets',
    Program: 'Program',
    Programs: 'Programs',
    Site: 'Venue',
    Sites: 'Venues',
    Member: 'Racer',
    Members: 'Racers',
    member: 'racer',
    members: 'racers',
  },
  // SHG verticals (PRADAN units) share the self-help-group shape: a section
  // of women in a village moving through a livelihood program together.
  'lac-craft-business': SHG_ADMIN_VOCABULARY,
  'textile-weaving': SHG_ADMIN_VOCABULARY,
  'food-processing': SHG_ADMIN_VOCABULARY,
};

/**
 * Admin-domain vocabulary for an org, keyed by the org's interest slug.
 * Returns a synchronous map (no DB fetch) since the admin chrome renders
 * before any per-interest vocabulary query would resolve. Falls back to
 * generic org nouns for interests without a specific admin lexicon.
 */
export function getAdminVocabulary(interestSlug?: string | null): VocabularyMap {
  if (!interestSlug) return ADMIN_GENERIC_VOCABULARY;
  return ADMIN_VOCABULARY_BY_SLUG[interestSlug] ?? ADMIN_GENERIC_VOCABULARY;
}

// ---------------------------------------------------------------------------
// Step-visibility tier labels
// ---------------------------------------------------------------------------

// The visibility enum is `private | crew | fleet | public`. "Crew" and
// "Fleet" are sailing vernacular but the picker shows on every interest's
// steps + onboarding, so non-sailing users get neutral words. Kept as a
// slug-keyed helper (like getAdminVocabulary) rather than folded into the
// runtime maps so the four tiers stay together and easy to extend per
// interest later.
export interface VisibilityLabels {
  crew: string;
  fleet: string;
}

const DEFAULT_VISIBILITY_LABELS: VisibilityLabels = {
  crew: 'Collaborators',
  fleet: 'Group',
};

const VISIBILITY_LABELS_BY_SLUG: Record<string, VisibilityLabels> = {
  'sail-racing': { crew: 'Crew', fleet: 'Fleet' },
};

/**
 * Labels for the `crew` and `fleet` step-visibility tiers, resolved for an
 * interest. Pass the step's / active interest's slug; omit it (or pass an
 * unmapped slug) for the neutral defaults. `private` and `public` are
 * universal and don't need translation.
 */
export function getVisibilityLabels(interestSlug?: string | null): VisibilityLabels {
  if (!interestSlug) return DEFAULT_VISIBILITY_LABELS;
  return VISIBILITY_LABELS_BY_SLUG[interestSlug] ?? DEFAULT_VISIBILITY_LABELS;
}

// ---------------------------------------------------------------------------
// Place local-knowledge labels
// ---------------------------------------------------------------------------

// Knowledge posts anchor to a place (racing area, hospital, haat, golf
// course…). The copy must read persona-native — "local knowledge about this
// water" is a sailor's phrase, not a nurse's. Spec:
// docs/redesign/specs/PLACE_LOCAL_KNOWLEDGE_SPEC.md
export interface PlaceKnowledgeLabels {
  /** Section heading on list surfaces (fleet/org pages, Atlas callouts). */
  heading: string;
  /** Heading when the surface is already about the place (step detail). */
  aboutHeading: string;
  emptyText: string;
  addCta: string;
}

const DEFAULT_PLACE_KNOWLEDGE_LABELS: PlaceKnowledgeLabels = {
  heading: 'LOCAL KNOWLEDGE',
  aboutHeading: 'ABOUT THIS PLACE',
  emptyText:
    'No local knowledge for this place yet — be the first to share what you know.',
  addCta: 'Add local knowledge',
};

const PLACE_KNOWLEDGE_LABELS_BY_SLUG: Record<string, PlaceKnowledgeLabels> = {
  'sail-racing': {
    heading: 'LOCAL KNOWLEDGE',
    aboutHeading: 'ABOUT THIS AREA',
    emptyText:
      'No local knowledge for this area yet — be the first to share what you know about this water.',
    addCta: 'Add local knowledge',
  },
  nursing: {
    heading: 'SITE KNOWLEDGE',
    aboutHeading: 'ABOUT THIS SITE',
    emptyText:
      'No site knowledge yet — be the first to share what you know: parking, the charge desk, documentation quirks.',
    addCta: 'Add site knowledge',
  },
  golf: {
    heading: 'COURSE KNOWLEDGE',
    aboutHeading: 'ABOUT THIS COURSE',
    emptyText:
      'No course knowledge yet — be the first to share how this course actually plays.',
    addCta: 'Add course knowledge',
  },
  'lac-craft-business': {
    heading: 'MARKET KNOWLEDGE',
    aboutHeading: 'ABOUT THIS PLACE',
    emptyText:
      'No knowledge about this place yet — be the first to share prices, timing, and who to ask for.',
    addCta: 'Add market knowledge',
  },
};

export function getPlaceKnowledgeLabels(
  interestSlug?: string | null,
): PlaceKnowledgeLabels {
  if (!interestSlug) return DEFAULT_PLACE_KNOWLEDGE_LABELS;
  return PLACE_KNOWLEDGE_LABELS_BY_SLUG[interestSlug] ?? DEFAULT_PLACE_KNOWLEDGE_LABELS;
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
