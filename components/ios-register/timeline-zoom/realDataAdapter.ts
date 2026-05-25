/**
 * Real-data adapter — maps the live timeline-step + season schema into the
 * TimelineDataset shape the zoom canvas expects.
 *
 * v2 mapping (2026-05-22):
 *   • Rotation-relative week bucketing (3 per bucket, sort_order ordered).
 *   • status → StepStatus.
 *   • metadata.plan.how_sub_steps → L1 how-checklist.
 *   • metadata.plan.collaborators → cohort avatars + meta-row preceptor/coach
 *     callout. Free-text `role` matched against /preceptor|coach|mentor/i.
 *   • metadata.plan.where_location.name → meta-row left ("Wed · JHH Bloomberg").
 *   • Time-of-day modifier derived from starts_at hour:
 *       4–8  → PRE-SHIFT,    8–12 → AM SHIFT,
 *       12–17 → AFTERNOON,   17–21 → EVENING,
 *       21–4 → NIGHT.
 *   • source_blueprint_id → blueprint title (looked up in the
 *     `blueprintsById` map passed in by the screen wrapper).
 *
 * Still deferred to follow-ups: multi-capability tagging (schema gap),
 * blueprint author "suggested by" name (needs per-step author query),
 * archived season real brick counts (needs RPC).
 */

import type { StepPlanData, StepCollaborator } from '@/types/step-detail';
import type { Season } from '@/types/season';
import type { TimelineStepRecord, TimelineStepStatus } from '@/types/timeline-steps';
import { CAPABILITY_PALETTE } from './sampleData';
import type {
  CohortAvatar,
  DayKey,
  LifetimeAnalysis,
  LifetimePeer,
  LifetimeSession,
  SeasonAnalysis,
  SeasonPeer,
  StepHowItem,
  StepStatus,
  TimelineDataset,
  TimelineSeason,
  TimelineStep,
  TimelineWeek,
  WeeklyCapabilityMix,
} from './types';

export interface BlueprintLookup {
  title: string;
  author_name?: string;
}

const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const STATUS_MAP: Record<TimelineStepStatus, StepStatus> = {
  pending: 'plan',
  in_progress: 'do',
  completed: 'done',
  settled: 'reflected',
  skipped: 'done',
};

// Stable color palette — first chip uses purple (cardio), then cycles. The
// design's coral-system semantics aren't yet on the database side so we cycle
// a category → color map keyed by category string.
const CAPABILITY_COLORS = [
  CAPABILITY_PALETTE.cardio.color,
  CAPABILITY_PALETTE.assess.color,
  CAPABILITY_PALETTE.pharm.color,
  CAPABILITY_PALETTE.comm.color,
  CAPABILITY_PALETTE.sbar.color,
  CAPABILITY_PALETTE.procedural.color,
];

function hashCategoryToColor(category: string): string {
  if (!category) return CAPABILITY_COLORS[0];
  let h = 0;
  for (let i = 0; i < category.length; i++) {
    h = ((h << 5) - h + category.charCodeAt(i)) | 0;
  }
  return CAPABILITY_COLORS[Math.abs(h) % CAPABILITY_COLORS.length];
}

