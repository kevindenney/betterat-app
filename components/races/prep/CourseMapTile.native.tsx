/**
 * CourseMapTile — Native (MapLibre) implementation.
 *
 * Static preview tile of the race course. Renders the start line, course
 * marks (windward/leeward/gate/wing/offset), pin/committee endpoints, and
 * an optional location pin when no course is set. Non-interactive — tile
 * is wrapped in a Pressable for "tap to open course wizard".
 */

import React, { useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {
  Map as MLMap,
  Camera as MLCamera,
  Marker as MLMarker,
  GeoJSONSource as MLGeoJSONSource,
  Layer as MLLayer,
  type CameraRef,
} from '@maplibre/maplibre-react-native';
import { Check, MapPin, Wind, Waves } from 'lucide-react-native';
import { triggerHaptic } from '@/lib/haptics';
import { IOS_ANIMATIONS, IOS_SHADOWS } from '@/lib/design-tokens-ios';
import type { PositionedCourse } from '@/types/courses';
import { COURSE_TEMPLATES } from '@/services/CoursePositioningService';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const MARK_COLORS: Record<string, string> = {
  windward: '#eab308',
  leeward: '#ef4444',
  gate: '#f97316',
  wing: '#22c55e',
  offset: '#3b82f6',
};

const COLORS = {
  blue: '#007AFF',
  green: '#34C759',
  gray: '#8E8E93',
  gray3: '#C7C7CC',
  gray5: '#E5E5EA',
  gray6: '#F2F2F7',
  label: '#000000',
  secondaryLabel: '#3C3C43',
  background: '#FFFFFF',
  purple: '#5856D6',
};

export interface CourseMapTileProps {
  coords?: { lat: number; lng: number } | null;
  positionedCourse?: PositionedCourse | null;
  isComplete?: boolean;
  onPress: () => void;
  venueName?: string;
  disabled?: boolean;
  windDirection?: number;
  windSpeed?: number;
  currentDirection?: number;
  currentSpeed?: number;
  waveHeight?: number;
  waveDirection?: number;
}

function getMarkLabel(mark: { type: string }, index: number): string {
  if (mark.type === 'windward') return 'W';
  if (mark.type === 'leeward') return 'L';
  if (mark.type === 'gate') return 'G';
  if (mark.type === 'wing') return 'R';
  if (mark.type === 'offset') return 'O';
  return (index + 1).toString();
}

function zoomFromLatDelta(delta: number): number {
  if (!delta || delta <= 0) return 13;
  return Math.max(2, Math.min(20, Math.log2(360 / delta)));
}

function lineFeature(coords: [number, number][]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: coords },
  };
}

