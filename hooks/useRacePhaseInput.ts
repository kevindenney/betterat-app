/**
 * useRacePhaseInput Hook
 *
 * Prepares input data for race phase detection.
 * Converts race course marks to phase detection format.
 */

import { useMemo, MutableRefObject } from 'react';

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

export interface GPSPosition {
  latitude?: number;
  longitude?: number;
  heading?: number;
}

export interface FallbackPosition {
  latitude: number;
  longitude: number;
  heading?: number;
}

export interface PhaseDetectionMark {
  name: string;
  type: 'start' | 'windward' | 'leeward' | 'jibe' | 'finish';
  coordinates: { lat: number; lon: number };
}

export interface RacePhaseInput {
  startTime?: string;
  currentPosition?: { lat: number; lon: number };
  course: RaceCourse | null;
  marks: PhaseDetectionMark[];
  heading?: number;
  speed?: number;
}

export interface UseRacePhaseInputParams {
  /** Race course data */
  raceCourseForConsole: RaceCourse | null;
  /** Selected race data with start date */
  selectedRaceData: { start_date?: string } | null;
  /** Current GPS position */
  gpsPosition: GPSPosition | null;
  /** Fallback position when GPS unavailable */
  fallbackPosition: FallbackPosition | null;
  /** Ref to last known heading */
  lastHeadingRef: MutableRefObject<number | null>;
  /** Current boat speed in knots */
  boatSpeedKnots: number | null | undefined;
}

export interface UseRacePhaseInputReturn {
  /** Marks formatted for phase detection */
  phaseDetectionMarks: PhaseDetectionMark[];
  /** Complete input for race phase detection */
  racePhaseInput: RacePhaseInput;
}

/**
 * Hook for preparing race phase detection input
 */
export function useRacePhaseInput({
  raceCourseForConsole,
  selectedRaceData,
  gpsPosition,
  fallbackPosition,
  lastHeadingRef,
  boatSpeedKnots,
}: UseRacePhaseInputParams): UseRacePhaseInputReturn {
  // Convert course marks to phase detection format
  const phaseDetectionMarks = useMemo((): PhaseDetectionMark[] => {
    const marks: PhaseDetectionMark[] = [];

    if (raceCourseForConsole?.startLine) {
      marks.push({
        name: 'Start Line',
        type: 'start',
        coordinates: {
          lat: raceCourseForConsole.startLine.centerLat!,
          lon: raceCourseForConsole.startLine.centerLon!,
        },
      });
    }

    for (const mark of raceCourseForConsole?.marks ?? []) {
      const lat = mark.position?.lat;
      const lon = mark.position?.lng;
      if (typeof lat !== 'number' || typeof lon !== 'number') {
        continue;
      }

      let type: PhaseDetectionMark['type'] = 'windward';
      switch (mark.type) {
        case 'start-boat':
        case 'start-pin':
          type = 'start';
          break;
        case 'leeward':
          type = 'leeward';
          break;
        case 'offset':
          type = 'jibe';
          break;
        case 'finish':
          type = 'finish';
          break;
        default:
          type = 'windward';
      }

      marks.push({
        name: mark.name,
        type,
        coordinates: { lat, lon },
      });
    }

    return marks;
  }, [raceCourseForConsole]);

  // Build complete input for phase detection
  const racePhaseInput = useMemo((): RacePhaseInput => {
    const currentPosition = gpsPosition
      ? {
          lat: gpsPosition.latitude!,
          lon: gpsPosition.longitude!,
        }
      : fallbackPosition
        ? {
            lat: fallbackPosition.latitude,
            lon: fallbackPosition.longitude,
          }
        : undefined;

    return {
      startTime: selectedRaceData?.start_date,
      currentPosition,
      course: raceCourseForConsole,
      marks: phaseDetectionMarks,
      heading: gpsPosition?.heading ?? lastHeadingRef.current ?? undefined,
      speed: boatSpeedKnots ?? undefined,
    };
  }, [
    selectedRaceData?.start_date,
    gpsPosition,
    fallbackPosition,
    raceCourseForConsole,
    phaseDetectionMarks,
    lastHeadingRef,
    boatSpeedKnots,
  ]);

  return {
    phaseDetectionMarks,
    racePhaseInput,
  };
}

export default useRacePhaseInput;
