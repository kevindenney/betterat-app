/**
 * useMarineSnapshot — fetch a "right now" wind + ocean-current + wave
 * snapshot from Open-Meteo for a given lat/lng. Lighter than the
 * existing OpenMeteoService (which pulls a full 72h hourly forecast)
 * — we only need the *current* hour to feed Atlas's overlays as the
 * user pans the map.
 *
 * - Wind: forecast API, JMA seamless (~5km East Asia, ~20km elsewhere)
 * - Current: marine API, ocean_current_velocity + direction (m/s → kn)
 * - Waves: marine API, height (m), direction (set, degrees), period (s)
 *
 * Cached per 4dp coord (~11m) for 5 minutes so a slider drag or minor
 * pan doesn't refetch. Three endpoints in parallel — Open-Meteo is
 * keyless and free for non-commercial / low volume.
 *
 * If marine data isn't available for a coordinate (deep inland, lake,
 * etc.) the marine fetches return null and consumers skip those layers.
 */

import { useQuery } from '@tanstack/react-query';

const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
const MS_TO_KNOTS = 1.94384;

export interface MarineSnapshot {
  wind: { degrees: number; knots: number } | null;
  current: { degrees: number; knots: number } | null;
  waves: { degrees: number; heightMeters: number; periodSeconds: number } | null;
  /** 'now' = current-hour nowcast; 'forecast' = conditions at the requested time. */
  mode: 'now' | 'forecast';
  /**
   * Set when a `targetTime` was requested but falls outside Open-Meteo's
   * forecast horizon (>16 days out, or in the past). All three layers are null;
   * callers should say the forecast isn't available yet rather than draw a
   * stale "now" snapshot as if it were the race conditions.
   */
  outOfRange?: boolean;
}

export interface MarineTrendPoint {
  label: string;
  iso: string;
  wind: MarineSnapshot['wind'];
  current: MarineSnapshot['current'];
  waves: MarineSnapshot['waves'];
}

interface UseMarineSnapshotArgs {
  lat: number | null;
  lng: number | null;
  enabled?: boolean;
  /**
   * ISO timestamp to forecast for (e.g. a race's start_at). When set, the hook
   * returns the hourly forecast nearest that time instead of the current hour,
   * so the course map shows conditions AT THE RACE — not right now. Omit/null
   * for a live "now" snapshot.
   */
  targetTime?: string | null;
}

interface UseMarineTrendWindowArgs {
  lat: number | null;
  lng: number | null;
  targetTime?: string | null;
  enabled?: boolean;
  /**
   * Hour offsets (minutes from targetTime) to sample. Defaults to
   * [-60, 0, 60, 120, 180]. 0 is labeled 'Start', others 'T±Nm'.
   */
  offsetsMinutes?: number[];
}

