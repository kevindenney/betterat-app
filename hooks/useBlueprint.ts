/**
 * useBlueprint — React Query hooks for blueprint operations
 *
 * Provides hooks for publishing, subscribing, and consuming blueprints.
 */

import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import {
  createBlueprint,
  updateBlueprint,
  deleteBlueprint,
  getBlueprintBySlug,
  getBlueprintById,
  getUserBlueprints,
  getBlueprintSteps,
  getOrganizationBlueprints,
  getProgramBlueprints,
  subscribe,
  unsubscribe,
  getSubscription,
  getMySubscriptions,
  getSubscribedBlueprints,
  getNewStepsForSubscriber,
  getSuggestedNextSteps,
  markStepAction,
  getBlueprintSubscribers,
  getBlueprintSubscriberProgress,
  getCoSubscriberProgressForBlueprint,
  addStepToBlueprint,
  removeStepFromBlueprint,
  reorderBlueprintSteps,
  setBlueprintSteps,
  migrateBlueprint,
  getSubscriberAdoptedSteps,
  getBlueprintWithAuthorById,
} from '@/services/BlueprintService';
import type { SubscriberAdoptedStep } from '@/services/BlueprintService';
import { adoptStep } from '@/services/TimelineStepService';
import { NotificationService } from '@/services/NotificationService';
import type {
  BlueprintRecord,
  CreateBlueprintInput,
  UpdateBlueprintInput,
  BlueprintWithAuthor,
  BlueprintSubscriptionRecord,
  BlueprintNewStep,
  BlueprintSuggestedNextStep,
  SubscribedBlueprintInfo,
  SubscriberProgress,
} from '@/types/blueprint';
import type { TimelineStepRecord } from '@/types/timeline-steps';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const keys = {
  all: ['blueprints'] as const,
  bySlug: (slug: string) => ['blueprints', 'slug', slug] as const,
  byId: (id: string) => ['blueprints', 'id', id] as const,
  userBlueprints: (userId: string) => ['blueprints', 'user', userId] as const,
  steps: (blueprintId: string) => ['blueprints', 'steps', blueprintId] as const,
  subscriptions: (userId: string) => ['blueprint-subscriptions', userId] as const,
  subscription: (userId: string, blueprintId: string) =>
    ['blueprint-subscriptions', userId, blueprintId] as const,
  newSteps: (userId: string, interestId?: string | null) =>
    ['blueprint-new-steps', userId, interestId] as const,
  subscribedBlueprints: (userId: string, interestId?: string | null) =>
    ['blueprint-subscribed', userId, interestId] as const,
  orgBlueprints: (orgId: string) => ['blueprints', 'org', orgId] as const,
  programBlueprints: (programId: string) => ['blueprints', 'program', programId] as const,
  subscribers: (blueprintId: string) => ['blueprint-subscribers', blueprintId] as const,
  subscriberProgress: (blueprintId: string) =>
    ['blueprint-subscriber-progress', blueprintId] as const,
  coSubscriberProgress: (blueprintId: string) =>
    ['blueprint-co-subscriber-progress', blueprintId] as const,
  subscriberAdoptedSteps: (blueprintId: string, subscriberId: string) =>
    ['blueprint-subscriber-adopted', blueprintId, subscriberId] as const,
  suggestedNextSteps: (userId: string, interestId?: string | null) =>
    ['blueprint-suggested-next', userId, interestId] as const,
};

// ---------------------------------------------------------------------------
// Blueprint queries
// ---------------------------------------------------------------------------

export function useBlueprint(slug?: string | null) {
  return useQuery<BlueprintWithAuthor | null>({
    queryKey: keys.bySlug(slug ?? ''),
    queryFn: () => getBlueprintBySlug(slug!),
    enabled: !!slug,
  });
}

export function useBlueprintById(blueprintId?: string | null) {
  return useQuery<BlueprintRecord | null>({
    queryKey: keys.byId(blueprintId ?? ''),
    queryFn: () => getBlueprintById(blueprintId!),
    enabled: !!blueprintId,
  });
}

export function useBlueprintWithAuthor(blueprintId?: string | null) {
  return useQuery<BlueprintWithAuthor | null>({
    queryKey: [...keys.byId(blueprintId ?? ''), 'with-author'] as const,
    queryFn: () => getBlueprintWithAuthorById(blueprintId!),
    enabled: !!blueprintId,
    staleTime: 5 * 60_000, // 5 min — blueprint metadata rarely changes
  });
}

