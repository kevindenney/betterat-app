/**
 * useVenueRacingAreas Hook
 * Fetches racing area geometry from atlas_pois (kind='racing_area' — the
 * single place primitive since the fold). The venue link and the sailing
 * specifics (area_type, classes_used, styling) live in `metadata`.
 * Also fetches race routes for distance/offshore races.
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

// ============================================
// TYPES
// ============================================

export interface RacingAreaGeometry {
  type: 'Point' | 'LineString' | 'Polygon';
  coordinates: number[] | number[][] | number[][][];
}

const logger = createLogger('useVenueRacingAreas');

export interface VenueRacingArea {
  id: string;
  venueId: string;
  areaName: string;
  areaType: 'racing_area' | 'start_line' | 'finish_line' | 'mark' | 'gate' | 'prohibited_zone' | 'practice_area' | 'spectator_zone' | 'safety_zone';
  geometry: RacingAreaGeometry;
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  fillOpacity: number;
  description?: string;
  typicalCourses?: string[];
  classesUsed?: string[];
  markName?: string;
  markType?: string;
  rounding?: 'port' | 'starboard' | 'either';
  restrictionReason?: string;
  penaltyForViolation?: string;
}

export type RaceRouteType = 'distance' | 'offshore' | 'coastal' | 'around_island' | 'feeder';

export interface RaceRoute {
  id: string;
  name: string;
  slug: string;
  raceType: RaceRouteType;
  startVenueId: string | null;
  finishVenueId: string | null;
  waypointVenues: string[] | null;
  routeGeometry?: object;
  typicalDistanceNm: number | null;
  recordTimeHours?: number | null;
  recordHolder?: string | null;
  recordYear?: number | null;
  description?: string;
  firstRunYear?: number | null;
  organizingClub?: string | null;
  website?: string | null;
  typicalMonth?: string | null;
  frequency?: 'annual' | 'biennial' | 'quadrennial' | 'irregular' | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Combined type for selector
export interface RacingAreaOrRoute {
  id: string;
  name: string;
  type: 'racing_area' | 'race_route';
  description?: string;
  distanceNm?: number | null;
}

export interface UseVenueRacingAreasResult {
  areas: VenueRacingArea[];
  racingAreas: VenueRacingArea[];
  marks: VenueRacingArea[];
  prohibitedZones: VenueRacingArea[];
  startFinishLines: VenueRacingArea[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch racing areas for a venue
 */
