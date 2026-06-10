/**
 * useAdminSiteActivity
 *
 * Data for Org Admin · Site detail (/admin/[orgId]/sites/[poiId]).
 * Two reads:
 *   - the atlas_pois row itself (name, kind, coords, metadata) for the hero
 *   - the admin_site_activity RPC for aggregates: stat strip, competency
 *     bars (confirmed evidence on steps located at the POI), people roster,
 *     and the recent-practice feed.
 *
 * The RPC is SECURITY DEFINER gated by is_org_admin_member and verifies the
 * POI is claimed by the org, so a 42501 here means "not your site".
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import type { AdminOrgSite } from '@/hooks/useAdminOrgSites';

export interface SiteCompetencyAgg {
  short_label: string;
  full_label: string | null;
  evidence_count: number;
  people: number;
}

export interface SiteRosterRow {
  user_id: string;
  user_name: string;
  user_initials: string;
  step_count: number;
  settled_count: number;
  last_active: string | null;
}

export interface SiteRecentRow {
  step_id: string;
  title: string | null;
  status: string;
  user_name: string;
  user_initials: string;
  happened_at: string | null;
  competencies: string[];
}

export interface SiteActivity {
  stats: {
    people: number;
    steps: number;
    settled: number;
    evidence: number;
    last_activity: string | null;
  };
  competencies: SiteCompetencyAgg[];
  roster: SiteRosterRow[];
  recent: SiteRecentRow[];
}

export interface AdminSiteActivityData {
  loading: boolean;
  poi: AdminOrgSite | null;
  activity: SiteActivity | null;
  activityError: string | null;
}

export function useAdminSiteActivity(
  orgId: string | undefined,
  poiId: string | undefined,
): AdminSiteActivityData {
  const poiQuery = useQuery({
    queryKey: ['admin-site-poi', poiId],
    enabled: !!poiId,
    staleTime: 60_000,
    queryFn: async (): Promise<AdminOrgSite | null> => {
      const { data, error } = await supabase
        .from('atlas_pois')
        .select('id, name, kind, lat, lng, source, is_healthcare_site, interest_slug, metadata, created_at')
        .eq('id', poiId!)
        .maybeSingle();
      if (error) {
        console.warn('[useAdminSiteActivity] poi query failed', error);
        return null;
      }
      return (data ?? null) as AdminOrgSite | null;
    },
  });

  const activityQuery = useQuery({
    queryKey: ['admin-site-activity', orgId, poiId],
    enabled: !!orgId && !!poiId,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<SiteActivity> => {
      const { data, error } = await supabase.rpc('admin_site_activity', {
        p_org_id: orgId,
        p_poi_id: poiId,
      });
      if (error) throw new Error(error.message);
      return data as SiteActivity;
    },
  });

  return {
    loading: poiQuery.isLoading || activityQuery.isLoading,
    poi: poiQuery.data ?? null,
    activity: activityQuery.data ?? null,
    activityError: activityQuery.error ? (activityQuery.error as Error).message : null,
  };
}
