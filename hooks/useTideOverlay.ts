/**
 * useTideOverlay — sibling to useWindOverlay. Renders a soft directional
 * field for tidal current at the F1 frame, distinct from wind by color
 * (teal) and convention (current is "set" — arrow points the direction
 * water FLOWS, not where it comes from like wind).
 *
 * For Victoria Harbour the conventional defaults:
 *   • Ebb flows east toward Tathong Channel → set 90°
 *   • Flood flows west back into the bay → set 270°
 *
 * Sourcing: parses the next event's conditions string for "ebb" / "flood"
 * + speed (e.g. "ebb 0.4kn"). Falls back to ebb 0.5kn so demo always
 * renders. Real tide data would come from Storm Glass or a server-side
 * tide table tied to the event's venue + start time.
 *
 * The grid is offset 6 cells in lng (~7km eastward at this latitude) from
 * wind so the two fields don't pile on top of each other and read as
 * separate channels.
 */

import { useMemo } from 'react';
import type { AtlasPinSpec } from '@/components/ios-register/atlas/AtlasMapLibreCanvas';

interface UseTideOverlayArgs {
  centerLat: number;
  centerLng: number;
  /** Conditions string from useAtlasNextEvent — e.g. "12kn ESE · ebb 0.4kn". */
  conditionsLine?: string;
  enabled?: boolean;
  /** Grid spacing in km. Default 2.5. */
  spacingKm?: number;
  /** Grid side length (n × n). Default 3. */
  gridSize?: number;
  /**
   * Water-anchored arrow positions. When provided, the tide field renders
   * one arrow at each anchor INSTEAD of a grid — this prevents tide arrows
   * appearing on land (e.g. mid-Kowloon) which is geographically wrong for
   * a current overlay. Anchor list is typically the visible racing_area
   * POI coords.
   */
  waterAnchors?: { lat: number; lng: number }[];
}

/**
 * Parse "ebb 0.4kn" / "flood 0.6 kt" / "tide: slack" → set degrees + knots.
 * Returns null when the conditions string has no tide reference at all so
 * the caller can decide whether to render the demo default or skip.
 */
export function parseTide(conditions?: string): { setDegrees: number; knots: number } {
  if (!conditions) return { setDegrees: 90, knots: 0.5 }; // demo: ebb
  const upper = conditions.toUpperCase();
  let setDegrees = 90;
  let knots = 0.5;
  if (/\bFLOOD\b/.test(upper)) setDegrees = 270;
  else if (/\bSLACK\b/.test(upper)) {
    setDegrees = 90;
    knots = 0;
  }
  // Knots after ebb/flood/slack token, ignore "kn" attached to wind speed
  const m = upper.match(/(?:EBB|FLOOD|SLACK)[^0-9]{0,8}(\d+(?:\.\d+)?)/);
  if (m) knots = Number(m[1]);
  return { setDegrees, knots };
}

export function useTideOverlay({
  centerLat,
  centerLng,
  conditionsLine,
  enabled = true,
  spacingKm = 2.5,
  gridSize = 3,
  waterAnchors,
}: UseTideOverlayArgs): AtlasPinSpec[] {
  return useMemo(() => {
    if (!enabled) return [];
    const { setDegrees, knots } = parseTide(conditionsLine);
    if (knots === 0) return []; // slack — render nothing
    // setDegrees|knots — tide convention is "set" (flow direction),
    // so the arrow renders pointing at setDegrees directly, no +180.
    const label = `${setDegrees}|${knots}`;

    // Water-anchored mode: one arrow per provided anchor. Skips grid.
    if (waterAnchors && waterAnchors.length > 0) {
      return waterAnchors.map((a, idx) => ({
        id: `tide-water:${idx}`,
        lat: a.lat,
        lng: a.lng,
        kind: 'tide-arrow' as const,
        label,
      }));
    }

    // Fallback grid (legacy demo path — places arrows around centerLat/Lng).
    const out: AtlasPinSpec[] = [];
    const half = (gridSize - 1) / 2;
    const dLat = spacingKm / 111;
    const dLng = spacingKm / (111 * Math.cos((centerLat * Math.PI) / 180));
    const offsetLat = -spacingKm / 222;
    for (let i = 0; i < gridSize; i += 1) {
      for (let j = 0; j < gridSize; j += 1) {
        out.push({
          id: `tide:${i}-${j}`,
          lat: centerLat + offsetLat + (i - half) * dLat,
          lng: centerLng + (j - half) * dLng,
          kind: 'tide-arrow',
          label,
        });
      }
    }
    return out;
  }, [centerLat, centerLng, conditionsLine, enabled, spacingKm, gridSize, waterAnchors]);
}
