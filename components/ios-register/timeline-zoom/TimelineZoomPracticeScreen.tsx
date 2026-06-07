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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/services/supabase';
import { resequenceTimelineSortOrders } from '@/services/TimelineStepService';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { useMyTimeline, useUpdateStep, useDeleteStep } from '@/hooks/useTimelineSteps';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useCurrentSeason, useUserSeasons, useCreateSeason, useUpdateSeason, useArchiveSeason } from '@/hooks/useSeason';
import { useSubscribedBlueprints, useBlueprintWithAuthor } from '@/hooks/useBlueprint';
import { useStepCapabilityEvidence } from '@/hooks/useStepCapabilityEvidence';
import { useInterestVision } from '@/hooks/useInterestVision';
import { useActivePlan } from '@/hooks/usePlan';
import { useStepPeerReflections } from '@/hooks/useStepPeerReflections';
import { useStepSuggestionsForRange } from '@/hooks/useStepSuggestionsForRange';
import { SeasonEditSheet } from './SeasonEditSheet';
import type { CreateSeasonInput, UpdateSeasonInput, Season, SeasonListItem } from '@/types/season';

import { TimelineZoomCanvas } from './TimelineZoomCanvas';
import type { ZoomLevel } from './types';
import {
  mapToTimelineDataset,
  type BlueprintLookup,
  type BusinessOutcomeInput,
  type CompetencyProgressInput,
} from './realDataAdapter';
import { resolveInterestVocab } from './interestVocab';
import { MoveToSeasonSheet, buildMoveTargets } from './MoveToSeasonSheet';
import { TagBulkSheet } from './TagBulkSheet';
import { ScheduleBulkSheet } from './ScheduleBulkSheet';
import { useStarterStepSeed } from '@/hooks/useStarterStepSeed';
import { useUniversalPlus } from '@/components/capture/UniversalPlusProvider';

// Below this many steps a user hasn't built up enough of an arc for the L3
// summary view to be meaningful, so we land them at L2 (week timeline).
const ARC_LANDING_MIN_STEPS = 5;

