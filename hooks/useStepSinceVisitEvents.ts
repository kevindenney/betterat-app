/**
 * useStepSinceVisitEvents — feed for the §C-Sun "since your last visit" strip.
 *
 * v1 scope: surface up to 3 recent events on a step that the viewer hasn't
 * authored themselves. Events are sourced from:
 *   - step_discussions  → peer-note / coach-reply
 *
 * Per-user last-visit tracking isn't wired yet, so for now we treat "recent"
 * as within the last 7 days. When the visit-marker table lands, swap the
 * threshold for "since visit.last_seen_at".
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import type { SinceVisitEvent } from '@/components/step/SinceLastVisitStrip';

const RECENT_DAYS = 7;

export function useStepSinceVisitEvents(stepId: string | null | undefined) {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  return useQuery<SinceVisitEvent[]>({
    queryKey: ['step-since-visit-events', stepId, viewerId],
    queryFn: async () => {
      try {
        if (!stepId) return [];
        const sinceIso = new Date(
          Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString();

        const { data: rows } = await supabase
          .from('step_discussions')
          .select('id, user_id, body, is_coach_reply, created_at')
          .eq('step_id', stepId)
          .gte('created_at', sinceIso)
          .order('created_at', { ascending: false })
          .limit(8);
        const all =
          (rows as {
            id: string;
            user_id: string;
            body: string;
            is_coach_reply: boolean;
            created_at: string;
          }[] | null) ?? [];

        // Exclude the viewer's own posts.
        const filtered = all.filter((r) => r.user_id !== viewerId);
        if (filtered.length === 0) return [];

        // Hydrate author names.
        const userIds = [...new Set(filtered.map((r) => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        const nameById = new Map(
          ((profiles as { id: string; full_name: string | null }[] | null) ?? []).map((p) => [
            p.id,
            p.full_name,
          ]),
        );

        const events: SinceVisitEvent[] = filtered.slice(0, 3).map((row) => {
          const name = nameById.get(row.user_id) ?? 'A peer';
          const firstName = name.split(/\s+/)[0] ?? name;
          const snippet = row.body
            .trim()
            .replace(/^["“”]+|["“”]+$/g, '')
            .slice(0, 80);
          return {
            id: row.id,
            kind: row.is_coach_reply ? 'coach-reply' : 'peer-note',
            summary: row.is_coach_reply
              ? `${firstName} replied: ${snippet}${snippet.length >= 80 ? '…' : ''}`
              : `${firstName} noted: ${snippet}${snippet.length >= 80 ? '…' : ''}`,
          };
        });
        return events;
      } catch {
        return [];
      }
    },
    enabled: Boolean(stepId),
    staleTime: 60 * 1000,
  });
}
