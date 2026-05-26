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
  /**
   * Section eyebrow above the capability river chart. "CAPABILITY"
   * is nursing-native; other personas read it as generic-tracker
   * vocab. Each interest provides its own framing.
   */
  riverHeader: string;
  /**
   * Ordered list of (regex → vernacular label) pairs used to detect
   * named phases from step titles. The phase generator scans every
   * step in a week against these patterns and uses the most-frequent
   * matched label as the week's named phase. When nothing matches,
   * the generator falls back to the week's dominant capability label.
   *
   * Order matters: more-specific patterns come first so "spring
   * series race 3" hits "Spring Series" before the generic "Race"
   * pattern.
   */
  phasePatterns?: { pattern: RegExp; label: string }[];
}

const DEFAULT_VOCAB: InterestVocab = {
  id: 'default',
  verb: {
    early: 'PLANNING',
    mid: 'IN MOTION',
    late: 'REFLECTING',
  },
  librarianEyebrow: 'This arc · the librarian noticed',
  riverHeader: 'CAPABILITY RIVER',
};

const SAILING_VOCAB: InterestVocab = {
  id: 'sailing',
  verb: {
    early: 'TUNING UP',
    mid: 'RACING',
    late: 'DEBRIEFING',
  },
  librarianEyebrow: 'This arc · logbook noticed',
  riverHeader: 'PRACTICE LOG',
  phasePatterns: [
    { pattern: /spring\s+series/i, label: 'Spring Series' },
    { pattern: /winter\s+series|frostbite/i, label: 'Frostbite' },
    { pattern: /summer\s+series/i, label: 'Summer Series' },
    { pattern: /easter\s+regatta/i, label: 'Easter Regatta' },
    { pattern: /championship|champs\b/i, label: 'Champs' },
    { pattern: /regatta/i, label: 'Regatta' },
    { pattern: /\brace\s*\d/i, label: 'Race day' },
    { pattern: /tune.?up|tuning|rig\s+set/i, label: 'Tune-up' },
    { pattern: /start.?(?:s|drill|practice)|line\s+work/i, label: 'Start drills' },
    { pattern: /heavy\s+air|big\s+breeze/i, label: 'Heavy air' },
    { pattern: /light\s+air|drifter/i, label: 'Light air' },
    { pattern: /downwind|spinnaker|kite\b/i, label: 'Downwind work' },
    { pattern: /upwind|beat|tacking/i, label: 'Upwind work' },
    { pattern: /mark\s+rounding/i, label: 'Mark roundings' },
    { pattern: /\bdebrief\b/i, label: 'Debrief' },
  ],
};

const NURSING_VOCAB: InterestVocab = {
  id: 'nursing',
  verb: {
    early: 'PREPPING',
    mid: 'ROTATING',
    late: 'DEBRIEFING',
  },
  librarianEyebrow: "This rotation · preceptor's debrief",
  riverHeader: 'CAPABILITY RIVER',
  phasePatterns: [
    { pattern: /med.?surg/i, label: 'Med-Surg' },
    { pattern: /\bICU\b|intensive\s+care/i, label: 'ICU' },
    { pattern: /\bpeds\b|pediatric/i, label: 'Peds' },
    { pattern: /\bOB\b|labor|obstetric|maternity/i, label: 'OB' },
    { pattern: /sim|simulation\s+lab/i, label: 'Sim lab' },
    { pattern: /capstone/i, label: 'Capstone' },
    { pattern: /fundamentals/i, label: 'Fundamentals' },
    { pattern: /adult\s+health/i, label: 'Adult Health' },
    { pattern: /preceptorship/i, label: 'Preceptorship' },
    { pattern: /community\s+health|public\s+health/i, label: 'Community health' },
    { pattern: /mental\s+health|psych/i, label: 'Mental health' },
  ],
};

const ENTREPRENEUR_VOCAB: InterestVocab = {
  id: 'entrepreneur',
  verb: {
    early: 'PLANNING',
    mid: 'SHIPPING',
    late: 'TALLYING',
  },
  librarianEyebrow: 'This season · what your books noticed',
  riverHeader: 'BUSINESS MIX',
  phasePatterns: [
    { pattern: /diwali/i, label: 'Diwali rush' },
    { pattern: /wedding\s+season|wedding\s+orders?/i, label: 'Wedding season' },
    { pattern: /\beid\b/i, label: 'Eid prep' },
    { pattern: /\bholi\b/i, label: 'Holi prep' },
    { pattern: /raksha\s+bandhan|rakhi/i, label: 'Rakhi prep' },
    { pattern: /onam|pongal|navratri/i, label: 'Festival prep' },
    { pattern: /launch/i, label: 'Launch' },
    { pattern: /restock|reorder/i, label: 'Restock' },
    { pattern: /\bsamples?\b/i, label: 'Samples' },
    { pattern: /new\s+collection|drop\b/i, label: 'New collection' },
    { pattern: /\bGST\b|filing|return/i, label: 'GST / filing' },
    { pattern: /pop.?up|exhibition\b|fair\b/i, label: 'Pop-up / fair' },
  ],
};

