/**
 * useAdminOrgSites
 *
 * Data for Org Admin · Sites — lists the atlas_pois rows claimed by a
 * specific org. Used by /admin/[orgId]/sites to show the admin which
 * places their institution has curated. Reads from the Atlas Phase A1
 * schema; the hook owns the org-scoped filter so the page stays simple.
 *
 * Counts:
 *   - total · all sites claimed by the org
 *   - byKind · grouped {hospital, sim_lab, club, racing_area, course, …}
 *   - healthcare · is_healthcare_site = true
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface AdminOrgSite {
  id: string;
  name: string;
  kind: string;                  // 'hospital' | 'sim_lab' | 'club' | 'racing_area' | …
  lat: number;
  lng: number;
  source: string;
  is_healthcare_site: boolean;
  interest_slug: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AdminOrgSitesData {
  loading: boolean;
  sites: AdminOrgSite[];
  total: number;
  healthcareCount: number;
  byKind: { kind: string; count: number }[];
}

export function useAdminOrgSites(orgId: string): AdminOrgSitesData {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-org-sites', orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async (): Promise<AdminOrgSite[]> => {
      const { data: rows, error } = await supabase
        .from('atlas_pois')
        .select('id, name, kind, lat, lng, source, is_healthcare_site, interest_slug, metadata, created_at')
        .eq('claimed_by_org_id', orgId)
        .order('kind', { ascending: true })
        .order('name', { ascending: true });
      if (error) {
        console.warn('[useAdminOrgSites] query failed', error);
        return [];
      }
      return (rows ?? []) as AdminOrgSite[];
    },
  });

  const sites = useMemo(() => data ?? [], [data]);

  const byKind = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sites) m.set(s.kind, (m.get(s.kind) ?? 0) + 1);
    return Array.from(m.entries())
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count);
  }, [sites]);

  return {
    loading: isLoading,
    sites,
    total: sites.length,
    healthcareCount: sites.filter((s) => s.is_healthcare_site).length,
    byKind,
  };
}
