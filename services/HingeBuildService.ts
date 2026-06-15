import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('HingeBuildService');

export type HingeDayEntryKind = 'flagged' | 'reflection' | 'note';

export interface HingeDayEntry {
  id: string;
  sourceId: string;        // raw row id (a playbook_insights id when refinable)
  kind: HingeDayEntryKind;
  body: string;
  provenance: string;
  refinable: boolean;      // true → can be saved to the library as a forming concept
}

export interface HingeDay {
  date: string;            // YYYY-MM-DD
  dayLabel: string;        // "Wednesday"
  dateLabel: string;       // "March 18"
  entries: HingeDayEntry[];
}

export interface BuiltHinge {
  id: string;
  previousStepId: string;
  previousStepTitle: string;
  nextStepId: string;
  nextStepTitle: string;
  gapStart: string;        // ISO timestamp
  gapEnd: string;          // ISO timestamp
  gapDays: number;
  eyebrowLabel: string;    // "Between Race 3 and Race 4"
  titlePhrase: string;     // "Three days at the edge"
  datesLabel: string;      // "March 18-20"
  days: HingeDay[];
}

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

const cache = new Map<string, { built: BuiltHinge; computedAt: number }>();
const CACHE_TTL_MS = 60_000;

export function clearHingeCache(): void {
  cache.clear();
}