function dayKeyFromIso(iso: string | null): DayKey {
  if (!iso) return 'wed';
  const d = new Date(iso);
  // Date.getDay: 0=Sun..6=Sat → DAY_KEYS index needs 0=Mon..6=Sun
  const idx = (d.getDay() + 6) % 7;
  return DAY_KEYS[idx];
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(s)} — ${fmt(e)}`;
}

/**
 * Bucket steps into rotation-relative "weeks" — always 3 per bucket, ordered
 * by sort_order. Numbering is 1-indexed (Week 1, Week 2, …) regardless of
 * the calendar week the step actually falls in. This matches the design's
 * "Week 7 of 14" framing where the count is a position within the rotation,
 * not a calendar coordinate.
 *
 * The bucket key is just the bucket index, so steps with no starts_at still
 * cluster cleanly.
 */
function weekKeyOf(fallbackIndex: number): string {
  return `wk-${Math.floor(fallbackIndex / 3)}`;
}

function weekRangeLabel(
  bucketSteps: { starts_at: string | null }[],
  bucketIndex: number,
): { range: string; number: number } {
  const dated = bucketSteps.filter((s) => s.starts_at);
  if (dated.length === 0) {
    return {
      range: `Steps ${bucketIndex * 3 + 1}–${bucketIndex * 3 + Math.min(3, bucketSteps.length)}`,
      number: bucketIndex + 1,
    };
  }
  const sorted = [...dated].sort(
    (a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!),
  );
  const start = new Date(sorted[0].starts_at!);
  const end = new Date(sorted[sorted.length - 1].starts_at!);
  return {
    range: formatDateRange(start.toISOString(), end.toISOString()),
    number: bucketIndex + 1,
  };
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

const DAY_LABEL: Record<DayKey, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu',
  fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

function timeOfDayModifier(iso: string | null): string | null {
  if (!iso) return null;
  const h = new Date(iso).getHours();
  if (h >= 4 && h < 8) return 'PRE-SHIFT';
  if (h >= 8 && h < 12) return 'AM SHIFT';
  if (h >= 12 && h < 17) return 'AFTERNOON';
  if (h >= 17 && h < 21) return 'EVENING';
  return 'NIGHT';
}

function getPlanData(metadata: Record<string, unknown> | null | undefined): StepPlanData | null {
  if (!metadata) return null;
  const plan = (metadata as { plan?: unknown }).plan;
  if (plan && typeof plan === 'object') return plan as StepPlanData;
  return null;
}

function initialsFromName(name: string): string {
  const parts = name.replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '··';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function collabToAvatar(c: StepCollaborator): CohortAvatar {
  return {
    id: c.id,
    initials: initialsFromName(c.display_name || ''),
    color: c.avatar_color || '#8E8E93',
  };
}

const ROLE_HONORIFIC_REGEX = /^(preceptor|coach|mentor|instructor|teacher|guide|attending)$/i;

function findRoleCollab(collabs: StepCollaborator[]): StepCollaborator | null {
  return collabs.find((c) => c.role && ROLE_HONORIFIC_REGEX.test(c.role)) ?? null;
}

function statusFromRecord(rec: TimelineStepRecord): StepStatus {
  return STATUS_MAP[rec.status] ?? 'plan';
}

function deriveCapability(category: string) {
  const color = hashCategoryToColor(category || 'general');
  const label =
    category && category.length > 0
      ? category.charAt(0).toUpperCase() + category.slice(1)
      : 'Practice';
  return { id: category || 'general', label, color };
}

function recordToStep(
  rec: TimelineStepRecord,
  seasonId: string,
  weekId: string,
  blueprintsById?: Map<string, BlueprintLookup>,
): TimelineStep {
  const cap = deriveCapability(rec.category);
  const today = isToday(rec.starts_at);
  const plan = getPlanData(rec.metadata);

  // Eyebrow — [TODAY | DAY] · [TIME_OF_DAY?] · [CATEGORY?]
  const dayKey = dayKeyFromIso(rec.starts_at);
  const dayPrefix = today
    ? 'TODAY'
    : rec.starts_at
      ? DAY_LABEL[dayKey].toUpperCase()
      : null;
  const tod = timeOfDayModifier(rec.starts_at);
  const cat = rec.category?.toUpperCase();
  const preTitleParts = [dayPrefix, tod, cat].filter(Boolean) as string[];
  const preTitle = preTitleParts.length > 0 ? preTitleParts.join(' · ') : undefined;

  // HOW WILL YOU DO IT? — from metadata.plan.how_sub_steps
  const howItems: StepHowItem[] | undefined = plan?.how_sub_steps
    ?.slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((sub) => ({ label: sub.text, checked: sub.completed }));

  // Meta row — "Wed · <location>" left, "Preceptor: <name>" right
  const locName = plan?.where_location?.name ?? rec.location_name ?? null;
  const metaLeft = rec.starts_at
    ? locName
      ? `${DAY_LABEL[dayKey]} · ${locName}`
      : DAY_LABEL[dayKey]
    : locName || undefined;
  const roleCollab = plan?.collaborators ? findRoleCollab(plan.collaborators) : null;
  const metaRight = roleCollab
    ? `${capitalize(roleCollab.role!)}: ${roleCollab.display_name}`
    : undefined;

  // Cohort avatars (excluding the role-tagged collab — they're called out
  // separately on the right of the meta row).
  const cohortAvatars: CohortAvatar[] | undefined = plan?.collaborators
    ?.filter((c) => !roleCollab || c.id !== roleCollab.id)
    .slice(0, 3)
    .map(collabToAvatar);
  const cohortLabel =
    plan?.collaborators && plan.collaborators.length > 0
      ? `${plan.collaborators.length} ${plan.collaborators.length === 1 ? 'collab' : 'collabs'}`
      : undefined;

  // FROM provenance — blueprint title from id map when available
  let from: TimelineStep['from'] | undefined;
  if (rec.source_blueprint_id) {
    const bp = blueprintsById?.get(rec.source_blueprint_id);
    from = bp
      ? {
          source: bp.title,
          suggestedBy: bp.author_name,
        }
      : { source: 'Blueprint' };
  }

  // Cross-interest pin marker — TimelineStepService stamps `_pinned: true`
  // on steps surfaced via timeline_step_pins so the canvas can render a
  // pin indicator without re-querying the pin table.
  const pinnedFromOtherInterest =
    (rec as TimelineStepRecord & { _pinned?: boolean })._pinned === true;

  return {
    id: rec.id,
    title: rec.title || 'Untitled step',
    preTitle,
    dayOfWeek: dayKey,
    weekId,
    seasonId,
    status: statusFromRecord(rec),
    metaLeft,
    metaRight,
    whatBody: plan?.what_will_you_do || rec.description || undefined,
    howItems,
    capabilities: [cap],
    from,
    cohortAvatars,
    cohortLabel,
    pinnedFromOtherInterest,
  };
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Compute the L3 analysis layer (capability river + peer journey +
 * librarian prompt) from the already-bucketed week list.
 *
 * Reflections are left empty for v1 — we don't yet have a reflection-
 * text source on the step record. The prompt is a simple progress-based
 * sentence so L3 has something to surface even when no human-authored
 * librarian copy exists.
 */
function computeSeasonAnalysis(
  weeks: TimelineWeek[],
  seasonName: string | null,
  currentWeekNumber: number,
): SeasonAnalysis | undefined {
  if (weeks.length === 0) return undefined;

  // Per-week capability mix — count steps grouped by capability color so
  // the stacked-area chart can render a band per capability.
  const weeklyCapabilities: WeeklyCapabilityMix[] = weeks.map((week, idx) => {
    const counts = new Map<string, number>();
    for (const step of week.steps) {
      const color = step.capabilities?.[0]?.color ?? CAPABILITY_PALETTE.procedural.color;
      counts.set(color, (counts.get(color) ?? 0) + 1);
    }
    const bands = Array.from(counts.entries()).map(([capabilityColor, volume]) => ({
      capabilityColor,
      volume,
    }));
    return { weekNumber: idx + 1, bands };
  });

  // Peers — union of cohortAvatars across all steps in the season. For
  // each unique avatar we compute first-week + per-week appearance count.
  const peerMap = new Map<
    string,
    { initials: string; color: string; firstWeek: number; perWeek: Map<number, number> }
  >();
  weeks.forEach((week, weekIdx) => {
    const weekNumber = weekIdx + 1;
    for (const step of week.steps) {
      for (const avatar of step.cohortAvatars ?? []) {
        const entry = peerMap.get(avatar.id);
        if (entry) {
          entry.perWeek.set(weekNumber, (entry.perWeek.get(weekNumber) ?? 0) + 1);
        } else {
          peerMap.set(avatar.id, {
            initials: avatar.initials,
            color: avatar.color,
            firstWeek: weekNumber,
            perWeek: new Map([[weekNumber, 1]]),
          });
        }
      }
    }
  });

  const peers: SeasonPeer[] = Array.from(peerMap.entries())
    .map(([id, p]) => ({
      id,
      initials: p.initials,
      color: p.color,
      firstWeek: p.firstWeek,
      weeklyAppearances: Array.from(p.perWeek.entries())
        .map(([weekNumber, count]) => ({ weekNumber, count }))
        .sort((a, b) => a.weekNumber - b.weekNumber),
    }))
    // Most-frequent peers first so the chart's vertical order is meaningful.
    .sort(
      (a, b) =>
        b.weeklyAppearances.reduce((n, w) => n + w.count, 0) -
        a.weeklyAppearances.reduce((n, w) => n + w.count, 0),
    )
    .slice(0, 5);

  // Simple progress prompt — surfaced when the season has both a sense
  // of "where it is" (a current-week index) and at least one peer. Real
  // librarian copy lives in the agent loop; this is the always-on
  // baseline so L3 isn't empty for fresh seasons.
  const dominantColor = weeklyCapabilities
    .slice(0, currentWeekNumber)
    .flatMap((w) => w.bands)
    .reduce<{ color: string; volume: number } | null>((max, b) => {
      if (!max || b.volume > max.volume) return { color: b.capabilityColor, volume: b.volume };
      return max;
    }, null);
  const dominantLabel = dominantColor
    ? colorToCapabilityLabel(dominantColor.color)
    : null;
  const promptBody = seasonName
    ? `You're at week ${currentWeekNumber} of ${weeks.length} in ${seasonName}.${
        dominantLabel ? ` ${dominantLabel} has been the dominant thread so far.` : ''
      } What do you want this rotation to add up to?`
    : `You're at week ${currentWeekNumber} of ${weeks.length}. What do you want this rotation to add up to?`;

  return {
    weeklyCapabilities,
    peers,
    reflections: [],
    librarianPrompt: {
      eyebrow: 'This rotation · the librarian noticed',
      body: promptBody,
      primaryCta: { label: 'Open a season check-in', intent: 'open-season-check-in' },
      secondaryCta: { label: 'Not now' },
    },
  };
}

