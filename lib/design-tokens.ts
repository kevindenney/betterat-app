/**
 * RegattaFlow Design System
 * Ocean Blue Theme for Sailing Applications
 *
 * See also: design-tokens-ios.ts for Apple HIG compliant tokens
 */

import { Platform } from 'react-native';

// Re-export iOS tokens for easy access
export * from './design-tokens-ios';

export const colors = {
  // Primary - Ocean Blue
  primary: '#2563EB',
  primaryLight: '#3b82f6',
  primaryDark: '#1d4ed8',

  // Accent - Bright Blue
  accent: '#3b82f6',

  // Success - Green
  success: '#10b981',
  successLight: '#34d399',
  successDark: '#059669',

  // Warning - Amber
  warning: '#f59e0b',
  warningLight: '#fbbf24',
  warningDark: '#d97706',

  // Danger - Red
  danger: '#ef4444',
  dangerLight: '#f87171',
  dangerDark: '#dc2626',

  // Neutral
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',

  // White & Black
  white: '#ffffff',
  black: '#000000',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;

export const typography = {
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

/**
 * Redesign typography (2026-05) — serif for first-person voice,
 * sans for chrome. See docs/redesign/betterat-redesign-spec.md §11.
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

/**
 * Sailing-specific terminology and constants
 */
export const sailingTerms = {
  wind: {
    light: '0-10kt',
    moderate: '11-20kt',
    fresh: '21-30kt',
    strong: '31kt+',
  },
  directions: {
    n: 'North',
    ne: 'Northeast',
    e: 'East',
    se: 'Southeast',
    s: 'South',
    sw: 'Southwest',
    w: 'West',
    nw: 'Northwest',
  },
} as const;

/**
 * Minimum touch target size for mobile (44x44 points)
 */
export const touchTarget = {
  minHeight: 44,
  minWidth: 44,
} as const;

/**
 * Tufte-inspired Design Tokens
 *
 * Following Edward Tufte's principles:
 * - Maximize data-ink ratio
 * - Remove chartjunk (unnecessary visual elements)
 * - Every pixel of ink should convey unique information
 */
export const tufte = {
  // Typography: smaller, tighter, data-focused
  text: {
    data: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: colors.gray900,
    },
    label: {
      fontSize: 12,
      fontWeight: '400' as const,
      color: colors.gray500,
    },
    muted: {
      fontSize: 12,
      fontWeight: '400' as const,
      color: colors.gray400,
    },
    fraction: {
      fontSize: 14,
      fontWeight: '500' as const,
      color: colors.gray600,
    },
    raceName: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.gray900,
      lineHeight: 22,
    },
    raceNumber: {
      fontSize: 13,
      fontWeight: '400' as const,
      color: colors.gray400,
    },
    temporal: {
      fontSize: 13,
      fontWeight: '500' as const,
      color: colors.gray600,
    },
    phaseName: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: colors.gray500,
    },
    progressCount: {
      fontSize: 12,
      fontWeight: '500' as const,
      color: colors.gray600,
    },
  },
  // Spacing: minimal, tight
  spacing: {
    inline: 4,   // gap-1
    block: 8,    // gap-2
    section: 12, // gap-3
  },
  // Progress bar: minimal visual chrome
  progress: {
    track: {
      height: 4,
      backgroundColor: colors.gray200,
      borderRadius: 2,
    },
    fill: {
      height: 4,
      backgroundColor: colors.gray600,
      borderRadius: 2,
    },
  },
} as const;
