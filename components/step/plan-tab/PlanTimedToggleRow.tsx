import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';

interface PlanTimedToggleRowProps {
  isTimed: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
}

/**
 * Plan-tab toggle for `timeline_steps.is_timed`. When ON the Do tab
 * auto-stamps started_at, runs the live header timer, and surfaces the
 * Stop-capturing CTA. When OFF the Do tab is a passive capture surface
 * (notes, photos, voice) with no stopwatch UI. Most steps want OFF;
 * flip ON for race-day, starting drills, or interval workouts.
 */
export function PlanTimedToggleRow({ isTimed, onToggle, disabled }: PlanTimedToggleRowProps) {
  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <Text style={styles.title}>Track elapsed time</Text>
        <Text style={styles.body}>
          {isTimed
            ? 'Do tab will show a running timer and Stop button. Use for races, starting drills, interval workouts.'
            : 'Do tab will be a passive capture surface — notes, photos, voice. No timer.'}
        </Text>
      </View>
      <Switch
        value={isTimed}
        onValueChange={onToggle}
        disabled={disabled}
        accessibilityLabel="Track elapsed time on this step"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: IOS_SPACING.sm,
    paddingHorizontal: IOS_SPACING.md,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  body: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 16,
  },
});
