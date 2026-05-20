/**
 * TacticalRaceMapNative — race-strategy tactical map.
 *
 * MapLibre/OpenFreeMap rendering of the race course with Wind, Current
 * (tide), and Laylines overlays. Layer toggles + center-on-course control
 * sit on top of the map. Drops the old fallback "maps unavailable" path
 * since MapLibre always works.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Map as MLMap,
  Camera as MLCamera,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import type {
  CourseMark,
  EnvironmentalIntelligence,
  RaceEventWithDetails,
} from '@/types/raceEvents';
import { CourseOverlay, convertMarksToCoourse } from '@/components/race-detail/map/CourseOverlay';
import { WindOverlay } from '@/components/race-detail/map/WindOverlay';
import { CurrentOverlay } from '@/components/race-detail/map/CurrentOverlay';
import { LaylinesOverlay } from '@/components/race-detail/map/LaylinesOverlay';
import { WindDirectionIndicator } from '@/components/race-detail/map/WindDirectionIndicator';

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

interface TacticalRaceMapNativeProps {
  raceEvent: RaceEventWithDetails;
  marks: CourseMark[];
  environmental?: EnvironmentalIntelligence;
  onMarkSelected?: (mark: CourseMark) => void;
  showControls?: boolean;
  externalLayers?: {
    wind?: boolean;
    current?: boolean;
    waves?: boolean;
    depth?: boolean;
    laylines?: boolean;
    strategy?: boolean;
  };
  onLayersChange?: (layers: { [key: string]: boolean }) => void;
}

interface LayerState {
  wind: boolean;
  current: boolean;
  laylines: boolean;
}

interface ViewRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/** Compute a region from marks (with padding) or fall back to venue / HK. */
function calculateRegion(marks: CourseMark[], venue?: { coordinates_lat?: number; coordinates_lng?: number } | null): ViewRegion {
  const defaultRegion: ViewRegion = {
    latitude: 22.265,
    longitude: 114.262,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  if (venue?.coordinates_lat && venue?.coordinates_lng) {
    return {
      latitude: venue.coordinates_lat,
      longitude: venue.coordinates_lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }

  if (marks && marks.length > 0) {
    const lats = marks.map((m) => m.latitude);
    const lngs = marks.map((m) => m.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.01),
      longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.01),
    };
  }
  return defaultRegion;
}

function zoomFromLatDelta(delta: number): number {
  if (!delta || delta <= 0) return 13;
  return Math.max(2, Math.min(20, Math.log2(360 / delta)));
}