function roundCoord(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// Open-Meteo hourly.time (with timezone=GMT) looks like "2026-06-04T06:00".
// Round the target to its UTC hour and format to match for index lookup.
function targetHourIso(targetTime: string): string | null {
  const d = new Date(targetTime);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCMinutes(0, 0, 0);
  return `${d.toISOString().slice(0, 13)}:00`;
}

function shiftedHourIso(targetTime: string, offsetMinutes: number): string | null {
  const d = new Date(targetTime);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCMinutes(0, 0, 0);
  d.setUTCMinutes(d.getUTCMinutes() + offsetMinutes);
  return `${d.toISOString().slice(0, 13)}:00`;
}

// Open-Meteo's free forecast spans ~now-1d … now+16d. Outside that we can't
// forecast the race conditions, so the caller shows a "not yet" message.
function isForecastable(targetTime: string): boolean {
  const t = new Date(targetTime).getTime();
  if (Number.isNaN(t)) return false;
  const days = (t - Date.now()) / 86_400_000;
  return days >= -1 && days <= 16;
}

function valueAtHour<T>(
  time: string[] | undefined,
  hourIso: string,
  pick: (idx: number) => T | null,
): T | null {
  if (!time) return null;
  const idx = time.indexOf(hourIso);
  return idx < 0 ? null : pick(idx);
}

async function fetchWindAt(
  lat: number,
  lng: number,
  date: string,
  hourIso: string,
): Promise<MarineSnapshot['wind']> {
  const url = `${WEATHER_URL}?latitude=${lat}&longitude=${lng}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&models=jma_seamless&timezone=GMT&start_date=${date}&end_date=${date}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      hourly?: { time?: string[]; wind_speed_10m?: number[]; wind_direction_10m?: number[] };
    };
    const h = json.hourly;
    return valueAtHour(h?.time, hourIso, (idx) => {
      const spd = h?.wind_speed_10m?.[idx];
      const dir = h?.wind_direction_10m?.[idx];
      if (spd == null || dir == null) return null;
      return { degrees: Math.round(dir), knots: Math.round(spd) };
    });
  } catch (err) {
    console.warn('[atlas] wind forecast fetch failed', err);
    return null;
  }
}

async function fetchCurrentAt(
  lat: number,
  lng: number,
  date: string,
  hourIso: string,
): Promise<MarineSnapshot['current']> {
  const url = `${MARINE_URL}?latitude=${lat}&longitude=${lng}&hourly=ocean_current_velocity,ocean_current_direction&timezone=GMT&start_date=${date}&end_date=${date}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      hourly?: { time?: string[]; ocean_current_velocity?: number[]; ocean_current_direction?: number[] };
    };
    const h = json.hourly;
    return valueAtHour(h?.time, hourIso, (idx) => {
      const vel = h?.ocean_current_velocity?.[idx];
      const dir = h?.ocean_current_direction?.[idx];
      if (vel == null || dir == null) return null;
      return { degrees: Math.round(dir), knots: Math.round(vel * MS_TO_KNOTS * 10) / 10 };
    });
  } catch (err) {
    console.warn('[atlas] current forecast fetch failed', err);
    return null;
  }
}

async function fetchWavesAt(
  lat: number,
  lng: number,
  date: string,
  hourIso: string,
): Promise<MarineSnapshot['waves']> {
  const url = `${MARINE_URL}?latitude=${lat}&longitude=${lng}&hourly=wave_height,wave_direction,wave_period&timezone=GMT&start_date=${date}&end_date=${date}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      hourly?: { time?: string[]; wave_height?: number[]; wave_direction?: number[]; wave_period?: number[] };
    };
    const h = json.hourly;
    return valueAtHour(h?.time, hourIso, (idx) => {
      const ht = h?.wave_height?.[idx];
      const dir = h?.wave_direction?.[idx];
      const per = h?.wave_period?.[idx];
      if (ht == null || dir == null || per == null) return null;
      return {
        degrees: Math.round(dir),
        heightMeters: Math.round(ht * 10) / 10,
        periodSeconds: Math.round(per * 10) / 10,
      };
    });
  } catch (err) {
    console.warn('[atlas] waves forecast fetch failed', err);
    return null;
  }
}

// --- Batched per-date fetchers ------------------------------------------
// A trend window samples several hours that usually share one calendar
// date; fetching the whole day once and indexing by hour ISO turns
// 3×N requests into 3×(distinct dates).

async function fetchWindDay(
  lat: number,
  lng: number,
  date: string,
): Promise<Map<string, NonNullable<MarineSnapshot['wind']>>> {
  const out = new Map<string, NonNullable<MarineSnapshot['wind']>>();
  const url = `${WEATHER_URL}?latitude=${lat}&longitude=${lng}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&models=jma_seamless&timezone=GMT&start_date=${date}&end_date=${date}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return out;
    const json = (await res.json()) as {
      hourly?: { time?: string[]; wind_speed_10m?: number[]; wind_direction_10m?: number[] };
    };
    const h = json.hourly;
    h?.time?.forEach((iso, idx) => {
      const spd = h?.wind_speed_10m?.[idx];
      const dir = h?.wind_direction_10m?.[idx];
      if (spd == null || dir == null) return;
      out.set(iso, { degrees: Math.round(dir), knots: Math.round(spd) });
    });
  } catch (err) {
    console.warn('[atlas] wind day fetch failed', err);
  }
  return out;
}

