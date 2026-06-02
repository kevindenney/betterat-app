/**
 * usePrograms — React Query hooks for program operations
 *
 * Provides hooks for fetching org programs, program competencies,
 * and real member timelines for org catalog pages.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import {
  getProgramCompetenciesWithDetails,
  getProgramCapabilityCount,
} from '@/services/competencyService';
import type { ProgramRecord } from '@/services/ProgramService';
import type { Competency } from '@/types/competency';
import type { SamplePerson, SampleTimelineStep } from '@/lib/landing/sampleData';

/** Real member with timeline data, shaped to match SamplePerson for reuse in PersonTimelineRow */
export interface RealMemberTimeline {
  person: SamplePerson;
  stepIds: string[];
}

const keys = {
  orgPrograms: (orgId: string) => ['programs', 'org', orgId] as const,
  programCompetencies: (programId: string) => ['programs', 'competencies', programId] as const,
  programCapabilityCount: (programId: string) => ['programs', 'capability-count', programId] as const,
  orgMemberTimelines: (orgId: string, interestId: string) => ['programs', 'member-timelines', orgId, interestId] as const,
  enrolledPrograms: (userId: string) => ['programs', 'enrolled', userId] as const,
  programCompetencyProgress: (programId: string, userId: string) => ['programs', 'competency-progress', programId, userId] as const,
};

async function getOrgPrograms(orgId: string): Promise<ProgramRecord[]> {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('organization_id', orgId)
    .in('status', ['draft', 'planned', 'active'])
    .order('title', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProgramRecord[];
}

export function useOrgPrograms(orgId?: string | null) {
  return useQuery<ProgramRecord[]>({
    queryKey: keys.orgPrograms(orgId ?? ''),
    queryFn: () => getOrgPrograms(orgId!),
    enabled: !!orgId,
  });
}

export function useProgramCompetencies(programId?: string | null) {
  return useQuery<(Competency & { is_required: boolean })[]>({
    queryKey: keys.programCompetencies(programId ?? ''),
    queryFn: () => getProgramCompetenciesWithDetails(programId!),
    enabled: !!programId,
  });
}

export function useProgramCapabilityCount(programId?: string | null) {
  return useQuery<{ competencies: number; subCompetencies: number }>({
    queryKey: keys.programCapabilityCount(programId ?? ''),
    queryFn: () => getProgramCapabilityCount(programId!),
    enabled: !!programId,
  });
}

// ---------------------------------------------------------------------------
// Real member timelines for org catalog pages
// ---------------------------------------------------------------------------

function mapStepStatus(dbStatus: string): SampleTimelineStep['status'] {
  switch (dbStatus) {
    case 'completed': return 'completed';
    case 'in_progress': return 'current';
    default: return 'upcoming';
  }
}

async function getOrgMemberTimelines(orgId: string, interestId: string): Promise<RealMemberTimeline[]> {
  // 1. Get active org members
  const { data: members, error: memErr } = await supabase
    .from('organization_memberships')
    .select('user_id, role')
    .eq('organization_id', orgId)
    .in('membership_status', ['active']);
  if (memErr) throw memErr;
  if (!members || members.length === 0) return [];

  const userIds = members.map((m: any) => m.user_id);
  const roleMap = new Map(members.map((m: any) => [m.user_id, m.role ?? 'member']));

  // 2. Fetch profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds);
  const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));

  // 3. Fetch all non-private timeline steps for these users in this interest
  const { data: steps, error: stepsErr } = await supabase
    .from('timeline_steps')
    .select('id, user_id, title, status, sort_order')
    .in('user_id', userIds)
    .eq('interest_id', interestId)
    .neq('visibility', 'private')
    .order('sort_order', { ascending: true });
  if (stepsErr) throw stepsErr;

  // 4. Group steps by user
  const stepsByUser = new Map<string, typeof steps>();
  for (const step of (steps ?? []) as any[]) {
    const list = stepsByUser.get(step.user_id) ?? [];
    list.push(step);
    stepsByUser.set(step.user_id, list);
  }

  // 5. Build RealMemberTimeline for each user who has steps
  const results: RealMemberTimeline[] = [];
  for (const userId of userIds) {
    const userSteps = stepsByUser.get(userId);
    if (!userSteps || userSteps.length === 0) continue;

    const fullName = nameMap.get(userId) ?? 'Member';
    // Skip members whose name looks like an email (not set up for demo)
    if (fullName.includes('@') && fullName !== 'Member') continue;

    const role = roleMap.get(userId) ?? 'member';
    const timeline: SampleTimelineStep[] = userSteps.map((s: any) => ({
      label: s.title,
      status: mapStepStatus(s.status),
    }));
    const stepIds = userSteps.map((s: any) => s.id);

    results.push({
      person: { name: fullName, role, timeline, userId },
      stepIds,
    });
  }

  return results;
}

