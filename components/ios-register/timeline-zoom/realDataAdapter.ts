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
  StepHowItem,
  StepStatus,
  TimelineDataset,
  TimelineSeason,
  TimelineStep,
  TimelineWeek,
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
  };
}
