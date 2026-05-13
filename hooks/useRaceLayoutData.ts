/**
 * useRaceLayoutData Hook
 *
 * Computes derived layout data for race UI components.
 * Includes course heading, wind/current data, and VHF channel.
 */

import { useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface RaceCourse {
  legs?: { heading?: number }[];
  startLine?: { heading?: number };
}

export interface WindSnapshot {
  speed?: number;
  direction?: number;
  gust?: number;
}

export interface CurrentSnapshot {
  speed?: number;
  direction?: number;
  type?: string;
}

export interface LayoutWindData {
  speed?: number;
  direction?: number;
  gust?: number;
}

export interface LayoutCurrentData {
  speed?: number;
  direction?: number;
  type?: string;
}

export interface UseRaceLayoutDataParams {
  /** Race course data */
  raceCourseForConsole: RaceCourse | null;
  /** Wind snapshot */
  windSnapshot: WindSnapshot | null;
  /** Current snapshot */
  currentSnapshot: CurrentSnapshot | null;
  /** Selected race data with metadata */
  selectedRaceData: {
    vhf_channel?: string;
    critical_details?: { vhf_channel?: string };
    metadata?: Record<string, unknown>;
  } | null;
}

export interface UseRaceLayoutDataReturn {
  /** Course heading from first leg or start line */
  courseHeading: number | undefined;
  /** Wind data formatted for layout */
  layoutWindData: LayoutWindData | undefined;
  /** Current data formatted for layout */
  layoutCurrentData: LayoutCurrentData | undefined;
  /** VHF channel for race communications */
  vhfChannel: string | null;
}

/**
 * Hook for computing race layout data
 */
export function useRaceLayoutData({
  raceCourseForConsole,
  windSnapshot,
  currentSnapshot,
  selectedRaceData,
}: UseRaceLayoutDataParams): UseRaceLayoutDataReturn {
  // Extract course heading from first leg or start line
  const courseHeading = useMemo((): number | undefined => {
    if (!raceCourseForConsole) return undefined;
    if (raceCourseForConsole.legs && raceCourseForConsole.legs.length > 0) {
      return raceCourseForConsole.legs[0].heading;
    }
    return raceCourseForConsole.startLine?.heading;
  }, [raceCourseForConsole]);

  // Format wind data for layout
  const layoutWindData = useMemo((): LayoutWindData | undefined => {
    if (!windSnapshot) return undefined;
    return {
      speed: windSnapshot.speed,
      direction: windSnapshot.direction,
      gust: windSnapshot.gust,
    };
  }, [windSnapshot]);

  // Format current data for layout
  const layoutCurrentData = useMemo((): LayoutCurrentData | undefined => {
    if (!currentSnapshot) return undefined;
    return {
      speed: currentSnapshot.speed,
      direction: currentSnapshot.direction,
      type: currentSnapshot.type,
    };
  }, [currentSnapshot]);

  // Extract VHF channel from various possible locations
  const vhfChannel = useMemo((): string | null => {
    const metadata = selectedRaceData?.metadata as Record<string, unknown> | undefined;
    return (
      selectedRaceData?.vhf_channel ??
      selectedRaceData?.critical_details?.vhf_channel ??
      (metadata?.vhf_channel as string | undefined) ??
      (metadata?.vhfChannel as string | undefined) ??
      (metadata?.communications as Record<string, unknown> | undefined)?.vhf as string | undefined ??
      (metadata?.critical_details as Record<string, unknown> | undefined)?.vhf_channel as string | undefined ??
      null
    );
  }, [selectedRaceData]);

  return {
    courseHeading,
    layoutWindData,
    layoutCurrentData,
    vhfChannel,
  };
}

export default useRaceLayoutData;
