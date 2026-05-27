/**
 * Per-interest starter step content. When a user lands on an interest
 * with zero steps and hasn't been seeded yet, we insert ONE of these
 * with `metadata.is_starter_sample = true` so the user has something
 * real on the canvas from day one.
 *
 * Keep these short, high-signal, and editable — the goal is to give
 * the user a working example of "what does a step look like fully
 * filled in", not to prescribe what they should do. Most users will
 * complete or replace this within their first session.
 */

export interface StarterStepContent {
  title: string;
  /** Plan body — the "what" the user is about to do. Markdown OK. */
  what_body: string;
  /** Why this matters — short paragraph. */
  why_reasoning: string;
  /** Optional time hint — "Saturday morning", "before the next race", "this week". */
  when_label?: string;
  /** Sub-steps list — the "how". Up to 5. */
  how_items?: string[];
  /** Optional category hash so the river uses a sensible color. */
  category?: string;
}

const GENERIC_STARTER: StarterStepContent = {
  title: 'Edit this starter step to fit what you’re actually working on',
  what_body:
    'This is a placeholder step — the shape of what a step looks like once you fill it in. ' +
    'Replace this body with what you’re about to do, why it matters, and how you’ll know it ' +
    'worked. Delete this step once you’ve added a real one and you’ll never see it again.',
  why_reasoning:
    'Steps are most useful when they’re specific. Vague intentions stay vague; concrete ' +
    'steps with a "what", "why", "how", and "when" turn into a record you can learn from.',
  when_label: 'This week',
  how_items: [
    'Replace the title with what you’re actually doing',
    'Fill in the Why so future-you remembers what this was for',
    'Add 1–3 sub-steps under How',
    'Set a When if it has a deadline — leave blank if not',
  ],
  category: 'starter',
};

const STARTERS: Record<string, StarterStepContent> = {
  'sail-racing': {
    title: 'Tune the rig before Saturday’s race',
    what_body:
      'Run through the tuning guide for current conditions before the next race. Check shroud ' +
      'tension, mast rake, and pre-bend; note anything that drifted from the last setup.',
    why_reasoning:
      'Rig tune is the cheapest performance gain on the boat. Most fleets are won at the ' +
      'edges — a setup that matches the day’s wind is the difference between a top-5 finish ' +
      'and a mid-fleet result.',
    when_label: 'Before Saturday',
    how_items: [
      'Re-read the class tuning guide for forecast conditions',
      'Measure shroud tension (or use the Loos gauge mark)',
      'Check mast rake against the standard reference',
      'Set pre-bend with the deck-stepped or partners',
      'Log the numbers in your notes for next time',
    ],
    category: 'rigging',
  },
  nursing: {
    title: 'Pre-shift huddle: review the new lasix protocol',
    what_body:
      'Before tomorrow’s shift, read the updated lasix dosing protocol and the two recent ' +
      'patient cases where titration was changed. Be ready to explain the new max-rate guidance.',
    why_reasoning:
      'New protocols hit the floor weeks before they hit the textbook. Reviewing the actual ' +
      'cases — not just the doc — is what makes the difference between knowing the protocol ' +
      'and applying it confidently at 7am.',
    when_label: 'Before tomorrow’s shift',
    how_items: [
      'Re-read the updated lasix protocol',
      'Pull the two recent titration cases',
      'Note the max-rate change and the reasoning',
      'Bring questions to morning huddle',
    ],
    category: 'pharm',
  },
  'lac-craft-business': {
    title: 'Get five customer conversations this week',
    what_body:
      'Talk to five people who could plausibly buy from your business this month. Don’t pitch — ' +
      'ask what they’re currently doing about the problem you solve, how often it comes up, ' +
      'and what they’ve already tried. Write down quotes.',
    why_reasoning:
      'The first ten conversations are where you learn the language your customers actually ' +
      'use. Without them you’ll keep building from your own head and wonder why your messaging ' +
      'doesn’t land.',
    when_label: 'This week',
    how_items: [
      'List five people to reach out to today',
      'Send a short intro message — no pitch',
      'Ask three open questions, not a survey',
      'Capture verbatim quotes for your notes',
      'Pick one insight to act on next week',
    ],
    category: 'discovery',
  },
};

/**
 * Look up the starter step for a given interest slug. Falls back to the
 * generic placeholder so every interest gets some starter content even
 * if we haven’t written a canonical one yet.
 */
export function getStarterStepForInterest(slug: string | null | undefined): StarterStepContent {
  if (!slug) return GENERIC_STARTER;
  return STARTERS[slug] ?? GENERIC_STARTER;
}
