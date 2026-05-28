/**
 * L1SwipeTitle — focused step's title for the chrome row middle slot at L1.
 *
 * Slides in from the direction matching the swipe (next → from right, prev →
 * from left), or fades in for non-swipe focus changes (zoom-in, jump from
 * search). Same row height as L2/L3 so the chrome doesn't shift between
 * levels.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  SlideInLeft,
  SlideInRight,
} from 'react-native-reanimated';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';

interface L1SwipeTitleProps {
  title: string;
  /** Stable key so the Animated.View remounts (and re-runs entering) per step. */
  stepId: string;
  /** Last user-swipe direction. Drives slide direction; null means fade. */
  direction: 'prev' | 'next' | null;
}

export function L1SwipeTitle({ title, stepId, direction }: L1SwipeTitleProps) {
  const entering =
    direction === 'next'
      ? SlideInRight.duration(180)
      : direction === 'prev'
        ? SlideInLeft.duration(180)
        : FadeIn.duration(160);

  return (
    <View style={styles.host}>
      <Animated.View key={`l1-title-${stepId}`} entering={entering}>
        <Text style={styles.text} numberOfLines={1}>
          {title}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 0,
    overflow: 'hidden',
    alignItems: 'center',
  },
  text: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: IOS_REGISTER.label,
    textAlign: 'center',
  },
});

export default L1SwipeTitle;
