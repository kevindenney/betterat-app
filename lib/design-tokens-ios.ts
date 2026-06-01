/**
 * RegattaFlow iOS Design System
 * Apple Human Interface Guidelines compliant design tokens
 */

// iOS System Colors (Light Mode)
export const IOS_COLORS = {
  // Labels
  label: '#000000',
  secondaryLabel: 'rgba(60, 60, 67, 0.6)',
  tertiaryLabel: 'rgba(60, 60, 67, 0.3)',
  quaternaryLabel: 'rgba(60, 60, 67, 0.18)',

  // Backgrounds
  systemBackground: '#FFFFFF',
  secondarySystemBackground: '#F2F2F7',
  tertiarySystemBackground: '#FFFFFF',
  systemGroupedBackground: '#F2F2F7',
  secondarySystemGroupedBackground: '#FFFFFF',
  tertiarySystemGroupedBackground: '#F2F2F7',

  // System Colors
  systemBlue: '#007AFF',
  systemGreen: '#34C759',
  systemOrange: '#FF9500',
  systemRed: '#FF3B30',
  systemYellow: '#FFCC00',
  systemPurple: '#AF52DE',
  systemPink: '#FF2D55',
  systemTeal: '#5AC8FA',
  systemIndigo: '#5856D6',
  systemMint: '#00C7BE',
  systemCyan: '#32ADE6',
  systemBrown: '#A2845E',

  // Grays
  systemGray: '#8E8E93',
  systemGray2: '#AEAEB2',
  systemGray3: '#C7C7CC',
  systemGray4: '#D1D1D6',
  systemGray5: '#E5E5EA',
  systemGray6: '#F2F2F7',

  // Separators
  separator: 'rgba(60, 60, 67, 0.29)',
  opaqueSeparator: '#C6C6C8',

  // Fill Colors
  systemFill: 'rgba(120, 120, 128, 0.2)',
  secondarySystemFill: 'rgba(120, 120, 128, 0.16)',
  tertiarySystemFill: 'rgba(118, 118, 128, 0.12)',
  quaternarySystemFill: 'rgba(116, 116, 128, 0.08)',
} as const;

// iOS System Colors (Dark Mode)
export const IOS_COLORS_DARK = {
  // Labels
  label: '#FFFFFF',
  secondaryLabel: 'rgba(235, 235, 245, 0.6)',
  tertiaryLabel: 'rgba(235, 235, 245, 0.3)',
  quaternaryLabel: 'rgba(235, 235, 245, 0.18)',

  // Backgrounds
  systemBackground: '#000000',
  secondarySystemBackground: '#1C1C1E',
  tertiarySystemBackground: '#2C2C2E',
  systemGroupedBackground: '#000000',
  secondarySystemGroupedBackground: '#1C1C1E',
  tertiarySystemGroupedBackground: '#2C2C2E',

  // System Colors (Dark variants - slightly brighter)
  systemBlue: '#0A84FF',
  systemGreen: '#30D158',
  systemOrange: '#FF9F0A',
  systemRed: '#FF453A',
  systemYellow: '#FFD60A',
  systemPurple: '#BF5AF2',
  systemPink: '#FF375F',
  systemTeal: '#64D2FF',
  systemIndigo: '#5E5CE6',
  systemMint: '#63E6E2',
  systemCyan: '#5AC8FA',
  systemBrown: '#AC8E68',

  // Grays
  systemGray: '#8E8E93',
  systemGray2: '#636366',
  systemGray3: '#48484A',
  systemGray4: '#3A3A3C',
  systemGray5: '#2C2C2E',
  systemGray6: '#1C1C1E',

  // Separators
  separator: 'rgba(84, 84, 88, 0.65)',
  opaqueSeparator: '#38383A',

  // Fill Colors
  systemFill: 'rgba(120, 120, 128, 0.36)',
  secondarySystemFill: 'rgba(120, 120, 128, 0.32)',
  tertiarySystemFill: 'rgba(118, 118, 128, 0.24)',
  quaternarySystemFill: 'rgba(116, 116, 128, 0.18)',
} as const;

