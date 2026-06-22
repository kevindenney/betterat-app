/**
 * useTimelineSteps — React Query hooks for timeline step operations.
 */

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import {
  getUserTimeline,
  getFollowedUsersTimelines,
  getCollaboratedSteps,
  getStepById,
  createStep,
  updateStep,
  deleteStep,
  adoptStep,
  adoptQuotedStep,
  createStepsFromCourse,
  redoStepAsNewStep,
  reopenStepForWork,
  pinStepToInterest,
  unpinStepFromInterest,
  getStepPinInterestIds,
} from '@/services/TimelineStepService';
import type { CourseToTimelineOptions } from '@/services/TimelineStepService';
import type {
  TimelineStepRecord,
  CreateTimelineStepInput,
  UpdateTimelineStepInput,
} from '@/types/timeline-steps';
import { PlaybookAIService } from '@/services/ai/PlaybookAIService';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const KEYS = {
  myTimeline: (interestId?: string | string[] | null) =>
    ['timeline-steps', 'mine', interestId ? (Array.isArray(interestId) ? [...interestId].sort().join(',') : interestId) : 'all'] as const,
  userTimeline: (userId: string, interestId?: string | null) =>
    ['timeline-steps', userId, interestId ?? 'all'] as const,
  followedTimelines: (interestId?: string | null) =>
    ['timeline-steps', 'following', interestId ?? 'all'] as const,
  collaborated: (interestId?: string | null) =>
    ['timeline-steps', 'collaborated', interestId ?? 'all'] as const,
  stepDetail: (stepId: string) =>
    ['timeline-steps', 'detail', stepId] as const,
};

// ---------------------------------------------------------------------------
// 1. Current user's timeline
// ---------------------------------------------------------------------------

export function useMyTimeline(
  interestId?: string | string[] | null,
  options: { enabled?: boolean } = {},
) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const result = useQuery<TimelineStepRecord[], Error>({
    queryKey: KEYS.myTimeline(interestId),
    queryFn: () => getUserTimeline(userId!, interestId),
    enabled: Boolean(userId) && (options.enabled ?? true),
    // Prevent refetch when window regains focus (e.g. returning from share dialog / mail app).
    // Without this, the refetch creates new array references that cascade through
    // interestFilteredRaces → cardGridRaces → initialRaceIndex, causing the card
    // carousel to briefly jump to index 0.
    refetchOnWindowFocus: false,
    staleTime: 30_000, // 30s — manual pull-to-refresh still works
  });

  // Prime the per-step detail cache from the list. Tapping any step in the
  // carousel previously triggered a redundant `getStepById` round-trip; with
  // the cache primed, useStepDetail returns instantly. We only seed entries
  // that aren't already present so we never clobber a fresher detail fetch.
  useEffect(() => {
    if (!result.data) return;
    for (const step of result.data) {
      const existing = queryClient.getQueryData<TimelineStepRecord>(
        KEYS.stepDetail(step.id),
      );
      if (!existing) {
        queryClient.setQueryData(KEYS.stepDetail(step.id), step);
      }
    }
  }, [result.data, queryClient]);

  return result;
}

// ---------------------------------------------------------------------------
// 2. Another user's visible timeline
// ---------------------------------------------------------------------------

export function useUserTimeline(userId: string | undefined, interestId?: string | null) {
  return useQuery<TimelineStepRecord[], Error>({
    queryKey: KEYS.userTimeline(userId ?? '', interestId),
    queryFn: () => getUserTimeline(userId!, interestId),
    enabled: Boolean(userId),
  });
}

// ---------------------------------------------------------------------------
// 3. Followed users' timelines
// ---------------------------------------------------------------------------

export function useFollowedTimelines(interestId?: string | null) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<TimelineStepRecord[], Error>({
    queryKey: KEYS.followedTimelines(interestId),
    queryFn: () => getFollowedUsersTimelines(userId!, interestId),
    enabled: Boolean(userId),
  });
}

// ---------------------------------------------------------------------------
// 3b. Steps where the current user is a collaborator
// ---------------------------------------------------------------------------

export function useCollaboratedSteps(interestId?: string | null) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<TimelineStepRecord[], Error>({
    queryKey: KEYS.collaborated(interestId),
    queryFn: () => getCollaboratedSteps(userId!, interestId),
    enabled: Boolean(userId),
  });
}

// ---------------------------------------------------------------------------
// 3c. Single step by ID
// ---------------------------------------------------------------------------

