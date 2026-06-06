/**
 * <PlansZone> — Library Plans zone landing.
 *
 * Lists the user's subscribed plan blueprints with author chip, progress
 * bar, and subscriber count. Tap a row → push into the Blueprint
 * timeline at /library/blueprints/[id] (skipping the old cover page
 * to cut a drill-down).
 *
 * Empty state surfaces a hint pointing at Discover, since plans are
 * subscribed-to (not created here). Loading state renders a single
 * spinner; data hydrates inline via React Query.
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { useSubscribedPlansForLibrary } from '@/hooks/useSubscribedPlansForLibrary';
import { useInterest } from '@/providers/InterestProvider';
import { PlanRowCard } from '@/components/library/plans/PlanRowCard';

export function PlansZone() {
  const { currentInterest } = useInterest();
  const { data: plans, isLoading } = useSubscribedPlansForLibrary(currentInterest?.id);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={IOS_COLORS.tertiaryLabel} />
      </View>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="map-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
        <Text style={styles.emptyTitle}>No Blueprints yet</Text>
        <Text style={styles.emptyBlurb}>
          Subscribe to a coach-bundled Blueprint from the stacks, and it'll
          land here with subscribers and resources.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {plans.map((plan) => (
        <PlanRowCard
          key={plan.blueprintId}
          plan={plan}
          onPress={() =>
            router.push(`/(tabs)/library/blueprints/${plan.blueprintId}` as never)
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: IOS_SPACING.sm,
    gap: IOS_SPACING.sm,
  },
  loading: {
    paddingVertical: IOS_SPACING.xl,
    alignItems: 'center',
  },
  empty: {
    margin: IOS_SPACING.lg,
    padding: IOS_SPACING.lg,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  emptyTitle: {
    fontFamily: fontFamily.serif,
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.3,
    color: IOS_COLORS.label,
  },
  emptyBlurb: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
});
