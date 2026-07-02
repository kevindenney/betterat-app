/**
 * Value-funnel story vocabulary — the pre-auth onboarding showcase told in
 * each craft's own words (mock: public/onboarding-value-redesign.html).
 *
 * One story, data-driven copy: the loop screen and the people screen are
 * single components fed by this table, so persona difference is a ROW here,
 * never a new screen (Phase D principle; replaces the retired sailing-only
 * track-races / prepare-pro / join-crew funnel).
 *
 * Slugs match the live `interests` catalog so the pick can be cached via the
 * existing `onboarding_interest_slug` AsyncStorage key and carried through
 * signup. Unknown picks (or "I'll decide later") fall back to DEFAULT_STORY.
 *
 * Copy rules: story beats mirror shipped product idioms only (sequence-to-
 * anchor loop, watch → adapt, learner-pull subscribe). Peer/group examples
 * are illustrative archetypes, not real accounts — never imply real social
 * proof (launch truth-state, see project_visions_and_future_ideas).
 */

export interface ValueStoryVocab {
  slug: string;
  /** Chip label + emoji on the pick-craft screen. */
  chipLabel: string;
  emoji: string;
  /** Screen 2 — the Plan/Do/NOW/Review loop, in craft words. */
  loopHeadline: string;
  planLine: string;
  doLine: string;
  reviewLine: string;
  undatedLine: string;
  /** Screen 3 — watch people, adapt what works. */
  peopleHeadline: string;
  peerName: string;
  peerRole: string;
  peerStep: string;
  groupName: string;
  groupProgram: string;
  /** Background gradient for the two story screens. */
  gradient: readonly [string, string];
}

export const DEFAULT_STORY: ValueStoryVocab = {
  slug: '',
  chipLabel: 'Something else…',
  emoji: '✳️',
  loopHeadline: 'Every session makes the next one smarter.',
  planLine: 'Next session — decide what you’ll work on and how.',
  doLine: 'Capture quick notes while you’re in it.',
  reviewLine: 'What stuck? What’s next? Your notes become the next plan.',
  undatedLine: 'Undated by default. Your work flows toward the moments that matter.',
  peopleHeadline: 'See how others practice — take what works.',
  peerName: 'Maya',
  peerRole: 'someone you could follow',
  peerStep: 'Deliberate reps — 30 minutes on the weak spot',
  groupName: 'A local group',
  groupProgram: 'Fundamentals — 6-step program',
  gradient: ['#3B4B66', '#22304A'],
};

