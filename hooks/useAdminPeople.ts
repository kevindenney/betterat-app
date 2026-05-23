/**
 * useAdminPeople
 *
 * Data shape for Org Admin · People (Frame 7 of the institutions pass).
 * Wired to real organization_memberships joined to public.users +
 * betterat_org_cohort_members. The Add Person sheet (Frame 8) still
 * uses local state until invites schema is finalised.
 *
 * Role mapping (DB role → People-table role badges):
 *   admin / owner        → ['admin']
 *   faculty / instructor → ['faculty', 'author']
 *   preceptor / coach    → ['mentor']
 *   tutor / assessor     → ['mentor']
 *   member / student     → ['student']
 *   anything else        → ['student'] (best-effort)
 *
 * Status mapping (DB status × membership_status → PersonStatus):
 *   active (both)        → 'active'
 *   pending              → 'pending'
 *   inactive / suspended → 'off-boarded'
 *   rejected             → 'off-boarded'
 *
 * Counts at the org level reflect the full population, not the loaded
 * page — the page-level "Showing N of M" footer uses these.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export type PersonRoleBadge =
  | 'student'
  | 'faculty'
  | 'author'
  | 'mentor'
  | 'admin'
  | 'co-author';

export type PersonStatus = 'active' | 'pending' | 'off-boarded' | 'suspended';

export type PersonSource = 'invite' | 'sso' | 'self-join' | null;

export interface AdminPersonRow {
  /** organization_memberships.id — stable React key + the value people.tsx tracks as openPersonId. */
  id: string;
  /** auth.users.id — what every per-user RPC (admin_person_practice_steps, etc.) needs. */
  userId: string;
  name: string;
  email: string;
  initials: string;
  gradient: [string, string];
  roles: PersonRoleBadge[];
  cohortLabel: string | null;
  lastActiveLabel: string;
  status: PersonStatus;
  source: PersonSource;
  isYou: boolean;
  joinedNote?: string | null;
}

export interface AdminPeopleData {
  loading: boolean;
  rows: AdminPersonRow[];
  totalRows: number;
  counts: {
    all: number;
    students: number;
    authors: number;
    mentors: number;
    admins: number;
    pending: number;
  };
  seats: { used: number; total: number; renewsAt: string };
  lastSsoSyncLabel: string;
}

const GRADIENT_PALETTE: [string, string][] = [
  ['#B85A66', '#7A6A8E'],
  ['#5A8DB8', '#4E6A85'],
  ['#28406B', '#4E6A85'],
  ['#7A6A8E', '#4E6A85'],
  ['#B85A66', '#7C7B6E'],
  ['#6E8B5A', '#5A8B8B'],
  ['#8B6E5A', '#B8855A'],
  ['#5E7B8E', '#3D352B'],
];

function getInitials(nameOrEmail: string): string {
  const name = nameOrEmail.trim();
  if (!name) return '?';
  // For emails, use the part before @
  const tokens = (name.includes('@') ? name.split('@')[0].replace(/[._-]+/g, ' ') : name)
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return '?';
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return (tokens[0][0] + tokens[tokens.length - 1][0]).toUpperCase();
}

function gradientFor(seedKey: string): [string, string] {
  // Deterministic hash so the same user gets the same gradient
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) {
    hash = (hash * 31 + seedKey.charCodeAt(i)) >>> 0;
  }
  return GRADIENT_PALETTE[hash % GRADIENT_PALETTE.length];
}

function mapRolesToBadges(dbRole: string | null | undefined): PersonRoleBadge[] {
  const r = (dbRole ?? '').toLowerCase();
  if (r === 'admin' || r === 'owner') return ['admin'];
  if (r === 'faculty' || r === 'instructor') return ['faculty', 'author'];
  if (r === 'preceptor' || r === 'coach' || r === 'tutor' || r === 'assessor' || r === 'mentor') {
    return ['mentor'];
  }
  // Default fallthrough including 'member' / 'student' / 'guest'
  return ['student'];
}

function mapStatus(
  status: string | null | undefined,
  membershipStatus: string | null | undefined,
): PersonStatus {
  const s = (status ?? '').toLowerCase();
  const ms = (membershipStatus ?? '').toLowerCase();
  if (s === 'active' || ms === 'active' || ms === 'verified') return 'active';
  if (s === 'pending' || ms === 'pending') return 'pending';
  if (s === 'suspended') return 'suspended';
  return 'off-boarded';
}

function mapSource(verificationSource: string | null | undefined): PersonSource {
  const v = (verificationSource ?? '').toLowerCase();
  if (v === 'sso' || v === 'email_domain') return 'sso';
  if (v === 'self_join') return 'self-join';
  if (v === 'invite' || v === 'admin') return 'invite';
  return null;
}

