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
      // RHKYC is treated as Felix's "home base" — render as anchor pin.
      // Long-term: a `user_base_poi_id` per user picks the right anchor.
      if (poi.name === 'Royal Hong Kong Yacht Club') return 'poi-club-anchor';
      return 'poi-club';
    case 'racing_area':
      return 'poi-racing-area';
    case 'hospital':
      return 'poi-hospital';
    case 'sim_lab':
      return 'poi-sim-lab';
    case 'preceptor':
      return 'poi-preceptor';
    default:
      return null;
  }
}

/**
 * Approximate km distance between two lng/lat pairs. Good enough for the
 * <50km bbox scale Atlas operates at.
 */
function approxKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = (b.lat - a.lat) * 111;
  const dLng = (b.lng - a.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Per design rule §5 (CLUSTER BEHAVIOR): peer pins (population) cluster
 * when 5+ sit within 2km of each other; POIs (geography) never cluster.
 * Returns one pin per cluster — either the original pin (clusters with
 * <5 members are emitted as-is) or a single "+N" badge at the centroid.
 */
export function clusterPeerPins(
  peerPins: AtlasPinSpec[],
  thresholdKm = 2,
  minClusterSize = 5,
): AtlasPinSpec[] {
  const visited = new Set<number>();
  const out: AtlasPinSpec[] = [];
  for (let i = 0; i < peerPins.length; i += 1) {
    if (visited.has(i)) continue;
    const group: number[] = [i];
    for (let j = i + 1; j < peerPins.length; j += 1) {
      if (visited.has(j)) continue;
      if (approxKm(peerPins[i], peerPins[j]) < thresholdKm) group.push(j);
    }
    if (group.length >= minClusterSize) {
      let lat = 0;
      let lng = 0;
      for (const idx of group) {
        lat += peerPins[idx].lat;
        lng += peerPins[idx].lng;
        visited.add(idx);
      }
      out.push({
        id: `peer-cluster:${peerPins[i].id}-${group.length}`,
        lat: lat / group.length,
        lng: lng / group.length,
        kind: 'fleet',
        clusterCount: group.length,
      });
    } else {
      visited.add(i);
      out.push(peerPins[i]);
    }
  }
  return out;
}

/**
 * Trim long institution names so the inline label stays readable on the
 * map. Drops the leading "Royal/Johns Hopkins/Hospital" filler when it
 * makes the label too long.
 */
export function shortenPoiName(name: string): string {
  if (name.length <= 22) return name;
  return name
    .replace(/^Royal Hong Kong /i, 'RHKYC ')
    .replace(/^Johns Hopkins /i, 'JH ')
    .replace(/ — .*$/, '')
    .slice(0, 22);
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
      // Anchor pin gets a terser "RHKYC CLUB"-style label per the design.
      const label =
        kind === 'poi-club-anchor' ? 'RHKYC CLUB' : shortenPoiName(poi.name);
      out.push({
        id: `poi:${poi.id}`,
        lat: poi.lat,
        lng: poi.lng,
        kind,
        label,
      });
    }

    // Peer step pins from the RPC — already privacy-filtered server-side.
    // Per design rule §5 (CLUSTER BEHAVIOR): 5+ peer pins in 2km merge
    // to "+N". POIs are geography (never merge); peer pins are population
    // (merge at relationship-neutral density).
    const peerPins = peers.map((step) => ({
      id: `peer:${step.step_id}`,
      lat: step.lat,
      lng: step.lng,
      kind: mapPeerToPinKind(step),
    }));
    out.push(...clusterPeerPins(peerPins));

    return out;
  }, [pois, peers, interestSlug]);

  return { pins, loading: poisLoading || peersLoading };
}
