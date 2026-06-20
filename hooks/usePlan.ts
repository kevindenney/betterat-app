/**
 * usePlan — read/write hooks for the Plan first-class entity.
 *
 * useActivePlan(interestId) is the workhorse: returns the viewer's
 * most recently started active plan for that interest, or null when
 * they don't have one yet. Used by L3 to source vision/competency
 * anchors.
 *
 * useUpdatePlan handles vision edits (and any other plan field
 * updates) with proper cache invalidation across both the per-plan
 * detail key and the per-interest list key.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { isUuid } from '@/utils/uuid';
import {
  PlanService,
  type Plan,
  type CreatePlanInput,
  type UpdatePlanInput,
} from '@/services/PlanService';

const STALE_MS = 30_000;

export const planKeys = {
  all: ['plans'] as const,
  byInterest: (userId: string | undefined, interestId: string | undefined) =>
    ['plans', 'by-interest', userId ?? 'anon', interestId ?? 'none'] as const,
  activeByInterest: (userId: string | undefined, interestId: string | undefined) =>
    ['plans', 'active', userId ?? 'anon', interestId ?? 'none'] as const,
};

export function usePlans(interestId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: planKeys.byInterest(user?.id, interestId ?? undefined),
    enabled: Boolean(user?.id) && isUuid(interestId),
    staleTime: STALE_MS,
    queryFn: () => PlanService.listByInterest(user!.id, interestId!),
  });
}

export function useActivePlan(interestId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery<Plan | null>({
    queryKey: planKeys.activeByInterest(user?.id, interestId ?? undefined),
    enabled: Boolean(user?.id) && isUuid(interestId),
    staleTime: STALE_MS,
    queryFn: () => PlanService.getActiveForInterest(user!.id, interestId!),
  });
}

export function useCreatePlan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePlanInput) => {
      if (!user?.id) throw new Error('not authenticated');
      return PlanService.create(user.id, input);
    },
    onSuccess: (plan) => {
      queryClient.invalidateQueries({
        queryKey: planKeys.byInterest(user?.id, plan.interest_id),
      });
      queryClient.invalidateQueries({
        queryKey: planKeys.activeByInterest(user?.id, plan.interest_id),
      });
    },
  });
}

/**
 * Resolve the interest's active plan, creating one only if absent.
 * Use this for the vision-edit save instead of branching on a captured
 * activePlanId — it re-checks server-side so a loading cache can't
 * orphan the real plan behind duplicate copies.
 */
export function useEnsureActivePlan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      interestId,
      createInput,
    }: {
      interestId: string;
      createInput?: Omit<CreatePlanInput, 'interest_id'>;
    }) => {
      if (!user?.id) throw new Error('not authenticated');
      return PlanService.getOrCreateActiveForInterest(user.id, interestId, createInput);
    },
    onSuccess: (plan) => {
      queryClient.invalidateQueries({
        queryKey: planKeys.byInterest(user?.id, plan.interest_id),
      });
      queryClient.invalidateQueries({
        queryKey: planKeys.activeByInterest(user?.id, plan.interest_id),
      });
    },
  });
}

export function useUpdatePlan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, input }: { planId: string; input: UpdatePlanInput }) =>
      PlanService.update(planId, input),
    onSuccess: (plan, { input }) => {
      queryClient.invalidateQueries({
        queryKey: planKeys.byInterest(user?.id, plan.interest_id),
      });
      queryClient.invalidateQueries({
        queryKey: planKeys.activeByInterest(user?.id, plan.interest_id),
      });
      // A currency change also relabels the plan's weekly rollups, so refresh
      // the EARNINGS readout and outcome reads.
      if (input.currency !== undefined) {
        queryClient.invalidateQueries({ queryKey: ['business-outcomes'] });
        queryClient.invalidateQueries({ queryKey: ['business-outcomes-headline'] });
      }
    },
  });
}
