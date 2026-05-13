/**
 * usePriorStepObservation
 *
 * Returns the most recent observation from the user's previous completed step
 * in the same interest. Used by the During tab's "From last time you …"
 * ambient surface (redesign commit 6c, mockup 14).
 *
 * Scoping notes:
 * - Filters to the same `interest_id` only; condition-matching (wind, venue)
 *   is deferred until structured `date_enrichment` is reliably present on
 *   prior steps.
 * - Excludes the current step.
 * - Picks the most recent *observation* (not the most recent *step*) so
 *   shorter follow-up sessions still surface the freshest reflection.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import type { Observation } from '@/types/step-detail';

export interface PriorObservationResult {
  observation: Observation;
  stepId: string;
  stepTitle: string;
  stepCompletedAt: string; // ISO
}

export function usePriorStepObservation(args: {
  currentStepId: string | null | undefined;
  userId: string | null | undefined;
  interestId: string | null | undefined;
}) {
  const { currentStepId, userId, interestId } = args;
  const enabled = !!currentStepId && !!userId && !!interestId;

  return useQuery<PriorObservationResult | null>({
    queryKey: ['prior-step-observation', userId, interestId, currentStepId],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('timeline_steps')
        .select('id, title, metadata, updated_at')
        .eq('user_id', userId!)
        .eq('interest_id', interestId!)
        .eq('status', 'completed')
        .neq('id', currentStepId!)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error || !data) return null;

      for (const row of data) {
        const act = (row.metadata as any)?.act ?? {};
        const observations = Array.isArray(act.observations) ? (act.observations as Observation[]) : [];
        if (observations.length === 0) continue;
        // Pick the latest observation on this step by timestamp.
        const latest = [...observations].sort((a, b) => {
          const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return tb - ta;
        })[0];
        if (!latest) continue;
        return {
          observation: latest,
          stepId: row.id,
          stepTitle: row.title,
          stepCompletedAt: row.updated_at,
        };
      }
      return null;
    },
  });
}
