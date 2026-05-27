/**
 * useHKOObservations — fetches the Hong Kong Observatory's 10-minute
 * mean wind CSV from the regional-weather bucket and exposes a
 * `findNearest(lat, lng)` helper.
 *
 * For sailors in HK this beats a numerical model: HKO publishes
 * 10-min mean wind from real anemometers at Waglan, Cheung Chau, Sai
 * Kung, Star Ferry, etc. The CSV is keyless, ~3KB, updates every 10
 * minutes.
 *
 * Endpoint shape (CSV, header + N rows):
 *   Date time,Automatic Weather Station,
 *   10-Minute Mean Wind Direction(Compass points),
 *   10-Minute Mean Speed(km/hour),
 *   10-Minute Maximum Gust(km/hour)
 *
 * Wind direction is a compass token ("Southeast", "South Southeast",
 * "Variable"); speed is km/h. We normalize to degrees + knots so the
 * rest of the overlay pipeline can consume it identically to the
 * Open-Meteo path. "Variable" / "Calm" rows are dropped — direction
 * isn't useful for an arrow.
 */

import { useQuery } from '@tanstack/react-query';

const HKO_URL =
  'https://data.weather.gov.hk/weatherAPI/hko_data/regional-weather/latest_10min_wind.csv';
const KMH_TO_KNOTS = 0.539957;

// Approximate coords for HKO's automatic weather stations. Sourced
// from HKO's station list. Coords are best-effort — fine for "is this
// station within 5km of my map center?" routing. Keys must match
// the station names HKO publishes in the CSV's column 2 exactly.
const STATION_COORDS: Record<string, { lat: number; lng: number }> = {
  'Central Pier': { lat: 22.288, lng: 114.16 },
  'Chek Lap Kok': { lat: 22.309, lng: 113.922 },
  'Cheung Chau': { lat: 22.201, lng: 114.027 },
  'Cheung Chau Beach': { lat: 22.21, lng: 114.024 },
  'Green Island': { lat: 22.286, lng: 114.111 },
  'Hong Kong Sea School': { lat: 22.219, lng: 114.213 },
  'Kai Tak': { lat: 22.305, lng: 114.214 },
  "King's Park": { lat: 22.312, lng: 114.173 },
  'Lamma Island': { lat: 22.218, lng: 114.131 },
  'Lau Fau Shan': { lat: 22.469, lng: 113.984 },
  'Ngong Ping': { lat: 22.255, lng: 113.911 },
  'North Point': { lat: 22.292, lng: 114.201 },
  'Peng Chau': { lat: 22.29, lng: 114.044 },
  'Sai Kung': { lat: 22.376, lng: 114.275 },
  'Sha Chau': { lat: 22.354, lng: 113.892 },
  'Sha Tin': { lat: 22.398, lng: 114.197 },
  'Shek Kong': { lat: 22.435, lng: 114.082 },
  Stanley: { lat: 22.218, lng: 114.213 },
  'Star Ferry': { lat: 22.295, lng: 114.169 },
  'Ta Kwu Ling': { lat: 22.529, lng: 114.157 },
  'Tai Mei Tuk': { lat: 22.475, lng: 114.238 },
  'Tai Po Kau': { lat: 22.435, lng: 114.184 },
  'Tap Mun': { lat: 22.471, lng: 114.362 },
  "Tate's Cairn": { lat: 22.358, lng: 114.218 },
  'Tseung Kwan O': { lat: 22.316, lng: 114.259 },
  'Tsing Yi': { lat: 22.345, lng: 114.107 },
  'Tuen Mun': { lat: 22.39, lng: 113.973 },
  'Waglan Island': { lat: 22.183, lng: 114.303 },
  'Wetland Park': { lat: 22.466, lng: 114.007 },
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
  // Variable / Calm: arrow direction isn't meaningful, drop these
  if (!key || key === 'VARIABLE' || key === 'CALM') return null;
  const deg = DIRECTION_DEG[key];
  return deg == null ? null : deg;
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

function parseHKOCsv(csv: string): HKOWindStation[] {
  const lines = csv.split(/\r?\n/);
  const out: HKOWindStation[] = [];
  // Skip header (line 0). Columns: time, station, direction, kph, gust
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');
    if (cols.length < 4) continue;
    const place = cols[1].trim();
    const direction = cols[2].trim();
    const kphStr = cols[3].trim();
    const coords = STATION_COORDS[place];
    if (!coords) continue;
    const degrees = directionToDegrees(direction);
    if (degrees == null) continue;
    const kph = Number(kphStr);
    if (!Number.isFinite(kph)) continue;
    out.push({
      place,
      lat: coords.lat,
      lng: coords.lng,
      degrees,
      knots: Math.round(kph * KMH_TO_KNOTS),
    });
  }
  return out;
}

async function fetchHKOStations(): Promise<HKOWindStation[]> {
  try {
    const res = await fetch(HKO_URL);
    if (!res.ok) return [];
    const csv = await res.text();
    return parseHKOCsv(csv);
  } catch (err) {
    console.warn('[atlas] HKO 10-min wind fetch failed', err);
    return [];
  }
}

export function useHKOObservations() {
  const query = useQuery({
    queryKey: ['hko', '10min-wind'],
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
