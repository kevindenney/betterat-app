/**
 * ConceptCard — 140×180 vertical card for the Playbook concept shelf.
 *
 * Apple Books library treatment: state pill + reflection count at top,
 * title at bottom. Optional coral live-dot inline with the title when
 * the concept is active in the current step.
 *
 * Three state variants carry the iOS register's two-accent grammar:
 *   practicing   → iOS blue tint   (working state — most concepts)
 *   learning     → neutral gray     (quiet, entering, not load-bearing)
 *   breakthrough → coral tint       (marked moment — same semantic as
 *                                    the permission rule + silent flag)
 *
 * Breakthrough cards also pick up a faint coral wash gradient at the top
 * edge so they read at a glance in a horizontal-scroll shelf.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';

export type ConceptState = 'practicing' | 'learning' | 'breakthrough';

interface Props {
  title: string;
  state: ConceptState;
  /** Number of reflections that have touched this concept */
  reflectionCount?: number;
  /** When true, render the 6px coral live-dot inline with the title.
   *  Same component as the Race Prep WorkingOnPill live-dot. */
  live?: boolean;
  onPress?: () => void;
}

const STATE_LABEL: Record<ConceptState, string> = {
  practicing: 'practicing',
  learning: 'learning',
  breakthrough: 'breakthrough',
};

export function ConceptCard({
  title,
  state,
  reflectionCount,
  live,
  onPress,
}: Props) {
  const isBreakthrough = state === 'breakthrough';

  return (
    <Pressable
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`${title} — ${STATE_LABEL[state]}`}
    >
      {isBreakthrough && (
        <LinearGradient
          colors={['rgba(255, 107, 107, 0.08)', 'rgba(255, 107, 107, 0)']}
          style={styles.breakthroughWash}
          pointerEvents="none"
        />
      )}

      <View style={styles.topRow}>
        <View
          style={[
            styles.statePill,
            state === 'practicing' && styles.statePillPracticing,
            state === 'learning' && styles.statePillLearning,
            state === 'breakthrough' && styles.statePillBreakthrough,
          ]}
        >
          <Text
            style={[
              styles.stateText,
              state === 'practicing' && styles.stateTextPracticing,
              state === 'learning' && styles.stateTextLearning,
              state === 'breakthrough' && styles.stateTextBreakthrough,
            ]}
          >
            {STATE_LABEL[state]}
          </Text>
        </View>
        {typeof reflectionCount === 'number' && (
          <Text style={styles.refCount}>{reflectionCount}</Text>
        )}
      </View>

      <View style={styles.titleRow}>
        {live && <View style={styles.liveDot} />}
        <Text style={styles.title} numberOfLines={4}>
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 140,
    height: 180,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    paddingTop: 12,
    paddingRight: 12,
    paddingBottom: 14,
    paddingLeft: 12,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'space-between',
    ...Platform.select({
      web: {
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
      },
    }),
  },
  breakthroughWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 48,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  statePill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  statePillPracticing: {
    backgroundColor: 'rgba(0, 122, 255, 0.10)',
  },
  statePillLearning: {
    backgroundColor: IOS_REGISTER.fillPill,
  },
  statePillBreakthrough: {
    backgroundColor: IOS_REGISTER.accentMarkedContentTintStrong,
  },
  stateText: {
    fontSize: 10.5,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    letterSpacing: 0.02,
  },
  stateTextPracticing: {
    color: IOS_REGISTER.accentUserAction,
  },
  stateTextLearning: {
    color: IOS_REGISTER.labelSecondary,
  },
  stateTextBreakthrough: {
    color: '#E85A5A',
  },
  refCount: {
    fontSize: 11,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    color: IOS_REGISTER.labelTertiary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.05,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  liveDot: {
    width: IOS_REGISTER.liveDotSize,
    height: IOS_REGISTER.liveDotSize,
    borderRadius: IOS_REGISTER.liveDotSize / 2,
    backgroundColor: IOS_REGISTER.liveDotColor,
    marginBottom: 6,
    flexShrink: 0,
  },
  title: {
    fontSize: 15,
    fontFamily: fontFamily.serif,
    fontWeight: '500',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
    lineHeight: 19,
    flex: 1,
  },
});
