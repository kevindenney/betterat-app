/**
 * Interest vernacular registry — maps an interest id to the words real
 * practitioners use on the L3/L4 timeline surfaces (eyebrow verb,
 * librarian voice). This is the first slice of the broader "interest
 * vocab" plan (see memory: project_interest_vernacular_personas).
 *
 * The four primitives the timeline exposes — step, phase, capability,
 * crew — each need per-interest translation eventually. For v1 we
 * translate only the loudest two: the verb eyebrow above the title
 * ("ZOOM · CURRENT ARC · REFLECTING") and the librarian card eyebrow
 * ("The librarian noticed"). Everything else stays as-is until the
 * interest config grows.
 *
 * Resolution rule:
 *   - Match by interest.id (case-insensitive substring) against a short
 *     list of known verticals; fall back to `DEFAULT_VOCAB` for unknown
 *     interests. We match substrings rather than exact ids because the
 *     interest id format isn't fully standardised yet — "sail-racing",
 *     "sailing", "sail_racing" should all hit the sailing entry.
 *   - The verb tier (early / mid / late) is picked from the user's
 *     position within the arc:
 *       early  → first ~⅓ of the arc, the user is mostly PLANNING
 *       mid    → middle ~⅓, the user is mostly DOING
 *       late   → final ~⅓ or post-arc, the user is mostly REFLECTING
 *     Each interest provides its own native verb for each tier.
 */

export type ArcVerbTier = 'early' | 'mid' | 'late';

export interface InterestVocab {
  /** Stable id used by debug logs. Not shown to the user. */
  id: string;
  /**
   * Top eyebrow verb shown above the season title. The full eyebrow
   * renders as "ZOOM · <SCOPE> · <VERB>" — this is just the verb half.
   */
  verb: Record<ArcVerbTier, string>;
  /**
   * Eyebrow shown above the lilac librarian card. Spoken in the
   * persona's native voice — academic "the librarian noticed" works
   * for nursing; sailors think of it as a "logbook", entrepreneurs
   * want a quieter second-person observation, etc.
   */
  librarianEyebrow: string;
}

const DEFAULT_VOCAB: InterestVocab = {
  id: 'default',
  verb: {
    early: 'PLANNING',
    mid: 'IN MOTION',
    late: 'REFLECTING',
  },
  librarianEyebrow: 'This arc · the librarian noticed',
};

const SAILING_VOCAB: InterestVocab = {
  id: 'sailing',
  verb: {
    early: 'TUNING UP',
    mid: 'RACING',
    late: 'DEBRIEFING',
  },
  librarianEyebrow: 'This arc · logbook noticed',
};

const NURSING_VOCAB: InterestVocab = {
  id: 'nursing',
  verb: {
    early: 'PREPPING',
    mid: 'ROTATING',
    late: 'DEBRIEFING',
  },
  librarianEyebrow: "This rotation · preceptor's debrief",
};

const ENTREPRENEUR_VOCAB: InterestVocab = {
  id: 'entrepreneur',
  verb: {
    early: 'PLANNING',
    mid: 'SHIPPING',
    late: 'TALLYING',
  },
  librarianEyebrow: 'This season · what your books noticed',
};

const GOLF_VOCAB: InterestVocab = {
  id: 'golf',
  verb: {
    early: 'WARMING UP',
    mid: 'PLAYING',
    late: 'SCORING',
  },
  librarianEyebrow: "This season · coach's notebook",
};

const DRAWING_VOCAB: InterestVocab = {
  id: 'drawing',
  verb: {
    early: 'WARMING UP',
    mid: 'DRAWING',
    late: 'REVIEWING',
  },
  librarianEyebrow: 'This sketchbook · studio notes',
};

const KNITTING_VOCAB: InterestVocab = {
  id: 'knitting',
  verb: {
    early: 'CASTING ON',
    mid: 'KNITTING',
    late: 'BINDING OFF',
  },
  librarianEyebrow: 'This project · pattern notes',
};

/**
 * Substring → vocab. Order matters: more-specific patterns first so
 * "sail racing" hits sailing before any future "racing" generic.
 */
const VOCAB_PATTERNS: { pattern: RegExp; vocab: InterestVocab }[] = [
  { pattern: /sail/i, vocab: SAILING_VOCAB },
  { pattern: /nurs/i, vocab: NURSING_VOCAB },
  { pattern: /entrepren|business|home.?biz|seller/i, vocab: ENTREPRENEUR_VOCAB },
  { pattern: /golf/i, vocab: GOLF_VOCAB },
  { pattern: /draw|sketch|paint|illustrat/i, vocab: DRAWING_VOCAB },
  { pattern: /knit|crochet|fiber.?art/i, vocab: KNITTING_VOCAB },
];

/**
 * Resolve an interest id/label to its vocab. Accepts either the id or
 * label so the caller doesn't need to thread both — sample data uses
 * "sailing" / "Sail Racing", real data uses Supabase ids that often
 * match the label slug ("sail-racing").
 */
export function resolveInterestVocab(idOrLabel: string | null | undefined): InterestVocab {
  if (!idOrLabel) return DEFAULT_VOCAB;
  for (const entry of VOCAB_PATTERNS) {
    if (entry.pattern.test(idOrLabel)) return entry.vocab;
  }
  return DEFAULT_VOCAB;
}

/**
 * Pick the verb tier from the user's position within the arc. The
 * thresholds are deliberately wide so a sailor at week 1 of 8 reads
 * as `TUNING UP` (early), at week 4 reads as `RACING` (mid), and at
 * week 8 reads as `DEBRIEFING` (late). Pre-week-1 and post-final
 * positions clamp to early / late respectively.
 */
export function pickVerbTier(currentWeek: number, totalWeeks: number): ArcVerbTier {
  if (totalWeeks <= 1) return 'mid';
  const ratio = (currentWeek - 1) / Math.max(1, totalWeeks - 1);
  if (ratio < 0.34) return 'early';
  if (ratio < 0.75) return 'mid';
  return 'late';
}

/** Convenience — fully composed eyebrow line for the SeasonHeaderChips. */
export function composeArcEyebrow(
  vocab: InterestVocab,
  tier: ArcVerbTier,
  scopeLabel = 'CURRENT ARC',
): string {
  return `ZOOM · ${scopeLabel} · ${vocab.verb[tier]}`;
}
