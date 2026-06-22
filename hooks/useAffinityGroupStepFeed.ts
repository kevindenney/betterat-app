/**
 * useAffinityGroupStepFeed — recent step activity from members of an affinity
 * group, for Watch > Groups. Affinity groups are the generic group primitive
 * used by non-sailing interests (study groups, founder circles, crew pods).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { coarseLocationLabel } from '@/hooks/useNearestNamedPlace';
import type { FollowedStepItem, FollowedStepStatus } from '@/hooks/useFollowedStepsFeed';

const STATUS_MAP: Record<string, FollowedStepStatus> = {
  pending: 'planning',
  in_progress: 'doing',
  settled: 'reflected',
  completed: 'completed',
};

interface TimelineStepRow {
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
}

export function useAffinityGroupStepFeed(
  groupId: string | null | undefined,
  interestId?: string | null,
  limit = 50,
) {
  const { user } = useAuth();
  const viewerId = user?.id as string | undefined;

  return useQuery({
    queryKey: ['affinity-group-step-feed', groupId, interestId ?? null, viewerId ?? null, limit],
    enabled: Boolean(groupId && viewerId),
    staleTime: 30_000,
    queryFn: async (): Promise<FollowedStepItem[]> => {
      if (!groupId || !viewerId) return [];

      const { data: members, error: membersErr } = await supabase
        .from('affinity_group_members')
        .select('user_id')
        .eq('group_id', groupId)
        .eq('status', 'active');

      if (membersErr) {
        console.warn('[useAffinityGroupStepFeed] group member query failed', membersErr);
        return [];
      }

      const memberIds = (members ?? [])
        .map((row) => row.user_id as string)
        .filter((id) => id && id !== viewerId);
      if (memberIds.length === 0) return [];

      let stepQuery = supabase
        .from('timeline_steps')
        .select(
          'id, user_id, title, description, status, interest_id, organization_id, source_blueprint_id, location_name, updated_at',
        )
        .in('user_id', memberIds)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (interestId) {
        stepQuery = stepQuery.eq('interest_id', interestId);
      }

      const { data: steps, error: stepsErr } = await stepQuery;
      if (stepsErr) {
        console.warn('[useAffinityGroupStepFeed] timeline_steps query failed', stepsErr);
        return [];
      }

      const stepRows = (steps ?? []) as TimelineStepRow[];
      if (stepRows.length === 0) return [];

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
        for (const org of (orgs ?? []) as { id: string; name: string }[]) {
          orgById.set(org.id, org.name);
        }
      }

      return stepRows.map((step): FollowedStepItem => {
        const profile = profileById.get(step.user_id);
        const composed = [profile?.first_name, profile?.last_name]
          .filter(Boolean)
          .join(' ')
          .trim();
        const name = profile?.full_name ?? (composed.length > 0 ? composed : 'Group member');
        return {
          id: step.id,
          personId: step.user_id,
          personName: name,
          personInitial: name.charAt(0).toUpperCase() || '?',
          personAvatarUrl: profile?.avatar_url ?? null,
          stepTitle: step.title ?? 'Untitled step',
          description: step.description,
          status: STATUS_MAP[step.status ?? ''] ?? 'planning',
          organizationName: step.organization_id ? orgById.get(step.organization_id) ?? null : null,
          locationName: coarseLocationLabel(step.location_name),
          updatedAt: step.updated_at,
          sourceBlueprintId: step.source_blueprint_id,
          interestId: step.interest_id,
        };
      });
    },
  });
}
