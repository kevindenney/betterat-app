/**
 * useAtlasRacingAreas — fetches racing-area polygons from Supabase and
 * returns them as a MapLibre-ready FeatureCollection.
 *
 * Two row shapes coexist in venue_racing_areas:
 *   - Official seeds store a Point geometry + radius (no polygon yet).
 *   - User-defined community areas store center_lat/lng + radius_meters.
 *
 * Both render the same way here: if a real Polygon/MultiPolygon is in
 * `geometry`, use it directly; otherwise synthesize a circle polygon
 * from center + radius. Atlas deliberately does not fall back to bundled
 * geography here: race-area content must come from persisted user/org rows.
 *
 * When `userClasses` is non-empty, each feature is tagged with a
 * `fillOpacity` property that the canvas can read via a data-driven
 * paint expression: areas the user races in stay at 0.20, others dim
 * to 0.05 so the relevant water reads first. Areas with no class
 * metadata stay bright by default — generic places shouldn't be
 * punished for missing data.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Feature, FeatureCollection, Polygon } from 'geojson';

import { supabase } from '@/services/supabase';

export type RacingAreaSource = 'official' | 'community' | 'imported';

export interface RacingAreaProperties {
  id: string;
  name: string;
  venueId: string | null;
  source: RacingAreaSource;
  verificationStatus: 'pending' | 'verified' | 'disputed';
  classesUsed: string[];
  createdBy: string | null;
  /** Data-driven fill opacity — read by the MapLibre paint expression. */
  fillOpacity: number;
}

interface UseAtlasRacingAreasArgs {
  centerLat: number | null;
  centerLng: number | null;
  /** Half-side of the lat/lng bbox in km. Default 100. */
  radiusKm?: number;
  enabled?: boolean;
  /**
   * Boat classes the viewer races in. Areas whose `classes_used`
   * intersects this list keep the bright opacity; others dim. Pass
   * `[]` (or omit) to render every area at full brightness.
   */
  userClasses?: string[];
}

interface RawArea {
  id: string;
  area_name: string;
  venue_id: string | null;
  geometry: unknown;
  center_lat: number | null;
  center_lng: number | null;
  radius_meters: number | null;
  source: RacingAreaSource | null;
  verification_status: 'pending' | 'verified' | 'disputed' | null;
  classes_used: string[] | null;
  created_by: string | null;
  is_active: boolean | null;
}

const KM_PER_DEG_LAT = 111.32;
const CIRCLE_SEGMENTS = 48;
const OPACITY_BRIGHT = 0.20;
const OPACITY_DIM = 0.05;

function isPolygonGeometry(geom: unknown): geom is Polygon {
  if (!geom || typeof geom !== 'object') return false;
  const g = geom as { type?: string; coordinates?: unknown };
  return g.type === 'Polygon' && Array.isArray(g.coordinates);
}

function circlePolygon(
  centerLng: number,
  centerLat: number,
  radiusMeters: number,
): Polygon {
  const lngScale = Math.cos((centerLat * Math.PI) / 180) * KM_PER_DEG_LAT;
  const radiusKm = radiusMeters / 1000;
  const dLat = radiusKm / KM_PER_DEG_LAT;
  const dLng = lngScale > 0 ? radiusKm / lngScale : dLat;
  const ring: [number, number][] = [];
  for (let i = 0; i <= CIRCLE_SEGMENTS; i += 1) {
    const theta = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    ring.push([
      centerLng + Math.cos(theta) * dLng,
      centerLat + Math.sin(theta) * dLat,
    ]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

function classMatches(areaClass: string, userClassesLower: string[]): boolean {
  const a = areaClass.toLowerCase();
  // Bidirectional substring match — handles the "Dragon" vs
  // "International Dragon" naming gap: a sailor whose sailor_classes
  // row reads "International Dragon" should still light up areas
  // tagged simply "Dragon", and vice-versa.
  for (const u of userClassesLower) {
    if (a === u || a.includes(u) || u.includes(a)) return true;
  }
  return false;
}

function fillOpacityFor(classesUsed: string[], userClassesLower: string[]): number {
  if (userClassesLower.length === 0) return OPACITY_BRIGHT;
  if (classesUsed.length === 0) return OPACITY_BRIGHT;
  for (const c of classesUsed) {
    if (classMatches(c, userClassesLower)) return OPACITY_BRIGHT;
  }
  return OPACITY_DIM;
}

function toFeature(
  row: RawArea,
  userClassesLower: string[],
): Feature<Polygon, RacingAreaProperties> | null {
  let geometry: Polygon | null = null;
  if (isPolygonGeometry(row.geometry)) {
    geometry = row.geometry;
  } else if (
    row.center_lat != null &&
    row.center_lng != null &&
    row.radius_meters != null
  ) {
    geometry = circlePolygon(row.center_lng, row.center_lat, row.radius_meters);
  }
  if (!geometry) return null;
  const classesUsed = row.classes_used ?? [];
  return {
    type: 'Feature',
    geometry,
    properties: {
      id: row.id,
      name: row.area_name,
      venueId: row.venue_id,
      source: row.source ?? 'official',
      verificationStatus: row.verification_status ?? 'verified',
      classesUsed,
      createdBy: row.created_by,
      fillOpacity: fillOpacityFor(classesUsed, userClassesLower),
    },
  };
}

export function useAtlasRacingAreas({
  centerLat,
  centerLng,
  radiusKm = 100,
  enabled = true,
  userClasses,
}: UseAtlasRacingAreasArgs) {
  const queryEnabled =
    enabled && centerLat != null && centerLng != null && Number.isFinite(radiusKm);

  const query = useQuery({
    queryKey: ['atlas-racing-areas', centerLat, centerLng, radiusKm],
    enabled: queryEnabled,
    staleTime: 60_000,
    queryFn: async (): Promise<RawArea[]> => {
      if (centerLat == null || centerLng == null) return [];
      // No bbox filter for now: user-defined rows can store either polygon
      // geometry or center/radius. Global row count is small; full SELECT is
      // fine until we have a real spatial RPC. Require created_by so official
      // placeholder/seed geography does not leak into the Atlas lens.
      const { data, error } = await supabase
        .from('venue_racing_areas')
        .select(
          'id, area_name, venue_id, geometry, center_lat, center_lng, radius_meters, source, verification_status, classes_used, created_by, is_active',
        )
        .eq('is_active', true)
        .not('created_by', 'is', null);
      if (error) {
        console.warn('[atlas] venue_racing_areas fetch error', error);
        return [];
      }
      return (data ?? []) as RawArea[];
    },
  });

  const userClassesLower = useMemo(
    () => (userClasses ?? []).map((c) => c.toLowerCase()),
    [userClasses],
  );

  const featureCollection = useMemo<FeatureCollection<Polygon, RacingAreaProperties>>(() => {
    const rows = query.data ?? [];
    const features = rows
      .map((row) => toFeature(row, userClassesLower))
      .filter((f): f is Feature<Polygon, RacingAreaProperties> => f !== null);
    return { type: 'FeatureCollection', features };
  }, [query.data, userClassesLower]);

  return {
    featureCollection,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
