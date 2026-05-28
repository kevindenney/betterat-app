/**
 * usePlaybook — React Query hooks for the Playbook feature.
 *
 * Replaces useLibrary with a broader surface: in addition to the playbook
 * root + resources, exposes dashboard queries for suggestions, inbox items,
 * shares, recent debriefs, and per-section counts.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import {
  getOrCreatePlaybook,
  getPlaybookById,
  getResources,
  addResource,
  updateResource,
  deleteResource,
  getSuggestions,
  getCrossInterestSuggestionsForStep,
  countPendingSuggestions,
  getInboxItems,
  addInboxItem,
  dismissInboxItem,
  getShares,
  createShare,
  revokeShare,
  getPlaybooksSharedWithMe,
  getRecentDebriefs,
  getSectionCounts,
  getConcepts,
  getConceptBySlug,
  getConceptById,
  createConcept,
  updateConcept,
  deleteConcept,
  forkConcept,
  pullLatestConcept,
  getPatterns,
  updatePatternStatus,
  getReviews,
  getQA,
  setQAPinned,
  deleteQA,
  createQA,
  type CreatePlaybookQAInput,
  getBatchSectionCounts,
  getBatchLatestReviews,
  getBatchCompetencySummaries,
  getRecentInsights,
  discardInsight,
  refineInsightToConcept,
  getLifecycleConcepts,
  getConceptTrailQuotes,
  getConceptTestedSteps,
  getConceptCapabilityChips,
  linkConceptToStep,
  getStepConceptLinks,
  addConceptTrailQuote,
  promoteConceptToSettled,
  type RecentDebriefStep,
  type PlaybookSectionCounts,
  type Phase6ConceptRecord,
} from '@/services/PlaybookService';
import {
  acceptSuggestion,
  editSuggestion,
  rejectSuggestion,
} from '@/services/PlaybookSuggestionService';
import type {
  PlaybookRecord,
  PlaybookResourceRecord,
  PlaybookConceptRecord,
  PlaybookPatternRecord,
  PlaybookReviewRecord,
  PlaybookQARecord,
  PlaybookSuggestionRecord,
  PlaybookInboxItemRecord,
  PlaybookShareRecord,
  PlaybookInsightRecord,
  ConceptTrailQuoteRecord,
  StepConceptLinkRecord,
  CreatePlaybookResourceInput,
  UpdatePlaybookResourceInput,
  CreatePlaybookConceptInput,
  UpdatePlaybookConceptInput,
  CreatePlaybookInboxItemInput,
  CreatePlaybookShareInput,
} from '@/types/playbook';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const KEYS = {
  playbook: (interestId: string, userId: string) =>
    ['playbook', userId, interestId] as const,
  resources: (playbookId: string) => ['playbook-resources', playbookId] as const,
  concepts: (playbookId: string) => ['playbook-concepts', playbookId] as const,
  patterns: (playbookId: string) => ['playbook-patterns', playbookId] as const,
  reviews: (playbookId: string) => ['playbook-reviews', playbookId] as const,
  qa: (playbookId: string) => ['playbook-qa', playbookId] as const,
  suggestions: (playbookId: string) =>
    ['playbook-suggestions', playbookId] as const,
  suggestionsPendingCount: (playbookId: string) =>
    ['playbook-suggestions-pending-count', playbookId] as const,
  insights: (userId: string, interestId: string) =>
    ['playbook-insights', userId, interestId] as const,
  lifecycleConcepts: (userId: string, interestId: string) =>
    ['playbook-lifecycle-concepts', userId, interestId] as const,
  conceptById: (conceptId: string) => ['playbook-concept-by-id', conceptId] as const,
  conceptQuotes: (conceptId: string) => ['playbook-concept-quotes', conceptId] as const,
  conceptSteps: (conceptId: string) => ['playbook-concept-steps', conceptId] as const,
  conceptCapabilities: (conceptId: string) => ['playbook-concept-capabilities', conceptId] as const,
  stepConceptLinks: (stepId: string) => ['step-concept-links', stepId] as const,
  inbox: (playbookId: string) => ['playbook-inbox', playbookId] as const,
  shares: (playbookId: string) => ['playbook-shares', playbookId] as const,
  recentDebriefs: (userId: string, interestId: string) =>
    ['playbook-recent-debriefs', userId, interestId] as const,
  sectionCounts: (playbookId: string) =>
    ['playbook-section-counts', playbookId] as const,
};

const PHASE6_REMOTE_QUERY_OPTIONS = {
  retry: false as const,
  refetchOnWindowFocus: false as const,
  refetchOnReconnect: false as const,
};

// ---------------------------------------------------------------------------
// 1. Root playbook for current interest (auto-creates)
// ---------------------------------------------------------------------------

/**
 * usePlaybookById — fetch a specific playbook by id. Used by the shared
 * coach/teammate read-only view. RLS enforces access via playbook_shares.
 */
