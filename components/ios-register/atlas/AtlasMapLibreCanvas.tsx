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
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
} from 'react-native';
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
import {
  SAILING_MAP_STYLE,
  NURSING_MAP_STYLE,
  ENTREPRENEUR_MAP_STYLE,
} from '@/lib/atlas-map-styles';

// Per-frame base map style. Sailing frames keep Liberty (water/land
// contrast matters when reading wind/tide over the harbor). Nursing
// and entrepreneur frames switch to Positron — much fewer commercial
// POI labels so cohort heatmap + walk-time annotations breathe.
//
// All three styles are free, no API key. See:
//   https://openfreemap.org/quick_start/
//
// Future: when sailing gets a proper nautical chart base (OpenSeaMap
// overlay or custom MapLibre style with bathymetry), swap that in here
// for f1/f2/f6 without touching the canvas.
const MAP_STYLE_POSITRON = 'https://tiles.openfreemap.org/styles/positron';

function mapStyleForFrame(frame: AtlasFrameId): string | object {
  // Sailing — custom brand-palette: cream land + soft blue water, no
  // labels/roads. Lets race-marks + wind/tide arrows + POI pins dominate.
  if (frame === 'f1' || frame === 'f2' || frame === 'f3' || frame === 'f6') {
    return SAILING_MAP_STYLE;
  }
  // Nursing — quiet urban: cream land + faint major roads + building
  // footprints at z13+. Cohort heatmap + preceptor diamonds dominate.
  if (frame === 'f4' || frame === 'f5') {
    return NURSING_MAP_STYLE;
  }
  // Entrepreneur — sparse rural: cream land + rivers + faint road net.
  if (frame === 'f7') {
    return ENTREPRENEUR_MAP_STYLE;
  }
  return MAP_STYLE_POSITRON;
}

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
    | 'poi-club-anchor'
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
  /**
   * Competency-evidence glow cluster — when set on an institution POI
   * (hospital/club), the renderer paints a soft aura behind the pin in
   * the cluster's color (cardiac/respiratory/medication/general). Set
   * by useCompetencyGlow which projects cohort heatmap dominant clusters
   * onto nearby POIs.
   */
  glowCluster?: string;
  /**
   * Optional secondary line surfaced when the pin is tapped (e.g. mark
   * type for race-marks: "Windward · Mark 1"). Renderer doesn't show it
   * inline — it's read by the consuming frame to populate detail sheets.
   */
  subtitle?: string;
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
  /**
   * Fires when a pin is tapped. The whole pin spec is passed back so
   * the consuming frame can decide what to do (e.g. open a race-mark
   * detail sheet, focus a peer profile, etc.). Pin tap only fires for
   * pins that have a tappable kind — wind/tide/cohort/walk-annotation
   * are decorative and ignored.
   */
  onPinPress?: (pin: AtlasPinSpec) => void;
}

/**
 * Pin kinds that fire onPinPress when tapped. Decorative overlays
 * (wind/tide arrows, cohort cells, walk annotations) are excluded so
 * a stray tap on the wind field doesn't open a sheet.
 */
const TAPPABLE_PIN_KINDS = new Set<AtlasPinSpec['kind']>([
  'race-mark',
  'you',
  'crew',
  'fleet',
  'following',
  'own',
  'poi-club',
  'poi-club-anchor',
  'poi-racing-area',
  'poi-hospital',
  'poi-sim-lab',
  'poi-preceptor',
]);

