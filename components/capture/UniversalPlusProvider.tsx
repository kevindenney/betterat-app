/**
 * <UniversalPlusProvider> — mounts the universal `+` sheet once at app root.
 *
 * Phase 2 · iOS register. Any tab can call `useUniversalPlus().open()` to
 * raise the sheet. The provider wires the sheet's callbacks to
 * QuickCaptureService + router + toast so call sites stay small.
 *
 * Behind PRACTICE_STEP_LOOP_IOS_REGISTER. When the flag is off, `open()` is
 * a no-op and `isAvailable` is false so callers can fall back to the legacy
 * new-step entry point.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/AppToast';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { logger } from '@/lib/logger';
import {
  buildQuickCaptureStepFields,
  buildRaceMetadata,
  createDraftStep,
  type QuickCapturePayload,
} from '@/services/QuickCaptureService';
import { useUserHomeVenue } from '@/hooks/useUserHomeVenue';
import { useCurrentSeason } from '@/hooks/useSeason';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import { StepAddSheet } from '@/components/ios-register/timeline-zoom/StepAddSheet';
import { InspirationWizard } from '@/components/inspiration/InspirationWizard';

const DONE_TIMELINE_STATUSES = new Set(['completed', 'done', 'settled', 'folded']);

function isDoneTimelineStep(step: Pick<TimelineStepRecord, 'status'>): boolean {
  return DONE_TIMELINE_STATUSES.has(String(step.status || '').toLowerCase());
}

function renumberTimelineStepsForInterest(
  steps: TimelineStepRecord[],
  interestId: string,
): TimelineStepRecord[] {
  let sortOrder = 0;
  return steps.map((step) => {
    if (step.interest_id !== interestId) return step;
    const next = { ...step, sort_order: sortOrder };
    sortOrder += 1;
    return next;
  });
}

function insertOptimisticNextUpStep(
  steps: TimelineStepRecord[] | undefined,
  optimisticStep: TimelineStepRecord,
): TimelineStepRecord[] {
  if (!steps || steps.length === 0) return [optimisticStep];
  if (steps.some((step) => step.id === optimisticStep.id)) return steps;

  return insertAtFirstActiveSlot(steps, optimisticStep);
}

function insertAtFirstActiveSlot(
  steps: TimelineStepRecord[],
  step: TimelineStepRecord,
): TimelineStepRecord[] {
  const withoutStep = steps.filter((candidate) => candidate.id !== step.id);
  const insertAt = withoutStep.findIndex((candidate) =>
    candidate.interest_id === step.interest_id && !isDoneTimelineStep(candidate)
  );
  const next = [...withoutStep];
  if (insertAt >= 0) {
    next.splice(insertAt, 0, step);
  } else {
    const lastSameInterestIndex = next.reduce(
      (lastIndex, candidate, index) => candidate.interest_id === step.interest_id ? index : lastIndex,
      -1,
    );
    next.splice(lastSameInterestIndex + 1, 0, step);
  }
  return renumberTimelineStepsForInterest(next, step.interest_id);
}

export interface UniversalPlusContextValue {
  open: () => void;
  close: () => void;
  /**
   * Create a step straight from a payload, bypassing the full composer sheet.
   * Lets surfaces (e.g. the Step-level Add sheet) author a blank step inline
   * and reuse the same optimistic-insert + toast + navigation pipeline.
   */
  submit: (payload: QuickCapturePayload) => Promise<void>;
  isAvailable: boolean;
}

const UniversalPlusContext = createContext<UniversalPlusContextValue>({
  open: () => undefined,
  close: () => undefined,
  submit: async () => undefined,
  isAvailable: false,
});

export function useUniversalPlus() {
  return useContext(UniversalPlusContext);
}

