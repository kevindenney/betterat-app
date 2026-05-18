/**
 * useStepDiscussionPeek — load a compact summary of a step's Discussion thread
 * so StepDiscussionPeek can render the latest activity inline on the step
 * screen without round-tripping through the fullscreen Discussion route.
 *
 * Returns the most-recent root note + total note count. Returns null if there
 * are no notes (caller skips rendering the peek). Tap routes to the existing
 * fullscreen Discussion at /practice/step/[id]/discussion.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface StepDiscussionPeekData {
  noteCount: number;
  latest: {
    id: string;
    body: string;
    authorName: string | null;
    authorInitials: string | null;
    createdAt: string;
  };
}

function initialsFrom(name: string | null): string | null {
  if (!name) return null;
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || null
  );
}

export function useStepDiscussionPeek(stepId: string | null | undefined) {
  return useQuery<StepDiscussionPeekData | null>({
    queryKey: ['step-discussion-peek', stepId],
    queryFn: async () => {
      try {
        if (!stepId) return null;

        const { count } = await supabase
          .from('step_discussions')
          .select('id', { count: 'exact', head: true })
          .eq('step_id', stepId)
          .is('parent_id', null);

        if (!count || count === 0) return null;

        const { data: latestRow } = await supabase
          .from('step_discussions')
          .select('id, body, user_id, created_at')
          .eq('step_id', stepId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!latestRow) return null;

        const row = latestRow as {
          id: string;
          body: string;
          user_id: string;
          created_at: string;
        };

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', row.user_id)
          .maybeSingle();
        const authorName =
          ((profile as { full_name?: string | null } | null)?.full_name) ?? null;

        return {
          noteCount: count,
          latest: {
            id: row.id,
            body: row.body,
            authorName,
            authorInitials: initialsFrom(authorName),
            createdAt: row.created_at,
          },
        };
      } catch {
        return null;
      }
    },
    enabled: Boolean(stepId),
    staleTime: 30 * 1000,
  });
}