export function AtlasMapLibreCanvas({
  frame,
  pins = [],
  nextEvent,
  onMapPress,
  candidate,
  onPinPress,
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
        mapStyle={mapStyleForFrame(frame)}
        style={styles.fill}
        onPress={onMapPress ? handlePress : undefined}
        attribution={false}
        logo={false}
      >
        <MLCamera
          initialViewState={{
            center: camera.center,
            zoom: camera.zoom,
          }}
        />

        {pins.map((pin) => {
          const isTappable = Boolean(onPinPress) && TAPPABLE_PIN_KINDS.has(pin.kind);
          const inner = (
            <LabeledPin
              kind={pin.kind}
              label={pin.label}
              clusterCount={pin.clusterCount}
              glowCluster={pin.glowCluster}
              showLabel={shouldShowLabel(pin, pins)}
            />
          );
          return (
            <MLMarker key={pin.id} id={pin.id} lngLat={[pin.lng, pin.lat]}>
              {isTappable ? (
                <Pressable onPress={() => onPinPress?.(pin)} hitSlop={6}>
                  {inner}
                </Pressable>
              ) : (
                inner
              )}
            </MLMarker>
          );
        })}

        {nextEvent ? (
          <MLMarker
            id="atlas-next-event"
            lngLat={[nextEvent.lng, nextEvent.lat]}
          >
            {/* pointerEvents=none so the amber pill doesn't swallow taps
                on the +N peer cluster / race-marks underneath when they
                share a venue coord. The pill is informational, not a
                tap target — tapping the NEXT card belongs to the sheet. */}
            <View pointerEvents="none">
              <NextEventMarker label={nextEvent.label} when={nextEvent.when} />
            </View>
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
  // "Your base" club — anchor icon, deeper navy. Distinct from generic
  // institution circles so the user's home club reads as "this is mine".
  'poi-club-anchor': { size: 22, color: 'rgba(28, 28, 56, 0.95)', shape: 'circle' },
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
  glowCluster,
  showLabel = true,
}: {
  kind: AtlasPinSpec['kind'];
  label?: string;
  clusterCount?: number;
  glowCluster?: string;
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
  // "Your base" club anchor — render as anchor icon glyph inside a
  // dark navy disc. Reads distinctly from generic blue institution
  // circles so the user's home club stands out.
  if (kind === 'poi-club-anchor') {
    return (
      <View style={styles.pinRow}>
        <View style={styles.clubAnchorDisc}>
          <Ionicons name="boat" size={14} color="#FFFFFF" />
        </View>
        {showLabel && label ? (
          <Text style={[styles.pinLabel, styles.clubAnchorLabel]} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </View>
    );
  }
  if (kind === 'wind-arrow') {
    const [degStr, knotsStr] = (label ?? '0|0').split('|');
    const fromDeg = Number(degStr) || 0;
    const downwindDeg = (fromDeg + 180) % 360;
    const knots = Number(knotsStr) || 0;
    return (
      <View style={styles.windArrowWrap}>
        <View style={[styles.arrowDisc, { transform: [{ rotate: `${downwindDeg}deg` }] }]}>
          <Ionicons name="arrow-up" size={32} color="rgba(0, 122, 255, 0.95)" />
        </View>
        {knots > 0 ? (
          <Text style={styles.arrowChip}>{`${Math.round(knots)} kn`}</Text>
        ) : null}
      </View>
    );
  }
  if (kind === 'tide-arrow') {
    // Tide convention: "set" — arrow points where water FLOWS, no flip.
    const [degStr, knotsStr] = (label ?? '0|0').split('|');
    const setDeg = Number(degStr) || 0;
    const knots = Number(knotsStr) || 0;
    return (
      <View style={styles.tideArrowWrap}>
        <View style={[styles.arrowDisc, { transform: [{ rotate: `${setDeg}deg` }] }]}>
          <Ionicons name="chevron-up" size={32} color="rgba(0, 168, 168, 0.95)" />
        </View>
        {knots > 0 ? (
          <Text style={styles.arrowChip}>{`${knots.toFixed(1)} kn`}</Text>
        ) : null}
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
  const glowColor = glowCluster ? COHORT_CLUSTER_TONE[glowCluster] : undefined;
  return (
    <View style={styles.pinRow}>
      <View style={styles.glyphCol}>
        {glowColor ? (
          <View
            pointerEvents="none"
            style={[
              styles.glowAura,
              { backgroundColor: glowColor },
            ]}
          />
        ) : null}
        <PinGlyph
          shape={tone.shape}
          size={tone.size}
          color={tone.color}
          clusterCount={clusterCount}
        />
      </View>
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
  clubAnchorDisc: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(28, 28, 56, 0.95)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  clubAnchorLabel: {
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontSize: 9,
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
  windArrowWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tideArrowWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  arrowChip: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '700',
    color: '#1C1C1E',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: 'hidden',
  },
  cohortCount: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(28, 28, 30, 0.9)',
    letterSpacing: 0.2,
  },
  glyphCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowAura: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    top: -9,
    left: -9,
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
