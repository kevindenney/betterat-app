/**
 * AtlasMapLibreCanvas — real MapLibre canvas for the Atlas tab.
 *
 * Replaces the static SVG `HongKongOverviewMap` (and friends) with a live
 * tile-rendered map. Pins, the next-event tag, racing-area tags, and the
 * ghost cohort stamp all become MLMarker children — same vocabulary, real
 * geography.
 *
 * Wire-up status (v1):
 *   • Native and web both render live MapLibre tiles. Web loads
 *     maplibre-gl lazily so the Atlas route can run in Expo web.
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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  GeoJSONSource as MLGeoJSONSource,
  Layer as MLLayer,
  type CameraRef,
  type MapRef,
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
import { ensureMapLibreCss, ensureMapLibreScript } from '@/lib/maplibreWeb';
import { windColorForKnots } from '@/lib/wind-color';
import { useAtlasRacingAreas } from '@/hooks/useAtlasRacingAreas';
import { useUserBoatClasses } from '@/hooks/useUserBoatClasses';
import { useVocabulary } from '@/hooks/useVocabulary';

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

export type AtlasBasemap = 'map' | 'satellite' | 'nautical';

const SATELLITE_MAP_STYLE = {
  version: 8 as const,
  name: 'BetterAt · Satellite',
  sources: {
    esri: {
      type: 'raster' as const,
      tiles: [
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Tiles · Esri',
    },
  },
  layers: [
    {
      id: 'esri-satellite',
      type: 'raster' as const,
      source: 'esri',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

const NAUTICAL_MAP_STYLE = {
  version: 8 as const,
  name: 'BetterAt · Nautical',
  sources: {
    osm: {
      type: 'raster' as const,
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap',
    },
    seamarks: {
      type: 'raster' as const,
      tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenSeaMap',
    },
  },
  layers: [
    {
      id: 'osm-base',
      type: 'raster' as const,
      source: 'osm',
      minzoom: 0,
      maxzoom: 22,
      paint: { 'raster-opacity': 0.92 },
    },
    {
      id: 'seamarks',
      type: 'raster' as const,
      source: 'seamarks',
      minzoom: 0,
      maxzoom: 22,
      paint: { 'raster-opacity': 0.9 },
    },
  ],
};

function mapStyleForFrame(frame: AtlasFrameId, basemap: AtlasBasemap = 'map'): string | object {
  if (basemap === 'satellite') return SATELLITE_MAP_STYLE;
  if (basemap === 'nautical') return NAUTICAL_MAP_STYLE;
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
  // F4 default centers on JHSON's east-Baltimore campus so Pinkard SIM,
  // JHH, the preceptor diamonds, and the active cohort cells all land in
  // the first-load view. Wider 11.x zoom hid Emily's base entirely.
  f4: { center: [-76.591, 39.297], zoom: 13.4 },       // JHSON · JHH campus
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
    | 'poi-marina'
    | 'poi-sail-loft'
    | 'poi-chandler'
    | 'poi-hospital'
    | 'poi-sim-lab'
    | 'poi-sim-anchor'
    | 'poi-preceptor'
    | 'poi-haat'
    | 'poi-supplier'
    | 'poi-mentee'
    | 'poi-home-anchor'
    | 'walk-annotation'
    | 'wind-arrow'
    | 'tide-arrow'
    | 'cohort-cell'
    // Phase A — viewer's own steps, status-encoded:
    // next            → large blue dot + amber halo, "NEXT" badge — the
    //                   step to the right of the timeline NOW bar.
    // planned-week    → hollow blue circle + day-of-week badge ("MON")
    // done-just       → solid blue dot + green halo — the step just
    //                   completed (left of NOW).
    // done-recent     → solid blue dot, no label
    // done-old        → tiny faint blue ring (>7 days ago, ≤30d)
    | 'my-step-next'
    | 'my-step-planned'
    | 'my-step-done-just'
    | 'my-step-done-recent'
    | 'my-step-done-old';
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
  /**
   * Optional provenance line surfaced beneath the subtitle in the pin's
   * detail sheet ("Set by RHKYC race officer · marks are read-only").
   * Lets the user answer "who put this here, can I move it" without a
   * separate tap. Currently used by race-marks.
   */
  provenance?: string;
  /** Organization backing this place pin, when the POI is claimed. */
  orgId?: string | null;
  /** Slug for the public organization route, e.g. /organizations/rhkyc. */
  orgSlug?: string | null;
  /**
   * Phase A — viewer's own step reference. When set, tapping the pin
   * opens that step in the live tab (via onPinPress → AtlasScreen which
   * forwards to handlers.onSecondaryAction with the id). Only populated
   * for my-step-* kinds.
   */
  stepId?: string;
  /**
   * Optional connector line for non-pin annotations such as walk-time
   * labels. Coordinates are [lng, lat]. The map renders these as dashed
   * GeoJSON line features beneath markers.
   */
  walkLine?: {
    from: [number, number];
    to: [number, number];
  };
}

interface AtlasMapLibreCanvasProps {
  frame: AtlasFrameId;
  /** Optional peer pin list — empty in cold-start. */
  pins?: AtlasPinSpec[];
  /** Optional point to fly the map toward after mount. */
  focusLocation?: { lng: number; lat: number } | null;
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
   * pins that have a tappable kind — wind/tide/walk-annotation are
   * decorative and ignored. Cohort cells ARE tappable so the consumer
   * can surface "10 steps · 8 heart-failure · you haven't been here."
   */
  onPinPress?: (pin: AtlasPinSpec) => void;
  /**
   * Fires when the amber NEXT pill is tapped. Opens the "tomorrow at X"
   * sheet so the user can prep — checklist, cohort context, plan-a-step.
   */
  onNextEventPress?: () => void;
  /**
   * F1/F6 "Race areas" toggle — renders soft polygons over the canonical
   * HK racing zones (Victoria Harbour, Port Shelter, Middle Island
   * Channel) so the sailor sees where racing happens at country zoom.
   */
  showRaceAreas?: boolean;
  /**
   * Fires when the user long-presses the map. Atlas uses this to open
   * the racing-area create sheet — the user marks where racing happens
   * even when their club isn't yet in BetterAt.
   */
  onMapLongPress?: (coords: { lng: number; lat: number }) => void;
  /**
   * Transient preview polygon rendered while the racing-area create
   * sheet is open. The sheet computes the polygon from its current
   * shape state (circle, rectangle, …) so the canvas needs no
   * shape-specific code paths.
   */
  racingAreaPreviewPolygon?: GeoJSON.Polygon | null;
  /**
   * Fires after a pan/zoom gesture settles. Atlas uses this to keep
   * wind/tide overlays anchored to whatever water the user is looking
   * at, refetching marine conditions for the new center.
   */
  onMapCenterChange?: (coords: { lng: number; lat: number }) => void;
  /** Base map style used by web and native MapLibre surfaces. */
  basemap?: AtlasBasemap;
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
  'poi-marina',
  'poi-sail-loft',
  'poi-chandler',
  'poi-hospital',
  'poi-sim-lab',
  'poi-sim-anchor',
  'poi-preceptor',
  'poi-haat',
  'poi-supplier',
  'poi-mentee',
  'poi-home-anchor',
  'cohort-cell',
  'my-step-next',
  'my-step-planned',
  'my-step-done-just',
  'my-step-done-recent',
  'my-step-done-old',
]);

