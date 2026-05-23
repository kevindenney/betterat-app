/**
 * useWalkTimeAnnotations — pin-to-pin walk-distance labels for the nursing
 * F4 frame at z14+. Per the design pass, walk-time annotations only render
 * between same-campus pins (JH East Baltimore ↔ Pinkard sim lab, etc.).
 *
 * Heuristic for "same campus":
 *   • Both POIs in the nursing interest
 *   • Distance < 0.6 km (the threshold that catches JHH↔Pinkard, but not
 *     JHH↔Bayview which sit 5+ km apart)
 *
 * Returns one annotation per pair at the midpoint. Walking speed assumption:
 * 5 km/h (~84m/min); rendered as "X min" with the value rounded.
 *
 * The annotation itself is just another AtlasPinSpec rendered as a small
 * grey label by AtlasMapLibreCanvas — no new shape vocabulary, no new
 * MLLineLayer, no zoom listener (deferred until camera state is wired).
 */

import { useMemo } from 'react';
import type { AtlasPinSpec } from '@/components/ios-register/atlas/AtlasMapLibreCanvas';

const WALK_KMH = 5;
const SAME_CAMPUS_KM = 0.6;

function approxKm(a: AtlasPinSpec, b: AtlasPinSpec): number {
  const dLat = (b.lat - a.lat) * 111;
  const dLng = (b.lng - a.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

export function useWalkTimeAnnotations(pins: AtlasPinSpec[]): AtlasPinSpec[] {
  return useMemo(() => {
    const out: AtlasPinSpec[] = [];
    const poiPins = pins.filter((p) => p.kind.startsWith('poi-'));
    for (let i = 0; i < poiPins.length; i += 1) {
      for (let j = i + 1; j < poiPins.length; j += 1) {
        const a = poiPins[i];
        const b = poiPins[j];
        const km = approxKm(a, b);
        if (km > SAME_CAMPUS_KM || km < 0.05) continue;
        const minutes = Math.max(1, Math.round((km / WALK_KMH) * 60));
        out.push({
          id: `walktime:${a.id}-${b.id}`,
          lat: (a.lat + b.lat) / 2,
          lng: (a.lng + b.lng) / 2,
          kind: 'walk-annotation',
          label: `${minutes} min`,
        });
      }
    }
    return out;
  }, [pins]);
}
