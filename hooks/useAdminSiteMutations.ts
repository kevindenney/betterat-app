/**
 * useAdminSiteMutations — the write half of Org Admin · Sites.
 *
 * Org-curated atlas_pois rows are shared and not member-owned, so every write
 * goes through a SECURITY DEFINER RPC gated by is_org_admin_member rather than
 * a direct table mutation (atlas_pois RLS only lets a user edit rows they
 * proposed). Each mutation invalidates the org sites list plus the per-site
 * detail/activity keys so the list, hero, and located-step rollup all refresh.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface SitePatch {
  name?: string;
  kind?: string;
  is_healthcare_site?: boolean;
  lat?: number;
  lng?: number;
  city?: string;
  role?: string;
  partner_role?: string;
  curated_label?: string;
}

export interface CreateSiteInput {
  name: string;
  kind: string;
  lat: number;
  lng: number;
  isHealthcare?: boolean;
  metadata?: Record<string, unknown>;
}

export function useAdminSiteMutations(orgId: string) {
  const queryClient = useQueryClient();

  const invalidate = (poiId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['admin-org-sites', orgId] });
    if (poiId) {
      queryClient.invalidateQueries({ queryKey: ['admin-site-poi', poiId] });
      queryClient.invalidateQueries({ queryKey: ['admin-site-activity', orgId, poiId] });
    }
  };

  const update = useMutation({
    mutationFn: async ({ poiId, patch }: { poiId: string; patch: SitePatch }): Promise<string> => {
      const { data, error } = await supabase.rpc('admin_update_site', {
        p_org_id: orgId,
        p_poi_id: poiId,
        p_patch: patch,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, vars) => invalidate(vars.poiId),
  });

  const claim = useMutation({
    mutationFn: async (poiId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('admin_claim_site', {
        p_org_id: orgId,
        p_poi_id: poiId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, poiId) => invalidate(poiId),
  });

  const unclaim = useMutation({
    mutationFn: async (poiId: string): Promise<string> => {
      const { data, error } = await supabase.rpc('admin_unclaim_site', {
        p_org_id: orgId,
        p_poi_id: poiId,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_d, poiId) => invalidate(poiId),
  });

  const create = useMutation({
    mutationFn: async (input: CreateSiteInput): Promise<string> => {
      const { data, error } = await supabase.rpc('admin_create_site', {
        p_org_id: orgId,
        p_name: input.name,
        p_kind: input.kind,
        p_lat: input.lat,
        p_lng: input.lng,
        p_is_healthcare: input.isHealthcare ?? false,
        p_metadata: input.metadata ?? {},
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => invalidate(),
  });

  return { update, claim, unclaim, create };
}
