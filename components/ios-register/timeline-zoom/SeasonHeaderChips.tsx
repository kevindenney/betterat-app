/**
 * SeasonHeaderChips — L3 season header. Tufte-quiet treatment:
 *   1. Tiny eyebrow (ZOOM · CURRENT ARC · <VERB>)
 *   2. Large title + chevron — opens season picker
 *   3. Single dim metadata line below the title: date range · step
 *      counter, as plain tappable text linked by middle dots. No
 *      chips, no pill chrome — the data IS the affordance.
 *
 * Pattern mirrors L4's title-row + duration-subtitle, so both zoom
 * levels share the same visual rhythm.
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

      <View style={styles.metaRow}>
        <Pressable
          onPress={onPressDate}
          accessibilityRole="button"
          accessibilityLabel={`Date range: ${dateRange}. Tap for calendar.`}
          style={({ pressed }) => (pressed ? styles.pressed : null)}
          hitSlop={6}
        >
          <Text style={styles.metaLink}>{dateRange}</Text>
        </Pressable>
        {stepOfTotal || weekOfTotal ? (
          <>
            <Text style={styles.metaSep}>·</Text>
            <Pressable
              onPress={onPressStep}
              accessibilityRole="button"
              accessibilityLabel={
                stepOfTotal
                  ? `Step ${stepOfTotal.current} of ${stepOfTotal.total}. Tap to jump.`
                  : `Week ${weekOfTotal!.current} of ${weekOfTotal!.total}. Tap to jump.`
              }
              style={({ pressed }) => (pressed ? styles.pressed : null)}
              hitSlop={6}
            >
              <Text style={styles.metaLink}>
                {stepOfTotal
                  ? `Step ${stepOfTotal.current} of ${stepOfTotal.total}`
                  : `Week ${weekOfTotal!.current} of ${weekOfTotal!.total}`}
              </Text>
            </Pressable>
          </>
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
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.55,
    color: IOS_REGISTER.labelTertiary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaLink: {
    fontSize: 12.5,
    fontWeight: '500',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  metaSep: {
    fontSize: 12.5,
    color: IOS_REGISTER.labelTertiary,
  },
});