async function fetchCurrentDay(
  lat: number,
  lng: number,
  date: string,
): Promise<Map<string, NonNullable<MarineSnapshot['current']>>> {
  const out = new Map<string, NonNullable<MarineSnapshot['current']>>();
  const url = `${MARINE_URL}?latitude=${lat}&longitude=${lng}&hourly=ocean_current_velocity,ocean_current_direction&timezone=GMT&start_date=${date}&end_date=${date}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return out;
    const json = (await res.json()) as {
      hourly?: { time?: string[]; ocean_current_velocity?: number[]; ocean_current_direction?: number[] };
    };
    const h = json.hourly;
    h?.time?.forEach((iso, idx) => {
      const vel = h?.ocean_current_velocity?.[idx];
      const dir = h?.ocean_current_direction?.[idx];
      if (vel == null || dir == null) return;
      out.set(iso, { degrees: Math.round(dir), knots: Math.round(vel * MS_TO_KNOTS * 10) / 10 });
    });
  } catch (err) {
    console.warn('[atlas] current day fetch failed', err);
  }
  return out;
}

async function fetchWavesDay(
  lat: number,
  lng: number,
  date: string,
): Promise<Map<string, NonNullable<MarineSnapshot['waves']>>> {
  const out = new Map<string, NonNullable<MarineSnapshot['waves']>>();
  const url = `${MARINE_URL}?latitude=${lat}&longitude=${lng}&hourly=wave_height,wave_direction,wave_period&timezone=GMT&start_date=${date}&end_date=${date}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return out;
    const json = (await res.json()) as {
      hourly?: { time?: string[]; wave_height?: number[]; wave_direction?: number[]; wave_period?: number[] };
    };
    const h = json.hourly;
    h?.time?.forEach((iso, idx) => {
      const ht = h?.wave_height?.[idx];
      const dir = h?.wave_direction?.[idx];
      const per = h?.wave_period?.[idx];
      if (ht == null || dir == null || per == null) return;
      out.set(iso, {
        degrees: Math.round(dir),
        heightMeters: Math.round(ht * 10) / 10,
        periodSeconds: Math.round(per * 10) / 10,
      });
    });
  } catch (err) {
    console.warn('[atlas] waves day fetch failed', err);
  }
  return out;
}

async function fetchWind(lat: number, lng: number): Promise<MarineSnapshot['wind']> {
  // `models=jma_seamless` switches Open-Meteo from its global best_match
  // ensemble to JMA's seamless model. JMA is the regional met service for
  // East Asia and its MSM mesoscale (~5km) is materially more accurate
  // for HK / Japan / Taiwan / coastal China than the ICON model that
  // best_match was picking for HK (verified: 9.5kn JMA vs 7.2kn ICON for
  // 22.3°N 114.2°E — 30% delta, crosses the drifting/light-air boundary).
  // Outside East Asia, jma_seamless falls back to JMA's GSM (~20km),
  // slightly coarser than best_match's regional picks. Acceptable
  // trade-off for a sailing app whose primary users are HK-based.
  const url = `${WEATHER_URL}?latitude=${lat}&longitude=${lng}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&models=jma_seamless`;
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

async function fetchWaves(lat: number, lng: number): Promise<MarineSnapshot['waves']> {
  // wave_direction is the bearing the waves are TRAVELING TO (set
  // convention, same as ocean current). wave_height is significant
  // height in meters. wave_period is energy proxy in seconds — long
  // periods (10s+) mean ocean swell, short (4-6s) means local wind-
  // generated chop. All three matter for sailors.
  const url = `${MARINE_URL}?latitude=${lat}&longitude=${lng}&current=wave_height,wave_direction,wave_period`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      current?: {
        wave_height?: number;
        wave_direction?: number;
        wave_period?: number;
      };
    };
    const c = json.current;
    if (!c || c.wave_height == null || c.wave_direction == null || c.wave_period == null) {
      return null;
    }
    return {
      degrees: Math.round(c.wave_direction),
      heightMeters: Math.round(c.wave_height * 10) / 10,
      periodSeconds: Math.round(c.wave_period * 10) / 10,
    };
  } catch (err) {
    console.warn('[atlas] waves fetch failed', err);
    return null;
  }
}

