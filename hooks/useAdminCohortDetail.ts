/**
 * useAdminCohortDetail — fetch one cohort + its member roster, with each
 * member's user profile joined in.
 *
 * Same two-step query pattern as useAdminPeople: betterat_org_cohort_members
 * has FK to auth.users, so supabase-js embeds can't auto-resolve to
 * public.users. Fetch cohort + members first, users by id list second,
 * merge in JS.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface CohortMember {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  initials: string;
  gradient: [string, string];
  cohortRole: string | null;          // mentor / student / etc.
  lastActiveLabel: string;
  joinedLabel: string;
}

export interface AdminCohortDetail {
  id: string;
  orgId: string | null;
  name: string;
  description: string | null;
  interestSlug: string | null;
  status: string | null;
  maxSeats: number | null;
  startDate: string | null;
  endDate: string | null;
  program: string | null;
  createdAtLabel: string;
  members: CohortMember[];
  mentorCount: number;
  studentCount: number;
}

const PALETTE: [string, string][] = [
  ['#B85A66', '#7A6A8E'],
  ['#5A8DB8', '#4E6A85'],
  ['#28406B', '#4E6A85'],
  ['#7A6A8E', '#4E6A85'],
  ['#B85A66', '#7C7B6E'],
  ['#6E8B5A', '#5A8B8B'],
  ['#8B6E5A', '#B8855A'],
];

function gradientFor(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function getInitials(displayOrEmail: string): string {
  const name = displayOrEmail.trim();
  if (!name) return '?';
  const tokens = (name.includes('@') ? name.split('@')[0].replace(/[._-]+/g, ' ') : name)
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return (tokens[0][0] + tokens[tokens.length - 1][0]).toUpperCase();
}

function relativeLastActive(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso).getTime();
  const min = Math.max(0, Math.round((Date.now() - d) / 60_000));
  if (min < 5) return 'Active now';
  if (min < 60) return `Active ${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function relativeJoined(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function useAdminCohortDetail(cohortId: string): {
  loading: boolean;
  cohort: AdminCohortDetail | null;
} {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-cohort-detail', cohortId],
    enabled: !!cohortId,
    staleTime: 60_000,
    queryFn: async (): Promise<AdminCohortDetail | null> => {
      const { data: cohort, error: cohortErr } = await supabase
        .from('betterat_org_cohorts')
        .select(
          'id, org_id, name, description, interest_slug, status, max_seats, start_date, end_date, program, created_at',
        )
        .eq('id', cohortId)
        .maybeSingle();
      if (cohortErr || !cohort) {
        if (cohortErr) console.warn('[useAdminCohortDetail] cohort query failed', cohortErr);
        return null;
      }

      const { data: rawMembers, error: memErr } = await supabase
        .from('betterat_org_cohort_members')
        .select('id, user_id, role, created_at')
        .eq('cohort_id', cohortId);
      if (memErr) {
        console.warn('[useAdminCohortDetail] members query failed', memErr);
      }

      type MemRow = {
        id: string;
        user_id: string;
        role: string | null;
        created_at: string | null;
      };
      const memRows = (rawMembers ?? []) as MemRow[];

      const userIds = Array.from(new Set(memRows.map((m) => m.user_id).filter(Boolean)));
      type UserRow = {
        id: string;
        full_name: string | null;
        email: string | null;
        last_active_at: string | null;
      };
      const userById = new Map<string, UserRow>();
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, full_name, email, last_active_at')
          .in('id', userIds);
        for (const u of (users ?? []) as UserRow[]) userById.set(u.id, u);
      }

      const members: CohortMember[] = memRows.map((m) => {
        const u = userById.get(m.user_id);
        const displayName = u?.full_name?.trim() || u?.email || 'Unknown';
        return {
          membershipId: m.id,
          userId: m.user_id,
          name: displayName,
          email: u?.email ?? '',
          initials: getInitials(displayName),
          gradient: gradientFor(m.user_id),
          cohortRole: m.role,
          lastActiveLabel: relativeLastActive(u?.last_active_at ?? null),
          joinedLabel: relativeJoined(m.created_at),
        };
      });

      const mentorCount = members.filter((m) => {
        const r = (m.cohortRole ?? '').toLowerCase();
        return r === 'mentor' || r === 'preceptor' || r === 'instructor';
      }).length;

      return {
        id: cohort.id,
        orgId: (cohort as { org_id?: string | null }).org_id ?? null,
        name: cohort.name ?? 'Untitled cohort',
        description: cohort.description,
        interestSlug: cohort.interest_slug,
        status: (cohort as { status?: string | null }).status ?? null,
        maxSeats: (cohort as { max_seats?: number | null }).max_seats ?? null,
        startDate: (cohort as { start_date?: string | null }).start_date ?? null,
        endDate: (cohort as { end_date?: string | null }).end_date ?? null,
        program: (cohort as { program?: string | null }).program ?? null,
        createdAtLabel: relativeJoined(cohort.created_at),
        members,
        mentorCount,
        studentCount: members.length - mentorCount,
      };
    },
  });

  const cohort = useMemo(() => data ?? null, [data]);
  return { loading: isLoading, cohort };
}
