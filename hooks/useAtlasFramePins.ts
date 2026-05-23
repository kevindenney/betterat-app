/**
 * useAtlasFramePins — frame-level adapter that merges institution POIs
 * (from atlas_pois) and peer step pins (from atlas_peer_steps_near) into a
 * single AtlasPinSpec[] ready for AtlasMapLibreCanvas.
 *
 * The hook takes a bbox center + interest slug; FrameF1 / FrameF4 derive
 * those from their canonical camera presets. Pins update via React Query
 * so navigating across frames invalidates cleanly.
 */

import { useMemo } from 'react';
import { useAtlasPois, type AtlasPoi } from './useAtlasPois';
import { useAtlasPeerSteps, type AtlasPeerStep } from './useAtlasPeerSteps';
import type { AtlasPinSpec } from '@/components/ios-register/atlas/AtlasMapLibreCanvas';

interface UseAtlasFramePinsArgs {
  /** bbox center lat — taken from the frame's camera preset */
  lat: number;
  /** bbox center lng — taken from the frame's camera preset */
  lng: number;
  /** Interest slug, e.g. 'sail-racing' or 'nursing' */
  interestSlug: string | null;
  /** Half-side of the bbox in km for peer steps. Default 8. */
  radiusKm?: number;
}

/**
 * Map an atlas_pois.kind enum value to an AtlasPinSpec kind.
 * Anything we don't recognize gets dropped (returns null).
 */
export function mapPoiToPinKind(poi: AtlasPoi): AtlasPinSpec['kind'] | null {
  switch (poi.kind) {
    case 'club':
      return 'poi-club';
    case 'racing_area':
      return 'poi-racing-area';
    case 'hospital':
      return 'poi-hospital';
    case 'sim_lab':
      return 'poi-sim-lab';
    default:
      return null;
  }
}

/**
 * Map a peer-step relationship to a pin kind. 'self' becomes 'you' so the
 * viewer's own pin reads bigger; everything else maps 1:1 except 'public'
 * and 'cohort' which both fall back to 'following' until we add a
 * dedicated cohort pin tone.
 */
export function mapPeerToPinKind(step: AtlasPeerStep): AtlasPinSpec['kind'] {
  switch (step.relationship) {
    case 'self':
      return 'you';
    case 'crew':
      return 'crew';
    case 'fleet':
      return 'fleet';
    case 'following':
    case 'cohort':
    case 'public':
    default:
      return 'following';
  }
}

export function useAtlasFramePins({
  lat,
  lng,
  interestSlug,
  radiusKm = 8,
}: UseAtlasFramePinsArgs): { pins: AtlasPinSpec[]; loading: boolean } {
  const { pois, loading: poisLoading } = useAtlasPois();
  const { data: peers = [], isLoading: peersLoading } = useAtlasPeerSteps({
    lat,
    lng,
    radiusKm,
    interestSlug,
  });

  const pins = useMemo<AtlasPinSpec[]>(() => {
    const out: AtlasPinSpec[] = [];

    // Institution POIs filtered to the requested interest (null interest_slug
    // POIs are universal — show them always).
    for (const poi of pois) {
      if (interestSlug && poi.interest_slug && poi.interest_slug !== interestSlug) {
        continue;
      }
      const kind = mapPoiToPinKind(poi);
      if (!kind) continue;
      out.push({ id: `poi:${poi.id}`, lat: poi.lat, lng: poi.lng, kind });
    }

    // Peer step pins from the RPC — already privacy-filtered server-side.
    for (const step of peers) {
      out.push({
        id: `peer:${step.step_id}`,
        lat: step.lat,
        lng: step.lng,
        kind: mapPeerToPinKind(step),
      });
    }

    return out;
  }, [pois, peers, interestSlug]);

  return { pins, loading: poisLoading || peersLoading };
}
