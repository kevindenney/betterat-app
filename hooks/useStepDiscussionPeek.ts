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
import { useAuth } from '@/providers/AuthProvider';
import { isPersistedRaceId } from '@/lib/races/isPersistedRaceId';

export interface StepDiscussionPeekData {
  noteCount: number;
  unreadCount: number;
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
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  return useQuery<StepDiscussionPeekData | null>({
    queryKey: ['step-discussion-peek', stepId, viewerId],
    queryFn: async () => {
      try {
        if (!stepId) return null;

        // Cohort posts live at the blueprint_step level (step_id NULL,
        // blueprint_step_id set) and are SHARED across every plan member's
        // forked copy. Resolve this step's blueprint_step link so the peek
        // counts both the private per-step thread AND the cohort thread —
        // otherwise a cohort-only conversation never lights the badge.
        const { data: stepRow } = await supabase
          .from('timeline_steps')
          .select('source_blueprint_step_id')
          .eq('id', stepId)
          .maybeSingle();
        const blueprintStepId =
          (stepRow as { source_blueprint_step_id?: string | null } | null)
            ?.source_blueprint_step_id ?? null;

        // Match rows on either thread key. PostgREST `or` is combined with the
        // other filters via AND, so the parent_id / unread filters still apply.
        const threadFilter = blueprintStepId
          ? `step_id.eq.${stepId},blueprint_step_id.eq.${blueprintStepId}`
          : `step_id.eq.${stepId}`;

        const { count } = await supabase
          .from('step_discussions')
          .select('id', { count: 'exact', head: true })
          .or(threadFilter)
          .is('parent_id', null);

        if (!count || count === 0) return null;

        let unreadCount = 0;
        if (viewerId) {
          const { data: viewRow } = await supabase
            .from('step_discussion_views')
            .select('last_seen_at')
            .eq('step_id', stepId)
            .eq('user_id', viewerId)
            .maybeSingle();
          const lastSeenAt =
            (viewRow as { last_seen_at?: string } | null)?.last_seen_at ?? null;

          let unreadQuery = supabase
            .from('step_discussions')
            .select('id', { count: 'exact', head: true })
            .or(threadFilter)
            .neq('user_id', viewerId);
          if (lastSeenAt) unreadQuery = unreadQuery.gt('created_at', lastSeenAt);
          const { count: unread } = await unreadQuery;
          unreadCount = unread ?? 0;
        }

        const { data: latestRow } = await supabase
          .from('step_discussions')
          .select('id, body, user_id, created_at')
          .or(threadFilter)
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
          unreadCount,
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
    enabled: isPersistedRaceId(stepId),
    staleTime: 30 * 1000,
  });
}
