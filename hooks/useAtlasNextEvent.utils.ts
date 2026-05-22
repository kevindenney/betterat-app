/**
 * useAtlasNextEvent.utils — pure mapping/formatting helpers extracted so
 * the resolver's branching can be tested without mocking Supabase or
 * React Query.
 *
 * Pair with hooks/__tests__/useAtlasNextEvent.utils.test.ts.
 */

import type { AtlasNextEvent } from '@/components/ios-register/atlas/AtlasScreen';

export interface RegattaRow {
  id: string;
  name?: string | null;
  start_date?: string | null;
  venue?: unknown;
  metadata?: Record<string, unknown> | null;
}

export interface RaceEventRow {
  id: string;
  name?: string | null;
  start_time?: string | null;
  venue?: unknown;
  metadata?: Record<string, unknown> | null;
}

export function mapRegattaToNextEvent(row: RegattaRow): AtlasNextEvent | null {
  const label = row.name?.trim() || 'Next race';
  const when = formatWhen(row.start_date);
  const where = readVenue(row.venue) || readMetadataString(row.metadata, 'venue_name') || undefined;
  const conditions = buildConditions(row.metadata);
  return { label, when, where, conditions };
}

export function mapRaceEventToNextEvent(row: RaceEventRow): AtlasNextEvent | null {
  const label = row.name?.trim() || 'Next race';
  const when = formatWhen(row.start_time);
  const where = readVenue(row.venue) || readMetadataString(row.metadata, 'venue_name') || undefined;
  const conditions = buildConditions(row.metadata);
  return { label, when, where, conditions };
}

/**
 * Compact "when" formatter — within 6 days use weekday + 12h time, else
 * use "Mon DD". Matches the canonical mockup's "Sat 10am" pattern. Accepts
 * an optional `now` for deterministic testing.
 */
export function formatWhen(iso?: string | null, now: Date = new Date()): string | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysOut = Math.floor((date.getTime() - now.getTime()) / msPerDay);

  const hour12 = ((date.getHours() + 11) % 12) + 1;
  const minute = date.getMinutes();
  const ampm = date.getHours() >= 12 ? 'pm' : 'am';
  const timePart = minute === 0 ? `${hour12}${ampm}` : `${hour12}:${String(minute).padStart(2, '0')}${ampm}`;

  if (daysOut <= 0) return `Today ${timePart}`;
  if (daysOut === 1) return `Tomorrow ${timePart}`;
  if (daysOut < 7) {
    const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
    return `${weekday} ${timePart}`;
  }
  const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${monthDay} ${timePart}`;
}

/**
 * Wind/tide overlay text. The canonical tag fits ~20 chars on its second
 * line; if metadata is missing or absent we return undefined so the tag
 * renders as a single line.
 */
export function buildConditions(
  metadata: Record<string, unknown> | null | undefined,
): string | undefined {
  const wind = readMetadataString(metadata, 'wind') ?? readMetadataString(metadata, 'wind_summary');
  const tide = readMetadataString(metadata, 'tide') ?? readMetadataString(metadata, 'tide_summary');
  const parts = [wind, tide].filter((p): p is string => Boolean(p && p.length <= 24));
  if (parts.length === 0) return undefined;
  return parts.join(' · ');
}

export function readMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * regattas.venue is jsonb (string or object with a `name` field);
 * race_events.venue is usually a string. Accept either shape.
 */
export function readVenue(venue: unknown): string | undefined {
  if (!venue) return undefined;
  if (typeof venue === 'string') {
    const trimmed = venue.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof venue === 'object' && venue !== null) {
    const name = (venue as Record<string, unknown>).name;
    if (typeof name === 'string' && name.trim().length > 0) return name.trim();
  }
  return undefined;
}

/**
 * Picks the earliest-timestamp candidate from a mixed list of (timestamp,
 * event) pairs. Used to merge the resolver's three source paths (regattas
 * owned, race_participants → regattas, race_events). Returns null when
 * no candidates exist.
 */
export function pickEarliest(
  candidates: { ts: string; event: AtlasNextEvent }[],
): AtlasNextEvent | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => a.ts.localeCompare(b.ts));
  return sorted[0].event;
}
