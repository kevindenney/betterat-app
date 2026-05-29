/**
 * useAdminPrograms — list programs at an org with their enrolled-participant
 * counts, for the Org Admin · Programs surface. Mirrors useAdminCohorts so the
 * AdminShell sidebar badge and the list page read from the same source.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { programService, type ProgramStatus } from '@/services/ProgramService';

export interface AdminProgram {
  id: string;
  title: string;
  description: string | null;
  status: ProgramStatus;
  domain: string;
  startLabel: string | null;
  participantCount: number;
}

export interface AdminProgramsData {
  loading: boolean;
  programs: AdminProgram[];
  totalCount: number;
}

export const adminProgramsKey = (orgId: string) => ['admin-programs', orgId] as const;

function dateLabel(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function useAdminPrograms(orgId: string): AdminProgramsData {
  const { data, isLoading } = useQuery({
    queryKey: adminProgramsKey(orgId),
    enabled: !!orgId,
    staleTime: 60_000,
    queryFn: async (): Promise<AdminProgram[]> => {
      const [programs, counts] = await Promise.all([
        programService.listPrograms(orgId),
        programService.getProgramParticipantCounts(orgId),
      ]);
      return programs.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        status: p.status,
        domain: p.domain,
        startLabel: dateLabel(p.start_at),
        participantCount: counts[p.id] ?? 0,
      }));
    },
  });

  const programs = useMemo(() => data ?? [], [data]);

  return {
    loading: isLoading,
    programs,
    totalCount: programs.length,
  };
}