export function useUserBlueprints() {
  const { user } = useAuth();
  return useQuery<BlueprintRecord[]>({
    queryKey: keys.userBlueprints(user?.id ?? ''),
    queryFn: () => getUserBlueprints(user!.id),
    enabled: !!user?.id,
  });
}

export function useBlueprintSteps(blueprintId?: string | null) {
  return useQuery<TimelineStepRecord[]>({
    queryKey: keys.steps(blueprintId ?? ''),
    queryFn: () => getBlueprintSteps(blueprintId!),
    enabled: !!blueprintId,
  });
}

export function useOrganizationBlueprints(orgId?: string | null) {
  return useQuery<BlueprintRecord[]>({
    queryKey: keys.orgBlueprints(orgId ?? ''),
    queryFn: () => getOrganizationBlueprints(orgId!),
    enabled: !!orgId,
  });
}

export function useProgramBlueprints(programId?: string | null) {
  return useQuery<BlueprintRecord[]>({
    queryKey: keys.programBlueprints(programId ?? ''),
    queryFn: () => getProgramBlueprints(programId!),
    enabled: !!programId,
  });
}

// ---------------------------------------------------------------------------
// Subscription queries
// ---------------------------------------------------------------------------

export function useMySubscriptions() {
  const { user } = useAuth();
  return useQuery<BlueprintSubscriptionRecord[]>({
    queryKey: keys.subscriptions(user?.id ?? ''),
    queryFn: () => getMySubscriptions(user!.id),
    enabled: !!user?.id,
  });
}

export function useBlueprintSubscription(blueprintId?: string | null) {
  const { user } = useAuth();
  return useQuery<BlueprintSubscriptionRecord | null>({
    queryKey: keys.subscription(user?.id ?? '', blueprintId ?? ''),
    queryFn: () => getSubscription(user!.id, blueprintId!),
    enabled: !!user?.id && !!blueprintId,
  });
}

export function useNewBlueprintSteps(interestId?: string | null) {
  const { user } = useAuth();
  return useQuery<BlueprintNewStep[]>({
    queryKey: keys.newSteps(user?.id ?? '', interestId),
    queryFn: () => getNewStepsForSubscriber(user!.id, interestId),
    enabled: !!user?.id,
  });
}

export function useSubscribedBlueprints(interestId?: string | null) {
  const { user } = useAuth();
  return useQuery<SubscribedBlueprintInfo[]>({
    queryKey: keys.subscribedBlueprints(user?.id ?? '', interestId),
    queryFn: () => getSubscribedBlueprints(user!.id, interestId),
    enabled: !!user?.id,
  });
}

/**
 * Backfill hook: ensures every subscribed blueprint has at least one adopted
 * step AND that all adopted steps have corresponding blueprint_step_actions
 * records. Handles:
 *   1. Users who subscribed before auto-adopt was added
 *   2. Steps adopted with broken action-tracking (wrong column names)
 * Runs once per mount.
 */
export function useAutoAdoptSubscribedSteps(
  interestId?: string | null,
  mySteps?: TimelineStepRecord[] | null,
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: subscribed } = useSubscribedBlueprints(interestId);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current || !user?.id || !subscribed?.length || mySteps === undefined) return;
    hasRun.current = true;

    // Build lookup of adopted steps by blueprint
    const stepsByBlueprint = new Map<string, { sourceId: string; adoptedId: string }[]>();
    for (const s of (mySteps ?? [])) {
      const bpId = (s as any).source_blueprint_id;
      const srcId = (s as any).source_id;
      if (!bpId || !srcId) continue;
      if (!stepsByBlueprint.has(bpId)) stepsByBlueprint.set(bpId, []);
      stepsByBlueprint.get(bpId)!.push({ sourceId: srcId, adoptedId: s.id });
    }

    let didChange = false;

    (async () => {
      for (const bp of subscribed) {
        const existingAdopted = stepsByBlueprint.get(bp.blueprint_id) ?? [];

        if (existingAdopted.length === 0) {
          // Case 1: No steps adopted — adopt the first blueprint step
          try {
            const steps = await getBlueprintSteps(bp.blueprint_id);
            if (steps.length === 0) continue;
            const firstStep = steps[0];
            try {
              const adopted = await adoptStep(user.id, firstStep.id, firstStep.interest_id, bp.blueprint_id);
              await markStepAction(bp.subscription_id, firstStep.id, 'adopted', adopted.id).catch(() => {});
              didChange = true;
            } catch {
              // Step may already exist
            }
          } catch {
            // Non-fatal
          }
        } else {
          // Case 2: Steps adopted but action records may be missing — backfill them
          for (const { sourceId, adoptedId } of existingAdopted) {
            try {
              await markStepAction(bp.subscription_id, sourceId, 'adopted', adoptedId);
            } catch {
              // Already exists or non-fatal
            }
          }
        }
      }

      if (didChange) {
        queryClient.invalidateQueries({ queryKey: ['timeline-steps'], refetchType: 'all' });
      }
      queryClient.invalidateQueries({ queryKey: ['for-you-suggestions'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['blueprint-subscriber-progress'], refetchType: 'all' });
    })();
  }, [user?.id, subscribed, mySteps, queryClient]);
}

