/**
 * useAdminCohorts — list cohorts at a specific org with their member counts.
 *
 * Powers the Org Admin · Cohorts list (and the sidebar count badge once it
 * reads from real data instead of the placeholder 14). Each cohort row
 * carries the membership headcount via a separate query keyed off cohort
 * ids — RLS on betterat_org_cohort_members is open to authenticated
 * readers for visible cohorts.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface AdminCohort {
  id: string;
  name: string;
  description: string | null;
  interestSlug: string | null;
  memberCount: number;
  createdAtLabel: string;
}

export interface AdminCohortsData {
  loading: boolean;
  cohorts: AdminCohort[];
  totalCount: number;
}

function relativeDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function useAdminCohorts(orgId: string): AdminCohortsData {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-cohorts', orgId],
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async (): Promise<AdminCohort[]> => {
      const { data: cohorts, error } = await supabase
        .from('betterat_org_cohorts')
        .select('id, name, description, interest_slug, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('[useAdminCohorts] cohort query failed', error);
        return [];
      }
      type CohortRow = {
        id: string;
        name: string | null;
        description: string | null;
        interest_slug: string | null;
        created_at: string | null;
      };
      const rows = (cohorts ?? []) as CohortRow[];
      if (rows.length === 0) return [];

      // Count members per cohort in one query.
      const cohortIds = rows.map((r) => r.id);
      const { data: members } = await supabase
        .from('betterat_org_cohort_members')
        .select('cohort_id')
        .in('cohort_id', cohortIds);
      const memberCounts = new Map<string, number>();
      for (const m of (members ?? []) as { cohort_id: string }[]) {
        memberCounts.set(m.cohort_id, (memberCounts.get(m.cohort_id) ?? 0) + 1);
      }

      return rows.map((r) => ({
        id: r.id,
        name: r.name ?? 'Untitled cohort',
        description: r.description,
        interestSlug: r.interest_slug,
        memberCount: memberCounts.get(r.id) ?? 0,
        createdAtLabel: relativeDate(r.created_at),
      }));
    },
  });

  const cohorts = useMemo(() => data ?? [], [data]);

  return {
    loading: isLoading,
    cohorts,
    totalCount: cohorts.length,
  };
}
