/**
 * useCoachContext Hook
 *
 * Builds the context object for AI coach interactions.
 * Combines race data, weather, position, and boat info.
 */

import { useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface RaceCourse {
  startLine?: {
    heading?: number;
    centerLat?: number;
    centerLon?: number;
  };
  marks?: {
    name: string;
    type: string;
    position?: { lat?: number; lng?: number };
  }[];
}

export interface WeatherData {
  wind?: unknown;
  current?: unknown;
}

export interface TideSnapshot {
  height: number;
  trend: string;
  rate: number;
  range: number;
}

export interface VenueCenter {
  latitude: number;
  longitude: number;
}

export interface GPSPosition {
  latitude?: number;
  longitude?: number;
  speed?: number;
  heading?: number;
}

export interface UseCoachContextParams {
  /** Selected race ID */
  selectedRaceId: string | null;
  /** Selected race data with metadata */
  selectedRaceData: {
    start_date?: string;
    fleet_size?: number;
    fleetSize?: number;
    venue_name?: string;
    metadata?: Record<string, unknown>;
  } | null;
  /** Computed race course */
  raceCourseForConsole: RaceCourse | null;
  /** Weather data for selected race */
  selectedRaceWeather: WeatherData | null;
  /** Tide snapshot */
  tideSnapshot: TideSnapshot | null;
  /** Venue center coordinates */
  venueCenter: VenueCenter | null;
  /** Current GPS position */
  gpsPosition: GPSPosition | null;
  /** Boat length value */
  boatLengthValue: number | null;
  /** Effective draft value */
  effectiveDraft: number;
}

export interface CoachContext {
  race_id?: string;
  date_time?: string;
  startTime?: string;
  fleet_size?: number;
  course?: RaceCourse | null;
  marks?: RaceCourse['marks'];
  weather?: WeatherData | null;
  wind?: unknown;
  current?: unknown;
  tidal?: TideSnapshot | null;
  tidalIntel?: TideSnapshot | null;
  location?: {
    name: string;
    latitude: number;
    longitude: number;
  };
  position?: {
    lat: number;
    lon: number;
    speed?: number;
    heading?: number;
  };
  boat: {
    length?: number;
    draft: number;
  };
}

export interface UseCoachContextReturn {
  /** Coach context object for AI interactions */
  coachContext: CoachContext;
}

/**
 * Hook for building coach context
 */
export function useCoachContext({
  selectedRaceId,
  selectedRaceData,
  raceCourseForConsole,
  selectedRaceWeather,
  tideSnapshot,
  venueCenter,
  gpsPosition,
  boatLengthValue,
  effectiveDraft,
}: UseCoachContextParams): UseCoachContextReturn {
  const coachContext = useMemo((): CoachContext => {
    const metadata = (selectedRaceData?.metadata || {}) as Record<string, unknown>;
    return {
      race_id: selectedRaceId ?? undefined,
      date_time: selectedRaceData?.start_date,
      startTime: selectedRaceData?.start_date,
      fleet_size:
        (metadata.fleet_size as number | undefined) ??
        (metadata.fleetSize as number | undefined) ??
        selectedRaceData?.fleet_size ??
        selectedRaceData?.fleetSize,
      course: raceCourseForConsole,
      marks: raceCourseForConsole?.marks,
      weather: selectedRaceWeather,
      wind: selectedRaceWeather?.wind,
      current: selectedRaceWeather?.current,
      tidal: tideSnapshot,
      tidalIntel: tideSnapshot,
      location: venueCenter
        ? {
            name:
              (metadata?.venue_name as string | undefined) ??
              selectedRaceData?.venue_name ??
              (selectedRaceData?.metadata?.venue_name as string | undefined) ??
              'Race Venue',
            ...venueCenter,
          }
        : undefined,
      position: gpsPosition
        ? {
            lat: gpsPosition.latitude!,
            lon: gpsPosition.longitude!,
            speed: typeof gpsPosition.speed === 'number' ? gpsPosition.speed : undefined,
            heading: typeof gpsPosition.heading === 'number' ? gpsPosition.heading : undefined,
          }
        : undefined,
      boat: {
        length: boatLengthValue ?? undefined,
        draft: effectiveDraft,
      },
    };
  }, [
    selectedRaceId,
    selectedRaceData,
    raceCourseForConsole,
    selectedRaceWeather,
    tideSnapshot,
    venueCenter,
    gpsPosition,
    boatLengthValue,
    effectiveDraft,
  ]);

  return { coachContext };
}

export default useCoachContext;
