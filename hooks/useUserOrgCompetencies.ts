/**
 * useUserOrgCompetencies — active competencies across every org the
 * viewer is a member of. Powers the VISION lane's capability picker:
 * when a user (especially institutional, e.g. JHU nursing) writes a
 * vision, we let them anchor it to specific competencies from their
 * org's framework so the progress strip can show per-competency bars.
 *
 * Returns [] for users with no org memberships — in that case the
 * picker stays hidden and the vision is text-only.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface OrgCompetencyOption {
  id: string;
  shortLabel: string;
  fullLabel: string;
  category: string;
  orgId: string;
  orgName: string;
}

const STALE_MS = 60_000;

export function useUserOrgCompetencies(interestSlug?: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-org-competencies', user?.id, interestSlug ?? 'all'],
    enabled: Boolean(user?.id),
    staleTime: STALE_MS,
    queryFn: async (): Promise<OrgCompetencyOption[]> => {
      if (!user?.id) return [];
      // 1. Org memberships the viewer holds (active only).
      const { data: memb } = await supabase
        .from('organization_memberships')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active');
      const orgIds = Array.from(
        new Set(((memb ?? []) as { organization_id: string }[]).map((m) => m.organization_id)),
      );
      if (orgIds.length === 0) return [];

      // 2. Org display names so the picker can group by org when the
      //    user belongs to more than one institution. When an
      //    interestSlug is supplied, only keep orgs scoped to that
      //    interest — so a sailor's VISION picker on Sail Racing
      //    doesn't list JHU Nursing competencies.
      let orgsQuery = supabase
        .from('organizations')
        .select('id, name, interest_slug')
        .in('id', orgIds);
      if (interestSlug) orgsQuery = orgsQuery.eq('interest_slug', interestSlug);
      const { data: orgs } = await orgsQuery;
      const scopedOrgIds = ((orgs ?? []) as { id: string }[]).map((o) => o.id);
      if (scopedOrgIds.length === 0) return [];
      const orgNameById = new Map(
        ((orgs ?? []) as { id: string; name: string }[]).map((o) => [o.id, o.name]),
      );

      // 3. Active competencies for those orgs.
      const { data: comps } = await supabase
        .from('org_competencies')
        .select('id, short_label, full_label, category, org_id, display_order')
        .in('org_id', scopedOrgIds)
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      return ((comps ?? []) as {
        id: string;
        short_label: string;
        full_label: string;
        category: string;
        org_id: string;
        display_order: number;
      }[]).map((c) => ({
        id: c.id,
        shortLabel: c.short_label,
        fullLabel: c.full_label,
        category: c.category,
        orgId: c.org_id,
        orgName: orgNameById.get(c.org_id) ?? 'Organization',
      }));
    },
  });
}
