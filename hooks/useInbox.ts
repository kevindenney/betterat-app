/**
 * useInbox — TanStack Query bindings for the capture-first Inbox.
 *
 * Reads the viewer's unsorted captures and exposes the drop + triage
 * mutations. Reads can be global or interest-scoped; mutations invalidate the
 * viewer's whole inbox keyspace so cross-interest surfaces stay in sync.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import {
  archiveInsight,
  countUnsortedInbox,
  dropLink,
  dropNote,
  enrichLinkTitle,
  keepInsight,
  listInbox,
  refineToBlueprint,
  refineToConcept,
  refineToResource,
  refineToStep,
} from '@/services/InboxService';
import type { PlaybookInsightRecord } from '@/services/QuickCaptureService';
import type { PlaybookConceptRecord } from '@/types/playbook';
import type { TimelineStepRecord } from '@/types/timeline-steps';

const inboxKey = (userId: string, interestId?: string | null) =>
  ['inbox', userId, interestId ?? 'all'] as const;

const unsortedCountKey = (userId: string) =>
  ['inbox-unsorted-count', userId] as const;

export function useInbox(interestId?: string | null) {
  const { user } = useAuth();
  return useQuery<PlaybookInsightRecord[], Error>({
    queryKey: inboxKey(user?.id ?? '', interestId),
    queryFn: () => listInbox({ userId: user!.id, interestId: interestId ?? null }),
    enabled: Boolean(user?.id),
  });
}

/**
 * Cross-interest count of unsorted captures, for the Library tab badge. Kept on
 * its own key (not derived from useInbox, which is interest-scoped) so the badge
 * reflects everything still to triage regardless of the active interest.
 */
export function useUnsortedInboxCount() {
  const { user } = useAuth();
  return useQuery<number, Error>({
    queryKey: unsortedCountKey(user?.id ?? ''),
    queryFn: () => countUnsortedInbox(user!.id),
    enabled: Boolean(user?.id),
  });
}

export function useDropLink(interestId?: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<PlaybookInsightRecord, Error, { url: string; note?: string | null }>({
    mutationFn: ({ url, note }) =>
      dropLink({ userId: user!.id, interestId: interestId ?? null, url, note }),
    onSuccess: (record) => {
      const userId = user?.id ?? '';
      queryClient.invalidateQueries({ queryKey: ['inbox', userId] });
      queryClient.invalidateQueries({ queryKey: unsortedCountKey(user?.id ?? '') });
      // Fire-and-forget OG title backfill; refetch only when a title lands so
      // the row swaps from bare host → real page title without blocking capture.
      if (record.source_url) {
        enrichLinkTitle(record.id, record.source_url)
          .then((title) => {
            if (title) queryClient.invalidateQueries({ queryKey: ['inbox', userId] });
          })
          .catch(() => {});
      }
    },
  });
}

export function useDropNote(interestId?: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<PlaybookInsightRecord, Error, { text: string }>({
    mutationFn: ({ text }) =>
      dropNote({ userId: user!.id, interestId: interestId ?? null, text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox', user?.id ?? ''] });
      queryClient.invalidateQueries({ queryKey: unsortedCountKey(user?.id ?? '') });
    },
  });
}

export function useTriageInsight(_interestId?: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inbox', user?.id ?? ''] });
    queryClient.invalidateQueries({ queryKey: unsortedCountKey(user?.id ?? '') });
  };

  const keep = useMutation<void, Error, { insightId: string }>({
    mutationFn: ({ insightId }) => keepInsight(insightId),
    onSuccess: invalidate,
  });
  const archive = useMutation<void, Error, { insightId: string }>({
    mutationFn: ({ insightId }) => archiveInsight(insightId),
    onSuccess: invalidate,
  });
  return { keep, archive };
}

function resolveTargetInterestId(
  insight: PlaybookInsightRecord,
  selectedInterestId?: string | null,
  fallbackInterestId?: string | null,
): string {
  const targetInterestId = selectedInterestId ?? insight.interest_id ?? fallbackInterestId ?? null;
  if (!targetInterestId) {
    throw new Error('Choose an interest for this inbox item first.');
  }
  return targetInterestId;
}

export function useRefineInsight(fallbackInterestId?: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inbox', user?.id ?? ''] });
    queryClient.invalidateQueries({ queryKey: unsortedCountKey(user?.id ?? '') });
    queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
    queryClient.invalidateQueries({ queryKey: ['playbook-concepts'] });
    queryClient.invalidateQueries({ queryKey: ['playbook-lifecycle-concepts'] });
    queryClient.invalidateQueries({ queryKey: ['library-counts'] });
    queryClient.invalidateQueries({ queryKey: ['library-resources-preview'] });
    queryClient.invalidateQueries({ queryKey: ['library-resources'] });
    queryClient.invalidateQueries({ queryKey: ['library-zones-data'] });
  };

  const toStep = useMutation<
    TimelineStepRecord,
    Error,
    {
      insight: PlaybookInsightRecord;
      interestId?: string | null;
      title?: string | null;
      description?: string | null;
    }
  >({
    mutationFn: ({ insight, interestId, title, description }) =>
      refineToStep({
        insight,
        userId: user!.id,
        interestId: resolveTargetInterestId(insight, interestId, fallbackInterestId),
        title,
        description,
      }),
    onSuccess: invalidate,
  });
  const toConcept = useMutation<
    PlaybookConceptRecord,
    Error,
    {
      insight: PlaybookInsightRecord;
      interestId?: string | null;
      title?: string | null;
      body?: string | null;
    }
  >({
    mutationFn: ({ insight, interestId, title, body }) =>
      refineToConcept({
        insight,
        userId: user!.id,
        interestId: resolveTargetInterestId(insight, interestId, fallbackInterestId),
        title,
        body,
      }),
    onSuccess: invalidate,
  });
  const toResource = useMutation<
    { id: string },
    Error,
    { insight: PlaybookInsightRecord; interestId?: string | null; title?: string | null }
  >({
    mutationFn: ({ insight, interestId, title }) =>
      refineToResource({
        insight,
        userId: user!.id,
        interestId: resolveTargetInterestId(insight, interestId, fallbackInterestId),
        title,
      }),
    onSuccess: invalidate,
  });
  // The blueprint itself is built by the Get Inspired wizard; this mutation only
  // stamps the insight refined→blueprint once the wizard returns a blueprintId.
  const toBlueprint = useMutation<
    void,
    Error,
    { insight: PlaybookInsightRecord; blueprintId: string }
  >({
    mutationFn: ({ insight, blueprintId }) => refineToBlueprint({ insight, blueprintId }),
    onSuccess: invalidate,
  });
  return { toStep, toConcept, toResource, toBlueprint };
}
