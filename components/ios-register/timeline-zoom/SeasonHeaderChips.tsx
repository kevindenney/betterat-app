/**
 * SeasonHeaderChips — L3 season header. Tufte-quiet treatment:
 *   1. Large title + inline chevron — reads as a single dropdown
 *      button, opens the season picker on tap. The chevron lives
 *      next to the text (not below it) so the affordance is
 *      obvious.
 *   2. Single dim metadata line below the title: date range · step
 *      counter, as plain tappable text linked by middle dots. No
 *      chips, no pill chrome — the data IS the affordance.
 *
 * The "ZOOM · CURRENT ARC · <VERB>" eyebrow is gone. The chart's
 * scope is already clear from the title + zoom indicator on the
 * right; the verb wasn't earning its space.
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
  onPressSeason: () => void;
  onPressDate: () => void;
  onPressStep: () => void;
}

export function SeasonHeaderChips({
  seasonTitle,
  dateRange,
  weekOfTotal,
  stepOfTotal,
  onPressSeason,
  onPressDate,
  onPressStep,
}: Props) {
  return (
    <View style={styles.block}>
      <Pressable
        onPress={onPressSeason}
        style={styles.titleRow}
        accessibilityRole="button"
        accessibilityLabel={`Arc: ${seasonTitle}. Tap to switch arc or create a new one.`}
        hitSlop={4}
      >
        <Text style={styles.title} numberOfLines={1}>
          {seasonTitle}
        </Text>
        <Ionicons
          name="chevron-down"
          size={20}
          color={IOS_REGISTER.labelSecondary}
          style={styles.titleCaret}
        />
      </Pressable>

      <View style={styles.metaRow}>
        <Pressable
          onPress={onPressDate}
          accessibilityRole="button"
          accessibilityLabel={`Date range: ${dateRange}. Tap for calendar.`}
          style={styles.metaPill}
          hitSlop={6}
        >
          <Text style={styles.metaLink}>{dateRange}</Text>
          <Ionicons
            name="chevron-down"
            size={11}
            color={IOS_REGISTER.accentUserAction}
            style={styles.metaCaret}
          />
        </Pressable>
        {stepOfTotal || weekOfTotal ? (
          <Pressable
            onPress={onPressStep}
            accessibilityRole="button"
            accessibilityLabel={
              stepOfTotal
                ? `Step ${stepOfTotal.current} of ${stepOfTotal.total}. Tap to jump.`
                : `Week ${weekOfTotal!.current} of ${weekOfTotal!.total}. Tap to jump.`
            }
            style={styles.metaPill}
            hitSlop={6}
          >
            <Text style={styles.metaLink}>
              {stepOfTotal
                ? `Step ${stepOfTotal.current} of ${stepOfTotal.total}`
                : `Week ${weekOfTotal!.current} of ${weekOfTotal!.total}`}
            </Text>
            <Ionicons
              name="chevron-down"
              size={11}
              color={IOS_REGISTER.accentUserAction}
              style={styles.metaCaret}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  metaLink: {
    fontSize: 12.5,
    fontWeight: '500',
    color: IOS_REGISTER.accentUserAction,
    letterSpacing: -0.1,
  },
  metaCaret: {
    marginTop: 1,
  },
});