export function TimelineZoomPracticeScreen() {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const searchParams = useLocalSearchParams<{
    selected?: string | string[];
    level?: string | string[];
  }>();
  // Route may carry ?level=2|3|4 from a deep-link (Step detail's zoom rail
  // pushes here to "zoom out" from a step). Bound to the canvas's
  // initialLevel. Legacy ?level=2 (WEEK) now lands on the merged Step view (1).
  const routeLevel = useMemo<ZoomLevel | null>(() => {
    const raw = Array.isArray(searchParams?.level) ? searchParams.level[0] : searchParams?.level;
    const n = raw ? Number(raw) : NaN;
    if (n === 2) return 1;
    return n === 1 || n === 3 || n === 4 ? (n as ZoomLevel) : null;
  }, [searchParams?.level]);

  const interestId = currentInterest?.id ?? null;
  const selectedStepId = useMemo(() => {
    if (typeof searchParams.selected === 'string' && searchParams.selected.trim()) {
      return searchParams.selected;
    }
    if (Array.isArray(searchParams.selected)) {
      const first = searchParams.selected.find((value) => typeof value === 'string' && value.trim());
      return first;
    }
    return undefined;
  }, [searchParams.selected]);
  const { data: steps = [], isLoading: stepsLoading } = useMyTimeline(interestId);
  // A ?selected= id from the route only lands the user at the step-detail
  // level if it still resolves to a loaded step. A stale selection (the step
  // was deleted, or the starter step was reseeded with a new id) would
  // otherwise strand them on a dead-end "Step not found" at level 1 whose
  // only escape is the zoom rail. The canvas mounts only once steps are
  // loaded, so this resolves correctly on first paint.
  const resolvedSelectedStepId = useMemo(() => {
    if (!selectedStepId) return undefined;
    return steps.some((s) => s.id === selectedStepId) ? selectedStepId : undefined;
  }, [selectedStepId, steps]);
  // Default landing depth is L3 (ARC summary), but that view's scaffolding —
  // vision, reflections, capability spread — reads as empty filler before a
  // user has built up an arc. Newcomers with only a handful of steps land at
  // the Step view (1) instead: their current card with prev/next peeks, where
  // the structure is self-evident. An explicit ?level= deep-link always wins —
  // except a stale level=1 with no resolvable step, which falls through.
  const initialLevelFromRoute = useMemo<ZoomLevel>(() => {
    if (routeLevel && routeLevel !== 1) return routeLevel;
    if (resolvedSelectedStepId) return 1;
    return steps.length < ARC_LANDING_MIN_STEPS ? 1 : 3;
  }, [routeLevel, resolvedSelectedStepId, steps.length]);
  const { data: currentSeason = null } = useCurrentSeason();
  const { data: allSeasons = [] } = useUserSeasons();
  const seasonRecords = useMemo(
    () => allSeasons.map(projectSeasonListItem),
    [allSeasons],
  );
  const { data: subscribedBlueprints = [] } = useSubscribedBlueprints(interestId);
  const stepIdsForEvidence = useMemo(() => steps.map((s) => s.id), [steps]);
  const { data: stepEvidenceMap } = useStepCapabilityEvidence(stepIdsForEvidence);
  // INPUT lane data — step_suggestions involving the viewer within this
  // arc's date range. The hook returns [] when arguments are missing, so
  // the L3 chart simply doesn't get extra peers until a season is loaded.
  const { data: suggestionInputs = [] } = useStepSuggestionsForRange({
    viewerUserId: user?.id ?? null,
    rangeStart: currentSeason?.start_date ?? null,
    rangeEnd: currentSeason?.end_date ?? null,
  });
  // INPUT channel 5 — peer_reflections. target_step_id directly links
  // a reflection to one of the viewer's steps, so the chart can place
  // the reflecting peer at that step's week without date projection.
  const { data: stepReflectionsMap } = useStepPeerReflections(stepIdsForEvidence);
  // Vision lives on the active plan — the user's tailored journey.
  // useInterestVision stays as a fallback for users who haven't been
  // migrated to a plan yet (and as the legacy write path); the
  // backfill SQL copies user_interests.vision_* onto a plan, so for
  // most accounts the activePlan branch wins.
  const { data: interestVision } = useInterestVision(interestId);
  const { data: activePlan } = useActivePlan(interestId);

  // D11 headline (entrepreneur only) — weekly turnover from
  // business_outcomes. Decoupled self-contained query so the adapter
  // can author the EARNINGS headline from real revenue. Gated on the
  // resolved vocab so sailors / nurses never issue this read.
  const interestVocab = useMemo(
    () =>
      resolveInterestVocab(
        interestId,
        currentInterest?.name ?? null,
        currentInterest?.slug ?? null,
      ),
    [interestId, currentInterest?.name, currentInterest?.slug],
  );
  const isEntrepreneur = interestVocab.id === 'entrepreneur';
  const { data: businessOutcomes = [] } = useQuery<BusinessOutcomeInput[]>({
    queryKey: ['business-outcomes-headline', user?.id ?? 'none'],
    enabled: Boolean(user?.id) && isEntrepreneur,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_outcomes')
        .select('week_start, revenue_minor, currency')
        .eq('user_id', user!.id)
        .order('week_start', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        weekStart: row.week_start,
        revenueMinor: row.revenue_minor,
        currency: row.currency,
      }));
    },
  });
  // PROGRAM headline (nursing only) — preceptor attestations from the
  // real betterat_competency_progress table, joined to the framework so
  // the lifetime denominator is the full competency catalogue for this
  // interest. Two cheap reads, gated on the resolved vocab so other
  // personas never issue them.
  const isNursing = interestVocab.id === 'nursing';
  const { data: competencyProgress } = useQuery<CompetencyProgressInput>({
    queryKey: ['competency-progress-headline', user?.id ?? 'none', interestId],
    enabled: Boolean(user?.id) && isNursing,
    staleTime: 60_000,
    queryFn: async () => {
      const [{ count, error: countError }, { data: rows, error: rowsError }] =
        await Promise.all([
          supabase
            .from('betterat_competencies')
            .select('id', { count: 'exact', head: true })
            .eq('interest_id', interestId),
          supabase
            .from('betterat_competency_progress')
            .select(
              'status, validated_at, last_attempt_at, betterat_competencies!inner(interest_id)',
            )
            .eq('user_id', user!.id)
            .eq('betterat_competencies.interest_id', interestId),
        ]);
      if (countError) throw countError;
      if (rowsError) throw rowsError;
      return {
        totalCompetencies: count ?? 0,
        rows: (rows ?? []).map((row) => ({
          status: row.status,
          validatedAt: row.validated_at,
          lastAttemptAt: row.last_attempt_at,
        })),
      };
    },
  });

  const effectiveVision = useMemo(() => {
    if (activePlan) {
      return {
        statement: activePlan.vision_statement,
        // Lifetime vision lives on user_interests, not on a plan, so
        // the plan path still reads it from the interest-level row.
        lifetimeStatement: interestVision?.lifetime_vision_statement ?? null,
        competencyIds: activePlan.vision_competency_ids,
      };
    }
    if (interestVision) {
      return {
        statement: interestVision.vision_statement,
        lifetimeStatement: interestVision.lifetime_vision_statement ?? null,
        competencyIds: interestVision.vision_competency_ids,
      };
    }
    return undefined;
  }, [activePlan, interestVision]);

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
      map.set(bp.blueprint_id, {
        title: bp.blueprint_title,
        author_name: bp.author_name ?? undefined,
      });
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
        interestId,
        interestLabel: currentInterest?.name ?? 'Practice',
        interestSlug: currentInterest?.slug ?? null,
        user: {
          id: user?.id ?? null,
          initials: userInitials,
          color: currentInterest?.accent_color || '#7BA0C4',
        },
        currentSeason,
        allSeasons: seasonRecords,
        steps,
        focusStepId: resolvedSelectedStepId,
        blueprintsById,
        stepEvidenceMap,
        suggestionInputs,
        stepReflectionsMap,
        interestVision: effectiveVision,
        activePlanId: activePlan?.id ?? null,
        businessOutcomes,
        competencyProgress,
      }),
    [
      interestId,
      currentInterest,
      user?.id,
      userInitials,
      currentSeason,
      seasonRecords,
      steps,
      resolvedSelectedStepId,
      blueprintsById,
      stepEvidenceMap,
      suggestionInputs,
      stepReflectionsMap,
      effectiveVision,
      activePlan?.id,
      businessOutcomes,
      competencyProgress,
    ],
  );

  const handleOpenStepDetail = useCallback((stepId: string) => {
    router.push(`/step/${stepId}` as never);
  }, []);

  // Section D drag-reorder — the view resolves the post-drop neighbor
  // step ids (beforeStepId = the lower-sort_order neighbour, afterStepId =
  // the higher one) and hands them here. Neighbor-id (not index) lets both
  // L2 and L3 share this handler without the owner needing to know which
  // view called.
  //
  // We resequence sort_order = index over the whole interest rather than
  // writing a midpoint value. sort_order is an integer column and seeded /
  // race-cluster steps frequently land on consecutive integers (or all on
  // 0), so a midpoint between two neighbours has no room and silently
  // collides — the drop wouldn't land. Index resequencing always has room.
  const updateStep = useUpdateStep();
  const queryClient = useQueryClient();
  const handleReorderStep = useCallback(
    (stepId: string, beforeStepId: string | null, afterStepId: string | null) => {
      if (!steps.some((s) => s.id === stepId)) return;

      const ordered = [...steps]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => s.id)
        .filter((id) => id !== stepId);

      let insertAt: number;
      if (afterStepId) {
        const idx = ordered.indexOf(afterStepId);
        insertAt = idx >= 0 ? idx : ordered.length;
      } else if (beforeStepId) {
        const idx = ordered.indexOf(beforeStepId);
        insertAt = idx >= 0 ? idx + 1 : ordered.length;
      } else {
        return; // no neighbors at all = no list = nothing to do
      }

      ordered.splice(insertAt, 0, stepId);

      const unchanged =
        ordered.length === steps.length &&
        ordered.every((id, i) => {
          const s = steps.find((st) => st.id === id);
          return s?.sort_order === i;
        });
      if (unchanged) return;

      void resequenceTimelineSortOrders(ordered)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
          queryClient.invalidateQueries({ queryKey: ['user-atlas-steps'] });
        })
        .catch(() => {
          showAlert('Could not reorder', 'The step order could not be saved. Please try again.');
        });
    },
    [steps, queryClient],
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
  const updateSeasonMutation = useUpdateSeason();
  const archiveSeasonMutation = useArchiveSeason();

  // Season add/edit sheet — opened from L3 picker footer + L4 BROWSE ARCS
  // header. The sheet handles both modes via the same form; we resolve
  // the underlying Season record from the id when editing.
  const [seasonSheetState, setSeasonSheetState] = useState<
    { mode: 'add' } | { mode: 'edit'; season: Season } | null
  >(null);
  const handleAddArc = useCallback(() => setSeasonSheetState({ mode: 'add' }), []);
  const handleEditArc = useCallback(
    (arcId: string) => {
      const season = seasonRecords.find((s) => s.id === arcId);
      if (season) setSeasonSheetState({ mode: 'edit', season });
    },
    [seasonRecords],
  );
  const handleSeasonCreate = useCallback(
    async (input: CreateSeasonInput) => {
      await createSeason.mutateAsync(input);
    },
    [createSeason],
  );
  const handleSeasonUpdate = useCallback(
    async (seasonId: string, input: UpdateSeasonInput) => {
      await updateSeasonMutation.mutateAsync({ seasonId, input });
    },
    [updateSeasonMutation],
  );
  const handleSeasonArchive = useCallback(
    async (seasonId: string) => {
      await archiveSeasonMutation.mutateAsync(seasonId);
    },
    [archiveSeasonMutation],
  );
  const moveTargets = useMemo(
    () => buildMoveTargets(currentSeason, seasonRecords),
    [currentSeason, seasonRecords],
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

  // Auto-seed a starter step the first time a user lands on an interest
  // with zero steps. Race-safe (claim-then-insert via UPDATE predicate)
  // and one-shot (the seed timestamp on user_interests is never cleared
  // — if the user deletes the starter, we don't re-seed).
  useStarterStepSeed({
    interestId,
    interestSlug: currentInterest?.slug ?? null,
    hasZeroSteps: !stepsLoading && steps.length === 0,
    stepsLoading,
  });

  // Safety net: the auto-seed can silently no-op (a dropped session, a
  // race, or an interest already stamped but missing its step). Without an
  // escape hatch the Practice tab would spin on "Setting up…" forever. After
  // a short grace period with still no content, surface a manual CTA so the
  // user is never trapped. The happy path (fast seed) clears before the timer.
  const plus = useUniversalPlus();
  const [seedGraceElapsed, setSeedGraceElapsed] = useState(false);
  useEffect(() => {
    if (hasContent || stepsLoading) {
      setSeedGraceElapsed(false);
      return;
    }
    const t = setTimeout(() => setSeedGraceElapsed(true), 6000);
    return () => clearTimeout(t);
  }, [hasContent, stepsLoading, interestId]);

  // Brief loading shim while the seeder runs OR while step query is in flight.
  if (!hasContent) {
    return (
      <SafeAreaView style={styles.surface} edges={['top']}>
        <View style={styles.emptyWrap}>
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              {stepsLoading ? 'Loading your timeline…' : 'Setting up your starter step…'}
            </Text>
            {signedInEmail ? (
              <Text style={styles.signedInLine}>
                Signed in as <Text style={styles.signedInEmail}>{signedInEmail}</Text>
              </Text>
            ) : null}
            {!stepsLoading && seedGraceElapsed ? (
              <View style={styles.emptyFallback}>
                <Text style={styles.emptyFallbackHint}>
                  Taking longer than expected.
                </Text>
                <TouchableOpacity
                  style={styles.emptyCta}
                  onPress={() => plus.open()}
                  accessibilityRole="button"
                >
                  <Text style={styles.emptyCtaText}>Add your first step</Text>
                </TouchableOpacity>
              </View>
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
        initialLevel={initialLevelFromRoute}
        routeFocusStepId={resolvedSelectedStepId}
        onOpenStepDetail={handleOpenStepDetail}
        embedFullDetailAtL1
        onReorderStep={handleReorderStep}
        onBulkArchive={handleBulkArchive}
        onBulkDelete={handleBulkDelete}
        onBulkMove={handleBulkMove}
        onBulkTag={handleBulkTag}
        onBulkSchedule={handleBulkSchedule}
        onUnsupportedBulkAction={handleUnsupportedBulkAction}
        onAddArc={handleAddArc}
        onEditArc={handleEditArc}
        hideInterestHeader
      />
      <SeasonEditSheet
        visible={seasonSheetState !== null}
        periodNoun={interestVocab.periodNoun}
        mode={seasonSheetState?.mode ?? 'add'}
        season={seasonSheetState?.mode === 'edit' ? seasonSheetState.season : null}
        onClose={() => setSeasonSheetState(null)}
        onCreate={handleSeasonCreate}
        onUpdate={handleSeasonUpdate}
        onArchive={handleSeasonArchive}
      />
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
    </SafeAreaView>
  );
}

function projectSeasonListItem(season: SeasonListItem): Season {
  return {
    id: season.id,
    name: season.name,
    short_name: season.short_name,
    year: season.year,
    start_date: season.start_date,
    end_date: season.end_date,
    status: season.status,
    created_at: '',
    updated_at: '',
  };
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
  emptyFallback: {
    marginTop: 16,
    alignItems: 'center',
    gap: 10,
  },
  emptyFallbackHint: {
    fontSize: 13,
    color: IOS_REGISTER.labelTertiary,
    textAlign: 'center',
  },
  emptyCta: {
    backgroundColor: IOS_REGISTER.accentUserAction,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
