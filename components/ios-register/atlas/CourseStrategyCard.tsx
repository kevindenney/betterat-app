/**
 * CourseStrategyCard — renders deriveCourseStrategy() output inside the Atlas
 * race-mark BottomSheet (as its `expandedContent`). The advice is keyed to the
 * live wind + current only — not the tapped mark's position — because the
 * favored side/end are a function of conditions, not geometry, so the same
 * card is correct for any mark on the course.
 *
 * Presentational only: the parent sheet owns scroll + surface chrome; this is
 * a plain View styled to sit on the white iOS sheet.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CourseSide, CourseStrategy, StartEnd } from '@/lib/courseStrategy';
import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';

const SIDE_LABEL: Record<CourseSide, string> = {
  left: 'LEFT',
  right: 'RIGHT',
  even: 'EVEN',
};
const END_LABEL: Record<StartEnd, string> = {
  pin: 'PIN',
  committee: 'BOAT',
  even: 'EVEN',
};

function FavoredTag({ favored, label }: { favored: boolean; label: string }) {
  return (
    <View style={[styles.tag, favored && styles.tagFavored]}>
      <Text style={[styles.tagText, favored && styles.tagTextFavored]}>{label}</Text>
    </View>
  );
}

export function CourseStrategyCard({ strategy }: { strategy: CourseStrategy }) {
  const { start, upwind, downwind } = strategy;
  return (
    <View style={styles.card}>
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>START</Text>
          <FavoredTag favored={start.favoredEnd !== 'even'} label={END_LABEL[start.favoredEnd]} />
        </View>
        <Text style={styles.body}>{start.text}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>UPWIND</Text>
          <FavoredTag favored={upwind.favoredSide !== 'even'} label={SIDE_LABEL[upwind.favoredSide]} />
        </View>
        <Text style={styles.body}>{upwind.summary}</Text>
        {upwind.thirds.map((t) => (
          <View key={`up-${t.third}`} style={styles.thirdRow}>
            <Text style={styles.thirdTag}>{t.third.toUpperCase()} ⅓</Text>
            <Text style={styles.thirdBody}>{t.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>DOWNWIND</Text>
          <FavoredTag favored={downwind.favoredSide !== 'even'} label={SIDE_LABEL[downwind.favoredSide]} />
        </View>
        <Text style={styles.body}>{downwind.summary}</Text>
        {downwind.thirds.map((t) => (
          <View key={`dn-${t.third}`} style={styles.thirdRow}>
            <Text style={styles.thirdTag}>{t.third.toUpperCase()} ⅓</Text>
            <Text style={styles.thirdBody}>{t.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
  },
  section: {
    marginTop: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#D2691E',
  },
  body: {
    marginTop: 3,
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 16,
    letterSpacing: -0.05,
  },
  thirdRow: {
    flexDirection: 'row',
    marginTop: 6,
    gap: 8,
  },
  thirdTag: {
    width: 56,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: IOS_REGISTER.labelTertiary,
    paddingTop: 1,
  },
  thirdBody: {
    flex: 1,
    fontSize: 11,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 15,
    letterSpacing: -0.05,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separator,
    backgroundColor: 'rgba(60, 60, 67, 0.06)',
  },
  tagFavored: {
    borderColor: 'rgba(52, 199, 89, 0.45)',
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: IOS_REGISTER.labelTertiary,
  },
  tagTextFavored: {
    color: IOS_COLORS.systemGreen,
  },
});
