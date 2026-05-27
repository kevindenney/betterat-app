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
  /**
   * Tide time-slider offset in hours from "now" (0–6). When provided,
   * overrides the parsed conditions to simulate the standard semi-diurnal
   * cycle:
   *   0–2h  → ebb tapering from 0.5kn → slack
   *   3h    → slack (renders no arrows)
   *   4–6h  → flood building from slack → 0.5kn
   * Real Storm Glass per-event tides land in a follow-up; this gets the
   * "scrub to start" UX shipped against a believable demo cycle.
   */
  offsetHours?: number;
}

/**
 * Project a time-offset (hours from now) onto the standard semi-diurnal
 * tide cycle for the demo. Returns {setDegrees, knots} matching parseTide's
 * shape so consumers can swap interchangeably.
 *
 * Cycle assumption: ebb at T+0 fading to slack at T+3, then flood building
 * to T+6. Linear ramp between markers; real tide data replaces this with
 * Storm Glass per-event tables.
 */
export function tideAtOffset(hours: number): { setDegrees: number; knots: number } {
  const h = Math.max(0, Math.min(6, hours));
  if (h < 3) {
    // ebb tapering: 0.5kn at T+0 → 0 at T+3
    return { setDegrees: 90, knots: 0.5 * (1 - h / 3) };
  }
  if (h === 3) return { setDegrees: 90, knots: 0 };
  // flood building: 0 at T+3 → 0.5kn at T+6
  return { setDegrees: 270, knots: 0.5 * ((h - 3) / 3) };
}

/**
 * Parse tide / ocean-current conditions into set degrees + knots.
 * Accepts two formats:
 *   - Natural language: "ebb 0.4kn" / "flood 0.6 kt" / "tide: slack"
 *   - Numeric pipe (from useMarineSnapshot's conditionsLineFor):
 *     "120|0.4" (setDegrees|knots)
 *
 * The numeric-pipe fast-path is load-bearing — without it, Open-Meteo
 * ocean-current data falls through to the ebb-90°/0.5kn demo default
 * and every tide overlay reads as static. Mirror of useWindOverlay's
 * parseWind fix.
 */
export function parseTide(conditions?: string): { setDegrees: number; knots: number } {
  if (!conditions) return { setDegrees: 90, knots: 0.5 }; // demo: ebb
  // Fast path: degrees|knots numeric format emitted by useMarineSnapshot.
  const numericMatch = conditions.match(/^(\d+(?:\.\d+)?)\|(\d+(?:\.\d+)?)$/);
  if (numericMatch) {
    return { setDegrees: Number(numericMatch[1]), knots: Number(numericMatch[2]) };
  }
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
  offsetHours,
}: UseTideOverlayArgs): AtlasPinSpec[] {
  return useMemo(() => {
    if (!enabled) return [];
    const { setDegrees, knots } =
      typeof offsetHours === 'number'
        ? tideAtOffset(offsetHours)
        : parseTide(conditionsLine);
    if (knots < 0.05) return []; // slack — render nothing
    // setDegrees|knots — tide convention is "set" (flow direction),
    // so the arrow renders pointing at setDegrees directly, no +180.
    const label = `${setDegrees}|${knots}`;

    // Water-anchored mode: one arrow per provided anchor. Skips grid.
    // Each arrow is offset ~250m in the direction of flow (setDegrees)
    // so it doesn't sit directly under the racing-area POI pin — reads
    // as "current flowing AWAY from this venue" rather than a duplicate
    // pin at the same coords.
    if (waterAnchors && waterAnchors.length > 0) {
      const offsetKm = 0.25;
      const setRad = (setDegrees * Math.PI) / 180;
      // Compass bearing → lat/lng delta. North = +lat. East = +lng.
      const dLatKm = Math.cos(setRad) * offsetKm;
      const dLngKm = Math.sin(setRad) * offsetKm;
      return waterAnchors.map((a, idx) => {
        const dLat = dLatKm / 111;
        const dLng = dLngKm / (111 * Math.cos((a.lat * Math.PI) / 180));
        return {
          id: `tide-water:${idx}`,
          lat: a.lat + dLat,
          lng: a.lng + dLng,
          kind: 'tide-arrow' as const,
          label,
        };
      });
    }

    // Fallback grid — soft surface treatment via the `|field` label
    // suffix so each arrow renders as a small slate-teal chevron with
    // no per-arrow knot chip. Plus one primary at the center with the
    // full "120° · 0.4 kn" chip so the user has a readable indicator.
    const fieldLabel = `${label}|field`;
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
          label: fieldLabel,
        });
      }
    }
    out.push({
      id: 'tide:primary',
      lat: centerLat + offsetLat,
      lng: centerLng,
      kind: 'tide-arrow',
      label,
    });
    return out;
  }, [centerLat, centerLng, conditionsLine, enabled, spacingKm, gridSize, waterAnchors, offsetHours]);
}
