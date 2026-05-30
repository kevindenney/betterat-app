/**
 * SeasonHeaderChips — L3 season header.
 *
 * The title (e.g. "Winter 2025-2026", "Fall Semester 2025") already
 * encodes the calendar block in the persona's native vocab. The
 * literal date range is redundant on the surface; it lives inside the
 * season picker rows (tap the title to see all arcs with their dates).
 *
 *   - Title row: persona-native instance name + chevron — primary
 *     anchor, opens the season picker on tap.
 *   - Step counter: accent pill — orthogonal info (your position in
 *     the arc), not redundant with the title.
 *
 * See memory: project_season_is_persona_vocab.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';

interface Props {
  seasonTitle: string;
  /** Persona-native noun for the calendar block ("arc", "rotation",
   *  "season") — used in the screen-reader label so it matches the
   *  visible vocab. */
  periodNoun?: string;
  weekOfTotal?: { current: number; total: number };
  stepOfTotal?: { current: number; total: number };
  onPressSeason: () => void;
  onPressStep: () => void;
}

export function SeasonHeaderChips({
  seasonTitle,
  periodNoun = 'arc',
  weekOfTotal,
  stepOfTotal,
  onPressSeason,
  onPressStep,
}: Props) {
  const showCounter = Boolean(stepOfTotal || weekOfTotal);
  return (
    <View style={styles.block}>
      <Pressable
        onPress={onPressSeason}
        style={styles.titleRow}
        accessibilityRole="button"
        accessibilityLabel={`${periodNoun.charAt(0).toUpperCase()}${periodNoun.slice(1)}: ${seasonTitle}. Tap to switch ${periodNoun} or create a new one.`}
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

      {showCounter ? (
        <View style={styles.metaRow}>
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
        </View>
      ) : null}
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
