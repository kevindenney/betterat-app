/**
 * BetterAt Editorial Type Register
 *
 * Serif "first-person voice" + sans chrome recipes, extracted verbatim from the
 * retired `lib/design-tokens.ts` (2026-06-01). Kept deliberately SEPARATE from
 * `design-tokens-ios.ts`, whose register is "SF Pro throughout — no serif." These
 * recipes are the editorial register (redesign spec §11) and are still consumed by
 * the first-person reflection surfaces (step detail, capture timeline, observation
 * log, review prompts, plan questions, race summary).
 *
 * Design decision (2026-06-01): the serif voice is KEPT, permanently, scoped
 * narrowly to first-person reflection content. The editorial register was
 * superseded for chrome/UI, but "this is you thinking" is a different job than
 * "this is the app's interface" — a distinct, warmer typographic voice earns its
 * keep on reflection surfaces and is deliberately preserved here. This file is its
 * permanent home, NOT a waystation to deletion. See
 * docs/redesign/TOKEN_CONSOLIDATION_PLAN.md §2.
 */

import { Platform } from 'react-native';

/**
 * Redesign typography (2026-05) — serif for first-person voice, sans for chrome.
 * See docs/redesign/betterat-redesign-spec.md §11.
 *
 * Font loading status:
 *   - sans 'Manrope' is loaded in app/_layout.tsx via @expo-google-fonts/manrope
 *   - serif fallbacks rely on platform-bundled faces today
 *     (iOS: 'Iowan Old Style' bundled; Android: 'serif' resolves to Noto Serif;
 *      web: 'Iowan Old Style, Georgia, serif').
 *   - A bundled Source Serif 4 install is planned for the step-detail serif
 *     migration commit; until then these tokens render via fallbacks.
 */
export const fontFamily = {
  serif: Platform.select({
    ios: 'Iowan Old Style',
    android: 'serif',
    web: '"Iowan Old Style", Georgia, "Times New Roman", serif',
    default: 'serif',
  }) as string,
  sans: Platform.select({
    ios: 'Manrope_400Regular',
    android: 'Manrope_400Regular',
    web: 'Manrope_400Regular, -apple-system, BlinkMacSystemFont, "Inter", sans-serif',
    default: 'Manrope_400Regular',
  }) as string,
} as const;

/**
 * Typed text recipes that combine family + size + weight + tracking.
 * Use these instead of inlining `fontFamily`/`fontSize`/`fontWeight` ad-hoc.
 */
export const text = {
  serifTitle: {
    fontFamily: fontFamily.serif,
    fontSize: 28,
    fontWeight: '500' as const,
    letterSpacing: -0.3,
    lineHeight: 34,
  },
  serifSubtitle: {
    fontFamily: fontFamily.serif,
    fontSize: 22,
    fontWeight: '500' as const,
    letterSpacing: -0.2,
    lineHeight: 28,
  },
  serifBody: {
    fontFamily: fontFamily.serif,
    fontSize: 19,
    fontWeight: '400' as const,
    lineHeight: 29, // ~1.55
  },
  serifMeta: {
    fontFamily: fontFamily.serif,
    fontSize: 15,
    fontWeight: '400' as const,
    fontStyle: 'italic' as const,
    lineHeight: 22,
  },
  sansEyebrow: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    fontWeight: '500' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  sansLabel: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  sansMeta: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    fontWeight: '400' as const,
  },
  sansBody: {
    fontFamily: fontFamily.sans,
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
} as const;
