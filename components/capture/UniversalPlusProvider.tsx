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
  createDraftStep,
  dropInsight,
  type QuickCapturePayload,
} from '@/services/QuickCaptureService';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import { UniversalPlusSheet } from './UniversalPlusSheet';

export interface UniversalPlusContextValue {
  open: () => void;
  close: () => void;
  isAvailable: boolean;
}

const UniversalPlusContext = createContext<UniversalPlusContextValue>({
  open: () => undefined,
  close: () => undefined,
  isAvailable: false,
});

export function useUniversalPlus() {
  return useContext(UniversalPlusContext);
}

export function UniversalPlusProvider({ children }: { children: React.ReactNode }) {
  const enabled = FEATURE_FLAGS.PRACTICE_STEP_LOOP_IOS_REGISTER;
  const [visible, setVisible] = useState(false);
  const toast = useToast();
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const queryClient = useQueryClient();

  const open = useCallback(() => {
    if (!enabled) return;
    setVisible(true);
  }, [enabled]);

  const close = useCallback(() => setVisible(false), []);

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
      const optimisticStep: TimelineStepRecord = {
        id: tempId,
        user_id: user.id,
        interest_id: interestId,
        organization_id: null,
        program_session_id: null,
        source_type: 'manual',
        source_id: null,
        title: trimmed,
        description: null,
        category: 'general',
        status: 'pending',
        starts_at: null,
        ends_at: null,
        location_name: null,
        location_lat: null,
        location_lng: null,
        location_place_id: null,
        visibility: 'private',
        share_approximate_location: false,
        copied_from_user_id: null,
        source_blueprint_id: null,
        sort_order: Date.now(),
        metadata: {
          draft: true,
          capture_source: 'universal_plus_sheet',
          capture_kind: payload.kind,
          audio_uri: payload.audioUri ?? null,
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
        (old) => {
          if (!old) return old;
          if (old.some((step) => step.id === tempId)) return old;
          return [...old, optimisticStep];
        },
      );
      queryClient.setQueryData<TimelineStepRecord[]>(
        currentTimelineKey,
        (old) => {
          if (!old) return [optimisticStep];
          if (old.some((step) => step.id === tempId)) return old;
          return [...old, optimisticStep];
        },
      );
      queryClient.setQueryData(['timeline-steps', 'detail', tempId], optimisticStep);
      close();
      toast.show('Saving draft…', 'info');

      try {
        const savedStep = await createDraftStep({
          userId: user.id,
          interestId,
          payload,
        });
        queryClient.setQueriesData<TimelineStepRecord[]>(
          { predicate: matchesMineQuery },
          (old) => {
            if (!old) return old;
            const hasTemp = old.some((step) => step.id === tempId);
            const hasSaved = old.some((step) => step.id === savedStep.id);
            if (!hasTemp) return hasSaved ? old : [...old, savedStep];
            return old.map((step) => (step.id === tempId ? savedStep : step));
          },
        );
        queryClient.setQueryData<TimelineStepRecord[]>(
          currentTimelineKey,
          (old) => {
            if (!old) return [savedStep];
            const hasTemp = old.some((step) => step.id === tempId);
            const hasSaved = old.some((step) => step.id === savedStep.id);
            if (!hasTemp) return hasSaved ? old : [...old, savedStep];
            return old.map((step) => (step.id === tempId ? savedStep : step));
          },
        );
        queryClient.removeQueries({ queryKey: ['timeline-steps', 'detail', tempId] });
        queryClient.setQueryData(['timeline-steps', 'detail', savedStep.id], savedStep);
        void queryClient.invalidateQueries({ queryKey: ['timeline-steps', 'mine'] });
        toast.show('Draft saved', 'success');
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
    [user?.id, currentInterest?.id, queryClient, toast, close],
  );

  const handleDropConcept = useCallback(
    async (payload: QuickCapturePayload) => {
      if (!user?.id) {
        toast.show('Sign in to save concepts.', 'info');
        close();
        return;
      }
      const isEmpty = payload.content.trim().length === 0 && !payload.audioUri;
      if (isEmpty) {
        // Empty-tap variant: the row was tapped before the user wrote
        // anything. Surface a hint so they know what to do next.
        toast.show('Type or speak a concept above first.', 'info');
        return;
      }
      try {
        await dropInsight({
          userId: user.id,
          interestId: currentInterest?.id ?? null,
          payload,
        });
        if (currentInterest?.id) {
          void queryClient.invalidateQueries({
            queryKey: ['playbook-insights', user.id, currentInterest.id],
          });
        }
        router.push('/(tabs)/playbook' as any);
        toast.show('Concept saved to Playbook', 'success');
      } catch (err) {
        logger.error('Concept drop failed', err);
        toast.show('Could not save concept. Try again.', 'error');
      } finally {
        close();
      }
    },
    [user?.id, currentInterest?.id, toast, close, queryClient],
  );

  const handleNavigate = useCallback(
    (path: string) => {
      close();
      router.push(path as any);
    },
    [close],
  );

  const value = useMemo<UniversalPlusContextValue>(
    () => ({ open, close, isAvailable: enabled }),
    [open, close, enabled],
  );

  return (
    <UniversalPlusContext.Provider value={value}>
      {children}
      {enabled ? (
        <UniversalPlusSheet
          visible={visible}
          onDismiss={close}
          onQuickCapture={handleQuickCapture}
          onAddFromBlueprint={() => handleNavigate('/playbook/blueprints')}
          onAddFromFollow={() => handleNavigate('/discover/following')}
          onDropConcept={handleDropConcept}
          onShareIdea={() => handleNavigate('/share/idea')}
        />
      ) : null}
    </UniversalPlusContext.Provider>
  );
}
