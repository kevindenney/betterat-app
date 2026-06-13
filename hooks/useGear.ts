import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import {
  addStepGearItem,
  createGearItem,
  deleteGearItem,
  listGearItems,
  listStepGear,
  removeStepGearItem,
  setPrimaryGearItem,
  setStepGearSelection,
  updateGearItem,
  type GearItem,
  type GearStatus,
} from '@/services/GearService';

const KEYS = {
  interestGear: (userId?: string | null, interestId?: string | null) =>
    ['gear-items', userId ?? 'anon', interestId ?? 'none'] as const,
  stepGear: (stepId?: string | null) => ['step-gear', stepId ?? 'none'] as const,
};

export function useInterestGear(interestId: string | null | undefined, userIdOverride?: string | null) {
  const { user } = useAuth();
  const userId = userIdOverride ?? user?.id ?? null;

  return useQuery({
    queryKey: KEYS.interestGear(userId, interestId ?? null),
    queryFn: () => listGearItems(userId!, interestId!),
    enabled: Boolean(userId && interestId),
    staleTime: 30_000,
  });
}

export function useStepGear(stepId: string | null | undefined) {
  return useQuery({
    queryKey: KEYS.stepGear(stepId ?? null),
    queryFn: () => listStepGear(stepId!),
    enabled: Boolean(stepId),
    staleTime: 30_000,
  });
}

export function useCreateGearItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createGearItem,
    onSuccess: (item) => {
      queryClient.invalidateQueries({
        queryKey: KEYS.interestGear(item.user_id, item.interest_id),
      });
    },
  });
}

export function useUpdateGearItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: {
      id: string;
      patch: Partial<Pick<GearItem, 'name' | 'kind' | 'parent_id' | 'is_primary' | 'status' | 'spec' | 'notes'>>;
    }) => updateGearItem(id, patch),
    onSuccess: (item) => {
      queryClient.invalidateQueries({
        queryKey: KEYS.interestGear(item.user_id, item.interest_id),
      });
      queryClient.invalidateQueries({ queryKey: ['step-gear'] });
    },
  });
}

export function useSetPrimaryGearItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setPrimaryGearItem,
    onSuccess: (item) => {
      queryClient.invalidateQueries({
        queryKey: KEYS.interestGear(item.user_id, item.interest_id),
      });
      queryClient.invalidateQueries({ queryKey: ['step-gear'] });
    },
  });
}

export function useDeleteGearItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; userId: string; interestId: string }) => deleteGearItem(id),
    onSuccess: (_void, variables) => {
      queryClient.invalidateQueries({
        queryKey: KEYS.interestGear(variables.userId, variables.interestId),
      });
      queryClient.invalidateQueries({ queryKey: ['step-gear'] });
    },
  });
}

export function useSetStepGearSelection(stepId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { role: string; gearItemId: string | null }) =>
      setStepGearSelection({
        stepId: stepId!,
        role: input.role,
        gearItemId: input.gearItemId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.stepGear(stepId ?? null) });
      queryClient.invalidateQueries({ queryKey: ['timeline-steps', 'detail', stepId] });
    },
  });
}

export function useToggleStepGearItem(stepId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { role: string; gearItemId: string; selected: boolean }) =>
      input.selected
        ? removeStepGearItem({ stepId: stepId!, role: input.role, gearItemId: input.gearItemId })
        : addStepGearItem({ stepId: stepId!, role: input.role, gearItemId: input.gearItemId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.stepGear(stepId ?? null) });
      queryClient.invalidateQueries({ queryKey: ['timeline-steps', 'detail', stepId] });
    },
  });
}

export type { GearItem, GearStatus };
