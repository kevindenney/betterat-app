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
    | 'poi-sim-lab';
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
            <View style={pinStyle(pin.kind)} />
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
  }
}

const PIN_TONE: Record<AtlasPinSpec['kind'], { size: number; color: string }> = {
  you: { size: 14, color: '#FF3B30' },
  crew: { size: 11, color: '#FF3B30' },
  fleet: { size: 10, color: 'rgba(40, 50, 70, 0.85)' },
  following: { size: 8, color: 'rgba(60, 70, 90, 0.55)' },
  own: { size: 10, color: 'rgba(0, 122, 255, 0.9)' },
  candidate: { size: 22, color: '#FF3B30' },
  'race-mark': { size: 8, color: '#E07A3C' },
  // Institution POIs read as the canonical iOS systemBlue, sized larger
  // than peer pins so "place" reads distinct from "person." Sim-lab uses
  // purple to differentiate practice-here from do-it-here per the brief.
  'poi-club': { size: 14, color: 'rgba(0, 122, 255, 0.95)' },
  'poi-racing-area': { size: 11, color: 'rgba(0, 122, 255, 0.65)' },
  'poi-hospital': { size: 14, color: 'rgba(0, 122, 255, 0.95)' },
  'poi-sim-lab': { size: 12, color: 'rgba(155, 92, 246, 0.95)' },
};

function pinStyle(kind: AtlasPinSpec['kind']) {
  const tone = PIN_TONE[kind];
  return {
    width: tone.size,
    height: tone.size,
    borderRadius: tone.size / 2,
    backgroundColor: tone.color,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  };
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