export default function TacticalRaceMapNative({
  raceEvent,
  marks,
  environmental,
  onMarkSelected,
  showControls = true,
  externalLayers,
  onLayersChange,
}: TacticalRaceMapNativeProps) {
  const cameraRef = useRef<CameraRef>(null);
  const initialRegion = useMemo(
    () => calculateRegion(marks, raceEvent?.venue),
    [marks, raceEvent?.venue],
  );

  const [layers, setLayers] = useState<LayerState>({
    wind: externalLayers?.wind ?? true,
    current: externalLayers?.current ?? true,
    laylines: externalLayers?.laylines ?? true,
  });

  React.useEffect(() => {
    if (externalLayers) {
      setLayers((prev) => ({
        wind: externalLayers.wind ?? prev.wind,
        current: externalLayers.current ?? prev.current,
        laylines: externalLayers.laylines ?? prev.laylines,
      }));
    }
  }, [externalLayers]);

  const course = useMemo(() => {
    if (!marks || marks.length === 0) return null;
    return convertMarksToCoourse(marks);
  }, [marks]);

  const windData = useMemo(() => {
    if (!environmental?.current?.wind) return null;
    return {
      direction: environmental.current.wind.direction,
      speed: environmental.current.wind.speed,
      gusts: environmental.current.wind.gusts,
    };
  }, [environmental]);

  const currentData = useMemo(() => {
    if (!environmental?.current?.tide) return null;
    const tide = environmental.current.tide;
    const speed = tide.current_speed ?? 0;
    return {
      direction: tide.current_direction ?? 0,
      speed,
      strength: (speed < 0.3 ? 'slack' : speed < 0.8 ? 'moderate' : 'strong') as
        | 'slack'
        | 'moderate'
        | 'strong',
    };
  }, [environmental]);

  const handleMarkPress = useCallback(
    (mark: { coordinate: { latitude: number; longitude: number } }) => {
      const courseMark = marks.find(
        (m) =>
          m.latitude === mark.coordinate.latitude &&
          m.longitude === mark.coordinate.longitude,
      );
      if (courseMark) onMarkSelected?.(courseMark);
    },
    [marks, onMarkSelected],
  );

  const toggleLayer = useCallback(
    (layerId: keyof LayerState) => {
      setLayers((prev) => {
        const next = { ...prev, [layerId]: !prev[layerId] };
        onLayersChange?.(next);
        return next;
      });
    },
    [onLayersChange],
  );

  const centerOnCourse = useCallback(() => {
    const region = calculateRegion(marks, raceEvent?.venue);
    cameraRef.current?.flyTo({
      center: [region.longitude, region.latitude],
      zoom: zoomFromLatDelta(region.latitudeDelta),
      duration: 500,
    });
  }, [marks, raceEvent?.venue]);

  return (
    <View style={styles.container}>
      <MLMap mapStyle={MAP_STYLE_URL} style={styles.map}>
        <MLCamera
          ref={cameraRef}
          initialViewState={{
            center: [initialRegion.longitude, initialRegion.latitude],
            zoom: zoomFromLatDelta(initialRegion.latitudeDelta),
          }}
        />
        {course ? (
          <CourseOverlay course={course} onMarkPress={handleMarkPress} />
        ) : null}
        {layers.wind && windData ? (
          <WindOverlay
            conditions={{
              direction: windData.direction,
              speed: windData.speed,
              gusts: windData.gusts,
            }}
            region={initialRegion}
          />
        ) : null}
        {layers.current && currentData ? (
          <CurrentOverlay
            conditions={{
              direction: currentData.direction,
              speed: currentData.speed,
              strength: currentData.strength,
            }}
            region={initialRegion}
          />
        ) : null}
        {layers.laylines && windData && marks.length > 0 ? (
          <LaylinesOverlay marks={marks} windDirection={windData.direction} />
        ) : null}
      </MLMap>

      {windData ? (
        <WindDirectionIndicator
          direction={windData.direction}
          speed={windData.speed}
          gusts={windData.gusts}
          position="top-right"
        />
      ) : null}

      {showControls ? (
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={centerOnCourse}
            activeOpacity={0.7}
          >
            <Ionicons name="locate-outline" size={20} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.layerControls}>
            <TouchableOpacity
              style={[styles.layerButton, layers.wind && styles.layerButtonActive]}
              onPress={() => toggleLayer('wind')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="flag-outline"
                size={16}
                color={layers.wind ? '#3b82f6' : '#64748b'}
              />
              <Text style={[styles.layerButtonText, layers.wind && styles.layerButtonTextActive]}>
                Wind
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.layerButton, layers.current && styles.layerButtonActive]}
              onPress={() => toggleLayer('current')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="water-outline"
                size={16}
                color={layers.current ? '#3b82f6' : '#64748b'}
              />
              <Text style={[styles.layerButtonText, layers.current && styles.layerButtonTextActive]}>
                Tide
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.layerButton, layers.laylines && styles.layerButtonActive]}
              onPress={() => toggleLayer('laylines')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="git-branch-outline"
                size={16}
                color={layers.laylines ? '#3b82f6' : '#64748b'}
              />
              <Text style={[styles.layerButtonText, layers.laylines && styles.layerButtonTextActive]}>
                Laylines
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 400,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  controlsContainer: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    gap: 8,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  layerControls: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 12,
    padding: 8,
    gap: 4,
  },
  layerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  layerButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },
  layerButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  layerButtonTextActive: {
    color: '#3b82f6',
  },
});