export function UniversalPlusProvider({ children }: { children: React.ReactNode }) {
  const enabled = FEATURE_FLAGS.PRACTICE_STEP_LOOP_IOS_REGISTER;
  const [visible, setVisible] = useState(false);
  const [inspirationVisible, setInspirationVisible] = useState(false);
  const toast = useToast();
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const queryClient = useQueryClient();
  const homeVenue = useUserHomeVenue();
  const { data: currentSeason } = useCurrentSeason();
  const isSailRacing = (currentInterest?.slug ?? '').toLowerCase() === 'sail-racing';

  const open = useCallback(() => {
    if (!enabled) return;
    setVisible(true);
  }, [enabled]);

  const close = useCallback(() => setVisible(false), []);

  const handleStartFromLink = useCallback(() => {
    setVisible(false);
    setInspirationVisible(true);
  }, []);

  const handleQuickCapture = useCallback(
    async (payload: QuickCapturePayload) => {
      if (!user?.id) {
        toast.show('Sign in before adding a step.', 'info');
        close();
        return;
      }
      if (!currentInterest?.id) {
        toast.show('Choose a specific interest before adding a step.', 'info');
        return;
      }
      const trimmed = payload.content.trim();
      if (!trimmed) {
        toast.show('Type or speak a step idea first.', 'info');
        return;
      }

      const interestId = currentInterest.id;
      const tempId = `temp-quick-${Date.now()}`;
      const nowIso = new Date().toISOString();
      const fields = buildQuickCaptureStepFields(payload);
      const optimisticStep: TimelineStepRecord = {
        id: tempId,
        user_id: user.id,
        interest_id: interestId,
        organization_id: null,
        program_session_id: null,
        source_type: 'manual',
        source_id: null,
        title: fields.title,
        description: fields.description,
        category: 'general',
        status: 'pending',
        starts_at: fields.startsAt,
        ends_at: null,
        location_name: fields.locationName,
        location_lat: fields.locationLat,
        location_lng: fields.locationLng,
        location_place_id: null,
        visibility: payload.visibility ?? 'private',
        share_approximate_location: false,
        copied_from_user_id: null,
        source_blueprint_id: null,
        is_race: payload.isRace ?? false,
        sort_order: Date.now(),
        metadata: {
          draft: true,
          capture_source: 'universal_plus_sheet',
          capture_kind: payload.kind,
          audio_uri: payload.audioUri ?? null,
          ...(payload.viewedSeasonId ? { season_id: payload.viewedSeasonId } : {}),
          ...(fields.plan ? { plan: fields.plan } : {}),
          ...buildRaceMetadata(payload.isRace ? payload.racePlan : undefined),
        },
        collaborator_user_ids: [],
        completed_at: null,
        due_at: null,
        is_timed: false,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const matchesMineQuery = (query: { queryKey: readonly unknown[] }) => {
        const key = query.queryKey;
        if (!Array.isArray(key) || key.length < 3) return false;
        if (key[0] !== 'timeline-steps' || key[1] !== 'mine') return false;
        const interestParam = key[2];
        if (interestParam === 'all') return true;
        if (typeof interestParam === 'string') {
          return interestParam.split(',').includes(interestId);
        }
        return false;
      };
      const currentTimelineKey = ['timeline-steps', 'mine', interestId] as const;

      queryClient.setQueriesData<TimelineStepRecord[]>(
        { predicate: matchesMineQuery },
        (old) => insertOptimisticNextUpStep(old, optimisticStep),
      );
      queryClient.setQueryData<TimelineStepRecord[]>(
        currentTimelineKey,
        (old) => insertOptimisticNextUpStep(old, optimisticStep),
      );
      queryClient.setQueryData(['timeline-steps', 'detail', tempId], optimisticStep);
      close();
      toast.show('Saving draft…', 'info');

      try {
        const savedStep = await createDraftStep({
          userId: user.id,
          interestId,
          payload,
          seasonId: currentSeason?.id ?? null,
        });
        queryClient.setQueriesData<TimelineStepRecord[]>(
          { predicate: matchesMineQuery },
          (old) => {
            if (!old) return old;
            const hasTemp = old.some((step) => step.id === tempId);
            const hasSaved = old.some((step) => step.id === savedStep.id);
            const replaced = hasTemp
              ? old.map((step) => (step.id === tempId ? savedStep : step))
              : hasSaved
                ? old
                : [...old, savedStep];
            return insertAtFirstActiveSlot(replaced, savedStep);
          },
        );
        queryClient.setQueryData<TimelineStepRecord[]>(
          currentTimelineKey,
          (old) => {
            if (!old) return [savedStep];
            const hasTemp = old.some((step) => step.id === tempId);
            const hasSaved = old.some((step) => step.id === savedStep.id);
            const replaced = hasTemp
              ? old.map((step) => (step.id === tempId ? savedStep : step))
              : hasSaved
                ? old
                : [...old, savedStep];
            return insertAtFirstActiveSlot(replaced, savedStep);
          },
        );
        queryClient.removeQueries({ queryKey: ['timeline-steps', 'detail', tempId] });
        queryClient.setQueryData(['timeline-steps', 'detail', savedStep.id], savedStep);
        void queryClient.invalidateQueries({ queryKey: ['timeline-steps', 'mine'] });
        toast.show('Draft saved', 'success');
        // Route to the Practice tab's carousel centered on the new step.
        router.setParams({ selected: savedStep.id });
        router.navigate({
          pathname: '/(tabs)/races',
          params: { selected: savedStep.id },
        } as any);
      } catch (err) {
        queryClient.setQueriesData<TimelineStepRecord[]>(
          { predicate: matchesMineQuery },
          (old) => (old ? old.filter((step) => step.id !== tempId) : old),
        );
        queryClient.setQueryData<TimelineStepRecord[]>(
          currentTimelineKey,
          (old) => (old ? old.filter((step) => step.id !== tempId) : old),
        );
        queryClient.removeQueries({ queryKey: ['timeline-steps', 'detail', tempId] });
        logger.error('Quick-capture draft creation failed', err);
        toast.show('Could not save draft. Try again.', 'error');
      }
    },
    [user?.id, currentInterest?.id, currentSeason?.id, queryClient, toast, close],
  );


  const value = useMemo<UniversalPlusContextValue>(
    () => ({ open, close, submit: handleQuickCapture, isAvailable: enabled }),
    [open, close, handleQuickCapture, enabled],
  );

  return (
    <UniversalPlusContext.Provider value={value}>
      {children}
      {enabled ? (
        <StepAddSheet
          visible={visible}
          onClose={close}
          onSave={handleQuickCapture}
          onStartFromLink={handleStartFromLink}
          showRaceSelector={isSailRacing}
          venueId={isSailRacing ? homeVenue?.id ?? null : null}
          venueName={isSailRacing ? homeVenue?.venue ?? null : null}
        />
      ) : null}
      <InspirationWizard
        visible={inspirationVisible}
        onClose={() => setInspirationVisible(false)}
      />
    </UniversalPlusContext.Provider>
  );
}