export function usePlaybookById(playbookId: string | undefined) {
  return useQuery<PlaybookRecord | null, Error>({
    queryKey: ['playbook-by-id', playbookId ?? ''] as const,
    queryFn: () => getPlaybookById(playbookId!),
    enabled: Boolean(playbookId),
  });
}

export function usePlaybook(interestId: string | undefined) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<PlaybookRecord, Error>({
    queryKey: KEYS.playbook(interestId ?? '', userId ?? ''),
    queryFn: () => getOrCreatePlaybook(userId!, interestId!),
    enabled: Boolean(userId) && Boolean(interestId),
  });
}

// ---------------------------------------------------------------------------
// 2. Resources
// ---------------------------------------------------------------------------

export function usePlaybookResources(playbookId: string | undefined) {
  return useQuery<PlaybookResourceRecord[], Error>({
    queryKey: KEYS.resources(playbookId ?? ''),
    queryFn: () => getResources(playbookId!),
    enabled: Boolean(playbookId),
  });
}

export function useAddPlaybookResource() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<
    PlaybookResourceRecord,
    Error,
    CreatePlaybookResourceInput
  >({
    mutationFn: (input) => {
      if (!user?.id) throw new Error('Must be logged in');
      return addResource(user.id, input);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: KEYS.resources(variables.playbook_id),
      });
      queryClient.invalidateQueries({
        queryKey: KEYS.sectionCounts(variables.playbook_id),
      });
    },
  });
}

export function useUpdatePlaybookResource() {
  const queryClient = useQueryClient();

  return useMutation<
    PlaybookResourceRecord,
    Error,
    {
      resourceId: string;
      input: UpdatePlaybookResourceInput;
      playbookId: string;
    }
  >({
    mutationFn: ({ resourceId, input }) => updateResource(resourceId, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: KEYS.resources(variables.playbookId),
      });
    },
  });
}

