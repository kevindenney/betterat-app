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
  ActivityIndicator,
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
import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';

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
import { useAtlasRaceCourses } from '@/hooks/useAtlasRaceCourses';
import type { CourseEnvironment } from '@/lib/venueCourseGeoJSON';
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

function mapStyleForFrame(frame: AtlasFrameId, basemap: AtlasBasemap = 'map'): string | StyleSpecification {
  if (basemap === 'satellite') return SATELLITE_MAP_STYLE as StyleSpecification;
  if (basemap === 'nautical') return NAUTICAL_MAP_STYLE as StyleSpecification;
  // Sailing — custom brand-palette: cream land + soft blue water, no
  // labels/roads. Lets race-marks + wind/tide arrows + POI pins dominate.
  if (frame === 'f1' || frame === 'f2' || frame === 'f3' || frame === 'f6') {
    return SAILING_MAP_STYLE as StyleSpecification;
  }
  // Nursing — quiet urban: cream land + faint major roads + building
  // footprints at z13+. Cohort heatmap + preceptor diamonds dominate.
  if (frame === 'f4' || frame === 'f5') {
    return NURSING_MAP_STYLE as StyleSpecification;
  }
  // Entrepreneur / mentor — sparse rural: cream land + rivers + faint road net.
  if (frame === 'f7' || frame === 'f8') {
    return ENTREPRENEUR_MAP_STYLE as StyleSpecification;
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
  f8: { center: [85.35, 23.36], zoom: 9.6 },           // Ranchi · Jharkhand · mentor/org cluster
  f9: { center: [-122.1124, 37.4178], zoom: 13.8 },    // Oakridge CC · golf venues
};

/**
 * Race-course geometry (laylines, start box, marks) is illegible at
 * country/region zoom — below this level the overlay is suppressed via
 * each layer's minZoomLevel so it doesn't smear the map.
 */
const COURSE_MIN_ZOOM = 13;

/**
 * Third/side text labels (BOTTOM/MIDDLE/UPPER, LEFT/RIGHT) need more room than
 * the geometry: at COURSE_MIN_ZOOM the diamond is small enough that the three
 * stacked band labels and the two side labels collide into an unreadable pile
 * over the windward mark. Gate them a couple zoom steps higher (and let
 * collision detection drop any that still overlap) so they only appear once the
 * beat is large enough to place them legibly.
 */
const COURSE_LABEL_MIN_ZOOM = 15;

/**
 * Web (maplibre-gl) race-course layer specs — the imperative twin of the
 * native MLLayer tree. Each is added off the shared `atlas-web-course`
 * source with `minzoom: COURSE_MIN_ZOOM` + a `properties.type` filter.
 */
const COURSE_WEB_LAYERS: {
  id: string;
  type: 'fill' | 'line' | 'circle' | 'symbol';
  filter: unknown[];
  paint: Record<string, unknown>;
  layout?: Record<string, unknown>;
  /** Optional per-layer zoom floor; falls back to COURSE_MIN_ZOOM. */
  minzoom?: number;
}[] = [
  {
    // Favored-side shading sits at the bottom of the course stack. The
    // current-favored half tints green; the other half stays faint so the
    // split down the wind axis still reads.
    id: 'atlas-web-course-sides',
    type: 'fill',
    filter: ['==', ['get', 'type'], 'course-side'],
    paint: {
      'fill-color': [
        'case',
        ['get', 'favored'],
        'rgba(34, 197, 94, 0.18)',
        'rgba(20, 33, 61, 0.05)',
      ],
    },
  },
  {
    id: 'atlas-web-course-thirds',
    type: 'line',
    filter: ['==', ['get', 'type'], 'course-third'],
    paint: {
      'line-color': 'rgba(20, 33, 61, 0.35)',
      'line-width': 1,
      'line-dasharray': [2, 3],
    },
  },
  {
    id: 'atlas-web-course-third-labels',
    type: 'symbol',
    minzoom: COURSE_LABEL_MIN_ZOOM,
    filter: ['==', ['get', 'type'], 'course-third-label'],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 9,
      'text-letter-spacing': 0.08,
      'text-allow-overlap': false,
      'text-optional': true,
    },
    paint: {
      'text-color': 'rgba(20, 33, 61, 0.55)',
      'text-halo-color': 'rgba(241, 233, 216, 0.9)',
      'text-halo-width': 1.2,
    },
  },
  {
    id: 'atlas-web-course-side-labels',
    type: 'symbol',
    minzoom: COURSE_LABEL_MIN_ZOOM,
    filter: ['==', ['get', 'type'], 'course-side-label'],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 10,
      'text-letter-spacing': 0.1,
      'text-allow-overlap': false,
      'text-optional': true,
    },
    paint: {
      'text-color': [
        'case',
        ['get', 'favored'],
        'rgba(22, 130, 60, 0.95)',
        'rgba(20, 33, 61, 0.5)',
      ],
      'text-halo-color': 'rgba(241, 233, 216, 0.9)',
      'text-halo-width': 1.2,
    },
  },
  {
    id: 'atlas-web-course-start-box',
    type: 'fill',
    filter: ['==', ['get', 'type'], 'start-box'],
    paint: { 'fill-color': 'rgba(20, 33, 61, 0.12)' },
  },
  {
    id: 'atlas-web-course-legs',
    type: 'line',
    filter: ['==', ['get', 'type'], 'course-leg'],
    paint: {
      'line-color': 'rgba(20, 33, 61, 0.72)',
      'line-width': 1.8,
      'line-dasharray': [4, 2],
    },
  },
  {
    id: 'atlas-web-course-laylines',
    type: 'line',
    filter: ['==', ['get', 'type'], 'layline'],
    paint: {
      'line-color': 'rgba(20, 33, 61, 0.55)',
      'line-width': 1,
      'line-dasharray': [3, 3],
    },
  },
  {
    id: 'atlas-web-course-start-line',
    type: 'line',
    filter: ['==', ['get', 'type'], 'start-line'],
    paint: { 'line-color': 'rgb(20, 33, 61)', 'line-width': 2 },
  },
  {
    id: 'atlas-web-course-finish-line',
    type: 'line',
    filter: ['==', ['get', 'type'], 'finish-line'],
    paint: { 'line-color': 'rgb(20, 33, 61)', 'line-width': 2 },
  },
  {
    id: 'atlas-web-course-marks',
    type: 'circle',
    filter: ['==', ['get', 'type'], 'course-mark'],
    paint: {
      'circle-radius': 5,
      'circle-color': [
        'match',
        ['get', 'markType'],
        'committee', 'rgb(231, 137, 60)',
        'finish', 'rgb(255, 255, 255)',
        'rgb(20, 33, 61)',
      ],
      'circle-stroke-color': 'rgb(20, 33, 61)',
      'circle-stroke-width': 1.5,
    },
  },
];

const COURSE_WEB_LAYER_IDS = COURSE_WEB_LAYERS.map((l) => l.id);

/**
 * Phase N.2/N.3 — a single peer step behind a pin or cluster. Carries only
 * the privacy-safe fields the RPC already returns (relationship label, a
 * display name that may be approximate/hidden, and when it was set) so the
 * drill-down list + peer callout render without a second fetch.
 */
