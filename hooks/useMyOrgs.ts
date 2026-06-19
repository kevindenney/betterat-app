/**
 * useMyOrgs — every organization the signed-in user belongs to with an active
 * membership, plus their role. Cross-interest: membership isn't scoped to the
 * active interest, so an org you own in one interest is reachable while you're
 * browsing another.
 *
 * Powers the "Managed by you" pin on Discover → Orgs and the My Orgs section on Profile.
 * useMyVerifiedAdminOrgs (verified-only, admin-only) stays separate for the
 * propose-adoption parent picker.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback';

export type MyOrgRole = 'owner' | 'admin' | 'manager' | 'member' | string;

export interface MyOrg {
  id: string;
  name: string;
  slug: string | null;
  organization_type: string | null;
  interest_slug: string | null;
  official: boolean;
  role: MyOrgRole;
}

const ROLE_RANK: Record<string, number> = {
  owner: 0,
  admin: 1,
  manager: 2,
  member: 3,
};

export function isAdminRole(role: MyOrgRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager';
}

export function useMyOrgs() {
  const { user } = useAuth();
  const userId = user?.id || null;

  return useQuery<MyOrg[]>({
    queryKey: ['my-orgs', userId],
    enabled: !!userId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!userId) return [];
      // Two-step embed: orgs table is public-readable, so the join is safe.
      let result = await supabase
        .from('organization_memberships')
        .select(
          'organization_id, role, status, membership_status, organizations(id, name, slug, organization_type, interest_slug, official, is_active)',
        )
        .eq('user_id', userId);

      if (
        result.error &&
        isMissingSupabaseColumn(result.error, 'organizations.interest_slug')
      ) {
        result = await supabase
          .from('organization_memberships')
          .select(
            'organization_id, role, status, membership_status, organizations(id, name, slug, organization_type, official, is_active)',
          )
          .eq('user_id', userId);
      }

      const { data, error } = result;
      if (error) return [];

      const rows: MyOrg[] = [];
      for (const m of data || []) {
        const status = (m as any).status || (m as any).membership_status;
        const active = status === 'active' || status === 'invite_accepted';
        if (!active) continue;
        const org = Array.isArray((m as any).organizations)
          ? (m as any).organizations[0]
          : (m as any).organizations;
        if (!org || org.is_active === false) continue;
        rows.push({
          id: org.id,
          name: org.name,
          slug: org.slug,
          organization_type: org.organization_type ?? null,
          interest_slug: org.interest_slug ?? null,
          official: org.official ?? false,
          role: (m as any).role || 'member',
        });
      }

      rows.sort((a, b) => {
        const ra = ROLE_RANK[a.role] ?? 99;
        const rb = ROLE_RANK[b.role] ?? 99;
        if (ra !== rb) return ra - rb;
        return a.name.localeCompare(b.name);
      });
      return rows;
    },
  });
}
