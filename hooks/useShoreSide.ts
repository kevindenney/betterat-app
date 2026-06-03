/**
 * useShoreSide — resolve which side of the beat (looking upwind) the shore /
 * shoaling water is on, from GEBCO bathymetry. Feeds deriveCourseStrategy's
 * optional `shoreSide` so the upwind summary can add a "watch the X shore for
 * bend + current relief" note when there's clearly land on one side.
 *
 * Method: sample seabed elevation at a few points perpendicular to the wind
 * axis — "left" = bearing wind−90, "right" = wind+90 (same convention as
 * courseStrategy). The shallower side is the shore side, but only when it's
 * genuinely shoaling AND clearly shallower than the other; open water both
 * sides → undefined (no note).
 *
 * Elevation sign (GEBCO): negative = depth below sea level, ~0 / positive =
 * land. So a *higher* (less negative) average means shallower / closer to shore.
 */
import { useEffect, useRef, useState } from 'react';

import { BathymetryService } from '@/services/weather/BathymetryService';
import { destinationPoint } from '@/services/CoursePositioningService';

interface UseShoreSideParams {
  centerLat: number;
  centerLng: number;
  /** Direction the wind blows FROM, degrees. */
  windDirection: number;
  enabled?: boolean;
}

/** Offsets (nm) perpendicular to the beat where we probe the seabed each side. */
const SAMPLE_DISTANCES_NM = [0.3, 0.6];
/**
 * The shallower side only counts as "shore" if its mean seabed is within this
 * many metres of the surface — open deep water both sides shouldn't trigger a
 * shore note.
 */
const SHORE_MAX_DEPTH_M = 12;
/** …and it must be at least this much shallower than the other side. */
const SHORE_MIN_DELTA_M = 6;

export function useShoreSide({
  centerLat,
  centerLng,
  windDirection,
  enabled = true,
}: UseShoreSideParams): 'left' | 'right' | undefined {
  const [shoreSide, setShoreSide] = useState<'left' | 'right' | undefined>(undefined);
  const runIdRef = useRef(0);

  // Round so small map pans reuse the same probe (and the service cache).
  const keyLat = Math.round(centerLat * 100) / 100;
  const keyLng = Math.round(centerLng * 100) / 100;
  const keyWind = Math.round(windDirection / 10) * 10;

  useEffect(() => {
    if (!enabled || !Number.isFinite(keyLat) || !Number.isFinite(keyLng)) {
      setShoreSide(undefined);
      return;
    }
    const runId = ++runIdRef.current;
    const leftBearing = (keyWind - 90 + 360) % 360;
    const rightBearing = (keyWind + 90) % 360;
    const leftPts = SAMPLE_DISTANCES_NM.map((d) => destinationPoint(keyLat, keyLng, leftBearing, d));
    const rightPts = SAMPLE_DISTANCES_NM.map((d) => destinationPoint(keyLat, keyLng, rightBearing, d));
    const locations = [...leftPts, ...rightPts].map((p) => ({ latitude: p.lat, longitude: p.lng }));

    void BathymetryService.getInstance()
      .getElevationsBatch(locations)
      .then((results) => {
        if (runId !== runIdRef.current) return;
        if (results.length < locations.length) {
          setShoreSide(undefined);
          return;
        }
        const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
        const leftElev = mean(results.slice(0, leftPts.length).map((r) => r.elevation));
        const rightElev = mean(results.slice(leftPts.length).map((r) => r.elevation));
        // Higher elevation (less negative) = shallower = shore.
        const shallower = leftElev >= rightElev ? 'left' : 'right';
        const shallowElev = Math.max(leftElev, rightElev);
        const delta = Math.abs(leftElev - rightElev);
        // depth = -elevation for water; land has elevation ≥ 0 → depth ≤ 0.
        const shallowDepth = -shallowElev;
        if (shallowDepth <= SHORE_MAX_DEPTH_M && delta >= SHORE_MIN_DELTA_M) {
          setShoreSide(shallower);
        } else {
          setShoreSide(undefined);
        }
      })
      .catch(() => {
        if (runId !== runIdRef.current) return;
        setShoreSide(undefined);
      });
  }, [enabled, keyLat, keyLng, keyWind]);

  return shoreSide;
}