// iOS Typography Scale (following SF Pro guidelines)
export const IOS_TYPOGRAPHY = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, lineHeight: 41, letterSpacing: 0.37 },
  title1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34, letterSpacing: 0.36 },
  title2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28, letterSpacing: 0.35 },
  title3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 25, letterSpacing: 0.38 },
  headline: { fontSize: 17, fontWeight: '600' as const, lineHeight: 22, letterSpacing: -0.41 },
  body: { fontSize: 17, fontWeight: '400' as const, lineHeight: 22, letterSpacing: -0.41 },
  callout: { fontSize: 16, fontWeight: '400' as const, lineHeight: 21, letterSpacing: -0.32 },
  subhead: { fontSize: 15, fontWeight: '400' as const, lineHeight: 20, letterSpacing: -0.24 },
  footnote: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18, letterSpacing: -0.08 },
  caption1: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16, letterSpacing: 0 },
  caption2: { fontSize: 11, fontWeight: '400' as const, lineHeight: 13, letterSpacing: 0.07 },
} as const;

// iOS Spacing following 8-point grid
export const IOS_SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
} as const;

// iOS Corner Radii
export const IOS_RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  continuous: 'continuous', // For smooth/continuous corners
  full: 9999,
} as const;

// iOS Shadows (Apple-style soft shadows)
export const IOS_SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
} as const;

// iOS Animation durations and easings
export const IOS_ANIMATIONS = {
  // Duration in milliseconds
  duration: {
    instant: 100,
    fast: 200,
    normal: 300,
    slow: 500,
  },
  // Spring configurations for react-native-reanimated
  spring: {
    snappy: { damping: 20, stiffness: 300 },
    bouncy: { damping: 15, stiffness: 200 },
    gentle: { damping: 20, stiffness: 150 },
    stiff: { damping: 30, stiffness: 400 },
  },
} as const;

// iOS Touch targets and interaction areas
export const IOS_TOUCH = {
  minHeight: 44,
  minWidth: 44,
  listItemHeight: 44,
  compactListItemHeight: 38,
  largeListItemHeight: 56,
} as const;

// iOS Blur effects (for use with expo-blur)
export const IOS_BLUR = {
  light: 'light',
  dark: 'dark',
  chromeMaterial: 'chromeMaterial',
  material: 'systemMaterial',
  thinMaterial: 'systemThinMaterial',
  ultraThinMaterial: 'systemUltraThinMaterial',
  thickMaterial: 'systemThickMaterial',
} as const;

// iOS List insets (for grouped/inset grouped styles)
export const IOS_LIST_INSETS = {
  grouped: {
    marginHorizontal: 16,
    borderRadius: 10,
  },
  insetGrouped: {
    marginHorizontal: 16,
    borderRadius: 10,
  },
  plain: {
    marginHorizontal: 0,
    borderRadius: 0,
  },
} as const;

// Semantic colors for RegattaFlow (mapped to iOS colors)
export const REGATTA_SEMANTIC_COLORS = {
  // Race status colors
  raceUpcoming: IOS_COLORS.systemBlue,
  raceInProgress: IOS_COLORS.systemGreen,
  raceCompleted: IOS_COLORS.systemGray,
  raceCancelled: IOS_COLORS.systemRed,

  // Weather condition colors
  weatherGood: IOS_COLORS.systemGreen,
  weatherCaution: IOS_COLORS.systemOrange,
  weatherDanger: IOS_COLORS.systemRed,

  // Checklist status
  checklistComplete: IOS_COLORS.systemGreen,
  checklistPending: IOS_COLORS.systemOrange,
  checklistNotStarted: IOS_COLORS.systemGray,

  // Navigation
  tabActive: IOS_COLORS.systemBlue,
  tabInactive: IOS_COLORS.systemGray,

  // Coaching
  coachAvailable: IOS_COLORS.systemGreen,
  coachBusy: IOS_COLORS.systemOrange,
  coachOffline: IOS_COLORS.systemGray,
} as const;

