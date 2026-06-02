/**
 * useWaveOverlay — third sibling to useWindOverlay / useTideOverlay. Renders
 * a soft directional field for ocean swell at the F1 frame, distinct from
 * wind (slate) and tide (teal) by an indigo glyph (kind='wave-arrow').
 *
 * Convention: wave_direction is the bearing the swell is TRAVELING TO (set
 * convention, same as ocean current), so the arrow points at `degrees`
 * directly — no +180 like wind.
 *
 * Sourcing: parses the numeric "degrees|heightMeters" line emitted from
 * useMarineSnapshot's waves field. The second pipe slot is significant
 * wave height in METRES, not knots — the canvas wave-arrow renderer reads
 * it as metres and labels the chip "210° · 0.4m".
 *
 * The grid is offset south of the wind/tide fields so the three channels
 * read as separate vector fields rather than piling on the same water.
 */

import { useMemo } from 'react';
import type { AtlasPinSpec } from '@/components/ios-register/atlas/AtlasMapLibreCanvas';

interface UseWaveOverlayArgs {
  centerLat: number;
  centerLng: number;
  /** Numeric "degrees|heightMeters" line from useMarineSnapshot waves. */
  conditionsLine?: string;
  enabled?: boolean;
  /** Grid spacing in km. Default 2.5. */
  spacingKm?: number;
  /** Grid side length (n × n). Default 3. */
  gridSize?: number;
  /**
   * Water-anchored arrow positions. When provided, the wave field renders
   * one arrow at each anchor INSTEAD of a grid — keeps swell arrows over
   * water (e.g. racing_area POI coords) rather than on land.
   */
  waterAnchors?: { lat: number; lng: number }[];
}

/**
 * Parse wave conditions into travel-to degrees + significant height (m).
 * Accepts the numeric pipe format "degrees|heightMeters" emitted by
 * useMarineSnapshot. Falls back to a flat 0m calm (renders nothing) when
 * nothing matches.
 */
export function parseWave(conditions?: string): { degrees: number; heightMeters: number } {
  if (!conditions) return { degrees: 0, heightMeters: 0 };
  const numericMatch = conditions.match(/^(\d+(?:\.\d+)?)\|(\d+(?:\.\d+)?)$/);
  if (numericMatch) {
    return { degrees: Number(numericMatch[1]), heightMeters: Number(numericMatch[2]) };
  }
  return { degrees: 0, heightMeters: 0 };
}

export function useWaveOverlay({
  centerLat,
  centerLng,
  conditionsLine,
  enabled = true,
  spacingKm = 2.5,
  gridSize = 3,
  waterAnchors,
}: UseWaveOverlayArgs): AtlasPinSpec[] {
  return useMemo(() => {
    if (!enabled) return [];
    const { degrees, heightMeters } = parseWave(conditionsLine);
    if (heightMeters < 0.05) return []; // calm — render nothing
    // degrees|heightMeters — swell convention is "set" (travel direction),
    // so the arrow renders pointing at degrees directly, no +180. The
    // canvas reads the second slot as metres for wave-arrow pins.
    const label = `${degrees}|${heightMeters}`;

    // Water-anchored mode: one arrow per provided anchor, offset ~250m in
    // the direction of travel so it doesn't sit under the racing-area POI.
    if (waterAnchors && waterAnchors.length > 0) {
      const offsetKm = 0.25;
      const rad = (degrees * Math.PI) / 180;
      const dLatKm = Math.cos(rad) * offsetKm;
      const dLngKm = Math.sin(rad) * offsetKm;
      return waterAnchors.map((a, idx) => {
        const dLat = dLatKm / 111;
        const dLng = dLngKm / (111 * Math.cos((a.lat * Math.PI) / 180));
        return {
          id: `wave-water:${idx}`,
          lat: a.lat + dLat,
          lng: a.lng + dLng,
          kind: 'wave-arrow' as const,
          label,
        };
      });
    }

    // Fallback grid, offset south of the wind/tide fields so the swell
    // channel reads separately. Field arrows use the `|field` suffix
    // (small indigo chevron, no chip); one primary at center carries the
    // readable "210° · 0.4m" chip.
    const fieldLabel = `${label}|field`;
    const out: AtlasPinSpec[] = [];
    const half = (gridSize - 1) / 2;
    const dLat = spacingKm / 111;
    const dLng = spacingKm / (111 * Math.cos((centerLat * Math.PI) / 180));
    const offsetLat = spacingKm / 222; // push south of wind/tide
    for (let i = 0; i < gridSize; i += 1) {
      for (let j = 0; j < gridSize; j += 1) {
        out.push({
          id: `wave:${i}-${j}`,
          lat: centerLat + offsetLat + (i - half) * dLat,
          lng: centerLng + (j - half) * dLng,
          kind: 'wave-arrow',
          label: fieldLabel,
        });
      }
    }
    out.push({
      id: 'wave:primary',
      lat: centerLat + offsetLat,
      lng: centerLng,
      kind: 'wave-arrow',
      label,
    });
    return out;
  }, [centerLat, centerLng, conditionsLine, enabled, spacingKm, gridSize, waterAnchors]);
}
