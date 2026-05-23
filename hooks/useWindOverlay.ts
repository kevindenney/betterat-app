/**
 * useWindOverlay — produces a soft directional-arrow vector field for
 * the Atlas F1 frame at z13+. Per the design pass, wind reads as field,
 * not foreground; arrows are low-opacity and grid-spaced so they sit
 * under POIs/race-marks.
 *
 * v1 sourcing:
 *   • Reads wind from the active AtlasNextEvent's conditions string
 *     ("12kn ESE · ebb 0.4kn") — parses direction (N/NE/E/SE/...) and
 *     speed (kn). If absent, falls back to HK summer ESE 12kn so the
 *     demo always reads.
 *   • Future: real weather_conditions row tied to the event's venue +
 *     start time. Schema is there; ingest pipeline is separate work.
 *
 * Grid: 4 rows × 4 cols spaced ~1km apart, anchored on the bbox center.
 * Each arrow is a wind-vector pin (kind='wind-arrow') with a heading
 * stashed in clusterCount (re-using the existing pin spec — wind arrows
 * never cluster, the field is a non-counted heading).
 */

import { useMemo } from 'react';
import type { AtlasPinSpec } from '@/components/ios-register/atlas/AtlasMapLibreCanvas';

interface UseWindOverlayArgs {
  /** Center of the field — usually the next event's venue coords. */
  centerLat: number;
  centerLng: number;
  /** Conditions string from useAtlasNextEvent — e.g. "12kn ESE · ebb 0.4kn". */
  conditionsLine?: string;
  /** Disable the overlay (e.g. wrong frame). */
  enabled?: boolean;
  /** Grid spacing in km. Default 1.2. */
  spacingKm?: number;
  /** Grid side length (n × n). Default 4. */
  gridSize?: number;
}

const COMPASS_DEG: Record<string, number> = {
  N: 0,
  NE: 45,
  E: 90,
  SE: 135,
  S: 180,
  SW: 225,
  W: 270,
  NW: 315,
  NNE: 22.5,
  ENE: 67.5,
  ESE: 112.5,
  SSE: 157.5,
  SSW: 202.5,
  WSW: 247.5,
  WNW: 292.5,
  NNW: 337.5,
};

/**
 * Parse "12kn ESE" / "10-14 kts WSW" / "wind: SE 8" → degrees + speed.
 * Falls back to HK summer trade wind (ESE 12kn) when nothing matches.
 */
export function parseWind(conditions?: string): { degrees: number; knots: number } {
  if (!conditions) return { degrees: COMPASS_DEG.ESE, knots: 12 };
  const upper = conditions.toUpperCase();
  // Find direction token — longest match first so "ESE" beats "E"
  const tokens = Object.keys(COMPASS_DEG).sort((a, b) => b.length - a.length);
  let degrees = COMPASS_DEG.ESE;
  for (const tok of tokens) {
    if (new RegExp(`(^|[^A-Z])${tok}([^A-Z]|$)`).test(upper)) {
      degrees = COMPASS_DEG[tok];
      break;
    }
  }
  // Knots — first number adjacent to "kn", "kt", or "kts". Default 12.
  const knotMatch = upper.match(/(\d+(?:\.\d+)?)\s*K[NT]S?\b/);
  const knots = knotMatch ? Number(knotMatch[1]) : 12;
  return { degrees, knots };
}

export function useWindOverlay({
  centerLat,
  centerLng,
  conditionsLine,
  enabled = true,
  spacingKm = 1.2,
  gridSize = 4,
}: UseWindOverlayArgs): AtlasPinSpec[] {
  return useMemo(() => {
    if (!enabled) return [];
    const { degrees, knots } = parseWind(conditionsLine);
    const out: AtlasPinSpec[] = [];
    const half = (gridSize - 1) / 2;
    // Convert km offset to lat/lng degrees at this latitude
    const dLat = spacingKm / 111;
    const dLng = spacingKm / (111 * Math.cos((centerLat * Math.PI) / 180));
    for (let i = 0; i < gridSize; i += 1) {
      for (let j = 0; j < gridSize; j += 1) {
        const lat = centerLat + (i - half) * dLat;
        const lng = centerLng + (j - half) * dLng;
        out.push({
          id: `wind:${i}-${j}`,
          lat,
          lng,
          kind: 'wind-arrow',
          // Stash heading + knots in label; the renderer parses them
          // back. Avoids adding new fields to AtlasPinSpec for one layer.
          label: `${degrees}|${knots}`,
        });
      }
    }
    return out;
  }, [centerLat, centerLng, conditionsLine, enabled, spacingKm, gridSize]);
}