export function useSuggestedNextSteps(interestId?: string | null) {
  const { user } = useAuth();
  return useQuery<BlueprintSuggestedNextStep[]>({
    queryKey: keys.suggestedNextSteps(user?.id ?? '', interestId),
    queryFn: () => getSuggestedNextSteps(user!.id, interestId),
    enabled: !!user?.id,
  });
}

export function useBlueprintSubscribers(blueprintId?: string | null) {
  return useQuery({
    queryKey: keys.subscribers(blueprintId ?? ''),
    queryFn: () => getBlueprintSubscribers(blueprintId!),
    enabled: !!blueprintId,
  });
}

export function useBlueprintSubscriberProgress(blueprintId?: string | null) {
  return useQuery<SubscriberProgress[]>({
    queryKey: keys.subscriberProgress(blueprintId ?? ''),
    queryFn: () => getBlueprintSubscriberProgress(blueprintId!),
    enabled: !!blueprintId,
  });
}

/**
 * Peer-readable progress for the Co-practitioners surface. Returns only the
 * rows the current user is allowed to see under the Phase 7
 * `step_user_progress_co_subscriber_read` RLS policy.
 */
export function useBlueprintCoSubscriberProgress(blueprintId?: string | null) {
  return useQuery<SubscriberProgress[]>({
    queryKey: keys.coSubscriberProgress(blueprintId ?? ''),
    queryFn: () => getCoSubscriberProgressForBlueprint(blueprintId!),
    enabled: !!blueprintId,
  });
}

// ---------------------------------------------------------------------------
// Blueprint mutations
// ---------------------------------------------------------------------------

