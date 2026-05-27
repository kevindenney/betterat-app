/**
 * useStepPeerReflections — fetches peer_reflections rows whose
 * target_step_id is in the given step list, with the reflector's
 * display name resolved via a second profiles query.
 *
 * Feeds the L3/L4 INPUT lane: each reflection adds its source_user_id
 * to the chart at the target step's week. peer_reflections is the
 * cleanest of the four input channels because target_step_id directly
 * links back to one of the viewer's timeline_steps — no date
 * projection needed.
 *
 * profiles can't be embed-joined off auth.users — split into two
 * queries (feedback_supabase_embed_needs_fk).
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface StepPeerReflectionRow {
  reflectionId: string;
  targetStepId: string;
  peerUserId: string;
  peerDisplayName: string | null;
  createdAt: string;
}

const STALE_MS = 30_000;

export function useStepPeerReflections(stepIds: string[]) {
  const key = useMemo(() => {
    if (!stepIds || stepIds.length === 0) return 'empty';
    return [...stepIds].sort().join(',');
  }, [stepIds]);

  return useQuery({
    queryKey: ['step-peer-reflections', key],
    enabled: stepIds.length > 0,
    staleTime: STALE_MS,
    queryFn: async (): Promise<Map<string, StepPeerReflectionRow[]>> => {
      if (stepIds.length === 0) return new Map();
      const { data: rRaw, error } = await supabase
        .from('peer_reflections')
        .select('id, source_user_id, target_step_id, created_at')
        .in('target_step_id', stepIds)
        .in('status', ['unread', 'read']);
      if (error) throw error;
      const rows = (rRaw ?? []) as {
        id: string;
        source_user_id: string;
        target_step_id: string;
        created_at: string;
      }[];
      if (rows.length === 0) return new Map();

      const peerIds = Array.from(new Set(rows.map((r) => r.source_user_id)));
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name')
        .in('id', peerIds);
      const profById = new Map<
        string,
        { full_name: string | null; first_name: string | null; last_name: string | null }
      >();
      for (const p of (profs ?? []) as {
        id: string;
        full_name: string | null;
        first_name: string | null;
        last_name: string | null;
      }[]) {
        profById.set(p.id, {
          full_name: p.full_name,
          first_name: p.first_name,
          last_name: p.last_name,
        });
      }
      const looksLikeEmail = (s: string | null | undefined) => !!s && /\S+@\S+\.\S+/.test(s);
      const nameOf = (id: string): string | null => {
        const p = profById.get(id);
        if (!p) return null;
        const composed = [p.first_name, p.last_name]
          .map((s) => s?.trim())
          .filter(Boolean)
          .join(' ');
        if (composed) return composed;
        const f = p.full_name?.trim() ?? null;
        return looksLikeEmail(f) ? null : f;
      };

      const map = new Map<string, StepPeerReflectionRow[]>();
      for (const r of rows) {
        const entry: StepPeerReflectionRow = {
          reflectionId: r.id,
          targetStepId: r.target_step_id,
          peerUserId: r.source_user_id,
          peerDisplayName: nameOf(r.source_user_id),
          createdAt: r.created_at,
        };
        const existing = map.get(r.target_step_id);
        if (existing) existing.push(entry);
        else map.set(r.target_step_id, [entry]);
      }
      return map;
    },
  });
}