function colorToCapabilityLabel(color: string): string | null {
  for (const cap of Object.values(CAPABILITY_PALETTE)) {
    if (cap.color === color) return cap.label;
  }
  return null;
}

/**
 * Compute the L4 lifetime analysis (capability river spanning every
 * session + lifetime peer chart + librarian "worth a reflection?"
 * prompt) from the full season list.
 *
 * Each session = one TimelineSeason. Dominant capability per session
 * is the most-frequent brick color. Volume = brick count. Peers are
 * a union across every season's collaborators (which appear via the
 * cohort avatar union performed at the per-step level upstream, so
 * here we union by going through the season's step lists).
 *
 * Trophies and reflections are left empty for v1 — there's no
 * "milestone" or "reflection text" source wired into the live data
 * yet. The librarian prompt is a baseline sentence keyed off the
 * first→latest capability drift so L4 has something to surface.
 */
function computeLifetimeAnalysis(seasons: TimelineSeason[]): LifetimeAnalysis | undefined {
  if (seasons.length === 0) return undefined;

  // Sessions oldest → newest. The dataset's `seasons` array lists the
  // current rotation first then archived; reverse for chronological
  // order so the river reads left-to-right as past → present.
  const chronoSeasons = [...seasons].reverse();

  const sessions: LifetimeSession[] = chronoSeasons.map((season, idx) => {
    const counts = new Map<string, number>();
    for (const brick of season.bricks) {
      counts.set(brick.capabilityColor, (counts.get(brick.capabilityColor) ?? 0) + 1);
    }
    let dominantColor = CAPABILITY_PALETTE.procedural.color;
    let dominantCount = 0;
    for (const [color, count] of counts) {
      if (count > dominantCount) {
        dominantColor = color;
        dominantCount = count;
      }
    }
    return {
      sessionIndex: idx + 1,
      seasonId: season.id,
      label: shortenSeasonLabel(season.title),
      dominantCapabilityColor: dominantColor,
      volume: Math.max(1, season.bricks.length),
    };
  });

  // Peer union — walk every season's steps, accumulate per-session counts.
  const peerMap = new Map<
    string,
    {
      initials: string;
      color: string;
      firstSessionIndex: number;
      perSession: Map<number, number>;
    }
  >();
  chronoSeasons.forEach((season, idx) => {
    const sessionIndex = idx + 1;
    for (const week of season.weeks) {
      for (const step of week.steps) {
        for (const avatar of step.cohortAvatars ?? []) {
          const entry = peerMap.get(avatar.id);
          if (entry) {
            entry.perSession.set(sessionIndex, (entry.perSession.get(sessionIndex) ?? 0) + 1);
          } else {
            peerMap.set(avatar.id, {
              initials: avatar.initials,
              color: avatar.color,
              firstSessionIndex: sessionIndex,
              perSession: new Map([[sessionIndex, 1]]),
            });
          }
        }
      }
    }
  });

  const peers: LifetimePeer[] = Array.from(peerMap.entries())
    .map(([id, p]) => ({
      id,
      initials: p.initials,
      color: p.color,
      firstSessionIndex: p.firstSessionIndex,
      sessionAppearances: Array.from(p.perSession.entries())
        .map(([sessionIndex, count]) => ({ sessionIndex, count }))
        .sort((a, b) => a.sessionIndex - b.sessionIndex),
    }))
    .sort(
      (a, b) =>
        b.sessionAppearances.reduce((n, s) => n + s.count, 0) -
        a.sessionAppearances.reduce((n, s) => n + s.count, 0),
    )
    .slice(0, 6);

  // Baseline librarian sentence — drift from first session's dominant
  // capability to the latest. Honest about not knowing the user's
  // milestones yet.
  const firstCap = sessions[0]?.dominantCapabilityColor;
  const lastCap = sessions[sessions.length - 1]?.dominantCapabilityColor;
  const firstLabel = firstCap ? colorToCapabilityLabel(firstCap) : null;
  const lastLabel = lastCap ? colorToCapabilityLabel(lastCap) : null;
  const drift =
    firstLabel && lastLabel && firstLabel !== lastLabel
      ? `Since ${sessions[0].label} you've drifted from ${firstLabel.toLowerCase()} toward ${lastLabel.toLowerCase()}.`
      : firstLabel
        ? `${firstLabel} has been the steady thread across your practice.`
        : '';
  const promptBody =
    sessions.length > 1
      ? `${drift} Worth a reflection on what you're becoming?`
      : "You're early in your practice. Keep going — patterns will emerge over the next few sessions.";

  return {
    sessions,
    peers,
    reflections: [],
    trophies: [],
    librarianPrompt: {
      eyebrow: 'Across your practice · the librarian noticed',
      body: promptBody,
      primaryCta: { label: 'Start a reflection', intent: 'start-reflection' },
      secondaryCta: { label: 'Not now' },
    },
  };
}