export function useDeletePlaybookResource() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    { resourceId: string; playbookId: string }
  >({
    mutationFn: ({ resourceId }) => deleteResource(resourceId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: KEYS.resources(variables.playbookId),
      });
      queryClient.invalidateQueries({
        queryKey: KEYS.sectionCounts(variables.playbookId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// 3. Concepts / Patterns / Reviews / Q&A
// ---------------------------------------------------------------------------

export function usePlaybookConcepts(
  playbookId: string | undefined,
  interestId: string | undefined,
) {
  return useQuery<PlaybookConceptRecord[], Error>({
    queryKey: KEYS.concepts(playbookId ?? ''),
    queryFn: () => getConcepts(playbookId!, interestId!),
    enabled: Boolean(playbookId) && Boolean(interestId),
  });
}

export function usePlaybookConceptBySlug(
  playbookId: string | undefined,
  interestId: string | undefined,
  slug: string | undefined,
) {
  return useQuery<PlaybookConceptRecord | null, Error>({
    queryKey: ['playbook-concept-by-slug', playbookId, slug],
    queryFn: () => getConceptBySlug(playbookId!, interestId!, slug!),
    enabled: Boolean(playbookId) && Boolean(interestId) && Boolean(slug),
  });
}

export function usePlaybookConceptById(conceptId: string | undefined) {
  return useQuery<PlaybookConceptRecord | null, Error>({
    queryKey: KEYS.conceptById(conceptId ?? ''),
    queryFn: () => getConceptById(conceptId!),
    enabled: Boolean(conceptId),
  });
}

export function usePlaybookInsights(interestId: string | undefined) {
  const { user } = useAuth();
  return useQuery<PlaybookInsightRecord[], Error>({
    queryKey: KEYS.insights(user?.id ?? '', interestId ?? ''),
    queryFn: () => getRecentInsights(user!.id, interestId ?? null),
    enabled: Boolean(user?.id) && Boolean(interestId),
    ...PHASE6_REMOTE_QUERY_OPTIONS,
  });
}

export function useLifecycleConcepts(interestId: string | undefined) {
  const { user } = useAuth();
  return useQuery<Phase6ConceptRecord[], Error>({
    queryKey: KEYS.lifecycleConcepts(user?.id ?? '', interestId ?? ''),
    queryFn: () => getLifecycleConcepts(user!.id, interestId!),
    enabled: Boolean(user?.id) && Boolean(interestId),
    ...PHASE6_REMOTE_QUERY_OPTIONS,
  });
}

export function useConceptTrailQuotes(conceptId: string | undefined) {
  return useQuery<ConceptTrailQuoteRecord[], Error>({
    queryKey: KEYS.conceptQuotes(conceptId ?? ''),
    queryFn: () => getConceptTrailQuotes(conceptId!),
    enabled: Boolean(conceptId),
    ...PHASE6_REMOTE_QUERY_OPTIONS,
  });
}

export function useConceptTestedSteps(conceptId: string | undefined) {
  return useQuery<any[], Error>({
    queryKey: KEYS.conceptSteps(conceptId ?? ''),
    queryFn: () => getConceptTestedSteps(conceptId!),
    enabled: Boolean(conceptId),
    ...PHASE6_REMOTE_QUERY_OPTIONS,
  });
}

export function useConceptCapabilityChips(conceptId: string | undefined) {
  return useQuery<string[], Error>({
    queryKey: KEYS.conceptCapabilities(conceptId ?? ''),
    queryFn: () => getConceptCapabilityChips(conceptId!),
    enabled: Boolean(conceptId),
    ...PHASE6_REMOTE_QUERY_OPTIONS,
  });
}

export function useStepConceptLinks(stepId: string | undefined) {
  return useQuery<StepConceptLinkRecord[], Error>({
    queryKey: KEYS.stepConceptLinks(stepId ?? ''),
    queryFn: () => getStepConceptLinks(stepId!),
    enabled: Boolean(stepId),
    ...PHASE6_REMOTE_QUERY_OPTIONS,
  });
}

export function useCreatePlaybookConcept() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<PlaybookConceptRecord, Error, CreatePlaybookConceptInput>({
    mutationFn: (input) => {
      if (!user?.id) throw new Error('Must be logged in');
      return createConcept(user.id, input);
    },
    onSuccess: (_data, variables) => {
      if (variables.playbook_id) {
        queryClient.invalidateQueries({ queryKey: KEYS.concepts(variables.playbook_id) });
        queryClient.invalidateQueries({ queryKey: KEYS.sectionCounts(variables.playbook_id) });
      }
      // useLifecycleConcepts is the Concepts zone + Librarian anchor
      // source — distinct from the per-playbook concepts cache.
      // Without this invalidation a freshly-created concept doesn't
      // appear until manual reload.
      if (user?.id && variables.interest_id) {
        queryClient.invalidateQueries({
          queryKey: KEYS.lifecycleConcepts(user.id, variables.interest_id),
        });
      }
    },
  });
}

export function useUpdatePlaybookConcept() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<
    PlaybookConceptRecord,
    Error,
    { conceptId: string; input: UpdatePlaybookConceptInput; playbookId: string }
  >({
    mutationFn: ({ conceptId, input }) => {
      if (!user?.id) throw new Error('Must be logged in');
      return updateConcept(user.id, conceptId, input);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.concepts(variables.playbookId) });
      queryClient.invalidateQueries({ queryKey: ['playbook-concept-by-slug'] });
      // Lifecycle key isn't on variables (update input is partial).
      // Invalidate by user prefix so any active interest's lifecycle
      // refetches — safe over-invalidate (one extra query at most).
      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: ['playbook-lifecycle-concepts', user.id],
        });
      }
    },
  });
}

export function useDeletePlaybookConcept() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { conceptId: string; playbookId: string }>({
    mutationFn: ({ conceptId }) => deleteConcept(conceptId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.concepts(variables.playbookId) });
      queryClient.invalidateQueries({ queryKey: KEYS.sectionCounts(variables.playbookId) });
    },
  });
}

export function useDiscardPlaybookInsight(interestId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<void, Error, { insightId: string }>({
    mutationFn: ({ insightId }) => discardInsight(insightId),
    onSuccess: () => {
      if (user?.id && interestId) {
        queryClient.invalidateQueries({ queryKey: KEYS.insights(user.id, interestId) });
      }
    },
  });
}

