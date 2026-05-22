/**
 * Real-data adapter — maps the live timeline-step + season schema into the
 * TimelineDataset shape the zoom canvas expects.
 *
 * v1 mapping:
 *   • One Season = one TimelineSeason. Steps are bucketed into pseudo-weeks
 *     of 3 by sort_order when `starts_at` is missing; otherwise grouped by
 *     calendar ISO week.
 *   • status (pending/in_progress/completed/settled/skipped) → StepStatus
 *   • category → single derived capability chip (color hashed from string)
 *   • L4 bricks: one per step, colored by derived capability
 *
 * Refinements that don't belong in v1 (provenance row, cohort avatars,
 * Discuss counts, multi-capability chips) are intentionally left
 * unimplemented — those land alongside Section H of the handoff.
 */

import type { Season } from '@/types/season';
import type { TimelineStepRecord, TimelineStepStatus } from '@/types/timeline-steps';
import { CAPABILITY_PALETTE } from './sampleData';
import type {
  DayKey,
  StepStatus,
  TimelineDataset,
  TimelineSeason,
  TimelineStep,
  TimelineWeek,
} from './types';

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
): TimelineStep {
  const cap = deriveCapability(rec.category);
  const today = isToday(rec.starts_at);
  const cat = rec.category?.toUpperCase();
  const preTitle = today
    ? cat
      ? `TODAY · ${cat}`
      : 'TODAY'
    : cat || undefined;
  return {
    id: rec.id,
    title: rec.title || 'Untitled step',
    preTitle,
    dayOfWeek: dayKeyFromIso(rec.starts_at),
    weekId,
    seasonId,
    status: statusFromRecord(rec),
    whatBody: rec.description ?? undefined,
    capabilities: [cap],
    from: rec.source_blueprint_id ? { source: 'Blueprint' } : undefined,
  };
}

interface AdapterInput {
  interestLabel: string;
  user: { initials: string; color: string };
  currentSeason: Season | null;
  allSeasons: Season[];
  steps: TimelineStepRecord[];
  focusStepId?: string;
}

export function mapToTimelineDataset({
  interestLabel,
  user,
  currentSeason,
  allSeasons,
  steps,
  focusStepId,
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
      steps: bucketRecs.map((r) => recordToStep(r, seasonIdForSteps, id)),
    };
  });

  // Current-season bricks (one brick per step, capability-hashed).
  const currentBricks = sorted.map((rec) => ({
    capabilityColor: hashCategoryToColor(rec.category),
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
    archivedSeasons.push({
      id: s.id,
      title: name,
      dateRange:
        s.start_date && s.end_date ? formatDateRange(s.start_date, s.end_date) : '',
      archived: true,
      weeks: [],
      // Bricks unknown for archived seasons here — emit a placeholder lane of
      // 8 muted bricks so the L4 layout reads as a populated archive. Real
      // brick counts ship with the archive RPC in a follow-up.
      bricks: Array.from({ length: 8 }, () => ({
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
