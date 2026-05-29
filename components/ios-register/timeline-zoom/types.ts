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
  2: 'NEAR',
  3: 'ARC',
  4: 'ALL',
};

export const ZOOM_LEVEL_SCOPE_LABELS: Record<ZoomLevel, string> = {
  1: 'One step',
  2: 'Nearby',
  3: 'Current arc',
  4: 'All time',
};

export type StepStatus = 'plan' | 'do' | 'reflect' | 'reflected' | 'done';
export type StepOriginKind = 'mine' | 'shared' | 'blueprint';

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
  /** Full display name when known — fed forward into the LifetimePeer
   *  constancy readout on L4 ("Markus has crewed 18 steps across 4
   *  arcs"). Optional because some peer sources (blueprint authors
   *  surfaced as bp:foo) only carry initials. */
  name?: string;
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
  /** Near-zoom ownership/source treatment: own step, shared collaborator step, or adopted blueprint step. */
  originKind?: StepOriginKind;
  /** L1-only — the Plan body. */
  whatBody?: string;
  whyReasoning?: string;
  whenLabel?: string;
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
  /** L1 session strap — "SUB-STEP 3 OF 5 · NEXT UP". current is the
      1-based position within the sub-step list. Optional because not
      every step is part of a multi-step session. */
  subStep?: { current: number; total: number; label?: string };
  /** L1 peer pre-title block — italic-serif quote rendered above the
      title in Screen 07. From an org-mate / coach / cohort peer who
      reacted to the prior step ("MIHKEL THIS MORNING / You released
      the kicker earlier than I would have…"). */
  peerQuote?: {
    author: string;
    when: string;     // "THIS MORNING" / "YESTERDAY"
    body: string;     // The quote itself, no surrounding quote marks.
    avatarInitials?: string;
    avatarColor?: string;
  };
}

export interface TimelineWeek {
  id: string;
  number: number;             // 1, 6, 7…
  dateRange: string;          // "May 13 — 19"
  isCurrent?: boolean;
  steps: TimelineStep[];
  /** L2 "season's shape" context strip — short italic-serif sentence
      printed above the week title in Screen 08, e.g. "Spring '26 has
      been tactics-heavy." Lets the user plan with awareness of what's
      already accumulated. */
  contextStrip?: string;
  /** L2 lilac librarian planning hint — same prompt type as L3/L4
      but with planning-intent CTAs (e.g. "Accept Mihkel's suggestion"). */
  planningHint?: SeasonLibrarianPrompt;
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
  bricks: {
    capabilityColor: string;
    /** Display label for the brick's capability/category in the persona's
     *  own vocabulary (e.g. "Race", "Cardiac", "Production"). Carried
     *  through so L4 can read it directly instead of reverse-mapping
     *  from colour through the nursing-coded palette. Null when the
     *  category is generic ("general", "uncategorized") — we don't want
     *  those bleeding into the librarian's "drift" sentence. */
    capabilityLabel?: string | null;
    /** Step title carried through so L4's per-chapter summary can run
     *  the persona's phase-pattern detection on the actual step text
     *  ("Race 4 start drill" → Starts) rather than reading the often-
     *  generic category. */
    title?: string | null;
    stepId?: string;
    /** Lifecycle state — drives the L4 done-check overlay + planned dimming. */
    status?: StepStatus;
    /** True when others (cohort / crew / invited) were on this step. Renders
     *  a soft outline on the L4 brick so the "I did this with people" beats
     *  show up at a glance across the whole timeline. */
    withOthers?: boolean;
  }[];
  /**
   * L3 analysis layer (Screen 09 · REFLECTING ON NOW). The capability
   * river chart + peer journey chart + inline reflections + librarian
   * prompt that turn L3 from a smaller-L2 list into the verb=reflecting
   * surface the canonical asks for. Optional — when absent, L3 falls
   * back to a degraded "compact section list" mode.
   */
  analysis?: SeasonAnalysis;
  /** Free-text vision for the arc. Null when not yet set. */
  visionStatement?: string | null;
  /** Optional org_competencies(id) anchors that drive per-competency
   *  progress bars on the VISION lane. */
  visionCompetencyIds?: string[];
  /** Proven evidence count keyed by org_competencies.id, across all
   *  steps in this season. Empty object when no evidence has been
   *  tagged to a framework competency. */
  visionEvidenceByCompetency?: Record<string, number>;
  /** Weekly proven-evidence trend keyed by org_competencies.id. Each
   *  value is an array of length = season bucket count (matches L4),
   *  carrying the per-week evidence count. Drives the VISION lane's
   *  per-competency sparkline. */
  visionEvidenceTrendByCompetency?: Record<string, number[]>;
  /** Aggregate weekly proven-evidence count across every current-season
   *  step, regardless of competency tagging. Length = season bucket
   *  count. Drives the sparkline on the no-anchor path of the VISION
   *  lane and the "+N this week" footer in both paths. */
  visionEvidenceTrend?: number[];
  /** The viewer's active plan id for this interest, when one exists.
   *  Drives the VISION edit write path on L3 — vision updates land
   *  on this plan (or create one when null). */
  activePlanId?: string | null;
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
  /**
   * Named segments of the season — what each colored stretch of the
   * river *means*, written in domain vernacular. The chart renders
   * these labels directly under the river so the user doesn't need a
   * legend to decode colors (e.g. "Race 1–2", "Light-air", "finale"
   * for sailing; "Orientation", "ICU block" for nursing).
   *
   * Each phase spans an inclusive week range and carries the color
   * used for that stretch of the river when shapeMode='flow'. When
   * phases are omitted, the chart falls back to the legacy "wk N"
   * tick labels.
   */
  phases?: SeasonPhase[];
  /** Peer crew who appeared this season + when. Drives the peer chart. */
  peers: SeasonPeer[];
  /** Inline italic-serif reflection quotes pinned to specific weeks. */
  reflections: SeasonReflection[];
  /** Per-week reflection count for the REFLECTIONS sparkline. Drives
   *  one bar per week on the same x-axis as the capability bands —
   *  sparse weeks become a visible nudge ("you didn't reflect in wk 3").
   *  Currently sourced from peer_reflections; could fold in own reviews
   *  later. */
  reflectionDensity?: { weekNumber: number; count: number }[];
  /** Trophy / milestone markers floated above the river. */
  markers?: SeasonMarker[];
  /** Mid-season lilac prompt at the bottom of L3. */
  librarianPrompt?: SeasonLibrarianPrompt;
}

