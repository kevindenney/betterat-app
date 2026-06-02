/**
 * NativeCourseOverlayMap
 *
 * Read-only MapLibre map showing a positioned course with the full tactical
 * overlay: laylines, start box, thirds, side labels, favored side shading.
 * Each polygon/polyline becomes a GeoJSON layer; labels become MapLibre
 * Markers with View children.
 *
 * Migrated off react-native-maps — see RaceMap.tsx for the simpler shared
 * primitive used by other surfaces.
 */

import React, { useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Map as MLMap,
  Camera as MLCamera,
  Marker as MLMarker,
  GeoJSONSource as MLGeoJSONSource,
  Layer as MLLayer,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import type { PositionedCourse, StartLinePosition } from '@/types/courses';
import { type Coord, deriveCourseOverlay, lerpCoord } from '@/lib/courseGeometry';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

function toLngLat(c: Coord): [number, number] {
  return [c.longitude, c.latitude];
}

function zoomFromLatDelta(delta: number): number {
  if (!delta || delta <= 0) return 13;
  return Math.max(2, Math.min(20, Math.log2(360 / delta)));
}

function lineFeature(points: Coord[]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: points.map(toLngLat),
    },
  };
}

function polygonFeature(ring: Coord[]) {
  const closed = ring[0] === ring[ring.length - 1] ? ring : [...ring, ring[0]];
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [closed.map(toLngLat)],
    },
  };
}

const MARK_COLORS: Record<string, string> = {
  windward: '#eab308',
  leeward: '#ef4444',
  gate: '#f97316',
  wing: '#22c55e',
  offset: '#3b82f6',
};

interface NativeCourseOverlayMapProps {
  positionedCourse: PositionedCourse;
  windDirection: number;
  currentDirection?: number;
  currentSpeed?: number;
  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
}