export function AtlasMapLibreCanvas({
  frame,
  pins = [],
  focusLocation = null,
  nextEvent,
  onMapPress,
  candidate,
  onPinPress,
  showRaceAreas = false,
  onNextEventPress,
  onMapLongPress,
  racingAreaPreviewPolygon = null,
  onMapCenterChange,
  basemap = 'map',
}: AtlasMapLibreCanvasProps) {
  // Hooks first, then early returns — rules-of-hooks compliance.
  const cameraRef = useRef<CameraRef>(null);
  const mapRef = useRef<MapRef>(null);
  const baseCamera = FRAME_CAMERA[frame];
  // Track map bearing so a compass affordance can surface when the
  // user has rotated the map off north — matches Apple Maps' pattern
  // (no compass when north-aligned, compass appears on rotation).
  // Note: MapLibre RN v11 uses `bearing` (not `heading`) on both the
  // region event payload and the camera options. `setCamera` doesn't
  // exist on this bridge version — `setStop` is the equivalent.
  // We read bearing via `mapRef.getBearing()` (async, reliable) instead
  // of the event payload, because the legacy/Fabric bridge field shape
  // for `event.nativeEvent.bearing` is brittle between RN architectures.
  const [bearing, setBearing] = useState(0);
  const pollBearing = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
    void m.getBearing().then((b: number) => {
      if (typeof b !== 'number' || !Number.isFinite(b)) return;
      const norm = ((b + 180) % 360 + 360) % 360 - 180;
      setBearing(norm);
    });
  }, []);
  const resetBearing = useCallback(() => {
    void cameraRef.current?.setStop({ bearing: 0, duration: 300 });
    setBearing(0);
  }, []);
  const { classes: userBoatClasses } = useUserBoatClasses();
  const { featureCollection: raceAreasCollection } = useAtlasRacingAreas({
    centerLng: baseCamera.center[0],
    centerLat: baseCamera.center[1],
    enabled: showRaceAreas,
    userClasses: userBoatClasses,
  });
  // Cluster pill noun varies by interest — sailors read "session", nurses
  // "shift", generic users "log". Default ("step") is platform jargon.
  const { vocab } = useVocabulary();
  const clusterUnit = vocab('Step');

  // Wrap the supplied preview polygon (circle, rectangle, …) in a
  // FeatureCollection so MapLibre can paint it via the same source
  // pattern as the persisted areas. The sheet owns the shape math.
  // Centroids of every racing-area polygon, so we can render labels
  // as MLMarker overlays instead of a MapLibre symbol layer. Native
  // iOS rejected the symbol layer (see feedback_maplibre_native_strict_expressions),
  // and overlay text bypasses that path entirely while still reading
  // correctly over the tan fill thanks to the white-pill background.
  const racingAreaLabels = useMemo<
    { id: string; name: string; lng: number; lat: number }[]
  >(() => {
    const out: { id: string; name: string; lng: number; lat: number }[] = [];
    for (const feature of raceAreasCollection.features) {
      const geom = feature.geometry;
      if (!geom || geom.type !== 'Polygon') continue;
      const ring = geom.coordinates[0];
      if (!ring || ring.length === 0) continue;
      let lngSum = 0;
      let latSum = 0;
      for (const [lng, lat] of ring) {
        lngSum += lng;
        latSum += lat;
      }
      const name = (feature.properties as { id?: string; name?: string } | null)?.name;
      const id = (feature.properties as { id?: string } | null)?.id;
      if (!name || !id) continue;
      out.push({
        id,
        name,
        lng: lngSum / ring.length,
        lat: latSum / ring.length,
      });
    }
    return out;
  }, [raceAreasCollection]);
  const racingAreaPreviewCollection = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!racingAreaPreviewPolygon) return null;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: racingAreaPreviewPolygon,
        },
      ],
    };
  }, [racingAreaPreviewPolygon]);
  const handlePress = useCallback(
    (event: NativeSyntheticEvent<PressEvent>) => {
      if (!onMapPress) return;
      const [lng, lat] = event.nativeEvent.lngLat;
      onMapPress({ lng, lat });
    },
    [onMapPress],
  );
  const handleLongPress = useCallback(
    (event: NativeSyntheticEvent<PressEvent>) => {
      if (!onMapLongPress) return;
      const [lng, lat] = event.nativeEvent.lngLat;
      onMapLongPress({ lng, lat });
    },
    [onMapLongPress],
  );
  // Trailing-debounce the map-center update. iOS native MapLibre's
  // onRegionDidChange is unreliable for user-pan gestures on this
  // bridge version, so we listen to onRegionIsChanging (fires through-
  // out the pan) and wait for a 300ms quiet period before committing.
  // This guarantees we capture the *final* settled position, not an
  // intermediate one — a rate-limit throttle silently dropped the last
  // event on long pans, leaving the snapshot ~300m behind the camera.
  const pendingCenterRef = useRef<{ lng: number; lat: number } | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleRegionChange = useCallback(
    (event: NativeSyntheticEvent<{ center: [number, number] }>) => {
      // Always poll the map's bearing — reading from the event payload
      // was unreliable across legacy/Fabric bridges; the async ref read
      // is the source of truth.
      pollBearing();
      if (!onMapCenterChange) return;
      const [lng, lat] = event.nativeEvent.center;
      pendingCenterRef.current = { lng, lat };
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        const next = pendingCenterRef.current;
        if (!next) return;
        if (__DEV__) console.warn(`[atlas-ios] region settled → lat=${next.lat.toFixed(4)} lng=${next.lng.toFixed(4)}`);
        onMapCenterChange(next);
      }, 300);
    },
    [onMapCenterChange, pollBearing],
  );
  useEffect(() => {
    // Clean up any pending debounce on unmount so a late timer doesn't
    // call setMapCenter on a stale component.
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);
  // Recenter the camera on the tapped pin and reserve screen space for
  // the top chrome (filter chips) and the bottom sheet that will pop
  // open. MapLibre's `padding` insets shift the *visual center* away
  // from the geometric center — `padding.bottom: 380` tells the camera
  // to ignore the bottom ~380px (where the sheet sits), so the pin
  // lands in the middle of the remaining top band. `padding.top: 120`
  // does the same for the floating chrome. This is zoom-independent,
  // unlike the lat-offset approach.
  const handlePinTap = useCallback(
    (pin: AtlasPinSpec) => {
      onPinPress?.(pin);
      cameraRef.current?.flyTo({
        center: [pin.lng, pin.lat],
        padding: { top: 120, bottom: 380 },
        duration: 400,
      });
    },
    [onPinPress],
  );
  useEffect(() => {
    if (!focusLocation) return;
    cameraRef.current?.flyTo({
      center: [focusLocation.lng, focusLocation.lat],
      zoomLevel: 14,
      padding: { top: 120, bottom: 380 },
      duration: 500,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLocation?.lat, focusLocation?.lng]);
  const walkLineCollection = useMemo<GeoJSON.FeatureCollection>(() => {
    const features: GeoJSON.Feature[] = pins
      .filter((pin) => pin.kind === 'walk-annotation' && pin.walkLine)
      .map((pin) => ({
        type: 'Feature',
        id: pin.id,
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: [pin.walkLine!.from, pin.walkLine!.to],
        },
      }));
    return { type: 'FeatureCollection', features };
  }, [pins]);

  if (Platform.OS === 'web') {
    return (
      <WebAtlasMapLibreCanvas
        frame={frame}
        pins={pins}
        focusLocation={focusLocation}
        nextEvent={nextEvent}
        onMapPress={onMapPress}
        candidate={candidate}
        onPinPress={onPinPress}
        showRaceAreas={showRaceAreas}
        onNextEventPress={onNextEventPress}
        onMapCenterChange={onMapCenterChange}
        basemap={basemap}
        baseCamera={baseCamera}
        walkLineCollection={walkLineCollection}
        raceAreasCollection={raceAreasCollection}
      />
    );
  }

  return (
    <View style={styles.fill}>
      <MLMap
        ref={mapRef}
        mapStyle={mapStyleForFrame(frame, basemap)}
        style={styles.fill}
        onPress={onMapPress ? handlePress : undefined}
        onLongPress={onMapLongPress ? handleLongPress : undefined}
        // Always wire — handleRegionChange also tracks bearing for the
        // compass affordance, so we want it firing even when no consumer
        // is subscribed to map-center updates.
        onRegionIsChanging={handleRegionChange}
        onRegionDidChange={handleRegionChange}
        attribution={false}
        logo={false}
      >
        <MLCamera
          ref={cameraRef}
          initialViewState={{
            center: baseCamera.center,
            zoom: baseCamera.zoom,
          }}
        />

        {walkLineCollection.features.length > 0 ? (
          <MLGeoJSONSource id="atlas-walk-lines" data={walkLineCollection}>
            <MLLayer
              id="atlas-walk-lines-layer"
              type="line"
              style={{
                lineColor: 'rgba(118, 118, 128, 0.55)',
                lineWidth: 1,
                lineOpacity: 0.8,
                lineDasharray: [2, 2],
              }}
            />
          </MLGeoJSONSource>
        ) : null}

        {/* Race-area fill is split into a constant color + data-driven
            opacity expression (defensive coalesce so missing properties
            fall back to 0.20). The earlier bare `['get','fillOpacity']`
            form was rejected by MapLibre Native iOS — coalesce is the
            more universal expression shape and tends to validate. If
            this re-introduction silently breaks iOS rendering again,
            revert to a constant fillColor with embedded alpha; see
            feedback_maplibre_native_strict_expressions for context. */}
        {showRaceAreas ? (
          <MLGeoJSONSource id="atlas-race-areas" data={raceAreasCollection}>
            <MLLayer
              id="atlas-race-areas-fill"
              type="fill"
              style={{
                fillColor: 'rgb(255, 191, 99)',
                fillOpacity: ['coalesce', ['get', 'fillOpacity'], 0.20],
                fillOutlineColor: 'rgba(231, 137, 60, 0.55)',
              }}
            />
          </MLGeoJSONSource>
        ) : null}

        {showRaceAreas
          ? racingAreaLabels.map((label) => (
              <MLMarker
                key={`area-label:${label.id}`}
                id={`atlas-area-label:${label.id}`}
                lngLat={[label.lng, label.lat]}
              >
                <View pointerEvents="none" style={styles.areaLabelPill}>
                  <Text style={styles.areaLabelText} numberOfLines={1}>
                    {label.name}
                  </Text>
                </View>
              </MLMarker>
            ))
          : null}

        {racingAreaPreviewCollection ? (
          <MLGeoJSONSource
            id="atlas-race-area-preview"
            data={racingAreaPreviewCollection}
          >
            <MLLayer
              id="atlas-race-area-preview-fill"
              type="fill"
              style={{
                fillColor: 'rgba(0, 122, 255, 0.12)',
              }}
            />
            <MLLayer
              id="atlas-race-area-preview-outline"
              type="line"
              style={{
                lineColor: 'rgba(0, 122, 255, 0.85)',
                lineWidth: 1.5,
              }}
            />
          </MLGeoJSONSource>
        ) : null}

        {pins.map((pin) => {
          const isTappable = Boolean(onPinPress) && TAPPABLE_PIN_KINDS.has(pin.kind);
          const inner = (
            <LabeledPin
              kind={pin.kind}
              label={pin.label}
              clusterCount={pin.clusterCount}
              clusterUnit={clusterUnit}
              glowCluster={pin.glowCluster}
              showLabel={shouldShowLabel(pin, pins)}
            />
          );
          return (
            <MLMarker key={pin.id} id={pin.id} lngLat={[pin.lng, pin.lat]}>
              {isTappable ? (
                <Pressable onPress={() => handlePinTap(pin)} hitSlop={14}>
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
            {onNextEventPress ? (
              <Pressable onPress={onNextEventPress} hitSlop={4}>
                <NextEventMarker
                  label={nextEvent.label}
                  when={nextEvent.when}
                  conditions={nextEvent.conditions}
                />
              </Pressable>
            ) : (
              // pointerEvents=none so the amber pill doesn't swallow taps
              // on the +N peer cluster / race-marks underneath when they
              // share a venue coord.
              <View pointerEvents="none">
                <NextEventMarker
                  label={nextEvent.label}
                  when={nextEvent.when}
                  conditions={nextEvent.conditions}
                />
              </View>
            )}
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
      {/* Compass — appears only when the map is rotated off north.
          The needle inside rotates with the current bearing so users
          can see how far off they are; tapping snaps back to north.
          Matches Apple Maps' compass-on-rotation pattern. */}
      {Math.abs(bearing) > 1 ? (
        <Pressable
          style={styles.compassButton}
          onPress={resetBearing}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Reset map to north"
        >
          <View style={{ transform: [{ rotate: `${-bearing}deg` }] }}>
            <Ionicons name="navigate" size={18} color="#D44646" />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

function WebAtlasMapLibreCanvas({
  frame,
  pins,
  focusLocation,
  nextEvent,
  onMapPress,
  candidate,
  onPinPress,
  showRaceAreas,
  onNextEventPress,
  onMapCenterChange,
  basemap = 'map',
  baseCamera,
  walkLineCollection,
  raceAreasCollection,
}: AtlasMapLibreCanvasProps & {
  pins: AtlasPinSpec[];
  baseCamera: CameraPreset;
  walkLineCollection: GeoJSON.FeatureCollection;
  raceAreasCollection: GeoJSON.FeatureCollection;
}) {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const maplibreRef = useRef<any>(null);
  const pinMarkersRef = useRef<any[]>([]);
  const areaLabelMarkersRef = useRef<any[]>([]);
  const nextMarkerRef = useRef<any | null>(null);
  const candidateMarkerRef = useRef<any | null>(null);
  const onMapPressRef = useRef(onMapPress);
  const onMapCenterChangeRef = useRef(onMapCenterChange);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [bearing, setBearing] = useState(0);
  const resetBearing = useCallback(() => {
    mapRef.current?.easeTo({ bearing: 0, duration: 300 });
    setBearing(0);
  }, []);

  useEffect(() => {
    onMapPressRef.current = onMapPress;
  }, [onMapPress]);

  useEffect(() => {
    onMapCenterChangeRef.current = onMapCenterChange;
  }, [onMapCenterChange]);

  useEffect(() => {
    let cancelled = false;
    setIsLoaded(false);
    setMapError(null);

    const initialize = async () => {
      try {
        let maplibregl: any = null;
        try {
          const maplibreModule = await import('maplibre-gl');
          maplibregl = (maplibreModule as any).default || maplibreModule;
        } catch (_moduleError) {
          await ensureMapLibreScript('maplibre-gl-script-atlas');
          maplibregl = typeof window !== 'undefined' ? (window as any).maplibregl : null;
        }

        try {
          await import('maplibre-gl/dist/maplibre-gl.css');
        } catch (_cssError) {
          ensureMapLibreCss('maplibre-gl-css-atlas');
        }

        if (cancelled || !containerRef.current) return;
        const MapConstructor = maplibregl?.Map;
        if (!MapConstructor) {
          throw new Error('MapLibre Map constructor is unavailable');
        }

        const map = new MapConstructor({
          container: containerRef.current,
          style: mapStyleForFrame(frame, basemap),
          center: baseCamera.center,
          zoom: baseCamera.zoom,
          attributionControl: false,
          logoPosition: 'bottom-left',
        });

        mapRef.current = map;
        maplibreRef.current = maplibregl;

        map.on('click', (event: any) => {
          onMapPressRef.current?.({ lng: event.lngLat.lng, lat: event.lngLat.lat });
        });

        // Track bearing so a compass affordance can surface only when
        // the user has rotated the map off north.
        map.on('rotate', () => {
          const raw = map.getBearing();
          const norm = ((raw + 180) % 360 + 360) % 360 - 180;
          setBearing(norm);
        });

        map.on('moveend', () => {
          const c = map.getCenter();
          onMapCenterChangeRef.current?.({ lng: c.lng, lat: c.lat });
        });

        map.on('load', () => {
          if (cancelled) return;
          setMapError(null);
          setIsLoaded(true);
        });

        map.on('error', (event: any) => {
          const styleLoaded =
            typeof map.isStyleLoaded === 'function' ? map.isStyleLoaded() : false;
          if (styleLoaded) return;
          const detail = event?.error?.message || event?.message || 'Unknown map error';
          setMapError(detail);
        });
      } catch (error) {
        if (!cancelled) {
          setMapError(error instanceof Error ? error.message : 'Map failed to initialize');
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
      pinMarkersRef.current.forEach((marker) => marker.remove());
      pinMarkersRef.current = [];
      areaLabelMarkersRef.current.forEach((marker) => marker.remove());
      areaLabelMarkersRef.current = [];
      nextMarkerRef.current?.remove();
      nextMarkerRef.current = null;
      candidateMarkerRef.current?.remove();
      candidateMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
    };
  }, [baseCamera.center, baseCamera.zoom, basemap, frame]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded || !focusLocation) return;
    map.easeTo({
      center: [focusLocation.lng, focusLocation.lat],
      zoom: 14,
      padding: { top: 120, bottom: 380 },
      duration: 500,
    });
    // Depend only on the lat/lng values — including the focusLocation
    // object itself causes easeTo to re-fire on every parent render
    // (the parent recreates the object inline), which flies the camera
    // back to its last focus on every state change unrelated to focus.
  }, [focusLocation?.lat, focusLocation?.lng, isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;
    syncGeoJsonLayer(map, 'atlas-web-walk-lines', 'line', walkLineCollection, {
      'line-color': 'rgba(118, 118, 128, 0.55)',
      'line-width': 1,
      'line-opacity': 0.8,
      'line-dasharray': [2, 2],
    });
  }, [isLoaded, walkLineCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    areaLabelMarkersRef.current.forEach((marker) => marker.remove());
    areaLabelMarkersRef.current = [];

    if (!showRaceAreas) {
      removeLayerAndSource(map, 'atlas-web-race-areas-fill', 'atlas-web-race-areas');
      return;
    }

    syncGeoJsonLayer(map, 'atlas-web-race-areas', 'fill', raceAreasCollection, {
      'fill-color': 'rgba(255, 191, 99, 0.20)',
      'fill-outline-color': 'rgba(231, 137, 60, 0.55)',
    });

    const Marker = maplibreRef.current?.Marker;
    if (!Marker) return;
    areaLabelMarkersRef.current = getRacingAreaLabels(raceAreasCollection).map((label) =>
      new Marker({
        element: createWebAreaLabelElement(label.name, () => {
          onMapPressRef.current?.({ lng: label.lng, lat: label.lat });
        }),
      })
        .setLngLat([label.lng, label.lat])
        .addTo(map),
    );
  }, [isLoaded, raceAreasCollection, showRaceAreas]);

  useEffect(() => {
    const map = mapRef.current;
    const Marker = maplibreRef.current?.Marker;
    if (!map || !Marker || !isLoaded) return;

    pinMarkersRef.current.forEach((marker) => marker.remove());
    pinMarkersRef.current = pins.map((pin) => {
      const isTappable = Boolean(onPinPress) && TAPPABLE_PIN_KINDS.has(pin.kind);
      const element = createWebPinElement({
        pin,
        showLabel: shouldShowLabel(pin, pins),
        isTappable,
        onPress: isTappable
          ? () => {
              onPinPress?.(pin);
              map.easeTo({
                center: [pin.lng, pin.lat],
                padding: { top: 120, bottom: 380 },
                duration: 400,
              });
            }
          : undefined,
      });
      return new Marker({ element }).setLngLat([pin.lng, pin.lat]).addTo(map);
    });
  }, [isLoaded, onPinPress, pins]);

  useEffect(() => {
    const map = mapRef.current;
    const Marker = maplibreRef.current?.Marker;
    if (!map || !Marker || !isLoaded) return;

    nextMarkerRef.current?.remove();
    nextMarkerRef.current = null;
    if (!nextEvent) return;

    const element = createWebNextEventElement(nextEvent, onNextEventPress);
    nextMarkerRef.current = new Marker({ element })
      .setLngLat([nextEvent.lng, nextEvent.lat])
      .addTo(map);
  }, [isLoaded, nextEvent, onNextEventPress]);

  useEffect(() => {
    const map = mapRef.current;
    const Marker = maplibreRef.current?.Marker;
    if (!map || !Marker || !isLoaded) return;

    candidateMarkerRef.current?.remove();
    candidateMarkerRef.current = null;
    if (!candidate) return;

    candidateMarkerRef.current = new Marker({ element: createWebCandidateElement() })
      .setLngLat([candidate.lng, candidate.lat])
      .addTo(map);
  }, [candidate, isLoaded]);

  if (mapError) {
    const SvgMap = pickSvgMap(frame);
    return (
      <View style={styles.fill}>
        <SvgMap />
        <View style={styles.webMapError}>
          <Text style={styles.webMapErrorTitle}>Map unavailable</Text>
          <Text style={styles.webMapErrorBody}>{mapError}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <View ref={containerRef} style={styles.fill} />
      {/* Compass — appears only when the user has rotated the map off
          north. Tap to snap back to north. Mirror of the native
          compass overlay above. */}
      {Math.abs(bearing) > 1 ? (
        <Pressable
          style={styles.compassButton}
          onPress={resetBearing}
          accessibilityRole="button"
          accessibilityLabel="Reset map to north"
        >
          <View style={{ transform: [{ rotate: `${-bearing}deg` }] }}>
            <Ionicons name="navigate" size={18} color="#D44646" />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

function syncGeoJsonLayer(
  map: any,
  sourceId: string,
  layerType: 'fill' | 'line',
  data: GeoJSON.FeatureCollection,
  paint: Record<string, unknown>,
) {
  const layerId = layerType === 'fill' ? `${sourceId}-fill` : `${sourceId}-layer`;
  const source = map.getSource(sourceId);
  if (source?.setData) {
    source.setData(data);
    return;
  }

  map.addSource(sourceId, { type: 'geojson', data });
  map.addLayer({
    id: layerId,
    type: layerType,
    source: sourceId,
    paint,
  });
}

function removeLayerAndSource(map: any, layerId: string, sourceId: string) {
  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);
}

function getRacingAreaLabels(
  raceAreasCollection: GeoJSON.FeatureCollection,
): { id: string; name: string; lng: number; lat: number }[] {
  const out: { id: string; name: string; lng: number; lat: number }[] = [];
  for (const feature of raceAreasCollection.features) {
    const geom = feature.geometry;
    if (!geom || geom.type !== 'Polygon') continue;
    const ring = geom.coordinates[0];
    if (!ring || ring.length === 0) continue;
    let lngSum = 0;
    let latSum = 0;
    for (const [lng, lat] of ring) {
      lngSum += lng;
      latSum += lat;
    }
    const name = (feature.properties as { id?: string; name?: string } | null)?.name;
    const id = (feature.properties as { id?: string } | null)?.id;
    if (!name || !id) continue;
    out.push({
      id,
      name,
      lng: lngSum / ring.length,
      lat: latSum / ring.length,
    });
  }
  return out;
}

function createWebAreaLabelElement(name: string, onPress?: () => void) {
  const root = document.createElement(onPress ? 'button' : 'div');
  root.textContent = name;
  root.style.border = '0';
  root.style.maxWidth = '140px';
  root.style.padding = '2px 6px';
  root.style.borderRadius = '4px';
  root.style.background = 'rgba(255, 255, 255, 0.92)';
  root.style.font = '700 10px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  root.style.letterSpacing = '0.4px';
  root.style.color = 'rgba(60, 40, 20, 0.95)';
  root.style.textTransform = 'uppercase';
  root.style.whiteSpace = 'nowrap';
  root.style.overflow = 'hidden';
  root.style.textOverflow = 'ellipsis';
  root.style.cursor = onPress ? 'pointer' : 'default';
  if (onPress) {
    root.addEventListener('click', (event) => {
      event.stopPropagation();
      onPress();
    });
  }
  return root;
}

function createWebPinElement({
  pin,
  showLabel,
  isTappable,
  onPress,
}: {
  pin: AtlasPinSpec;
  showLabel: boolean;
  isTappable: boolean;
  onPress?: () => void;
}) {
  // Wind and tide arrows have their own DOM shape — a rotated glyph
  // plus an optional value chip. The generic circle path below would
  // otherwise render them as blue dots (which is what reached web
  // before this branch). Native uses LabeledPin's wind-arrow /
  // tide-arrow blocks; this mirrors them in plain DOM for web parity.
  if (pin.kind === 'wind-arrow' || pin.kind === 'tide-arrow') {
    return createWebArrowElement(pin);
  }
  const tone = PIN_TONE[pin.kind];
  const root = document.createElement(isTappable ? 'button' : 'div');
  root.style.display = 'flex';
  root.style.alignItems = 'center';
  root.style.gap = '6px';
  root.style.border = '0';
  root.style.padding = '0';
  root.style.background = 'transparent';
  root.style.cursor = isTappable ? 'pointer' : 'default';
  root.style.transform = 'translateY(-50%)';
  root.style.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  root.style.color = 'rgba(28, 28, 30, 0.86)';

  if (isTappable && onPress) {
    root.addEventListener('click', (event) => {
      event.stopPropagation();
      onPress();
    });
  }

  const marker = document.createElement('span');
  marker.style.display = 'inline-flex';
  marker.style.alignItems = 'center';
  marker.style.justifyContent = 'center';
  marker.style.width = `${Math.max(tone.size, 8)}px`;
  marker.style.height = `${Math.max(tone.size, 8)}px`;
  marker.style.background = pin.glowCluster
    ? COHORT_CLUSTER_TONE[pin.glowCluster] ?? tone.color
    : tone.color;
  marker.style.border = '2px solid #fff';
  marker.style.boxShadow = '0 2px 8px rgba(0,0,0,0.18)';
  marker.style.color = '#fff';
  marker.style.fontSize = '9px';
  marker.style.lineHeight = '1';

  if (tone.shape === 'diamond') {
    marker.style.transform = 'rotate(45deg)';
    marker.style.borderRadius = '3px';
  } else if (tone.shape === 'square') {
    marker.style.borderRadius = '3px';
    marker.style.borderColor = 'rgba(28,28,30,0.32)';
  } else if (tone.shape === 'ring') {
    marker.style.borderRadius = '999px';
    marker.style.background = '#fff';
    marker.style.borderColor = tone.color;
  } else if (tone.shape === 'drop') {
    marker.style.borderRadius = '50% 50% 50% 0';
    marker.style.transform = 'rotate(-45deg)';
  } else {
    marker.style.borderRadius = '999px';
  }

  if (pin.clusterCount) marker.textContent = `+${pin.clusterCount}`;
  if (pin.kind === 'race-mark' && pin.label) {
    marker.textContent = pin.label.match(/\d+/)?.[0] ?? '';
  }

  root.appendChild(marker);

  if (showLabel && pin.label) {
    const label = document.createElement('span');
    label.textContent = pin.label.split('|')[0]?.trim() || pin.label;
    label.style.maxWidth = '150px';
    label.style.padding = '3px 6px';
    label.style.borderRadius = '999px';
    label.style.background = 'rgba(255,255,255,0.92)';
    label.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)';
    label.style.whiteSpace = 'nowrap';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    root.appendChild(label);
  }

  return root;
}

function createWebArrowElement(pin: AtlasPinSpec) {
  const root = document.createElement('div');
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.alignItems = 'center';
  root.style.gap = '2px';
  root.style.pointerEvents = 'none';

  // Label formats:
  //   wind primary:        "deg|kn", "deg|kn||waveM", "deg|kn||waveM|source"
  //   wind/tide field:     "deg|kn|field"
  //   tide primary:        "deg|kn"
  const labelParts = (pin.label ?? '0|0').split('|');
  const [degStr, knotsStr, variant, waveStr, sourceStr] = labelParts;
  const isWind = pin.kind === 'wind-arrow';
  const isField = variant === 'field';
  const deg = Number(degStr) || 0;
  const knots = Number(knotsStr) || 0;
  const waveM = isWind && waveStr ? Number(waveStr) : null;
  const source = isWind && sourceStr && sourceStr.length > 0 ? sourceStr : null;
  // Wind: arrow points DOWNWIND (away from source). Tide: arrow points
  // the direction the current flows TO (set). So wind needs +180,
  // tide does not.
  const rotateDeg = isWind ? (deg + 180) % 360 : deg;

  const glyphSize = isField ? 16 : 26;
  const glyph = document.createElement('div');
  glyph.style.fontSize = `${glyphSize}px`;
  glyph.style.lineHeight = '1';
  glyph.style.transform = `rotate(${rotateDeg}deg)`;
  glyph.style.color = isField
    ? isWind
      ? 'rgba(113, 143, 168, 0.78)'
      : 'rgba(96, 130, 138, 0.78)'
    : isWind
      ? windColorForKnots(knots, 0.95)
      : 'rgba(0, 168, 168, 0.95)';
  // Up-arrow (wind) / chevron-up (tide), both natively point north so
  // rotation maps cleanly to compass bearings.
  glyph.textContent = isWind ? '↑' : '⌃';
  root.appendChild(glyph);

  if (!isField && knots > 0) {
    const chip = document.createElement('span');
    const padded = ((Math.round(deg) % 360) + 360) % 360;
    const padStr = padded.toString().padStart(3, '0');
    const knotsLabel = isWind ? Math.round(knots) : knots.toFixed(1);
    const waveSuffix =
      waveM != null && Number.isFinite(waveM) ? ` · ${waveM.toFixed(1)}m` : '';
    chip.textContent = `${padStr}° · ${knotsLabel} kn${waveSuffix}`;
    chip.style.padding = '2px 6px';
    chip.style.borderRadius = '999px';
    chip.style.background = 'rgba(255,255,255,0.92)';
    chip.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)';
    chip.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    chip.style.fontSize = '10px';
    chip.style.fontWeight = '600';
    chip.style.color = 'rgba(28, 28, 30, 0.86)';
    chip.style.whiteSpace = 'nowrap';
    root.appendChild(chip);

    if (source) {
      const sub = document.createElement('span');
      sub.textContent = source;
      sub.style.marginTop = '1px';
      sub.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      sub.style.fontSize = '8px';
      sub.style.fontWeight = '600';
      sub.style.letterSpacing = '0.2px';
      sub.style.color = 'rgba(28, 28, 30, 0.55)';
      sub.style.whiteSpace = 'nowrap';
      root.appendChild(sub);
    }
  }

  return root;
}

function createWebNextEventElement(
  nextEvent: AtlasNextEvent & { lng: number; lat: number },
  onPress?: () => void,
) {
  const root = document.createElement(onPress ? 'button' : 'div');
  root.textContent = `${nextEvent.label}${nextEvent.when ? ` · ${nextEvent.when}` : ''}`;
  root.style.border = '0';
  root.style.padding = '5px 8px';
  root.style.borderRadius = '999px';
  root.style.background = 'rgba(255, 184, 77, 0.96)';
  root.style.color = '#3A2500';
  root.style.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  root.style.boxShadow = '0 4px 12px rgba(0,0,0,0.18)';
  root.style.cursor = onPress ? 'pointer' : 'default';
  if (onPress) {
    root.addEventListener('click', (event) => {
      event.stopPropagation();
      onPress();
    });
  }
  return root;
}

function createWebCandidateElement() {
  const root = document.createElement('div');
  root.style.width = '22px';
  root.style.height = '22px';
  root.style.borderRadius = '50% 50% 50% 0';
  root.style.background = '#FF3B30';
  root.style.border = '3px solid #fff';
  root.style.boxShadow = '0 4px 12px rgba(0,0,0,0.22)';
  root.style.transform = 'rotate(-45deg) translateY(-50%)';
  return root;
}

/**
 * The red drop-pin shown in commit-mode at the tapped coords. Larger
 * than peer pins so it reads as "you are about to anchor a step here."
 */
/** Pad a compass bearing to a 3-digit string (`045`, `120`, `005`). */
function padDeg(deg: number): string {
  const v = ((Math.round(deg) % 360) + 360) % 360;
  return v.toString().padStart(3, '0');
}

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
  if (pin.kind === 'race-mark') return true;
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
type PinShape = 'circle' | 'diamond' | 'numbered' | 'drop' | 'square' | 'ring';

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
  'poi-club': { size: 14, color: 'rgba(0, 122, 255, 0.95)', shape: 'ring' },
  // "Your base" club — anchor icon, deeper navy. Distinct from generic
  // institution circles so the user's home club reads as "this is mine".
  'poi-club-anchor': { size: 22, color: 'rgba(28, 28, 56, 0.95)', shape: 'circle' },
  'poi-racing-area': { size: 11, color: 'rgba(0, 122, 255, 0.65)', shape: 'ring' },
  // Sailing land-side POIs — ring grammar (institution = place), each
  // tinted to read distinctly from yacht clubs (systemBlue rings):
  //   - marina: teal — sail water-adjacent but distinct from a club
  //   - sail loft: violet — service venue, indoor canvas work
  //   - chandler: amber — retail (rigging, hardware, chandlery)
  'poi-marina': { size: 12, color: 'rgba(0, 150, 160, 0.95)', shape: 'ring' },
  'poi-sail-loft': { size: 11, color: 'rgba(124, 92, 196, 0.95)', shape: 'ring' },
  'poi-chandler': { size: 11, color: 'rgba(204, 124, 36, 0.95)', shape: 'ring' },
  'poi-hospital': { size: 14, color: 'rgba(0, 122, 255, 0.95)', shape: 'circle' },
  // Curation pins — diamonds. Sim-lab is institutional but reads as
  // "rehearse-here," which is curation-adjacent enough that the design
  // commits it to the diamond vocabulary alongside preceptor pins.
  'poi-sim-lab': { size: 12, color: 'rgba(155, 92, 246, 0.95)', shape: 'diamond' },
  // "Your base" sim — Pinkard for nursing. Blue dot + SIM badge,
  // mirrors the RHKYC anchor pattern for sailing.
  'poi-sim-anchor': { size: 14, color: 'rgba(0, 122, 255, 0.95)', shape: 'circle' },
  'poi-preceptor': { size: 13, color: 'rgba(155, 92, 246, 0.95)', shape: 'diamond' },
  // Entrepreneur grammar — haats (weekly markets) are green diamonds
  // with a day-of-week badge; supplier villages are small white squares
  // (extraction grammar); mentees are tiny green circles (peer);
  // home anchor mirrors RHKYC / Pinkard for Lakshmi's house.
  'poi-haat': { size: 14, color: 'rgba(34, 139, 80, 0.95)', shape: 'diamond' },
  'poi-supplier': { size: 11, color: 'rgba(255, 255, 255, 0.95)', shape: 'square' },
  'poi-mentee': { size: 9, color: 'rgba(34, 139, 80, 0.9)', shape: 'circle' },
  'poi-home-anchor': { size: 14, color: 'rgba(0, 122, 255, 0.95)', shape: 'circle' },
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
  // Phase A — viewer's own steps. Blue palette mirrors the "own"/"you"
  // peer tone so the viewer's pins read as theirs at a glance, with the
  // size + opacity carrying the time gradient.
  'my-step-next':        { size: 18, color: 'rgba(0, 122, 255, 1)',    shape: 'circle' },
  'my-step-planned':     { size: 12, color: 'rgba(0, 122, 255, 0.95)', shape: 'circle' },
  'my-step-done-just':   { size: 14, color: 'rgba(0, 122, 255, 0.85)', shape: 'circle' },
  'my-step-done-recent': { size: 10, color: 'rgba(0, 122, 255, 0.65)', shape: 'circle' },
  'my-step-done-old':    { size: 7,  color: 'rgba(0, 122, 255, 0.30)', shape: 'circle' },
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
  clusterUnit,
  glowCluster,
  showLabel = true,
}: {
  kind: AtlasPinSpec['kind'];
  label?: string;
  clusterCount?: number;
  /** Interest-aware noun for the cluster pill ("session"/"shift"/…). */
  clusterUnit?: string;
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
  // Pinkard sim-base — blue dot + "Pinkard" label + small "SIM" badge.
  // Mirror of the RHKYC anchor for the nursing canvas.
  if (kind === 'poi-sim-anchor') {
    return (
      <View style={styles.pinRow}>
        <View style={styles.simAnchorDot} />
        {showLabel && label ? (
          <>
            <Text style={styles.pinLabel} numberOfLines={1}>
              {label}
            </Text>
            <View style={styles.simBadge}>
              <Text style={styles.simBadgeText}>SIM</Text>
            </View>
          </>
        ) : null}
      </View>
    );
  }
  // Lakshmi's home base — blue dot + "Home · घर" label, mirrors the
  // RHKYC / Pinkard pattern for entrepreneur. Label content comes from
  // the framePin builder.
  if (kind === 'poi-home-anchor') {
    return (
      <View style={styles.pinRow}>
        <View style={styles.simAnchorDot} />
        {showLabel && label ? (
          <Text style={[styles.pinLabel, styles.clubAnchorLabel]} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
      </View>
    );
  }
  // Haat — green diamond + day-of-week badge ("MON" / "WED" / "SAT").
  // Day(s) ride on the label as a |-delimited tail (e.g. "Bero|mon").
  if (kind === 'poi-haat') {
    const parts = (label ?? '').split('|');
    const haatLabel = parts[0] ?? '';
    const dayBadge = (parts[1] ?? '').trim().toUpperCase();
    return (
      <View style={styles.pinRow}>
        <View
          style={{
            width: 14,
            height: 14,
            backgroundColor: 'rgba(34, 139, 80, 0.95)',
            borderWidth: 1.5,
            borderColor: '#FFFFFF',
            transform: [{ rotate: '45deg' }],
          }}
        />
        {showLabel && haatLabel ? (
          <Text style={styles.pinLabel} numberOfLines={1}>
            {haatLabel}
          </Text>
        ) : null}
        {showLabel && dayBadge ? (
          <View style={styles.haatDayBadge}>
            <Text style={styles.haatDayBadgeText}>{dayBadge}</Text>
          </View>
        ) : null}
      </View>
    );
  }
  if (kind === 'race-mark') {
    return (
      <View style={styles.raceMarkWrap}>
        <View style={styles.raceMarkGlyph}>
          <Text style={styles.raceMarkGlyphText}>{label}</Text>
        </View>
      </View>
    );
  }
  if (kind === 'wind-arrow') {
    // Label format from useWindOverlay:
    //   "deg|kn"                       — primary, no waves, no source
    //   "deg|kn|field"                 — small field arrow (no chip)
    //   "deg|kn||waveM"                — primary with wave height
    //   "deg|kn|||source"              — primary with source attribution
    //   "deg|kn||waveM|source"         — primary with waves AND source
    const labelParts = (label ?? '0|0').split('|');
    const [degStr, knotsStr, variant, waveStr, sourceStr] = labelParts;
    const fromDeg = Number(degStr) || 0;
    const downwindDeg = (fromDeg + 180) % 360;
    const knots = Number(knotsStr) || 0;
    const isField = variant === 'field';
    const waveM = waveStr ? Number(waveStr) : null;
    const source = sourceStr && sourceStr.length > 0 ? sourceStr : null;
    // Primary arrow takes Beaufort-band color so the user sees sail-choice
    // bands at a glance; field arrows stay soft slate so the dense grid
    // reads as ambience, not 16 simultaneous foreground signals.
    const primaryColor = windColorForKnots(knots, 0.95);
    return (
      <View style={isField ? styles.windFieldWrap : styles.windArrowWrap}>
        <View style={[isField ? styles.fieldArrowDisc : styles.arrowDisc, { transform: [{ rotate: `${downwindDeg}deg` }] }]}>
          <Ionicons
            name="arrow-up"
            size={isField ? 20 : 32}
            color={isField ? 'rgba(113, 143, 168, 0.78)' : primaryColor}
          />
        </View>
        {!isField && knots > 0 ? (
          <Text style={styles.arrowChip}>
            {waveM != null && Number.isFinite(waveM)
              ? `${padDeg(fromDeg)}° · ${Math.round(knots)} kn · ${waveM.toFixed(1)}m`
              : `${padDeg(fromDeg)}° · ${Math.round(knots)} kn`}
          </Text>
        ) : null}
        {!isField && source ? (
          <Text style={styles.arrowSourceLabel}>{source}</Text>
        ) : null}
      </View>
    );
  }
  if (kind === 'tide-arrow') {
    // Tide convention: "set" — arrow points where water FLOWS, no flip.
    // `|field` suffix opts into the soft surface treatment (small,
    // muted slate-teal, no kn chip) so a dense grid reads as ambience
    // rather than N hard-labeled duplicates. Mirror of wind-arrow.
    const [degStr, knotsStr, variant] = (label ?? '0|0').split('|');
    const setDeg = Number(degStr) || 0;
    const knots = Number(knotsStr) || 0;
    const isField = variant === 'field';
    return (
      <View style={isField ? styles.windFieldWrap : styles.tideArrowWrap}>
        <View
          style={[
            isField ? styles.fieldArrowDisc : styles.arrowDisc,
            { transform: [{ rotate: `${setDeg}deg` }] },
          ]}
        >
          <Ionicons
            name="chevron-up"
            size={isField ? 18 : 32}
            color={isField ? 'rgba(96, 130, 138, 0.78)' : 'rgba(0, 168, 168, 0.95)'}
          />
        </View>
        {!isField && knots > 0 ? (
          <Text style={styles.arrowChip}>{`${padDeg(setDeg)}° · ${knots.toFixed(1)} kn`}</Text>
        ) : null}
      </View>
    );
  }
  // Hero treatment for the "next" step — the one right of the timeline
  // NOW bar. Bold blue dot inside an amber halo with a NEXT badge so the
  // viewer can spot their next move at a glance.
  if (kind === 'my-step-next') {
    const titleLabel = (label ?? '').split('|')[0] ?? '';
    return (
      <View style={styles.pinRow}>
        <View style={styles.glyphCol}>
          <View pointerEvents="none" style={styles.myStepNextHalo} />
          <View style={styles.myStepNextDot} />
        </View>
        <View style={styles.myStepHeroLabelCol}>
          <View style={styles.myStepNextBadge}>
            <Text style={styles.myStepNextBadgeText}>NEXT</Text>
          </View>
          {showLabel && titleLabel ? (
            <Text style={styles.pinLabel} numberOfLines={1}>
              {titleLabel}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }
  // Hero treatment for the most recently completed step — left of NOW.
  // Smaller halo than NEXT, green-tinted, with a DONE badge.
  if (kind === 'my-step-done-just') {
    const titleLabel = (label ?? '').split('|')[0] ?? '';
    return (
      <View style={styles.pinRow}>
        <View style={styles.glyphCol}>
          <View pointerEvents="none" style={styles.myStepDoneJustHalo} />
          <View style={styles.myStepDoneJustDot} />
        </View>
        <View style={styles.myStepHeroLabelCol}>
          <View style={styles.myStepDoneJustBadge}>
            <Text style={styles.myStepDoneJustBadgeText}>DONE</Text>
          </View>
          {showLabel && titleLabel ? (
            <Text style={styles.pinLabel} numberOfLines={1}>
              {titleLabel}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }
  // Phase A — viewer's own planned step. Solid blue dot with a small
  // day-of-week badge ("MON"). label = "stepTitle|MON" so the renderer
  // can split out the badge text the same way haats do.
  if (kind === 'my-step-planned') {
    const parts = (label ?? '').split('|');
    const titleLabel = parts[0] ?? '';
    const dayBadge = (parts[1] ?? '').trim().toUpperCase();
    return (
      <View style={styles.pinRow}>
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: 'rgba(0, 122, 255, 0.95)',
            borderWidth: 2,
            borderColor: '#FFFFFF',
          }}
        />
        {showLabel && titleLabel ? (
          <Text style={styles.pinLabel} numberOfLines={1}>
            {titleLabel}
          </Text>
        ) : null}
        {showLabel && dayBadge ? (
          <View style={styles.haatDayBadge}>
            <Text style={styles.haatDayBadgeText}>{dayBadge}</Text>
          </View>
        ) : null}
      </View>
    );
  }
  if (kind === 'cohort-cell') {
    // label encodes "count|cluster". Color comes from the cluster,
    // diameter scales with count (clamped). Center text shows the count.
    // Renders as a hexagon (Unicode '⬢') so the cohort heatmap reads as
    // a tiled grid of cells rather than discrete circular badges — that
    // matches the F4 design's "honeycomb over Baltimore" pattern.
    const [countStr, cluster] = (label ?? '0|general').split('|');
    const count = Number(countStr) || 0;
    const diameter = Math.min(54, 22 + count * 3.5);
    const tone =
      COHORT_CLUSTER_TONE[cluster] ?? COHORT_CLUSTER_TONE.general;
    return (
      <View style={styles.hexWrap}>
        <Text style={[styles.hexGlyph, { color: tone, fontSize: diameter }]}>
          {'⬢'}
        </Text>
        <Text style={[styles.hexCount, { lineHeight: diameter }]}>{count}</Text>
      </View>
    );
  }
  const tone = PIN_TONE[kind];
  if (!tone) {
    // Pin kind not in PIN_TONE — likely a new kind added without a
    // matching tone entry. Skip rather than crash the whole canvas.
    if (__DEV__) console.warn('[atlas] no PIN_TONE entry for kind', kind);
    return null;
  }
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
          clusterUnit={clusterUnit}
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
  clusterUnit = 'logs',
}: {
  shape: PinShape;
  size: number;
  color: string;
  clusterCount?: number;
  /** Interest-aware plural noun for the cluster pill. */
  clusterUnit?: string;
}) {
  // Cluster badge: 5+ peer pins in 2km merge to "+N <unit>" per the
  // design's cluster-behavior rule. Pill rather than circle so the unit
  // label fits — a bare "+12" reads as undescribed data; the unit tells
  // the user they're looking at a count of activity, not sailors.
  if (clusterCount != null) {
    const unitLabel = clusterCount === 1 ? clusterUnit : `${clusterUnit}s`;
    return (
      <View style={styles.clusterPill}>
        <Text style={styles.clusterCount}>+{clusterCount}</Text>
        <Text style={styles.clusterUnit}>{unitLabel}</Text>
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
  if (shape === 'square') {
    // Square pin — extraction grammar for supplier villages on F7.
    // Reserved for fixed-source places where supply originates.
    return (
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: 'rgba(60, 60, 67, 0.55)',
        }}
      />
    );
  }
  if (shape === 'ring') {
    // Ring (institution grammar) — white fill + colored border, so POIs
    // read as "place" rather than "data point." Distinct from peer pins
    // (filled circles) so a user scanning the map can tell at a glance
    // whether a dot is a person/step or a venue/club.
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: '#FFFFFF',
          borderWidth: 2.5,
          borderColor: color,
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
function NextEventMarker({
  label,
  when,
  conditions,
}: {
  label: string;
  when?: string;
  conditions?: string;
}) {
  const eyebrow = `NEXT · ${label.toUpperCase()}${when ? ` · ${when.toUpperCase()}` : ''}`;
  return (
    <View style={styles.nextTag}>
      <Text style={styles.nextTagEyebrow} numberOfLines={1}>
        {eyebrow}
      </Text>
      {conditions ? (
        <Text style={styles.nextTagDetail} numberOfLines={1}>
          {conditions}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  compassButton: {
    position: 'absolute',
    right: 12,
    top: 118,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
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
  simAnchorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0, 122, 255, 0.95)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  simBadge: {
    backgroundColor: 'rgba(60, 60, 67, 0.62)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  simBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  haatDayBadge: {
    backgroundColor: 'rgba(255, 230, 176, 0.95)',
    borderWidth: 1,
    borderColor: 'rgba(240, 169, 58, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  haatDayBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#8A4B00',
    letterSpacing: 0.5,
  },
  clusterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: 'rgba(28, 28, 56, 0.92)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  clusterCount: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  clusterUnit: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.78)',
    letterSpacing: 0.3,
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
  raceMarkWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  raceMarkGlyph: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: 11,
    backgroundColor: '#D89A2B',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8A4B00',
    shadowOpacity: 0.14,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  raceMarkGlyphText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2C2417',
    letterSpacing: -0.1,
  },
  windArrowWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  windFieldWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  tideArrowWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldArrowDisc: {
    width: 24,
    height: 24,
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
  arrowSourceLabel: {
    marginTop: 1,
    fontSize: 8,
    fontWeight: '600',
    color: 'rgba(28, 28, 30, 0.55)',
    letterSpacing: 0.2,
  },
  cohortCount: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(28, 28, 30, 0.9)',
    letterSpacing: 0.2,
  },
  hexWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  hexGlyph: {
    fontWeight: '400',
    lineHeight: undefined,
    textAlign: 'center',
  },
  hexCount: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(28, 28, 30, 0.85)',
    letterSpacing: 0.2,
    textAlign: 'center',
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
  myStepNextHalo: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    top: -8,
    left: -8,
    backgroundColor: 'rgba(240, 169, 58, 0.28)',
    borderWidth: 2,
    borderColor: 'rgba(240, 169, 58, 0.75)',
  },
  myStepNextDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0, 122, 255, 1)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  myStepDoneJustHalo: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    top: -6,
    left: -6,
    backgroundColor: 'rgba(52, 199, 89, 0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(52, 199, 89, 0.75)',
  },
  myStepDoneJustDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0, 122, 255, 0.85)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  myStepHeroLabelCol: {
    marginLeft: 8,
    alignItems: 'flex-start',
  },
  myStepNextBadge: {
    backgroundColor: '#FFE6B0',
    borderColor: '#F0A93A',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  myStepNextBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#8A4B00',
    letterSpacing: 0.7,
  },
  myStepDoneJustBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.18)',
    borderColor: 'rgba(52, 199, 89, 0.85)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  myStepDoneJustBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1F7A3A',
    letterSpacing: 0.7,
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
  nextTagDetail: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: '600',
    color: '#5A3000',
    letterSpacing: 0.2,
  },
  areaLabelPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: 140,
  },
  areaLabelText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: 'rgba(60, 40, 20, 0.95)',
    textTransform: 'uppercase',
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
