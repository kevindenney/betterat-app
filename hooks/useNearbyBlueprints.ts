/**
 * useNearbyBlueprints — published blueprints from clubs within ~25km
 * of a location. Powers the Library Nearby segment so a sailor sees
 * what their local clubs publish, distinct from the global catalog
 * surface in Discover · Plans.
 *
 * Composes useNearbyOrganizations (bbox + haversine) with a blueprints
 * query filtered by organization_id IN those orgs.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import {
  useNearbyOrganizations,
  type NearbyOrganization,
} from '@/hooks/useNearbyOrganizations';

export interface NearbyBlueprint {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  organizationId: string;
  organizationName: string;
  organizationDistanceKm: number;
}

interface UseNearbyBlueprintsArgs {
  lat: number | null;
  lng: number | null;
  radiusKm?: number;
  enabled?: boolean;
}

export function useNearbyBlueprints({
  lat,
  lng,
  radiusKm = 25,
  enabled = true,
}: UseNearbyBlueprintsArgs) {
  const orgsQuery = useNearbyOrganizations({ lat, lng, radiusKm, enabled });
  const orgs = useMemo(() => orgsQuery.data ?? [], [orgsQuery.data]);
  const orgIds = useMemo(() => orgs.map((o) => o.id), [orgs]);
  const orgById = useMemo(
    () => new Map<string, NearbyOrganization>(orgs.map((o) => [o.id, o])),
    [orgs],
  );

  return useQuery({
    queryKey: ['nearby-blueprints', orgIds.join(',')],
    enabled: enabled && orgIds.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<NearbyBlueprint[]> => {
      if (orgIds.length === 0) return [];
      const { data, error } = await supabase
        .from('blueprints')
        .select('id, slug, title, description, org_id')
        .in('org_id', orgIds)
        .eq('status', 'live');
      if (error) {
        console.warn('[nearby-blueprints] query failed', error);
        return [];
      }
      const rows = (data ?? []) as {
        id: string;
        slug: string | null;
        title: string;
        description: string | null;
        org_id: string;
      }[];
      // Map onto NearbyBlueprint shape; sort by host-org distance so the
      // closest club's blueprints lead.
      const out: NearbyBlueprint[] = rows.map((r) => {
        const org = orgById.get(r.org_id);
        return {
          id: r.id,
          slug: r.slug,
          title: r.title,
          description: r.description,
          organizationId: r.org_id,
          organizationName: org?.shortName ?? org?.name ?? 'Nearby club',
          organizationDistanceKm: org?.distanceKm ?? Infinity,
        };
      });
      out.sort((a, b) => a.organizationDistanceKm - b.organizationDistanceKm);
      return out;
    },
  });
}
