/**
 * AtlasMapLibreCanvas — real MapLibre canvas for the Atlas tab.
 *
 * Replaces the static SVG `HongKongOverviewMap` (and friends) with a live
 * tile-rendered map. Pins, the next-event tag, racing-area tags, and the
 * ghost cohort stamp all become MLMarker children — same vocabulary, real
 * geography.
 *
 * Wire-up status (v1):
 *   • Native only. Web platform falls back to the static SVG (the
 *     existing pattern — RaceMapCard does the same). The
 *     `maplibre-gl`/`react-map-gl` web stack is installed; wiring it lands
 *     in a follow-up.
 *   • Camera presets per frame match the canonical brief: F1 Causeway
 *     Bay overview, F2 Victoria Harbour close-up, F3 world Dragon,
 *     F4/F5 Baltimore, F6 candidate-pin commit-mode at Victoria Harbour.
 *   • Tile source: OpenFreeMap Liberty style (same as RaceMapCard).
 *     Free, no API key, no per-load fees — privacy-friendly for the
 *     healthcare path.
 *
 * Real peer pins / racing areas / race marks / institution sites all
 * come from the `atlas_pois` table + `atlas_peer_steps_near` RPC once
 * Phase A1's drafted migration applies. For now this component renders
 * the canonical fixture coords baked from the design handoff.
 */

import React, { useCallback } from 'react';
import { Platform, StyleSheet, Text, View, type NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Map as MLMap,
  Camera as MLCamera,
  Marker as MLMarker,
  type PressEvent,
} from '@maplibre/maplibre-react-native';

import {
  HongKongOverviewMap,
  RaceMarksZoomMap,
  WorldDragonMap,
  BaltimoreColdMap,
  JhuCuratedMap,
  CommitHarbourMap,
} from './AtlasMaps';
import type { AtlasFrameId, AtlasNextEvent } from './AtlasScreen';

// OpenFreeMap Liberty — free MapLibre style, no API key. Matches the
// canonical RaceMapCard choice; one less endpoint to manage.
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

interface CameraPreset {
  /** [longitude, latitude] */
  center: [number, number];
  zoom: number;
}

/**
 * Canonical fixture camera per frame. These are the coords the SVG
 * mockups suggest — real geography swapped in. When the per-interest
 * `home_geography_resolver` lands, the F1/F4 frames will pull from the
 * user's profile instead.
 */
const FRAME_CAMERA: Record<AtlasFrameId, CameraPreset> = {
  f1: { center: [114.18, 22.295], zoom: 11.2 },       // Causeway Bay overview
  f2: { center: [114.182, 22.286], zoom: 14.2 },       // Victoria Harbour close-up
  f3: { center: [60, 25], zoom: 1.4 },                 // World — Atlantic + Eurasia
  f4: { center: [-76.61, 39.29], zoom: 11 },           // Baltimore
  f5: { center: [-76.595, 39.30], zoom: 12.5 },        // East Baltimore (Hopkins)
  f6: { center: [114.182, 22.286], zoom: 13.4 },       // Commit-mode at Victoria Harbour
  f7: { center: [85.45, 23.27], zoom: 9.8 },           // Ranchi · Jharkhand · entrepreneur network
};

export interface AtlasPinSpec {
  id: string;
  lng: number;
  lat: number;
  /**
   * Foreign key into the pin grammar.
   *
   * Peer relationships (from atlas_peer_steps_near):
   *   you/crew/fleet/following/own
   *
   * Places (from atlas_pois):
   *   poi-club          — sailing club (RHKYC, etc.)
   *   poi-racing-area   — sailing race grounds
   *   poi-hospital      — healthcare site
   *   poi-sim-lab       — nursing simulation lab
   *
   * UI-driven:
   *   candidate         — red drop-pin during compose-at-location
   *   race-mark         — windward/leeward marks for an active race
   */
  kind:
    | 'you'
    | 'crew'
    | 'fleet'
    | 'following'
    | 'own'
    | 'candidate'
    | 'race-mark'
    | 'poi-club'
    | 'poi-racing-area'
    | 'poi-hospital'
    | 'poi-sim-lab'
    | 'poi-preceptor'
    | 'walk-annotation'
    | 'wind-arrow'
    | 'tide-arrow'
    | 'cohort-cell';
  /** Optional short label rendered next to the pin (POIs get names). */
  label?: string;
  /**
   * Peer cluster count when this pin is a merged-cluster badge. Per the
   * design's cluster behavior rule: 5+ peer pins in 2km merge to "+N",
   * POIs never cluster (geography vs population).
   */
  clusterCount?: number;
}