export interface AtlasPeerMember {
  stepId: string;
  /** crew / cohort / fleet / following / public — drives the relationship tone. */
  relationship: string;
  /** Display name; null when the peer is hidden behind a privacy preview. */
  name: string | null;
  /** ISO timestamp the step location was set, for a relative "2d ago" line. */
  setAt: string | null;
  /** Server-jittered latitude — lets the drill-down focus this one peer. */
  lat: number;
  /** Server-jittered longitude. */
  lng: number;
}

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
    // peer-focus — one sailor broken out of a privacy cluster (Nearby tap
    // or cluster drill-down). Renders as a prominent named, haloed marker so
    // the focused peer is unmistakable against the faint relationship dots.
    | 'peer-focus'
    // org-event — a located step PUBLISHED BY an organization (race briefing,
    // learn-to-sail session). Attendable activity at an exact spot, not a peer
    // person. Calendar marker + always-on title so it reads as "go to this."
    | 'org-event'
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
    | 'mentor-cluster-alert'
    | 'mentor-cluster-ok'
    | 'poi-home-anchor'
    | 'walk-annotation'
    | 'wind-arrow'
    | 'tide-arrow'
    | 'wave-arrow'
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
  /**
   * Phase N.3 — peer step identity for an individual peer pin (crew / fleet /
   * following). Populates the peer-step callout (who, relationship, when) so
   * the tap is honest social context instead of a generic "plan here" sheet.
   */
  peer?: AtlasPeerMember;
  /**
   * Phase N.2 — the members behind a "+N" peer cluster badge, for the
   * drill-down sheet. Privacy-safe: names may be approximate/hidden and the
   * list is server-jittered, but it replaces the dishonest "Coming soon" stub.
   */
  peerMembers?: AtlasPeerMember[];
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
   * Phase N.4 — the only first-class step distinction. True when this step is
   * a race (carries course/marks/conditions); drives the ⛵ race pin + race
   * cockpit. False/absent means an ordinary step.
   */
  isRace?: boolean;
  /**
   * Phase N.4 — display-only race course chips lifted from the step's
   * metadata.race_plan. Lets the race-pin callout show "Victoria Harbour ·
   * Windward–Leeward · 3 laps" without a second fetch. Only set on race
   * my-step pins; null/absent everywhere else.
   */
  raceContext?: { areaName: string | null; courseLabel: string | null } | null;
  /** Scheduled race/step start time, when available. Used for race-time forecast context. */
  raceStartAt?: string | null;
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

export interface AtlasRacingAreaPressTarget {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  classesUsed: string[];
  createdBy: string | null;
  polygon: GeoJSON.Polygon;
}

