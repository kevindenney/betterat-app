import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Ellipse, Line } from 'react-native-svg';
import { IOS_COLORS } from '@/lib/design-tokens-ios';

/**
 * Schematic preview of a race's area + course, shown once a race plan carries
 * a selected area. Mirrors the on-water grammar from the redesign mockup
 * (docs/redesign/mockups/27): a dark race-area polygon with the windward mark,
 * the pin/committee start marks, and a dashed start line. It's a stylized
 * diagram — not a live MapLibre canvas — so it stays cheap to render inside the
 * Plan tab while still reading as "this happens on a course".
 */

const RACE = '#2563EB';
const MARK = '#E07A3C';

interface RaceCourseMiniMapProps {
  areaName?: string;
  courseLabel?: string;
  courseType?: string;
  laps?: number;
  onEditCourse?: () => void;
}

export function RaceCourseMiniMap({
  areaName,
  courseLabel,
  courseType,
  laps,
  onEditCourse,
}: RaceCourseMiniMapProps) {
  // Coastal / distance races round fixed geography point-to-point, so the
  // windward mark and course sides are meaningless — show the start and a
  // schematic passage instead. Mirrors RaceCourseLiveMap's coastal branch.
  const type = String(courseType ?? '').toLowerCase();
  const label = String(courseLabel ?? '').toLowerCase();
  const isCoastalCourse =
    type === 'coastal' ||
    type === 'distance' ||
    label.includes('coastal') ||
    label.includes('distance');

  const courseValue = [
    courseLabel,
    laps ? `${laps} lap${laps === 1 ? '' : 's'}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card}>
      <View style={styles.map}>
        <LinearGradient
          colors={['#1C3A5E', '#0E2138']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Svg width="100%" height="100%">
          <Ellipse
            cx="50%"
            cy="51%"
            rx="32%"
            ry="36%"
            fill="rgba(37,99,235,0.14)"
            stroke="rgba(120,170,255,0.55)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <Line
            x1="34%"
            y1="74%"
            x2="66%"
            y2="74%"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
          {isCoastalCourse ? (
            <>
              {/* Schematic passage: start → turning point → finish. Illustrative
                  only (no real coordinates), so it reads as "around a course". */}
              <Line
                x1="50%"
                y1="72%"
                x2="30%"
                y2="48%"
                stroke="rgba(224,122,60,0.85)"
                strokeWidth={2}
                strokeDasharray="5 4"
              />
              <Line
                x1="30%"
                y1="48%"
                x2="60%"
                y2="28%"
                stroke="rgba(224,122,60,0.85)"
                strokeWidth={2}
                strokeDasharray="5 4"
              />
            </>
          ) : null}
        </Svg>

        {areaName ? (
          <Text style={styles.areaLabel} numberOfLines={1}>
            {areaName.toUpperCase()}
          </Text>
        ) : null}

        {isCoastalCourse ? (
          <>
            {/* Turning mark + finish — generic, no windward/leeward grammar. */}
            <View style={[styles.mark, { left: '30%', top: '48%' }]} />
            <View style={[styles.mark, { left: '60%', top: '28%' }]} />
            <Text style={[styles.markLabel, { left: '60%', top: '19%' }]}>Finish</Text>
          </>
        ) : (
          <>
            {/* Windward mark + label */}
            <View style={[styles.mark, { left: '50%', top: '24%' }]} />
            <Text style={[styles.markLabel, { left: '50%', top: '15%' }]}>Windward</Text>
          </>
        )}

        {/* Pin (left) start mark + label */}
        <View style={[styles.mark, { left: '34%', top: '74%' }]} />
        <Text style={[styles.markLabel, { left: '34%', top: '80%' }]}>Pin</Text>

        {/* Committee (right) start mark + label */}
        <View style={[styles.mark, { left: '66%', top: '74%' }]} />
        <Text style={[styles.markLabel, { left: '66%', top: '80%' }]}>Committee</Text>

        {onEditCourse ? (
          <Pressable
            style={({ pressed }) => [styles.editPill, pressed && styles.editPillPressed]}
            onPress={onEditCourse}
            accessibilityRole="button"
            hitSlop={8}
          >
            <Text style={styles.editPillText}>Edit course ›</Text>
          </Pressable>
        ) : null}
      </View>

      {courseValue ? (
        <View style={styles.footer}>
          <Text style={styles.footerKey}>Course</Text>
          <Text style={styles.footerVal}>{courseValue}</Text>
        </View>
      ) : null}
    </View>
  );
}

// Marks/labels are absolutely positioned on percentage anchors, then nudged by
// half their size so the percentage point lands at the visual center (RN can't
// express translate(-50%) so we offset with negative margins).
const MARK_SIZE = 11;
const LABEL_W = 90;

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_COLORS.systemGray5,
  },
  map: {
    height: 148,
    position: 'relative',
  },
  areaLabel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '6%',
    textAlign: 'center',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: 'rgba(190,215,255,0.92)',
  },
  mark: {
    position: 'absolute',
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_SIZE / 2,
    backgroundColor: MARK,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginLeft: -MARK_SIZE / 2,
    marginTop: -MARK_SIZE / 2,
  },
  markLabel: {
    position: 'absolute',
    width: LABEL_W,
    marginLeft: -LABEL_W / 2,
    textAlign: 'center',
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  editPill: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  editPillPressed: {
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  editPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: RACE,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: IOS_COLORS.systemBackground,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  footerKey: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
  },
  footerVal: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
});