export function useMarineSnapshot({
  lat,
  lng,
  enabled = true,
  targetTime = null,
}: UseMarineSnapshotArgs) {
  const queryEnabled = enabled && lat != null && lng != null;
  const rLat = lat != null ? roundCoord(lat) : null;
  const rLng = lng != null ? roundCoord(lng) : null;

  return useQuery({
    queryKey: ['marine-snapshot', rLat, rLng, targetTime ?? 'now'],
    enabled: queryEnabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MarineSnapshot> => {
      if (lat == null || lng == null) {
        return { wind: null, current: null, waves: null, mode: 'now' };
      }

      // Forecast-at-race-time path. When the race is outside Open-Meteo's
      // horizon we return all-null + outOfRange so the UI says "not yet"
      // rather than passing off the current nowcast as the race forecast.
      if (targetTime) {
        if (!isForecastable(targetTime)) {
          return { wind: null, current: null, waves: null, mode: 'forecast', outOfRange: true };
        }
        const hourIso = targetHourIso(targetTime);
        if (!hourIso) {
          return { wind: null, current: null, waves: null, mode: 'forecast', outOfRange: true };
        }
        const date = hourIso.slice(0, 10);
        const [wind, current, waves] = await Promise.all([
          fetchWindAt(lat, lng, date, hourIso),
          fetchCurrentAt(lat, lng, date, hourIso),
          fetchWavesAt(lat, lng, date, hourIso),
        ]);
        return { wind, current, waves, mode: 'forecast' };
      }

      const [wind, current, waves] = await Promise.all([
        fetchWind(lat, lng),
        fetchCurrent(lat, lng),
        fetchWaves(lat, lng),
      ]);
      return { wind, current, waves, mode: 'now' };
    },
  });
}

const DEFAULT_TREND_OFFSETS = [-60, 0, 60, 120, 180];

function trendOffsetLabel(minutes: number): string {
  if (minutes === 0) return 'Start';
  return minutes < 0 ? `T-${Math.abs(minutes)}m` : `T+${minutes}m`;
}

export function useMarineTrendWindow({
  lat,
  lng,
  targetTime = null,
  enabled = true,
  offsetsMinutes = DEFAULT_TREND_OFFSETS,
}: UseMarineTrendWindowArgs) {
  const queryEnabled = enabled && lat != null && lng != null && !!targetTime;
  const rLat = lat != null ? roundCoord(lat) : null;
  const rLng = lng != null ? roundCoord(lng) : null;

  return useQuery({
    queryKey: ['marine-trend-window', rLat, rLng, targetTime ?? 'none', offsetsMinutes.join(',')],
    enabled: queryEnabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ points: MarineTrendPoint[]; outOfRange?: boolean }> => {
      if (lat == null || lng == null || !targetTime || !isForecastable(targetTime)) {
        return { points: [], outOfRange: true };
      }
      const hours = offsetsMinutes
        .map((minutes) => ({
          label: trendOffsetLabel(minutes),
          iso: shiftedHourIso(targetTime, minutes),
        }))
        .filter((o): o is { label: string; iso: string } => !!o.iso);
      const dates = [...new Set(hours.map((h) => h.iso.slice(0, 10)))];
      const mergeMaps = <T,>(maps: Map<string, T>[]): Map<string, T> => {
        const merged = new Map<string, T>();
        for (const m of maps) for (const [k, v] of m) merged.set(k, v);
        return merged;
      };
      const [windMaps, currentMaps, wavesMaps] = await Promise.all([
        Promise.all(dates.map((d) => fetchWindDay(lat, lng, d))),
        Promise.all(dates.map((d) => fetchCurrentDay(lat, lng, d))),
        Promise.all(dates.map((d) => fetchWavesDay(lat, lng, d))),
      ]);
      const windByHour = mergeMaps(windMaps);
      const currentByHour = mergeMaps(currentMaps);
      const wavesByHour = mergeMaps(wavesMaps);
      const points = hours.map((hour): MarineTrendPoint => ({
        label: hour.label,
        iso: hour.iso,
        wind: windByHour.get(hour.iso) ?? null,
        current: currentByHour.get(hour.iso) ?? null,
        waves: wavesByHour.get(hour.iso) ?? null,
      }));
      return { points };
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
