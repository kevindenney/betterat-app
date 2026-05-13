/**
 * useTacticalZones Hook
 *
 * Provides tactical zone data and utilities for map visualization
 */

import { useMemo, useCallback } from 'react';
import {
  useRaceConditions,
  selectTacticalZones,
  selectCurrent,
  selectWind,
  type TacticalZone
} from '@/stores/raceConditionsStore';
import {
  getZonesByType,
  getHighConfidenceZones,
  getActiveZones,
  sortZonesByAdvantage
} from '@/components/map/layers/TacticalCurrentZones';

interface UseTacticalZonesOptions {
  /** Filter by zone type */
  filterTypes?: TacticalZone['type'][];

  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;

  /** Only show active zones */
  onlyActive?: boolean;

  /** Sort by advantage */
  sortByAdvantage?: boolean;
}

interface UseTacticalZonesResult {
  /** All tactical zones */
  zones: TacticalZone[];

  /** Filtered zones based on options */
  filteredZones: TacticalZone[];

  /** Zones by type */
  reliefLanes: TacticalZone[];
  accelerationZones: TacticalZone[];
  shearBoundaries: TacticalZone[];
  leeBowZones: TacticalZone[];
  anchoringZones: TacticalZone[];

  /** High-confidence zones */
  highConfidenceZones: TacticalZone[];

  /** Active zones (valid at current time) */
  activeZones: TacticalZone[];

  /** Top zones sorted by advantage */
  topZones: TacticalZone[];

  /** Get zone by ID */
  getZoneById: (id: string) => TacticalZone | undefined;

  /** Check if environmental data supports tactical zones */
  hasEnvironmentalData: boolean;

  /** Utility functions */
  utils: {
    getZonesByType: typeof getZonesByType;
    getHighConfidenceZones: typeof getHighConfidenceZones;
    getActiveZones: typeof getActiveZones;
    sortZonesByAdvantage: typeof sortZonesByAdvantage;
  };
}

/**
 * Hook for tactical zone data and utilities
 */
export function useTacticalZones(
  options: UseTacticalZonesOptions = {}
): UseTacticalZonesResult {
  const {
    filterTypes,
    minConfidence = 0.5,
    onlyActive = false,
    sortByAdvantage: shouldSort = false
  } = options;

  // Get data from store
  const zones = useRaceConditions(selectTacticalZones);
  const current = useRaceConditions(selectCurrent);
  const wind = useRaceConditions(selectWind);

  // Check if we have environmental data
  const hasEnvironmentalData = useMemo(() => {
    return !!(current && wind);
  }, [current, wind]);

  // Filter zones based on options
  const filteredZones = useMemo(() => {
    let result = zones;

    // Filter by type
    if (filterTypes && filterTypes.length > 0) {
      result = getZonesByType(result, filterTypes[0]);
      // For multiple types, combine results
      for (let i = 1; i < filterTypes.length; i++) {
        result = [...result, ...getZonesByType(zones, filterTypes[i])];
      }
    }

    // Filter by confidence
    result = result.filter(z => z.properties.confidence !== 'low' || minConfidence <= 0.3);

    // Filter by active
    if (onlyActive) {
      result = getActiveZones(result);
    }

    // Sort by advantage
    if (shouldSort) {
      result = sortZonesByAdvantage(result);
    }

    return result;
  }, [zones, filterTypes, minConfidence, onlyActive, shouldSort]);

  // Zones by type
  const reliefLanes = useMemo(() => getZonesByType(zones, 'relief'), [zones]);
  const accelerationZones = useMemo(() => getZonesByType(zones, 'acceleration'), [zones]);
  const shearBoundaries = useMemo(() => getZonesByType(zones, 'shear'), [zones]);
  const leeBowZones = useMemo(() => getZonesByType(zones, 'lee-bow'), [zones]);
  const anchoringZones = useMemo(() => getZonesByType(zones, 'anchoring'), [zones]);

  // High-confidence zones
  const highConfidenceZones = useMemo(
    () => getHighConfidenceZones(zones, 0.8),
    [zones]
  );

  // Active zones
  const activeZones = useMemo(() => getActiveZones(zones), [zones]);

  // Top zones sorted by advantage
  const topZones = useMemo(() => {
    return sortZonesByAdvantage(zones).slice(0, 5);
  }, [zones]);

  // Get zone by ID
  const getZoneById = useCallback(
    (id: string) => zones.find(z => z.id === id),
    [zones]
  );

  return {
    zones,
    filteredZones,
    reliefLanes,
    accelerationZones,
    shearBoundaries,
    leeBowZones,
    anchoringZones,
    highConfidenceZones,
    activeZones,
    topZones,
    getZoneById,
    hasEnvironmentalData,
    utils: {
      getZonesByType,
      getHighConfidenceZones,
      getActiveZones,
      sortZonesByAdvantage
    }
  };
}

/**
 * Hook for tactical zone layer configuration
 */
export function useTacticalZoneLayerConfig(options: {
  opacity?: number;
  showBorders?: boolean;
  showLabels?: boolean;
  showConfidence?: boolean;
  filterTypes?: TacticalZone['type'][];
} = {}) {
  const {
    opacity = 0.35,
    showBorders = true,
    showLabels = true,
    showConfidence = true,
    filterTypes
  } = options;

  const { filteredZones } = useTacticalZones({ filterTypes });

  return useMemo(() => ({
    zones: filteredZones,
    layerConfig: {
      opacity,
      showBorders,
      showLabels,
      showConfidence
    }
  }), [filteredZones, opacity, showBorders, showLabels, showConfidence]);
}