export async function buildHinge(input: {
  userId: string;
  previousStepId: string;
  nextStepId: string;
}): Promise<BuiltHinge> {
  const cacheKey = `${input.userId}:${input.previousStepId}:${input.nextStepId}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.computedAt < CACHE_TTL_MS) return hit.built;

  const [{ data: prev, error: prevErr }, { data: next, error: nextErr }] = await Promise.all([
    supabase
      .from('timeline_steps')
      .select('id, title, completed_at, starts_at, updated_at')
      .eq('id', input.previousStepId)
      .maybeSingle(),
    supabase
      .from('timeline_steps')
      .select('id, title, starts_at, created_at')
      .eq('id', input.nextStepId)
      .maybeSingle(),
  ]);
  if (prevErr || nextErr || !prev || !next) {
    logger.error('Failed to load hinge endpoints', { prevErr, nextErr });
    throw prevErr ?? nextErr ?? new Error('Hinge endpoints missing');
  }

  const gapStart = (prev as any).completed_at ?? (prev as any).updated_at;
  const gapEnd = (next as any).starts_at ?? (next as any).created_at ?? new Date().toISOString();
  if (!gapStart || !gapEnd) throw new Error('Hinge requires gapStart and gapEnd');

  const startDate = startOfDay(gapStart);
  const endDate = startOfDay(gapEnd);
  const gapDays = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000));

  const days = buildDayShells(startDate, endDate);

  await Promise.all([
    fillFlaggedMoments(input.userId, gapStart, gapEnd, days),
    fillStepLessInsights(input.userId, gapStart, gapEnd, days),
    fillDeckAdds(input.userId, gapStart, gapEnd, days),
  ]);

  const built: BuiltHinge = {
    id: encodeHingeId(input.previousStepId, input.nextStepId),
    previousStepId: input.previousStepId,
    previousStepTitle: (prev as any).title ?? 'Previous step',
    nextStepId: input.nextStepId,
    nextStepTitle: (next as any).title ?? 'Next step',
    gapStart,
    gapEnd,
    gapDays,
    eyebrowLabel: `Between ${(prev as any).title ?? 'previous'} and ${(next as any).title ?? 'next'}`,
    titlePhrase: titlePhraseFor(gapDays),
    datesLabel: datesLabelFor(startDate, endDate, gapDays),
    days,
  };

  cache.set(cacheKey, { built, computedAt: Date.now() });
  return built;
}

export function encodeHingeId(previousStepId: string, nextStepId: string): string {
  return `${previousStepId}--${nextStepId}`;
}

export function decodeHingeId(id: string): { previousStepId: string; nextStepId: string } | null {
  const [previousStepId, nextStepId] = id.split('--');
  if (!previousStepId || !nextStepId) return null;
  return { previousStepId, nextStepId };
}

// ──────────────────────────────────────────────────────────────────────
// Phrasing
// ──────────────────────────────────────────────────────────────────────

export function titlePhraseFor(gapDays: number): string {
  if (gapDays <= 0) return 'The day';
  if (gapDays === 1) return 'The night between';
  if (gapDays === 3) return 'Three days at the edge';
  if (gapDays >= 2 && gapDays <= 3) return `${gapDays} days between`;
  if (gapDays >= 4 && gapDays <= 7) return 'A week between';
  if (gapDays >= 28 && gapDays <= 31) return 'A month between';
  if (gapDays >= 8 && gapDays <= 30) return `${gapDays} days`;
  if (gapDays > 30 && gapDays <= 90) return `${Math.round(gapDays / 30)} months between`;
  if (gapDays > 90 && gapDays <= 240) return 'Half a year';
  if (gapDays > 240 && gapDays <= 420) return 'A year between';
  return `${Math.round(gapDays / 30)} months between`;
}

function datesLabelFor(start: Date, end: Date, gapDays: number): string {
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (gapDays === 0) return fmt(start);
  return `${fmt(start)}–${fmt(end)}`;
}

// ──────────────────────────────────────────────────────────────────────
// Day shell + entry fillers
// ──────────────────────────────────────────────────────────────────────

function startOfDay(iso: string | Date): Date {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildDayShells(start: Date, end: Date): HingeDay[] {
  const days: HingeDay[] = [];
  const cursor = new Date(start);
  // Always show at least the start day; if start == end keep one day shell.
  while (cursor.getTime() <= end.getTime()) {
    days.push({
      date: dayKey(cursor),
      dayLabel: cursor.toLocaleDateString(undefined, { weekday: 'long' }),
      dateLabel: cursor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      entries: [],
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  if (days.length === 0) {
    days.push({
      date: dayKey(start),
      dayLabel: start.toLocaleDateString(undefined, { weekday: 'long' }),
      dateLabel: start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      entries: [],
    });
  }
  return days;
}

function pushEntry(days: HingeDay[], at: string, entry: HingeDayEntry) {
  const key = dayKey(new Date(at));
  const target = days.find((d) => d.date === key);
  if (target) target.entries.push(entry);
}

async function fillFlaggedMoments(
  userId: string,
  gapStart: string,
  gapEnd: string,
  days: HingeDay[],
): Promise<void> {
  const { data, error } = await supabase
    .from('step_flag_events')
    .select('id, body, flagged_at, step_id')
    .eq('user_id', userId)
    .gte('flagged_at', gapStart)
    .lte('flagged_at', gapEnd);
  if (error) {
    logger.warn('Skipping flagged moments (table missing or RLS rejected)', error);
    return;
  }
  for (const row of (data ?? []) as { id: string; body: string | null; flagged_at: string; step_id: string | null }[]) {
    pushEntry(days, row.flagged_at, {
      id: `flag-${row.id}`,
      sourceId: row.id,
      kind: 'flagged',
      body: row.body ?? 'Flagged moment',
      provenance: 'Flagged · returned to later',
      refinable: false,
    });
  }
}

async function fillStepLessInsights(
  userId: string,
  gapStart: string,
  gapEnd: string,
  days: HingeDay[],
): Promise<void> {
  // playbook_insights doesn't carry a step_id today; "step-less insights" maps to
  // the unrefined rows captured during the interval (refined ones already became
  // concepts and live elsewhere in the timeline).
  const { data, error } = await supabase
    .from('playbook_insights')
    .select('id, content, created_at, kind, refined_to_concept_id')
    .eq('user_id', userId)
    .is('refined_to_concept_id', null)
    .gte('created_at', gapStart)
    .lte('created_at', gapEnd);
  if (error) {
    logger.warn('Skipping step-less insights', error);
    return;
  }
  for (const row of (data ?? []) as { id: string; content: string | null; created_at: string; kind: string | null }[]) {
    pushEntry(days, row.created_at, {
      id: `insight-${row.id}`,
      sourceId: row.id,
      kind: 'reflection',
      body: row.content ?? 'Insight captured',
      provenance: row.kind ? `Playbook · ${row.kind}` : 'Playbook · insight',
      refinable: true,
    });
  }
}

async function fillDeckAdds(
  userId: string,
  gapStart: string,
  gapEnd: string,
  days: HingeDay[],
): Promise<void> {
  const { data, error } = await supabase
    .from('step_deck')
    .select('id, title, body, added_at, status, placed_at')
    .eq('user_id', userId)
    .gte('added_at', gapStart)
    .lte('added_at', gapEnd);
  if (error) {
    logger.warn('Skipping step_deck adds', error);
    return;
  }
  for (const row of (data ?? []) as {
    id: string;
    title: string;
    body: string | null;
    added_at: string;
    status: string;
    placed_at: string | null;
  }[]) {
    pushEntry(days, row.added_at, {
      id: `deck-${row.id}`,
      sourceId: row.id,
      kind: 'note',
      body: row.body ? `${row.title} — ${row.body}` : row.title,
      provenance: row.placed_at ? 'On-deck · placed' : 'On-deck · kept',
      refinable: false,
    });
  }
}