export function useRefinePlaybookInsight(interestId: string | undefined, playbookId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<PlaybookConceptRecord, Error, { insightId: string }>({
    mutationFn: ({ insightId }) => {
      if (!user?.id || !interestId || !playbookId) {
        throw new Error('Missing user, interest, or playbook');
      }
      return refineInsightToConcept({
        userId: user.id,
        playbookId,
        insightId,
        interestId,
      });
    },
    onSuccess: () => {
      if (user?.id && interestId) {
        queryClient.invalidateQueries({ queryKey: KEYS.insights(user.id, interestId) });
        queryClient.invalidateQueries({ queryKey: KEYS.lifecycleConcepts(user.id, interestId) });
      }
      if (playbookId) {
        queryClient.invalidateQueries({ queryKey: KEYS.concepts(playbookId) });
      }
    },
  });
}

export function useLinkConceptToStep() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { stepId: string; conceptId: string; interestId?: string; userId?: string }>({
    mutationFn: ({ stepId, conceptId }) => linkConceptToStep(stepId, conceptId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.stepConceptLinks(variables.stepId) });
      if (variables.userId && variables.interestId) {
        queryClient.invalidateQueries({
          queryKey: KEYS.lifecycleConcepts(variables.userId, variables.interestId),
        });
      }
    },
  });
}

export function useAddConceptTrailQuote(conceptId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<
    ConceptTrailQuoteRecord,
    Error,
    { captureId: string; quoteText: string; sourceLabel: string }
  >({
    mutationFn: ({ captureId, quoteText, sourceLabel }) =>
      addConceptTrailQuote({
        conceptId: conceptId!,
        captureId,
        quoteText,
        sourceLabel,
      }),
    onSuccess: () => {
      if (conceptId) {
        queryClient.invalidateQueries({ queryKey: KEYS.conceptQuotes(conceptId) });
        queryClient.invalidateQueries({ queryKey: KEYS.conceptById(conceptId) });
      }
    },
  });
}

export function usePromoteConceptToSettled(conceptId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => promoteConceptToSettled(conceptId!),
    onSuccess: () => {
      if (conceptId) {
        queryClient.invalidateQueries({ queryKey: KEYS.conceptById(conceptId) });
        queryClient.invalidateQueries({ queryKey: KEYS.conceptSteps(conceptId) });
      }
    },
  });
}

export function useForkConcept() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<
    PlaybookConceptRecord,
    Error,
    { playbookId: string; sourceConceptId: string }
  >({
    mutationFn: ({ playbookId, sourceConceptId }) => {
      if (!user?.id) throw new Error('Must be logged in');
      return forkConcept(user.id, playbookId, sourceConceptId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.concepts(variables.playbookId) });
    },
  });
}

export function usePullLatestConcept() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<
    PlaybookConceptRecord,
    Error,
    { conceptId: string; playbookId: string }
  >({
    mutationFn: ({ conceptId }) => {
      if (!user?.id) throw new Error('Must be logged in');
      return pullLatestConcept(user.id, conceptId);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.concepts(variables.playbookId) });
      queryClient.invalidateQueries({ queryKey: ['playbook-concept-by-slug'] });
    },
  });
}

export function usePlaybookPatterns(playbookId: string | undefined) {
  return useQuery<PlaybookPatternRecord[], Error>({
    queryKey: KEYS.patterns(playbookId ?? ''),
    queryFn: () => getPatterns(playbookId!),
    enabled: Boolean(playbookId),
  });
}

export function useUpdatePatternStatus() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    { patternId: string; status: 'active' | 'pinned' | 'dismissed'; playbookId: string }
  >({
    mutationFn: ({ patternId, status }) => updatePatternStatus(patternId, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.patterns(variables.playbookId) });
    },
  });
}

export function usePlaybookReviews(playbookId: string | undefined) {
  return useQuery<PlaybookReviewRecord[], Error>({
    queryKey: KEYS.reviews(playbookId ?? ''),
    queryFn: () => getReviews(playbookId!),
    enabled: Boolean(playbookId),
  });
}

export function usePlaybookQA(playbookId: string | undefined) {
  return useQuery<PlaybookQARecord[], Error>({
    queryKey: KEYS.qa(playbookId ?? ''),
    queryFn: () => getQA(playbookId!),
    enabled: Boolean(playbookId),
  });
}

export function useCreatePlaybookQA() {
  const queryClient = useQueryClient();
  return useMutation<PlaybookQARecord, Error, CreatePlaybookQAInput>({
    mutationFn: (input) => createQA(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: KEYS.qa(data.playbook_id) });
      queryClient.invalidateQueries({ queryKey: KEYS.sectionCounts(data.playbook_id) });
    },
  });
}

