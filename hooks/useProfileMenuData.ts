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

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useOrganization } from '@/providers/OrganizationProvider';
import { isOrgAdminRole } from '@/lib/organizations/roleLabels';
import {
  fetchOrgMembershipRows,
  orgMembershipsQueryKey,
  type OrgMembershipEmbeddedOrg,
} from '@/hooks/orgMembershipsQuery';
import { isProfileMenuActiveMembership } from '@/hooks/useProfileMenuData.logic';

export interface OrgMembership {
  org_id: string;
  org_slug: string | null;
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

export function useProfileMenuData(): ProfileMenuData {
  const { user } = useAuth();
  const userId = user?.id;
  const { activeOrganizationId } = useOrganization();

  // Shared cached read — same query (key ['profile-menu-orgs', userId]) the
  // OrganizationProvider now consumes. The shared read is unfiltered; we
  // re-apply this surface's own active/verified client filter below.
  const { data: rawRows = [], isLoading } = useQuery({
    queryKey: orgMembershipsQueryKey(userId),
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: () => fetchOrgMembershipRows(userId!),
  });

  const memberships: OrgMembership[] = useMemo(() => {
    return rawRows
      .filter(isProfileMenuActiveMembership)
      .map((r) => {
        // LEFT join — org may be null; supabase typegen may model it as an array.
        const org: OrgMembershipEmbeddedOrg | null = Array.isArray(r.organization)
          ? (r.organization[0] ?? null)
          : (r.organization ?? null);
        const orgName = org?.name ?? 'Organization';
        return {
          org_id: r.organization_id,
          org_slug: org?.slug ?? null,
          org_name: orgName,
          org_short_name: shortNameFor(orgName),
          interest_slug: org?.interest_slug ?? null,
          role: r.role,
          is_admin: isOrgAdminRole(r.role),
          is_faculty: isFacultyRole(r.role),
          is_author: isAuthorRole(r.role),
        };
      });
  }, [rawRows]);

  const activeOrgById = activeOrganizationId
    ? memberships.find((m) => m.org_id === activeOrganizationId) ?? null
    : null;
  const activeOrg = activeOrgById;
  const activeOrgIdForCounts = activeOrg?.org_id ?? null;
  const authoredWorkspaceKey = activeOrgIdForCounts ?? 'personal';

  const isAdmin = !!activeOrg?.is_admin;
  const isFaculty = !!activeOrg?.is_faculty;
  const isSolo = memberships.length === 0;

  // Independent authorship: anyone who owns a public.blueprints row is a
  // creator regardless of org role — this is what makes the "Creator Studio"
  // entry appear for solo authors who published to the marketplace.
  const { data: authoredBlueprintsCount = 0 } = useQuery({
    queryKey: ['profile-menu-authored', userId, authoredWorkspaceKey],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;
      let query = supabase
        .from('blueprints')
        .select('id', { count: 'exact', head: true })
        .eq('author_user_id', userId);
      query = activeOrgIdForCounts
        ? query.eq('org_id', activeOrgIdForCounts)
        : query.is('org_id', null);
      const { count, error } = await query;
      if (error) {
        console.warn('[useProfileMenuData] authored-blueprints count failed', error);
        return 0;
      }
      return count ?? 0;
    },
  });

  // A faculty member at an institutional org is also an author by definition
  // of this design (Frame 2 caption: "Faculty · author · mentor").
  const isAuthor = !!activeOrg?.is_author || isFaculty || authoredBlueprintsCount > 0;

  // "Subscribed blueprints" count — must source from the same table the
  // Library Plans zone renders (blueprint_subscriptions), else the badge
  // reads 0 while the list below shows N. See useSubscribedPlansForLibrary.
  const { data: subscribedBlueprintsCount = 0 } = useQuery({
    queryKey: ['profile-menu-subs', userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      if (!userId) return 0;
      const { count, error } = await supabase
        .from('blueprint_subscriptions')
        .select('blueprint_id', { count: 'exact', head: true })
        .eq('subscriber_id', userId);
      if (error) {
        console.warn('[useProfileMenuData] subscribed-blueprints count failed', error);
        return 0;
      }
      return count ?? 0;
    },
  });

  // For admins, the People badge count = active memberships at their active org
  const isAdminFlag = !!activeOrg?.is_admin;
  const { data: seatsCount = 0 } = useQuery({
    queryKey: ['profile-menu-seats', activeOrgIdForCounts, isAdminFlag],
    enabled: !!activeOrgIdForCounts && isAdminFlag,
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      if (!activeOrgIdForCounts) return 0;
      const { count, error } = await supabase
        .from('organization_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', activeOrgIdForCounts)
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

  const counts = {
    subscribedBlueprints: subscribedBlueprintsCount,
    authoredBlueprints: authoredBlueprintsCount,
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