interface AtlasMapLibreCanvasProps {
  frame: AtlasFrameId;
  /** Optional peer pin list — empty in cold-start. */
  pins?: AtlasPinSpec[];
  /** When provided, an amber NEXT marker drops at the venue centroid. */
  nextEvent?: (AtlasNextEvent & { lng: number; lat: number }) | null;
  /**
   * When provided, single-tap on the map fires this callback with the
   * tapped lng/lat. Atlas frames opt into this when commit-mode is on —
   * see FrameF1's commitMode state.
   */
  onMapPress?: (coords: { lng: number; lat: number }) => void;
  /**
   * When provided, renders a red candidate drop-pin at this position.
   * Used by commit-mode to show "you are about to anchor here."
   */
  candidate?: { lng: number; lat: number } | null;
}

export function AtlasMapLibreCanvas({
  frame,
  pins = [],
  nextEvent,
  onMapPress,
  candidate,
}: AtlasMapLibreCanvasProps) {
  // Hooks first, then early returns — rules-of-hooks compliance.
  const handlePress = useCallback(
    (event: NativeSyntheticEvent<PressEvent>) => {
      if (!onMapPress) return;
      const [lng, lat] = event.nativeEvent.lngLat;
      onMapPress({ lng, lat });
    },
    [onMapPress],
  );

  // Web platform: keep the SVG fallback. maplibre-gl + react-map-gl are
  // installed but the bridge to this component lands in a follow-up.
  if (Platform.OS === 'web') {
    const SvgMap = pickSvgMap(frame);
    return (
      <View style={styles.fill} pointerEvents="none">
        <SvgMap />
      </View>
    );
  }

  const camera = FRAME_CAMERA[frame];

  return (
    <View style={styles.fill}>
      <MLMap
        mapStyle={MAP_STYLE_URL}
        style={styles.fill}
        onPress={onMapPress ? handlePress : undefined}
      >
        <MLCamera
          initialViewState={{
            center: camera.center,
            zoom: camera.zoom,
          }}
        />

        {pins.map((pin) => (
          <MLMarker key={pin.id} id={pin.id} lngLat={[pin.lng, pin.lat]}>
            <LabeledPin
              kind={pin.kind}
              label={pin.label}
              clusterCount={pin.clusterCount}
              showLabel={shouldShowLabel(pin, pins)}
            />
          </MLMarker>
        ))}

        {nextEvent ? (
          <MLMarker
            id="atlas-next-event"
            lngLat={[nextEvent.lng, nextEvent.lat]}
          >
            <NextEventMarker label={nextEvent.label} when={nextEvent.when} />
          </MLMarker>
        ) : null}

        {candidate ? (
          <MLMarker
            id="atlas-commit-candidate"
            lngLat={[candidate.lng, candidate.lat]}
          >
            <CandidateMarker />
          </MLMarker>
        ) : null}
      </MLMap>
    </View>
  );
}

/**
 * The red drop-pin shown in commit-mode at the tapped coords. Larger
 * than peer pins so it reads as "you are about to anchor a step here."
 */
function CandidateMarker() {
  return (
    <View style={styles.candidatePin}>
      <View style={styles.candidatePinInner} />
    </View>
  );
}

/**
 * Approximate distance in km between two lng/lat pairs (haversine simplified
 * for the bbox scale we care about — < 50km).
 */
