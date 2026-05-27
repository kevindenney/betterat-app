/**
 * useHKOObservations — fetches the Hong Kong Observatory's regional
 * weather report ("rhrread") and exposes a `findNearest(lat, lng)`
 * helper that returns the nearest station with live wind data.
 *
 * For sailors in HK this is materially better than a model forecast:
 * HKO reports 10-minute mean wind from real anemometers at Waglan,
 * Cheung Chau, Sai Kung, Star Ferry, etc. The endpoint is keyless,
 * returns ~10KB JSON, and updates every ~10 minutes.
 *
 * Direction is reported as a compass token ("Southeast", "South
 * Southeast"); speed as km/h. We normalize to degrees + knots so the
 * rest of the overlay pipeline can consume it identically to the
 * Open-Meteo path.
 *
 * Outside HK the endpoint returns the same shape but stations are
 * irrelevant; the consumer is responsible for only calling
 * `findNearest` when the map center is in HK.
 */

import { useQuery } from '@tanstack/react-query';

const HKO_URL =
  'https://data.weather.gov.hk/weatherAPI/opendata/opendata.php?dataType=rhrread&lang=en';
const KMH_TO_KNOTS = 0.539957;

// Approximate coords for HKO/EMSD automatic weather stations that
// commonly appear in the rhrread `wind` block. Sourced from HKO's
// station list. Coords are best-effort — fine for "is this station
// within 5km of my map center?" routing.
const STATION_COORDS: Record<string, { lat: number; lng: number }> = {
  'Cheung Chau': { lat: 22.201, lng: 114.027 },
  'Cheung Chau Beach': { lat: 22.21, lng: 114.024 },
  'Chek Lap Kok': { lat: 22.309, lng: 113.922 },
  "Green Island": { lat: 22.286, lng: 114.111 },
  'Hong Kong Observatory': { lat: 22.302, lng: 114.174 },
  "King's Park": { lat: 22.312, lng: 114.173 },
  'Kai Tak Runway Park': { lat: 22.305, lng: 114.214 },
  'Lau Fau Shan': { lat: 22.469, lng: 113.984 },
  'Ngong Ping': { lat: 22.255, lng: 113.911 },
  'Pak Tam Chung': { lat: 22.408, lng: 114.323 },
  'Peng Chau': { lat: 22.29, lng: 114.044 },
  'Sai Kung': { lat: 22.376, lng: 114.275 },
  'Sha Lo Wan': { lat: 22.286, lng: 113.901 },
  'Sha Tin': { lat: 22.398, lng: 114.197 },
  'Sham Shui Po': { lat: 22.335, lng: 114.162 },
  'Star Ferry': { lat: 22.295, lng: 114.169 },
  'Stanley': { lat: 22.218, lng: 114.213 },
  'Tai Mei Tuk': { lat: 22.475, lng: 114.238 },
  'Tai Mo Shan': { lat: 22.41, lng: 114.124 },
  'Tai Po': { lat: 22.451, lng: 114.165 },
  "Tate's Cairn": { lat: 22.358, lng: 114.218 },
  'Tseung Kwan O': { lat: 22.316, lng: 114.259 },
  'Tsing Yi': { lat: 22.345, lng: 114.107 },
  'Tuen Mun': { lat: 22.39, lng: 113.973 },
  'Waglan Island': { lat: 22.183, lng: 114.303 },
  'Wong Chuk Hang': { lat: 22.247, lng: 114.171 },
};

const DIRECTION_DEG: Record<string, number> = {
  N: 0,
  NORTH: 0,
  NNE: 22.5,
  'NORTH NORTHEAST': 22.5,
  NE: 45,
  NORTHEAST: 45,
  ENE: 67.5,
  'EAST NORTHEAST': 67.5,
  E: 90,
  EAST: 90,
  ESE: 112.5,
  'EAST SOUTHEAST': 112.5,
  SE: 135,
  SOUTHEAST: 135,
  SSE: 157.5,
  'SOUTH SOUTHEAST': 157.5,
  S: 180,
  SOUTH: 180,
  SSW: 202.5,
  'SOUTH SOUTHWEST': 202.5,
  SW: 225,
  SOUTHWEST: 225,
  WSW: 247.5,
  'WEST SOUTHWEST': 247.5,
  W: 270,
  WEST: 270,
  WNW: 292.5,
  'WEST NORTHWEST': 292.5,
  NW: 315,
  NORTHWEST: 315,
  NNW: 337.5,
  'NORTH NORTHWEST': 337.5,
  VARIABLE: NaN,
  CALM: NaN,
};

export interface HKOWindStation {
  place: string;
  lat: number;
  lng: number;
  degrees: number;
  knots: number;
}

function directionToDegrees(direction: string): number | null {
  const key = direction.trim().toUpperCase();
  const deg = DIRECTION_DEG[key];
  if (deg == null) return null;
  if (!Number.isFinite(deg)) return null;
  return deg;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

interface RhrreadWindRow {
  place?: string;
  value?: number; // km/h
  direction?: string;
}

interface RhrreadResponse {
  windspeed?: {
    data?: RhrreadWindRow[];
  };
}

async function fetchHKOStations(): Promise<HKOWindStation[]> {
  try {
    const res = await fetch(HKO_URL);
    if (!res.ok) return [];
    const json = (await res.json()) as RhrreadResponse;
    const rows = json.windspeed?.data ?? [];
    const out: HKOWindStation[] = [];
    for (const row of rows) {
      if (!row.place || row.value == null || !row.direction) continue;
      const coords = STATION_COORDS[row.place];
      if (!coords) continue;
      const degrees = directionToDegrees(row.direction);
      if (degrees == null) continue;
      out.push({
        place: row.place,
        lat: coords.lat,
        lng: coords.lng,
        degrees,
        knots: Math.round(row.value * KMH_TO_KNOTS),
      });
    }
    return out;
  } catch (err) {
    console.warn('[atlas] HKO rhrread fetch failed', err);
    return [];
  }
}

export function useHKOObservations() {
  const query = useQuery({
    queryKey: ['hko', 'rhrread', 'windspeed'],
    staleTime: 5 * 60_000,
    queryFn: fetchHKOStations,
  });

  const findNearest = (
    lat: number,
    lng: number,
    maxKm = 5,
  ): (HKOWindStation & { distanceKm: number }) | null => {
    const stations = query.data ?? [];
    let best: (HKOWindStation & { distanceKm: number }) | null = null;
    for (const s of stations) {
      const distanceKm = haversineKm({ lat, lng }, { lat: s.lat, lng: s.lng });
      if (distanceKm > maxKm) continue;
      if (!best || distanceKm < best.distanceKm) {
        best = { ...s, distanceKm };
      }
    }
    return best;
  };

  return { ...query, findNearest };
}

/**
 * Rough HK bounding box — covers the SAR's typical sailing waters from
 * Lantau west out to Mirs Bay east, Deep Bay north to Po Toi south.
 * Use to short-circuit the HKO lookup when the user is panning elsewhere
 * (no point searching stations when they're 1000km away).
 */
export function isInHongKong(lat: number, lng: number): boolean {
  return lat >= 22.05 && lat <= 22.6 && lng >= 113.8 && lng <= 114.55;
}
