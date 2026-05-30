export type DoTabInterestKind = 'sailing' | 'nursing' | 'drawing' | 'generic';

export interface InterestDoTabConfig {
  statePillLabel: string;
  stopCtaLabel: string;
  showElapsedByDefault: boolean;
  captureEmptyMessage: string;
}

export interface InterestReflectTabConfig {
  statePillLabel: string;
  settledPillLabel: string;
  saveCtaLabel: string;
  questionPair: [string, string];
  synthesisDraftCopy: (count: number) => string;
}

export const INTEREST_DO_TAB_CONFIG: Record<DoTabInterestKind, InterestDoTabConfig> = {
  sailing: {
    statePillLabel: 'On water',
    stopCtaLabel: 'Finish capture',
    showElapsedByDefault: true,
    captureEmptyMessage: 'Captures will appear here as you record them.',
  },
  nursing: {
    statePillLabel: 'On shift · capturing',
    stopCtaLabel: 'End shift',
    showElapsedByDefault: false,
    captureEmptyMessage: 'Observations will appear here as you capture them.',
  },
  drawing: {
    statePillLabel: 'Session · capturing',
    stopCtaLabel: 'End session',
    showElapsedByDefault: false,
    captureEmptyMessage: 'Sketches and notes appear here as you save them.',
  },
  generic: {
    statePillLabel: 'Practicing',
    stopCtaLabel: 'Finish capture',
    showElapsedByDefault: false,
    captureEmptyMessage: 'Your captures appear here as you record them.',
  },
};

export const INTEREST_REFLECT_TAB_CONFIG: Record<DoTabInterestKind, InterestReflectTabConfig> = {
  sailing: {
    statePillLabel: 'Reflect · ready',
    settledPillLabel: 'Settled',
    saveCtaLabel: 'Mark done',
    questionPair: ['What worked?', 'What would you do differently?'],
    synthesisDraftCopy: (count) =>
      `Want a first draft from your ${count} captures? Tap to draft, or write the first line yourself.`,
  },
  nursing: {
    statePillLabel: 'Reflect · ready',
    settledPillLabel: 'Settled',
    saveCtaLabel: 'Mark done',
    questionPair: ['What worked well today?', 'Where do you need more practice?'],
    synthesisDraftCopy: (count) =>
      `Want a first draft from your ${count} observations? Tap to draft, or write the first line yourself.`,
  },
  drawing: {
    statePillLabel: 'Reflect · ready',
    settledPillLabel: 'Settled',
    saveCtaLabel: 'Mark done',
    questionPair: ['What clicked?', "What's still rough?"],
    synthesisDraftCopy: (count) =>
      `Want a first draft from your ${count} notes? Tap to draft, or write the first line yourself.`,
  },
  generic: {
    statePillLabel: 'Reflect · ready',
    settledPillLabel: 'Settled',
    saveCtaLabel: 'Mark done',
    questionPair: ['What stuck?', "What's still unclear?"],
    synthesisDraftCopy: (count) =>
      `Want a first draft from your ${count} captures? Tap to draft, or write the first line yourself.`,
  },
};

export function resolveDoTabInterestKind(input?: {
  interestSlug?: string | null;
  interestName?: string | null;
  interestId?: string | null;
}): DoTabInterestKind {
  const haystack = [
    input?.interestSlug,
    input?.interestName,
    input?.interestId,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (haystack.includes('sail') || haystack.includes('race')) return 'sailing';
  if (haystack.includes('nurs') || haystack.includes('clinical')) return 'nursing';
  if (haystack.includes('draw') || haystack.includes('sketch')) return 'drawing';
  return 'generic';
}

export function getInterestDoTabConfig(input?: {
  interestSlug?: string | null;
  interestName?: string | null;
  interestId?: string | null;
}): InterestDoTabConfig {
  return INTEREST_DO_TAB_CONFIG[resolveDoTabInterestKind(input)];
}

export function getInterestReflectTabConfig(input?: {
  interestSlug?: string | null;
  interestName?: string | null;
  interestId?: string | null;
}): InterestReflectTabConfig {
  return INTEREST_REFLECT_TAB_CONFIG[resolveDoTabInterestKind(input)];
}

// ---------------------------------------------------------------------------
// Beats lexicon — per-interest label for the step_beats section on the Do
// tab. Schema is generic; only the section header changes per interest.
// ---------------------------------------------------------------------------

export interface InterestBeatsConfig {
  sectionLabel: string;
  addLabel: string;
  /** Placeholder shown in the "time / marker" input — sailing uses pre-start
   *  countdowns like "-30", nursing uses clock times like "7:30a", drawing
   *  uses phase markers like "Warmup". */
  timePlaceholder: string;
  titlePlaceholder: string;
  /** Shown when there are zero beats and the user can add. */
  emptyHint: string;
}

export const INTEREST_BEATS_CONFIG: Record<DoTabInterestKind, InterestBeatsConfig> = {
  sailing: {
    sectionLabel: 'RACE RUN-THROUGH',
    addLabel: 'Add timing beat',
    timePlaceholder: '-30 / 9:55 / start',
    titlePlaceholder: 'Skipper meeting / Off dock / Start sequence',
    emptyHint: 'A beat is a timed moment in the run-through — pre-start, start, legs, post-race.',
  },
  nursing: {
    sectionLabel: 'SHIFT BEATS',
    addLabel: 'Add shift beat',
    timePlaceholder: '7:30a / 1100',
    titlePlaceholder: 'Handoff / Assessment round / Med pass',
    emptyHint: 'A beat is a timed checkpoint in the shift — handoff, rounds, key moments.',
  },
  drawing: {
    sectionLabel: 'SESSION BEATS',
    addLabel: 'Add session beat',
    timePlaceholder: 'Warmup / 0:10 / 0:30',
    titlePlaceholder: 'Gesture sketches / Focused study / Free practice',
    emptyHint: 'A beat is a timed phase of the session.',
  },
  generic: {
    sectionLabel: 'RUN-THROUGH',
    addLabel: 'Add timing beat',
    timePlaceholder: 'Time or marker',
    titlePlaceholder: 'What happens here',
    emptyHint: 'A beat is a timed moment in the run-through.',
  },
};

export function getInterestBeatsConfig(input?: {
  interestSlug?: string | null;
  interestName?: string | null;
  interestId?: string | null;
}): InterestBeatsConfig {
  return INTEREST_BEATS_CONFIG[resolveDoTabInterestKind(input)];
}
