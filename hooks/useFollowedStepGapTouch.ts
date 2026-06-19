/**
 * useFollowedStepGapTouch — "this step from someone you follow exercises a
 * capability you're weak at."
 *
 * Given the viewer's coverage for their *active* interest (the same
 * `InterestCapabilityCoverage` the Atlas Capabilities surface renders) and a
 * set of followed step ids, this resolves which of those steps evidence a
 * competency the viewer has NOT yet evidenced — i.e. touches one of their
 * gaps — and returns the gap *categories* each step touches.
 *
 * This is the gap-aware multiplier on the Watch feed: it turns a chronological
 * river of followed activity into "who is working on the things I'm weakest
 * at?" Scoped to the active interest, because "your gaps" is only well-defined
 * against the framework you're currently working in.
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/services/supabase';
import type { InterestCapabilityCoverage } from '@/hooks/useInterestCapabilityCoverage';

export const FOLLOWED_STEP_GAP_TOUCH_KEY = 'followed-step-gap-touch';

/** Map of stepId → the viewer's gap categories that step evidences. */
export type StepGapTouch = Map<string, string[]>;

type AttemptRow = { event_id: string | null; competency_id: string };

export function useFollowedStepGapTouch(
  interestId: string | null | undefined,
  coverage: InterestCapabilityCoverage | null,
  stepIds: string[],
): StepGapTouch {
  // Stable key piece: the set of steps we're asking about.
  const stepKey = [...stepIds].sort().join(',');

  const query = useQuery({
    queryKey: [FOLLOWED_STEP_GAP_TOUCH_KEY, interestId ?? null, stepKey],
    // Only meaningful against a real (non-general) framework with steps to test.
    enabled:
      Boolean(interestId) &&
      Boolean(coverage) &&
      coverage?.isGeneralFramework === false &&
      stepIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<StepGapTouch> => {
      const result: StepGapTouch = new Map();
      if (!coverage) return result;

      // Build the viewer's gap set + a competency→category index from the
      // coverage we already have — no extra framework/attempt round-trip.
      const gapCompetencyIds = new Set<string>();
      const categoryOfComp = new Map<string, string>();
      for (const cat of coverage.byCategory) {
        for (const comp of cat.competencies) {
          categoryOfComp.set(comp.id, cat.category);
          if (!comp.evidenced) gapCompetencyIds.add(comp.id);
        }
      }
      if (gapCompetencyIds.size === 0) return result;

      // Which of the followed steps evidence one of those gap competencies?
      // event_id is the step id; a step's attempts belong to its author, so
      // filtering by event_id + gap competency yields exactly the gaps each
      // followed step touches.
      const { data, error } = await supabase
        .from('betterat_competency_attempts')
        .select('event_id, competency_id')
        .in('event_id', stepIds)
        .in('competency_id', Array.from(gapCompetencyIds));
      if (error) {
        console.warn('[useFollowedStepGapTouch] attempts query failed', error);
        return result;
      }

      const perStep = new Map<string, Set<string>>();
      for (const a of (data ?? []) as AttemptRow[]) {
        if (!a.event_id) continue;
        const category = categoryOfComp.get(a.competency_id);
        if (!category) continue;
        let set = perStep.get(a.event_id);
        if (!set) {
          set = new Set();
          perStep.set(a.event_id, set);
        }
        set.add(category);
      }
      for (const [stepId, cats] of perStep) {
        result.set(stepId, Array.from(cats).sort());
      }
      return result;
    },
  });

  return query.data ?? new Map();
}
