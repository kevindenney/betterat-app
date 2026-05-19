/**
 * useContinueToNextBlueprintStep — Phase 10 PR-4 §A-phase-6 Continue CTA.
 *
 * Given a blueprint + the next blueprint step (sourceStepId), this hook
 * returns a callback that:
 *   1. Adopts the next step into the viewer's timeline if not already
 *      adopted (via TimelineStepService.adoptStep).
 *   2. Pre-warms a step_user_progress 'planned' marker so it shows up
 *      "IN PLAN" everywhere immediately (mirrors PR 1's adoption flow).
 *   3. Routes the user into the just-adopted step using the same
 *      route the chrome's trophy strip already uses, so they land on
 *      a familiar surface.
 *
 * Idempotent — calling it twice for the same next step is safe.
 */

import { useCallback } from 'react';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adoptStep } from '@/services/TimelineStepService';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface UseContinueInput {
  blueprintId: string | null | undefined;
  interestId: string | null | undefined;
  /** Original blueprint step's id (NOT an adopted copy). */
  nextSourceStepId: string | null | undefined;
  /** Adopted copy id if one already exists (skip adoption). */
  alreadyAdoptedStepId?: string | null;
}

export function useContinueToNextBlueprintStep({
  blueprintId,
  interestId,
  nextSourceStepId,
  alreadyAdoptedStepId,
}: UseContinueInput) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Sign in to continue.');
      if (!blueprintId || !interestId || !nextSourceStepId) {
        throw new Error('Next step is missing required context.');
      }

      let adoptedStepId = alreadyAdoptedStepId ?? null;
      if (!adoptedStepId) {
        const adopted = await adoptStep(
          user.id,
          nextSourceStepId,
          interestId,
          blueprintId,
        );
        adoptedStepId = adopted.id;
        // Mark the adopted step as planned in step_user_progress so it
        // shows "IN PLAN" everywhere immediately (matches PR 1 flow).
        try {
          await supabase.from('step_user_progress').upsert(
            {
              user_id: user.id,
              step_id: nextSourceStepId,
              status: 'planned',
            },
            { onConflict: 'user_id,step_id' },
          );
        } catch {
          // Non-fatal — the navigation still works; In-Plan indicator just
          // catches up on the next refresh.
        }
      }
      return adoptedStepId;
    },
    onSuccess: () => {
      // Refresh the caches that drive Blueprint Index + chrome + fleet so
      // the new step's "IN PLAN" / Step-N-of-M reflect immediately.
      queryClient.invalidateQueries({ queryKey: ['blueprint-index'] });
      queryClient.invalidateQueries({ queryKey: ['step-blueprint-chrome'] });
      queryClient.invalidateQueries({ queryKey: ['blueprint-peers'] });
      queryClient.invalidateQueries({ queryKey: ['step-complete-celebration'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
    },
  });

  const handleContinue = useCallback(async () => {
    try {
      const adoptedStepId = await mutation.mutateAsync();
      router.push(`/step/${adoptedStepId}` as any);
    } catch (err) {
      // Logged via mutation.error; no further action — the celebration
      // surface remains visible so the user can retry.
      // eslint-disable-next-line no-console
      console.warn('[continue-next-step]', err);
    }
  }, [mutation]);

  return {
    handleContinue,
    isContinuing: mutation.isPending,
    error: mutation.error,
  };
}