interface AtlasMapLibreCanvasProps {
  frame: AtlasFrameId;
  /** Optional peer pin list — empty in cold-start. */
  pins?: AtlasPinSpec[];
  /**
   * Optional point to fly the map toward after mount. When `bounds` is
   * present (Nominatim place results), the camera fits the bounding
   * box so cities/neighborhoods/addresses each land at the right zoom;
   * otherwise the canvas flies to the point at street-level zoom.
   */
  focusLocation?: {
    lng: number;
    lat: number;
    bounds?: [number, number, number, number];
  } | null;
  /** Camera padding for focusLocation. Full-screen Atlas uses large bottom padding for sheets; embedded maps can pass compact padding. */
  focusPadding?: { top: number; bottom: number; left: number; right: number };
  /** Zoom level for point focusLocation. Defaults to Atlas's full-screen street zoom. */
  focusZoomLevel?: number;
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
  /** Fires when a rendered racing-area label is tapped/clicked. */
  onRacingAreaPress?: (area: AtlasRacingAreaPressTarget) => void;
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
   * F1/F6/F2 "Race course" toggle. When on, the canvas fetches the venue
   * race courses in view (useAtlasRaceCourses) and paints start/finish
   * lines, laylines, start box and marks — but only at zoom ≥ 13
   * (COURSE_MIN_ZOOM), since the geometry is illegible at country zoom.
   */
  showCourse?: boolean;
  /**
   * Transient overlay rendered while the course-authoring sheet is open.
   * Unlike `showCourse` (the saved courses, zoom-gated at COURSE_MIN_ZOOM),
   * the in-progress preview is painted UNGATED so the author sees their
   * course as they dial in geometry regardless of zoom. Null when not
   * authoring.
   */
  coursePreviewCollection?: GeoJSON.FeatureCollection | null;
  /**
   * Live wind direction (degrees the wind blows FROM). When supplied, saved
   * courses re-orient to this axis so the windward mark tracks the current
   * breeze instead of the wind they were authored with.
   */
  courseWindDirectionDeg?: number;
  /**
   * Live current set (degrees the current flows TO) and drift (knots). When
   * supplied, the drawn course shades its current-favored half green so the
   * map matches the strategy card. Absent → favoredSide stays null and both
   * halves render at the same faint tint.
   */
  courseCurrentDirectionDeg?: number;
  courseCurrentSpeedKn?: number;
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
  /**
   * Suppress the floating value chips on wind/tide/wave arrows (e.g.
   * "225° · 3 kn · 0.3m"). Set when a readable conditions card already
   * owns the numbers, so the chart keeps directional arrows only and
   * doesn't double-print the readout over the marks.
   */
  hideArrowChips?: boolean;
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
  'peer-focus',
  'org-event',
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
  'mentor-cluster-alert',
  'mentor-cluster-ok',
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
  focusPadding,
  focusZoomLevel = 14,
  nextEvent,
  onMapPress,
  candidate,
  onPinPress,
  onRacingAreaPress,
  showRaceAreas = false,
  showCourse = false,
  coursePreviewCollection = null,
  courseWindDirectionDeg,
  courseCurrentDirectionDeg,
  courseCurrentSpeedKn,
  onNextEventPress,
  onMapLongPress,
  racingAreaPreviewPolygon = null,
  onMapCenterChange,
  basemap = 'map',
  hideArrowChips = false,
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
  // Track the live zoom so the amber NEXT marker can hide once the course
  // marks become visible (≥ COURSE_MIN_ZOOM). The NEXT tag and the race
  // pin/marks both sit on the venue centroid, so showing both stacks two
  // boxes on top of each other; instead the NEXT tag is the overview-only
  // "here's your next race" signpost and the marks own the close-up view.
  const [zoom, setZoom] = useState(baseCamera.zoom);
  const pollZoom = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
    void m.getZoom().then((z: number) => {
      if (typeof z === 'number' && Number.isFinite(z)) setZoom(z);
    });
  }, []);
  // Native map-ready gate. The camera's `flyTo`/`setStop` no-op if issued
  // before the style finishes loading, which left a race-area focus
  // (e.g. Port Shelter) stranded on the default frame preset. We flip
  // this on `onDidFinishLoadingMap` and re-run the focus effect so the
  // first focus lands once the camera can actually move.
  const [mapReady, setMapReady] = useState(false);
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
  const courseEnv = useMemo<CourseEnvironment>(
    () => ({
      ...(courseWindDirectionDeg != null ? { windDirection: courseWindDirectionDeg } : {}),
      ...(courseCurrentDirectionDeg != null ? { currentDirection: courseCurrentDirectionDeg } : {}),
      ...(courseCurrentSpeedKn != null ? { currentSpeed: courseCurrentSpeedKn } : {}),
    }),
    [courseWindDirectionDeg, courseCurrentDirectionDeg, courseCurrentSpeedKn],
  );
  const { featureCollection: courseCollection } = useAtlasRaceCourses({
    enabled: showCourse,
    env: courseEnv,
  });
  // Committee/start-boat coord of the course that belongs to the NEXT race
  // (the committee mark nearest the event centroid). When the course marks
  // are drawn we ride a compact "NEXT" chip on the start boat instead of the
  // big amber tag — both anchored on the venue centroid, the tag would stack
  // on the course/area labels.
  const nextEventCommittee = useMemo(
    () => findNextEventCommittee(nextEvent, courseCollection),
    [nextEvent, courseCollection],
  );
  // The course marks are actually on screen (toggle on + a course exists at
  // this venue). Only then do we hand the NEXT identity to the start-boat
  // chip; otherwise the big amber tag stays put at every zoom (nothing to
  // stack against).
  const nextCourseDrawn = showCourse && nextEventCommittee != null;
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
  // Shared builder with the web path — crucially carries the full `area`
  // payload (createdBy, classesUsed, polygon) the onPress handler needs.
  // The earlier inline version omitted `area`, so tapping a label on
  // native threw "Cannot read property 'createdBy' of undefined".
  const racingAreaLabels = useMemo(
    () => getRacingAreaLabels(raceAreasCollection),
    [raceAreasCollection],
  );
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
      pollZoom();
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
    [onMapCenterChange, pollBearing, pollZoom],
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
        zoom: 15,
        padding: { top: 120, bottom: 380 },
        duration: 400,
      });
    },
    [onPinPress],
  );
  useEffect(() => {
    if (!focusLocation) return;
    // Wait for the style to load — `flyTo`/`setStop` silently no-op
    // against an unready camera, which previously stranded the first
    // race-area focus on the default frame preset.
    if (!mapReady) return;
    // If a bounding box is provided (geocoded place result), fit the
    // camera to it so a city lands at city zoom, a neighborhood at
    // neighborhood zoom, and an address at address zoom. Falls back to
    // a hardcoded street-level fly when only a point is known.
    if (focusLocation.bounds) {
      void cameraRef.current?.setStop({
        bounds: focusLocation.bounds,
        padding: focusPadding ?? { top: 120, bottom: 380, left: 32, right: 32 },
        duration: 600,
      });
      return;
    }
    cameraRef.current?.flyTo({
      center: [focusLocation.lng, focusLocation.lat],
      zoom: focusZoomLevel,
      padding: focusPadding ?? { top: 120, bottom: 380, left: 32, right: 32 },
      duration: 500,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusLocation?.lat, focusLocation?.lng, focusLocation?.bounds, focusPadding, focusZoomLevel, mapReady]);
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
        focusPadding={focusPadding}
        focusZoomLevel={focusZoomLevel}
        nextEvent={nextEvent}
        onMapPress={onMapPress}
        candidate={candidate}
        onPinPress={onPinPress}
        onRacingAreaPress={onRacingAreaPress}
        showRaceAreas={showRaceAreas}
        courseCollection={courseCollection}
        coursePreviewCollection={coursePreviewCollection}
        showCourse={showCourse}
        onNextEventPress={onNextEventPress}
        onMapCenterChange={onMapCenterChange}
        basemap={basemap}
        baseCamera={baseCamera}
        walkLineCollection={walkLineCollection}
        raceAreasCollection={raceAreasCollection}
        hideArrowChips={hideArrowChips}
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
        onDidFinishLoadingMap={() => {
          setMapReady(true);
          pollZoom();
        }}
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

        {/* Area labels are the zoomed-out wayfinding layer; once the course
            marks appear (≥ COURSE_MIN_ZOOM) the course owns the view, so we
            drop the area label rather than let it collide with the marks and
            the NEXT chip on the start boat. */}
        {showRaceAreas && zoom < COURSE_MIN_ZOOM
          ? racingAreaLabels.map((label) => (
              <MLMarker
                key={`area-label:${label.id}`}
                id={`atlas-area-label:${label.id}`}
                lngLat={[label.lng, label.lat]}
              >
                <Pressable
                  onPress={
                    onRacingAreaPress
                      ? () => onRacingAreaPress(label.area)
                      : undefined
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${label.name} racing area`}
                >
                  <View pointerEvents="none" style={styles.areaLabelPill}>
                    <Text style={styles.areaLabelText} numberOfLines={1}>
                      {label.name}
                    </Text>
                  </View>
                </Pressable>
              </MLMarker>
            ))
          : null}

        {/* Race-course overlay — one source, layers filtered by
            properties.type and gated at zoom ≥ COURSE_MIN_ZOOM. Start/finish
            lines read as solid brand ink; laylines are dashed + dimmer; the
            start box is a soft fill with no harsh stroke; marks are small
            circles (committee distinct from buoys). */}
        {showCourse && courseCollection && courseCollection.features.length > 0 ? (
          <MLGeoJSONSource id="atlas-race-course" data={courseCollection}>
            <MLLayer
              id="atlas-course-sides"
              type="fill"
              minzoom={COURSE_MIN_ZOOM}
              filter={['==', ['get', 'type'], 'course-side']}
              style={{
                fillColor: [
                  'case',
                  ['get', 'favored'],
                  'rgba(34, 197, 94, 0.18)',
                  'rgba(20, 33, 61, 0.05)',
                ],
              }}
            />
            <MLLayer
              id="atlas-course-thirds"
              type="line"
              minzoom={COURSE_MIN_ZOOM}
              filter={['==', ['get', 'type'], 'course-third']}
              style={{
                lineColor: 'rgba(20, 33, 61, 0.35)',
                lineWidth: 1,
                lineDasharray: [2, 3],
              }}
            />
            <MLLayer
              id="atlas-course-third-labels"
              type="symbol"
              minzoom={COURSE_LABEL_MIN_ZOOM}
              filter={['==', ['get', 'type'], 'course-third-label']}
              style={{
                textField: ['get', 'label'],
                textFont: ['Noto Sans Regular'],
                textSize: 9,
                textLetterSpacing: 0.08,
                textAllowOverlap: false,
                textOptional: true,
                textColor: 'rgba(20, 33, 61, 0.55)',
                textHaloColor: 'rgba(241, 233, 216, 0.9)',
                textHaloWidth: 1.2,
              }}
            />
            <MLLayer
              id="atlas-course-side-labels"
              type="symbol"
              minzoom={COURSE_LABEL_MIN_ZOOM}
              filter={['==', ['get', 'type'], 'course-side-label']}
              style={{
                textField: ['get', 'label'],
                textFont: ['Noto Sans Regular'],
                textSize: 10,
                textLetterSpacing: 0.1,
                textAllowOverlap: false,
                textOptional: true,
                textColor: [
                  'case',
                  ['get', 'favored'],
                  'rgba(22, 130, 60, 0.95)',
                  'rgba(20, 33, 61, 0.5)',
                ],
                textHaloColor: 'rgba(241, 233, 216, 0.9)',
                textHaloWidth: 1.2,
              }}
            />
            <MLLayer
              id="atlas-course-start-box"
              type="fill"
              minzoom={COURSE_MIN_ZOOM}
              filter={['==', ['get', 'type'], 'start-box']}
              style={{ fillColor: 'rgba(20, 33, 61, 0.12)' }}
            />
            <MLLayer
              id="atlas-course-legs"
              type="line"
              filter={['==', ['get', 'type'], 'course-leg']}
              style={{
                lineColor: 'rgba(20, 33, 61, 0.72)',
                lineWidth: 1.8,
                lineDasharray: [4, 2],
              }}
            />
            <MLLayer
              id="atlas-course-laylines"
              type="line"
              minzoom={COURSE_MIN_ZOOM}
              filter={['==', ['get', 'type'], 'layline']}
              style={{
                lineColor: 'rgba(20, 33, 61, 0.55)',
                lineWidth: 1,
                lineDasharray: [3, 3],
              }}
            />
            <MLLayer
              id="atlas-course-start-line"
              type="line"
              minzoom={COURSE_MIN_ZOOM}
              filter={['==', ['get', 'type'], 'start-line']}
              style={{ lineColor: 'rgb(20, 33, 61)', lineWidth: 2 }}
            />
            <MLLayer
              id="atlas-course-finish-line"
              type="line"
              minzoom={COURSE_MIN_ZOOM}
              filter={['==', ['get', 'type'], 'finish-line']}
              style={{ lineColor: 'rgb(20, 33, 61)', lineWidth: 2 }}
            />
            <MLLayer
              id="atlas-course-marks"
              type="circle"
              minzoom={COURSE_MIN_ZOOM}
              filter={['==', ['get', 'type'], 'course-mark']}
              style={{
                circleRadius: 5,
                circleColor: [
                  'match',
                  ['get', 'markType'],
                  'committee', 'rgb(231, 137, 60)',
                  'finish', 'rgb(255, 255, 255)',
                  'rgb(20, 33, 61)',
                ],
                circleStrokeColor: 'rgb(20, 33, 61)',
                circleStrokeWidth: 1.5,
              }}
            />
          </MLGeoJSONSource>
        ) : null}

        {/* In-progress course preview — same styling as the saved overlay
            but UNGATED (no minZoomLevel) so the author sees their course at
            any zoom while the create sheet is open. */}
        {coursePreviewCollection && coursePreviewCollection.features.length > 0 ? (
          <MLGeoJSONSource id="atlas-course-preview" data={coursePreviewCollection}>
            <MLLayer
              id="atlas-course-preview-start-box"
              type="fill"
              filter={['==', ['get', 'type'], 'start-box']}
              style={{ fillColor: 'rgba(20, 33, 61, 0.12)' }}
            />
            <MLLayer
              id="atlas-course-preview-legs"
              type="line"
              filter={['==', ['get', 'type'], 'course-leg']}
              style={{
                lineColor: 'rgba(20, 33, 61, 0.72)',
                lineWidth: 1.8,
                lineDasharray: [4, 2],
              }}
            />
            <MLLayer
              id="atlas-course-preview-laylines"
              type="line"
              filter={['==', ['get', 'type'], 'layline']}
              style={{
                lineColor: 'rgba(20, 33, 61, 0.55)',
                lineWidth: 1,
                lineDasharray: [3, 3],
              }}
            />
            <MLLayer
              id="atlas-course-preview-start-line"
              type="line"
              filter={['==', ['get', 'type'], 'start-line']}
              style={{ lineColor: 'rgb(20, 33, 61)', lineWidth: 2 }}
            />
            <MLLayer
              id="atlas-course-preview-finish-line"
              type="line"
              filter={['==', ['get', 'type'], 'finish-line']}
              style={{ lineColor: 'rgb(20, 33, 61)', lineWidth: 2 }}
            />
            <MLLayer
              id="atlas-course-preview-marks"
              type="circle"
              filter={['==', ['get', 'type'], 'course-mark']}
              style={{
                circleRadius: 5,
                circleColor: [
                  'match',
                  ['get', 'markType'],
                  'committee', 'rgb(231, 137, 60)',
                  'finish', 'rgb(255, 255, 255)',
                  'rgb(20, 33, 61)',
                ],
                circleStrokeColor: 'rgb(20, 33, 61)',
                circleStrokeWidth: 1.5,
              }}
            />
          </MLGeoJSONSource>
        ) : null}

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
              isRace={pin.isRace}
              clusterCount={pin.clusterCount}
              clusterUnit={clusterUnit}
              glowCluster={pin.glowCluster}
              showLabel={shouldShowLabel(pin, pins)}
              hideArrowChips={hideArrowChips}
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

        {nextEvent && !(zoom >= COURSE_MIN_ZOOM && nextCourseDrawn) ? (
          <MLMarker
            id="atlas-next-event"
            lngLat={[nextEvent.lng, nextEvent.lat]}
            anchor="bottom"
          >
            {onNextEventPress ? (
              <Pressable onPress={onNextEventPress} hitSlop={4}>
                <NextEventMarker
                  label={nextEvent.label}
                  when={nextEvent.when}
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
                />
              </View>
            )}
          </MLMarker>
        ) : null}

        {nextEvent && nextEventCommittee && zoom >= COURSE_MIN_ZOOM && nextCourseDrawn ? (
          <MLMarker
            id="atlas-next-event-chip"
            lngLat={[nextEventCommittee.lng, nextEventCommittee.lat]}
            anchor="bottom"
          >
            {onNextEventPress ? (
              <Pressable onPress={onNextEventPress} hitSlop={6}>
                <NextEventChip />
              </Pressable>
            ) : (
              <View pointerEvents="none">
                <NextEventChip />
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
  focusPadding,
  focusZoomLevel = 14,
  nextEvent,
  onMapPress,
  candidate,
  onPinPress,
  onRacingAreaPress,
  showRaceAreas,
  showCourse = false,
  onNextEventPress,
  onMapCenterChange,
  basemap = 'map',
  baseCamera,
  walkLineCollection,
  raceAreasCollection,
  courseCollection,
  coursePreviewCollection = null,
  hideArrowChips = false,
}: AtlasMapLibreCanvasProps & {
  pins: AtlasPinSpec[];
  baseCamera: CameraPreset;
  walkLineCollection: GeoJSON.FeatureCollection;
  raceAreasCollection: GeoJSON.FeatureCollection;
  courseCollection: GeoJSON.FeatureCollection;
}) {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const maplibreRef = useRef<any>(null);
  const pinMarkersRef = useRef<any[]>([]);
  const areaLabelMarkersRef = useRef<any[]>([]);
  const nextMarkerRef = useRef<any | null>(null);
  const nextChipMarkerRef = useRef<any | null>(null);
  const candidateMarkerRef = useRef<any | null>(null);
  const onMapPressRef = useRef(onMapPress);
  const onRacingAreaPressRef = useRef(onRacingAreaPress);
  const onMapCenterChangeRef = useRef(onMapCenterChange);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [bearing, setBearing] = useState(0);
  // Live zoom — hides the amber NEXT marker once the course marks become
  // visible (≥ COURSE_MIN_ZOOM) so the two don't stack on the venue centroid.
  const [zoom, setZoom] = useState(baseCamera.zoom);
  // Start-boat coord of the NEXT race's course + whether its marks are drawn,
  // so the zoomed-in NEXT identity rides a compact chip on the committee mark
  // (see the native path for the full rationale).
  const nextEventCommittee = useMemo(
    () => findNextEventCommittee(nextEvent, courseCollection),
    [nextEvent, courseCollection],
  );
  const nextCourseDrawn = showCourse && nextEventCommittee != null;
  const resetBearing = useCallback(() => {
    mapRef.current?.easeTo({ bearing: 0, duration: 300 });
    setBearing(0);
  }, []);

  useEffect(() => {
    onMapPressRef.current = onMapPress;
  }, [onMapPress]);

  useEffect(() => {
    onRacingAreaPressRef.current = onRacingAreaPress;
  }, [onRacingAreaPress]);

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

        map.on('zoom', () => {
          setZoom(map.getZoom());
        });

        map.on('load', () => {
          if (cancelled) return;
          setMapError(null);
          setIsLoaded(true);
          setZoom(map.getZoom());
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
    // Mirror the native side: fit the bounding box when present
    // (city/neighborhood/address get the right zoom each), else fall
    // back to a hardcoded street-level ease.
    if (focusLocation.bounds) {
      const [west, south, east, north] = focusLocation.bounds;
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        {
          padding: focusPadding ?? { top: 120, bottom: 380, left: 32, right: 32 },
          duration: 600,
        },
      );
      return;
    }
    map.easeTo({
      center: [focusLocation.lng, focusLocation.lat],
      zoom: focusZoomLevel,
      padding: focusPadding ?? { top: 120, bottom: 380, left: 32, right: 32 },
      duration: 500,
    });
    // Depend only on the lat/lng/bounds values — including the
    // focusLocation object itself causes easeTo to re-fire on every
    // parent render (the parent recreates the object inline), which
    // flies the camera back to its last focus on every state change
    // unrelated to focus.
  }, [focusLocation?.lat, focusLocation?.lng, focusLocation?.bounds, focusPadding, focusZoomLevel, isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // Keep the faint area fill at every zoom, but drop the area-name labels
    // once the course marks appear (≥ COURSE_MIN_ZOOM) — at that zoom the
    // course owns the view and the label only collides with the marks and
    // the NEXT chip. Mirrors the native gate.
    if (zoom >= COURSE_MIN_ZOOM) return;
    areaLabelMarkersRef.current = getRacingAreaLabels(raceAreasCollection).map((label) =>
      new Marker({
        element: createWebAreaLabelElement(label.name, () => {
          onRacingAreaPressRef.current?.(label.area);
        }),
      })
        .setLngLat([label.lng, label.lat])
        .addTo(map),
    );
  }, [isLoaded, raceAreasCollection, showRaceAreas, zoom]);

  // Race-course overlay (web) — mirrors the native layer set: one source,
  // five layers filtered by properties.type, each gated at zoom ≥
  // COURSE_MIN_ZOOM. Painted to match native (solid lines, dashed
  // laylines, soft start box, circle marks).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    const show = showCourse && courseCollection && courseCollection.features.length > 0;
    if (!show) {
      for (const id of COURSE_WEB_LAYER_IDS) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource('atlas-web-course')) map.removeSource('atlas-web-course');
      return;
    }

    const source = map.getSource('atlas-web-course');
    if (source?.setData) {
      source.setData(courseCollection);
    } else {
      map.addSource('atlas-web-course', { type: 'geojson', data: courseCollection });
      for (const layer of COURSE_WEB_LAYERS) {
        map.addLayer({
          ...layer,
          source: 'atlas-web-course',
          minzoom: layer.minzoom ?? COURSE_MIN_ZOOM,
        });
      }
    }
  }, [isLoaded, courseCollection, showCourse]);

  // In-progress course preview (web) — same layer set as above but on a
  // separate source/ids and UNGATED (no minzoom) so the author sees their
  // course at any zoom while the create sheet is open.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    const show =
      coursePreviewCollection && coursePreviewCollection.features.length > 0;
    if (!show) {
      for (const layer of COURSE_WEB_LAYERS) {
        const id = `${layer.id}-preview`;
        if (map.getLayer(id)) map.removeLayer(id);
      }
      if (map.getSource('atlas-web-course-preview')) {
        map.removeSource('atlas-web-course-preview');
      }
      return;
    }

    const source = map.getSource('atlas-web-course-preview');
    if (source?.setData) {
      source.setData(coursePreviewCollection);
    } else {
      map.addSource('atlas-web-course-preview', {
        type: 'geojson',
        data: coursePreviewCollection,
      });
      for (const layer of COURSE_WEB_LAYERS) {
        const { minzoom: _omitMinzoom, ...rest } = layer;
        map.addLayer({
          ...rest,
          id: `${layer.id}-preview`,
          source: 'atlas-web-course-preview',
        });
      }
    }
  }, [isLoaded, coursePreviewCollection]);

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
        hideArrowChips,
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
  }, [isLoaded, onPinPress, pins, hideArrowChips]);

  useEffect(() => {
    const map = mapRef.current;
    const Marker = maplibreRef.current?.Marker;
    if (!map || !Marker || !isLoaded) return;

    nextMarkerRef.current?.remove();
    nextMarkerRef.current = null;
    // Hide the big NEXT tag once the course marks are drawn and we're zoomed
    // in — both sit on the venue centroid, so co-rendering stacks two boxes.
    // The chip on the start boat (below) carries the identity at that zoom.
    if (!nextEvent || (zoom >= COURSE_MIN_ZOOM && nextCourseDrawn)) return;

    const element = createWebNextEventElement(nextEvent, onNextEventPress);
    nextMarkerRef.current = new Marker({ element, anchor: 'bottom' })
      .setLngLat([nextEvent.lng, nextEvent.lat])
      .addTo(map);
  }, [isLoaded, nextEvent, onNextEventPress, zoom, nextCourseDrawn]);

  useEffect(() => {
    const map = mapRef.current;
    const Marker = maplibreRef.current?.Marker;
    if (!map || !Marker || !isLoaded) return;

    nextChipMarkerRef.current?.remove();
    nextChipMarkerRef.current = null;
    // Zoomed-in counterpart: a compact NEXT chip on the start boat.
    if (!nextEvent || !nextEventCommittee || zoom < COURSE_MIN_ZOOM || !nextCourseDrawn) {
      return;
    }

    const element = createWebNextEventChipElement(onNextEventPress);
    nextChipMarkerRef.current = new Marker({ element, anchor: 'bottom' })
      .setLngLat([nextEventCommittee.lng, nextEventCommittee.lat])
      .addTo(map);
  }, [isLoaded, nextEvent, nextEventCommittee, onNextEventPress, zoom, nextCourseDrawn]);

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
      {/* Loading veil — the MapLibre tiles/style take a beat to fetch on
          a cold load, during which the container is blank. Cover it with
          a land-toned panel + spinner so the first paint reads as
          "map is coming" rather than a broken white screen. */}
      {!isLoaded ? (
        <View pointerEvents="none" style={styles.mapLoadingVeil}>
          <ActivityIndicator size="small" color="#8E8E93" />
          <Text style={styles.mapLoadingText}>Loading map…</Text>
        </View>
      ) : null}
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
): {
  id: string;
  name: string;
  lng: number;
  lat: number;
  area: AtlasRacingAreaPressTarget;
}[] {
  const out: {
    id: string;
    name: string;
    lng: number;
    lat: number;
    area: AtlasRacingAreaPressTarget;
  }[] = [];
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
    const props = feature.properties as {
      id?: string;
      name?: string;
      classesUsed?: string[];
      createdBy?: string | null;
    } | null;
    const name = props?.name;
    const id = props?.id;
    if (!name || !id) continue;
    const lng = lngSum / ring.length;
    const lat = latSum / ring.length;
    out.push({
      id,
      name,
      lng,
      lat,
      area: {
        id,
        name,
        centerLat: lat,
        centerLng: lng,
        classesUsed: props?.classesUsed ?? [],
        createdBy: props?.createdBy ?? null,
        polygon: geom,
      },
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
  hideArrowChips = false,
}: {
  pin: AtlasPinSpec;
  showLabel: boolean;
  isTappable: boolean;
  onPress?: () => void;
  hideArrowChips?: boolean;
}) {
  // Wind and tide arrows have their own DOM shape — a rotated glyph
  // plus an optional value chip. The generic circle path below would
  // otherwise render them as blue dots (which is what reached web
  // before this branch). Native uses LabeledPin's wind-arrow /
  // tide-arrow blocks; this mirrors them in plain DOM for web parity.
  if (pin.kind === 'wind-arrow' || pin.kind === 'tide-arrow' || pin.kind === 'wave-arrow') {
    return createWebArrowElement(pin, hideArrowChips);
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

  if (pin.kind === 'mentor-cluster-alert' || pin.kind === 'mentor-cluster-ok') {
    const [name, countStr, subLabelRaw] = (pin.label ?? '').split('|');
    const count = Number(countStr) || pin.clusterCount || 0;
    const alert = pin.kind === 'mentor-cluster-alert';
    const toneColor = alert ? '#D97706' : '#15803D';
    const bubble = document.createElement('span');
    bubble.style.display = 'inline-flex';
    bubble.style.alignItems = 'center';
    bubble.style.gap = '6px';
    bubble.style.height = '46px';
    bubble.style.padding = '0 11px';
    bubble.style.borderRadius = '18px';
    bubble.style.background = '#fff';
    bubble.style.border = `3px solid ${toneColor}`;
    bubble.style.boxShadow = '0 7px 18px rgba(30,22,12,0.22)';

    const icon = document.createElement('span');
    icon.textContent = '👥';
    icon.style.display = 'inline-flex';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    icon.style.width = '25px';
    icon.style.height = '25px';
    icon.style.borderRadius = '999px';
    icon.style.background = toneColor;
    icon.style.color = '#fff';
    icon.style.fontSize = '13px';
    icon.style.lineHeight = '1';
    bubble.appendChild(icon);

    const countEl = document.createElement('strong');
    countEl.textContent = String(count);
    countEl.style.fontSize = '18px';
    countEl.style.fontWeight = '900';
    countEl.style.color = '#1F2937';
    countEl.style.letterSpacing = '-0.2px';
    bubble.appendChild(countEl);
    root.appendChild(bubble);

    if (showLabel && name) {
      const labelWrap = document.createElement('span');
      labelWrap.style.display = 'inline-flex';
      labelWrap.style.flexDirection = 'column';
      labelWrap.style.maxWidth = '130px';
      labelWrap.style.padding = '4px 8px';
      labelWrap.style.borderRadius = '10px';
      labelWrap.style.background = 'rgba(255,255,255,0.94)';
      labelWrap.style.boxShadow = '0 4px 12px rgba(30,22,12,0.12)';

      const nameEl = document.createElement('span');
      nameEl.textContent = name;
      nameEl.style.fontSize = '12px';
      nameEl.style.fontWeight = '900';
      nameEl.style.color = '#1F2937';
      nameEl.style.whiteSpace = 'nowrap';
      nameEl.style.overflow = 'hidden';
      nameEl.style.textOverflow = 'ellipsis';
      labelWrap.appendChild(nameEl);

      const subEl = document.createElement('span');
      subEl.textContent = subLabelRaw || (alert ? 'needs attention' : 'on track');
      subEl.style.fontSize = '9.5px';
      subEl.style.fontWeight = '800';
      subEl.style.color = toneColor;
      subEl.style.whiteSpace = 'nowrap';
      labelWrap.appendChild(subEl);
      root.appendChild(labelWrap);
    }
    return root;
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

  // Phase N.4 binary — a step is just a step. The one first-class
  // distinction is race vs not: a race carries course/marks/conditions, so
  // it gets the ⛵ blue pin. Every other my-step pin keeps its neutral blue
  // relationship dot (time-graded by kind, no activity glyph).
  if (pin.isRace && pin.kind.startsWith('my-step')) {
    marker.style.background =
      pin.kind === 'my-step-done-old' ? hexWithAlpha(RACE_PIN_COLOR, 0.4) : RACE_PIN_COLOR;
    if (!pin.clusterCount && (pin.kind === 'my-step-next' || pin.kind === 'my-step-done-just' || pin.kind === 'my-step-planned')) {
      marker.textContent = '⛵';
      marker.style.fontSize = '10px';
    }
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

function createWebArrowElement(pin: AtlasPinSpec, hideArrowChips = false) {
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
  const isWave = pin.kind === 'wave-arrow';
  const isField = variant === 'field';
  const deg = Number(degStr) || 0;
  // For waves this second value is significant height in metres, not knots.
  const knots = Number(knotsStr) || 0;
  const waveM = isWind && waveStr ? Number(waveStr) : null;
  const source = isWind && sourceStr && sourceStr.length > 0 ? sourceStr : null;
  // Wind: arrow points DOWNWIND (away from source). Tide: arrow points
  // the direction the current flows TO (set). So wind needs +180,
  // tide does not.
  const rotateDeg = isWind ? (deg + 180) % 360 : deg;

  // Pressure-encode wind field arrows: size + ink scale with knots so the
  // field reads breeze strength at a glance (mirror of the native path).
  const windT = Math.max(0, Math.min(28, knots)) / 28;
  const windFieldSize = 12 + windT * 11;
  const windFieldAlpha = (0.4 + windT * 0.42).toFixed(2);
  const glyphSize = isField ? (isWind ? windFieldSize : 16) : 26;
  const glyph = document.createElement('div');
  glyph.style.fontSize = `${glyphSize}px`;
  glyph.style.lineHeight = '1';
  glyph.style.transform = `rotate(${rotateDeg}deg)`;
  glyph.style.color = isField
    ? isWind
      ? `rgba(113, 143, 168, ${windFieldAlpha})`
      : isWave
        ? 'rgba(110, 108, 200, 0.78)'
        : 'rgba(96, 130, 138, 0.78)'
    : isWind
      ? windColorForKnots(knots, 0.95)
      : isWave
        ? 'rgba(94, 92, 230, 0.95)'
        : 'rgba(0, 168, 168, 0.95)';
  // Up-arrow (wind) / chevron-up (tide), both natively point north so
  // rotation maps cleanly to compass bearings.
  glyph.textContent = isWind ? '↑' : '⌃';

  if (!isField) {
    const typeLabel = document.createElement('span');
    typeLabel.textContent = isWind ? 'WIND' : isWave ? 'SWELL' : 'CURRENT';
    typeLabel.style.padding = '1px 5px';
    typeLabel.style.borderRadius = '5px';
    typeLabel.style.background = 'rgba(255,255,255,0.82)';
    typeLabel.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    typeLabel.style.fontSize = '8px';
    typeLabel.style.fontWeight = '800';
    typeLabel.style.letterSpacing = '0';
    typeLabel.style.color = isWind
      ? 'rgba(37, 99, 235, 0.95)'
      : isWave
        ? 'rgba(94, 92, 230, 0.95)'
        : 'rgba(0, 140, 140, 0.95)';
    typeLabel.style.whiteSpace = 'nowrap';
    root.appendChild(typeLabel);

    const disc = document.createElement('div');
    disc.style.width = '40px';
    disc.style.height = '40px';
    disc.style.borderRadius = '999px';
    disc.style.display = 'flex';
    disc.style.alignItems = 'center';
    disc.style.justifyContent = 'center';
    disc.style.background = 'rgba(255,255,255,0.88)';
    disc.style.border = isWind
      ? '1px solid rgba(37,99,235,0.38)'
      : isWave
        ? '1px solid rgba(94,92,230,0.38)'
        : '1px solid rgba(0,168,168,0.42)';
    disc.style.boxShadow = '0 4px 12px rgba(0,0,0,0.16)';
    disc.appendChild(glyph);
    root.appendChild(disc);
  } else {
    root.appendChild(glyph);
  }

  if (!isField && !hideArrowChips && knots > 0) {
    const chip = document.createElement('span');
    const padded = ((Math.round(deg) % 360) + 360) % 360;
    const padStr = padded.toString().padStart(3, '0');
    const knotsLabel = isWind ? Math.round(knots) : knots.toFixed(1);
    const waveSuffix =
      waveM != null && Number.isFinite(waveM) ? ` · ${waveM.toFixed(1)}m` : '';
    chip.textContent = isWave
      ? `${padStr}° · ${knots.toFixed(1)}m`
      : `${padStr}° · ${knotsLabel} kn${waveSuffix}`;
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
  const eyebrow = document.createElement('div');
  eyebrow.textContent = 'NEXT';
  eyebrow.style.font = '800 8px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  eyebrow.style.letterSpacing = '1px';
  eyebrow.style.color = '#B26B00';
  const name = document.createElement('div');
  name.textContent = `${nextEvent.label}${nextEvent.when ? ` · ${nextEvent.when}` : ''}`;
  name.style.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  name.style.color = '#8A4B00';
  name.style.marginTop = '1px';
  root.appendChild(eyebrow);
  root.appendChild(name);
  root.style.textAlign = 'left';
  root.style.maxWidth = '150px';
  root.style.border = '1px solid #F0A93A';
  root.style.padding = '4px 8px';
  root.style.borderRadius = '6px';
  root.style.background = '#FFE6B0';
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

// Compact "NEXT" chip for the start boat — the zoomed-in counterpart to the
// big web NEXT tag, so the next race stays identified without stacking.
function createWebNextEventChipElement(onPress?: () => void) {
  const root = document.createElement(onPress ? 'button' : 'div');
  root.textContent = 'NEXT';
  root.style.border = '1px solid #F0A93A';
  root.style.padding = '2px 6px';
  root.style.borderRadius = '999px';
  root.style.background = '#FFE6B0';
  root.style.color = '#8A4B00';
  root.style.font = '800 9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  root.style.letterSpacing = '0.8px';
  root.style.boxShadow = '0 0 3px rgba(240, 169, 58, 0.45)';
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
  if (pin.kind === 'mentor-cluster-alert' || pin.kind === 'mentor-cluster-ok') return true;
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
    case 'f8':
      return WorldDragonMap;
    case 'f9':
      // Golf should normally render the live MapLibre satellite canvas.
      // If web MapLibre fails before tiles load, use the neutral JHU
      // schematic rather than silently falling through to an undefined
      // component. The surrounding GolfAtlasSurface still owns the golf
      // pins and cards, and the error banner below explains the failure.
      return JhuCuratedMap;
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

/**
 * Phase N.4 — the one step distinction Atlas draws: race ⛵. A race carries
 * venue/course/marks/conditions, so its pin gets this royal blue + sail glyph.
 * Matches the composer's PlanStepRaceSelector RACE tone and mockup 27.
 */
const RACE_PIN_COLOR = '#2563EB';
const RACE_PIN_GLYPH = '⛵';

/** "#2563EB" + 0.4 → "rgba(37, 99, 235, 0.4)". Tints kind colors for faded pins. */
function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const PIN_TONE: Record<
  AtlasPinSpec['kind'],
  { size: number; color: string; shape: PinShape }
> = {
  // Relationships — circles
  you: { size: 14, color: '#FF3B30', shape: 'circle' },
  crew: { size: 11, color: '#FF3B30', shape: 'circle' },
  fleet: { size: 10, color: 'rgba(40, 50, 70, 0.85)', shape: 'circle' },
  following: { size: 8, color: 'rgba(60, 70, 90, 0.55)', shape: 'circle' },
  // peer-focus — a single sailor pulled out of a privacy cluster. Large,
  // saturated, white-ringed so it reads as "this is the one you tapped"
  // over the faint relationship dots; LabeledPin also gives it a name + halo.
  'peer-focus': { size: 20, color: '#FF9500', shape: 'circle' },
  'org-event': { size: 22, color: '#0A84FF', shape: 'circle' },
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
  'mentor-cluster-alert': { size: 46, color: '#D97706', shape: 'circle' },
  'mentor-cluster-ok': { size: 42, color: '#15803D', shape: 'circle' },
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
  // Wave / swell arrow — muted indigo, the tertiary marine field. Arrow
  // points the direction waves TRAVEL (set convention, like tide — not
  // where they come from). Smallest of the three so it reads last.
  'wave-arrow': { size: 12, color: 'rgba(94, 92, 230, 0.7)', shape: 'circle' },
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
  isRace,
  clusterCount,
  clusterUnit,
  glowCluster,
  showLabel = true,
  hideArrowChips = false,
}: {
  kind: AtlasPinSpec['kind'];
  label?: string;
  /** Phase N.4 — true on race my-step pins; gives the ⛵ blue dot + glyph. */
  isRace?: boolean;
  clusterCount?: number;
  /** Interest-aware noun for the cluster pill ("session"/"shift"/…). */
  clusterUnit?: string;
  glowCluster?: string;
  /** When false, suppress the label pill — used for label-hide-until-tap at z11+. */
  showLabel?: boolean;
  /** Suppress wind/tide/wave value chips — a conditions card owns the numbers. */
  hideArrowChips?: boolean;
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
    // bands at a glance; field arrows stay soft slate so the sparse grid
    // reads as ambience, not a wall of foreground signals.
    const primaryColor = windColorForKnots(knots, 0.95);
    // Pressure-encode the field: a glance at arrow weight (length + ink)
    // should read the breeze strength, so a 6kn drift and a 22kn blow
    // don't look identical. Scale size 14→26 and alpha 0.40→0.82 across
    // 0–28kn so light air whispers and fresh breeze reads bold.
    const t = Math.max(0, Math.min(28, knots)) / 28;
    const fieldSize = 14 + t * 12;
    const fieldOpacity = 0.4 + t * 0.42;
    return (
      <View style={isField ? styles.windFieldWrap : styles.windArrowWrap}>
        {!isField ? <Text style={[styles.arrowTypeLabel, styles.windTypeLabel]}>WIND</Text> : null}
        <View style={[isField ? styles.fieldArrowDisc : styles.arrowDisc, { transform: [{ rotate: `${downwindDeg}deg` }] }]}>
          <Ionicons
            name="arrow-up"
            size={isField ? fieldSize : 22}
            color={isField ? `rgba(113, 143, 168, ${fieldOpacity.toFixed(2)})` : primaryColor}
          />
        </View>
        {!isField && !hideArrowChips && knots > 0 ? (
          <Text style={styles.arrowChip}>
            {waveM != null && Number.isFinite(waveM)
              ? `${padDeg(fromDeg)}° · ${Math.round(knots)} kn · ${waveM.toFixed(1)}m`
              : `${padDeg(fromDeg)}° · ${Math.round(knots)} kn`}
          </Text>
        ) : null}
        {!isField && !hideArrowChips && source ? (
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
        {!isField ? <Text style={[styles.arrowTypeLabel, styles.currentTypeLabel]}>CURRENT</Text> : null}
        <View
          style={[
            isField ? styles.fieldArrowDisc : styles.arrowDisc,
            { transform: [{ rotate: `${setDeg}deg` }] },
          ]}
        >
          <Ionicons
            name="chevron-up"
            size={isField ? 18 : 22}
            color={isField ? 'rgba(96, 130, 138, 0.78)' : 'rgba(0, 168, 168, 0.95)'}
          />
        </View>
        {!isField && !hideArrowChips && knots > 0 ? (
          <Text style={styles.arrowChip}>{`${padDeg(setDeg)}° · ${knots.toFixed(1)} kn`}</Text>
        ) : null}
      </View>
    );
  }
  if (kind === 'wave-arrow') {
    // Wave convention: "set" — arrow points where swell TRAVELS, no flip
    // (same as tide). Label is "deg|heightM[|field]"; the chip shows
    // significant wave height in metres rather than knots. Mirror of
    // tide-arrow with an indigo treatment so the three marine fields stay
    // visually distinct.
    const [degStr, heightStr, variant] = (label ?? '0|0').split('|');
    const setDeg = Number(degStr) || 0;
    const heightM = Number(heightStr) || 0;
    const isField = variant === 'field';
    return (
      <View style={isField ? styles.windFieldWrap : styles.tideArrowWrap}>
        {!isField ? <Text style={[styles.arrowTypeLabel, styles.waveTypeLabel]}>SWELL</Text> : null}
        <View
          style={[
            isField ? styles.fieldArrowDisc : styles.arrowDisc,
            { transform: [{ rotate: `${setDeg}deg` }] },
          ]}
        >
          <Ionicons
            name="chevron-up"
            size={isField ? 18 : 22}
            color={isField ? 'rgba(110, 108, 200, 0.78)' : 'rgba(94, 92, 230, 0.95)'}
          />
        </View>
        {!isField && !hideArrowChips && heightM > 0 ? (
          <Text style={styles.arrowChip}>{`${padDeg(setDeg)}° · ${heightM.toFixed(1)}m`}</Text>
        ) : null}
      </View>
    );
  }
  // Hero treatment for the "next" step — the one right of the timeline
  // NOW bar. Bold blue dot inside an amber halo with a NEXT badge so the
  // viewer can spot their next move at a glance.
  // Phase N.4 binary — only races get a tinted dot + glyph (⛵ royal blue).
  // Status (next/done/planned) still drives size + halo + badge; race owns
  // the dot color + glyph. Non-race steps fall back to the systemBlue
  // relationship dot with no activity glyph.
  const raceCfg = isRace ? { color: RACE_PIN_COLOR, glyph: RACE_PIN_GLYPH } : null;
  if (kind === 'my-step-next') {
    const titleLabel = (label ?? '').split('|')[0] ?? '';
    return (
      <View style={styles.pinRow}>
        <View style={styles.glyphCol}>
          <View pointerEvents="none" style={styles.myStepNextHalo} />
          <View
            style={[
              styles.myStepNextDot,
              raceCfg ? { backgroundColor: raceCfg.color } : null,
            ]}
          >
            {raceCfg ? <Text style={styles.myStepGlyphHero}>{raceCfg.glyph}</Text> : null}
          </View>
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
    if (raceCfg) {
      return (
        <View style={styles.pinRow}>
          <View style={styles.glyphCol}>
            <View pointerEvents="none" style={styles.myStepRaceHalo} />
            <View style={styles.myStepRaceDot}>
              <Text style={styles.myStepGlyphHero}>{raceCfg.glyph}</Text>
            </View>
          </View>
          {showLabel && titleLabel ? (
            <Text style={styles.pinLabel} numberOfLines={1}>
              {titleLabel}
            </Text>
          ) : null}
        </View>
      );
    }
    return (
      <View style={styles.pinRow}>
        <View style={styles.glyphCol}>
          <View pointerEvents="none" style={styles.myStepDoneJustHalo} />
          <View
            style={styles.myStepDoneJustDot}
          >
          </View>
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
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: raceCfg ? raceCfg.color : 'rgba(0, 122, 255, 0.95)',
            borderWidth: 2,
            borderColor: '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {raceCfg ? <Text style={styles.myStepGlyph}>{raceCfg.glyph}</Text> : null}
        </View>
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
  if (kind === 'mentor-cluster-alert' || kind === 'mentor-cluster-ok') {
    const [name, countStr, subLabelRaw] = (label ?? '').split('|');
    const count = Number(countStr) || clusterCount || 0;
    const alert = kind === 'mentor-cluster-alert';
    const tone = alert ? '#D97706' : '#15803D';
    const subLabel = subLabelRaw || (alert ? 'needs attention' : 'on track');
    return (
      <View style={styles.mentorClusterPin}>
        <View
          style={[
            styles.mentorClusterBubble,
            alert && styles.mentorClusterBubbleAlert,
          ]}
        >
          <View style={[styles.mentorClusterIcon, { backgroundColor: tone }]}>
            <Ionicons name="people" size={17} color="#FFFFFF" />
          </View>
          <Text style={[styles.mentorClusterCount, { color: tone }]}>
            {count}
          </Text>
        </View>
        {showLabel && name ? (
          <View style={styles.mentorClusterLabel}>
            <Text style={styles.mentorClusterName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.mentorClusterSub, { color: tone }]} numberOfLines={1}>
              {subLabel}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }
  // peer-focus — the one sailor a Nearby tap / cluster drill-down broke out
  // of the privacy cluster. A pulse halo + saturated dot + always-on name so
  // the tap visibly lands on something instead of a faint relationship dot.
  if (kind === 'peer-focus') {
    return (
      <View style={styles.pinRow}>
        <View style={styles.glyphCol}>
          <View pointerEvents="none" style={styles.peerFocusHalo} />
          <View style={styles.peerFocusDot} />
        </View>
        {label ? (
          <View style={styles.peerFocusLabelPill}>
            <Text style={styles.peerFocusLabelText} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }
  // org-event — an org-published located step (race briefing, learn-to-sail).
  // Calendar glyph in a saturated square + always-on title so attendable
  // activity reads as "go to this," distinct from the faint peer dots.
  if (kind === 'org-event') {
    return (
      <View style={styles.pinRow}>
        <View style={styles.glyphCol}>
          <View style={styles.orgEventMarker}>
            <Ionicons name="calendar" size={13} color="#FFFFFF" />
          </View>
        </View>
        {label ? (
          <View style={styles.orgEventLabelPill}>
            <Text style={styles.orgEventLabelText} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }
  const baseTone = PIN_TONE[kind];
  if (!baseTone) {
    // Pin kind not in PIN_TONE — likely a new kind added without a
    // matching tone entry. Skip rather than crash the whole canvas.
    if (__DEV__) console.warn('[atlas] no PIN_TONE entry for kind', kind);
    return null;
  }
  // For the small status-encoded my-step dots (done-recent / done-old),
  // tint by activity kind so they stay color-coded with the hero pins,
  // softened to read as "older / settled".
  const tone =
    raceCfg && kind.startsWith('my-step')
      ? { ...baseTone, color: hexWithAlpha(raceCfg.color, kind === 'my-step-done-old' ? 0.4 : 0.85) }
      : baseTone;
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
}: {
  label: string;
  when?: string;
}) {
  return (
    <View style={styles.nextTag}>
      <Text style={styles.nextTagEyebrow}>NEXT</Text>
      <Text style={styles.nextTagLabel} numberOfLines={2}>
        {label}
        {when ? <Text style={styles.nextTagWhen}>{` · ${when}`}</Text> : null}
      </Text>
    </View>
  );
}

// Compact "NEXT" chip that rides on the start boat once the course marks are
// drawn — the zoomed-in counterpart to the big amber NEXT tag, so the next
// race stays identified on the map without stacking on the course/area labels.
function NextEventChip() {
  return (
    <View style={styles.nextChip}>
      <Text style={styles.nextChipText}>NEXT</Text>
    </View>
  );
}

// Find the committee/start-boat coord of the course nearest the NEXT event
// centroid (the hook fetches every active course globally, so we match the
// one at this venue by proximity). Null when there's no event or no course
// committee mark to anchor to.
function findNextEventCommittee(
  nextEvent: (AtlasNextEvent & { lng: number; lat: number }) | null | undefined,
  courseCollection: GeoJSON.FeatureCollection | null | undefined,
): { lng: number; lat: number } | null {
  if (!nextEvent || !courseCollection) return null;
  let best: { lng: number; lat: number } | null = null;
  let bestDist = Infinity;
  for (const feature of courseCollection.features) {
    if (feature.geometry?.type !== 'Point') continue;
    const props = feature.properties ?? {};
    if (props.type !== 'course-mark' || props.markType !== 'committee') continue;
    const [lng, lat] = feature.geometry.coordinates as [number, number];
    const dist = (lng - nextEvent.lng) ** 2 + (lat - nextEvent.lat) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = { lng, lat };
    }
  }
  return best;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  mapLoadingVeil: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    // Positron land tone — blends into the tiles as they fade in so the
    // hand-off from veil to map is near-seamless.
    backgroundColor: '#E9E9EC',
  },
  mapLoadingText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
    letterSpacing: 0.2,
  },
  webMapError: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 96,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.18)',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  webMapErrorTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  webMapErrorBody: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 15,
    color: '#636366',
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
  mentorClusterPin: {
    alignItems: 'center',
    gap: 5,
  },
  mentorClusterBubble: {
    minWidth: 72,
    height: 48,
    borderRadius: 18,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#15803D',
    shadowColor: '#1E160C',
    shadowOpacity: 0.23,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  mentorClusterBubbleAlert: {
    borderColor: '#D97706',
  },
  mentorClusterIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mentorClusterCount: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  mentorClusterLabel: {
    maxWidth: 138,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    shadowColor: '#1E160C',
    shadowOpacity: 0.12,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    alignItems: 'center',
  },
  mentorClusterName: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '900',
  },
  mentorClusterSub: {
    marginTop: 1,
    fontSize: 9.5,
    fontWeight: '800',
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  arrowTypeLabel: {
    marginBottom: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0,
  },
  windTypeLabel: {
    color: '#2563EB',
  },
  currentTypeLabel: {
    color: '#008C8C',
  },
  waveTypeLabel: {
    color: '#5E5CE6',
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
  peerFocusHalo: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    top: -9,
    left: -9,
    backgroundColor: 'rgba(255, 149, 0, 0.24)',
    borderWidth: 2,
    borderColor: 'rgba(255, 149, 0, 0.85)',
  },
  peerFocusDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF9500',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  peerFocusLabelPill: {
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 149, 0, 0.95)',
  },
  peerFocusLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  orgEventMarker: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: '#0A84FF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgEventLabelPill: {
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 11,
    backgroundColor: 'rgba(10, 132, 255, 0.95)',
  },
  orgEventLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
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
  myStepGlyph: {
    fontSize: 8,
    lineHeight: 10,
    textAlign: 'center',
  },
  myStepGlyphHero: {
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
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
  myStepRaceHalo: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    top: -5,
    left: -5,
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(37, 99, 235, 0.55)',
  },
  myStepRaceDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: RACE_PIN_COLOR,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  nextTag: {
    backgroundColor: '#FFE6B0',
    borderColor: '#F0A93A',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: 150,
    shadowColor: '#F0A93A',
    shadowOpacity: 0.45,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  nextTagEyebrow: {
    fontSize: 8,
    fontWeight: '800',
    color: '#B26B00',
    letterSpacing: 1,
  },
  nextTagLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A4B00',
    letterSpacing: -0.1,
    marginTop: 1,
  },
  nextTagWhen: {
    fontWeight: '500',
    color: '#A66A1E',
  },
  nextChip: {
    backgroundColor: '#FFE6B0',
    borderColor: '#F0A93A',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    shadowColor: '#F0A93A',
    shadowOpacity: 0.45,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
  },
  nextChipText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#8A4B00',
    letterSpacing: 0.8,
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
