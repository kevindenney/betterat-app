/**
 * useCohortMates — everyone with an active plan (or legacy
 * blueprint_subscription) for the blueprint that this blueprint_step
 * belongs to. Drives the small avatar-stack indicator on the step
 * discussion view: "Maya, Ariana, and 4 others on this plan".
 *
 * Returns the viewer at the head of the list so the UI can render
 * "Just you" gracefully when audience-of-one.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface CohortMate {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isViewer: boolean;
}

const STALE_MS = 60_000;

export function useCohortMates(blueprintStepId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['cohort-mates', blueprintStepId ?? 'none', user?.id ?? 'anon'],
    enabled: Boolean(blueprintStepId),
    staleTime: STALE_MS,
    queryFn: async (): Promise<CohortMate[]> => {
      if (!blueprintStepId) return [];

      // Resolve the blueprint that this step belongs to.
      const { data: bsRow } = await supabase
        .from('blueprint_steps')
        .select('blueprint_id')
        .eq('id', blueprintStepId)
        .maybeSingle();
      const blueprintId = (bsRow as { blueprint_id?: string } | null)?.blueprint_id;
      if (!blueprintId) return [];

      // Collect active plan members + legacy subscribers in parallel.
      // Dedupe by user_id below — same person can appear in both.
      const [planRes, subRes] = await Promise.all([
        supabase
          .from('plans')
          .select('user_id')
          .eq('source_blueprint_id', blueprintId)
          .eq('status', 'active'),
        supabase
          .from('blueprint_subscriptions')
          .select('subscriber_id')
          .eq('blueprint_id', blueprintId),
      ]);

      const userIds = new Set<string>();
      for (const row of (planRes.data ?? []) as { user_id: string }[]) {
        if (row.user_id) userIds.add(row.user_id);
      }
      for (const row of (subRes.data ?? []) as { subscriber_id: string }[]) {
        if (row.subscriber_id) userIds.add(row.subscriber_id);
      }
      if (userIds.size === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, avatar_url')
        .in('id', Array.from(userIds));

      const viewerId = user?.id ?? null;
      const mates: CohortMate[] = ((profiles ?? []) as {
        id: string;
        full_name: string | null;
        first_name: string | null;
        last_name: string | null;
        avatar_url: string | null;
      }[]).map((row) => ({
        userId: row.id,
        displayName:
          row.full_name?.trim() ||
          [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
          'Sailor',
        avatarUrl: row.avatar_url,
        isViewer: row.id === viewerId,
      }));

      // Viewer first, then alphabetical by display name.
      mates.sort((a, b) => {
        if (a.isViewer && !b.isViewer) return -1;
        if (!a.isViewer && b.isViewer) return 1;
        return a.displayName.localeCompare(b.displayName);
      });

      return mates;
    },
  });
}
