/**
 * useStepsDiscussionUnread — batched per-step Discussion unread counts for a
 * set of timeline steps, so L2 step covers can light an unread dot without
 * firing useStepDiscussionPeek (≈5 round-trips) per card.
 *
 * Three queries total regardless of how many steps are passed:
 *   1. resolve each step's source_blueprint_step_id (cohort threads are keyed
 *      there and SHARED across every forked copy),
 *   2. the viewer's per-step last_seen_at,
 *   3. the root notes across all involved threads (private + cohort).
 * Unread is then tallied client-side against each step's last_seen threshold.
 * Returns a { [stepId]: unreadCount } map (steps with 0 unread are omitted).
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

type UnreadMap = Record<string, number>;

export function useStepsDiscussionUnread(stepIds: string[]) {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;
  // Sort so the cache key is order-independent (the carousel reorders steps).
  const sortedKey = useMemo(() => [...stepIds].sort().join(','), [stepIds]);

  return useQuery<UnreadMap>({
    queryKey: ['steps-discussion-unread', sortedKey, viewerId],
    queryFn: async () => {
      const result: UnreadMap = {};
      if (stepIds.length === 0 || !viewerId) return result;

      // 1. Resolve cohort thread keys for these steps.
      const { data: stepRows } = await supabase
        .from('timeline_steps')
        .select('id, source_blueprint_step_id')
        .in('id', stepIds);

      const blueprintStepByStep = new Map<string, string | null>();
      const stepsByBlueprintStep = new Map<string, string[]>();
      const blueprintStepIds: string[] = [];
      ((stepRows as { id: string; source_blueprint_step_id: string | null }[] | null) ?? []).forEach(
        (row) => {
          const bs = row.source_blueprint_step_id ?? null;
          blueprintStepByStep.set(row.id, bs);
          if (bs) {
            blueprintStepIds.push(bs);
            const arr = stepsByBlueprintStep.get(bs) ?? [];
            arr.push(row.id);
            stepsByBlueprintStep.set(bs, arr);
          }
        },
      );

      // 2. Viewer's per-step last-seen thresholds.
      const { data: viewRows } = await supabase
        .from('step_discussion_views')
        .select('step_id, last_seen_at')
        .eq('user_id', viewerId)
        .in('step_id', stepIds);

      const lastSeenByStep = new Map<string, string | null>();
      ((viewRows as { step_id: string; last_seen_at: string | null }[] | null) ?? []).forEach(
        (row) => lastSeenByStep.set(row.step_id, row.last_seen_at ?? null),
      );

      // 3. Root notes across the private (step_id) and cohort (blueprint_step_id)
      //    threads, not authored by the viewer.
      const orParts = [`step_id.in.(${stepIds.join(',')})`];
      if (blueprintStepIds.length) {
        orParts.push(`blueprint_step_id.in.(${blueprintStepIds.join(',')})`);
      }
      const { data: notes } = await supabase
        .from('step_discussions')
        .select('step_id, blueprint_step_id, user_id, created_at')
        .is('parent_id', null)
        .neq('user_id', viewerId)
        .or(orParts.join(','));

      ((notes as {
        step_id: string | null;
        blueprint_step_id: string | null;
        user_id: string;
        created_at: string;
      }[] | null) ?? []).forEach((note) => {
        // A note can fan into multiple of our steps: a cohort post reaches every
        // forked copy sharing its blueprint_step_id.
        const targets = new Set<string>();
        if (note.step_id && blueprintStepByStep.has(note.step_id)) {
          targets.add(note.step_id);
        }
        if (note.blueprint_step_id) {
          (stepsByBlueprintStep.get(note.blueprint_step_id) ?? []).forEach((sid) =>
            targets.add(sid),
          );
        }
        targets.forEach((sid) => {
          const lastSeen = lastSeenByStep.get(sid) ?? null;
          if (!lastSeen || new Date(note.created_at) > new Date(lastSeen)) {
            result[sid] = (result[sid] ?? 0) + 1;
          }
        });
      });

      return result;
    },
    enabled: stepIds.length > 0 && Boolean(viewerId),
    staleTime: 30 * 1000,
  });
}
