/**
 * useMyVerifiedAdminOrgs — verified orgs where the signed-in user is admin/
 * owner/manager with active membership. Drives the parent-picker in the
 * propose-adoption sheet: only verified orgs can adopt user-created ones.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { isResolvedOrgMembershipActive } from '@/hooks/orgMembershipStatus';

export interface VerifiedAdminOrg {
  id: string;
  name: string;
  slug: string | null;
  organization_type: string | null;
}

export function useMyVerifiedAdminOrgs() {
  const { user } = useAuth();
  const userId = user?.id || null;

  return useQuery<VerifiedAdminOrg[]>({
    queryKey: ['my-verified-admin-orgs', userId],
    enabled: !!userId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!userId) return [];
      // Two-step: pull membership rows, then fetch org rows. The embed
      // approach (organizations(...) join) works fine here since orgs
      // table is public-readable.
      const { data: memberships, error: memberError } = await supabase
        .from('organization_memberships')
        .select(
          'organization_id, role, status, membership_status, organizations(id, name, slug, organization_type, official, is_active)',
        )
        .eq('user_id', userId)
        .in('role', ['owner', 'admin', 'manager']);

      if (memberError) {
        return [];
      }

      const rows: VerifiedAdminOrg[] = [];
      for (const m of memberships || []) {
        if (!isResolvedOrgMembershipActive(m)) continue;
        const org = Array.isArray((m as any).organizations)
          ? (m as any).organizations[0]
          : (m as any).organizations;
        if (!org) continue;
        if (!org.official || org.is_active === false) continue;
        rows.push({
          id: org.id,
          name: org.name,
          slug: org.slug,
          organization_type: org.organization_type,
        });
      }
      return rows;
    },
  });
}
