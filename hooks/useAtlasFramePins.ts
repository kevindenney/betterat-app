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
import { useUserAtlasSteps, type PickerStep, type UserAtlasStep } from './useUserAtlasSteps';
import { useSailingPoisNear, type SailingPoiRow } from './useSailingPoisNear';
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
  /**
   * Layer-toggle flags. When the Marinas layer is on, marina POIs are
   * fetched + included. Sail services covers the rest of the sailing
   * POI kinds. When both are off, no sailing-pois query fires.
   */
  showMarinas?: boolean;
  showSailServices?: boolean;
  /**
   * When set, peer step pins are filtered to only those authored by
   * users in this Set. Used by Atlas chip-row contextual groups —
   * e.g. when "Dragon HK" sub-chip is active, only Dragon HK members'
   * peer steps render. `null` means no filter (show all peers).
   * Own steps (self / my-step-*) and institution POIs ignore the
   * filter since they're not "peer" data.
   */
  restrictPeersToUserIds?: Set<string> | null;
}

function mapSailingPoiToPinKind(poi: SailingPoiRow): AtlasPinSpec['kind'] | null {
  switch (poi.kind) {
    case 'marina':
      return 'poi-marina';
    case 'sail_loft':
      return 'poi-sail-loft';
    case 'chandler':
    case 'rigging':
    case 'repair':
      return 'poi-chandler';
    default:
      return null;
  }
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
        label: `${group.length} nearby peer steps`,
        subtitle:
          'Privacy-safe cluster of crew, fleet, following, and cohort steps near this area.',
        provenance:
          'Shown as a count because individual peer locations may be approximate, hidden, or jittered.',
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

/**
 * Phase A — map a viewer-owned step's status to the matching marker
 * kind. The "next" step (right of timeline NOW) gets its own hero pin,
 * as does the most recently completed step (left of NOW). Other
 * planned/done variants render with the small status-encoded pins.
 */
function mapUserStepStatusToPinKind(
  step: UserAtlasStep,
): AtlasPinSpec['kind'] {
  switch (step.status) {
    case 'planned-next':
      return 'my-step-next';
    case 'planned-week':
      return 'my-step-planned';
    case 'done-just-completed':
      return 'my-step-done-just';
    case 'done-recent':
      return 'my-step-done-recent';
    case 'done-old':
      return 'my-step-done-old';
  }
}

export function useAtlasFramePins({
  lat,
  lng,
  interestSlug,
  radiusKm = 8,
  showMarinas = false,
  showSailServices = false,
  restrictPeersToUserIds = null,
}: UseAtlasFramePinsArgs): { pins: AtlasPinSpec[]; pickerSteps: PickerStep[]; loading: boolean } {
  const { pois, loading: poisLoading } = useAtlasPois();
  // restrictPeersToUserIds (chip-row contextual group filter) is pushed
  // down to the RPC via restrict_user_ids[] so the bbox scan narrows at
  // the SQL level instead of after the network round-trip. Set → array
  // because the Supabase JSON RPC arg expects uuid[].
  const restrictUserIds = useMemo(
    () =>
      restrictPeersToUserIds && restrictPeersToUserIds.size > 0
        ? Array.from(restrictPeersToUserIds)
        : null,
    [restrictPeersToUserIds],
  );
  const { data: peers = [], isLoading: peersLoading } = useAtlasPeerSteps({
    lat,
    lng,
    radiusKm,
    interestSlug,
    restrictUserIds,
  });
  const { steps: userSteps, pickerSteps, loading: userStepsLoading } = useUserAtlasSteps({
    interestSlug,
  });
  // Sailing POI bbox — ~radiusKm half-side in lat (1° ≈ 111km) and lng
  // (cos-corrected at the given latitude). Cheap approximation; the
  // RPC LIMITs to 200 anyway.
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  const sailingKinds = useMemo(() => {
    const out: ('marina' | 'sail_loft' | 'chandler' | 'repair' | 'rigging')[] = [];
    if (showMarinas) out.push('marina');
    if (showSailServices) out.push('sail_loft', 'chandler', 'repair', 'rigging');
    return out;
  }, [showMarinas, showSailServices]);
  const sailingPoisEnabled = sailingKinds.length > 0;
  const { data: sailingPois = [] } = useSailingPoisNear({
    bbox: sailingPoisEnabled
      ? {
          minLat: lat - latDelta,
          maxLat: lat + latDelta,
          minLng: lng - lngDelta,
          maxLng: lng + lngDelta,
        }
      : null,
    kinds: sailingPoisEnabled ? sailingKinds : undefined,
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
      // Each pin kind reads its own subtitle/provenance off the POI's
      // metadata blob. Reuses `meta` from the label-builder block above.
      const specialty =
        typeof meta?.specialty === 'string' ? String(meta.specialty) : null;
      const preceptorRole =
        typeof meta?.preceptor_role === 'string'
          ? String(meta.preceptor_role).replace(/-/g, ' ')
          : null;
      const craft =
        typeof meta?.craft === 'string' ? String(meta.craft) : null;
      const dayOfWeek = Array.isArray(meta?.day_of_week)
        ? (meta.day_of_week as string[])
            .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
            .join(' · ')
        : null;
      const postedAt =
        typeof meta?.posted_at === 'string' ? String(meta.posted_at) : null;

      let subtitle: string | undefined;
      let provenance: string | undefined;
      if (kind === 'poi-preceptor' && (specialty || preceptorRole)) {
        subtitle = [specialty, preceptorRole].filter(Boolean).join(' · ');
        provenance = 'Faculty preceptor — tap to see office hours and cohort shadowing history.';
      } else if (kind === 'poi-supplier') {
        subtitle = craft ? `${craft.charAt(0).toUpperCase() + craft.slice(1)} supplier` : 'Raw material supplier';
        provenance = 'Tap to see craft, distance, and last contact. Plan a sourcing run.';
      } else if (kind === 'poi-haat') {
        subtitle = dayOfWeek ? `${dayOfWeek} · weekly market` : 'Weekly market';
        provenance = 'Tap to see what sold last week and plan a step here.';
      } else if (kind === 'poi-mentee') {
        subtitle = [specialty, postedAt && `posted ${postedAt}`]
          .filter(Boolean)
          .join(' · ') || 'Mentee';
        provenance = 'Tap to view their recent post and reach out.';
      } else if (kind === 'poi-home-anchor') {
        subtitle = 'Your workshop · home base';
        provenance = 'Tap to see today\'s tasks, log a work session, or check inventory.';
      }
      out.push({
        id: `poi:${poi.id}`,
        lat: poi.lat,
        lng: poi.lng,
        kind,
        label,
        subtitle,
        provenance,
        orgId: poi.claimed_by_org_id,
        orgSlug: poi.org_slug,
      });
    }

    // Sailing land-side POIs (marinas, sail lofts, chandlers, repair,
    // rigging). Gated by the layer toggles passed in via args — when
    // both toggles are off, `sailingPois` is empty and this loop is a
    // no-op. POIs from this source render as ring-grammar pins (place,
    // not person) tinted by kind.
    for (const poi of sailingPois) {
      const kind = mapSailingPoiToPinKind(poi);
      if (!kind) continue;
      out.push({
        id: `sailing-poi:${poi.id}`,
        lat: Number(poi.latitude),
        lng: Number(poi.longitude),
        kind,
        label: poi.short_name ?? poi.name,
      });
    }

    // Peer step pins from the RPC — privacy-filtered server-side AND
    // (when chip-row contextual groups are active) scoped to the group
    // roster server-side via restrict_user_ids[]. Per design rule §5
    // (CLUSTER BEHAVIOR): 5+ peer pins in 2km merge to "+N"; POIs are
    // geography (never merge).
    const peerPins = peers.map((step) => ({
      id: `peer:${step.step_id}`,
      lat: step.lat,
      lng: step.lng,
      kind: mapPeerToPinKind(step),
    }));
    out.push(...clusterPeerPins(peerPins));

    // Phase A — viewer's own steps with location, status-encoded as a
    // colored dot (planned/done-recent/done-old). planned-week pins
    // carry a "|MON" tail so the canvas renders the day-of-week badge
    // the same way it does for haats.
    for (const step of userSteps) {
      const kind = mapUserStepStatusToPinKind(step);
      const label =
        kind === 'my-step-planned'
          ? `${step.title}|${step.day_badge ?? ''}`
          : step.title;
      out.push({
        id: `mystep:${step.step_id}`,
        lat: step.lat,
        lng: step.lng,
        kind,
        label,
        subtitle: step.location_name ?? undefined,
        stepId: step.step_id,
      });
    }

    return out;
  }, [pois, peers, userSteps, sailingPois, interestSlug]);

  return { pins, pickerSteps, loading: poisLoading || peersLoading || userStepsLoading };
}
