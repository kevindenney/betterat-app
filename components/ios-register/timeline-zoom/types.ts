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
  /** True when this step lives in a different interest and was
      cross-interest-pinned into the current view via timeline_step_pins. */
  pinnedFromOtherInterest?: boolean;
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
  /**
   * L3 analysis layer (Screen 09 · REFLECTING ON NOW). The capability
   * river chart + peer journey chart + inline reflections + librarian
   * prompt that turn L3 from a smaller-L2 list into the verb=reflecting
   * surface the canonical asks for. Optional — when absent, L3 falls
   * back to a degraded "compact section list" mode.
   */
  analysis?: SeasonAnalysis;
}

export interface SeasonAnalysis {
  /**
   * Per-week capability mix across the full season span. One entry per
   * week from week 1 → weekOfTotal.total. Each entry stacks the volume
   * by capability so the chart can render a stacked-area "river".
   *
   * Computed from real data by realDataAdapter; hand-authored in
   * sampleData.
   */
  weeklyCapabilities: WeeklyCapabilityMix[];
  /** Peer crew who appeared this season + when. Drives the peer chart. */
  peers: SeasonPeer[];
  /** Inline italic-serif reflection quotes pinned to specific weeks. */
  reflections: SeasonReflection[];
  /** Mid-season lilac prompt at the bottom of L3. */
  librarianPrompt?: SeasonLibrarianPrompt;
}

export interface WeeklyCapabilityMix {
  weekNumber: number;          // 1, 2, …, weekOfTotal.total
  /** Each band stacks on the previous in render order. */
  bands: { capabilityColor: string; volume: number }[];
}

export interface SeasonPeer {
  id: string;
  initials: string;
  /** Avatar bubble color. */
  color: string;
  /** "coach", "bow crew", "observer" — small italic role line. */
  role?: string;
  /** Week the peer first appeared in this season. */
  firstWeek: number;
  /** Per-week activity count for this peer — drives line thickness/dots. */
  weeklyAppearances: { weekNumber: number; count: number }[];
}

export interface SeasonReflection {
  id: string;
  weekNumber: number;
  /** Short italic-serif quote — "good speed off line". */
  quote: string;
  /** Capability color the reflection ties to (drives chip + caret tint). */
  capabilityColor?: string;
}

export interface SeasonLibrarianPrompt {
  /** Small eyebrow above the body — defaults to "THE LIBRARIAN NOTICED". */
  eyebrow?: string;
  /** Sentence(s) of italic-serif prose. */
  body: string;
  /** Primary CTA (lilac filled). */
  primaryCta: { label: string; intent: 'open-season-check-in' | 'start-reflection' };
  /** Optional secondary CTA (ghost). */
  secondaryCta?: { label: string };
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
  /**
   * L4 analysis layer (Screen 10 · REFLECTING ON A LIFE). Lifetime
   * capability river spanning every session + lifetime peer chart +
   * trophies + librarian "worth a reflection?" prompt. Optional —
   * when absent L4 falls back to just the season-lane brick view.
   */
  lifetime?: LifetimeAnalysis;
}

export interface LifetimeAnalysis {
  /** One entry per session/season, oldest to newest. Drives the lifetime
      capability river (one column per session). */
  sessions: LifetimeSession[];
  /** Peers who appeared anywhere across the lifetime, with their arrival
      session + per-session activity counts. */
  peers: LifetimePeer[];
  /** Inline italic-serif reflection quotes pinned to specific sessions. */
  reflections: LifetimeReflection[];
  /** Trophy markers floated above the river at the session they were earned. */
  trophies: LifetimeTrophy[];
  /** Bottom lilac card — usually intent='start-reflection' for L4. */
  librarianPrompt?: SeasonLibrarianPrompt;
}

export interface LifetimeSession {
  /** 1-based index, ordered chronologically. */
  sessionIndex: number;
  /** Pointer back to the TimelineSeason — lets a marker tap navigate to
      the corresponding lane. Optional because synthesized sessions
      (e.g. "future" stub) don't have a backing season. */
  seasonId?: string;
  /** Short label shown under the river ("Fall '24", "Spring '25"). */
  label: string;
  /** The capability that defines this session's color band. */
  dominantCapabilityColor: string;
  /** Total step count this session — scales the band height. */
  volume: number;
  /** True for race/showcase sessions (canonical's "race vs prep rhythm"). */
  isRace?: boolean;
}

export interface LifetimePeer {
  id: string;
  initials: string;
  color: string;
  /** Italic role line — "coach", "bow crew", "faculty". */
  role?: string;
  /** Session this peer first appeared in. */
  firstSessionIndex: number;
  /** Per-session activity count — drives line thickness/dots. */
  sessionAppearances: { sessionIndex: number; count: number }[];
}

export interface LifetimeReflection {
  id: string;
  sessionIndex: number;
  quote: string;
  capabilityColor?: string;
}

export interface LifetimeTrophy {
  id: string;
  sessionIndex: number;
  /** Short label below the trophy glyph ("HKDW '26", "FFG win"). */
  label: string;
  /** Capability color the win is attributed to (tints the glyph stroke). */
  capabilityColor?: string;
}
