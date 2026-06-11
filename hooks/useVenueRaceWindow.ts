/**
 * useVenueRaceWindow — race-time conditions window for the Atlas
 * venue-mastery surfaces (Phase V.1).
 *
 * Thin derivation over useMarineTrendWindow: samples wind/current/waves
 * hourly across [start−2h … start+4h] around a race's starts_at and
 * derives the two things the race-time bar needs beyond raw points:
 *
 * - `startIndex` — which point is the race start (scrubber's home position)
 * - `tideFlip` — first hour inside [start−1h, start+4h] where the current
 *   direction swings >120° between adjacent hours at meaningful velocity
 *   (≥0.2kn on either side). That's a tidal stream reversal — the single
 *   most strategy-relevant fact about a race window on tidal water.
 */

import { useMemo } from 'react';

import { useMarineTrendWindow, type MarineTrendPoint } from '@/hooks/useMarineSnapshot';

const RACE_WINDOW_OFFSETS = [-120, -60, 0, 60, 120, 180, 240];

export type VenueRaceWindowStatus = 'ok' | 'loading' | 'no-event' | 'out-of-range';

export interface VenueRaceWindow {
  status: VenueRaceWindowStatus;
  points: MarineTrendPoint[];
  /** Index of the race-start point in `points`; -1 when not found. */
  startIndex: number;
  /** First detected tidal-stream reversal inside [start−1h, start+4h]. */
  tideFlip: { atIso: string } | null;
}

interface UseVenueRaceWindowArgs {
  lat: number | null | undefined;
  lng: number | null | undefined;
  startsAt: string | null | undefined;
  enabled?: boolean;
}

function angularDiff(a: number, b: number): number {
  return Math.abs(((b - a + 180) % 360 + 360) % 360 - 180);
}

export function detectTideFlip(
  points: MarineTrendPoint[],
  startsAt: string,
): { atIso: string } | null {
  const startMs = new Date(startsAt).getTime();
  if (Number.isNaN(startMs)) return null;
  const windowStart = startMs - 60 * 60_000;
  const windowEnd = startMs + 4 * 60 * 60_000;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].current;
    const b = points[i].current;
    if (!a || !b) continue;
    const atMs = new Date(points[i].iso + 'Z').getTime();
    if (Number.isNaN(atMs) || atMs < windowStart || atMs > windowEnd) continue;
    if (Math.max(a.knots, b.knots) < 0.2) continue;
    if (angularDiff(a.degrees, b.degrees) > 120) {
      return { atIso: points[i].iso };
    }
  }
  return null;
}

export function useVenueRaceWindow({
  lat,
  lng,
  startsAt,
  enabled = true,
}: UseVenueRaceWindowArgs): VenueRaceWindow {
  const hasEvent = !!startsAt && lat != null && lng != null;
  const trend = useMarineTrendWindow({
    lat: lat ?? null,
    lng: lng ?? null,
    targetTime: startsAt ?? null,
    enabled: enabled && hasEvent,
    offsetsMinutes: RACE_WINDOW_OFFSETS,
  });

  return useMemo(() => {
    if (!hasEvent) {
      return { status: 'no-event' as const, points: [], startIndex: -1, tideFlip: null };
    }
    if (trend.data?.outOfRange) {
      return { status: 'out-of-range' as const, points: [], startIndex: -1, tideFlip: null };
    }
    const points = trend.data?.points ?? [];
    if (points.length === 0) {
      return { status: 'loading' as const, points: [], startIndex: -1, tideFlip: null };
    }
    return {
      status: 'ok' as const,
      points,
      startIndex: points.findIndex((p) => p.label === 'Start'),
      tideFlip: startsAt ? detectTideFlip(points, startsAt) : null,
    };
  }, [hasEvent, trend.data, startsAt]);
}
