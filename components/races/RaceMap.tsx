/**
 * <RaceMap> — shared MapLibre primitive for every map surface in the app.
 *
 * One map stack, one tile provider (OpenFreeMap Liberty by default), no
 * Google Maps dependency. Renders three primitives:
 *   1. Course marks       — colored Marker pins per CourseMark
 *   2. Course lines       — start line, finish line, optional course path
 *   3. Overlay slot       — `children` render inside the map, so callers can
 *                            drop in WindArrow / CurrentArrow / FleetPins
 *                            as MapLibre Markers/Sources.
 *
 * Replaces the old react-native-maps surfaces (CourseMapView, RaceMapCard,
 * TacticalRaceMap, GPSTrackMapView, LocationMapPicker). Domain wrappers
 * translate their feature-specific props into this primitive.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Map as MLMap,
  Camera as MLCamera,
  Marker as MLMarker,
  GeoJSONSource as MLGeoJSONSource,
  Layer as MLLayer,
  type CameraRef,
} from '@maplibre/maplibre-react-native';

/** Map style URL — OpenFreeMap basemaps, all free, no key. */
export type RaceMapStyle = 'liberty' | 'bright' | 'positron' | 'dark';

const STYLE_URLS: Record<RaceMapStyle, string> = {
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
  bright: 'https://tiles.openfreemap.org/styles/bright',
  positron: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

export interface CourseMark {
  id: string;
  name: string;
  type: 'start' | 'mark' | 'finish' | 'gate';
  lat: number;
  lng: number;
  /** Override default color for this mark type. */
  color?: string;
}

export interface RaceMapProps {
  /** Pins drawn on the map. start/mark/finish/gate get default colors. */
  marks?: CourseMark[];
  /** Center the camera here on first render. */
  center?: { lat: number; lng: number };
  /** Initial zoom level (0-22). Defaults to 13. */
  zoom?: number;
  /** Auto-fit camera to all marks when true. Ignored if `center` is set. */
  fitToMarks?: boolean;
  /** Tile style — defaults to 'liberty'. */
  styleVariant?: RaceMapStyle;
  /** Disable gestures (for compact preview tiles). */
  interactive?: boolean;
  /** Tap handler — receives the tapped mark, or undefined if empty space. */
  onMarkPress?: (mark: CourseMark) => void;
  /** Inline overlay slot — pass MapLibre children (Markers, Sources, Layers). */
  children?: React.ReactNode;
}

const HK_DEFAULT: [number, number] = [114.1694, 22.3193];

function markColor(mark: CourseMark): string {
  if (mark.color) return mark.color;
  switch (mark.type) {
    case 'start':
      return '#10B981';
    case 'finish':
      return '#FFFFFF';
    case 'gate':
    case 'mark':
      return '#FF8C00';
    default:
      return '#2563EB';
  }
}

function markEmoji(mark: CourseMark): string {
  const name = mark.name.toLowerCase();
  if (name.includes('committee')) return '⛵';
  if (mark.type === 'finish') return '⚪';
  if (mark.type === 'start') return '🚩';
  return '🟠';
}

function computeBbox(
  marks: CourseMark[],
): [number, number, number, number] | null {
  if (marks.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const m of marks) {
    if (m.lat < minLat) minLat = m.lat;
    if (m.lat > maxLat) maxLat = m.lat;
    if (m.lng < minLng) minLng = m.lng;
    if (m.lng > maxLng) maxLng = m.lng;
  }
  return [minLng, minLat, maxLng, maxLat];
}

/** Auto-derived start/finish lines from mark sets. */
function lineFeature(a: CourseMark, b: CourseMark) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: [
        [a.lng, a.lat],
        [b.lng, b.lat],
      ],
    },
  };
}

export function RaceMap({
  marks = [],
  center,
  zoom = 13,
  fitToMarks = false,
  styleVariant = 'liberty',
  interactive = true,
  onMarkPress,
  children,
}: RaceMapProps) {
  const cameraRef = useRef<CameraRef>(null);

  const initialCenter: [number, number] = center
    ? [center.lng, center.lat]
    : marks.length > 0
      ? [marks[0].lng, marks[0].lat]
      : HK_DEFAULT;

  // Fit camera to all marks once mounted (or when marks change while not
  // already in `center` mode).
  useEffect(() => {
    if (!fitToMarks || center) return;
    const bbox = computeBbox(marks);
    if (!bbox) return;
    cameraRef.current?.fitBounds(bbox, {
      padding: { paddingTop: 60, paddingRight: 60, paddingBottom: 60, paddingLeft: 60 },
      duration: 400,
    });
  }, [fitToMarks, center, marks]);

  // Auto-derived course lines: between two start marks, and between finish
  // mark and the committee/pin end of the start line.
  const startLine = useMemo(() => {
    const starts = marks.filter((m) => m.type === 'start');
    if (starts.length < 2) return null;
    return lineFeature(starts[0], starts[1]);
  }, [marks]);

  const finishLine = useMemo(() => {
    const finish = marks.find((m) => m.type === 'finish');
    const starts = marks.filter((m) => m.type === 'start');
    const committee =
      starts.find((m) => m.name.toLowerCase().includes('committee')) ??
      (starts.length > 1 ? starts[1] : starts[0]);
    if (!finish || !committee) return null;
    return lineFeature(finish, committee);
  }, [marks]);

  return (
    <MLMap
      mapStyle={STYLE_URLS[styleVariant]}
      style={styles.map}
      dragPan={interactive}
      touchZoom={interactive}
      touchRotate={false}
      touchPitch={false}
    >
      <MLCamera
        ref={cameraRef}
        initialViewState={{ center: initialCenter, zoom }}
      />

      {startLine ? (
        <MLGeoJSONSource id="rm-start-line" data={startLine}>
          <MLLayer
              type="line"
            id="rm-start-line-layer"
            source="rm-start-line"
            style={{ lineColor: '#FFFFFF', lineWidth: 2, lineDasharray: [3, 2] }}
          />
        </MLGeoJSONSource>
      ) : null}

      {finishLine ? (
        <MLGeoJSONSource id="rm-finish-line" data={finishLine}>
          <MLLayer
              type="line"
            id="rm-finish-line-layer"
            source="rm-finish-line"
            style={{ lineColor: '#FFFFFF', lineWidth: 2, lineDasharray: [3, 2] }}
          />
        </MLGeoJSONSource>
      ) : null}

      {marks.map((mark) => (
        <MLMarker
          key={mark.id}
          id={`rm-mark-${mark.id}`}
          lngLat={[mark.lng, mark.lat]}
        >
          <View
            style={[styles.markPin, { backgroundColor: markColor(mark) }]}
            onTouchEnd={() => onMarkPress?.(mark)}
          >
            <Text style={styles.markEmoji}>{markEmoji(mark)}</Text>
          </View>
        </MLMarker>
      ))}

      {children}
    </MLMap>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  markPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  markEmoji: {
    fontSize: 14,
  },
});