function shortenSeasonLabel(title: string): string {
  // "Spring '26 clinical" → "Spring '26". Keep the first ≤ 2 tokens
  // that include a quote/digit so the L4 tick stays readable.
  const tokens = title.split(/\s+/);
  if (tokens.length <= 2) return title;
  return tokens.slice(0, 2).join(' ');
}

interface AdapterInput {
  interestLabel: string;
  user: { initials: string; color: string };
  currentSeason: Season | null;
  allSeasons: Season[];
  steps: TimelineStepRecord[];
  focusStepId?: string;
  /** id → title (and optional author_name) lookup for FROM provenance row. */
  blueprintsById?: Map<string, BlueprintLookup>;
}

export function mapToTimelineDataset({
  interestLabel,
  user,
  currentSeason,
  allSeasons,
  steps,
  focusStepId,
  blueprintsById,
}: AdapterInput): TimelineDataset {
  // Sort steps by sort_order, then starts_at. Stable ordering matters for
  // week bucketing fallback and L4 brick layout.
  const sorted = [...steps].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    const sa = a.starts_at ? Date.parse(a.starts_at) : 0;
    const sb = b.starts_at ? Date.parse(b.starts_at) : 0;
    return sa - sb;
  });

  // Group steps into rotation-relative buckets of 3, ordered by sort_order.
  const seasonIdForSteps = currentSeason?.id ?? 'current';
  const actualFocusId =
    focusStepId ??
    sorted.find((s) => s.status === 'in_progress' || s.status === 'pending')?.id ??
    sorted[0]?.id ??
    '';

  const bucketGroups: TimelineStepRecord[][] = [];
  sorted.forEach((rec, i) => {
    const bucketIdx = Math.floor(i / 3);
    if (!bucketGroups[bucketIdx]) bucketGroups[bucketIdx] = [];
    bucketGroups[bucketIdx].push(rec);
  });

  const weeks: TimelineWeek[] = bucketGroups.map((bucketRecs, bucketIdx) => {
    const id = weekKeyOf(bucketIdx * 3);
    const { number, range } = weekRangeLabel(
      bucketRecs.map((r) => ({ starts_at: r.starts_at })),
      bucketIdx,
    );
    const containsFocus = bucketRecs.some((r) => r.id === actualFocusId);
    return {
      id,
      number,
      dateRange: range,
      isCurrent: containsFocus || bucketIdx === 0,
      steps: bucketRecs.map((r) => recordToStep(r, seasonIdForSteps, id, blueprintsById)),
    };
  });

  // Steps moved to an archived season via Section E's MoveToSeasonSheet
  // get `metadata.season_id` set to the target season's id. We use that
  // to bucket bricks here so the L4 lanes reflect the move immediately —
  // until/unless timeline_steps gains a real season_id column, this
  // metadata field is the source of truth for cross-rotation grouping.
  const seasonIdOf = (rec: TimelineStepRecord): string | null => {
    const meta = rec.metadata as { season_id?: unknown } | null | undefined;
    return typeof meta?.season_id === 'string' ? meta.season_id : null;
  };

  // Current-season bricks (one brick per step, capability-hashed). Only
  // steps that are NOT pinned to an archived season land in the current
  // rotation lane. Carrying the step id lets L4's brick tap navigate to
  // the right step at L1, and lets Section D's drag-reorder identify
  // the lifted brick.
  const currentStepRecords = sorted.filter(
    (rec) => !seasonIdOf(rec) || seasonIdOf(rec) === seasonIdForSteps,
  );
  const currentBricks = currentStepRecords.map((rec) => ({
    capabilityColor: hashCategoryToColor(rec.category),
    stepId: rec.id,
  }));

  const currentWeekIdx = Math.max(
    0,
    weeks.findIndex((w) => w.isCurrent),
  );
  const currentSeasonAnalysis = computeSeasonAnalysis(
    weeks,
    currentSeason?.name ?? currentSeason?.short_name ?? null,
    currentWeekIdx + 1,
  );

  // L2 context strip — "{Season} has been {capability}-heavy." Drives
  // the italic-serif sentence above the L2 carousel title. Same
  // dominant-capability derivation as the librarian prompt; computed
  // once and stamped on the current week.
  if (currentSeasonAnalysis && weeks[currentWeekIdx]) {
    const dominant = currentSeasonAnalysis.weeklyCapabilities
      .slice(0, currentWeekIdx + 1)
      .flatMap((w) => w.bands)
      .reduce<{ color: string; volume: number } | null>((max, b) => {
        if (!max || b.volume > max.volume) {
          return { color: b.capabilityColor, volume: b.volume };
        }
        return max;
      }, null);
    const dominantLabel = dominant ? colorToCapabilityLabel(dominant.color) : null;
    const seasonShortName =
      currentSeason?.short_name ?? currentSeason?.name ?? 'This arc';
    if (dominantLabel) {
      weeks[currentWeekIdx].contextStrip = `${seasonShortName} has been ${dominantLabel.toLowerCase()}-heavy.`;
    }
  }

  const currentSeasonNode: TimelineSeason = {
    id: seasonIdForSteps,
    title: currentSeason?.name ?? currentSeason?.short_name ?? 'Current rotation',
    dateRange:
      currentSeason && currentSeason.start_date && currentSeason.end_date
        ? formatDateRange(currentSeason.start_date, currentSeason.end_date)
        : '',
    weekOfTotal:
      weeks.length > 1
        ? { current: currentWeekIdx + 1, total: weeks.length }
        : undefined,
    weeks,
    bricks: currentBricks,
    analysis: currentSeasonAnalysis,
  };

  // Index moved-via-Section-E step records by their target season id so
  // archived lanes can show real bricks instead of placeholders.
  const movedByArchiveId = new Map<string, TimelineStepRecord[]>();
  for (const rec of sorted) {
    const sid = seasonIdOf(rec);
    if (!sid || sid === seasonIdForSteps) continue;
    const bucket = movedByArchiveId.get(sid) ?? [];
    bucket.push(rec);
    movedByArchiveId.set(sid, bucket);
  }

  // Archived season lanes — dedupe by (name + start_date) so users with
  // duplicate-row data don't see the same rotation listed dozens of times.
  // Bricks-only (no week data needed for L4 visuals).
  const seenArchiveKeys = new Set<string>();
  const archivedSeasons: TimelineSeason[] = [];
  for (const s of allSeasons) {
    if (s.id === currentSeason?.id) continue;
    const name = s.name ?? s.short_name ?? 'Past rotation';
    const key = `${name}::${s.start_date ?? ''}::${s.end_date ?? ''}`;
    if (seenArchiveKeys.has(key)) continue;
    seenArchiveKeys.add(key);
    const moved = movedByArchiveId.get(s.id) ?? [];
    archivedSeasons.push({
      id: s.id,
      title: name,
      dateRange:
        s.start_date && s.end_date ? formatDateRange(s.start_date, s.end_date) : '',
      archived: true,
      weeks: [],
      // Real bricks for steps the user has moved here; placeholders only
      // when no moved steps exist (until the archive RPC ships).
      bricks:
        moved.length > 0
          ? moved.map((rec) => ({
              capabilityColor: hashCategoryToColor(rec.category),
              stepId: rec.id,
            }))
          : Array.from({ length: 8 }, () => ({
              capabilityColor: CAPABILITY_PALETTE.procedural.color,
            })),
    });
  }

  return {
    interest: { id: 'live', label: interestLabel },
    user,
    focusStepId: actualFocusId,
    currentSeasonId: seasonIdForSteps,
    stepCounter: actualFocusId
      ? {
          current: Math.max(1, sorted.findIndex((s) => s.id === actualFocusId) + 1),
          total: sorted.length,
        }
      : undefined,
    weekCounter:
      weeks.length > 0
        ? { current: currentWeekIdx + 1, total: weeks.length }
        : undefined,
    totalSeasons: 1 + archivedSeasons.length,
    totalSteps:
      sorted.length + archivedSeasons.reduce((n, s) => n + s.bricks.length, 0),
    sinceDate: allSeasons[allSeasons.length - 1]?.start_date
      ? new Date(allSeasons[allSeasons.length - 1].start_date).toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        })
      : '',
    seasons: [currentSeasonNode, ...archivedSeasons],
    capabilityFilters: [{ id: 'all', label: 'All' }],
    lifetime: computeLifetimeAnalysis([currentSeasonNode, ...archivedSeasons]),
  };
}
