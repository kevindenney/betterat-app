/**
 * useVenueCoordinates Hook
 *
 * Computes venue coordinates from race data using multiple fallback sources.
 * Returns coordinates for weather lookups and map centering.
 */

import { useMemo } from 'react';

export interface VenueCoordinates {
  lat: number;
  lng: number;
}

export interface RaceDataForCoordinates {
  metadata?: {
    venue_lat?: number;
    venue_lng?: number;
    racing_area_coordinates?: { lat?: number; lng?: number };
    venue_coordinates?: { lat?: number; lng?: number };
  };
  route_waypoints?: {
    latitude?: number;
    longitude?: number;
  }[];
  racing_area_polygon?: {
    coordinates?: number[][][];
  };
}

export interface UseVenueCoordinatesParams {
  /** Selected race data */
  selectedRaceData: RaceDataForCoordinates | null;
  /** Drawing racing area polygon points */
  drawingRacingArea: { lat: number; lng: number }[];
}

export interface UseVenueCoordinatesReturn {
  /** Computed venue coordinates or undefined if none found */
  venueCoordinates: VenueCoordinates | undefined;
}

/**
 * Hook for computing venue coordinates from race data
 *
 * Coordinate priority:
 * 1. Explicit venue_lat/venue_lng
 * 2. racing_area_coordinates
 * 3. venue_coordinates
 * 4. route_waypoints centroid (distance racing)
 * 5. Currently drawing racing area centroid
 * 6. Saved racing_area_polygon centroid
 */
export function useVenueCoordinates({
  selectedRaceData,
  drawingRacingArea,
}: UseVenueCoordinatesParams): UseVenueCoordinatesReturn {
  const venueCoordinates = useMemo<VenueCoordinates | undefined>(() => {
    // 1. First check explicit venue_lat/venue_lng
    if (selectedRaceData?.metadata?.venue_lat && selectedRaceData?.metadata?.venue_lng) {
      return {
        lat: selectedRaceData.metadata.venue_lat,
        lng: selectedRaceData.metadata.venue_lng,
      };
    }

    // 2. Check racing_area_coordinates (common format from race creation)
    const racingAreaCoords = selectedRaceData?.metadata?.racing_area_coordinates;
    if (racingAreaCoords?.lat && racingAreaCoords?.lng) {
      return {
        lat: racingAreaCoords.lat,
        lng: racingAreaCoords.lng,
      };
    }

    // 3. Check venue_coordinates (alternate format)
    const venueCoords = selectedRaceData?.metadata?.venue_coordinates;
    if (venueCoords?.lat && venueCoords?.lng) {
      return {
        lat: venueCoords.lat,
        lng: venueCoords.lng,
      };
    }

    // 4. Check route_waypoints (distance racing) - use first waypoint or centroid
    const waypoints = selectedRaceData?.route_waypoints;
    if (Array.isArray(waypoints) && waypoints.length > 0) {
      // Filter to waypoints with valid coordinates
      const validWaypoints = waypoints.filter(
        (wp) => typeof wp.latitude === 'number' && typeof wp.longitude === 'number'
      );
      if (validWaypoints.length > 0) {
        // Use centroid of all waypoints for weather (covers the race area)
        const lat = validWaypoints.reduce((sum, wp) => sum + (wp.latitude ?? 0), 0) / validWaypoints.length;
        const lng = validWaypoints.reduce((sum, wp) => sum + (wp.longitude ?? 0), 0) / validWaypoints.length;
        return { lat, lng };
      }
    }

    // 5. Check currently drawing racing area
    if (drawingRacingArea.length > 0) {
      const lat = drawingRacingArea.reduce((sum, point) => sum + point.lat, 0) / drawingRacingArea.length;
      const lng = drawingRacingArea.reduce((sum, point) => sum + point.lng, 0) / drawingRacingArea.length;
      return { lat, lng };
    }

    // 6. Calculate centroid from saved racing_area_polygon
    const polygon = selectedRaceData?.racing_area_polygon?.coordinates?.[0];
    if (Array.isArray(polygon) && polygon.length > 0) {
      const coords = polygon
        .filter((coord): coord is number[] => Array.isArray(coord) && coord.length >= 2)
        .map((coord) => ({ lat: coord[1], lng: coord[0] }));
      if (coords.length > 0) {
        const lat = coords.reduce((sum, point) => sum + point.lat, 0) / coords.length;
        const lng = coords.reduce((sum, point) => sum + point.lng, 0) / coords.length;
        return { lat, lng };
      }
    }

    // 7. No coordinates found - return undefined (don't fallback to default coords)
    return undefined;
  }, [drawingRacingArea, selectedRaceData]);

  return {
    venueCoordinates,
  };
}

export default useVenueCoordinates;
