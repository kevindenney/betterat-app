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
 * Redesign palette (2026-05) — neutral warm cream + charcoal, no chromatic
 * accents on step surfaces. See docs/redesign/betterat-redesign-spec.md §11.6
 * and docs/audit/visual-redesign-gap-step-detail.md §2.4.
 *
 * Migration path: once every step surface reads from STEP_PALETTE, the legacy
 * STEP_COLORS green/coral keys can be removed in a follow-up sweep.
 */
export const STEP_PALETTE = {
  // Backgrounds
  bgPrimary: '#FAFAF7',       // page + card surfaces
  bgSecondary: '#F0EEE8',     // panel bg, preceptor-note cards
  bgInfo: '#E5E1F0',          // "You" avatar / "from playbook" tile

  // Text
  textPrimary: '#2A2824',     // titles, primary body, dark CTA bg
  textSecondary: '#58544A',   // sub-meta, status
  textTertiary: '#8A8478',    // eyebrows, timestamps
  textInfo: '#5A4078',        // "You" avatar text, playbook accent

  // Borders
  borderSecondary: '#C8C2B4', // outlined buttons, secondary outlines
  borderTertiary: '#DDD8CA',  // hairlines, dividers

  // CTA (primary action = dark text-primary on bg-primary)
  ctaBg: '#2A2824',
  ctaText: '#FAFAF7',
} as const;
