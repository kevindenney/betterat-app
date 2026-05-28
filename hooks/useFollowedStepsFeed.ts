/**
 * useFollowedStepsFeed — recent step activity from people the viewer
 * follows, for the Watch tab's main feed.
 *
 * RLS on timeline_steps already exposes followed users' non-private
 * steps via the "Users can view followed users timeline steps" policy
 * (gated on visibility != private AND author's allow_follower_sharing).
 * So this is a straight join: user_follows → timeline_steps → profiles.
 *
 * v1 returns a flat feed sorted by updated_at DESC. Grouping by fleet /
 * blueprint / location is a follow-on; the returned shape already
 * carries the fields a grouped view will need.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export type FollowedStepStatus = 'planning' | 'doing' | 'reflected' | 'completed';

export interface FollowedStepItem {
  id: string;
  personId: string;
  personName: string;
  personInitial: string;
  personAvatarUrl: string | null;
  stepTitle: string;
  description: string | null;
  status: FollowedStepStatus;
  organizationName: string | null;
  locationName: string | null;
  updatedAt: string;
  /** Source blueprint id, if this step was adopted from one. Used for
   * the "by blueprint" grouping option (not yet wired). */
  sourceBlueprintId: string | null;
  /** Interest id (uuid) on the step. v2 resolves this to a vocab label
   * via the interests catalog. */
  interestId: string | null;
}

const STATUS_MAP: Record<string, FollowedStepStatus> = {
  pending: 'planning',
  in_progress: 'doing',
  settled: 'reflected',
  completed: 'completed',
};

export function useFollowedStepsFeed(
  viewerId: string | null | undefined,
  limit = 50,
) {
  return useQuery({
    queryKey: ['followed-steps-feed', viewerId, limit],
    enabled: Boolean(viewerId),
    staleTime: 30_000,
    queryFn: async (): Promise<FollowedStepItem[]> => {
      if (!viewerId) return [];

      // 1. Followed user ids — small query so we know whose steps to
      //    ask for; saves a wasted timeline_steps round-trip when the
      //    viewer follows nobody.
      const { data: follows, error: followsErr } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', viewerId);
      if (followsErr) {
        console.warn('[useFollowedStepsFeed] user_follows query failed', followsErr);
        return [];
      }
      const followedIds = (follows ?? []).map((r) => r.following_id as string);
      if (followedIds.length === 0) return [];

      // 2. Recent steps from those users. RLS handles privacy / sharing
      //    filtering ("Users can view followed users timeline steps");
      //    no need to repeat visibility/allow_follower_sharing here.
      const { data: steps, error: stepsErr } = await supabase
        .from('timeline_steps')
        .select(
          'id, user_id, title, description, status, interest_id, organization_id, source_blueprint_id, location_name, updated_at',
        )
        .in('user_id', followedIds)
        .order('updated_at', { ascending: false })
        .limit(limit);
      if (stepsErr) {
        console.warn('[useFollowedStepsFeed] timeline_steps query failed', stepsErr);
        return [];
      }
      const stepRows = (steps ?? []) as {
        id: string;
        user_id: string;
        title: string | null;
        description: string | null;
        status: string | null;
        interest_id: string | null;
        organization_id: string | null;
        source_blueprint_id: string | null;
        location_name: string | null;
        updated_at: string;
      }[];
      if (stepRows.length === 0) return [];

      // 3. Author display names. Separate query — supabase-js embed
      //    needs the FK in the queried schema, and timeline_steps.user_id
      //    references auth.users (see feedback_supabase_embed_needs_fk).
      const authorIds = Array.from(new Set(stepRows.map((s) => s.user_id)));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, avatar_url')
        .in('id', authorIds);
      const profileById = new Map<
        string,
        {
          full_name: string | null;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
        }
      >();
      for (const p of (profiles ?? []) as {
        id: string;
        full_name: string | null;
        first_name: string | null;
        last_name: string | null;
        avatar_url: string | null;
      }[]) {
        profileById.set(p.id, p);
      }

      // 4. Org names — batched so a 20-step feed is one query, not 20.
      const orgIds = Array.from(
        new Set(
          stepRows
            .map((s) => s.organization_id)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      const orgById = new Map<string, string>();
      if (orgIds.length > 0) {
        const { data: orgs } = await supabase
          .from('organizations')
          .select('id, name')
          .in('id', orgIds);
        for (const o of (orgs ?? []) as { id: string; name: string }[]) {
          orgById.set(o.id, o.name);
        }
      }

      return stepRows.map((s): FollowedStepItem => {
        const profile = profileById.get(s.user_id);
        const composed = [profile?.first_name, profile?.last_name]
          .filter(Boolean)
          .join(' ')
          .trim();
        const name =
          profile?.full_name ??
          (composed.length > 0 ? composed : 'Sailor');
        return {
          id: s.id,
          personId: s.user_id,
          personName: name,
          personInitial: name.charAt(0).toUpperCase() || '?',
          personAvatarUrl: profile?.avatar_url ?? null,
          stepTitle: s.title ?? 'Untitled step',
          description: s.description,
          status: STATUS_MAP[s.status ?? ''] ?? 'planning',
          organizationName: s.organization_id
            ? orgById.get(s.organization_id) ?? null
            : null,
          locationName: s.location_name,
          updatedAt: s.updated_at,
          sourceBlueprintId: s.source_blueprint_id,
          interestId: s.interest_id,
        };
      });
    },
  });
}
