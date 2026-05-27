/**
 * useMarineSnapshot — fetch a "right now" wind + ocean-current
 * snapshot from Open-Meteo for a given lat/lng. Lighter than the
 * existing OpenMeteoService (which pulls a full 72h hourly forecast)
 * — we only need the *current* hour to feed Atlas's wind-arrow and
 * tide-arrow overlays as the user pans the map.
 *
 * Open-Meteo's marine API returns ocean_current_velocity (m/s) and
 * ocean_current_direction (degrees from north, in the direction the
 * current is flowing TO — set, not source). We convert m/s → knots
 * for the existing overlay hooks which expect knots.
 *
 * Cached per 4dp coord (~11m) for 5 minutes so a slider drag or
 * minor pan doesn't refetch. Two endpoints are called in parallel.
 *
 * Open-Meteo is keyless and free for non-commercial / low volume.
 * If marine data isn't available for a coordinate (deep inland),
 * the marine fetch returns nulls and we surface only wind.
 */

import { useQuery } from '@tanstack/react-query';

const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
const MS_TO_KNOTS = 1.94384;

export interface MarineSnapshot {
  wind: { degrees: number; knots: number } | null;
  current: { degrees: number; knots: number } | null;
}

interface UseMarineSnapshotArgs {
  lat: number | null;
  lng: number | null;
  enabled?: boolean;
}

function roundCoord(n: number): number {
  return Math.round(n * 10000) / 10000;
}

async function fetchWind(lat: number, lng: number): Promise<MarineSnapshot['wind']> {
  const url = `${WEATHER_URL}?latitude=${lat}&longitude=${lng}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      current?: { wind_speed_10m?: number; wind_direction_10m?: number };
    };
    const c = json.current;
    if (!c || c.wind_speed_10m == null || c.wind_direction_10m == null) return null;
    return {
      degrees: Math.round(c.wind_direction_10m),
      knots: Math.round(c.wind_speed_10m),
    };
  } catch (err) {
    console.warn('[atlas] wind fetch failed', err);
    return null;
  }
}

async function fetchCurrent(lat: number, lng: number): Promise<MarineSnapshot['current']> {
  const url = `${MARINE_URL}?latitude=${lat}&longitude=${lng}&current=ocean_current_velocity,ocean_current_direction`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      current?: {
        ocean_current_velocity?: number;
        ocean_current_direction?: number;
      };
    };
    const c = json.current;
    if (!c || c.ocean_current_velocity == null || c.ocean_current_direction == null) {
      return null;
    }
    return {
      degrees: Math.round(c.ocean_current_direction),
      knots: Math.round(c.ocean_current_velocity * MS_TO_KNOTS * 10) / 10,
    };
  } catch (err) {
    console.warn('[atlas] current fetch failed', err);
    return null;
  }
}

export function useMarineSnapshot({ lat, lng, enabled = true }: UseMarineSnapshotArgs) {
  const queryEnabled = enabled && lat != null && lng != null;
  const rLat = lat != null ? roundCoord(lat) : null;
  const rLng = lng != null ? roundCoord(lng) : null;

  return useQuery({
    queryKey: ['marine-snapshot', rLat, rLng],
    enabled: queryEnabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MarineSnapshot> => {
      if (lat == null || lng == null) return { wind: null, current: null };
      const [wind, current] = await Promise.all([
        fetchWind(lat, lng),
        fetchCurrent(lat, lng),
      ]);
      return { wind, current };
    },
  });
}

/**
 * Formats a wind or current value into the `degrees|knots` string
 * the existing overlay hooks expect on their `conditionsLine` prop.
 * Returns null when no data is available so callers can disable the
 * overlay rather than draw zero-knot arrows.
 */
export function conditionsLineFor(
  value: { degrees: number; knots: number } | null | undefined,
): string | null {
  if (!value) return null;
  return `${value.degrees}|${value.knots}`;
}
