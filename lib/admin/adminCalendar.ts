/**
 * Pure data shaping for the Org Admin · Calendar surface.
 *
 * Kept free of React/React-Native imports so the row-mapping, count, and
 * month-grouping logic can be unit-tested under jest's node env. The hook
 * (useAdminCalendar) and the page (admin/[orgId]/calendar) both import from here.
 */

export interface AdminCalendarEvent {
  id: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  status: string;
  isRace: boolean;
  category: string | null;
  placeName: string | null;
  regattaRaceId: string | null;
  ownerName: string | null;
}

export interface CalendarRpcRow {
  step_id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  is_race: boolean;
  category: string | null;
  place_name: string | null;
  regatta_race_id: string | null;
  owner_name: string | null;
}

export interface MonthGroup {
  key: string;
  label: string;
  events: AdminCalendarEvent[];
}

export const UNSCHEDULED = 'Unscheduled';

export function mapCalendarRow(r: CalendarRpcRow): AdminCalendarEvent {
  return {
    id: r.step_id,
    title: r.title,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    status: r.status,
    isRace: r.is_race,
    category: r.category,
    placeName: r.place_name,
    regattaRaceId: r.regatta_race_id,
    ownerName: r.owner_name,
  };
}

export function scheduledCount(events: AdminCalendarEvent[]): number {
  return events.filter((e) => e.startsAt).length;
}

export function raceCount(events: AdminCalendarEvent[]): number {
  return events.filter((e) => e.isRace).length;
}

export function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export interface ComposedTimes {
  startsAt: string | null;
  endsAt: string | null;
}

function pad2(n: string): string {
  return n.length === 1 ? `0${n}` : n;
}

/**
 * Compose a calendar event's `starts_at`/`ends_at` ISO timestamps from the
 * form's separate date + time fields, interpreted in the author's local
 * timezone (D25 author-fixed dates). Empty date → an unscheduled event (both
 * null). Throws a human-readable Error on malformed input or end ≤ start so
 * the sheet can surface it inline.
 */
export function composeEventTimes(date: string, start: string, end: string): ComposedTimes {
  const d = date.trim();
  if (!d) return { startsAt: null, endsAt: null };
  if (!DATE_RE.test(d)) throw new Error('Date must be in YYYY-MM-DD format');

  const s = start.trim();
  const e = end.trim();
  if (s && !TIME_RE.test(s)) throw new Error('Start time must be HH:MM (24-hour)');
  if (e && !TIME_RE.test(e)) throw new Error('End time must be HH:MM (24-hour)');

  const iso = (time: string) => {
    const [h, m] = time.split(':');
    const parsed = new Date(`${d}T${pad2(h)}:${m}:00`);
    if (Number.isNaN(parsed.getTime())) throw new Error('Could not read that date/time');
    return parsed.toISOString();
  };

  const startsAt = iso(s || '00:00');
  let endsAt: string | null = null;
  if (e) {
    endsAt = iso(e);
    if (new Date(endsAt) <= new Date(startsAt)) {
      throw new Error('End time must be after the start time');
    }
  }
  return { startsAt, endsAt };
}

/**
 * Bucket events into month groups. Events with no start date fall into a
 * trailing "Unscheduled" group. The caller passes events already ordered by
 * the RPC (starts_at asc, nulls last), so Map insertion order is group order.
 */
export function groupByMonth(events: AdminCalendarEvent[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  for (const ev of events) {
    const key = ev.startsAt ? monthLabel(ev.startsAt) : UNSCHEDULED;
    if (!groups.has(key)) groups.set(key, { key, label: key, events: [] });
    groups.get(key)!.events.push(ev);
  }
  return Array.from(groups.values());
}
