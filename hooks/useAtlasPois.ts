/**
 * useAtlasPois — temporary list-of-pois hook used by /atlas/sites to verify
 * the Phase A1 seed data is queryable. Will be replaced by per-layer geo
 * queries (atlas_peer_steps_near + the layer registry) once the Atlas tab
 * map UI lands.
 *
 * RLS on atlas_pois allows any authenticated user to SELECT — these are
 * places, not people. So the result is global.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';

export interface AtlasPoi {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: string;
  interest_slug: string | null;
  source: string;
  is_healthcare_site: boolean;
  claimed_by_org_id: string | null;
  org_name: string | null;
  org_slug: string | null;
  org_interest_slug: string | null;
  metadata: Record<string, unknown>;
}

export interface AtlasPoiData {
  loading: boolean;
  pois: AtlasPoi[];
  totalCount: number;
  byOrg: { orgId: string | null; orgName: string; pois: AtlasPoi[] }[];
}

export function useAtlasPois(): AtlasPoiData {
  // RLS allows authenticated users to read atlas_pois. Gate the query on
  // auth and include user.id in the key so a pre-auth empty/error result
  // cannot poison the cache for the signed-in session.
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data, isLoading } = useQuery({
    queryKey: ['atlas-pois', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<AtlasPoi[]> => {
      const { data: rows, error } = await supabase
        .from('atlas_pois')
        .select(
          'id, name, lat, lng, kind, interest_slug, source, is_healthcare_site, claimed_by_org_id, metadata, organizations(name, slug, interest_slug)',
        )
        .eq('is_active', true)
        .order('claimed_by_org_id', { ascending: true })
        .order('name', { ascending: true });
      if (error) {
        console.warn('[useAtlasPois] query failed', error);
        return [];
      }
      type Row = {
        id: string;
        name: string;
        lat: number;
        lng: number;
        kind: string;
        interest_slug: string | null;
        source: string;
        is_healthcare_site: boolean;
        claimed_by_org_id: string | null;
        metadata: Record<string, unknown>;
        organizations: { name: string; slug: string | null; interest_slug: string | null } | null;
      };
      const typed = (rows ?? []) as unknown as Row[];
      return typed.map((r) => ({
        id: r.id,
        name: r.name,
        lat: r.lat,
        lng: r.lng,
        kind: r.kind,
        interest_slug: r.interest_slug,
        source: r.source,
        is_healthcare_site: r.is_healthcare_site,
        claimed_by_org_id: r.claimed_by_org_id,
        org_name: r.organizations?.name ?? null,
        org_slug: r.organizations?.slug ?? null,
        org_interest_slug: r.organizations?.interest_slug ?? null,
        metadata: r.metadata,
      }));
    },
  });

  const pois = data ?? [];

  const byOrgMap = new Map<string, { orgName: string; pois: AtlasPoi[] }>();
  for (const p of pois) {
    const key = p.claimed_by_org_id ?? 'unclaimed';
    const orgName = p.org_name ?? 'Unclaimed';
    if (!byOrgMap.has(key)) byOrgMap.set(key, { orgName, pois: [] });
    byOrgMap.get(key)!.pois.push(p);
  }
  const byOrg = Array.from(byOrgMap.entries()).map(([orgId, v]) => ({
    orgId: orgId === 'unclaimed' ? null : orgId,
    orgName: v.orgName,
    pois: v.pois,
  }));

  return {
    loading: isLoading,
    pois,
    totalCount: pois.length,
    byOrg,
  };
}
