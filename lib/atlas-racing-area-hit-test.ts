/**
 * Ray-casting point-in-polygon for racing-area feature collections.
 * Pure JS so it works the same on native + web — avoids the
 * platform-divergent map.queryRenderedFeatures path.
 *
 * Limitations:
 *   - First-ring only (no hole support). Racing areas don't have
 *     holes in practice (rectangle / circle / hand-drawn convex
 *     shape), so this is fine.
 *   - Treats lng/lat as planar coordinates. At HK latitudes this
 *     introduces ≤0.3% error for sub-10km polygons; well under any
 *     tap-target tolerance.
 *
 * Returns the first matching feature when multiple polygons overlap
 * the tap point — callers can refine with a "smallest area" pass
 * if overlapping seed areas become a problem.
 */

import type { Feature, FeatureCollection, Polygon } from 'geojson';

import type { RacingAreaProperties } from '@/hooks/useAtlasRacingAreas';

function ringContains(ring: number[][], lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function findRacingAreaAtPoint(
  collection: FeatureCollection<Polygon, RacingAreaProperties>,
  lng: number,
  lat: number,
): Feature<Polygon, RacingAreaProperties> | null {
  for (const feature of collection.features) {
    const ring = feature.geometry.coordinates[0];
    if (!ring) continue;
    if (ringContains(ring, lng, lat)) return feature;
  }
  return null;
}
