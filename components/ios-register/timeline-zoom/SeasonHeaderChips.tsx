/**
 * SeasonHeaderChips — the L3 season header turned into a row of three
 * tappable affordances:
 *   1. Season title chip (opens season picker)
 *   2. Date-range chip (opens calendar week picker)
 *   3. Step counter chip (opens step picker)
 *
 * Replaces the previous static text block. The chips telegraph "this is
 * navigable" — the title acts as a section anchor + a switcher.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

interface Props {
  seasonTitle: string;
  dateRange: string;
  weekOfTotal?: { current: number; total: number };
  stepOfTotal?: { current: number; total: number };
  /**
   * Eyebrow text above the season title. The parent composes this from
   * interest vocab + arc position (e.g. "ZOOM · CURRENT ARC · TUNING
   * UP" for a sailor at week 1 of 8) so the verb here speaks the
   * user's domain instead of a generic system label.
   */
  eyebrow?: string;
  onPressSeason: () => void;
  onPressDate: () => void;
  onPressStep: () => void;
}

export function SeasonHeaderChips({
  seasonTitle,
  dateRange,
  weekOfTotal,
  stepOfTotal,
  eyebrow = 'ZOOM · CURRENT ARC · REFLECTING',
  onPressSeason,
  onPressDate,
  onPressStep,
}: Props) {
  return (
    <View style={styles.block}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>

      <Pressable
        onPress={onPressSeason}
        style={({ pressed }) => [styles.titleRow, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Season: ${seasonTitle}. Tap to switch.`}
      >
        <Text style={styles.title} numberOfLines={2}>
          {seasonTitle}
        </Text>
        <Ionicons
          name="chevron-down"
          size={18}
          color={IOS_REGISTER.labelSecondary}
          style={styles.titleCaret}
        />
      </Pressable>

      <View style={styles.chipRow}>
        <Pressable
          onPress={onPressDate}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Date range: ${dateRange}. Tap for calendar.`}
        >
          <Ionicons
            name="calendar-outline"
            size={13}
            color={IOS_REGISTER.labelSecondary}
          />
          <Text style={styles.chipText}>{dateRange}</Text>
        </Pressable>

        {stepOfTotal ? (
          <Pressable
            onPress={onPressStep}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Step ${stepOfTotal.current} of ${stepOfTotal.total}. Tap to jump.`}
          >
            <Ionicons
              name="list-outline"
              size={13}
              color={IOS_REGISTER.labelSecondary}
            />
            <Text style={styles.chipText}>
              Step {stepOfTotal.current} of {stepOfTotal.total}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={IOS_REGISTER.labelTertiary}
            />
          </Pressable>
        ) : weekOfTotal ? (
          <Pressable
            onPress={onPressStep}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Week ${weekOfTotal.current} of ${weekOfTotal.total}. Tap to jump.`}
          >
            <Ionicons
              name="list-outline"
              size={13}
              color={IOS_REGISTER.labelSecondary}
            />
            <Text style={styles.chipText}>
              Week {weekOfTotal.current} of {weekOfTotal.total}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={IOS_REGISTER.labelTertiary}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: IOS_REGISTER.labelSecondary,
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  title: {
    flexShrink: 1,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: IOS_REGISTER.label,
  },
  titleCaret: {
    marginTop: 4,
  },
  pressed: {
    opacity: 0.55,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: IOS_REGISTER.fillPill,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.1,
  },
});
