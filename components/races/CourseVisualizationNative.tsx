/**
 * CourseVisualizationNative
 *
 * MapLibre + OpenFreeMap render of a CourseGeoJSON. Converts the GeoJSON
 * feature collection into the legacy Course shape and hands it to the
 * shared CourseOverlay component.
 */

import React, { useMemo, useRef } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import {
  Map as MLMap,
  Camera as MLCamera,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { MapPin } from 'lucide-react-native';
import { CourseOverlay } from '@/components/race-detail/map/CourseOverlay';
import type { CourseGeoJSON, CourseFeature, PointGeometry } from '@/types/raceEvents';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

interface CourseVisualizationNativeProps {
  geoJSON: CourseGeoJSON;
  bounds: { center?: [number, number]; delta?: [number, number] } | null | undefined;
  interactive: boolean;
  onMarkPress?: (mark: { id?: string; coordinate: { latitude: number; longitude: number } }) => void;
}

function convertGeoJSONToCourse(geoJSON: CourseGeoJSON) {
  const marks: {
    id?: string;
    coordinate: { latitude: number; longitude: number };
    name?: string;
    type?: string;
    sequence?: number;
    rounding?: string;
  }[] = [];
  const path: { latitude: number; longitude: number }[] = [];
  const startLine: { latitude: number; longitude: number }[] = [];
  const finishLine: { latitude: number; longitude: number }[] = [];

  geoJSON.features.forEach((feature: CourseFeature) => {
    if (feature.geometry.type !== 'Point') return;
    const [lng, lat] = (feature.geometry as PointGeometry).coordinates;
    const props = feature.properties as {
      id?: string;
      name?: string;
      type?: string;
      sequence?: number;
      rounding?: string;
    };
    marks.push({
      id: props.id,
      coordinate: { latitude: lat, longitude: lng },
      name: props.name,
      type: props.type,
      sequence: props.sequence,
      rounding: props.rounding,
    });
    path.push({ latitude: lat, longitude: lng });
    if (props.type === 'committee_boat' || props.type === 'pin') {
      startLine.push({ latitude: lat, longitude: lng });
    }
    if (props.type === 'finish' || props.type === 'committee_boat') {
      finishLine.push({ latitude: lat, longitude: lng });
    }
  });

  marks.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  return {
    marks,
    path,
    startLine: startLine.length === 2 ? startLine : [],
    finishLine: finishLine.length === 2 ? finishLine : undefined,
  };
}

function calculateView(geoJSON: CourseGeoJSON, bounds?: { center?: [number, number]; delta?: [number, number] } | null) {
  if (bounds?.center && bounds?.delta) {
    const latDelta = bounds.delta[1] || 0.02;
    return {
      center: bounds.center,
      zoom: Math.max(2, Math.min(20, Math.log2(360 / latDelta))),
    };
  }
  const points: { lat: number; lng: number }[] = [];
  geoJSON.features.forEach((feature: CourseFeature) => {
    if (feature.geometry.type === 'Point') {
      const [lng, lat] = (feature.geometry as PointGeometry).coordinates;
      points.push({ lat, lng });
    }
  });
  if (points.length === 0) {
    return { center: [114.262, 22.265] as [number, number], zoom: 13 };
  }
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latDelta = Math.max((maxLat - minLat) * 1.5, 0.01);
  return {
    center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2] as [number, number],
    zoom: Math.max(2, Math.min(20, Math.log2(360 / latDelta))),
  };
}

export default function CourseVisualizationNative({
  geoJSON,
  bounds,
  interactive,
  onMarkPress,
}: CourseVisualizationNativeProps) {
  const cameraRef = useRef<CameraRef>(null);

  const course = useMemo(() => convertGeoJSONToCourse(geoJSON), [geoJSON]);
  const initialView = useMemo(() => calculateView(geoJSON, bounds), [geoJSON, bounds]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.placeholder}>
        <MapPin size={32} color="#94a3b8" />
        <Text style={styles.placeholderTitle}>Course Map</Text>
        <Text style={styles.placeholderText}>
          {course.marks.length} marks configured
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MLMap
        mapStyle={MAP_STYLE_URL}
        style={styles.map}
        dragPan={interactive}
        touchZoom={interactive}
        touchRotate={interactive}
        touchPitch={false}
      >
        <MLCamera
          ref={cameraRef}
          initialViewState={{ center: initialView.center, zoom: initialView.zoom }}
        />
        {course.marks.length > 0 ? (
          <CourseOverlay
            course={course}
            onMarkPress={interactive ? onMarkPress : undefined}
          />
        ) : null}
      </MLMap>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    minHeight: 200,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
  },
  placeholder: {
    flex: 1,
    width: '100%',
    minHeight: 200,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginTop: 8,
  },
  placeholderText: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
});
