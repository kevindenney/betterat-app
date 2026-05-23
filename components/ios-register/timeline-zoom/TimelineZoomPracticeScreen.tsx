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

import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useMyTimeline } from '@/hooks/useTimelineSteps';
import { useCurrentSeason, useUserSeasons } from '@/hooks/useSeason';
import { useSubscribedBlueprints, useBlueprintWithAuthor } from '@/hooks/useBlueprint';

import { InterestHeader } from './InterestHeader';
import { TimelineZoomCanvas } from './TimelineZoomCanvas';
import { mapToTimelineDataset, type BlueprintLookup } from './realDataAdapter';

export function TimelineZoomPracticeScreen() {
  const { user } = useAuth();
  const { currentInterest } = useInterest();

  const interestId = currentInterest?.id ?? null;
  const { data: steps = [], isLoading: stepsLoading } = useMyTimeline(interestId);
  const { data: currentSeason = null } = useCurrentSeason();
  const { data: allSeasons = [] } = useUserSeasons();
  const { data: subscribedBlueprints = [] } = useSubscribedBlueprints(interestId);

  // The focused step's blueprint gets the "suggested by …" author tag —
  // only one extra query, only when the focused step actually came from a
  // blueprint, so it's cheap.
  const focusedStep = useMemo(() => {
    const sorted = [...steps].sort((a, b) => a.sort_order - b.sort_order);
    return (
      sorted.find((s) => s.status === 'in_progress' || s.status === 'pending') ??
      sorted[0] ??
      null
    );
  }, [steps]);
  const { data: focusedBlueprint } = useBlueprintWithAuthor(
    focusedStep?.source_blueprint_id ?? null,
  );

  const blueprintsById = useMemo(() => {
    const map = new Map<string, BlueprintLookup>();
    for (const bp of subscribedBlueprints) {
      map.set(bp.id, { title: bp.title });
    }
    if (focusedBlueprint) {
      map.set(focusedBlueprint.id, {
        title: focusedBlueprint.title,
        author_name: focusedBlueprint.author_name,
      });
    }
    return map;
  }, [subscribedBlueprints, focusedBlueprint]);

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
        blueprintsById,
      }),
    [currentInterest, userInitials, currentSeason, allSeasons, steps, blueprintsById],
  );

  const handleOpenStepDetail = useCallback((stepId: string) => {
    router.push(`/step/${stepId}` as never);
  }, []);

  const hasContent = dataset.seasons.some((s) => s.bricks.length > 0);

  // The empty + loading states keep the InterestHeader visible so the user
  // can still see which interest is selected, switch interests, and tap
  // their avatar. Previously the early-return swapped the entire screen
  // for an empty card and left the user with no controls.
  if (!hasContent) {
    return (
      <SafeAreaView style={styles.surface} edges={['top']}>
        <InterestHeader
          interestLabel={dataset.interest.label}
          level={3}
          user={dataset.user}
        />
        <View style={styles.emptyWrap}>
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              {stepsLoading ? 'Loading your timeline…' : 'Nothing on the canvas yet'}
            </Text>
            {!stepsLoading ? (
              <>
                <Text style={styles.emptyText}>
                  {currentInterest
                    ? `No steps in "${currentInterest.name}" yet. Add a step or switch interests from the pill above.`
                    : 'Add a step to your timeline and it will appear here. Pinch to zoom between Step, Week, Season, and Years.'}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.surface} edges={['top']}>
      <TimelineZoomCanvas
        dataset={dataset}
        initialLevel={3}
        onOpenStepDetail={handleOpenStepDetail}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    backgroundColor: IOS_REGISTER.groundBg,
  },
  emptyWrap: {
    flex: 1,
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
