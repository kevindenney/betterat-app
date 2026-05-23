/**
 * useProfileMenuData
 *
 * Data shape for the role-aware ProfileDropdown (Frames 1–3 of the
 * Creator Studio & Org Admin design pass). Returns the user's active
 * org memberships, role flags (admin / faculty / author / solo), and
 * the counts that drive the menu's badge numbers.
 *
 * Counts that don't have a query yet return 0; TODOs flag the gaps so
 * we can wire them up as the surfaces around the dropdown ship.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';

export interface OrgMembership {
  org_id: string;
  org_name: string;
  org_short_name: string;     // 2-letter mono badge (e.g. "JH")
  interest_slug: string | null;
  role: string | null;        // 'admin' | 'faculty' | 'student' | 'member' | ...
  is_admin: boolean;
  is_faculty: boolean;
  is_author: boolean;
}

export interface ProfileMenuData {
  loading: boolean;
  memberships: OrgMembership[];
  activeOrg: OrgMembership | null;
  hasActiveOrg: boolean;
  isAdmin: boolean;
  isFaculty: boolean;
  isAuthor: boolean;
  isSolo: boolean;
  counts: {
    notifications: number;
    subscribedBlueprints: number;
    authoredBlueprints: number;
    cohortsMentored: number;
    subscriberThreads: number;
    seats: number;
  };
  plan: {
    label: string;
    renewsAt: string | null;
    pricePerYear: number | null;
  } | null;
}

function shortNameFor(orgName: string): string {
  if (!orgName) return '·';
  // Pick first letters of the first two whitespace tokens, uppercased.
  const tokens = orgName.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '·';
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return (tokens[0][0] + tokens[1][0]).toUpperCase();
}

function isAuthorRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return r === 'author' || r === 'creator' || r === 'blueprint_author';
}

function isFacultyRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return r === 'faculty' || r === 'instructor' || r === 'mentor' || r === 'coach';
}

function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const r = role.toLowerCase();
  return r === 'admin' || r === 'owner' || r === 'administrator';
}

export function useProfileMenuData(): ProfileMenuData {
  const { user } = useAuth();
  const userId = user?.id;

  const { data: memberships = [], isLoading } = useQuery({
    queryKey: ['profile-menu-orgs', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<OrgMembership[]> => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('organization_memberships')
        .select(
          'organization_id, role, status, membership_status, organizations!inner(id, name, interest_slug)',
        )
        .eq('user_id', userId);

      if (error) {
        console.warn('[useProfileMenuData] memberships query failed', error);
        return [];
      }

      // Supabase typegen models the !inner join as an array; runtime is a
      // single row because the inner-join hop is one-to-one. Cast through
      // unknown to express that.
      const rows = (data ?? []) as unknown as {
        organization_id: string;
        role: string | null;
        status: string | null;
        membership_status: string | null;
        organizations: { id: string; name: string; interest_slug: string | null } | null;
      }[];

      return rows
        .filter((r) => {
          // active per either column — see feedback_membership_status_split.md
          const s1 = (r.status ?? '').toLowerCase();
          const s2 = (r.membership_status ?? '').toLowerCase();
          return s1 === 'active' || s2 === 'active' || s2 === 'verified';
        })
        .map((r) => {
          const orgName = r.organizations?.name ?? 'Organization';
          return {
            org_id: r.organization_id,
            org_name: orgName,
            org_short_name: shortNameFor(orgName),
            interest_slug: r.organizations?.interest_slug ?? null,
            role: r.role,
            is_admin: isAdminRole(r.role),
            is_faculty: isFacultyRole(r.role),
            is_author: isAuthorRole(r.role),
          };
        });
    },
  });

  // The "active" org is currently the first active membership. Once the
  // role-switcher (Frame 2 "role-card on") is wired to local state, this
  // resolves from a stored preference per session.
  const activeOrg = memberships[0] ?? null;

  const isAdmin = !!activeOrg?.is_admin;
  const isFaculty = !!activeOrg?.is_faculty;
  // A faculty member at an institutional org is also an author by definition
  // of this design (Frame 2 caption: "Faculty · author · mentor").
  const isAuthor = !!activeOrg?.is_author || isFaculty;
  const isSolo = memberships.length === 0;

  // Unread social_notifications for the signed-in user
  const { data: notificationsCount = 0 } = useQuery({
    queryKey: ['profile-menu-notifications', userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;
      const { count, error } = await supabase
        .from('social_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      if (error) {
        console.warn('[useProfileMenuData] notifications count failed', error);
        return 0;
      }
      return count ?? 0;
    },
  });

  // Active plan subscriptions = "Subscribed blueprints" count
  const { data: subscribedBlueprintsCount = 0 } = useQuery({
    queryKey: ['profile-menu-subs', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;
      const { count, error } = await supabase
        .from('plan_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'active');
      if (error) {
        console.warn('[useProfileMenuData] subscribed-blueprints count failed', error);
        return 0;
      }
      return count ?? 0;
    },
  });

  // For admins, the People badge count = active memberships at their active org
  const activeOrgId = activeOrg?.org_id ?? null;
  const isAdminFlag = !!activeOrg?.is_admin;
  const { data: seatsCount = 0 } = useQuery({
    queryKey: ['profile-menu-seats', activeOrgId, isAdminFlag],
    enabled: !!activeOrgId && isAdminFlag,
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      if (!activeOrgId) return 0;
      const { count, error } = await supabase
        .from('organization_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', activeOrgId)
        .in('status', ['active', 'verified']);
      if (error) {
        console.warn('[useProfileMenuData] seats count failed', error);
        return 0;
      }
      return count ?? 0;
    },
  });

  // Cohorts where the user is a mentor (role='mentor' on the cohort-member row)
  const { data: cohortsMentoredCount = 0 } = useQuery({
    queryKey: ['profile-menu-cohorts-mentored', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;
      const { data, error } = await supabase
        .from('betterat_org_cohort_members')
        .select('cohort_id')
        .eq('user_id', userId)
        .eq('role', 'mentor');
      if (error) {
        console.warn('[useProfileMenuData] cohortsMentored count failed', error);
        return 0;
      }
      // Distinct cohorts — a person could appear twice across cohorts but we
      // only care about the unique count.
      return new Set((data ?? []).map((r) => r.cohort_id)).size;
    },
  });

  // Discussion threads the user has participated in (counted as distinct
  // step_ids with at least one of their messages). "Subscriber" reads as
  // "in the conversation" — close enough for the menu badge.
  const { data: subscriberThreadsCount = 0 } = useQuery({
    queryKey: ['profile-menu-subscriber-threads', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;
      const { data, error } = await supabase
        .from('step_discussions')
        .select('step_id')
        .eq('user_id', userId);
      if (error) {
        console.warn('[useProfileMenuData] subscriberThreads count failed', error);
        return 0;
      }
      return new Set((data ?? []).map((r) => r.step_id)).size;
    },
  });

  // authoredBlueprints stays 0 — no blueprints table in the schema yet. Wire
  // when the table lands.
  const counts = {
    notifications: notificationsCount,
    subscribedBlueprints: subscribedBlueprintsCount,
    authoredBlueprints: 0,
    cohortsMentored: cohortsMentoredCount,
    subscriberThreads: subscriberThreadsCount,
    seats: seatsCount,
  };

  // TODO(profile-menu): wire plan to BetterAt+ subscription table.
  const plan = null;

  return {
    loading: isLoading,
    memberships,
    activeOrg,
    hasActiveOrg: memberships.length > 0,
    isAdmin,
    isFaculty,
    isAuthor,
    isSolo,
    counts,
    plan,
  };
}