export function useCreateBlueprint() {
  const queryClient = useQueryClient();
  return useMutation<BlueprintRecord, Error, CreateBlueprintInput>({
    mutationFn: createBlueprint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useUpdateBlueprint() {
  const queryClient = useQueryClient();
  return useMutation<
    BlueprintRecord,
    Error,
    { blueprintId: string; updates: UpdateBlueprintInput }
  >({
    mutationFn: ({ blueprintId, updates }) => updateBlueprint(blueprintId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useDeleteBlueprint() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteBlueprint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });
}

export function useMigrateBlueprint() {
  const queryClient = useQueryClient();
  return useMutation<
    BlueprintRecord,
    Error,
    { blueprintId: string; newInterestId: string }
  >({
    mutationFn: ({ blueprintId, newInterestId }) =>
      migrateBlueprint(blueprintId, newInterestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// Blueprint step curation mutations
// ---------------------------------------------------------------------------

export function useAddStepToBlueprint() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { blueprintId: string; stepId: string; sortOrder?: number }>({
    mutationFn: ({ blueprintId, stepId, sortOrder }) =>
      addStepToBlueprint(blueprintId, stepId, sortOrder),
    onSuccess: (_data, { blueprintId }) => {
      queryClient.invalidateQueries({ queryKey: keys.steps(blueprintId) });
    },
  });
}

export function useRemoveStepFromBlueprint() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { blueprintId: string; stepId: string }>({
    mutationFn: ({ blueprintId, stepId }) =>
      removeStepFromBlueprint(blueprintId, stepId),
    onSuccess: (_data, { blueprintId }) => {
      queryClient.invalidateQueries({ queryKey: keys.steps(blueprintId) });
    },
  });
}

export function useReorderBlueprintSteps() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { blueprintId: string; stepIds: string[] }>({
    mutationFn: ({ blueprintId, stepIds }) =>
      reorderBlueprintSteps(blueprintId, stepIds),
    onSuccess: (_data, { blueprintId }) => {
      queryClient.invalidateQueries({ queryKey: keys.steps(blueprintId) });
    },
  });
}

export function useSetBlueprintSteps() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { blueprintId: string; stepIds: string[] }>({
    mutationFn: ({ blueprintId, stepIds }) =>
      setBlueprintSteps(blueprintId, stepIds),
    onSuccess: (_data, { blueprintId }) => {
      queryClient.invalidateQueries({ queryKey: keys.steps(blueprintId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Subscription mutations
// ---------------------------------------------------------------------------

export function useSubscribe() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<BlueprintSubscriptionRecord, Error, string>({
    mutationFn: (blueprintId: string) => {
      if (!user?.id) throw new Error('Must be logged in to subscribe');
      return subscribe(user.id, blueprintId);
    },
    onSuccess: () => {
      // refetchType: 'all' forces refetch of inactive queries too, so the
      // Clinical timeline's SubscribedBlueprintStrip is fresh when the user
      // navigates back to it after subscribing from the catalog page.
      queryClient.invalidateQueries({ queryKey: ['blueprint-subscriptions'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['blueprint-subscribed'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['blueprint-new-steps'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['blueprint-suggested-next'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: keys.all, refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['for-you-suggestions'], refetchType: 'all' });
    },
  });
}

export function useUnsubscribe() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (blueprintId: string) => {
      if (!user?.id) throw new Error('Must be logged in');
      return unsubscribe(user.id, blueprintId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blueprint-subscriptions'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['blueprint-subscribed'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['blueprint-new-steps'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['blueprint-suggested-next'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: keys.all, refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['for-you-suggestions'], refetchType: 'all' });
    },
  });
}

// ---------------------------------------------------------------------------
// Step action mutations (adopt / dismiss from blueprint feed)
// ---------------------------------------------------------------------------

export function useAdoptBlueprintStep() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<
    TimelineStepRecord,
    Error,
    { sourceStepId: string; interestId: string; subscriptionId: string; blueprintId?: string }
  >({
    mutationFn: async ({ sourceStepId, interestId, subscriptionId, blueprintId }) => {
      if (!user?.id) throw new Error('Must be logged in');

      // Adopt the step (creates copy in user's timeline)
      const adopted = await adoptStep(user.id, sourceStepId, interestId, blueprintId);

      // Mark as adopted in blueprint tracking
      await markStepAction(subscriptionId, sourceStepId, 'adopted', adopted.id);

      return adopted;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      queryClient.invalidateQueries({ queryKey: ['blueprint-new-steps'] });
      queryClient.invalidateQueries({ queryKey: ['blueprint-suggested-next'] });
    },
  });
}

export function useDismissBlueprintStep() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { subscriptionId: string; sourceStepId: string }>({
    mutationFn: async ({ subscriptionId, sourceStepId }) => {
      await markStepAction(subscriptionId, sourceStepId, 'dismissed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blueprint-new-steps'] });
      queryClient.invalidateQueries({ queryKey: ['blueprint-suggested-next'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Creator mentoring queries & mutations
// ---------------------------------------------------------------------------

export function useSubscriberAdoptedSteps(
  blueprintId?: string | null,
  subscriberId?: string | null,
) {
  return useQuery<SubscriberAdoptedStep[]>({
    queryKey: keys.subscriberAdoptedSteps(blueprintId ?? '', subscriberId ?? ''),
    queryFn: () => getSubscriberAdoptedSteps(blueprintId!, subscriberId!),
    enabled: !!blueprintId && !!subscriberId,
  });
}

export function useSuggestStepToSubscriber() {
  const { user } = useAuth();

  return useMutation<
    string,
    Error,
    {
      targetUserId: string;
      sourceStepId: string;
      stepTitle: string;
      stepDescription?: string;
      interestId?: string;
    }
  >({
    mutationFn: async ({ targetUserId, sourceStepId, stepTitle, stepDescription, interestId }) => {
      if (!user?.id) throw new Error('Must be logged in');
      return NotificationService.notifyStepSuggested({
        targetUserId,
        actorId: user.id,
        actorName: user.user_metadata?.full_name ?? 'Your coach',
        sourceStepId,
        stepTitle,
        stepDescription,
        interestId,
      });
    },
  });
}
