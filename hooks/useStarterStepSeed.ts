/**
 * useStarterStepSeed — one-shot starter step seeding for an interest.
 *
 * When the user lands on an interest with zero steps and
 * `user_interests.starter_seeded_at` is null, inserts one starter step
 * (interest-appropriate, from lib/starterSteps) tagged
 * `metadata.is_starter_sample: true` and stamps the seed timestamp so we
 * never seed twice. If the user deletes the starter, we don't recreate
 * it — the stamp respects their intent.
 *
 * The race-safe claim: the UPDATE on user_interests includes
 * `starter_seeded_at IS NULL` in the predicate, so two simultaneous
 * mounts can't both win the slot. The insert only happens on the
 * client that wins the claim.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { getStarterStepForInterest } from '@/lib/starterSteps';

interface UseStarterStepSeedArgs {
  interestId: string | null;
  interestSlug: string | null;
  /** True when we have a confirmed-empty step count for this interest. */
  hasZeroSteps: boolean;
  /** Wait for the step-count query to settle before deciding. */
  stepsLoading: boolean;
}

export function useStarterStepSeed({
  interestId,
  interestSlug,
  hasZeroSteps,
  stepsLoading,
}: UseStarterStepSeedArgs) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  // Prevent the same render cycle from firing two seeds in quick
  // succession (e.g. step query refetches before the insert completes).
  const inFlight = useRef(false);

  useEffect(() => {
    if (inFlight.current) return;
    if (!userId || !interestId || !interestSlug) return;
    if (stepsLoading) return;
    if (!hasZeroSteps) return;

    let cancelled = false;
    inFlight.current = true;

    (async () => {
      try {
        // Race-safe claim: only one client wins the UPDATE. The predicate
        // ensures we never re-seed an interest the user has already seen
        // a starter for — even if they deleted it.
        const { data: claimed, error: claimErr } = await supabase
          .from('user_interests')
          .update({ starter_seeded_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('interest_id', interestId)
          .is('starter_seeded_at', null)
          .select('id')
          .maybeSingle();
        if (cancelled) return;
        if (claimErr) {
          console.warn('[starter-seed] claim error', claimErr);
          return;
        }
        if (!claimed) {
          // Either already seeded, or the user_interests row doesn't
          // exist (guest, edge case). Nothing to do.
          return;
        }

        const starter = getStarterStepForInterest(interestSlug);
        const metadata = {
          is_starter_sample: true,
          plan: {
            what: starter.what_body,
            why: starter.why_reasoning,
            when: starter.when_label,
            how: starter.how_items,
          },
        };
        const { error: insertErr } = await supabase.from('timeline_steps').insert({
          user_id: userId,
          interest_id: interestId,
          title: starter.title,
          status: 'pending',
          category: starter.category ?? 'starter',
          sort_order: 0,
          metadata,
        });
        if (cancelled) return;
        if (insertErr) {
          console.warn('[starter-seed] insert error', insertErr);
          // Roll back the claim so we can try again next mount.
          await supabase
            .from('user_interests')
            .update({ starter_seeded_at: null })
            .eq('user_id', userId)
            .eq('interest_id', interestId);
          return;
        }

        // Refetch the timeline so the new step appears immediately.
        queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
      } finally {
        inFlight.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, interestId, interestSlug, hasZeroSteps, stepsLoading, queryClient]);
}
