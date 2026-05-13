/**
 * useRaceClassSelection Hook
 *
 * Extracts race class ID and name from race data.
 * Handles multiple possible locations in race data structure.
 */

import { useMemo } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface UseRaceClassSelectionParams {
  /** Selected race data with potential class information */
  selectedRaceData: {
    class_id?: string | null;
    classId?: string | null;
    boatClass?: string | null;
    /** Database column: boat_classes JSONB array */
    boat_classes?: { id?: string; name?: string }[] | null;
    metadata?: {
      class_id?: string | null;
      classId?: string | null;
      class_name?: string | null;
    };
    class_divisions?: { name?: string }[];
  } | null;
}

export interface UseRaceClassSelectionReturn {
  /** Class ID from race data */
  selectedRaceClassId: string | null;
  /** Class name from race data */
  selectedRaceClassName: string | undefined;
}

/**
 * Hook for extracting race class selection from race data
 */
export function useRaceClassSelection({
  selectedRaceData,
}: UseRaceClassSelectionParams): UseRaceClassSelectionReturn {
  // Extract class ID from multiple possible locations
  const selectedRaceClassId = useMemo((): string | null => {
    if (!selectedRaceData) return null;
    const classId = (
      selectedRaceData.class_id ||
      selectedRaceData.classId ||
      selectedRaceData.metadata?.class_id ||
      selectedRaceData.metadata?.classId ||
      selectedRaceData.boat_classes?.[0]?.id ||
      null
    );
    return classId;
  }, [selectedRaceData]);

  // Extract class name from metadata, divisions, boatClass, or boat_classes
  const selectedRaceClassName = useMemo((): string | undefined => {
    if (!selectedRaceData) return undefined;
    const className = (
      selectedRaceData.metadata?.class_name ||
      selectedRaceData.class_divisions?.[0]?.name ||
      selectedRaceData.boatClass ||
      selectedRaceData.boat_classes?.[0]?.name ||
      undefined
    );
    return className;
  }, [selectedRaceData]);

  return {
    selectedRaceClassId,
    selectedRaceClassName,
  };
}

export default useRaceClassSelection;
