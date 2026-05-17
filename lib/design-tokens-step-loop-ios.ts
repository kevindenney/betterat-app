/**
 * Step Loop iOS Register — design tokens
 *
 * One-to-one TypeScript mirror of the CSS custom properties in
 * `docs/redesign/ios-register/legacy-reskin-common.css` (`:root { … }`).
 *
 * These tokens are the source of truth for the Phase 0 shared chrome
 * primitives in `components/step-loop/`. Kept deliberately separate from
 * `lib/design-tokens-ios.ts` so the iOS register migration can evolve
 * without disturbing the broader iOS HIG design system.
 *
 * Reference: docs/redesign/ios-register/phase-0-shared-chrome.md
 */

// ---------- iOS-blue (user action / active state) ----------
export const IOS_BLUE = '#007AFF' as const;
export const IOS_BLUE_TINT = 'rgba(0, 122, 255, 0.10)' as const;
export const IOS_BLUE_STRONG = 'rgba(0, 122, 255, 0.18)' as const;
export const IOS_BLUE_DEEP = '#0062CC' as const;

// ---------- iOS-coral (live / capturing) ----------
export const IOS_CORAL = '#FF6B6B' as const;
export const IOS_CORAL_TINT = 'rgba(255, 107, 107, 0.10)' as const;
export const IOS_CORAL_SOFT = 'rgba(255, 107, 107, 0.18)' as const;
export const IOS_CORAL_DEEP = '#E54848' as const;

// ---------- iOS-green (complete / settled) ----------
export const IOS_GREEN = '#34C759' as const;
export const IOS_GREEN_TINT = 'rgba(52, 199, 89, 0.14)' as const;
export const IOS_GREEN_SOFT = 'rgba(52, 199, 89, 0.22)' as const;
export const IOS_GREEN_WASH = 'rgba(52, 199, 89, 0.06)' as const;
export const IOS_GREEN_DEEP = '#1F7A3A' as const;

// ---------- iOS-purple (reflect / long-arc accent) ----------
export const IOS_PURPLE = '#5856D6' as const;
export const IOS_PURPLE_TINT = 'rgba(88, 86, 214, 0.10)' as const;
export const IOS_PURPLE_SOFT = 'rgba(88, 86, 214, 0.18)' as const;
export const IOS_PURPLE_DEEP = '#3F3DA8' as const;

// ---------- iOS-amber (hinge / between state) ----------
export const IOS_AMBER = '#C28A2A' as const;

// ---------- Grays ----------
export const GRAY_6 = '#F2F2F7' as const;
export const GRAY_5 = '#E5E5EA' as const;
export const GRAY_4 = '#D1D1D6' as const;
export const GRAY_3 = '#C7C7CC' as const;
export const GRAY_2 = '#AEAEB2' as const;
export const GRAY_1 = '#8E8E93' as const;

// ---------- Labels ----------
export const LABEL = '#1C1C1E' as const;
export const LABEL_2 = '#3C3C43' as const;
export const LABEL_3 = 'rgba(60, 60, 67, 0.60)' as const;
export const LABEL_4 = 'rgba(60, 60, 67, 0.30)' as const;

// ---------- Stage (anatomy / editorial chrome — not used in shipped UI) ----------
export const STAGE = '#EFEAD8' as const;
export const STAGE_TEXT = '#6B6558' as const;
export const STAGE_INK = '#2A2824' as const;
export const STAGE_LINE = 'rgba(34, 30, 20, 0.12)' as const;
export const STAGE_LINE_SOFT = 'rgba(34, 30, 20, 0.06)' as const;
export const MEASURE = '#C28A2A' as const;
export const MEASURE_SOFT = 'rgba(194, 138, 42, 0.22)' as const;

// ---------- Grouped namespace export ----------
export const STEP_LOOP_TOKENS = {
  iosBlue: IOS_BLUE,
  iosBlueTint: IOS_BLUE_TINT,
  iosBlueStrong: IOS_BLUE_STRONG,
  iosBlueDeep: IOS_BLUE_DEEP,

  iosCoral: IOS_CORAL,
  iosCoralTint: IOS_CORAL_TINT,
  iosCoralSoft: IOS_CORAL_SOFT,
  iosCoralDeep: IOS_CORAL_DEEP,

  iosGreen: IOS_GREEN,
  iosGreenTint: IOS_GREEN_TINT,
  iosGreenSoft: IOS_GREEN_SOFT,
  iosGreenWash: IOS_GREEN_WASH,
  iosGreenDeep: IOS_GREEN_DEEP,

  iosPurple: IOS_PURPLE,
  iosPurpleTint: IOS_PURPLE_TINT,
  iosPurpleSoft: IOS_PURPLE_SOFT,
  iosPurpleDeep: IOS_PURPLE_DEEP,

  iosAmber: IOS_AMBER,

  gray6: GRAY_6,
  gray5: GRAY_5,
  gray4: GRAY_4,
  gray3: GRAY_3,
  gray2: GRAY_2,
  gray1: GRAY_1,

  label: LABEL,
  label2: LABEL_2,
  label3: LABEL_3,
  label4: LABEL_4,

  stage: STAGE,
  stageText: STAGE_TEXT,
  stageInk: STAGE_INK,
  stageLine: STAGE_LINE,
  stageLineSoft: STAGE_LINE_SOFT,
  measure: MEASURE,
  measureSoft: MEASURE_SOFT,
} as const;

export type StepLoopToken = keyof typeof STEP_LOOP_TOKENS;
