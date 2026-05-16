/**
 * SeriesStrip — canonical Frame 1 of the Series feature.
 *
 * White card slotted between the interest header and the zoomed-out timeline.
 * Shows the per-interest Series label as an uppercased eyebrow, the active
 * Series name, a "{currentIndex} of {totalSteps} steps" counter, an iOS-blue
 * progress bar, and a downward chevron. The whole row is one tap target.
 *
 * Phase I Commit 1 ships this as a typed shell that returns null so the
 * import paths and prop contract land in main without affecting any render
 * path. Commit 2 wires the real layout per
 * docs/redesign/ios-register/series-feature-canonical.html Frame 1.
 */

export interface SeriesStripProps {
  /** Per-interest singular label (Season / Term / Workshop / Block / Series). */
  label: string;
  /** Active Series name (e.g. "Winter 2025–2026"). */
  name: string;
  /** 1-based current step index. */
  currentIndex: number;
  /** Total step count across the active Series. */
  totalSteps: number;
  /** Progress fraction in [0, 1], typically currentIndex / totalSteps. */
  progress: number;
  /** Optional date range (e.g. "Nov 1, 2025 – May 31, 2026"). */
  dateRange?: string;
  /** Tap handler for opening the switch-Series sheet (Frame 2). */
  onPress: () => void;
}

export function SeriesStrip(_props: SeriesStripProps) {
  return null;
}