/**
 * iOS Register tokens (2026-05) — the iOS-native visual register handed off
 * by Claude Design. Two accents, two jobs: iOS blue for user actions and
 * active state; iOS coral for AI questions and marked content. White cards
 * float on system gray 6 ground. SF Pro throughout — no serif.
 *
 * Source: docs/redesign/IOS_MIGRATION_PLAN.md (Phase 0).
 * Confirmed 2026-05-14: iOS register is canonical; editorial tokens are
 * superseded as consumers migrate (Phase 1–4).
 */
export const IOS_REGISTER = {
  // Two accents, two jobs
  accentUserAction: IOS_COLORS.systemBlue,              // #007AFF — user actions, active state
  accentMarkedContent: '#FF6B6B',                       // coral — AI questions, marked content
  accentMarkedContentTint: 'rgba(255, 107, 107, 0.10)', // ~12% coral fill (AI prompt card)
  accentMarkedContentTintStrong: 'rgba(255, 107, 107, 0.16)',

  // Ground + cards
  groundBg: IOS_COLORS.systemGroupedBackground,         // #F2F2F7 system gray 6
  cardBg: '#FFFFFF',                                    // white rounded-rect cards
  fillPill: IOS_COLORS.systemGray5,                     // #E5E5EA — working-on pills, fills
  fillSecondary: IOS_COLORS.systemGray4,                // #D1D1D6

  // Labels — exact register opacities (slightly different from IOS_COLORS generic)
  label: '#000000',
  labelSecondary: 'rgba(60, 60, 67, 0.62)',
  labelTertiary: 'rgba(60, 60, 67, 0.32)',

  // Separators — register uses softer hairlines than generic IOS_COLORS
  separator: 'rgba(60, 60, 67, 0.20)',
  separatorStrong: 'rgba(60, 60, 67, 0.36)',

  // Atmospheric tint — scoped to forecast tile group ONLY, not whole surfaces
  atmosphericSlate: 'rgba(120, 145, 175, 0.14)',
  atmosphericSlateFade: 'rgba(120, 145, 175, 0)',

  // Live dot — "concept active in current step" grammar
  // Replaces editorial register's green live-dot; same component scale and meaning
  liveDotSize: 6,
  liveDotColor: '#FF6B6B',
} as const;

/**
 * Register section-identity accents (2026-06) — the "whose surface is this"
 * wayfinding hue, NOT an action color. Distinct from IOS_REGISTER.accentUserAction
 * (#007AFF), which is reserved for buttons/checkboxes/interactive controls.
 *
 * Per the register-cutover D1 decision (Option A): a navy/purple element doing a
 * state/location/identity job KEEPS its identity hue; an element doing an action
 * job → accentUserAction. These tokens name the identity half of that split so
 * shells stop hardcoding the hexes.
 *
 *   purple   — Creator Studio section identity
 *   navy     — Org Admin / institutional section identity
 *   drawing  — solo-author (brown) section identity
 */
export const REGISTER_SECTION_ACCENT = {
  purple: '#6B5BBF',
  navy: '#28406B',
  drawing: '#B8855A',
} as const;

/**
 * Register people/author role marker (2026-06) — the badge hue for
 * Author / Co-author / Faculty across org+studio surfaces. Deliberately the
 * same value as REGISTER_SECTION_ACCENT.purple but a SEPARATE token: one marks
 * a person's role, the other marks a section's identity. They must never be
 * collapsed (see docs/redesign/REGISTER_CUTOVER_PLAN.md §0).
 */
export const REGISTER_ROLE_AUTHOR = '#6B5BBF' as const;

/**
 * iOS Register text recipes — SF Pro Display/Text sizes pulled from the
 * Race Prep iOS register HTML. These are register-specific (more opinionated
 * than the generic IOS_TYPOGRAPHY) and intended for the 12 iOS-register
 * surfaces. Generic Apple HIG screens keep using IOS_TYPOGRAPHY.
 *
 * Pair with IOS_REGISTER colors for full register fidelity.
 */