export function useStepById(stepId: string | undefined) {
  // Skip network fetch for client-generated `temp-` ids used by optimistic
  // step-create. The cached synthetic record is all we need until the RPC
  // reconciles it with the real server row.
  const isTempId = typeof stepId === 'string' && stepId.startsWith('temp-');

  return useQuery<TimelineStepRecord, Error>({
    queryKey: KEYS.stepDetail(stepId ?? ''),
    queryFn: () => getStepById(stepId!),
    enabled: Boolean(stepId) && !isTempId,
  });
}

// ---------------------------------------------------------------------------
// 4. Create step mutation
// ---------------------------------------------------------------------------

export function useCreateStep() {
  const queryClient = useQueryClient();

  return useMutation<TimelineStepRecord, Error, CreateTimelineStepInput>({
    mutationFn: createStep,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['user-atlas-steps'] });
      // A new race step changes the fleet's planned-at-venue count.
      queryClient.invalidateQueries({ queryKey: ['fleet-venue-stats'] });
      queryClient.invalidateQueries({ queryKey: ['author-area-cred'] });
      // A new future-dated step can become the next upcoming event.
      queryClient.invalidateQueries({ queryKey: ['atlas-next-event'] });
      // Fire cross-interest suggestions for the new step (fire-and-forget)
      PlaybookAIService.crossInterest(data.id).catch(() => {});
    },
  });
}

// ---------------------------------------------------------------------------
// 5. Update step mutation
// ---------------------------------------------------------------------------

