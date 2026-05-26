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
 * from center + radius. Falls back to the bundled fixture on
 * error/empty so the Atlas tab still shows something offline.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Feature, FeatureCollection, Polygon } from 'geojson';

import { supabase } from '@/services/supabase';
import { RACE_AREAS_GEOJSON } from '@/lib/atlas-race-areas';

export type RacingAreaSource = 'official' | 'community' | 'imported';

export interface RacingAreaProperties {
  id: string;
  name: string;
  source: RacingAreaSource;
  verificationStatus: 'pending' | 'verified' | 'disputed';
  classesUsed: string[];
  createdBy: string | null;
}

interface UseAtlasRacingAreasArgs {
  centerLat: number | null;
  centerLng: number | null;
  /** Half-side of the lat/lng bbox in km. Default 100. */
  radiusKm?: number;
  enabled?: boolean;
}

interface RawArea {
  id: string;
  area_name: string;
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

function toFeature(row: RawArea): Feature<Polygon, RacingAreaProperties> | null {
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
  return {
    type: 'Feature',
    geometry,
    properties: {
      id: row.id,
      name: row.area_name,
      source: row.source ?? 'official',
      verificationStatus: row.verification_status ?? 'verified',
      classesUsed: row.classes_used ?? [],
      createdBy: row.created_by,
    },
  };
}

export function useAtlasRacingAreas({
  centerLat,
  centerLng,
  radiusKm = 100,
  enabled = true,
}: UseAtlasRacingAreasArgs) {
  const queryEnabled =
    enabled && centerLat != null && centerLng != null && Number.isFinite(radiusKm);

  const query = useQuery({
    queryKey: ['atlas-racing-areas', centerLat, centerLng, radiusKm],
    enabled: queryEnabled,
    staleTime: 60_000,
    queryFn: async (): Promise<RawArea[]> => {
      if (centerLat == null || centerLng == null) return [];
      const dLat = radiusKm / KM_PER_DEG_LAT;
      const lngScale = Math.cos((centerLat * Math.PI) / 180) * KM_PER_DEG_LAT;
      const dLng = lngScale > 0 ? radiusKm / lngScale : dLat;
      const { data, error } = await supabase
        .from('venue_racing_areas')
        .select(
          'id, area_name, geometry, center_lat, center_lng, radius_meters, source, verification_status, classes_used, created_by, is_active',
        )
        .eq('is_active', true)
        .gte('center_lat', centerLat - dLat)
        .lte('center_lat', centerLat + dLat)
        .gte('center_lng', centerLng - dLng)
        .lte('center_lng', centerLng + dLng);
      if (error) {
        console.warn('[atlas] venue_racing_areas fetch error', error);
        return [];
      }
      return (data ?? []) as RawArea[];
    },
  });

  const featureCollection = useMemo<FeatureCollection<Polygon, RacingAreaProperties>>(() => {
    const rows = query.data ?? [];
    const features = rows
      .map(toFeature)
      .filter((f): f is Feature<Polygon, RacingAreaProperties> => f !== null);
    if (features.length === 0) {
      return {
        type: 'FeatureCollection',
        features: RACE_AREAS_GEOJSON.features.map((f, i) => ({
          type: 'Feature' as const,
          geometry: f.geometry,
          properties: {
            id: `fixture-${i}`,
            name: (f.properties as { name?: string } | null)?.name ?? 'Racing area',
            source: 'official' as const,
            verificationStatus: 'verified' as const,
            classesUsed: [],
            createdBy: null,
          },
        })),
      };
    }
    return { type: 'FeatureCollection', features };
  }, [query.data]);

  return {
    featureCollection,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
