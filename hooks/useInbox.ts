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
  keepInsight,
  listInbox,
} from '@/services/InboxService';
import type { PlaybookInsightRecord } from '@/services/QuickCaptureService';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inboxKey(user?.id ?? '', interestId ?? '') });
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
