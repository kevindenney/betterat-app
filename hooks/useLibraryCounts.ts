/**
 * useLibraryCounts — segmented-header counts for the Library zones.
 *
 * Returns the per-zone counts the canonical header pills surface:
 * - plans     · plan_subscriptions where user owns subscription
 * - people    · user_follows where user follows N people
 * - concepts  · playbook_concepts visible to user (zero for null interest)
 * - resources · library_items the user owns
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

export function useLibraryCounts(interestId?: string | null) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<LibraryCounts>({
    queryKey: ['library-counts', userId, interestId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    queryFn: async () => {
      if (!userId) return { plans: 0, people: 0, concepts: 0, resources: 0 };

      const [plansRes, peopleRes, conceptsRes, resourcesRes] = await Promise.all([
        // Real data still flows through blueprint_subscriptions; plan_subscriptions
        // is the Wave 1 schema for future migration.
        supabase
          .from('blueprint_subscriptions')
          .select('id', { count: 'exact', head: true })
          .eq('subscriber_id', userId),
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
        supabase
          .from('library_items')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
      ]);

      return {
        plans: plansRes.count ?? 0,
        people: peopleRes.count ?? 0,
        concepts: conceptsRes.count ?? 0,
        resources: resourcesRes.count ?? 0,
      };
    },
  });
}
