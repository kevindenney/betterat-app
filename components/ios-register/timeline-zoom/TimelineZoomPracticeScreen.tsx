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

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useMyTimeline, useUpdateStep, useDeleteStep } from '@/hooks/useTimelineSteps';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useCurrentSeason, useUserSeasons, useCreateSeason } from '@/hooks/useSeason';
import { useSubscribedBlueprints, useBlueprintWithAuthor } from '@/hooks/useBlueprint';

import { TimelineZoomCanvas } from './TimelineZoomCanvas';
import { mapToTimelineDataset, type BlueprintLookup } from './realDataAdapter';
import { MoveToSeasonSheet, buildMoveTargets } from './MoveToSeasonSheet';
import { TagBulkSheet } from './TagBulkSheet';
import { ScheduleBulkSheet } from './ScheduleBulkSheet';
import { SAMPLE_DATASET } from './sampleData';

export function TimelineZoomPracticeScreen() {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  // When the signed-in user has no steps, an opt-in lets you preview all
  // the new zoom-canvas features against the canonical sample dataset
  // (Emily Shaw's nursing year). Doesn't affect any real data — just
  // swaps what the canvas reads from in-memory.
  const [showSample, setShowSample] = useState(false);

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

  // Section D drag-reorder — the view resolves the post-drop neighbor
  // step ids and hands them here; we look up their sort_orders and
  // write a value between them. Neighbor-id (not index) lets both L2
  // and L3 share this handler without the owner needing to know which
  // view called.
  const updateStep = useUpdateStep();
  const handleReorderStep = useCallback(
    (stepId: string, beforeStepId: string | null, afterStepId: string | null) => {
      const moved = steps.find((s) => s.id === stepId);
      if (!moved) return;
      const before = beforeStepId ? steps.find((s) => s.id === beforeStepId) : null;
      const after = afterStepId ? steps.find((s) => s.id === afterStepId) : null;

      let nextSort: number;
      if (before && after) {
        nextSort = (before.sort_order + after.sort_order) / 2;
      } else if (before) {
        nextSort = before.sort_order + 1;
      } else if (after) {
        nextSort = after.sort_order - 1;
      } else {
        return; // no neighbors at all = no list = nothing to do
      }
      if (nextSort === moved.sort_order) return;
      updateStep.mutate({ stepId, input: { sort_order: nextSort } });
    },
    [steps, updateStep],
  );

  // Frame 12 bulk actions. Archive flips status to 'skipped' (the
  // schema's closest "off the active list" terminal state); delete is
  // the real destroy mutation behind a confirm. Move/Tag/Reschedule
  // route to a toast for now — they need single-row picker UI we
  // haven't built into the canvas surface yet.
  const deleteStep = useDeleteStep();
  const handleBulkArchive = useCallback(
    (stepIds: string[]) => {
      stepIds.forEach((id) =>
        updateStep.mutate({ stepId: id, input: { status: 'skipped' } }),
      );
    },
    [updateStep],
  );
  const handleBulkDelete = useCallback(
    (stepIds: string[]) => {
      if (stepIds.length === 0) return;
      const label = stepIds.length === 1 ? '1 step' : `${stepIds.length} steps`;
      showConfirm(
        `Delete ${label}?`,
        'This removes them from your timeline. You can recreate any step from the source plan.',
        () => stepIds.forEach((id) => deleteStep.mutate(id)),
        { destructive: true, confirmText: 'Delete' },
      );
    },
    [deleteStep],
  );
  const handleUnsupportedBulkAction = useCallback(
    (actionId: 'move' | 'tag' | 'reschedule') => {
      const labels: Record<typeof actionId, string> = {
        move: 'Move',
        tag: 'Tag',
        reschedule: 'Reschedule',
      };
      showAlert(`${labels[actionId]} — coming soon`, 'Bulk this action lands in a follow-up pass.');
    },
    [],
  );

  // Section E (Frames 15–16). When the bulk Move button fires, hold the
  // selected step ids while the sheet is open so the move resolves
  // against the right set even after select-mode exits. The sheet's
  // dismiss clears the buffer.
  const [moveTargetIds, setMoveTargetIds] = useState<string[] | null>(null);
  const createSeason = useCreateSeason();
  const moveTargets = useMemo(
    () => buildMoveTargets(currentSeason, allSeasons),
    [currentSeason, allSeasons],
  );
  const handleBulkMove = useCallback((stepIds: string[]) => {
    if (stepIds.length > 0) setMoveTargetIds(stepIds);
  }, []);
  const handlePickSeason = useCallback(
    (seasonId: string) => {
      const ids = moveTargetIds ?? [];
      ids.forEach((id) => {
        const existing = steps.find((s) => s.id === id);
        const nextMeta = {
          ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
          season_id: seasonId,
        };
        updateStep.mutate({ stepId: id, input: { metadata: nextMeta } });
      });
      setMoveTargetIds(null);
    },
    [moveTargetIds, steps, updateStep],
  );
  const handleCreateSeason = useCallback(
    async (input: { name: string; start_date: string; end_date: string }) => {
      const year = new Date(input.start_date).getFullYear();
      const created = await createSeason.mutateAsync({
        name: input.name,
        start_date: input.start_date,
        end_date: input.end_date,
        year,
      });
      return created.id;
    },
    [createSeason],
  );

  // Frame 12 — Tag bulk picker entry. Same id-buffer pattern as Move.
  const [tagTargetIds, setTagTargetIds] = useState<string[] | null>(null);
  const existingTags = useMemo(() => {
    const set = new Set<string>();
    for (const s of steps) {
      if (s.category && s.category.trim()) set.add(s.category);
    }
    return Array.from(set);
  }, [steps]);
  const handleBulkTag = useCallback((stepIds: string[]) => {
    if (stepIds.length > 0) setTagTargetIds(stepIds);
  }, []);
  const handlePickTag = useCallback(
    (tag: string) => {
      const ids = tagTargetIds ?? [];
      ids.forEach((id) =>
        updateStep.mutate({ stepId: id, input: { category: tag } }),
      );
      setTagTargetIds(null);
    },
    [tagTargetIds, updateStep],
  );

  // Frame 12 — Schedule bulk picker entry. Shift mode preserves each
  // step's relative date offset; absolute mode collapses every step
  // to the same starts_at.
  const [scheduleTargetIds, setScheduleTargetIds] = useState<string[] | null>(null);
  const handleBulkSchedule = useCallback((stepIds: string[]) => {
    if (stepIds.length > 0) setScheduleTargetIds(stepIds);
  }, []);
  const handleApplyShift = useCallback(
    (days: number) => {
      const ids = scheduleTargetIds ?? [];
      const msPerDay = 24 * 60 * 60 * 1000;
      ids.forEach((id) => {
        const existing = steps.find((s) => s.id === id);
        if (!existing?.starts_at) return; // skip undated steps
        const next = new Date(
          new Date(existing.starts_at).getTime() + days * msPerDay,
        ).toISOString();
        updateStep.mutate({ stepId: id, input: { starts_at: next } });
      });
      setScheduleTargetIds(null);
    },
    [scheduleTargetIds, steps, updateStep],
  );
  const handleApplyAbsolute = useCallback(
    (isoDate: string) => {
      const ids = scheduleTargetIds ?? [];
      const next = new Date(`${isoDate}T00:00:00`).toISOString();
      ids.forEach((id) =>
        updateStep.mutate({ stepId: id, input: { starts_at: next } }),
      );
      setScheduleTargetIds(null);
    },
    [scheduleTargetIds, updateStep],
  );

  const hasContent = dataset.seasons.some((s) => s.bricks.length > 0);
  const signedInEmail = (user?.email as string | undefined) ?? null;

  // The empty + loading states keep the InterestHeader visible so the user
  // can still see which interest is selected, switch interests, and tap
  // their avatar. Previously the early-return swapped the entire screen
  // for an empty card and left the user with no controls.
  if (!hasContent && !showSample) {
    return (
      <SafeAreaView style={styles.surface} edges={['top']}>
        {/* No InterestSwitcher / InterestHeader here — the app chrome
            above already renders the interest pill (and mounts a
            switcher). Empty-state message references that chrome pill. */}
        <View style={styles.emptyWrap}>
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              {stepsLoading ? 'Loading your timeline…' : 'Nothing on the canvas yet'}
            </Text>
            {!stepsLoading ? (
              <Text style={styles.emptyText}>
                {currentInterest
                  ? `No steps in "${currentInterest.name}" yet. Add a step or switch interests from the pill above.`
                  : 'Add a step to your timeline and it will appear here. Pinch to zoom between Step, Week, Season, and Years.'}
              </Text>
            ) : null}

            {!stepsLoading ? (
              <Pressable
                style={styles.sampleBtn}
                onPress={() => setShowSample(true)}
              >
                <Ionicons name="sparkles-outline" size={14} color="#FFFFFF" />
                <Text style={styles.sampleBtnText}>Preview with sample data</Text>
              </Pressable>
            ) : null}

            {signedInEmail ? (
              <Text style={styles.signedInLine}>
                Signed in as <Text style={styles.signedInEmail}>{signedInEmail}</Text>
              </Text>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const activeDataset = showSample ? SAMPLE_DATASET : dataset;

  return (
    <SafeAreaView style={styles.surface} edges={['top']}>
      {showSample ? (
        <View style={styles.sampleBanner}>
          <Ionicons name="sparkles" size={12} color="#FFFFFF" />
          <Text style={styles.sampleBannerText}>
            Sample data · Emily Shaw, MSN
          </Text>
          <Pressable
            hitSlop={8}
            onPress={() => setShowSample(false)}
            style={styles.sampleBannerExit}
          >
            <Text style={styles.sampleBannerExitText}>Exit</Text>
          </Pressable>
        </View>
      ) : null}
      <TimelineZoomCanvas
        dataset={activeDataset}
        initialLevel={3}
        onOpenStepDetail={showSample ? undefined : handleOpenStepDetail}
        embedFullDetailAtL1={!showSample}
        onReorderStep={showSample ? undefined : handleReorderStep}
        onBulkArchive={showSample ? undefined : handleBulkArchive}
        onBulkDelete={showSample ? undefined : handleBulkDelete}
        onBulkMove={showSample ? undefined : handleBulkMove}
        onBulkTag={showSample ? undefined : handleBulkTag}
        onBulkSchedule={showSample ? undefined : handleBulkSchedule}
        onUnsupportedBulkAction={showSample ? undefined : handleUnsupportedBulkAction}
        hideInterestHeader
      />
      {!showSample ? (
        <>
          <MoveToSeasonSheet
            visible={moveTargetIds !== null}
            stepIds={moveTargetIds ?? []}
            seasons={moveTargets}
            onPickSeason={handlePickSeason}
            onCreateSeason={handleCreateSeason}
            onDismiss={() => setMoveTargetIds(null)}
          />
          <TagBulkSheet
            visible={tagTargetIds !== null}
            stepIds={tagTargetIds ?? []}
            existingTags={existingTags}
            onPickTag={handlePickTag}
            onDismiss={() => setTagTargetIds(null)}
          />
          <ScheduleBulkSheet
            visible={scheduleTargetIds !== null}
            stepIds={scheduleTargetIds ?? []}
            onApplyShift={handleApplyShift}
            onApplyAbsolute={handleApplyAbsolute}
            onDismiss={() => setScheduleTargetIds(null)}
          />
        </>
      ) : null}
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
  sampleBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: IOS_REGISTER.accentUserAction,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
  },
  sampleBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  signedInLine: {
    marginTop: 14,
    fontSize: 11,
    color: IOS_REGISTER.labelTertiary,
    textAlign: 'center',
  },
  signedInEmail: {
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
  },
  sampleBanner: {
    backgroundColor: '#1F1F1F',
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sampleBannerText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  sampleBannerExit: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sampleBannerExitText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
