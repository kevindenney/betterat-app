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
    statePillLabel: 'Live · capturing',
    stopCtaLabel: 'Stop capturing',
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
    stopCtaLabel: 'Done capturing',
    showElapsedByDefault: false,
    captureEmptyMessage: 'Your captures appear here as you record them.',
  },
};

export const INTEREST_REFLECT_TAB_CONFIG: Record<DoTabInterestKind, InterestReflectTabConfig> = {
  sailing: {
    statePillLabel: 'Reflect · ready',
    settledPillLabel: 'Settled',
    saveCtaLabel: 'Save & settle',
    questionPair: ['What worked?', 'What would you do differently?'],
    synthesisDraftCopy: (count) =>
      `Want a first draft from your ${count} captures? Tap to draft, or write the first line yourself.`,
  },
  nursing: {
    statePillLabel: 'Reflect · ready',
    settledPillLabel: 'Settled',
    saveCtaLabel: 'Save & settle',
    questionPair: ['What worked well today?', 'Where do you need more practice?'],
    synthesisDraftCopy: (count) =>
      `Want a first draft from your ${count} observations? Tap to draft, or write the first line yourself.`,
  },
  drawing: {
    statePillLabel: 'Reflect · ready',
    settledPillLabel: 'Settled',
    saveCtaLabel: 'Save & settle',
    questionPair: ['What clicked?', "What's still rough?"],
    synthesisDraftCopy: (count) =>
      `Want a first draft from your ${count} notes? Tap to draft, or write the first line yourself.`,
  },
  generic: {
    statePillLabel: 'Reflect · ready',
    settledPillLabel: 'Settled',
    saveCtaLabel: 'Save & settle',
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
