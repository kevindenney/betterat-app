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

function isoWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // shift to Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekKeyOf(iso: string | null, fallbackIndex: number): string {
  if (!iso) return `bucket-${Math.floor(fallbackIndex / 3)}`;
  const start = isoWeekStart(new Date(iso));
  return `wk-${start.toISOString().slice(0, 10)}`;
}

function weekRangeLabel(iso: string | null, fallbackIndex: number): {
  range: string;
  number: number;
} {
  if (!iso) {
    return {
      range: `Steps ${fallbackIndex * 3 + 1}–${fallbackIndex * 3 + 3}`,
      number: fallbackIndex + 1,
    };
  }
  const start = isoWeekStart(new Date(iso));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    range: formatDateRange(start.toISOString(), end.toISOString()),
    number: weekNumberOfYear(start),
  };
}

function weekNumberOfYear(date: Date): number {
  const firstJan = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor(
    (date.getTime() - firstJan.getTime()) / 86_400_000,
  );
  return Math.ceil((days + firstJan.getDay() + 1) / 7);
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
  isFocused: boolean,
): TimelineStep {
  const cap = deriveCapability(rec.category);
  return {
    id: rec.id,
    title: rec.title || 'Untitled step',
    preTitle: isFocused
      ? `TODAY · ${rec.category?.toUpperCase() || 'STEP'}`
      : rec.category?.toUpperCase() || undefined,
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

  // Group steps into pseudo-weeks (calendar ISO when possible, else 3-buckets).
  const weekBuckets = new Map<string, { number: number; range: string; steps: TimelineStep[] }>();
  const seasonIdForSteps = currentSeason?.id ?? 'current';
  const actualFocusId = focusStepId ?? sorted.find((s) => s.status === 'in_progress' || s.status === 'pending')?.id ?? sorted[0]?.id ?? '';

  sorted.forEach((rec, i) => {
    const key = weekKeyOf(rec.starts_at, i);
    if (!weekBuckets.has(key)) {
      const labels = weekRangeLabel(rec.starts_at, Math.floor(i / 3));
      weekBuckets.set(key, { number: labels.number, range: labels.range, steps: [] });
    }
    weekBuckets
      .get(key)!
      .steps.push(recordToStep(rec, seasonIdForSteps, key, rec.id === actualFocusId));
  });

  const weeks: TimelineWeek[] = Array.from(weekBuckets.entries()).map(
    ([id, { number, range, steps: weekSteps }], idx) => ({
      id,
      number,
      dateRange: range,
      isCurrent: idx === 0, // newest bucket first
      steps: weekSteps,
    }),
  );

  // Current-season bricks (one brick per step, capability-hashed).
  const currentBricks = sorted.map((rec) => ({
    capabilityColor: hashCategoryToColor(rec.category),
  }));

  const currentSeasonNode: TimelineSeason = {
    id: seasonIdForSteps,
    title: currentSeason?.name ?? currentSeason?.short_name ?? 'Current rotation',
    dateRange:
      currentSeason && currentSeason.start_date && currentSeason.end_date
        ? formatDateRange(currentSeason.start_date, currentSeason.end_date)
        : '',
    weekOfTotal:
      weeks.length > 1 ? { current: 1, total: weeks.length } : undefined,
    weeks,
    bricks: currentBricks,
  };

  // Archived season lanes — bricks-only (no week data needed for L4 visuals).
  const archivedSeasons: TimelineSeason[] = allSeasons
    .filter((s) => s.id !== currentSeason?.id)
    .map((s) => ({
      id: s.id,
      title: s.name ?? s.short_name ?? 'Past rotation',
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
    }));

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
    weekCounter: weeks.length > 0
      ? { current: 1, total: weeks.length }
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
