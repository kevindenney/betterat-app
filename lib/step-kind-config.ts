/**
 * Step Kind Config — the Atlas "what kind of step is this?" lens.
 *
 * Atlas shows steps of every kind, not just on-water racing. A step can
 * be a race, a practice session, boat work (tuning/fixing/rigging), a
 * learning task (reading/theory/debrief), or coaching. Each kind gets a
 * color + glyph so the map reads as a field of mixed activity, and a
 * per-interest label so a sailor sees "Boat work" while a nurse sees
 * "Prep" for the same generic kind.
 *
 * v1 derives the kind from the step's freeform `category` + `title` via
 * keyword matching (see `stepKindFor`). There is no `step_kind` column
 * yet — that's a documented fast-follow once we want an explicit editor
 * override. Until then the resolver is the single source of truth.
 *
 * Colors mirror mockup 23 (docs/redesign/mockups/23_betterat_atlas_steps_redesign.html):
 *   race=#2563EB ⛵  practice=#0E7490 🎯  boat_work=#C2700E 🔧
 *   learn=#7C3AED 📖  coach=#16A34A 🧭
 */

export type StepKind = 'race' | 'practice' | 'boat_work' | 'learn' | 'coach' | 'other';

export interface StepKindConfig {
  /** Hex fill used to tint the map pin + cockpit eyebrow. */
  color: string;
  /** Emoji glyph rendered inside/next to the pin. */
  glyph: string;
}

export const STEP_KIND_CONFIG: Record<StepKind, StepKindConfig> = {
  race: { color: '#2563EB', glyph: '⛵' },
  practice: { color: '#0E7490', glyph: '🎯' },
  boat_work: { color: '#C2700E', glyph: '🔧' },
  learn: { color: '#7C3AED', glyph: '📖' },
  coach: { color: '#16A34A', glyph: '🧭' },
  // `other` borrows the practice tone so an unclassified step still reads
  // as "something you're doing" rather than rendering tone-less.
  other: { color: '#0E7490', glyph: '🎯' },
};

/**
 * Per-interest label for each generic kind. The generic kind is the same
 * across personas (a "boat_work" step and a nursing "prep" step are the
 * same primitive); only the vernacular differs — see the interest-vernacular
 * memory. Falls back to `_default` for interests without an override.
 */
const KIND_LABELS: Record<string, Record<StepKind, string>> = {
  _default: {
    race: 'Event',
    practice: 'Practice',
    boat_work: 'Prep',
    learn: 'Learn',
    coach: 'Coach',
    other: 'Step',
  },
  'sail-racing': {
    race: 'Race',
    practice: 'Practice',
    boat_work: 'Boat work',
    learn: 'Learn',
    coach: 'Coach',
    other: 'Step',
  },
  nursing: {
    race: 'Shift',
    practice: 'Practice',
    boat_work: 'Prep',
    learn: 'Study',
    coach: 'Mentor',
    other: 'Step',
  },
};

export function stepKindLabel(kind: StepKind, interestSlug?: string | null): string {
  const table = (interestSlug && KIND_LABELS[interestSlug]) || KIND_LABELS._default;
  return table[kind];
}

// Keyword tables, checked in order. The first table whose keywords appear
// in the step's `category + title` text wins. boat_work is checked before
// race so a "race day check" / rig-prep step reads as prep, not racing;
// learn before coach so a plain "lesson" reads as learning while an
// explicit "coach"/"clinic" still routes to coaching.
const KEYWORDS: { kind: StepKind; terms: string[] }[] = [
  {
    kind: 'boat_work',
    terms: [
      'rig', 'tune', 'tuning', 'repair', 'fix', 'maintenance', 'mainsail',
      'jib', 'spinnaker', 'sail trim', 'mast', 'keel', 'hull', 'prep',
      'setup', 'check', 'fitting', 'hardware', 'polish', 'clean', 'wax',
      'gear', 'haul', 'bottom', 'foil', 'rudder',
    ],
  },
  {
    kind: 'learn',
    terms: [
      'read', 'study', 'lesson', 'theory', 'rule', 'brief', 'debrief',
      'review', 'watch', 'video', 'book', 'learn', 'tactic', 'condition',
      'forecast', 'weather', 'notes', 'plan',
    ],
  },
  { kind: 'coach', terms: ['coach', 'clinic', 'mentor', 'instructor'] },
  {
    kind: 'race',
    terms: ['race', 'racing', 'regatta', 'series', 'heat', 'championship'],
  },
  {
    kind: 'practice',
    terms: [
      'drill', 'practice', 'train', 'session', 'exercise', 'fitness',
      'strength', 'cardio', 'hiit', 'workout', 'sport', 'foredeck',
      'helming', 'boat handling', 'maneuver',
    ],
  },
];

/**
 * Resolve a step's kind from its freeform category + title. Pure keyword
 * matching — no DB column. Returns `other` when nothing matches so the
 * caller always gets a concrete kind to tone the pin with.
 *
 * Pass `isRace` to honor the explicit `timeline_steps.is_race` flag: a step
 * flagged as a race always resolves to `race`, no keyword guessing. This is
 * the Phase N.4 binary entering through the back of the old 5-kind lens —
 * the flag wins, the keyword tables only fill in for unflagged legacy rows.
 */
export function stepKindFor(args: {
  category?: string | null;
  title?: string | null;
  isRace?: boolean | null;
}): StepKind {
  if (args.isRace === true) return 'race';
  const haystack = `${args.category ?? ''} ${args.title ?? ''}`.toLowerCase();
  if (!haystack.trim()) return 'other';
  for (const { kind, terms } of KEYWORDS) {
    if (terms.some((t) => haystack.includes(t))) return kind;
  }
  return 'other';
}

/**
 * Phase N.4 — the only step distinction that changes Atlas behavior.
 *
 * A step is just a step; a race is the one kind that carries a venue, course
 * geometry, marks and on-water conditions, so Atlas treats it specially. The
 * explicit `is_race` flag wins; we keep a keyword fallback so legacy rows that
 * were never flagged (default false) still read as races on the map until the
 * planner sets the flag in the composer. Once the keyword fallback is no longer
 * needed it collapses to `is_race === true`.
 */
export function isRaceStep(args: {
  category?: string | null;
  title?: string | null;
  is_race?: boolean | null;
}): boolean {
  if (args.is_race === true) return true;
  return stepKindFor({ category: args.category, title: args.title }) === 'race';
}
