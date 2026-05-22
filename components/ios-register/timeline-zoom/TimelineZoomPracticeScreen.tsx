/**
 * TimelineZoomPracticeScreen — the canvas wired to real user data.
 *
 * The cutover surface. Pulls the signed-in user's timeline steps and seasons,
 * runs them through the real-data adapter, hands the result to
 * <TimelineZoomCanvas />. Falls back to a gentle empty state when the user
 * has no steps yet — the canvas itself doesn't render anything meaningful
 * without at least one step.
 *
 * Gated by FEATURE_FLAGS.TIMELINE_ZOOM_PRACTICE_CUTOVER at the call site
 * (RacesScreen in app/(tabs)/races.tsx).
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useMyTimeline } from '@/hooks/useTimelineSteps';
import { useCurrentSeason, useUserSeasons } from '@/hooks/useSeason';

import { TimelineZoomCanvas } from './TimelineZoomCanvas';
import { mapToTimelineDataset } from './realDataAdapter';

export function TimelineZoomPracticeScreen() {
  const { user } = useAuth();
  const { currentInterest } = useInterest();

  const interestId = currentInterest?.id ?? null;
  const { data: steps = [], isLoading: stepsLoading } = useMyTimeline(interestId);
  const { data: currentSeason = null } = useCurrentSeason();
  const { data: allSeasons = [] } = useUserSeasons();

  const userInitials = useMemo(() => {
    const name =
      (user?.user_metadata?.full_name as string | undefined) ??
      (user?.email as string | undefined) ??
      '';
    if (!name) return '··';
    const parts = name.replace(/@.*$/, '').split(/\s+|\./).filter(Boolean);
    if (parts.length === 0) return '··';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [user]);

  const dataset = useMemo(
    () =>
      mapToTimelineDataset({
        interestLabel: currentInterest?.name ?? 'Practice',
        user: {
          initials: userInitials,
          color: currentInterest?.accent_color || '#7BA0C4',
        },
        currentSeason,
        allSeasons,
        steps,
      }),
    [currentInterest, userInitials, currentSeason, allSeasons, steps],
  );

  const hasContent = dataset.seasons.some((s) => s.bricks.length > 0);

  if (stepsLoading && !hasContent) {
    return (
      <SafeAreaView style={styles.empty} edges={['top']}>
        <Text style={styles.emptyText}>Loading your timeline…</Text>
      </SafeAreaView>
    );
  }

  if (!hasContent) {
    return (
      <SafeAreaView style={styles.empty} edges={['top']}>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Nothing on the canvas yet</Text>
          <Text style={styles.emptyText}>
            Add a step to your timeline and it will appear here as L1 — pinch
            to zoom out to Week, Season, or Years.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.surface} edges={['top']}>
      <TimelineZoomCanvas dataset={dataset} initialLevel={3} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  empty: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyBox: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_REGISTER.label,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_REGISTER.labelSecondary,
    textAlign: 'center',
  },
});
