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
  /**
   * Water-anchored arrow positions. When provided, ONE arrow renders at
   * each anchor instead of a grid — keeps wind arrows over water only,
   * not crowding the canvas with land arrows. Mirror of useTideOverlay.
   */
  waterAnchors?: { lat: number; lng: number }[];
  /**
   * Wave height in meters, appended to the primary arrow's chip as
   * "210° · 9 kn · 0.4m". Optional — when omitted the chip omits the
   * wave segment. Field arrows always omit it (no chip).
   */
  waveHeightMeters?: number;
  /**
   * Provenance string rendered beneath the primary chip — e.g.
   * "Waglan Island obs", "JMA model". Lets the user tell a real
   * anemometer reading from a numerical model at a glance. Optional;
   * when omitted no subtitle renders. Field arrows always omit it.
   */
  source?: string;
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
 * Parse wind conditions into degrees + speed. Accepts two formats:
 *   - Natural language: "12kn ESE" / "10-14 kts WSW" / "wind: SE 8"
 *   - Numeric pipe (from useMarineSnapshot's conditionsLineFor):
 *     "212|7" (degrees|knots), no compass token, no "kn" suffix
 *
 * Falls back to HK summer trade wind (ESE 12kn) when nothing matches.
 * The numeric-pipe fast-path is load-bearing: without it, Open-Meteo
 * data was being discarded and every overlay rendered as the ESE/12
 * default, which read as "wind never changes" no matter where the
 * user panned.
 */
export function parseWind(conditions?: string): { degrees: number; knots: number } {
  if (!conditions) return { degrees: COMPASS_DEG.ESE, knots: 12 };
  // Fast path: degrees|knots numeric format emitted by useMarineSnapshot.
  const numericMatch = conditions.match(/^(\d+(?:\.\d+)?)\|(\d+(?:\.\d+)?)$/);
  if (numericMatch) {
    return { degrees: Number(numericMatch[1]), knots: Number(numericMatch[2]) };
  }
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
  waterAnchors,
  waveHeightMeters,
  source,
}: UseWindOverlayArgs): AtlasPinSpec[] {
  return useMemo(() => {
    if (!enabled) return [];
    const { degrees, knots } = parseWind(conditionsLine);
    // Primary label slots: `${deg}|${knots}|${variant}|${waveM}|${source}`
    //   variant=''      → primary chip
    //   variant='field' → small field arrow (no chip)
    // Trailing empty slots are tolerated by the canvas parsers, so we
    // can pad with empty strings when only some of waveM / source are
    // present.
    const waveSlot = waveHeightMeters != null && waveHeightMeters >= 0 ? `${waveHeightMeters}` : '';
    const sourceSlot = source ?? '';
    const primaryLabel =
      sourceSlot || waveSlot
        ? `${degrees}|${knots}||${waveSlot}|${sourceSlot}`
        : `${degrees}|${knots}`;
    const label = `${degrees}|${knots}`;

    // Water-anchored: one large arrow per anchor (offset upwind slightly
    // so the arrow tip doesn't sit on top of the racing-area POI dot).
    if (waterAnchors && waterAnchors.length > 0) {
      return waterAnchors.map((a, idx) => ({
        id: `wind-water:${idx}`,
        lat: a.lat,
        lng: a.lng,
        kind: 'wind-arrow' as const,
        label,
      }));
    }

    // Fallback grid. Surrounding arrows use the canvas's `|field`
    // variant — smaller, soft slate, no per-arrow knot chip. One
    // primary arrow at the exact center carries the full "045° · 12 kn"
    // chip so the user gets a readable indicator without the grid
    // reading as N hard-labeled duplicates.
    const fieldLabel = `${label}|field`;
    const out: AtlasPinSpec[] = [];
    const half = (gridSize - 1) / 2;
    const dLat = spacingKm / 111;
    const dLng = spacingKm / (111 * Math.cos((centerLat * Math.PI) / 180));
    for (let i = 0; i < gridSize; i += 1) {
      for (let j = 0; j < gridSize; j += 1) {
        out.push({
          id: `wind:${i}-${j}`,
          lat: centerLat + (i - half) * dLat,
          lng: centerLng + (j - half) * dLng,
          kind: 'wind-arrow',
          label: fieldLabel,
        });
      }
    }
    out.push({
      id: 'wind:primary',
      lat: centerLat,
      lng: centerLng,
      kind: 'wind-arrow',
      label: primaryLabel,
    });
    return out;
  }, [centerLat, centerLng, conditionsLine, enabled, spacingKm, gridSize, waterAnchors, waveHeightMeters, source]);
}