const STORIES: Record<string, ValueStoryVocab> = {
  golf: {
    ...DEFAULT_STORY,
    slug: 'golf',
    chipLabel: 'Golf',
    emoji: '⛳️',
    loopHeadline: 'Every round makes the next one smarter.',
    planLine: 'Saturday round — front nine: commit to a game plan per hole.',
    doLine: 'Jot mid-round notes — “driver drifting right on 4.”',
    reviewLine: 'What stuck? What’s next? Your notes become the next plan.',
    undatedLine: 'Undated by default. Your work flows toward the rounds that matter.',
    peopleHeadline: 'See how other golfers practice — take what works.',
    peerRole: 'a golfer you could follow',
    peerStep: 'Short game ladder — 30 balls to 3 targets',
    groupName: 'A golf club near you',
    groupProgram: 'Winter fundamentals — 6-step program',
    gradient: ['#166534', '#14532D'],
  },
  'sail-racing': {
    ...DEFAULT_STORY,
    slug: 'sail-racing',
    chipLabel: 'Sail racing',
    emoji: '⛵️',
    loopHeadline: 'Every race makes the next one smarter.',
    planLine: 'Saturday race — commit to a start plan and a first-beat strategy.',
    doLine: 'Capture between races — “over-stood the left layline twice.”',
    reviewLine: 'What stuck? What’s next? Your debrief becomes the next plan.',
    undatedLine: 'Prep steps are undated. They flow toward the races on your calendar.',
    peopleHeadline: 'See how other sailors prepare — take what works.',
    peerRole: 'a sailor you could follow',
    peerStep: 'Boat-on-boat starts — 5 practice guns',
    groupName: 'A yacht club fleet',
    groupProgram: 'Race-week prep — 6-step blueprint',
    gradient: ['#0369A1', '#0C4A6E'],
  },
  nursing: {
    ...DEFAULT_STORY,
    slug: 'nursing',
    chipLabel: 'Nursing',
    emoji: '🩺',
    loopHeadline: 'Every shift makes the next one smarter.',
    planLine: 'Pre-shift — ICU rotation: what will you practice deliberately?',
    doLine: 'Capture on the floor — “first central line assist.”',
    reviewLine: 'What stuck? What’s unclear? Evidence builds your competency record.',
    undatedLine: 'Your work flows toward the shifts and rotations that matter.',
    peopleHeadline: 'See how other students build competency — take what works.',
    peerRole: 'a student you could follow',
    peerStep: 'ISBAR handoff — practice with a peer before rounds',
    groupName: 'A nursing school',
    groupProgram: 'Clinical fundamentals — cohort program',
    gradient: ['#4F46E5', '#3730A3'],
  },
  drawing: {
    ...DEFAULT_STORY,
    slug: 'drawing',
    chipLabel: 'Drawing',
    emoji: '✏️',
    loopHeadline: 'Every sketch makes the next one smarter.',
    planLine: 'Tonight’s page — perspective study, same subject three ways.',
    doLine: 'Note what fought you — “ellipses collapse on the left side.”',
    reviewLine: 'What stuck? What’s next? Your notes become the next study.',
    undatedLine: 'Undated by default. Your pages flow toward the pieces that matter.',
    peopleHeadline: 'See how other artists practice — take what works.',
    peerRole: 'an artist you could follow',
    peerStep: 'Line-confidence warmups — 10 minutes, no eraser',
    groupName: 'A drawing circle',
    groupProgram: 'Fundamentals of form — 6-step program',
    gradient: ['#7C3AED', '#5B21B6'],
  },
  knitting: {
    ...DEFAULT_STORY,
    slug: 'knitting',
    chipLabel: 'Knitting',
    emoji: '🧶',
    loopHeadline: 'Every project makes the next one smarter.',
    planLine: 'Next project — pick the technique this one will teach you.',
    doLine: 'Note as you go — “tension tightens on purl rows.”',
    reviewLine: 'What stuck? What’s next? Your notes shape the next cast-on.',
    undatedLine: 'Undated by default. Your work flows toward the pieces you’re making.',
    peopleHeadline: 'See how other knitters level up — take what works.',
    peerRole: 'a knitter you could follow',
    peerStep: 'Cable swatch — chart reading without a lifeline',
    groupName: 'A knitting circle',
    groupProgram: 'Colorwork basics — 6-step program',
    gradient: ['#BE185D', '#9D174D'],
  },
  entrepreneur: {
    ...DEFAULT_STORY,
    slug: 'entrepreneur',
    chipLabel: 'A business',
    emoji: '💼',
    loopHeadline: 'Every week makes the business smarter.',
    planLine: 'This week — one experiment: new price point at the market.',
    doLine: 'Capture what happened — “18 jars sold, two asked for bulk.”',
    reviewLine: 'What worked? What’s next? Results become next week’s plan.',
    undatedLine: 'Your work flows toward the market days and launches that matter.',
    peopleHeadline: 'See how other founders build — take what works.',
    peerRole: 'a founder you could follow',
    peerStep: 'Customer conversations — 5 before changing the product',
    groupName: 'A founders’ group',
    groupProgram: 'First 100 customers — 6-step program',
    gradient: ['#B45309', '#92400E'],
  },
  running: {
    ...DEFAULT_STORY,
    slug: 'running',
    chipLabel: 'Running',
    emoji: '🏃',
    loopHeadline: 'Every run makes the next one smarter.',
    planLine: 'Tuesday intervals — 6×800 at goal pace, full recovery.',
    doLine: 'Capture after — “faded on the last two, started too hot.”',
    reviewLine: 'What stuck? What’s next? Your notes shape the next block.',
    undatedLine: 'Training flows toward the races on your calendar.',
    peopleHeadline: 'See how other runners train — take what works.',
    peerRole: 'a runner you could follow',
    peerStep: 'Long-run fueling test — race-day breakfast rehearsal',
    groupName: 'A running club',
    groupProgram: '10K base build — 6-step program',
    gradient: ['#DC2626', '#991B1B'],
  },
};

/** Chips on the pick-craft screen, in display order. */
export const VALUE_STORY_CHIPS: ValueStoryVocab[] = [
  STORIES.golf,
  STORIES['sail-racing'],
  STORIES.nursing,
  STORIES.drawing,
  STORIES.knitting,
  STORIES.entrepreneur,
  STORIES.running,
];

export function resolveValueStory(slug?: string | null): ValueStoryVocab {
  if (!slug) return DEFAULT_STORY;
  return STORIES[slug] ?? DEFAULT_STORY;
}
