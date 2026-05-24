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
      // Pinkard is Emily's home base — render as the distinctive
      // sim-anchor pin (blue dot + SIM badge) so it reads as "your
      // base" the same way RHKYC reads on the sailing canvas.
      if (poi.name === 'JHU School of Nursing — Pinkard Building') {
        return 'poi-sim-anchor';
      }
      return 'poi-sim-lab';
    case 'preceptor':
      return 'poi-preceptor';
    case 'haat':
      return 'poi-haat';
    case 'supplier':
      return 'poi-supplier';
    case 'mentee':
      return 'poi-mentee';
    case 'home':
      return 'poi-home-anchor';
    default:
      return null;
  }
}

/**
 * Short label for a haat market — strip the bilingual tail so "Khunti
 * haat · खुनी हाट" reads as "Khunti haat" in the pin row (the Hindi
 * second half lives in the bottom-sheet body where it has room).
 */
function shortenHaatName(name: string): string {
  // The seeded names use "English haat · हिन्दी" separator. Keep only
  // the English part for the pin label.
  const cut = name.split(' · ')[0];
  return cut.replace(/\s+haat$/i, ''); // "Khunti haat" → "Khunti"
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
 * map. A small per-name lookup handles the "design-canonical" short
 * forms the design uses (Sibley / Suburban / Howard Co. / Pinkard / JH
 * Bayview etc.); everything else falls through to generic trimming.
 */
const POI_NICE_LABELS: Record<string, string> = {
  'Sibley Memorial Hospital': 'Sibley',
  'Suburban Hospital': 'Suburban',
  'Howard County General Hospital': 'Howard Co.',
  'Johns Hopkins Bayview Medical Center': 'JH Bayview',
  'Johns Hopkins Hospital — East Baltimore': 'JHH',
  'JHU School of Nursing — Pinkard Building': 'Pinkard',
};

export function shortenPoiName(name: string): string {
  const nice = POI_NICE_LABELS[name];
  if (nice) return nice;
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
      // Anchor pins get terser labels per the design. RHKYC reads as
      // "RHKYC CLUB"; the Pinkard sim base reads as "Pinkard" with the
      // SIM badge rendered separately by the marker. Haat pins stuff a
      // |-delimited day-of-week tail ("Bero|mon") so the marker can
      // render a small "MON" badge next to the name.
      const meta =
        poi.metadata && typeof poi.metadata === 'object'
          ? (poi.metadata as Record<string, unknown>)
          : null;
      let label: string;
      if (kind === 'poi-club-anchor') {
        label = 'RHKYC CLUB';
      } else if (kind === 'poi-sim-anchor') {
        label = 'Pinkard';
      } else if (kind === 'poi-home-anchor') {
        label = 'Home · घर';
      } else if (kind === 'poi-haat') {
        const days = Array.isArray(meta?.day_of_week)
          ? (meta.day_of_week as string[])
          : [];
        const firstDay = days[0] ?? '';
        label = `${shortenHaatName(poi.name)}|${firstDay}`;
      } else if (kind === 'poi-mentee') {
        label = ''; // mentee pin is decorative; detail lives in the sheet
      } else {
        label = shortenPoiName(poi.name);
      }
      // Preceptor diamonds carry an extra subtitle/provenance line so
      // their tap-sheets read as "respiratory pathway · clinical
      // instructor" not just "this person exists." Pulls from the POI
      // metadata blob (specialty + preceptor_role) — reuses `meta` from
      // the label-builder block above.
      const specialty =
        typeof meta?.specialty === 'string' ? String(meta.specialty) : null;
      const preceptorRole =
        typeof meta?.preceptor_role === 'string'
          ? String(meta.preceptor_role).replace(/-/g, ' ')
          : null;
      const subtitle =
        kind === 'poi-preceptor' && (specialty || preceptorRole)
          ? [specialty, preceptorRole].filter(Boolean).join(' · ')
          : undefined;
      const provenance =
        kind === 'poi-preceptor'
          ? 'Faculty preceptor — tap to see office hours and cohort shadowing history.'
          : undefined;
      out.push({
        id: `poi:${poi.id}`,
        lat: poi.lat,
        lng: poi.lng,
        kind,
        label,
        subtitle,
        provenance,
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
