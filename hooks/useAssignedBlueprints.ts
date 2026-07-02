/**
 * useAssignedBlueprints — institution-managed Studio blueprints a student has
 * been assigned through their cohorts, plus an `adopt` mutation that
 * materializes a blueprint's steps into the student's timeline.
 *
 * This is the student-facing half of the institutional blueprint bridge; the
 * read/write logic lives in CohortBlueprintService.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import {
  fetchAssignedBlueprints,
  fetchAssignedBlueprintDetail,
  fetchInstitutionalBlueprintMeta,
  fetchInstitutionalNextSteps,
  materializeAssignedBlueprint,
  type AssignedBlueprint,
  type AssignedBlueprintDetail,
  type InstitutionalBlueprintMeta,
  type InstitutionalNextStep,
} from '@/services/CohortBlueprintService';

export type {
  AssignedBlueprint,
  AssignedBlueprintDetail,
  InstitutionalBlueprintMeta,
  InstitutionalNextStep,
};

/**
 * Next pullable template from every subscribed institutional/marketplace
 * blueprint (the composer's per-step pull surface). One entry per blueprint.
 */
export function useInstitutionalNextSteps(interestId?: string | null) {
  const { user } = useAuth();
  const userId = user?.id as string | undefined;
  return useQuery<InstitutionalNextStep[]>({
    queryKey: ['institutional-next-steps', userId, interestId ?? null],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: () => fetchInstitutionalNextSteps(userId!, interestId),
  });
}

/** Title + org label for one institutional blueprint, for step provenance. */
export function useInstitutionalBlueprintMeta(blueprintId?: string | null) {
  return useQuery<InstitutionalBlueprintMeta | null>({
    queryKey: ['institutional-blueprint-meta', blueprintId ?? null],
    enabled: Boolean(blueprintId),
    staleTime: 5 * 60_000,
    queryFn: () => fetchInstitutionalBlueprintMeta(blueprintId!),
  });
}

export function useAssignedBlueprints(interestId?: string | null) {
  const { user } = useAuth();
  const userId = user?.id as string | undefined;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['assigned-blueprints', userId, interestId ?? null],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: () => fetchAssignedBlueprints(userId!, interestId),
  });

  const adopt = useMutation({
    mutationFn: (blueprintId: string) =>
      materializeAssignedBlueprint(userId!, blueprintId, { interestId }),
    onSuccess: () => {
      // Refresh this surface's progress and every place the new steps land.
      queryClient.invalidateQueries({ queryKey: ['assigned-blueprints', userId] });
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['library-counts'] });
      queryClient.invalidateQueries({ queryKey: ['library-plans'] });
    },
  });

  return {
    assigned: query.data ?? [],
    loading: query.isLoading,
    adopt,
  };
}

/**
 * One assigned blueprint's read-only detail (header + ordered step list with
 * per-step adopted flags), plus the same `adopt` mutation so the preview can
 * add the whole plan in place.
 */
export function useAssignedBlueprintDetail(blueprintId?: string) {
  const { user } = useAuth();
  const userId = user?.id as string | undefined;
  const queryClient = useQueryClient();

  const query = useQuery<AssignedBlueprintDetail | null>({
    queryKey: ['assigned-blueprint-detail', userId, blueprintId ?? null],
    enabled: Boolean(userId && blueprintId),
    staleTime: 60_000,
    queryFn: () => fetchAssignedBlueprintDetail(userId!, blueprintId!),
  });

  const adopt = useMutation({
    mutationFn: () => materializeAssignedBlueprint(userId!, blueprintId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assigned-blueprint-detail', userId] });
      queryClient.invalidateQueries({ queryKey: ['assigned-blueprints', userId] });
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['library-counts'] });
      queryClient.invalidateQueries({ queryKey: ['library-plans'] });
    },
  });

  return {
    detail: query.data ?? null,
    loading: query.isLoading,
    error: query.error,
    adopt,
  };
}