export function useUpdateStep() {
  const queryClient = useQueryClient();

  return useMutation<
    TimelineStepRecord,
    Error,
    { stepId: string; input: UpdateTimelineStepInput }
  >({
    mutationFn: ({ stepId, input }) => updateStep(stepId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      // useUserAtlasSteps is keyed under its own root, so a timeline
      // mutation must invalidate it explicitly or the Atlas picker /
      // pin set goes stale ("saved but didn't appear" pattern from
      // feedback_query_cache_key_invalidation_audit).
      queryClient.invalidateQueries({ queryKey: ['user-atlas-steps'] });
      // Status flips (planned→completed) change the venue-mastery record.
      queryClient.invalidateQueries({ queryKey: ['venue-record'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-venue-stats'] });
      queryClient.invalidateQueries({ queryKey: ['author-area-cred'] });
      // Settled/completed flips feed the person calling-card trajectory.
      queryClient.invalidateQueries({ queryKey: ['person-public-sections'] });
      // The Atlas "next event" banner is computed from upcoming starts_at +
      // status, so a date/status/title edit must refresh it or the banner
      // shows a stale next step.
      queryClient.invalidateQueries({ queryKey: ['atlas-next-event'] });
    },
  });
}

export function useReopenStepForWork() {
  const queryClient = useQueryClient();

  return useMutation<TimelineStepRecord, Error, string>({
    mutationFn: reopenStepForWork,
    onSuccess: (_data, stepId) => {
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      queryClient.invalidateQueries({ queryKey: KEYS.stepDetail(stepId) });
      queryClient.invalidateQueries({ queryKey: ['user-atlas-steps'] });
      queryClient.invalidateQueries({ queryKey: ['venue-record'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-venue-stats'] });
      queryClient.invalidateQueries({ queryKey: ['author-area-cred'] });
    },
  });
}

export function useRedoStepAsNewStep() {
  const queryClient = useQueryClient();

  return useMutation<TimelineStepRecord, Error, string>({
    mutationFn: redoStepAsNewStep,
    onSuccess: (data, sourceStepId) => {
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      queryClient.invalidateQueries({ queryKey: KEYS.stepDetail(sourceStepId) });
      queryClient.invalidateQueries({ queryKey: KEYS.stepDetail(data.id) });
      queryClient.invalidateQueries({ queryKey: ['user-atlas-steps'] });
      // A redo schedules a fresh, usually future-dated step that can become
      // the next upcoming event.
      queryClient.invalidateQueries({ queryKey: ['atlas-next-event'] });
    },
  });
}

// ---------------------------------------------------------------------------
// 6. Delete step mutation
// ---------------------------------------------------------------------------

export function useDeleteStep() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deleteStep,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      // useUserAtlasSteps is keyed under its own root, so a timeline
      // mutation must invalidate it explicitly or the Atlas picker /
      // pin set goes stale ("saved but didn't appear" pattern from
      // feedback_query_cache_key_invalidation_audit).
      queryClient.invalidateQueries({ queryKey: ['user-atlas-steps'] });
      queryClient.invalidateQueries({ queryKey: ['venue-record'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-venue-stats'] });
      queryClient.invalidateQueries({ queryKey: ['author-area-cred'] });
      // Deleting the next upcoming step must refresh the Atlas banner or it
      // keeps showing a step that no longer exists.
      queryClient.invalidateQueries({ queryKey: ['atlas-next-event'] });
    },
  });
}

// ---------------------------------------------------------------------------
// 7. Adopt step mutation (copy from another user)
// ---------------------------------------------------------------------------

export function useAdoptStep() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<
    TimelineStepRecord,
    Error,
    { sourceStepId: string; interestId: string }
  >({
    mutationFn: ({ sourceStepId, interestId }) => {
      if (!user?.id) throw new Error('Must be logged in to adopt a step');
      return adoptStep(user.id, sourceStepId, interestId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      // useUserAtlasSteps is keyed under its own root, so a timeline
      // mutation must invalidate it explicitly or the Atlas picker /
      // pin set goes stale ("saved but didn't appear" pattern from
      // feedback_query_cache_key_invalidation_audit).
      queryClient.invalidateQueries({ queryKey: ['user-atlas-steps'] });
      // An adopted future-dated step can become the next upcoming event.
      queryClient.invalidateQueries({ queryKey: ['atlas-next-event'] });
    },
  });
}

// ---------------------------------------------------------------------------
// 7b. Adopt the step quoted into a discussion note
// ---------------------------------------------------------------------------

export function useAdoptQuotedStep() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<
    Awaited<ReturnType<typeof adoptQuotedStep>>,
    Error,
    { discussionId: string; interestId: string }
  >({
    mutationFn: ({ discussionId, interestId }) => {
      if (!user?.id) throw new Error('Must be logged in to add a step');
      return adoptQuotedStep(user.id, discussionId, interestId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      queryClient.invalidateQueries({ queryKey: ['user-atlas-steps'] });
      queryClient.invalidateQueries({ queryKey: ['atlas-next-event'] });
    },
  });
}

// ---------------------------------------------------------------------------
// 8. Create steps from course lessons
// ---------------------------------------------------------------------------

export function useCreateStepsFromCourse() {
  const queryClient = useQueryClient();

  return useMutation<
    TimelineStepRecord[],
    Error,
    CourseToTimelineOptions
  >({
    mutationFn: createStepsFromCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      // useUserAtlasSteps is keyed under its own root, so a timeline
      // mutation must invalidate it explicitly or the Atlas picker /
      // pin set goes stale ("saved but didn't appear" pattern from
      // feedback_query_cache_key_invalidation_audit).
      queryClient.invalidateQueries({ queryKey: ['user-atlas-steps'] });
      // Course-derived dated steps can become the next upcoming event.
      queryClient.invalidateQueries({ queryKey: ['atlas-next-event'] });
    },
  });
}

// ---------------------------------------------------------------------------
// 9. Cross-interest step pins
// ---------------------------------------------------------------------------

export function useStepPinInterestIds(stepId: string | undefined) {
  const { user } = useAuth();
  return useQuery<string[], Error>({
    queryKey: ['step-pins', stepId] as const,
    queryFn: () => getStepPinInterestIds(stepId!, user!.id),
    enabled: Boolean(stepId && user?.id),
  });
}

export function usePinStep() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<void, Error, { stepId: string; interestId: string }>({
    mutationFn: ({ stepId, interestId }) => {
      if (!user?.id) throw new Error('Must be logged in');
      return pinStepToInterest(stepId, user.id, interestId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['step-pins', variables.stepId] });
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      // useUserAtlasSteps is keyed under its own root, so a timeline
      // mutation must invalidate it explicitly or the Atlas picker /
      // pin set goes stale ("saved but didn't appear" pattern from
      // feedback_query_cache_key_invalidation_audit).
      queryClient.invalidateQueries({ queryKey: ['user-atlas-steps'] });
    },
  });
}

export function useUnpinStep() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<void, Error, { stepId: string; interestId: string }>({
    mutationFn: ({ stepId, interestId }) => {
      if (!user?.id) throw new Error('Must be logged in');
      return unpinStepFromInterest(stepId, user.id, interestId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['step-pins', variables.stepId] });
      queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      // useUserAtlasSteps is keyed under its own root, so a timeline
      // mutation must invalidate it explicitly or the Atlas picker /
      // pin set goes stale ("saved but didn't appear" pattern from
      // feedback_query_cache_key_invalidation_audit).
      queryClient.invalidateQueries({ queryKey: ['user-atlas-steps'] });
    },
  });
}
