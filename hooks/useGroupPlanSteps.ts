/**
 * useGroupPlanSteps — the attached plan's curated steps, in order, for the
 * group's shared prep timeline. These are the blueprint author's canonical
 * steps (not per-member copies), so every member sees the same sequence
 * converging on the group's goal anchor.
 *
 * Readable by members via the "Blueprint co-subscribers can view peer steps"
 * RLS policy (members are subscribed to the plan when it's attached/seeded),
 * so this is only enabled once the viewer is known to be a member.
 */

import { useQuery } from '@tanstack/react-query';
import { getBlueprintSteps } from '@/services/BlueprintService';
import type { TimelineStepRecord } from '@/types/timeline-steps';

export function useGroupPlanSteps(
  blueprintId: string | null | undefined,
  enabled: boolean,
) {
  return useQuery<TimelineStepRecord[]>({
    queryKey: ['group-plan-steps', blueprintId],
    enabled: Boolean(blueprintId) && enabled,
    staleTime: 30_000,
    queryFn: () => getBlueprintSteps(blueprintId as string),
  });
}
