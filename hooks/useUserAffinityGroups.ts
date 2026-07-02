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
  parent_org_name: string | null;
  parent_org_slug: string | null;
  anchor_lat: number | null;
  anchor_lng: number | null;
  role?: string | null;
}

interface MembershipRow {
  group_id: string;
  role: string | null;
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

interface AffinityGroupRow {
  id: string;
  kind: AffinityGroupKind;
  name: string;
  short_name: string | null;
  interest_slug: string | null;
  parent_org_id: string | null;
  anchor_lat: number | null;
  anchor_lng: number | null;
  is_active: boolean;
}

interface ParentOrgRow {
  id: string;
  name: string;
  slug: string | null;
}

interface InterestScopeRow {
  id: string;
  slug: string;
  parent_id: string | null;
}

async function fetchParentOrgMap(groupRows: { parent_org_id: string | null }[]) {
  const orgIds = Array.from(
    new Set(groupRows.map((g) => g.parent_org_id).filter((id): id is string => Boolean(id))),
  );
  if (orgIds.length === 0) return new Map<string, ParentOrgRow>();

  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug')
    .in('id', orgIds);

  if (error || !data) return new Map<string, ParentOrgRow>();
  return new Map((data as ParentOrgRow[]).map((org) => [org.id, org]));
}

function attachParentOrgs(
  groups: (AffinityGroupRow & { role?: string | null })[],
  parentOrgById: Map<string, ParentOrgRow>,
): UserAffinityGroup[] {
  return groups.map((g) => {
    const parentOrg = g.parent_org_id ? parentOrgById.get(g.parent_org_id) : null;
    return {
      id: g.id,
      kind: g.kind,
      name: g.name,
      short_name: g.short_name,
      interest_slug: g.interest_slug,
      parent_org_id: g.parent_org_id,
      parent_org_name: parentOrg?.name ?? null,
      parent_org_slug: parentOrg?.slug ?? null,
      anchor_lat: g.anchor_lat,
      anchor_lng: g.anchor_lng,
      role: g.role,
    };
  });
}

async function fetchUserGroups(userId: string): Promise<UserAffinityGroup[]> {
  const { data, error } = await supabase
    .from('affinity_group_members')
    .select(`
      group_id,
      role,
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
  const groups = rows
    .filter((r) => Boolean(r.affinity_groups?.is_active))
    .map((r) => ({
      ...(r.affinity_groups as AffinityGroupRow),
      role: r.role,
    }));
  const parentOrgById = await fetchParentOrgMap(groups);
  return attachParentOrgs(groups, parentOrgById);
}

async function fetchInterestScopeSlugs(
  interestSlug: string | null | undefined,
): Promise<Set<string> | null> {
  if (!interestSlug) return null;

  const { data, error } = await supabase
    .from('interests')
    .select('id, slug, parent_id')
    .eq('status', 'active');

  if (error || !data) return new Set([interestSlug]);

  const rows = data as InterestScopeRow[];
  const root = rows.find((r) => r.slug === interestSlug);
  if (!root) return new Set([interestSlug]);

  const byParentId = new Map<string, InterestScopeRow[]>();
  for (const row of rows) {
    if (!row.parent_id) continue;
    const siblings = byParentId.get(row.parent_id) ?? [];
    siblings.push(row);
    byParentId.set(row.parent_id, siblings);
  }

  const slugs = new Set<string>([interestSlug]);
  const queue = [root.id];
  while (queue.length > 0) {
    const parentId = queue.shift()!;
    for (const child of byParentId.get(parentId) ?? []) {
      slugs.add(child.slug);
      queue.push(child.id);
    }
  }

  return slugs;
}

function groupMatchesInterestScope(
  group: { interest_slug: string | null },
  scopeSlugs: Set<string> | null,
): boolean {
  if (!scopeSlugs) return true;
  return Boolean(group.interest_slug && scopeSlugs.has(group.interest_slug));
}

async function fetchDiscoverableGroups(
  interestSlug: string | null | undefined,
  limit: number,
): Promise<UserAffinityGroup[]> {
  const scopeSlugs = await fetchInterestScopeSlugs(interestSlug);
  let query = supabase
    .from('affinity_groups')
    .select('id, kind, name, short_name, interest_slug, parent_org_id, anchor_lat, anchor_lng, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(limit);

  if (scopeSlugs) {
    query = query.in('interest_slug', Array.from(scopeSlugs));
  }

  const { data, error } = await query;
  if (error) throw error;
  const groups = (data ?? []) as AffinityGroupRow[];
  const parentOrgById = await fetchParentOrgMap(groups);
  return attachParentOrgs(groups, parentOrgById);
}

export function useUserAffinityGroups(interestSlug?: string | null) {
  const { user } = useAuth();
  const userId = user?.id as string | undefined;

  const query = useQuery({
    queryKey: ['user-affinity-groups', userId, interestSlug ?? 'all'],
    queryFn: async () => {
      const [groups, scopeSlugs] = await Promise.all([
        fetchUserGroups(userId!),
        fetchInterestScopeSlugs(interestSlug),
      ]);
      return groups.filter((g) => groupMatchesInterestScope(g, scopeSlugs));
    },
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  return { groups: query.data ?? [], isLoading: query.isLoading };
}

export function useDiscoverableAffinityGroups(
  interestSlug?: string | null,
  limit: number = 8,
) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['discoverable-affinity-groups', interestSlug ?? 'all', limit],
    queryFn: () => fetchDiscoverableGroups(interestSlug, limit),
    enabled: Boolean(user),
    staleTime: 5 * 60 * 1000,
  });

  return { groups: query.data ?? [], isLoading: query.isLoading };
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
