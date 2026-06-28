/**
 * useInbox — TanStack Query bindings for the capture-first Inbox.
 *
 * Reads the viewer's unsorted captures and exposes the drop + triage
 * mutations. All keyed on (userId, interestId) so switching interest or
 * account refetches cleanly; mutations invalidate the same key.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import {
  archiveInsight,
  dropLink,
  dropNote,
  enrichLinkTitle,
  keepInsight,
  listInbox,
  refineToConcept,
  refineToStep,
} from '@/services/InboxService';
import type { PlaybookInsightRecord } from '@/services/QuickCaptureService';
import type { PlaybookConceptRecord } from '@/types/playbook';
import type { TimelineStepRecord } from '@/types/timeline-steps';

const inboxKey = (userId: string, interestId: string) =>
  ['inbox', userId, interestId] as const;

export function useInbox(interestId: string | undefined) {
  const { user } = useAuth();
  return useQuery<PlaybookInsightRecord[], Error>({
    queryKey: inboxKey(user?.id ?? '', interestId ?? ''),
    queryFn: () => listInbox({ userId: user!.id, interestId: interestId ?? null }),
    enabled: Boolean(user?.id),
  });
}

export function useDropLink(interestId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<PlaybookInsightRecord, Error, { url: string; note?: string | null }>({
    mutationFn: ({ url, note }) =>
      dropLink({ userId: user!.id, interestId: interestId ?? null, url, note }),
    onSuccess: (record) => {
      const key = inboxKey(user?.id ?? '', interestId ?? '');
      queryClient.invalidateQueries({ queryKey: key });
      // Fire-and-forget OG title backfill; refetch only when a title lands so
      // the row swaps from bare host → real page title without blocking capture.
      if (record.source_url) {
        enrichLinkTitle(record.id, record.source_url)
          .then((title) => {
            if (title) queryClient.invalidateQueries({ queryKey: key });
          })
          .catch(() => {});
      }
    },
  });
}

export function useDropNote(interestId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation<PlaybookInsightRecord, Error, { text: string }>({
    mutationFn: ({ text }) =>
      dropNote({ userId: user!.id, interestId: interestId ?? null, text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inboxKey(user?.id ?? '', interestId ?? '') });
    },
  });
}

export function useTriageInsight(interestId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: inboxKey(user?.id ?? '', interestId ?? '') });

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

export function useRefineInsight(interestId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: inboxKey(user?.id ?? '', interestId ?? '') });
    queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
    queryClient.invalidateQueries({ queryKey: ['playbook-concepts'] });
    queryClient.invalidateQueries({ queryKey: ['playbook-lifecycle-concepts'] });
  };

  const toStep = useMutation<TimelineStepRecord, Error, { insight: PlaybookInsightRecord }>({
    mutationFn: ({ insight }) =>
      refineToStep({ insight, userId: user!.id, interestId: interestId! }),
    onSuccess: invalidate,
  });
  const toConcept = useMutation<PlaybookConceptRecord, Error, { insight: PlaybookInsightRecord }>({
    mutationFn: ({ insight }) =>
      refineToConcept({ insight, userId: user!.id, interestId: interestId! }),
    onSuccess: invalidate,
  });
  return { toStep, toConcept };
}
