/**
 * useTopOrgsForInterest — top active organizations for an interest slug.
 *
 * Powers the "Orgs" preview section of the unified Library feed: a few
 * real orgs you could join in the current craft, rather than a bare
 * "browse orgs" nav row. Mirrors the org query DiscoverOrgsContent runs,
 * trimmed to a small preview and resilient to the extended-columns
 * fallback (older dev projects lack organization_type/status/etc.).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback';

export interface TopOrgRow {
  id: string;
  name: string;
  slug: string;
  join_mode: string;
  organization_type?: string | null;
  status?: string | null;
  official?: boolean | null;
  claim_status?: string | null;
  source?: string | null;
}

export function useTopOrgsForInterest(interestSlug: string | undefined, limit = 3) {
  return useQuery<TopOrgRow[]>({
    queryKey: ['top-orgs-for-interest', interestSlug, limit],
    enabled: Boolean(interestSlug),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!interestSlug) return [];

      let q = await supabase
        .from('organizations')
        .select('id, name, slug, join_mode, organization_type, status, official, claim_status, source')
        .eq('interest_slug', interestSlug)
        .eq('is_active', true)
        .order('name')
        .limit(limit);

      if (
        q.error &&
        (isMissingSupabaseColumn(q.error, 'organizations.organization_type') ||
          isMissingSupabaseColumn(q.error, 'organizations.status') ||
          isMissingSupabaseColumn(q.error, 'organizations.official') ||
          isMissingSupabaseColumn(q.error, 'organizations.claim_status') ||
          isMissingSupabaseColumn(q.error, 'organizations.source'))
      ) {
        q = await supabase
          .from('organizations')
          .select('id, name, slug, join_mode')
          .eq('interest_slug', interestSlug)
          .eq('is_active', true)
          .order('name')
          .limit(limit);
      }

      if (q.error) throw q.error;

      return ((q.data ?? []) as TopOrgRow[]).map((o) => ({
        ...o,
        join_mode: o.join_mode || 'invite_only',
        status: o.status ?? null,
        official: typeof o.official === 'boolean' ? o.official : null,
        claim_status: o.claim_status ?? null,
        source: o.source ?? null,
      }));
    },
  });
}