export function useSetQAPinned() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    { qaId: string; pinned: boolean; playbookId: string }
  >({
    mutationFn: ({ qaId, pinned }) => setQAPinned(qaId, pinned),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.qa(variables.playbookId) });
    },
  });
}

export function useDeleteQA() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { qaId: string; playbookId: string }>({
    mutationFn: ({ qaId }) => deleteQA(qaId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.qa(variables.playbookId) });
      queryClient.invalidateQueries({ queryKey: KEYS.sectionCounts(variables.playbookId) });
    },
  });
}

// ---------------------------------------------------------------------------
// 4. Suggestions queue
// ---------------------------------------------------------------------------

export function usePlaybookSuggestions(playbookId: string | undefined) {
  return useQuery<PlaybookSuggestionRecord[], Error>({
    queryKey: KEYS.suggestions(playbookId ?? ''),
    queryFn: () => getSuggestions(playbookId!),
    enabled: Boolean(playbookId),
  });
}

export function useCrossInterestSuggestionsForStep(stepId: string | undefined) {
  return useQuery<PlaybookSuggestionRecord[], Error>({
    queryKey: ['playbook-cross-interest-step', stepId ?? ''] as const,
    queryFn: () => getCrossInterestSuggestionsForStep(stepId!),
    enabled: Boolean(stepId),
  });
}

export function usePlaybookPendingSuggestionCount(
  playbookId: string | undefined,
) {
  return useQuery<number, Error>({
    queryKey: KEYS.suggestionsPendingCount(playbookId ?? ''),
    queryFn: () => countPendingSuggestions(playbookId!),
    enabled: Boolean(playbookId),
  });
}

function invalidateSuggestionChain(
  queryClient: ReturnType<typeof useQueryClient>,
  playbookId: string,
) {
  queryClient.invalidateQueries({ queryKey: KEYS.suggestions(playbookId) });
  queryClient.invalidateQueries({ queryKey: KEYS.suggestionsPendingCount(playbookId) });
  queryClient.invalidateQueries({ queryKey: KEYS.concepts(playbookId) });
  queryClient.invalidateQueries({ queryKey: KEYS.patterns(playbookId) });
  queryClient.invalidateQueries({ queryKey: KEYS.reviews(playbookId) });
  queryClient.invalidateQueries({ queryKey: KEYS.sectionCounts(playbookId) });
}

export function useAcceptSuggestion() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<void, Error, { suggestion: PlaybookSuggestionRecord }>({
    mutationFn: ({ suggestion }) => {
      if (!user?.id) throw new Error('Must be logged in');
      return acceptSuggestion(user.id, suggestion);
    },
    onSuccess: (_data, { suggestion }) => {
      invalidateSuggestionChain(queryClient, suggestion.playbook_id);
    },
  });
}

export function useEditSuggestion() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    { suggestionId: string; payload: Record<string, unknown>; playbookId: string }
  >({
    mutationFn: ({ suggestionId, payload }) =>
      editSuggestion(suggestionId, payload),
    onSuccess: (_data, variables) => {
      invalidateSuggestionChain(queryClient, variables.playbookId);
    },
  });
}

export function useRejectSuggestion() {
  const queryClient = useQueryClient();
  return useMutation<
    void,
    Error,
    { suggestionId: string; playbookId: string }
  >({
    mutationFn: ({ suggestionId }) => rejectSuggestion(suggestionId),
    onSuccess: (_data, variables) => {
      invalidateSuggestionChain(queryClient, variables.playbookId);
    },
  });
}

// ---------------------------------------------------------------------------
// 5. Raw inbox
// ---------------------------------------------------------------------------

export function usePlaybookInbox(playbookId: string | undefined) {
  return useQuery<PlaybookInboxItemRecord[], Error>({
    queryKey: KEYS.inbox(playbookId ?? ''),
    queryFn: () => getInboxItems(playbookId!),
    enabled: Boolean(playbookId),
  });
}

export function useAddInboxItem() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<
    PlaybookInboxItemRecord,
    Error,
    CreatePlaybookInboxItemInput
  >({
    mutationFn: (input) => {
      if (!user?.id) throw new Error('Must be logged in');
      return addInboxItem(user.id, input);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: KEYS.inbox(variables.playbook_id),
      });
    },
  });
}