function approxDistanceKm(a: AtlasPinSpec, b: AtlasPinSpec): number {
  const dLat = (b.lat - a.lat) * 111;
  const dLng = (b.lng - a.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Per design rule §1 (LABEL LEGIBILITY): at z11 with >8 POI labels in 2km,
 * hide labels until tap or zoom. We approximate that here without a live
 * zoom signal by checking POI density — if the pin has 3+ POI neighbors
 * within 2km, suppress its label.
 *
 * Peer pins, candidate, race-marks never have labels in this grammar (the
 * label slot is reserved for institution POI names).
 */
function shouldShowLabel(pin: AtlasPinSpec, allPins: AtlasPinSpec[]): boolean {
  if (!pin.label) return false;
  // Diamond curation pins (preceptor, sim-lab) always show their label —
  // they're intentional faculty/institutional guidance, named by design.
  // The label-hide-when-dense rule applies only to interchangeable
  // institution circles (club / racing_area / hospital).
  if (pin.kind === 'poi-preceptor' || pin.kind === 'poi-sim-lab') return true;
  const isPoi = pin.kind.startsWith('poi-');
  if (!isPoi) return false;
  let nearbyPoiCount = 0;
  for (const other of allPins) {
    if (other === pin) continue;
    if (!other.kind.startsWith('poi-')) continue;
    if (approxDistanceKm(pin, other) < 2) nearbyPoiCount += 1;
    if (nearbyPoiCount >= 3) return false;
  }
  return true;
}

function pickSvgMap(frame: AtlasFrameId): React.ComponentType {
  switch (frame) {
    case 'f1':
      return HongKongOverviewMap;
    case 'f2':
      return RaceMarksZoomMap;
    case 'f3':
      return WorldDragonMap;
    case 'f4':
      return BaltimoreColdMap;
    case 'f5':
      return JhuCuratedMap;
    case 'f6':
      return CommitHarbourMap;
    case 'f7':
      // No SVG mock for the Ranchi rural frame — design pass landed
      // after the SVG era. Web fallback returns the world map so the
      // route still renders something non-blank; native uses MapLibre.
      return WorldDragonMap;
  }
}

/**
 * Pin grammar — three distinct shape vocabularies live on one canvas
 * without icon-vocabulary inflation:
 *
 *   • Circle = relationship (color-coded by relationship)
 *   • Diamond = human curation (purple preceptor, green mentor, purple sim-lab)
 *   • Numbered amber = race / coral drop = candidate
 *
 * POIs are circles differentiated by the iOS systemBlue color (institutions
 * are blue) — adding diamond/triangle for them was tested and rejected.
 * Diamond is reserved for curation (faculty-marked guided pins).
 */
type PinShape = 'circle' | 'diamond' | 'numbered' | 'drop';

/**
 * Cohort heatmap color palette by dominant competency cluster — coral
 * for cardiac, slate for respiratory, amber for medication, neutral for
 * general/unknown. Per the design's "color encodes competency, not
 * relationship" rule for the F4 z14+ glow. Lowered to 0.38 alpha so
 * institution circles + preceptor diamonds still read on top — cohort
 * cells are background context, not foreground pins.
 */
const COHORT_CLUSTER_TONE: Record<string, string> = {
  cardiac: 'rgba(255, 99, 99, 0.38)',
  respiratory: 'rgba(90, 130, 200, 0.38)',
  medication: 'rgba(255, 180, 80, 0.38)',
  general: 'rgba(140, 140, 150, 0.30)',
};

const PIN_TONE: Record<
  AtlasPinSpec['kind'],
  { size: number; color: string; shape: PinShape }
> = {
  // Relationships — circles
  you: { size: 14, color: '#FF3B30', shape: 'circle' },
  crew: { size: 11, color: '#FF3B30', shape: 'circle' },
  fleet: { size: 10, color: 'rgba(40, 50, 70, 0.85)', shape: 'circle' },
  following: { size: 8, color: 'rgba(60, 70, 90, 0.55)', shape: 'circle' },
  own: { size: 10, color: 'rgba(0, 122, 255, 0.9)', shape: 'circle' },
  // Compose-at-location: coral drop (per design grammar key)
  candidate: { size: 22, color: '#FF3B30', shape: 'drop' },
  // Race marks: numbered amber
  'race-mark': { size: 16, color: '#E07A3C', shape: 'numbered' },
  // Institution POIs — circles, iOS systemBlue
  'poi-club': { size: 14, color: 'rgba(0, 122, 255, 0.95)', shape: 'circle' },
  'poi-racing-area': { size: 11, color: 'rgba(0, 122, 255, 0.65)', shape: 'circle' },
  'poi-hospital': { size: 14, color: 'rgba(0, 122, 255, 0.95)', shape: 'circle' },
  // Curation pins — diamonds. Sim-lab is institutional but reads as
  // "rehearse-here," which is curation-adjacent enough that the design
  // commits it to the diamond vocabulary alongside preceptor pins.
  'poi-sim-lab': { size: 12, color: 'rgba(155, 92, 246, 0.95)', shape: 'diamond' },
  'poi-preceptor': { size: 13, color: 'rgba(155, 92, 246, 0.95)', shape: 'diamond' },
  // Walk-time annotation — no pin glyph at all, just a grey distance pill
  // floating between two same-campus institution pins. The 0-size sentinel
  // keeps it out of cluster math and shouldShowLabel; rendering handled
  // inline as a label-only marker.
  'walk-annotation': { size: 0, color: 'transparent', shape: 'circle' },
  // Wind arrow — directional sprite, richer blue so the field reads as
  // present without competing with POI label pills. Heading + knots come
  // in via the label field ("degrees|knots").
  'wind-arrow': { size: 14, color: 'rgba(0, 122, 255, 0.7)', shape: 'circle' },
  // Tide / current arrow — teal, distinct from wind. Arrow points the
  // direction water FLOWS (set), not where it comes from. Slightly
  // smaller to read as the secondary field.
  'tide-arrow': { size: 12, color: 'rgba(0, 168, 168, 0.75)', shape: 'circle' },
  // Cohort heatmap cell — semi-transparent disc rendered with a count
  // label. Color encodes the dominant competency cluster; the renderer
  // overrides the PIN_TONE color with a per-cluster shade. Size scales
  // with step_count downstream.
  'cohort-cell': { size: 36, color: 'rgba(120, 120, 130, 0.35)', shape: 'circle' },
};

/**
 * Pin + optional inline label. POIs read with their name (e.g. "RHKYC")
 * next to the dot so the map is legible at zoom 11 where pins would
 * otherwise cluster as anonymous blobs.
 */
function LabeledPin({
  kind,
  label,
  clusterCount,
  showLabel = true,
}: {
  kind: AtlasPinSpec['kind'];
  label?: string;
  clusterCount?: number;
  /** When false, suppress the label pill — used for label-hide-until-tap at z11+. */
  showLabel?: boolean;
}) {
  // Walk-annotation renders as a small grey pill at the midpoint between
  // two same-campus pins — no dot glyph, just the label.
  if (kind === 'walk-annotation') {
    return label ? (
      <View style={styles.walkAnnotation}>
        <Text style={styles.walkAnnotationText}>{label}</Text>
      </View>
    ) : null;
  }
  // Wind-arrow renders as a soft rotated chevron pointing downwind.
  // label encodes "degrees|knots"; the wind direction is "from-X" in
  // nautical convention, so the arrow points to (degrees + 180) % 360.
  if (kind === 'wind-arrow') {
    const [degStr] = (label ?? '0|0').split('|');
    const fromDeg = Number(degStr) || 0;
    const downwindDeg = (fromDeg + 180) % 360;
    return (
      <View style={[styles.windArrow, { transform: [{ rotate: `${downwindDeg}deg` }] }]}>
        <Ionicons name="arrow-up" size={20} color="rgba(0, 122, 255, 0.78)" />
      </View>
    );
  }
  if (kind === 'tide-arrow') {
    // Tide convention: "set" — arrow points where water FLOWS, no flip.
    const [degStr] = (label ?? '0|0').split('|');
    const setDeg = Number(degStr) || 0;
    return (
      <View style={[styles.tideArrow, { transform: [{ rotate: `${setDeg}deg` }] }]}>
        <Ionicons name="chevron-up" size={20} color="rgba(0, 168, 168, 0.85)" />
      </View>
    );
  }
  if (kind === 'cohort-cell') {
    // label encodes "count|cluster". Color comes from the cluster,
    // diameter scales with count (clamped). Center text shows the count.
    // Tighter min size + softer border so the cell reads as a background
    // density zone rather than a foreground pin.
    const [countStr, cluster] = (label ?? '0|general').split('|');
    const count = Number(countStr) || 0;
    const diameter = Math.min(54, 20 + count * 3.5);
    return (
      <View
        style={{
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: COHORT_CLUSTER_TONE[cluster] ?? COHORT_CLUSTER_TONE.general,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.6)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={styles.cohortCount}>{count}</Text>
      </View>
    );
  }
  const tone = PIN_TONE[kind];
  return (
    <View style={styles.pinRow}>
      <PinGlyph
        shape={tone.shape}
        size={tone.size}
        color={tone.color}
        clusterCount={clusterCount}
      />
      {showLabel && label ? (
        <Text style={styles.pinLabel} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

function PinGlyph({
  shape,
  size,
  color,
  clusterCount,
}: {
  shape: PinShape;
  size: number;
  color: string;
  clusterCount?: number;
}) {
  // Cluster badge: 5+ peer pins in 2km merge to "+N" per the design's
  // cluster-behavior rule. Cluster pins always render as a circle with
  // a number inside, regardless of the underlying relationship.
  if (clusterCount != null) {
    return (
      <View
        style={{
          minWidth: 22,
          height: 22,
          borderRadius: 11,
          paddingHorizontal: 4,
          backgroundColor: color,
          borderWidth: 1.5,
          borderColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={styles.clusterCount}>+{clusterCount}</Text>
      </View>
    );
  }
  if (shape === 'diamond') {
    // 45° rotated square — the curation grammar (preceptor, sim-lab).
    return (
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          borderWidth: 1.5,
          borderColor: '#FFFFFF',
          transform: [{ rotate: '45deg' }],
        }}
      />
    );
  }
  if (shape === 'numbered') {
    // Numbered amber for race marks. Number content sits in label slot;
    // glyph itself is a small amber square outline.
    return (
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          borderWidth: 1.5,
          borderColor: '#FFFFFF',
          borderRadius: 3,
        }}
      />
    );
  }
  if (shape === 'drop') {
    // Coral drop-pin for compose-at-location candidate. Teardrop hint via
    // larger size + heavier shadow handled in the consuming caller; the
    // glyph stays a thick-bordered circle for now.
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: 3,
          borderColor: '#FFFFFF',
        }}
      />
    );
  }
  // Default: circle (relationship grammar)
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
      }}
    />
  );
}