/**
 * A named stretch of the season — the unit the river chart labels
 * directly under itself. Phases are how the user decodes "what does
 * this color mean" without a separate legend.
 */
export interface SeasonPhase {
  id: string;
  /** Domain-vernacular label — "Race 1–2", "Light-air", "Orientation". */
  label: string;
  /** Inclusive 1-based week range. */
  startWeek: number;
  endWeek: number;
  /** Color used for this stretch of the river in flow mode. */
  color: string;
}

/**
 * Trophy / milestone marker pinned to a specific week of the season.
 * Mirrors RiverChartMarker but lives in the data layer so the adapter
 * + sample data can author them without depending on the chart module.
 */
export interface SeasonMarker {
  id: string;
  weekNumber: number;
  kind: 'trophy';
  label: string;
  capabilityColor?: string;
}

export interface WeeklyCapabilityMix {
  weekNumber: number;          // 1, 2, …, weekOfTotal.total
  /**
   * Each band stacks on the previous in render order. capabilityId
   * groups same-capability bands across weeks into a single stream;
   * capabilityLabel is the in-band text the chart writes at the
   * widest point.
   *
   * `volume` is the legacy combined count (kept for back-compat); the
   * chart prefers `plannedVolume` (capability_goals from Plan tab)
   * and `provenVolume` (step_capability_evidence rows from Reflect
   * tab) when present so it can render planned-as-ghost-outline and
   * proven-as-solid-fill in the same band.
   */
  bands: {
    capabilityId?: string;
    capabilityLabel?: string;
    capabilityColor: string;
    volume: number;
    plannedVolume?: number;
    provenVolume?: number;
  }[];
}

export interface SeasonPeer {
  id: string;
  initials: string;
  /** Display name when known — surfaced in sparse-list mode and in
   *  hover/tap detail on the chart. Initials alone aren't enough to
   *  identify a peer ("D" could be Diane / David / Demo). */
  name?: string;
  /** Avatar bubble color (identity — stable per peer regardless of
   *  what they shaped). Used as the fallback when capabilityColor is
   *  not known. */
  color: string;
  /** Color of the dominant capability this peer touched across their
   *  contributions in this arc. When set, the chart prefers this so
   *  the eye can read "this person shaped Tactics" / "Sails" / etc.
   *  Falls back to `color` (identity) when no in-scope capability is
   *  known (free-form suggestions, untagged steps). */
  capabilityColor?: string;
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
  /** Lead sentence(s) of italic-serif prose. */
  body: string;
  /** Optional emphasized planning move shown as its own line. */
  emphasisLine?: string;
  /** Optional supporting context / provenance line under the emphasis. */
  supportingLine?: string;
  /** Primary CTA (lilac filled). */
  primaryCta: {
    label: string;
    intent:
      | 'open-season-check-in'
      | 'start-reflection'
      | 'accept-suggestion'
      | 'add-step'
      | 'open-suggestion-inbox';
  };
  /** Optional secondary CTA (ghost). */
  secondaryCta?: { label: string };
}

export interface TimelineInterest {
  id: string;                 // uuid
  label: string;              // 'Nursing'
  /** URL/canonical slug — e.g. 'nursing', 'sail-racing'. Used to
   *  scope per-interest queries (org competencies, etc.). */
  slug?: string | null;
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
  /** Raw ISO timestamp of the earliest known step/season — drives the
      L4 duration subtitle ("2 years", "8 months"). Optional because
      sparse / brand-new accounts won't have any historical anchor. */
  sinceTimestamp?: string;
  /** L4 lifetime banner — separate from the season vision that anchors
   *  L3 so the two surfaces can carry honest, distinct statements. */
  lifetimeVisionStatement?: string | null;
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
  /** Persona-vernacular capability label for this session ("Tactics",
   *  "Patient communication", "Diwali rush"). Optional — falls back to
   *  capability-color when missing. Drives the L4 trajectory arrow
   *  ("Started Spring '24 with Tactics → now in Race execution") so
   *  the surface can name the change in words, not just colors. */
  dominantCapabilityLabel?: string | null;
  /** Total step count this session — scales the band height. */
  volume: number;
  /** True for race/showcase sessions (canonical's "race vs prep rhythm"). */
  isRace?: boolean;
}

export interface LifetimePeer {
  id: string;
  initials: string;
  color: string;
  /** Full name when available — drives the constancy list readout
   *  ("Markus · crew · 18 steps · 4 arcs"). Falls back to initials when
   *  null. */
  name?: string;
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
