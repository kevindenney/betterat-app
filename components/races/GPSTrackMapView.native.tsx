/**
 * GPS Track Map View Component
 * Displays GPS track on a minimalist map with auto-follow capability.
 *
 * Renders on MapLibre + OpenFreeMap "Positron" (clean gray basemap) — no
 * Google Maps dependency, no API key. The user's own track and fleet
 * tracks are drawn as GeoJSON LineString layers; course marks + current
 * position are MapLibre Markers wrapping React Native Views so we can
 * rotate the boat icon by heading.
 *
 * Features:
 * - Clean breadcrumb trail showing GPS track
 * - Auto-follow mode for live tracking
 * - Full track mode for post-race review
 * - Support for multiple track overlays (fleet comparison)
 * - Minimalist map styling via OpenFreeMap Positron
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Map as MLMap,
  Camera as MLCamera,
  Marker as MLMarker,
  GeoJSONSource as MLGeoJSONSource,
  Layer as MLLayer,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { Navigation } from 'lucide-react-native';
import type { GPSTrackMapViewProps } from './GPSTrackMapView.types';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

// Default center if no points yet — Hong Kong (Victoria Harbour).
const DEFAULT_CENTER: [number, number] = [114.1694, 22.3193];

function pointToLngLat(p: { lat: number; lng: number }): [number, number] {
  return [p.lng, p.lat];
}

/** [west, south, east, north] bbox covering all points; null when empty. */
function computeBounds(
  points: { lat: number; lng: number }[],
): [number, number, number, number] | null {
  if (points.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return [minLng, minLat, maxLng, maxLat];
}

export function GPSTrackMapView({
  trackPoints,
  autoFollow = false,
  fleetTracks = [],
  initialRegion,
  courseMarks = [],
}: GPSTrackMapViewProps) {
  const cameraRef = useRef<CameraRef>(null);

  // Auto-follow current position
  useEffect(() => {
    if (!autoFollow || trackPoints.length === 0) return;
    const current = trackPoints[trackPoints.length - 1];
    cameraRef.current?.flyTo({
      center: pointToLngLat(current),
      zoom: 16,
      duration: 300,
    });
  }, [trackPoints, autoFollow]);

  // Fit all track points when not auto-following
  useEffect(() => {
    if (autoFollow || trackPoints.length === 0) return;
    const allPoints = [
      ...trackPoints,
      ...fleetTracks.flatMap((ft) => ft.trackPoints),
    ];
    const bounds = computeBounds(allPoints);
    if (!bounds) return;
    cameraRef.current?.fitBounds(bounds, {
      padding: { paddingTop: 50, paddingRight: 50, paddingBottom: 50, paddingLeft: 50 },
      duration: 400,
    });
  }, [trackPoints, fleetTracks, autoFollow]);

  // Track + fleet GeoJSON features. Memoized so map sources don't rebuild
  // every render unless the underlying points change.
  const trackFeature = useMemo(() => {
    if (trackPoints.length < 2) return null;
    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: trackPoints.map(pointToLngLat),
      },
    };
  }, [trackPoints]);

  const fleetFeatures = useMemo(() => {
    return fleetTracks.map((ft, idx) => ({
      id: `fleet-${idx}`,
      color: ft.color,
      feature: {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: ft.trackPoints.map(pointToLngLat),
        },
      },
    }));
  }, [fleetTracks]);

  // Current position marker — last point in track, only shown in auto-follow.
  const currentPosition =
    trackPoints.length > 0 ? trackPoints[trackPoints.length - 1] : null;

  const initialCenter: [number, number] = initialRegion
    ? [initialRegion.longitude, initialRegion.latitude]
    : currentPosition
      ? pointToLngLat(currentPosition)
      : DEFAULT_CENTER;

  return (
    <View style={styles.container}>
      <MLMap
        mapStyle={MAP_STYLE_URL}
        style={styles.map}
        dragPan={!autoFollow}
        touchZoom={!autoFollow}
        touchRotate={false}
        touchPitch={false}
      >
        <MLCamera
          ref={cameraRef}
          initialViewState={{ center: initialCenter, zoom: 13 }}
        />

        {/* Fleet tracks — dashed lines, one source per fleet member */}
        {fleetFeatures.map((ff) => (
          <MLGeoJSONSource key={ff.id} id={ff.id} data={ff.feature}>
            <MLLayer
              type="line"
              id={`${ff.id}-line`}
              source={ff.id}
              style={{
                lineColor: ff.color,
                lineWidth: 2,
                lineDasharray: [2, 2],
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </MLGeoJSONSource>
        ))}

        {/* Your track (primary) */}
        {trackFeature && (
          <MLGeoJSONSource id="own-track" data={trackFeature}>
            <MLLayer
              type="line"
              id="own-track-line"
              source="own-track"
              style={{
                lineColor: '#2563EB',
                lineWidth: 3,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </MLGeoJSONSource>
        )}

        {/* Course marks */}
        {courseMarks.map((mark, idx) => (
          <MLMarker
            key={`mark-${idx}`}
            id={`mark-${idx}`}
            lngLat={[mark.longitude, mark.latitude]}
          >
            <View style={styles.courseMark} />
          </MLMarker>
        ))}

        {/* Current position marker — boat icon rotated by heading */}
        {currentPosition && autoFollow && (
          <MLMarker
            id="current-pos"
            lngLat={pointToLngLat(currentPosition)}
          >
            <View
              style={[
                styles.boatMarker,
                {
                  transform: [{ rotate: `${currentPosition.heading || 0}deg` }],
                },
              ]}
            >
              <Navigation size={24} color="#2563EB" fill="#2563EB" />
            </View>
          </MLMarker>
        )}
      </MLMap>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  courseMark: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F59E0B',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  boatMarker: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2563EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});