/**
 * Inline amber NEXT pill — the only Atlas accent that uses amber per
 * the canonical grammar. The outer MLMarker handles geographic
 * anchoring; this component is purely visual.
 */
function NextEventMarker({ label, when }: { label: string; when?: string }) {
  const eyebrow = `NEXT · ${label.toUpperCase()}${when ? ` · ${when.toUpperCase()}` : ''}`;
  return (
    <View style={styles.nextTag}>
      <Text style={styles.nextTagEyebrow} numberOfLines={1}>
        {eyebrow}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  pinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1C1C1E',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    maxWidth: 120,
    overflow: 'hidden',
  },
  clusterCount: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  walkAnnotation: {
    backgroundColor: 'rgba(118, 118, 128, 0.92)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  walkAnnotationText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  windArrow: {
    width: 20,
    height: 20,
    opacity: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tideArrow: {
    width: 20,
    height: 20,
    opacity: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cohortCount: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(28, 28, 30, 0.9)',
    letterSpacing: 0.2,
  },
  nextTag: {
    backgroundColor: '#FFE6B0',
    borderColor: '#F0A93A',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    shadowColor: '#F0A93A',
    shadowOpacity: 0.45,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  nextTagEyebrow: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8A4B00',
    letterSpacing: 0.7,
  },
  candidatePin: {
    width: 26,
    height: 32,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  candidatePinInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF3B30',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
});
