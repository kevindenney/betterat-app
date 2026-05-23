/**
 * Timeline Zoom — shared types for the four-depth zoomable canvas.
 *
 * The user owns the timeline; the data shape is the same at every depth.
 * L1 reads the full step card; L2/L3 read a digest; L4 reads just the
 * capability tint as a brick.
 *
 * Per the May 2026 Timeline Zoom & Admin handoff (Sections A–H).
 */

export type ZoomLevel = 1 | 2 | 3 | 4;

export const ZOOM_LEVEL_LABELS: Record<ZoomLevel, string> = {
  1: 'STEP',
  2: 'WEEK',
  3: 'SEASON',
  4: 'YEARS',
};

export type StepStatus = 'plan' | 'do' | 'reflect' | 'reflected' | 'done';

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface Capability {
  id: string;
  label: string;
  /** Hex color used both for chip tint and the L4 brick fill. */
  color: string;
}

export interface CohortAvatar {
  id: string;
  initials: string;
  /** Background color for the avatar bubble. */
  color: string;
}

export interface BlueprintProvenance {
  source: string;            // "Adult Health I · Module 4"
  suggestedBy?: string;      // "Dr. K. Murphy"
}

export interface StepHowItem {
  label: string;
  checked: boolean;
}

export interface TimelineStep {
  id: string;
  /** "HF handoff in 4-South" */
  title: string;
  /** "TODAY · 7AM PRE-SHIFT" / "MON · CLINICAL" — eyebrow above the title. */
  preTitle?: string;
  /** Where in the week and season this lives. */
  dayOfWeek: DayKey;
  weekId: string;
  seasonId: string;
  status: StepStatus;
  /** L1-only — the Plan body. */
  whatBody?: string;
  howItems?: StepHowItem[];
  capabilities?: Capability[];
  from?: BlueprintProvenance;
  /** Per-step Discuss tab unread count (Frame 21). */
  discussCount?: number;
  /** Other people running this same step (L1 used-by stack). */
  cohortAvatars?: CohortAvatar[];
  cohortLabel?: string;       // e.g. "2 cohort"
  /** Header metadata row in L1 — "Wed · JHH Bloomberg 4S" / "Preceptor: A. Ngo, RN" */
  metaLeft?: string;
  metaRight?: string;
}

export interface TimelineWeek {
  id: string;
  number: number;             // 1, 6, 7…
  dateRange: string;          // "May 13 — 19"
  isCurrent?: boolean;
  steps: TimelineStep[];
}

export interface TimelineSeason {
  id: string;
  title: string;              // "Spring '26 clinical"
  /** Org chip — "JH · Johns Hopkins · MSN". */
  orgChip?: {
    monogram: string;
    label: string;
  };
  dateRange: string;          // "Jan 14 — May 8"
  weekOfTotal?: { current: number; total: number }; // "Week 7 of 14"
  archived?: boolean;
  weeks: TimelineWeek[];
  /**
   * L4 brick lane — one entry per step in chronological order. `stepId`
   * lets a brick tap navigate to the right step at L1 and lets Section
   * D's drag-reorder identify which step was lifted. Optional because
   * archived-season lanes (where we don't have per-step data yet) emit
   * placeholder bricks.
   */
  bricks: { capabilityColor: string; stepId?: string }[];
}

export interface TimelineInterest {
  id: string;                 // 'nursing'
  label: string;              // 'Nursing'
}

export interface TimelineDataset {
  interest: TimelineInterest;
  /** Right-side avatar (current user). */
  user: { initials: string; color: string };
  /** Step ID that the L1 view focuses on by default. */
  focusStepId: string;
  /** Season ID containing the focused step. */
  currentSeasonId: string;
  /** Used in L1 header — "Step 27 of 41". */
  stepCounter?: { current: number; total: number };
  /** Used in L2 header — "Week 7 of 14". */
  weekCounter?: { current: number; total: number };
  /** Newest first; archived seasons appear after the current one. */
  seasons: TimelineSeason[];
  /** L4 header — "5 seasons · 142 steps · since Sep '24". */
  totalSeasons: number;
  totalSteps: number;
  sinceDate: string;
  /** L4 capability filter chips. Always begins with "All". */
  capabilityFilters: { id: string; label: string; icon?: string; color?: string }[];
}