export function useVenueRacingAreas(venueId?: string): UseVenueRacingAreasResult {
  const [areas, setAreas] = useState<VenueRacingArea[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAreas = useCallback(async () => {
    if (!venueId) {
      setAreas([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('atlas_pois')
        .select('id, name, geometry, metadata')
        .eq('kind', 'racing_area')
        .eq('is_active', true)
        .eq('metadata->>venue_id', venueId)
        .order('name', { ascending: true });

      if (queryError) {
        throw new Error(queryError.message);
      }

      const transformedAreas: VenueRacingArea[] = (data || []).map((row: any) => {
        const meta = (row.metadata ?? {}) as Record<string, any>;
        return {
          id: row.id,
          venueId: meta.venue_id,
          areaName: row.name,
          areaType: meta.area_type ?? 'racing_area',
          geometry: row.geometry,
          strokeColor: meta.stroke_color || '#0284c7',
          strokeWidth: meta.stroke_width || 2,
          fillColor: meta.fill_color || '#0284c780',
          fillOpacity: meta.fill_opacity || 0.3,
          description: meta.description,
          typicalCourses: meta.typical_courses,
          classesUsed: meta.classes_used,
          markName: meta.mark_name,
          markType: meta.mark_type,
          rounding: meta.rounding,
          restrictionReason: meta.restriction_reason,
          penaltyForViolation: meta.penalty_for_violation,
        };
      });

      setAreas(transformedAreas);
    } catch (err: any) {
      logger.error('Error loading areas', err);
      setError(err.message || 'Failed to load racing areas');
    } finally {
      setIsLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    loadAreas();
  }, [loadAreas]);

  // Filter by type
  const racingAreas = areas.filter(a => a.areaType === 'racing_area' || a.areaType === 'practice_area');
  const marks = areas.filter(a => a.areaType === 'mark' || a.areaType === 'gate');
  const prohibitedZones = areas.filter(a => a.areaType === 'prohibited_zone');
  const startFinishLines = areas.filter(a => a.areaType === 'start_line' || a.areaType === 'finish_line');

  return {
    areas,
    racingAreas,
    marks,
    prohibitedZones,
    startFinishLines,
    isLoading,
    error,
    refresh: loadAreas,
  };
}

export default useVenueRacingAreas;

// ============================================
// RACE ROUTES HOOKS (React Query)
// ============================================

export const raceRouteKeys = {
  all: ['race-routes'] as const,
  byVenue: (venueId: string) => [...raceRouteKeys.all, 'venue', venueId] as const,
  detail: (routeId: string) => [...raceRouteKeys.all, 'detail', routeId] as const,
};

/**
 * Transform raw database row to RaceRoute
 */
function transformRaceRoute(row: any): RaceRoute {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    raceType: row.race_type,
    startVenueId: row.start_venue_id,
    finishVenueId: row.finish_venue_id,
    waypointVenues: row.waypoint_venues,
    routeGeometry: row.route_geometry,
    typicalDistanceNm: row.typical_distance_nm,
    recordTimeHours: row.record_time_hours,
    recordHolder: row.record_holder,
    recordYear: row.record_year,
    description: row.description,
    firstRunYear: row.first_run_year,
    organizingClub: row.organizing_club,
    website: row.website,
    typicalMonth: row.typical_month,
    frequency: row.frequency,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetch race routes starting from a venue
 */
export function useVenueRaceRoutes(venueId: string | undefined) {
  return useQuery({
    queryKey: raceRouteKeys.byVenue(venueId || ''),
    queryFn: async () => {
      if (!venueId) return [];
      const { data, error } = await supabase
        .from('race_routes')
        .select('*')
        .eq('start_venue_id', venueId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data || []).map(transformRaceRoute);
    },
    enabled: !!venueId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch a single race route by ID
 */
export function useRaceRoute(routeId: string | undefined) {
  return useQuery({
    queryKey: raceRouteKeys.detail(routeId || ''),
    queryFn: async () => {
      if (!routeId) return null;
      const { data, error } = await supabase
        .from('race_routes')
        .select('*')
        .eq('id', routeId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data ? transformRaceRoute(data) : null;
    },
    enabled: !!routeId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Combined hook to get both racing areas and race routes for a venue
 * Returns a unified list for the RacingAreaSelector
 */
export function useVenueRacingAreasAndRoutes(venueId: string | undefined) {
  const { areas, racingAreas, isLoading: areasLoading, error: areasError, refresh } = useVenueRacingAreas(venueId);
  const routesQuery = useVenueRaceRoutes(venueId);

  const isLoading = areasLoading || routesQuery.isLoading;
  const error = areasError || (routesQuery.error ? String(routesQuery.error) : null);

  // Combine into unified format for selector
  const items: RacingAreaOrRoute[] = [
    ...racingAreas.map((area) => ({
      id: area.id,
      name: area.areaName,
      type: 'racing_area' as const,
      description: area.description,
    })),
    ...(routesQuery.data?.map((route) => ({
      id: route.id,
      name: route.name,
      type: 'race_route' as const,
      description: route.description,
      distanceNm: route.typicalDistanceNm,
    })) || []),
  ];

  return {
    items,
    racingAreas,
    raceRoutes: routesQuery.data || [],
    allAreas: areas, // Include all area types (marks, lines, etc.)
    isLoading,
    error,
    refetch: () => {
      refresh();
      routesQuery.refetch();
    },
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get display label for a racing area or race route
 */
export function getRacingAreaLabel(item: RacingAreaOrRoute): string {
  if (item.type === 'race_route' && item.distanceNm) {
    return `${item.name} (${item.distanceNm}nm)`;
  }
  return item.name;
}

/**
 * Get icon for racing area type
 */
export function getRacingAreaIcon(type: 'racing_area' | 'race_route'): string {
  return type === 'racing_area' ? 'water-outline' : 'navigate-outline';
}

/**
 * Get race type display label
 */
export function getRaceTypeLabel(type: RaceRouteType): string {
  const labels: Record<RaceRouteType, string> = {
    distance: 'Distance Race',
    offshore: 'Offshore Race',
    coastal: 'Coastal Race',
    around_island: 'Around the Island',
    feeder: 'Feeder Race',
  };
  return labels[type];
}
