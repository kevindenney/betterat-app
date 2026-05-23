/**
 * useCompetencyGlow — annotates institution POI pins with a
 * `glowCluster` derived from the nearest cohort heatmap cell within
 * a threshold radius. Result: each JHH/Bayview/etc. pin radiates a
 * soft colored aura whose color encodes the dominant competency
 * developed at that site (cardiac / respiratory / medication /
 * general).
 *
 * Pure client-side projection — no extra round-trip. Cells already
 * carry the dominant_cluster from atlas_cohort_step_hex; this hook
 * just maps cells → nearest POI within `nearKm`.
 *
 * Reuses the heatmap data the F4 frame already fetches, so the glow
 * is "free" relative to existing queries.
 */

import { useMemo } from 'react';
import type { AtlasPinSpec } from '@/components/ios-register/atlas/AtlasMapLibreCanvas';

function approxKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (b.lat - a.lat) * 111;
  const dLng = (b.lng - a.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Returns framePins enhanced with glowCluster on institution POIs that
 * sit within `nearKm` of a heatmap cell. Non-POI pins (walk-time,
 * preceptor diamond, etc.) pass through untouched.
 */
export function useCompetencyGlow(
  framePins: AtlasPinSpec[],
  heatmapCells: AtlasPinSpec[],
  nearKm = 0.5,
): AtlasPinSpec[] {
  return useMemo(() => {
    if (heatmapCells.length === 0) return framePins;
    return framePins.map((pin) => {
      // Only institution circles get glow; diamonds/race-marks/peers don't.
      const isInstitution = pin.kind === 'poi-hospital' || pin.kind === 'poi-club';
      if (!isInstitution) return pin;
      let nearestCluster: string | undefined;
      let nearestKm = Infinity;
      for (const cell of heatmapCells) {
        const km = approxKm(pin, cell);
        if (km <= nearKm && km < nearestKm) {
          nearestKm = km;
          // heatmap cell label encodes "count|cluster"
          nearestCluster = (cell.label ?? '0|general').split('|')[1];
        }
      }
      return nearestCluster
        ? { ...pin, glowCluster: nearestCluster }
        : pin;
    });
  }, [framePins, heatmapCells, nearKm]);
}