export function NativeCourseOverlayMap({
  positionedCourse,
  windDirection,
  currentDirection,
  currentSpeed,
  style,
}: NativeCourseOverlayMapProps) {
  const cameraRef = useRef<CameraRef>(null);
  const marks = useMemo(
    () => positionedCourse.marks || [],
    [positionedCourse.marks],
  );
  const startLine: StartLinePosition | null = positionedCourse.startLine || null;

  const courseOverlay = useMemo(
    () =>
      deriveCourseOverlay({
        marks,
        startLine,
        windDirection,
        currentDirection,
        currentSpeed,
      }),
    [marks, windDirection, currentDirection, currentSpeed, startLine],
  );

  const initialView = useMemo(() => {
    const all: Coord[] = marks.map((m) => ({ latitude: m.latitude, longitude: m.longitude }));
    if (startLine) {
      all.push({ latitude: startLine.pin.lat, longitude: startLine.pin.lng });
      all.push({ latitude: startLine.committee.lat, longitude: startLine.committee.lng });
    }
    if (courseOverlay) {
      all.push(courseOverlay.portCorner, courseOverlay.stbdCorner, courseOverlay.W);
      if (courseOverlay.startBox) courseOverlay.startBox.outline.forEach((c) => all.push(c));
    }
    if (all.length === 0) return null;

    const lats = all.map((c) => c.latitude);
    const lngs = all.map((c) => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latDelta = Math.max((maxLat - minLat) * 1.6, 0.005);
    return {
      center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2] as [number, number],
      zoom: zoomFromLatDelta(latDelta),
      latDelta,
    };
  }, [marks, startLine, courseOverlay]);

  const zoomScale = useMemo(() => {
    if (!initialView) return 1;
    const baseDelta = 0.008;
    const ratio = baseDelta / initialView.latDelta;
    return Math.max(0.55, Math.min(1.0, ratio));
  }, [initialView]);

  const markerTransform = useMemo(
    () => ({ transform: [{ scale: zoomScale }] }) as { transform: { scale: number }[] },
    [zoomScale],
  );

  const showDetailLabels = zoomScale > 0.65;

  if (!initialView) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallbackText}>No course data</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <MLMap
        mapStyle={MAP_STYLE_URL}
        style={StyleSheet.absoluteFillObject}
        dragPan={false}
        touchZoom={false}
        touchRotate={false}
        touchPitch={false}
      >
        <MLCamera
          ref={cameraRef}
          initialViewState={{ center: initialView.center, zoom: initialView.zoom }}
        />

        {courseOverlay ? (
          <>
            {/* Race area: left/right halves */}
            <MLGeoJSONSource id="nco-left-poly" data={polygonFeature(courseOverlay.leftPoly)}>
              <MLLayer
              type="fill"
                id="nco-left-poly-fill"
                source="nco-left-poly"
                style={{
                  fillColor:
                    courseOverlay.favoredSide === 'left'
                      ? 'rgba(34, 197, 94, 0.13)'
                      : 'rgba(148, 163, 184, 0.06)',
                }}
              />
            </MLGeoJSONSource>
            <MLGeoJSONSource id="nco-right-poly" data={polygonFeature(courseOverlay.rightPoly)}>
              <MLLayer
              type="fill"
                id="nco-right-poly-fill"
                source="nco-right-poly"
                style={{
                  fillColor:
                    courseOverlay.favoredSide === 'right'
                      ? 'rgba(34, 197, 94, 0.13)'
                      : 'rgba(148, 163, 184, 0.06)',
                }}
              />
            </MLGeoJSONSource>

            {/* Laylines (4 segments) */}
            {(
              [
                [courseOverlay.W, courseOverlay.portCorner],
                [courseOverlay.C, courseOverlay.portCorner],
                [courseOverlay.W, courseOverlay.stbdCorner],
                [courseOverlay.P, courseOverlay.stbdCorner],
              ] as Coord[][]
            ).map((segment, i) => (
              <MLGeoJSONSource key={`nco-layline-${i}`} id={`nco-layline-${i}`} data={lineFeature(segment)}>
                <MLLayer
              type="line"
                  id={`nco-layline-${i}-layer`}
                  source={`nco-layline-${i}`}
                  style={{
                    lineColor: `rgba(234, 179, 8, ${zoomScale < 0.8 ? 0.4 : 0.8})`,
                    lineWidth: zoomScale < 0.8 ? 1 : 1.5,
                    lineDasharray: [4, 2.5],
                  }}
                />
              </MLGeoJSONSource>
            ))}

            {/* Rhumbline */}
            <MLGeoJSONSource id="nco-rhumbline" data={lineFeature([courseOverlay.W, courseOverlay.startMid])}>
              <MLLayer
              type="line"
                id="nco-rhumbline-layer"
                source="nco-rhumbline"
                style={{
                  lineColor: 'rgba(255, 255, 255, 0.5)',
                  lineWidth: 1.5,
                  lineDasharray: [4, 2],
                }}
              />
            </MLGeoJSONSource>

            {/* Third dividers */}
            {courseOverlay.thirdDividers.map((segment, i) => (
              <MLGeoJSONSource
                key={`nco-third-${i}`}
                id={`nco-third-${i}`}
                data={lineFeature(segment)}
              >
                <MLLayer
              type="line"
                  id={`nco-third-${i}-layer`}
                  source={`nco-third-${i}`}
                  style={{
                    lineColor: 'rgba(148, 163, 184, 0.35)',
                    lineWidth: 1,
                    lineDasharray: [2, 2],
                  }}
                />
              </MLGeoJSONSource>
            ))}

            {/* Third labels */}
            {showDetailLabels ? (
              <>
                <MLMarker id="nco-third-bottom" lngLat={toLngLat(courseOverlay.thirdLabels.bottom)}>
                  <View style={[overlayStyles.thirdPill, markerTransform]}>
                    <Text style={overlayStyles.thirdText}>Bottom 1/3</Text>
                  </View>
                </MLMarker>
                <MLMarker id="nco-third-middle" lngLat={toLngLat(courseOverlay.thirdLabels.middle)}>
                  <View style={[overlayStyles.thirdPill, markerTransform]}>
                    <Text style={overlayStyles.thirdText}>Middle 1/3</Text>
                  </View>
                </MLMarker>
                <MLMarker id="nco-third-upper" lngLat={toLngLat(courseOverlay.thirdLabels.upper)}>
                  <View style={[overlayStyles.thirdPill, markerTransform]}>
                    <Text style={overlayStyles.thirdText}>Upper 1/3</Text>
                  </View>
                </MLMarker>
              </>
            ) : null}

            {/* Rhumbline label */}
            {showDetailLabels ? (
              <MLMarker
                id="nco-rhumb-label"
                lngLat={toLngLat(lerpCoord(courseOverlay.startMid, courseOverlay.W, 0.35))}
              >
                <View style={[overlayStyles.rhumblinePill, markerTransform]}>
                  <Text style={overlayStyles.rhumblineText}>Rhumbline</Text>
                </View>
              </MLMarker>
            ) : null}

            {/* LEFT / RIGHT pills */}
            <MLMarker id="nco-left-label" lngLat={toLngLat(courseOverlay.leftLabel)}>
              <View
                style={[
                  overlayStyles.sidePill,
                  courseOverlay.favoredSide === 'left' && overlayStyles.sidePillFavored,
                  markerTransform,
                ]}
              >
                <Text
                  style={[
                    overlayStyles.sideText,
                    courseOverlay.favoredSide === 'left' && overlayStyles.sideTextFavored,
                  ]}
                >
                  LEFT
                </Text>
              </View>
            </MLMarker>
            <MLMarker id="nco-right-label" lngLat={toLngLat(courseOverlay.rightLabel)}>
              <View
                style={[
                  overlayStyles.sidePill,
                  courseOverlay.favoredSide === 'right' && overlayStyles.sidePillFavored,
                  markerTransform,
                ]}
              >
                <Text
                  style={[
                    overlayStyles.sideText,
                    courseOverlay.favoredSide === 'right' && overlayStyles.sideTextFavored,
                  ]}
                >
                  RIGHT
                </Text>
              </View>
            </MLMarker>

            {/* Layline labels */}
            {showDetailLabels ? (
              <>
                <MLMarker id="nco-stbd-ll-label" lngLat={toLngLat(courseOverlay.laylineLabels.port)}>
                  <View style={[overlayStyles.laylinePill, markerTransform]}>
                    <Text style={overlayStyles.laylineText}>Stbd LL</Text>
                  </View>
                </MLMarker>
                <MLMarker id="nco-port-ll-label" lngLat={toLngLat(courseOverlay.laylineLabels.stbd)}>
                  <View style={[overlayStyles.laylinePill, markerTransform]}>
                    <Text style={overlayStyles.laylineText}>Port LL</Text>
                  </View>
                </MLMarker>
              </>
            ) : null}

            {/* Start box */}
            {courseOverlay.startBox ? (
              <>
                <MLGeoJSONSource
                  id="nco-start-box"
                  data={lineFeature([
                    ...courseOverlay.startBox.outline,
                    courseOverlay.startBox.outline[0],
                  ])}
                >
                  <MLLayer
              type="line"
                    id="nco-start-box-layer"
                    source="nco-start-box"
                    style={{
                      lineColor: `rgba(249, 115, 22, ${zoomScale < 0.8 ? 0.35 : 0.6})`,
                      lineWidth: zoomScale < 0.8 ? 1 : 1.5,
                      lineDasharray: [3, 2],
                    }}
                  />
                </MLGeoJSONSource>
                {courseOverlay.startBox.dividers.map((segment, i) => (
                  <MLGeoJSONSource
                    key={`nco-start-div-${i}`}
                    id={`nco-start-div-${i}`}
                    data={lineFeature(segment)}
                  >
                    <MLLayer
              type="line"
                      id={`nco-start-div-${i}-layer`}
                      source={`nco-start-div-${i}`}
                      style={{
                        lineColor: 'rgba(249, 115, 22, 0.35)',
                        lineWidth: 1,
                        lineDasharray: [2, 2],
                      }}
                    />
                  </MLGeoJSONSource>
                ))}
              </>
            ) : null}

            {/* Start labels */}
            {courseOverlay.startLabels ? (
              <>
                <MLMarker
                  id="nco-start-pin-label"
                  lngLat={toLngLat(courseOverlay.startLabels.pinEnd)}
                >
                  <View style={[overlayStyles.startPill, markerTransform]}>
                    <Text style={overlayStyles.startText}>Pin End</Text>
                  </View>
                </MLMarker>
                {showDetailLabels ? (
                  <MLMarker
                    id="nco-start-mid-label"
                    lngLat={toLngLat(courseOverlay.startLabels.middle)}
                  >
                    <View style={[overlayStyles.startPill, markerTransform]}>
                      <Text style={overlayStyles.startText}>Middle</Text>
                    </View>
                  </MLMarker>
                ) : null}
                <MLMarker
                  id="nco-start-boat-label"
                  lngLat={toLngLat(courseOverlay.startLabels.boatEnd)}
                >
                  <View style={[overlayStyles.startPill, markerTransform]}>
                    <Text style={overlayStyles.startText}>Boat End</Text>
                  </View>
                </MLMarker>
              </>
            ) : null}
          </>
        ) : null}

        {/* Mark markers */}
        {marks.map((mark) => {
          const color = MARK_COLORS[mark.type] || '#64748b';
          const label =
            mark.type === 'windward'
              ? 'W'
              : mark.type === 'gate'
                ? 'G'
                : mark.type === 'leeward'
                  ? 'L'
                  : mark.type.charAt(0).toUpperCase();
          return (
            <MLMarker
              key={mark.id}
              id={`nco-mark-${mark.id}`}
              lngLat={[mark.longitude, mark.latitude]}
            >
              <View style={[markStyles.circle, { backgroundColor: color }, markerTransform]}>
                <Text style={markStyles.label}>{label}</Text>
              </View>
            </MLMarker>
          );
        })}

        {/* Start line */}
        {startLine ? (
          <>
            <MLGeoJSONSource
              id="nco-start-line"
              data={lineFeature([
                { latitude: startLine.pin.lat, longitude: startLine.pin.lng },
                { latitude: startLine.committee.lat, longitude: startLine.committee.lng },
              ])}
            >
              <MLLayer
              type="line"
                id="nco-start-line-layer"
                source="nco-start-line"
                style={{ lineColor: '#22c55e', lineWidth: 2 }}
              />
            </MLGeoJSONSource>
            <MLMarker
              id="nco-start-committee"
              lngLat={[startLine.committee.lng, startLine.committee.lat]}
            >
              <View style={[markStyles.circle, { backgroundColor: '#3b82f6' }, markerTransform]}>
                <Text style={markStyles.label}>C</Text>
              </View>
            </MLMarker>
            <MLMarker
              id="nco-start-pin"
              lngLat={[startLine.pin.lng, startLine.pin.lat]}
            >
              <View style={[markStyles.circle, { backgroundColor: '#f97316' }, markerTransform]}>
                <Text style={markStyles.label}>P</Text>
              </View>
            </MLMarker>
          </>
        ) : null}
      </MLMap>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  fallback: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontSize: 14,
    color: '#6b7280',
  },
});

const markStyles = StyleSheet.create({
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
});

const overlayStyles = StyleSheet.create({
  sidePill: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  sidePillFavored: {
    backgroundColor: 'rgba(22, 101, 52, 0.85)',
    borderColor: 'rgba(34, 197, 94, 0.6)',
  },
  sideText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1.5,
  },
  sideTextFavored: {
    color: '#86efac',
  },
  laylinePill: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.4)',
  },
  laylineText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#eab308',
  },
  thirdPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  thirdText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(203, 213, 225, 0.8)',
    letterSpacing: 0.5,
  },
  rhumblinePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  rhumblineText: {
    fontSize: 8,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic',
  },
  startPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  startText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#86efac',
  },
});