const GOLF_VOCAB: InterestVocab = {
  id: 'golf',
  verb: {
    early: 'WARMING UP',
    mid: 'PLAYING',
    late: 'SCORING',
  },
  librarianEyebrow: "This season · coach's notebook",
  riverHeader: 'ROUND MIX',
  phasePatterns: [
    { pattern: /club\s+championship|club\s+champs/i, label: 'Club Champs' },
    { pattern: /championship|tourney|tournament/i, label: 'Tournament' },
    { pattern: /member.?guest/i, label: 'Member-Guest' },
    { pattern: /league/i, label: 'League' },
    { pattern: /lesson/i, label: 'Lesson' },
    { pattern: /\brange\b|driving\s+range/i, label: 'Range work' },
    { pattern: /putting\s+practice|putting\s+green/i, label: 'Putting work' },
    { pattern: /short\s+game/i, label: 'Short game' },
    { pattern: /\bround\b|18\s+holes?/i, label: 'Round' },
  ],
};

const DRAWING_VOCAB: InterestVocab = {
  id: 'drawing',
  verb: {
    early: 'WARMING UP',
    mid: 'DRAWING',
    late: 'REVIEWING',
  },
  librarianEyebrow: 'This sketchbook · studio notes',
  riverHeader: 'STUDIO LOG',
  phasePatterns: [
    { pattern: /anatomy/i, label: 'Anatomy' },
    { pattern: /portrait/i, label: 'Portrait' },
    { pattern: /plein.?air|outdoor/i, label: 'Plein air' },
    { pattern: /still.?life/i, label: 'Still life' },
    { pattern: /life\s+drawing|figure\s+drawing/i, label: 'Life drawing' },
    { pattern: /landscape/i, label: 'Landscape' },
    { pattern: /sketchbook/i, label: 'Sketchbook' },
    { pattern: /studies?\b/i, label: 'Studies' },
    { pattern: /gesture/i, label: 'Gesture' },
    { pattern: /perspective/i, label: 'Perspective' },
    { pattern: /value\s+study|tonal/i, label: 'Value study' },
  ],
};

const KNITTING_VOCAB: InterestVocab = {
  id: 'knitting',
  verb: {
    early: 'CASTING ON',
    mid: 'KNITTING',
    late: 'BINDING OFF',
  },
  librarianEyebrow: 'This project · pattern notes',
  riverHeader: 'PROJECT LOG',
  phasePatterns: [
    { pattern: /\bsocks?\b/i, label: 'Socks' },
    { pattern: /sweater|jumper|pullover|cardigan/i, label: 'Sweater' },
    { pattern: /\blace\b/i, label: 'Lace' },
    { pattern: /cable/i, label: 'Cables' },
    { pattern: /shawl/i, label: 'Shawl' },
    { pattern: /colorwork|stranded|fair\s+isle/i, label: 'Colorwork' },
    { pattern: /\bKAL\b|knit.?along/i, label: 'KAL' },
    { pattern: /\b(scarf|cowl)\b/i, label: 'Scarf / Cowl' },
    { pattern: /blanket|afghan/i, label: 'Blanket' },
    { pattern: /\bhat\b|beanie/i, label: 'Hat' },
  ],
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

/**
 * Scan a week's step titles against the interest's phase patterns and
 * return the most-frequent matched label. Returns null when nothing
 * matches — callers should fall back to capability-name labeling.
 *
 * Ties are broken by pattern order in `phasePatterns` (more-specific
 * patterns appear first in each vocab so they win against generics).
 */
export function detectPhaseLabelFromTitles(
  titles: string[],
  vocab: InterestVocab,
): string | null {
  const patterns = vocab.phasePatterns;
  if (!patterns || patterns.length === 0 || titles.length === 0) return null;
  const counts = new Map<string, { count: number; firstSeen: number }>();
  for (const title of titles) {
    for (let i = 0; i < patterns.length; i++) {
      const entry = patterns[i]!;
      if (entry.pattern.test(title)) {
        const existing = counts.get(entry.label);
        if (existing) existing.count += 1;
        else counts.set(entry.label, { count: 1, firstSeen: i });
        // Each title can contribute to multiple labels; that's OK —
        // "Spring Series Race 3" should boost both labels but Spring
        // Series wins on tie because its pattern comes first.
      }
    }
  }
  if (counts.size === 0) return null;
  let bestLabel: string | null = null;
  let bestCount = 0;
  let bestFirstSeen = Number.POSITIVE_INFINITY;
  for (const [label, info] of counts) {
    if (
      info.count > bestCount ||
      (info.count === bestCount && info.firstSeen < bestFirstSeen)
    ) {
      bestLabel = label;
      bestCount = info.count;
      bestFirstSeen = info.firstSeen;
    }
  }
  return bestLabel;
}
