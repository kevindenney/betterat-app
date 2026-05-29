/**
 * useAdminProgramDetail — one program's record plus its enrolled participants,
 * for the Org Admin · Program detail surface. Pairs with useAdminPrograms (the
 * list) and feeds the bulk-enroll-a-cohort action.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  programService,
  type ProgramRecord,
  type ProgramParticipantRecord,
} from '@/services/ProgramService';

export interface AdminProgramParticipant {
  id: string;
  userId: string | null;
  name: string;
  email: string | null;
  role: string;
  status: ProgramParticipantRecord['status'];
  joinedLabel: string;
}

export interface AdminProgramDetailData {
  loading: boolean;
  program: ProgramRecord | null;
  participants: AdminProgramParticipant[];
}

export const adminProgramDetailKey = (programId: string) =>
  ['admin-program-detail', programId] as const;

function dateLabel(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function useAdminProgramDetail(programId: string): AdminProgramDetailData {
  const { data, isLoading } = useQuery({
    queryKey: adminProgramDetailKey(programId),
    enabled: !!programId,
    staleTime: 60_000,
    queryFn: async () => {
      const [program, participants] = await Promise.all([
        programService.getProgram(programId),
        programService.listProgramParticipants(programId),
      ]);
      return { program, participants };
    },
  });

  const participants = useMemo<AdminProgramParticipant[]>(
    () =>
      (data?.participants ?? []).map((p) => ({
        id: p.id,
        userId: p.user_id,
        name: p.display_name?.trim() || p.email?.trim() || 'Unnamed participant',
        email: p.email,
        role: p.role,
        status: p.status,
        joinedLabel: dateLabel(p.created_at),
      })),
    [data?.participants],
  );

  return {
    loading: isLoading,
    program: data?.program ?? null,
    participants,
  };
}
