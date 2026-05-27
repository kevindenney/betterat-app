/**
 * Wind speed → color band, tuned to a sailor's read of conditions rather
 * than the textbook Beaufort scale. Bands map to what the wind *means*
 * for sail choice rather than to wave-state thresholds:
 *
 *   0–3 kn   slate     — drifter, barely sailing
 *   4–7 kn   teal      — light, full sail, light-air technique
 *   8–12 kn  green     — sweet spot, full power
 *   13–18 kn amber     — brisk, depower / flatten
 *   19–24 kn orange    — strong, reef territory
 *   25+ kn   red       — heavy, small-craft advisory
 *
 * Returned as rgba strings so the caller can pick alpha for context
 * (field arrows soft, primary arrows opaque).
 */
export function windColorForKnots(knots: number, alpha = 0.95): string {
  const a = Math.max(0, Math.min(1, alpha));
  if (knots < 4) return `rgba(132, 145, 158, ${a})`; // slate
  if (knots < 8) return `rgba(60, 160, 175, ${a})`; // teal
  if (knots < 13) return `rgba(46, 167, 102, ${a})`; // green
  if (knots < 19) return `rgba(230, 174, 60, ${a})`; // amber
  if (knots < 25) return `rgba(232, 130, 56, ${a})`; // orange
  return `rgba(212, 70, 70, ${a})`; // red
}
