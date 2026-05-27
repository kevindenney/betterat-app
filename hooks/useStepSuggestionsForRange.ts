/**
 * useStepSuggestionsForRange — fetch step_suggestions involving the
 * viewer (sent or received) within a date range, with peer display
 * info resolved from profiles.
 *
 * Feeds the L3/L4 INPUT lane on the timeline-zoom: each suggestion
 * places its counterpart peer at the week of created_at, so "Coach
 * Murphy sent you three suggestions in week 2" surfaces as three
 * dots on Murphy's row at week 2.
 *
 * Profiles can't be embed-joined off auth.users — split into two
 * queries (feedback_supabase_embed_needs_fk).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface StepSuggestionInputRow {
  id: string;
  createdAt: string;
  peerUserId: string;
  peerDisplayName: string | null;
  direction: 'sent' | 'received';
}

interface Args {
  viewerUserId: string | null | undefined;
  rangeStart: string | null | undefined;
  rangeEnd: string | null | undefined;
}

const STALE_MS = 30_000;

export function useStepSuggestionsForRange({ viewerUserId, rangeStart, rangeEnd }: Args) {
  return useQuery({
    queryKey: ['step-suggestions-range', viewerUserId, rangeStart, rangeEnd],
    enabled: Boolean(viewerUserId && rangeStart && rangeEnd),
    staleTime: STALE_MS,
    queryFn: async (): Promise<StepSuggestionInputRow[]> => {
      if (!viewerUserId || !rangeStart || !rangeEnd) return [];
      const { data: sugg, error } = await supabase
        .from('step_suggestions')
        .select('id, source_user_id, target_user_id, created_at')
        .or(`source_user_id.eq.${viewerUserId},target_user_id.eq.${viewerUserId}`)
        .gte('created_at', rangeStart)
        .lte('created_at', rangeEnd);
      if (error) throw error;
      const rows = (sugg ?? []) as {
        id: string;
        source_user_id: string;
        target_user_id: string;
        created_at: string;
      }[];
      if (rows.length === 0) return [];

      const peerIds = Array.from(
        new Set(
          rows.map((r) =>
            r.source_user_id === viewerUserId ? r.target_user_id : r.source_user_id,
          ),
        ),
      );

      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name')
        .in('id', peerIds);
      const profByid = new Map<string, { full_name: string | null; first_name: string | null; last_name: string | null }>();
      for (const p of (profs ?? []) as { id: string; full_name: string | null; first_name: string | null; last_name: string | null }[]) {
        profByid.set(p.id, { full_name: p.full_name, first_name: p.first_name, last_name: p.last_name });
      }
      const looksLikeEmail = (s: string | null | undefined) => !!s && /\S+@\S+\.\S+/.test(s);
      const nameOf = (id: string) => {
        const p = profByid.get(id);
        if (!p) return null;
        const composed = [p.first_name, p.last_name].map((s) => s?.trim()).filter(Boolean).join(' ');
        if (composed) return composed;
        const f = p.full_name?.trim() ?? null;
        return looksLikeEmail(f) ? null : f;
      };

      return rows.map((r): StepSuggestionInputRow => {
        const direction: 'sent' | 'received' =
          r.source_user_id === viewerUserId ? 'sent' : 'received';
        const peerUserId =
          direction === 'sent' ? r.target_user_id : r.source_user_id;
        return {
          id: r.id,
          createdAt: r.created_at,
          peerUserId,
          peerDisplayName: nameOf(peerUserId),
          direction,
        };
      });
    },
  });
}