export function useOrgMemberTimelines(orgId?: string | null, interestId?: string | null) {
  return useQuery<RealMemberTimeline[]>({
    queryKey: keys.orgMemberTimelines(orgId ?? '', interestId ?? ''),
    queryFn: () => getOrgMemberTimelines(orgId!, interestId!),
    enabled: !!orgId && !!interestId,
  });
}

// ---------------------------------------------------------------------------
// Enrolled programs for current user
// ---------------------------------------------------------------------------

async function getEnrolledPrograms(userId: string): Promise<ProgramRecord[]> {
  const { data: participations, error: partErr } = await supabase
    .from('program_participants')
    .select('program_id')
    .eq('user_id', userId);
  if (partErr) throw partErr;
  if (!participations || participations.length === 0) return [];

  const programIds = participations.map((p: any) => p.program_id);
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .in('id', programIds)
    .in('status', ['active', 'planned'])
    .order('title', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProgramRecord[];
}

export function useMyEnrolledPrograms() {
  const { user } = useAuth();
  return useQuery<ProgramRecord[]>({
    queryKey: keys.enrolledPrograms(user?.id ?? ''),
    queryFn: () => getEnrolledPrograms(user!.id),
    enabled: !!user?.id,
  });
}

// ---------------------------------------------------------------------------
// Program competency progress for a student
// ---------------------------------------------------------------------------

export interface ProgramCompetencyProgress {
  competency_id: string;
  competency_title: string;
  is_required: boolean;
  current_level: number;
  target_level: number;
  evidence_count: number;
}

// betterat_competency_progress is status-based (no level columns); derive a
// numeric level from the status rank. checkoff_ready is the program target bar.
const COMPETENCY_STATUS_LEVEL: Record<string, number> = {
  not_started: 0,
  learning: 1,
  practicing: 2,
  checkoff_ready: 3,
  validated: 4,
  competent: 5,
};

async function getProgramCompetencyProgress(
  programId: string,
  userId: string,
): Promise<ProgramCompetencyProgress[]> {
  // Get program competencies
  const { data: programComps, error: pcErr } = await supabase
    .from('program_competencies')
    .select('competency_id, is_required, sort_order')
    .eq('program_id', programId)
    .order('sort_order', { ascending: true });
  if (pcErr) throw pcErr;
  if (!programComps || programComps.length === 0) return [];

  const compIds = programComps.map((pc: any) => pc.competency_id);

  // Get competency details
  const { data: competencies } = await supabase
    .from('betterat_competencies')
    .select('id, title')
    .in('id', compIds);
  const titleMap = new Map((competencies ?? []).map((c: any) => [c.id, c.title]));

  // Get user's progress on these competencies
  const { data: progress } = await supabase
    .from('betterat_competency_progress')
    .select('competency_id, status, attempts_count')
    .eq('user_id', userId)
    .in('competency_id', compIds);
  const progressMap = new Map(
    (progress ?? []).map((p: any) => [p.competency_id, p]),
  );

  return programComps.map((pc: any) => {
    const prog = progressMap.get(pc.competency_id);
    return {
      competency_id: pc.competency_id,
      competency_title: titleMap.get(pc.competency_id) ?? 'Unknown',
      is_required: pc.is_required ?? true,
      current_level: COMPETENCY_STATUS_LEVEL[prog?.status] ?? 0,
      target_level: COMPETENCY_STATUS_LEVEL.checkoff_ready,
      evidence_count: prog?.attempts_count ?? 0,
    };
  });
}

export function useProgramCompetencyProgress(programId?: string | null) {
  const { user } = useAuth();
  return useQuery<ProgramCompetencyProgress[]>({
    queryKey: keys.programCompetencyProgress(programId ?? '', user?.id ?? ''),
    queryFn: () => getProgramCompetencyProgress(programId!, user!.id),
    enabled: !!programId && !!user?.id,
  });
}
