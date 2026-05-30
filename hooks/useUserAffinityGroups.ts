/**
 * useUserAffinityGroups — list the current user's active affinity
 * groups (class-fleets, cohorts, crew pods, practice groups).
 *
 * Atlas surfaces these as contextual sub-chips under the Fleet/Crew
 * filter when the chip row is expanded. Selecting one scopes peer
 * pins to just that group's roster (see `useGroupMemberIds`).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export type AffinityGroupKind = 'class_fleet' | 'cohort' | 'crew_pod' | 'practice_group';

export interface UserAffinityGroup {
  id: string;
  kind: AffinityGroupKind;
  name: string;
  short_name: string | null;
  interest_slug: string | null;
  parent_org_id: string | null;
  anchor_lat: number | null;
  anchor_lng: number | null;
}

interface MembershipRow {
  group_id: string;
  affinity_groups: {
    id: string;
    kind: AffinityGroupKind;
    name: string;
    short_name: string | null;
    interest_slug: string | null;
    parent_org_id: string | null;
    anchor_lat: number | null;
    anchor_lng: number | null;
    is_active: boolean;
  } | null;
}

async function fetchUserGroups(userId: string): Promise<UserAffinityGroup[]> {
  const { data, error } = await supabase
    .from('affinity_group_members')
    .select(`
      group_id,
      affinity_groups (
        id, kind, name, short_name, interest_slug,
        parent_org_id, anchor_lat, anchor_lng, is_active
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'active');

  if (error) throw error;
  if (!data) return [];

  const rows = data as unknown as MembershipRow[];
  return rows
    .map((r) => r.affinity_groups)
    .filter((g): g is NonNullable<MembershipRow['affinity_groups']> => Boolean(g?.is_active))
    .map((g) => ({
      id: g.id,
      kind: g.kind,
      name: g.name,
      short_name: g.short_name,
      interest_slug: g.interest_slug,
      parent_org_id: g.parent_org_id,
      anchor_lat: g.anchor_lat,
      anchor_lng: g.anchor_lng,
    }));
}

export function useUserAffinityGroups(interestSlug?: string | null) {
  const { user } = useAuth();
  const userId = user?.id as string | undefined;

  const query = useQuery({
    queryKey: ['user-affinity-groups', userId],
    queryFn: () => fetchUserGroups(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  const groups = query.data ?? [];
  const filtered = interestSlug
    ? groups.filter((g) => !g.interest_slug || g.interest_slug === interestSlug)
    : groups;

  return { groups: filtered, isLoading: query.isLoading };
}

/**
 * Pin tone the chip-row should use to render a group's sub-chip dot.
 * Mirrors the relationship label `atlas_peer_steps_near` would emit
 * for a member of that group, so the chip color matches the pin color.
 */
export function affinityGroupTone(kind: AffinityGroupKind): 'you' | 'crew' | 'fleet' | 'cohort' {
  switch (kind) {
    case 'crew_pod':
      return 'crew';
    case 'cohort':
      return 'cohort';
    case 'class_fleet':
    case 'practice_group':
    default:
      return 'fleet';
  }
}
