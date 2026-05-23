/**
 * useBlueprintCohorts — read assigned cohorts + browse the org's cohort
 * catalog so the Cohorts sub-tab can attach/detach.
 */

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface BlueprintCohortRow {
  id: string;
  name: string;
  status: string | null;
  maxSeats: number | null;
  startDate: string | null;
  memberCount: number;
  assigned: boolean;
}

interface CohortRow {
  id: string;
  name: string;
  status: string | null;
  max_seats: number | null;
  start_date: string | null;
}
interface AssignmentRow {
  cohort_id: string;
}

export function useBlueprintCohorts(blueprintId: string, orgId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['blueprint-cohorts', blueprintId];

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!blueprintId && !!orgId,
    staleTime: 30_000,
    queryFn: async (): Promise<{
      cohorts: CohortRow[];
      assignments: Set<string>;
      memberCounts: Map<string, number>;
    }> => {
      const [cohortsRes, assignRes] = await Promise.all([
        supabase
          .from('betterat_org_cohorts')
          .select('id, name, status, max_seats, start_date')
          .eq('org_id', orgId)
          .order('created_at', { ascending: true }),
        supabase
          .from('blueprint_cohorts')
          .select('cohort_id')
          .eq('blueprint_id', blueprintId),
      ]);
      const cohorts = (cohortsRes.data ?? []) as CohortRow[];
      const assignments = new Set(
        ((assignRes.data ?? []) as AssignmentRow[]).map((r) => r.cohort_id),
      );
      const memberCounts = new Map<string, number>();
      if (cohorts.length > 0) {
        const cohortIds = cohorts.map((c) => c.id);
        const { data: members } = await supabase
          .from('betterat_org_cohort_members')
          .select('cohort_id')
          .in('cohort_id', cohortIds);
        for (const m of ((members ?? []) as { cohort_id: string }[])) {
          memberCounts.set(m.cohort_id, (memberCounts.get(m.cohort_id) ?? 0) + 1);
        }
      }
      return { cohorts, assignments, memberCounts };
    },
  });

  const rows: BlueprintCohortRow[] = useMemo(() => {
    if (!data) return [];
    return data.cohorts.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      maxSeats: c.max_seats,
      startDate: c.start_date,
      memberCount: data.memberCounts.get(c.id) ?? 0,
      assigned: data.assignments.has(c.id),
    }));
  }, [data]);

  const assignedRows = useMemo(() => rows.filter((r) => r.assigned), [rows]);
  const unassignedRows = useMemo(() => rows.filter((r) => !r.assigned), [rows]);

  const assign = useMutation({
    mutationFn: async (cohortId: string) => {
      const { error } = await supabase
        .from('blueprint_cohorts')
        .insert({ blueprint_id: blueprintId, cohort_id: cohortId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['blueprint-pricing', blueprintId] });
      queryClient.invalidateQueries({ queryKey: ['studio-blueprint', blueprintId] });
    },
  });

  const unassign = useMutation({
    mutationFn: async (cohortId: string) => {
      const { error } = await supabase
        .from('blueprint_cohorts')
        .delete()
        .eq('blueprint_id', blueprintId)
        .eq('cohort_id', cohortId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['blueprint-pricing', blueprintId] });
      queryClient.invalidateQueries({ queryKey: ['studio-blueprint', blueprintId] });
    },
  });

  return {
    assigned: assignedRows,
    unassigned: unassignedRows,
    loading: isLoading,
    assign,
    unassign,
  };
}