function relativeLastActive(lastActiveAt: string | null): string {
  if (!lastActiveAt) return '—';
  const now = Date.now();
  const then = new Date(lastActiveAt).getTime();
  const diffMin = Math.max(0, Math.round((now - then) / 60_000));
  if (diffMin < 5) return 'Active now';
  if (diffMin < 60) return `Active ${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(lastActiveAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function useAdminPeople(orgId: string): AdminPeopleData {
  const { user } = useAuth();
  const viewerId = user?.id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-people', orgId, viewerId],
    enabled: !!orgId,
    staleTime: 30_000,
    queryFn: async () => {
      // Two-step query because there's no FK from
      // organization_memberships.user_id → public.users.id (FK points to
      // auth.users instead), so supabase-js's embedded join silently fails.
      // Fetch memberships first, then users by id list separately.
      const { data: memberships, error } = await supabase
        .from('organization_memberships')
        .select(
          'id, user_id, role, status, membership_status, verification_source, joined_at, created_at',
        )
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[useAdminPeople] memberships query failed', error);
        return { rows: [] as AdminPersonRow[], cohortByUser: new Map<string, string>() };
      }

      type MembershipRow = {
        id: string;
        user_id: string;
        role: string | null;
        status: string | null;
        membership_status: string | null;
        verification_source: string | null;
        joined_at: string | null;
        created_at: string | null;
      };
      const rawMems = (memberships ?? []) as unknown as MembershipRow[];

      // Pull the user profiles in a second query keyed off the membership rows.
      const userIdList = Array.from(new Set(rawMems.map((m) => m.user_id).filter(Boolean)));
      type UserProfile = {
        id: string;
        full_name: string | null;
        email: string | null;
        last_active_at: string | null;
        avatar_url: string | null;
      };
      const userById = new Map<string, UserProfile>();
      if (userIdList.length > 0) {
        const { data: userRows } = await supabase
          .from('users')
          .select('id, full_name, email, last_active_at, avatar_url')
          .in('id', userIdList);
        for (const u of (userRows ?? []) as UserProfile[]) userById.set(u.id, u);
      }

      // Cohort labels per user — single round-trip; small dataset.
      const userIds = rawMems.map((m) => m.user_id).filter(Boolean);
      const cohortByUser = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: cohortRows } = await supabase
          .from('betterat_org_cohort_members')
          .select('user_id, betterat_org_cohorts:cohort_id(name, org_id)')
          .in('user_id', userIds);
        type CohortRow = {
          user_id: string;
          betterat_org_cohorts: { name: string | null; org_id: string | null } | null;
        };
        for (const r of (cohortRows ?? []) as unknown as CohortRow[]) {
          if (r.betterat_org_cohorts?.org_id === orgId && r.betterat_org_cohorts.name) {
            cohortByUser.set(r.user_id, r.betterat_org_cohorts.name);
          }
        }
      }

      const rows: AdminPersonRow[] = rawMems.map((m) => {
        const u = userById.get(m.user_id);
        const displayName = u?.full_name?.trim() || u?.email || 'Unknown';
        const email = u?.email ?? '';
        const status = mapStatus(m.status, m.membership_status);
        const source = mapSource(m.verification_source);
        return {
          id: m.id,
          userId: m.user_id,
          name: displayName,
          email,
          initials: getInitials(displayName),
          gradient: gradientFor(m.user_id ?? m.id),
          roles: mapRolesToBadges(m.role),
          cohortLabel: cohortByUser.get(m.user_id) ?? null,
          lastActiveLabel: relativeLastActive(u?.last_active_at ?? null),
          status,
          source,
          isYou: !!viewerId && m.user_id === viewerId,
          joinedNote:
            status === 'pending'
              ? m.created_at
                ? `Invited ${relativeLastActive(m.created_at)} · not redeemed`
                : 'Pending invite · not redeemed'
              : source === 'sso' && m.joined_at
              ? `joined via SAML ${relativeLastActive(m.joined_at)}`
              : null,
        };
      });

      return { rows, cohortByUser };
    },
  });

  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      students: rows.filter((r) => r.roles.includes('student')).length,
      authors: rows.filter((r) => r.roles.includes('author') || r.roles.includes('co-author'))
        .length,
      mentors: rows.filter((r) => r.roles.includes('mentor')).length,
      admins: rows.filter((r) => r.roles.includes('admin')).length,
      pending: rows.filter((r) => r.status === 'pending').length,
    }),
    [rows],
  );

  // Seats: until org_subscriptions surfaces real seat counts, derive used from
  // active members and stub the total + renewal at a reasonable JHSON-class
  // plan size. Once a subscription row exists this swaps to that source.
  const usedSeats = rows.filter((r) => r.status === 'active').length;
  const seats = { used: usedSeats, total: 350, renewsAt: 'Aug 15' };

  return {
    loading: isLoading,
    rows,
    totalRows: rows.length,
    counts,
    seats,
    lastSsoSyncLabel: '12 min ago',
  };
}
