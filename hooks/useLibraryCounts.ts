/**
 * useLibraryCounts — segmented-header counts for the Library zones.
 *
 * Returns the per-zone counts the canonical header pills surface:
 * - plans     · plan_subscriptions where user owns subscription
 * - people    · user_follows where user follows N people
 * - concepts  · playbook_concepts visible to user (zero for null interest)
 * - resources · library_items scoped to the active interest (tagged for it
 *               OR untagged) so the count matches the "See all" zone
 *
 * All four queries run in parallel with a short stale window. Counts
 * undefined while loading — callers render the chip without a number.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

interface LibraryCounts {
  plans: number;
  people: number;
  concepts: number;
  resources: number;
}

// Counts subscriptions whose published blueprint matches the active
// interest — the same scope useSubscribedPlansForLibrary applies to its
// list, so the chip count and the list never disagree. With no interest,
// counts every published subscribed blueprint (the list does the same).
async function countSubscribedPlans(
  userId: string,
  interestId: string | null,
): Promise<number> {
  const { data: subs } = await supabase
    .from('blueprint_subscriptions')
    .select('blueprint_id')
    .eq('subscriber_id', userId);
  const blueprintIds = ((subs ?? []) as { blueprint_id: string }[]).map(
    (s) => s.blueprint_id,
  );
  if (blueprintIds.length === 0) return 0;

  let bpQuery = supabase
    .from('timeline_blueprints')
    .select('id', { count: 'exact', head: true })
    .in('id', blueprintIds)
    .eq('is_published', true);
  if (interestId) bpQuery = bpQuery.eq('interest_id', interestId);
  const { count } = await bpQuery;
  return count ?? 0;
}

export function useLibraryCounts(interestId?: string | null) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<LibraryCounts>({
    queryKey: ['library-counts', userId, interestId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!userId) return { plans: 0, people: 0, concepts: 0, resources: 0 };

      const [plansCount, peopleRes, conceptsRes, resourcesRes] = await Promise.all([
        // Mirror useSubscribedPlansForLibrary so the chip count agrees with
        // the Plans list: subscriptions whose published blueprint matches the
        // active interest. A bare blueprint_subscriptions count ignores the
        // interest scope and overstates the chip ("See all 4" over a 2-row list).
        countSubscribedPlans(userId, interestId ?? null),
        supabase
          .from('user_follows')
          .select('id', { count: 'exact', head: true })
          .eq('follower_id', userId),
        // Concepts are per-user; mirror getLifecycleConcepts so the chip
        // count agrees with the list query.
        interestId
          ? supabase
              .from('playbook_concepts')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', userId)
              .eq('interest_id', interestId)
          : Promise.resolve({ count: 0 }),
        // Same RPC the preview + "See all" zone use, so the chip count
        // agrees with the list ("tagged for this interest OR untagged").
        supabase.rpc('library_items_for_interest', {
          p_interest_id: interestId ?? null,
        }),
      ]);

      return {
        plans: plansCount,
        people: peopleRes.count ?? 0,
        concepts: conceptsRes.count ?? 0,
        resources: ((resourcesRes.data ?? []) as unknown[]).length,
      };
    },
  });
}