export const IOS_REGISTER_TEXT = {
  // Large title block ("All Entries / Today" Journal treatment)
  titleEyebrow:  { fontSize: 11,   fontWeight: '600' as const, letterSpacing: 0.5,  textTransform: 'uppercase' as const },
  title:         { fontSize: 32,   fontWeight: '400' as const, lineHeight: 36,      letterSpacing: -0.7 },
  titleMeta:     { fontSize: 15,                                lineHeight: 21,      letterSpacing: -0.2 },

  // Section eyebrow ("WORKING ON", "FROM YOUR LAST RACE", etc.)
  sectionEyebrow:{ fontSize: 11,   fontWeight: '600' as const, letterSpacing: 0.5,  textTransform: 'uppercase' as const },

  // Forecast tile
  tileLabel:     { fontSize: 10.5, fontWeight: '600' as const, letterSpacing: 0.5,  textTransform: 'uppercase' as const },
  tileValue:     { fontSize: 19,   fontWeight: '400' as const, lineHeight: 21,      letterSpacing: -0.55 },
  tileSub:       { fontSize: 11.5,                              lineHeight: 14,      letterSpacing: -0.1 },

  // Working-on pill
  pill:          { fontSize: 14,                                                     letterSpacing: -0.2 },
  pillState:     { fontSize: 12,                                                     letterSpacing: -0.05 },

  // Quote card
  quote:         { fontSize: 17,   fontWeight: '400' as const, lineHeight: 24,      letterSpacing: -0.34 },
  quoteProv:     { fontSize: 13,                                                     letterSpacing: -0.1 },

  // Beat card (the three named planning sections — Start / First beat / Contingency)
  beatHeader:    { fontSize: 22,   fontWeight: '600' as const,                       letterSpacing: -0.5 },
  beatMeta:      { fontSize: 13,                                                     letterSpacing: -0.1 },
  beatBody:      { fontSize: 17,   fontWeight: '400' as const, lineHeight: 25,      letterSpacing: -0.34 },

  // Permission rule callout (3px coral left border + flag)
  ruleLabel:     { fontSize: 11,   fontWeight: '600' as const, letterSpacing: 0.5,  textTransform: 'uppercase' as const },
  ruleText:      { fontSize: 17,   fontWeight: '600' as const, lineHeight: 23,      letterSpacing: -0.34 },

  // Coral AI prompt card
  aiPromptLabel: { fontSize: 11,   fontWeight: '600' as const, letterSpacing: 0.5,  textTransform: 'uppercase' as const },
  aiPromptBody:  { fontSize: 17,   fontWeight: '400' as const, lineHeight: 24,      letterSpacing: -0.34 },

  // Buttons (filled iOS + text)
  buttonFill:    { fontSize: 15,   fontWeight: '600' as const,                       letterSpacing: -0.2 },
  buttonText:    { fontSize: 15,                                                     letterSpacing: -0.2 },

  // Crew person row
  crewName:      { fontSize: 17,                                                     letterSpacing: -0.34 },
  crewRole:      { fontSize: 14,                                                     letterSpacing: -0.15 },

  // Toolbar composer
  composerPrompt:{ fontSize: 17,   fontWeight: '400' as const, lineHeight: 24,      letterSpacing: -0.34 },

  // Generic body — when nothing more specific applies
  body:          { fontSize: 17,   fontWeight: '400' as const, lineHeight: 24,      letterSpacing: -0.34 },
} as const;

// Export type helpers
export type IOSColor = keyof typeof IOS_COLORS;
export type IOSTypographyStyle = keyof typeof IOS_TYPOGRAPHY;
export type IOSSpacing = keyof typeof IOS_SPACING;
export type IOSRadius = keyof typeof IOS_RADIUS;
export type IOSShadow = keyof typeof IOS_SHADOWS;
export type IOSRegisterColor = keyof typeof IOS_REGISTER;
export type IOSRegisterText = keyof typeof IOS_REGISTER_TEXT;

/**
 * Helper function to get colors based on color scheme
 * For use outside of React components (e.g., in StyleSheet.create)
 */
export function getIOSColors(colorScheme: 'light' | 'dark' | null | undefined) {
  return colorScheme === 'dark' ? IOS_COLORS_DARK : IOS_COLORS;
}