export function CourseMapTile({
  coords,
  positionedCourse,
  isComplete = false,
  onPress,
  venueName,
  disabled,
  windDirection,
  currentDirection,
  currentSpeed,
}: CourseMapTileProps) {
  const cameraRef = useRef<CameraRef>(null);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, IOS_ANIMATIONS.spring.snappy);
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, IOS_ANIMATIONS.spring.snappy);
  };
  const handlePress = () => {
    if (disabled) return;
    triggerHaptic('impactLight');
    onPress();
  };

  const courseTypeName = positionedCourse
    ? COURSE_TEMPLATES[positionedCourse.courseType]?.name || 'Custom Course'
    : null;

  const initialView = useMemo(() => {
    if (positionedCourse) {
      const allLats = [
        ...positionedCourse.marks.map((m) => m.latitude),
        positionedCourse.startLine.pin.lat,
        positionedCourse.startLine.committee.lat,
      ];
      const allLngs = [
        ...positionedCourse.marks.map((m) => m.longitude),
        positionedCourse.startLine.pin.lng,
        positionedCourse.startLine.committee.lng,
      ];
      const centerLat = (Math.min(...allLats) + Math.max(...allLats)) / 2;
      const centerLng = (Math.min(...allLngs) + Math.max(...allLngs)) / 2;
      const latDelta = Math.max((Math.max(...allLats) - Math.min(...allLats)) * 1.5, 0.01);
      return { center: [centerLng, centerLat] as [number, number], zoom: zoomFromLatDelta(latDelta) };
    }
    if (coords) {
      return { center: [coords.lng, coords.lat] as [number, number], zoom: 13 };
    }
    return null;
  }, [coords, positionedCourse]);

  const courseLineFeature = useMemo(() => {
    if (!positionedCourse) return null;
    const points = positionedCourse.marks
      .slice()
      .sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0))
      .map((m) => [m.longitude, m.latitude] as [number, number]);
    if (points.length < 2) return null;
    return lineFeature(points);
  }, [positionedCourse]);

  const startLineFeature = useMemo(() => {
    if (!positionedCourse?.startLine) return null;
    return lineFeature([
      [positionedCourse.startLine.pin.lng, positionedCourse.startLine.pin.lat],
      [positionedCourse.startLine.committee.lng, positionedCourse.startLine.committee.lat],
    ]);
  }, [positionedCourse]);

  if (!initialView) {
    return (
      <AnimatedPressable
        style={[
          styles.tile,
          isComplete && styles.tileComplete,
          animatedStyle,
          Platform.OS === 'ios' && IOS_SHADOWS.card,
        ]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`Course Map: ${isComplete ? 'Complete' : 'Not set'}`}
      >
        {isComplete ? (
          <View style={styles.completeBadge}>
            <Check size={12} color="#FFFFFF" strokeWidth={3} />
          </View>
        ) : null}
        <View style={styles.placeholderContent}>
          <MapPin size={32} color={COLORS.gray} />
          <Text style={styles.placeholderText}>Set race location</Text>
          {venueName ? <Text style={styles.venueText}>{venueName}</Text> : null}
        </View>
        <View style={styles.labelBar}>
          <Text style={styles.labelText}>COURSE</Text>
        </View>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      style={[
        styles.tile,
        isComplete && styles.tileComplete,
        animatedStyle,
        Platform.OS === 'ios' && IOS_SHADOWS.card,
      ]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`Course Map: ${isComplete ? 'Complete' : 'Not set'}`}
    >
      {isComplete ? (
        <View style={styles.completeBadge}>
          <Check size={12} color="#FFFFFF" strokeWidth={3} />
        </View>
      ) : null}

      <View style={styles.mapWrapper}>
        <MLMap
          mapStyle={MAP_STYLE_URL}
          style={styles.map}
          dragPan={false}
          touchZoom={false}
          touchRotate={false}
          touchPitch={false}
        >
          <MLCamera
            ref={cameraRef}
            initialViewState={{ center: initialView.center, zoom: initialView.zoom }}
          />

          {courseLineFeature ? (
            <MLGeoJSONSource id="course-line" data={courseLineFeature}>
              <MLLayer
              type="line"
                id="course-line-layer"
                source="course-line"
                style={{
                  lineColor: '#f97316',
                  lineWidth: 2,
                  lineDasharray: [3, 2],
                  lineCap: 'round',
                }}
              />
            </MLGeoJSONSource>
          ) : null}

          {startLineFeature ? (
            <MLGeoJSONSource id="start-line" data={startLineFeature}>
              <MLLayer
              type="line"
                id="start-line-layer"
                source="start-line"
                style={{ lineColor: '#22c55e', lineWidth: 3, lineCap: 'round' }}
              />
            </MLGeoJSONSource>
          ) : null}

          {positionedCourse?.marks.map((mark, idx) => (
            <MLMarker
              key={mark.id}
              id={`tile-mark-${mark.id}`}
              lngLat={[mark.longitude, mark.latitude]}
            >
              <View
                style={[
                  styles.markCircle,
                  { backgroundColor: MARK_COLORS[mark.type] || '#64748b' },
                ]}
              >
                <Text style={styles.markLabel}>{getMarkLabel(mark, idx)}</Text>
              </View>
            </MLMarker>
          ))}

          {positionedCourse?.startLine ? (
            <>
              <MLMarker
                id="start-pin"
                lngLat={[
                  positionedCourse.startLine.pin.lng,
                  positionedCourse.startLine.pin.lat,
                ]}
              >
                <View style={[styles.startLineEndpoint, { backgroundColor: '#f97316' }]}>
                  <Text style={styles.startLineLabel}>P</Text>
                </View>
              </MLMarker>
              <MLMarker
                id="start-committee"
                lngLat={[
                  positionedCourse.startLine.committee.lng,
                  positionedCourse.startLine.committee.lat,
                ]}
              >
                <View style={[styles.startLineEndpoint, { backgroundColor: '#3b82f6' }]}>
                  <Text style={styles.startLineLabel}>C</Text>
                </View>
              </MLMarker>
            </>
          ) : null}

          {!positionedCourse && coords ? (
            <MLMarker id="venue-pin" lngLat={[coords.lng, coords.lat]}>
              <View style={styles.locationMarker} />
            </MLMarker>
          ) : null}
        </MLMap>

        {windDirection !== undefined || currentDirection !== undefined ? (
          <View style={styles.conditionsBadge}>
            {windDirection !== undefined ? (
              <View style={styles.conditionItem}>
                <Wind size={12} color="#22c55e" />
                <Text style={styles.conditionText}>{windDirection}°</Text>
              </View>
            ) : null}
            {currentDirection !== undefined && currentSpeed !== undefined && currentSpeed > 0.1 ? (
              <View style={styles.conditionItem}>
                <Waves size={12} color="#0ea5e9" />
                <Text style={styles.conditionText}>{currentSpeed.toFixed(1)}kt</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.labelBar}>
        <Text style={styles.labelText}>COURSE</Text>
        {courseTypeName ? (
          <Text style={styles.courseTypeText}>{courseTypeName}</Text>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 322,
    height: 322,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.gray5,
    overflow: 'hidden',
  },
  tileComplete: {
    borderColor: `${COLORS.green}60`,
  },
  completeBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  placeholderContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray6,
    margin: 4,
    borderRadius: 12,
    gap: 6,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.label,
    textAlign: 'center',
  },
  venueText: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
  },
  labelBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  labelText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.gray,
    letterSpacing: 0.8,
  },
  courseTypeText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.blue,
  },
  markCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  markLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: 'white',
  },
  startLineEndpoint: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  startLineLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    color: 'white',
  },
  locationMarker: {
    width: 20,
    height: 20,
    backgroundColor: COLORS.purple,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  conditionsBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  conditionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  conditionText: {
    fontSize: 10,
    fontWeight: '500',
    color: 'white',
  },
});

export default CourseMapTile;
