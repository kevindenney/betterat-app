/**
 * CourseOverlay — race course rendered inside a <RaceMap>.
 *
 * Draws start line, course marks with type-based icons/colors, course path,
 * and finish line. Each line is a GeoJSON LineString layer; marks are
 * MapLibre Markers with React Native View children for the icon badge.
 *
 * Drops the legacy Callout popup (MapLibre Marker doesn't have native
 * popups — re-implement as a tap → modal handler on the parent if/when
 * we need labels back).
 */

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Marker as MLMarker,
  GeoJSONSource as MLGeoJSONSource,
  Layer as MLLayer,
} from '@maplibre/maplibre-react-native';
import type { CourseMark } from '@/types/raceEvents';

const MARK_COLORS: Record<string, string> = {
  start: '#22c55e',
  committee_boat: '#22c55e',
  pin: '#22c55e',
  finish: '#ef4444',
  windward: '#3b82f6',
  leeward: '#f59e0b',
  gate_left: '#8b5cf6',
  gate_right: '#8b5cf6',
  offset: '#ec4899',
};

function markColor(type?: string | null): string {
  if (!type) return '#64748b';
  return MARK_COLORS[type] || '#64748b';
}

type IconGlyph = keyof typeof Ionicons.glyphMap;

function markIcon(type?: string | null): { name: IconGlyph; size: number } {
  switch (type) {
    case 'committee_boat':
      return { name: 'boat-outline', size: 16 };
    case 'windward':
      return { name: 'arrow-up-outline', size: 14 };
    case 'leeward':
      return { name: 'arrow-down-outline', size: 14 };
    case 'gate_left':
    case 'gate_right':
      return { name: 'git-branch-outline', size: 14 };
    case 'pin':
      return { name: 'flag-outline', size: 14 };
    case 'finish':
      return { name: 'checkmark-outline', size: 14 };
    case 'offset':
      return { name: 'ellipse-outline', size: 14 };
    default:
      return { name: 'location-outline', size: 14 };
  }
}

interface EnhancedMark {
  id?: string;
  coordinate: { latitude: number; longitude: number };
  name?: string;
  type?: string | null;
  sequence?: number;
  rounding?: string | null;
}

interface Course {
  startLine: { latitude: number; longitude: number }[];
  finishLine?: { latitude: number; longitude: number }[];
  marks: EnhancedMark[];
  path: { latitude: number; longitude: number }[];
}

interface CourseOverlayProps {
  course: Course;
  onMarkPress?: (mark: EnhancedMark) => void;
}

function toLngLat(p: { latitude: number; longitude: number }): [number, number] {
  return [p.longitude, p.latitude];
}

function lineFeature(points: { latitude: number; longitude: number }[]) {
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: points.map(toLngLat),
    },
  };
}

export const CourseOverlay: React.FC<CourseOverlayProps> = ({ course, onMarkPress }) => {
  const startLineFeature = useMemo(
    () => (course.startLine.length >= 2 ? lineFeature(course.startLine) : null),
    [course.startLine],
  );
  const pathFeature = useMemo(
    () => (course.path.length > 1 ? lineFeature(course.path) : null),
    [course.path],
  );
  const finishLineFeature = useMemo(
    () =>
      course.finishLine && course.finishLine.length >= 2
        ? lineFeature(course.finishLine)
        : null,
    [course.finishLine],
  );

  return (
    <>
      {startLineFeature ? (
        <MLGeoJSONSource id="course-start-line" data={startLineFeature}>
          <MLLayer
              type="line"
            id="course-start-line-layer"
            source="course-start-line"
            style={{
              lineColor: MARK_COLORS.start,
              lineWidth: 4,
              lineCap: 'round',
            }}
          />
        </MLGeoJSONSource>
      ) : null}

      {pathFeature ? (
        <MLGeoJSONSource id="course-path" data={pathFeature}>
          <MLLayer
              type="line"
            id="course-path-layer"
            source="course-path"
            style={{
              lineColor: '#0ea5e9',
              lineWidth: 3,
              lineDasharray: [3, 1.5],
              lineCap: 'round',
            }}
          />
        </MLGeoJSONSource>
      ) : null}

      {finishLineFeature ? (
        <MLGeoJSONSource id="course-finish-line" data={finishLineFeature}>
          <MLLayer
              type="line"
            id="course-finish-line-layer"
            source="course-finish-line"
            style={{
              lineColor: MARK_COLORS.finish,
              lineWidth: 4,
              lineCap: 'round',
            }}
          />
        </MLGeoJSONSource>
      ) : null}

      {course.marks.map((mark, idx) => {
        const color = markColor(mark.type);
        const icon = markIcon(mark.type);
        const isGate = mark.type === 'gate_left' || mark.type === 'gate_right';
        return (
          <MLMarker
            key={mark.id || `mark-${idx}`}
            id={`course-mark-${mark.id || idx}`}
            lngLat={toLngLat(mark.coordinate)}
          >
            <View
              style={[
                styles.courseMark,
                { backgroundColor: color },
                isGate && styles.gateMark,
              ]}
              onTouchEnd={() => onMarkPress?.(mark)}
            >
              <Ionicons name={icon.name} size={icon.size} color="#ffffff" />
            </View>
          </MLMarker>
        );
      })}
    </>
  );
};

/** Convert a flat CourseMark[] (from race-events tables) to Course shape. */
export const convertMarksToCoourse = (marks: CourseMark[]): Course => {
  const marksWithCoords = marks
    .map((m) => ({
      id: m.id,
      name: m.mark_name || undefined,
      type: m.mark_type || undefined,
      sequence: m.sequence || undefined,
      rounding: m.rounding || undefined,
      coordinate: {
        latitude: m.latitude,
        longitude: m.longitude,
      },
    }))
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  const committeeBoat = marksWithCoords.find(
    (m) => m.type === 'committee_boat' || m.name?.toLowerCase().includes('committee'),
  );
  const pin = marksWithCoords.find(
    (m) => m.type === 'pin' || m.name?.toLowerCase().includes('pin'),
  );
  const finishMark = marksWithCoords.find(
    (m) => m.type === 'finish' || m.name?.toLowerCase().includes('finish'),
  );

  const startLine: { latitude: number; longitude: number }[] = [];
  if (committeeBoat && pin) {
    startLine.push(committeeBoat.coordinate, pin.coordinate);
  }

  const finishLine: { latitude: number; longitude: number }[] = [];
  if (committeeBoat && finishMark) {
    finishLine.push(committeeBoat.coordinate, finishMark.coordinate);
  }

  const racingMarks = marksWithCoords.filter(
    (m) =>
      m.type !== 'committee_boat' &&
      m.type !== 'pin' &&
      !m.name?.toLowerCase().includes('committee') &&
      !m.name?.toLowerCase().includes('pin'),
  );

  const path: { latitude: number; longitude: number }[] = [];
  if (startLine.length === 2) {
    path.push({
      latitude: (startLine[0].latitude + startLine[1].latitude) / 2,
      longitude: (startLine[0].longitude + startLine[1].longitude) / 2,
    });
  }
  racingMarks.forEach((mark) => path.push(mark.coordinate));
  if (finishLine.length === 2) {
    path.push({
      latitude: (finishLine[0].latitude + finishLine[1].latitude) / 2,
      longitude: (finishLine[0].longitude + finishLine[1].longitude) / 2,
    });
  }

  return {
    startLine,
    finishLine,
    marks: marksWithCoords,
    path,
  };
};

const styles = StyleSheet.create({
  courseMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  gateMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
  },
});
