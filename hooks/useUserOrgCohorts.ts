import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface UserOrgCohort {
  id: string;
  name: string;
  interest_slug: string | null;
  org_id: string;
  org_name: string | null;
  org_slug: string | null;
  role: string | null;
}

interface CohortMemberRow {
  cohort_id: string;
  role: string | null;
  betterat_org_cohorts:
    | {
        id: string;
        name: string;
        interest_slug: string | null;
        org_id: string;
      }
    | {
        id: string;
        name: string;
        interest_slug: string | null;
        org_id: string;
      }[]
    | null;
}

interface ParentOrgRow {
  id: string;
  name: string;
  slug: string | null;
}

async function fetchUserOrgCohorts(userId: string): Promise<UserOrgCohort[]> {
  const { data, error } = await supabase
    .from('betterat_org_cohort_members')
    .select('cohort_id, role, betterat_org_cohorts(id, name, interest_slug, org_id)')
    .eq('user_id', userId);

  if (error) throw error;
  if (!data) return [];

  const rows = data as unknown as CohortMemberRow[];
  const cohorts = rows
    .map((row) => {
      const cohort = Array.isArray(row.betterat_org_cohorts)
        ? row.betterat_org_cohorts[0]
        : row.betterat_org_cohorts;
      return cohort
        ? {
            id: cohort.id,
            name: cohort.name,
            interest_slug: cohort.interest_slug,
            org_id: cohort.org_id,
            role: row.role,
          }
        : null;
    })
    .filter((cohort): cohort is NonNullable<typeof cohort> => Boolean(cohort));

  const orgIds = Array.from(new Set(cohorts.map((cohort) => cohort.org_id)));
  const parentOrgById = new Map<string, ParentOrgRow>();

  if (orgIds.length > 0) {
    const { data: orgRows } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .in('id', orgIds);

    for (const org of (orgRows ?? []) as ParentOrgRow[]) {
      parentOrgById.set(org.id, org);
    }
  }

  return cohorts.map((cohort) => {
    const org = parentOrgById.get(cohort.org_id);
    return {
      id: cohort.id,
      name: cohort.name,
      interest_slug: cohort.interest_slug,
      org_id: cohort.org_id,
      org_name: org?.name ?? null,
      org_slug: org?.slug ?? null,
      role: cohort.role,
    };
  });
}

export function useUserOrgCohorts(interestSlug?: string | null) {
  const { user } = useAuth();
  const userId = user?.id as string | undefined;

  const query = useQuery({
    queryKey: ['user-org-cohorts', userId],
    queryFn: () => fetchUserOrgCohorts(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  const cohorts = query.data ?? [];
  const filtered = interestSlug
    ? cohorts.filter((cohort) => !cohort.interest_slug || cohort.interest_slug === interestSlug)
    : cohorts;

  return { cohorts: filtered, isLoading: query.isLoading };
}