export function useDismissInboxItem() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { itemId: string; playbookId: string }>({
    mutationFn: ({ itemId }) => dismissInboxItem(itemId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: KEYS.inbox(variables.playbookId),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// 6. Shares
// ---------------------------------------------------------------------------

export function usePlaybookShares(playbookId: string | undefined) {
  return useQuery<PlaybookShareRecord[], Error>({
    queryKey: KEYS.shares(playbookId ?? ''),
    queryFn: () => getShares(playbookId!),
    enabled: Boolean(playbookId),
  });
}

export function useCreatePlaybookShare() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<
    PlaybookShareRecord,
    Error,
    CreatePlaybookShareInput
  >({
    mutationFn: (input) => {
      if (!user?.id) throw new Error('Must be logged in');
      return createShare(user.id, input);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: KEYS.shares(variables.playbook_id),
      });
    },
  });
}

export function useRevokePlaybookShare() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { shareId: string; playbookId: string }>({
    mutationFn: ({ shareId }) => revokeShare(shareId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: KEYS.shares(variables.playbookId),
      });
    },
  });
}

export function usePlaybooksSharedWithMe() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['playbooks-shared-with-me', user?.id ?? ''] as const,
    queryFn: () => getPlaybooksSharedWithMe(user!.id),
    enabled: Boolean(user?.id),
  });
}

/**
 * Instructor dashboard: shared playbooks enriched with section counts + latest review.
 */
export function useInstructorDashboard() {
  const { data: shares = [], isLoading: sharesLoading } = usePlaybooksSharedWithMe();

  const acceptedShares = shares.filter((s) => s.invite_status === 'accepted' || s.invite_status === 'pending');

  const { data: countsMap, isLoading: countsLoading } = useQuery({
    queryKey: [
      'instructor-dashboard-counts',
      acceptedShares.map((s) => s.playbook_id).join(','),
    ] as const,
    queryFn: () =>
      getBatchSectionCounts(
        acceptedShares.map((s) => ({
          playbook_id: s.playbook_id,
          interest_id: (s as any).playbooks?.interest_id ?? '',
        })),
      ),
    enabled: acceptedShares.length > 0,
  });

  const { data: reviewsMap, isLoading: reviewsLoading } = useQuery({
    queryKey: [
      'instructor-dashboard-reviews',
      acceptedShares.map((s) => s.playbook_id).join(','),
    ] as const,
    queryFn: () =>
      getBatchLatestReviews(acceptedShares.map((s) => s.playbook_id)),
    enabled: acceptedShares.length > 0,
  });

  const { data: competencyMap, isLoading: competencyLoading } = useQuery({
    queryKey: [
      'instructor-dashboard-competencies',
      acceptedShares.map((s) => s.owner_user_id).join(','),
    ] as const,
    queryFn: () =>
      getBatchCompetencySummaries(
        acceptedShares.map((s) => ({
          user_id: s.owner_user_id,
          interest_id: (s as any).playbooks?.interest_id ?? '',
        })),
      ),
    enabled: acceptedShares.length > 0,
  });

  const students = acceptedShares.map((share) => ({
    ...share,
    counts: countsMap?.get(share.playbook_id) ?? { concepts: 0, resources: 0, patterns: 0, reviews: 0, qa: 0 },
    latestReview: reviewsMap?.get(share.playbook_id) ?? null,
    competency: competencyMap?.get(share.owner_user_id) ?? null,
  }));

  return {
    students,
    isLoading: sharesLoading || countsLoading || reviewsLoading || competencyLoading,
  };
}

// ---------------------------------------------------------------------------
// 7. Recent debriefs (from timeline_steps.metadata.review)
// ---------------------------------------------------------------------------

export function usePlaybookRecentDebriefs(interestId: string | undefined) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<RecentDebriefStep[], Error>({
    queryKey: KEYS.recentDebriefs(userId ?? '', interestId ?? ''),
    queryFn: () => getRecentDebriefs(userId!, interestId!),
    enabled: Boolean(userId) && Boolean(interestId),
  });
}

// ---------------------------------------------------------------------------
// 8. Section counts
// ---------------------------------------------------------------------------

export function usePlaybookSectionCounts(
  playbookId: string | undefined,
  interestId: string | undefined,
) {
  return useQuery<PlaybookSectionCounts, Error>({
    queryKey: KEYS.sectionCounts(playbookId ?? ''),
    queryFn: () => getSectionCounts(playbookId!, interestId!),
    enabled: Boolean(playbookId) && Boolean(interestId),
  });
}
