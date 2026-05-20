/**
 * CourseMapView (native) — domain wrapper around <RaceMap>.
 *
 * Renders a sailing course on a map. Replaces the legacy react-native-maps
 * implementation that carried a layer panel, mapType cycling, AI prediction
 * overlays, and a marker popup modal — most of which were never wired to
 * real data. This stripped-down version just shows the marks + auto-derived
 * start/finish lines, which is what every caller actually needed.
 *
 * Behavior tweaks vs the legacy version:
 * - Always renders MapLibre/OpenFreeMap (no fallback UI, no maps-unavailable
 *   path — MapLibre always works on dev builds).
 * - `selectedMarkId`, `onMarkPress`, `onMarkMove`, `prediction` props
 *   accepted but no longer trigger UI (popup / drag / prediction overlays
 *   were unused in practice — re-add as overlay children of <RaceMap> when
 *   the related features actually ship).
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { RaceMap, type CourseMark } from '@/components/races/RaceMap';

interface LegacyCourseMark {
  id: string;
  name: string;
  type: 'start' | 'mark' | 'finish' | 'gate';
  coordinates: { latitude: number; longitude: number };
  color?: string;
}

interface CourseMapViewProps {
  courseMarks?: LegacyCourseMark[];
  centerCoordinate?: { latitude: number; longitude: number };
  /** Compact preview tiles disable gestures + ornaments. */
  compact?: boolean;
  /** Accepted for API compat; no UI hookup right now. */
  onMarkPress?: (mark: LegacyCourseMark) => void;
  /** Accepted for API compat; drag is not implemented on the new stack. */
  onMarkMove?: (markId: string, coords: { latitude: number; longitude: number }) => void;
  /** Accepted for API compat; AI prediction overlays removed pending real data. */
  prediction?: unknown;
  selectedMarkId?: string;
}

function toRaceMark(m: LegacyCourseMark): CourseMark {
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    lat: m.coordinates.latitude,
    lng: m.coordinates.longitude,
    color: m.color,
  };
}

const CourseMapView: React.FC<CourseMapViewProps> = ({
  courseMarks = [],
  centerCoordinate,
  compact = false,
  onMarkPress,
}) => {
  const marks = courseMarks.map(toRaceMark);
  const center = centerCoordinate
    ? { lat: centerCoordinate.latitude, lng: centerCoordinate.longitude }
    : undefined;

  return (
    <View style={styles.container}>
      <RaceMap
        marks={marks}
        center={center}
        fitToMarks={!center && marks.length > 1}
        interactive={!compact}
        zoom={compact ? 13 : 14}
        onMarkPress={(mark) => {
          if (!onMarkPress) return;
          const legacy = courseMarks.find((m) => m.id === mark.id);
          if (legacy) onMarkPress(legacy);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default CourseMapView;
