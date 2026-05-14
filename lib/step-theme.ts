/**
 * Step Detail Theme — warm cream/green palette matching the Pencil design.
 * Used exclusively by the Step detail screens (Plan/Act/Review tabs).
 */

export const STEP_COLORS = {
  // Backgrounds
  pageBg: '#F5F4F1',         // warm cream
  cardBg: '#FFFFFF',
  headerBg: '#FFFFFF',

  // Accent
  accent: '#3D8A5A',         // forest green
  accentLight: 'rgba(61,138,90,0.10)',
  accentMedium: 'rgba(61,138,90,0.18)',

  // Secondary accent
  coral: '#D89575',
  coralLight: 'rgba(216,149,117,0.12)',

  // Text
  label: '#1A1A1A',
  secondaryLabel: '#6B6B6B',
  tertiaryLabel: '#9E9E9E',
  onAccent: '#FFFFFF',

  // Borders & separators
  border: '#E8E6E1',
  cardBorder: '#ECEAE5',

  // Status
  complete: '#3D8A5A',
  completeLight: 'rgba(61,138,90,0.10)',
  pending: '#9E9E9E',

  // Tab control
  tabSelectedBg: '#3D8A5A',
  tabSelectedText: '#FFFFFF',
  tabUnselectedBg: 'transparent',
  tabUnselectedText: '#6B6B6B',
  tabBorder: '#D4D1CC',

  // Session badge
  badgeBg: 'rgba(61,138,90,0.10)',
  badgeText: '#3D8A5A',
} as const;

/**
 * STEP_PALETTE values — iOS register (canonical from 2026-05-15).
 *
 * The editorial register's warm cream + charcoal values were superseded
 * when the iOS register became canonical (per docs/redesign/
 * IOS_MIGRATION_PLAN.md, "Resolved architecture decisions"). Rather than
 * migrate 40 consumer files individually, the values themselves shift:
 * every component reading STEP_PALETTE.bgPrimary now sees system gray 6,
 * STEP_PALETTE.textPrimary now sees iOS black label, etc.
 *
 * KEEPING the STEP_PALETTE name (not renaming to IOS_REGISTER) avoids
 * touching consumer files; the editorial-era variable names persist as
 * stable identifiers with new values underneath. New components should
 * reference IOS_REGISTER directly from @/lib/design-tokens-ios.
 *
 * For surfaces that still need an editorial-warm value (rare —
 * marketing/landing pages may legitimately use cream), use the
 * literals directly rather than reintroducing the editorial mapping.
 *
 * The "Two accents, two jobs" rule still applies: blue = user action /
 * active state; coral = AI question / marked content. STEP_PALETTE
 * values map to the neutral chrome part of the iOS register; the
 * accents live on IOS_REGISTER.
 */
export const STEP_PALETTE = {
  // Backgrounds — gray-6 ground + white cards (was cream + warm cream)
  bgPrimary: '#F2F2F7',                 // system gray 6 — page ground
  bgSecondary: '#FFFFFF',                // white card surface
  bgInfo: 'rgba(255, 107, 107, 0.10)',  // coral tint — AI prompt fill (was lavender)

  // Text — black + iOS opacity labels (was warm charcoal)
  textPrimary: '#000000',                // iOS label
  textSecondary: 'rgba(60, 60, 67, 0.62)',
  textTertiary: 'rgba(60, 60, 67, 0.32)',
  textInfo: '#FF6B6B',                   // coral (was violet)

  // Borders — iOS separator opacities (was warm grays)
  borderSecondary: 'rgba(60, 60, 67, 0.20)',
  borderTertiary: 'rgba(60, 60, 67, 0.20)',

  // CTA — iOS blue replaces charcoal-on-cream
  ctaBg: '#007AFF',                       // iOS blue
  ctaText: '#FFFFFF',
} as const;
