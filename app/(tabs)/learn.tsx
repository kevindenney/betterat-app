/**
 * Learn Tab - BetterAt Course Catalog
 * Database-backed courses for all interests (sailing, nursing, drawing, fitness).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS } from '@/components/cards/constants';
import { IOSSegmentedControl } from '@/components/ui/ios/IOSSegmentedControl';
import { TabScreenToolbar } from '@/components/ui/TabScreenToolbar';
import { useScrollToolbarHide } from '@/hooks/useScrollToolbarHide';
import { useInterest } from '@/providers/InterestProvider';
import { useVocabulary } from '@/hooks/useVocabulary';
import { useAuth } from '@/providers/AuthProvider';
import { useOrganization } from '@/providers/OrganizationProvider';
import { useOrgMembers } from '@/hooks/useOrgMembers';
import { useCourses, type BetterAtCourse } from '@/hooks/useBetterAtCourses';
import { useOrganizationSearch } from '@/hooks/useOrganizationSearch';
import { isEmailAllowed, organizationDiscoveryService, type OrganizationJoinMode } from '@/services/OrganizationDiscoveryService';
import { supabase } from '@/services/supabase';
import { getActiveMembership, isActiveMembership as isActiveOrgMembership, isOrgAdminRole, resolveActiveOrgId } from '@/lib/organizations/adminGate';
import { isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback';
import { isUuid } from '@/utils/uuid';
import { coachRoleLabel } from '@/lib/organizations/roleLabels';

type LearnSegment = 'courses' | 'coaches' | 'people';

const NURSING_COACH_ROLES = new Set([
  'coach',
  'preceptor',
  'instructor',
  'clinical_instructor',
  'evaluator',
  'assessor',
  'admin',
  'manager',
]);
const SAILING_EXTRA_COACH_ROLES = new Set([
  'coordinator',
  'staff',
  'tutor',
  'volunteer',
  // Backward compatibility in case legacy rows still exist.
  'tactician',
  'sailmaker',
  'rigger',
  'race_officer',
  'team_captain',
]);

type UserCohort = {
  id: string;
  name: string;
  interest_slug: string | null;
};

export default function LearnScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { signedIn, user } = useAuth();
  const { memberships, activeOrganizationId, setActiveOrganizationId, refreshMemberships } = useOrganization();
  const [mounted, setMounted] = useState(false);
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const { toolbarHidden, handleScroll: handleToolbarScroll } = useScrollToolbarHide();
  const [activeSegment, setActiveSegment] = useState<LearnSegment>('courses');
  const [orgQuery, setOrgQuery] = useState('');
  const [peopleQuery, setPeopleQuery] = useState('');
  const [joinBusyOrgId, setJoinBusyOrgId] = useState<string | null>(null);
  const [leaveBusyMembershipId, setLeaveBusyMembershipId] = useState<string | null>(null);
  const [joinNotice, setJoinNotice] = useState<string | null>(null);
  const [pendingAccessCount, setPendingAccessCount] = useState(0);
  const [userCohorts, setUserCohorts] = useState<UserCohort[]>([]);
  const [userCohortsLoading, setUserCohortsLoading] = useState(false);
  const [userCohortsError, setUserCohortsError] = useState<string | null>(null);

  const isDesktop = mounted && width > 768;

  const { currentInterest } = useInterest();
  const { vocab } = useVocabulary();
  const interestSlug = String(currentInterest?.slug || '').trim().toLowerCase();
  const isSailingInterest = interestSlug === 'sail-racing' || interestSlug.includes('sail');
  const { data: betterAtCourses, isLoading: betterAtLoading } = useCourses();
  const filteredCourses = useMemo(() => betterAtCourses ?? [], [betterAtCourses]);
  const courseTabLabel = isSailingInterest ? 'Training' : 'Courses';
  const courseSectionLabel = isSailingInterest ? 'Training' : 'Courses';
  const coachesTabLabel = vocab('Coaches');
  const learnSegments = useMemo(
    () => [
      { value: 'courses' as const, label: courseTabLabel },
      { value: 'coaches' as const, label: coachesTabLabel },
      { value: 'people' as const, label: 'People' },
    ],
    [courseTabLabel, coachesTabLabel]
  );
  const {
    results: organizationResults,
    loading: organizationSearchLoading,
    errorText: organizationSearchError,
    refresh: refreshOrganizationSearch,
  } = useOrganizationSearch({
    query: orgQuery,
    enabled: activeSegment === 'courses' && signedIn,
    limit: 16,
  });
  const {
    members: orgMembers,
    loading: orgMembersLoading,
    error: orgMembersError,
    hasMore: orgMembersHasMore,
    retry: retryOrgMembers,
  } = useOrgMembers({
    organizationId: activeOrganizationId,
    enabled: activeSegment === 'coaches' || activeSegment === 'people',
    limit: 200,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadUserCohorts = async () => {
      if (!signedIn || !user?.id || !isUuid(user.id) || !activeOrganizationId || !isUuid(activeOrganizationId)) {
        if (!cancelled) {
          setUserCohorts([]);
          setUserCohortsError(null);
          setUserCohortsLoading(false);
        }
        return;
      }

      setUserCohortsLoading(true);
      setUserCohortsError(null);
      try {
        const { data: memberRows, error: memberError } = await supabase
          .from('betterat_org_cohort_members')
          .select('cohort_id')
          .eq('user_id', user.id);

        if (memberError) throw memberError;

        const cohortIds = Array.from(
          new Set(
            (memberRows || [])
              .map((row: any) => String(row.cohort_id || ''))
              .filter((id) => isUuid(id))
          )
        );

        if (cohortIds.length === 0) {
          if (!cancelled) {
            setUserCohorts([]);
          }
          return;
        }

        const { data: cohortRows, error: cohortError } = await supabase
          .from('betterat_org_cohorts')
          .select('id,name,interest_slug,org_id')
          .eq('org_id', activeOrganizationId)
          .in('id', cohortIds);

        if (cohortError) throw cohortError;

        const normalized = (cohortRows || []).map((row: any) => ({
          id: String(row.id),
          name: String(row.name || 'Cohort'),
          interest_slug: typeof row.interest_slug === 'string' ? row.interest_slug : null,
        }));

        if (!cancelled) {
          setUserCohorts(normalized);
        }
      } catch (error: any) {
        if (!cancelled) {
          setUserCohorts([]);
          setUserCohortsError(error?.message || 'Could not load cohort context.');
        }
      } finally {
        if (!cancelled) {
          setUserCohortsLoading(false);
        }
      }
    };

    if (activeSegment === 'courses') {
      void loadUserCohorts();
    }

    return () => {
      cancelled = true;
    };
  }, [activeOrganizationId, activeSegment, signedIn, user?.id]);

  const sortedMemberships = [...memberships].sort((a, b) => {
    const aStatus = String(a.membership_status || a.status || '').toLowerCase();
    const bStatus = String(b.membership_status || b.status || '').toLowerCase();
    const aRank = aStatus === 'active' || aStatus === 'verified' ? 0 : aStatus === 'pending' ? 1 : 2;
    const bRank = bStatus === 'active' || bStatus === 'verified' ? 0 : bStatus === 'pending' ? 1 : 2;
    if (aRank !== bRank) return aRank - bRank;
    return String(a.organization?.name || '').localeCompare(String(b.organization?.name || ''));
  });
  const membershipsByOrgId = useMemo(
    () => new Map(sortedMemberships.map((membership) => [membership.organization_id, membership])),
    [sortedMemberships]
  );
  const organizationResultsForDisplay = useMemo(() => {
    const byKey = new Map<string, (typeof organizationResults)[number]>();
    const getMembershipRank = (orgId: string): number => {
      const membership = membershipsByOrgId.get(orgId);
      const normalizedStatus = String(membership?.membership_status || membership?.status || '').toLowerCase();
      if (normalizedStatus === 'active' || normalizedStatus === 'verified') return 3;
      if (normalizedStatus === 'pending' || normalizedStatus === 'invited') return 2;
      if (normalizedStatus === 'rejected') return 1;
      return 0;
    };

    for (const org of organizationResults) {
      const slugKey = String(org.slug || '').trim().toLowerCase();
      const nameKey = String(org.name || '').trim().toLowerCase();
      const dedupeKey = nameKey ? `name:${nameKey}` : slugKey ? `slug:${slugKey}` : `id:${org.id}`;
      const existing = byKey.get(dedupeKey);
      if (!existing) {
        byKey.set(dedupeKey, org);
        continue;
      }

      const currentRank = getMembershipRank(org.id);
      const existingRank = getMembershipRank(existing.id);
      if (currentRank > existingRank) {
        byKey.set(dedupeKey, org);
      }
    }

    return Array.from(byKey.values());
  }, [organizationResults, membershipsByOrgId]);
  const activeMembershipCount = useMemo(
    () =>
      sortedMemberships.filter((membership) => {
        const normalizedStatus = String(membership.membership_status || membership.status || '').toLowerCase();
        return normalizedStatus === 'active' || normalizedStatus === 'verified';
      }).length,
    [sortedMemberships]
  );
  const canLeaveActiveMembership = activeMembershipCount > 1;
  const resolvedActiveOrgId = useMemo(
    () => resolveActiveOrgId({ activeOrganizationId, memberships: memberships as any }),
    [activeOrganizationId, memberships]
  );
  const activeOrgMembership = useMemo(
    () => getActiveMembership({ memberships: memberships as any, activeOrgId: resolvedActiveOrgId }),
    [memberships, resolvedActiveOrgId]
  );
  const hasActiveOrgAdmin = useMemo(() => {
    if (!resolvedActiveOrgId || !isUuid(resolvedActiveOrgId)) return false;
    return (
      isActiveOrgMembership(activeOrgMembership?.membershipStatus || null)
      && isOrgAdminRole(activeOrgMembership?.role || null)
    );
  }, [activeOrgMembership?.membershipStatus, activeOrgMembership?.role, resolvedActiveOrgId]);

  useEffect(() => {
    let cancelled = false;

    const loadPendingAccessCount = async () => {
      if (
        activeSegment !== 'courses'
        || !hasActiveOrgAdmin
        || !resolvedActiveOrgId
        || !isUuid(resolvedActiveOrgId)
      ) {
        if (!cancelled) {
          setPendingAccessCount(0);
        }
        return;
      }

      try {
        let { count, error } = await supabase
          .from('organization_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', resolvedActiveOrgId)
          .eq('membership_status', 'pending');
        if (error && isMissingSupabaseColumn(error, 'organization_memberships.membership_status')) {
          const fallback = await supabase
            .from('organization_memberships')
            .select('id', { count: 'exact', head: true })
            .eq('organization_id', resolvedActiveOrgId)
            .eq('status', 'pending');
          count = fallback.count;
          error = fallback.error;
        }
        if (error) throw error;
        if (!cancelled) {
          setPendingAccessCount(count || 0);
        }
      } catch {
        if (!cancelled) {
          setPendingAccessCount(0);
        }
      }
    };

    void loadPendingAccessCount();
    return () => {
      cancelled = true;
    };
  }, [activeSegment, hasActiveOrgAdmin, resolvedActiveOrgId]);

  const handleJoinOrganization = async (orgId: string, mode: OrganizationJoinMode) => {
    if (joinBusyOrgId) return;
    setJoinBusyOrgId(orgId);
    setJoinNotice(null);
    try {
      const result = await organizationDiscoveryService.requestJoin({orgId, mode});
      setJoinNotice(result.message);
      await refreshMemberships();
      await refreshOrganizationSearch();
    } catch (error: any) {
      setJoinNotice(String(error?.message || 'Could not send request. Please try again.'));
    } finally {
      setJoinBusyOrgId(null);
    }
  };

  const leaveOrganization = async (membershipId: string, organizationId: string) => {
    if (!user?.id || !isUuid(organizationId) || leaveBusyMembershipId) return;
    if (!canLeaveActiveMembership) {
      setJoinNotice('You need at least one organization.');
      return;
    }
    setLeaveBusyMembershipId(membershipId);
    setJoinNotice(null);
    const wasCurrentOrg = activeOrganizationId === organizationId;

    let payload: Record<string, any> = {
      membership_status: 'rejected',
      status: 'rejected',
      is_verified: false,
      verified_at: null,
      joined_at: null,
    };

    const missingColumnMap: [string, string][] = [
      ['membership_status', 'organization_memberships.membership_status'],
      ['status', 'organization_memberships.status'],
      ['is_verified', 'organization_memberships.is_verified'],
      ['verified_at', 'organization_memberships.verified_at'],
      ['joined_at', 'organization_memberships.joined_at'],
    ];

    try {
      while (true) {
        const { data, error } = await supabase
          .from('organization_memberships')
          .update(payload)
          .select('id')
          .eq('id', membershipId)
          .eq('organization_id', organizationId)
          .eq('user_id', user.id);

        if (!error) {
          if (!Array.isArray(data) || data.length === 0) {
            setJoinNotice('Could not leave this organization. Ask an Org Admin to remove your access.');
            break;
          }
          setJoinNotice('Access removed.');
          await refreshMemberships();
          await refreshOrganizationSearch();
          if (wasCurrentOrg) {
            let nextActiveOrgId: string | null = null;
            let rows: any[] | null = null;

            const query = await supabase
              .from('organization_memberships')
              .select('organization_id,membership_status,status')
              .eq('user_id', user.id)
              .in('membership_status', ['active', 'verified']);

            if (query.error && isMissingSupabaseColumn(query.error, 'organization_memberships.membership_status')) {
              const fallback = await supabase
                .from('organization_memberships')
                .select('organization_id,status')
                .eq('user_id', user.id)
                .in('status', ['active', 'verified']);
              rows = fallback.data || null;
            } else {
              rows = query.data || null;
            }

            const nextRow = (rows || []).find((row) => String(row.organization_id || '') !== organizationId) || (rows || [])[0];
            const candidateOrgId = String(nextRow?.organization_id || '');
            if (isUuid(candidateOrgId)) {
              nextActiveOrgId = candidateOrgId;
            }

            if (nextActiveOrgId) {
              await setActiveOrganizationId(nextActiveOrgId);
            } else {
              await setActiveOrganizationId(null);
              router.replace('/events');
              setJoinNotice('You are no longer in any organizations.');
            }
          }
          break;
        }

        const missing = missingColumnMap.find(([key, qualified]) =>
          payload[key] !== undefined && isMissingSupabaseColumn(error, qualified)
        );

        if (!missing) {
          throw error;
        }

        const [missingKey] = missing;
        const nextPayload = { ...payload };
        delete nextPayload[missingKey];
        payload = nextPayload;
      }
    } catch (error: any) {
      setJoinNotice(String(error?.message || 'Could not leave organization.'));
    } finally {
      setLeaveBusyMembershipId(null);
    }
  };

  const handleLeaveOrganization = (membershipId: string, organizationName: string, organizationId: string) => {
    if (!canLeaveActiveMembership) {
      setJoinNotice('You need at least one organization.');
      return;
    }
    showConfirm(
      'Leave organization?',
      `You will lose access to ${organizationName}. You can request access again later.`,
      () => {
        void leaveOrganization(membershipId, organizationId);
      },
      { destructive: true },
    );
  };

  const getJoinModeLabel = (mode: OrganizationJoinMode): string => {
    if (mode === 'open_join') return 'Open join';
    if (mode === 'request_to_join') return 'Request to join';
    return 'Invite only';
  };

  const getRestrictedSubtitle = (allowedDomains: string[]): string => {
    const firstDomain = String((allowedDomains || [])[0] || '').trim().toLowerCase().replace(/^@/, '');
    if (!firstDomain) {
      return 'Restricted by organization policy';
    }
    return `Requires @${firstDomain}`;
  };

  const getMembershipSearchStatus = (status: string | null | undefined): 'active' | 'pending' | 'rejected' | 'none' => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'active' || normalized === 'verified') return 'active';
    if (normalized === 'pending' || normalized === 'invited') return 'pending';
    if (normalized === 'rejected') return 'rejected';
    return 'none';
  };

  const getMembershipStatusLabel = (status: string | null | undefined): string => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'active' || normalized === 'verified') return 'Active';
    if (normalized === 'pending' || normalized === 'invited') return 'Pending';
    if (normalized === 'rejected') return 'Rejected';
    return 'Inactive';
  };

  const handleBetterAtCoursePress = (course: BetterAtCourse) => {
    router.push({
      pathname: '/(tabs)/learn/[courseId]',
      params: { courseId: course.id },
    });
  };

  const coachRoleSet = useMemo(() => {
    if (isSailingInterest) {
      return new Set<string>([...NURSING_COACH_ROLES, ...SAILING_EXTRA_COACH_ROLES]);
    }
    return NURSING_COACH_ROLES;
  }, [isSailingInterest]);

  const coaches = useMemo(
    () => orgMembers.filter((member) => coachRoleSet.has(member.role.toLowerCase())),
    [coachRoleSet, orgMembers]
  );

  const filteredPeople = useMemo(() => {
    const query = peopleQuery.trim().toLowerCase();
    if (!query) return orgMembers;
    return orgMembers.filter((member) => {
      return (
        member.name.toLowerCase().includes(query) ||
        member.role.toLowerCase().includes(query) ||
        member.status.toLowerCase().includes(query) ||
        (member.email || '').toLowerCase().includes(query)
      );
    });
  }, [orgMembers, peopleQuery]);

  const isMemberActive = (status: string) => status === 'active' || status === 'verified';
  const statusLabel = (status: string) => (isMemberActive(status) ? 'Active' : status === 'pending' ? 'Pending' : 'Inactive');
  return (
    <View style={styles.container}>
      {/* Scroll content first — flows behind absolutely-positioned toolbar */}
      {activeSegment === 'courses' ? (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingTop: toolbarHeight }]} onScroll={handleToolbarScroll} scrollEventThrottle={16}>
          <View style={[styles.content, isDesktop && styles.contentDesktop]}>
            {betterAtLoading ? (
              <View style={styles.betterAtLoading}>
                <ActivityIndicator size="large" color={currentInterest?.accent_color || IOS_COLORS.systemBlue} />
              </View>
            ) : !filteredCourses || filteredCourses.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="book-outline" size={32} color={IOS_COLORS.gray3} />
                <Text style={styles.emptyText}>No {courseSectionLabel.toLowerCase()} available yet</Text>
                <Text style={styles.emptySubtext}>
                  {courseSectionLabel} for {currentInterest?.name || 'this interest'} are coming soon
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.orgSection}>
                  <Text style={styles.orgSectionTitle}>Your Organizations</Text>
                  {sortedMemberships.length === 0 ? (
                    <Text style={styles.orgHint}>No organizations yet.</Text>
                  ) : (
                    <View style={styles.orgList}>
                      {sortedMemberships.map((membership) => {
                        const statusText = getMembershipStatusLabel(membership.membership_status || membership.status);
                        const normalizedStatus = String(membership.membership_status || membership.status || '').toLowerCase();
                        const isPending = normalizedStatus === 'pending' || normalizedStatus === 'invited';
                        const isActiveOrg = activeOrganizationId === membership.organization_id;
                        return (
                          <View key={membership.id} style={styles.orgRow}>
                            <View style={styles.orgRowBody}>
                              <Text style={styles.orgName}>{membership.organization?.name || 'Organization'}</Text>
                              <View style={styles.orgMetaRow}>
                                <Text style={styles.orgMetaText}>{statusText}</Text>
                                <Text style={styles.orgMetaDot}>·</Text>
                                <Text style={styles.orgMetaText}>
                                  {coachRoleLabel({ interestSlug, role: membership.role })}
                                </Text>
                              </View>
                              {isPending ? (
                                <Text style={styles.orgPendingHelper}>Awaiting approval</Text>
                              ) : null}
                            </View>
                            {isPending ? (
                              <View style={[styles.inviteRequiredPill, styles.pendingPill]}>
                                <Text style={[styles.inviteRequiredText, styles.pendingPillText]}>Pending</Text>
                              </View>
                            ) : (
                              <View style={styles.orgActionsColumn}>
                                <TouchableOpacity
                                  style={[styles.orgActionButton, isActiveOrg && styles.orgActionButtonActive]}
                                  onPress={() => setActiveOrganizationId(membership.organization_id)}
                                  disabled={isActiveOrg}
                                >
                                  <Text style={[styles.orgActionText, isActiveOrg && styles.orgActionTextActive]}>
                                    {isActiveOrg ? 'Current' : 'Use this org'}
                                  </Text>
                                </TouchableOpacity>
                                {isMemberActive(normalizedStatus) && !isOrgAdminRole(membership.role) ? (
                                  <TouchableOpacity
                                    style={styles.leaveActionButton}
                                    onPress={() =>
                                      handleLeaveOrganization(
                                        membership.id,
                                        membership.organization?.name || 'this organization',
                                        membership.organization_id
                                      )
                                    }
                                    disabled={leaveBusyMembershipId === membership.id || !canLeaveActiveMembership}
                                  >
                                    <Text style={styles.leaveActionText}>
                                      {leaveBusyMembershipId === membership.id ? 'Leaving...' : 'Leave'}
                                    </Text>
                                  </TouchableOpacity>
                                ) : null}
                                {isMemberActive(normalizedStatus) && !isOrgAdminRole(membership.role) && !canLeaveActiveMembership ? (
                                  <Text style={styles.leaveHelperText}>You need at least one org.</Text>
                                ) : null}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                {hasActiveOrgAdmin && resolvedActiveOrgId && isUuid(resolvedActiveOrgId) ? (
                  <View style={styles.orgSection}>
                    <Text style={styles.orgSectionTitle}>Admin tools</Text>
                    <View style={styles.adminToolsList}>
                      <TouchableOpacity style={styles.adminToolRow} onPress={() => router.push('/settings/organization-access')}>
                        <Text style={styles.adminToolLabel}>Organization access</Text>
                        <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.adminToolRow} onPress={() => router.push('/organization/access-requests')}>
                        <Text style={styles.adminToolLabel}>Access requests</Text>
                        <View style={styles.adminToolRight}>
                          {pendingAccessCount > 0 ? (
                            <View style={styles.pendingCountBadge}>
                              <Text style={styles.pendingCountText}>{pendingAccessCount}</Text>
                            </View>
                          ) : null}
                          <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.adminToolRow} onPress={() => router.push('/organization/members')}>
                        <Text style={styles.adminToolLabel}>Members</Text>
                        <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.adminToolRow} onPress={() => router.push('/organization/cohorts')}>
                        <Text style={styles.adminToolLabel}>Cohorts</Text>
                        <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.adminToolRow} onPress={() => router.push('/organization/templates')}>
                        <Text style={styles.adminToolLabel}>Blueprints</Text>
                        <Ionicons name="chevron-forward" size={16} color={IOS_COLORS.tertiaryLabel} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                <View style={styles.orgSection}>
                  <Text style={styles.orgSectionTitle}>Find an organization</Text>
                  <TextInput
                    style={styles.orgSearchInput}
                    value={orgQuery}
                    onChangeText={setOrgQuery}
                    placeholder="Search by name or slug"
                    placeholderTextColor={IOS_COLORS.tertiaryLabel}
                    autoCapitalize="none"
                  />
                  {joinNotice ? (
                    <Text style={styles.orgNotice}>{joinNotice}</Text>
                  ) : null}
                  {organizationSearchError ? (
                    <Text style={styles.orgError}>{organizationSearchError}</Text>
                  ) : null}
                  {organizationSearchLoading ? (
                    <View style={styles.orgSearchLoading}>
                      <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
                    </View>
                  ) : (
                    <View style={styles.orgList}>
                      {organizationResultsForDisplay.map((org) => {
                        const isInviteOnly = org.join_mode === 'invite_only';
                        const isRequestMode = org.join_mode === 'request_to_join';
                        const isOpenJoinMode = org.join_mode === 'open_join';
                        const isBusy = joinBusyOrgId === org.id;
                        const hasDomainRestriction = Array.isArray(org.allowed_email_domains) && org.allowed_email_domains.length > 0;
                        const existingMembership = membershipsByOrgId.get(org.id);
                        const membershipStatus = getMembershipSearchStatus(existingMembership?.membership_status || existingMembership?.status || null);
                        const hasMembership = membershipStatus !== 'none';
                        const isOpenJoinRestricted = isOpenJoinMode
                          && hasDomainRestriction
                          && !isEmailAllowed({email: user?.email, allowedDomains: org.allowed_email_domains});
                        return (
                          <View key={org.id} style={styles.orgRow}>
                            <View style={styles.orgRowBody}>
                              <Text style={styles.orgName}>{org.name}</Text>
                              <Text style={styles.orgJoinModeLabel}>{getJoinModeLabel(org.join_mode)}</Text>
                            </View>
                            {hasMembership && membershipStatus === 'active' ? (
                              <View style={[styles.orgActionButton, styles.orgActionButtonDisabled]}>
                                <Text style={[styles.orgActionText, styles.orgActionTextDisabled]}>Member</Text>
                              </View>
                            ) : hasMembership && membershipStatus === 'pending' ? (
                              <View style={[styles.orgActionButton, styles.orgActionButtonDisabled]}>
                                <Text style={[styles.orgActionText, styles.orgActionTextDisabled]}>Request sent</Text>
                              </View>
                            ) : hasMembership && membershipStatus === 'rejected' ? (
                              <View style={[styles.orgActionButton, styles.orgActionButtonDisabled]}>
                                <Text style={[styles.orgActionText, styles.orgActionTextDisabled]}>Removed</Text>
                              </View>
                            ) : isInviteOnly ? (
                              <View style={styles.orgActionsColumn}>
                                <View style={styles.inviteRequiredPill}>
                                  <Text style={styles.inviteRequiredText}>Invite required</Text>
                                </View>
                                <TouchableOpacity
                                  style={styles.orgActionButton}
                                  onPress={() => router.push('/org-invite')}
                                >
                                  <Text style={styles.orgActionText}>Use invite token</Text>
                                </TouchableOpacity>
                              </View>
                            ) : isOpenJoinRestricted ? (
                              <View style={styles.orgActionsColumn}>
                                <View style={[styles.orgActionButton, styles.orgActionButtonDisabled]}>
                                  <Text style={[styles.orgActionText, styles.orgActionTextDisabled]}>Restricted</Text>
                                </View>
                                <Text style={styles.orgRestrictionText}>{getRestrictedSubtitle(org.allowed_email_domains)}</Text>
                              </View>
                            ) : (
                              <TouchableOpacity
                                style={styles.orgActionButton}
                                onPress={() => handleJoinOrganization(org.id, org.join_mode)}
                                disabled={isBusy}
                              >
                                <Text style={styles.orgActionText}>
                                  {isBusy ? 'Saving...' : isRequestMode ? 'Request access' : 'Join'}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })}
                      {organizationResultsForDisplay.length === 0 ? (
                        <Text style={styles.orgHint}>No organizations found.</Text>
                      ) : null}
                    </View>
                  )}
                </View>

                {userCohortsLoading ? (
                  <View style={styles.orgSearchLoading}>
                    <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
                  </View>
                ) : userCohorts.length > 0 ? (
                  <View style={styles.cohortBadgeRow}>
                    <Text style={styles.cohortBadgeLabel}>{userCohorts.length > 1 ? 'Your cohorts' : 'Your cohort'}</Text>
                    {userCohorts.slice(0, 3).map((cohort) => (
                      <View key={cohort.id} style={styles.cohortPill}>
                        <Text style={styles.cohortPillText}>{cohort.name}</Text>
                      </View>
                    ))}
                    {userCohorts.length > 3 ? (
                      <View style={styles.cohortPill}>
                        <Text style={styles.cohortPillText}>+{userCohorts.length - 3}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : userCohortsError ? (
                  <Text style={styles.orgError}>{userCohortsError}</Text>
                ) : null}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>{courseSectionLabel.toUpperCase()}</Text>
                  <Text style={styles.sectionCount}>{filteredCourses.length}</Text>
                </View>
                <View style={styles.coursesList}>
                  {filteredCourses.map((course) => (
                    <TouchableOpacity
                      key={course.id}
                      style={styles.betterAtCourseRow}
                      onPress={() => handleBetterAtCoursePress(course)}
                      activeOpacity={0.7}
                    >
                      <View style={[
                        styles.betterAtCourseAccent,
                        { backgroundColor: currentInterest?.accent_color || '#003DA5' },
                      ]} />
                      <View style={styles.betterAtCourseInfo}>
                        <Text style={styles.betterAtCourseTitle}>{course.title}</Text>
                        {course.description && (
                          <Text style={styles.betterAtCourseDesc} numberOfLines={2}>
                            {course.description}
                          </Text>
                        )}
                        <View style={styles.betterAtCourseMeta}>
                          <Text style={styles.betterAtCourseLevel}>{course.level}</Text>
                          <Text style={styles.betterAtCourseMetaSep}>·</Text>
                          <Text style={styles.betterAtCourseLessons}>
                            {course.lesson_count} {course.lesson_count === 1 ? 'lesson' : 'lessons'}
                          </Text>
                          {course.topic && (
                            <>
                              <Text style={styles.betterAtCourseMetaSep}>·</Text>
                              <Text style={styles.betterAtCourseTopic}>{course.topic}</Text>
                            </>
                          )}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={IOS_COLORS.tertiaryLabel} />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: toolbarHeight }]}
          onScroll={handleToolbarScroll}
          scrollEventThrottle={16}
        >
          <View style={[styles.content, isDesktop && styles.contentDesktop]}>
            {!activeOrganizationId ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={32} color={IOS_COLORS.gray3} />
                <Text style={styles.emptyText}>No active organization selected</Text>
                <Text style={styles.emptySubtext}>Choose an organization to view members.</Text>
                <TouchableOpacity
                  style={styles.primaryActionButton}
                  onPress={() => router.push('/settings/organization-access')}
                >
                  <Text style={styles.primaryActionText}>Open Organization Access</Text>
                </TouchableOpacity>
              </View>
            ) : orgMembersLoading ? (
              <View style={styles.betterAtLoading}>
                <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
              </View>
            ) : orgMembersError ? (
              <View style={styles.emptyState}>
                <Ionicons name="alert-circle-outline" size={32} color={IOS_COLORS.systemRed} />
                <Text style={styles.emptyText}>Could not load members</Text>
                <Text style={styles.orgError}>{orgMembersError}</Text>
                <TouchableOpacity style={styles.primaryActionButton} onPress={retryOrgMembers}>
                  <Text style={styles.primaryActionText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : activeSegment === 'coaches' ? (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>COACHES</Text>
                  <Text style={styles.sectionCount}>{coaches.length}</Text>
                </View>
                <View style={styles.coursesList}>
                  {coaches.map((coach) => (
                    <View key={`${coach.userId}-${coach.role}`} style={styles.memberRow}>
                      <View style={styles.memberRowBody}>
                        <Text style={styles.memberName}>{coach.name}</Text>
                        <View style={styles.memberMetaRow}>
                          <View style={[styles.roleBadge, styles.roleBadgeCoach]}>
                            <Text style={[styles.badgeText, styles.roleBadgeCoachText]}>
                              {coachRoleLabel({ interestSlug, role: coach.role })}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.roleBadge,
                              isMemberActive(coach.status) ? styles.statusBadgeActive : styles.statusBadgePending,
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeText,
                                isMemberActive(coach.status) ? styles.statusBadgeActiveText : styles.statusBadgePendingText,
                              ]}
                            >
                              {statusLabel(coach.status)}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity style={styles.orgActionButton} onPress={() => router.push('/communications')}>
                        <Text style={styles.orgActionText}>Message</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {coaches.length === 0 ? (
                    <Text style={styles.orgHint}>No coach-role members in this organization yet.</Text>
                  ) : null}
                </View>
              </>
            ) : (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionLabel}>PEOPLE</Text>
                  <Text style={styles.sectionCount}>{filteredPeople.length}</Text>
                </View>
                <TextInput
                  style={styles.orgSearchInput}
                  value={peopleQuery}
                  onChangeText={setPeopleQuery}
                  placeholder="Search members"
                  placeholderTextColor={IOS_COLORS.tertiaryLabel}
                  autoCapitalize="none"
                />
                {orgMembersHasMore ? <Text style={styles.orgHint}>Showing first 200 members.</Text> : null}
                <View style={styles.coursesList}>
                  {filteredPeople.map((member) => (
                    <View key={`${member.userId}-${member.role}`} style={styles.memberRow}>
                      <View style={styles.memberRowBody}>
                        <Text style={styles.memberName}>{member.name}</Text>
                        <View style={styles.memberMetaRow}>
                          <Text style={styles.memberMetaText}>
                            {coachRoleLabel({ interestSlug, role: member.role })}
                          </Text>
                          <Text style={styles.memberMetaDot}>·</Text>
                          <Text style={styles.memberMetaText}>{statusLabel(member.status)}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                  {filteredPeople.length === 0 ? (
                    <Text style={styles.orgHint}>No matching members.</Text>
                  ) : null}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      )}

      {/* Toolbar rendered last — absolutely positioned over content */}
      <TabScreenToolbar
        title="Learn"
        topInset={insets.top}
        actions={[
          {
            icon: 'search-outline',
            sfSymbol: 'magnifyingglass',
            label: 'Search courses',
            onPress: () => router.push('/(tabs)/search'),
          },
          {
            icon: 'bookmark-outline',
            sfSymbol: 'bookmark',
            label: 'Saved courses',
            onPress: () => router.push('/(tabs)/my-learning'),
          },
        ]}
        onMeasuredHeight={setToolbarHeight}
        hidden={toolbarHidden}
      >
        {/* Apple HIG Segmented Control: interest-specific Courses label | Coaches | People */}
        <View style={styles.segmentedControlContainer}>
          <IOSSegmentedControl
            segments={learnSegments}
            selectedValue={activeSegment}
            onValueChange={setActiveSegment}
          />
        </View>
      </TabScreenToolbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  segmentedControlContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  content: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  contentDesktop: {
    paddingHorizontal: 24,
  },
  // iOS Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.tertiaryLabel,
  },
  // Course list
  coursesList: {
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 10,
    marginBottom: 16,
    overflow: 'hidden',
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 6,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    marginTop: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: IOS_COLORS.tertiaryLabel,
  },
  // BetterAt DB-backed course styles
  betterAtLoading: {
    paddingVertical: 64,
    alignItems: 'center',
  },
  orgSection: {
    marginBottom: 14,
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 8,
  },
  orgSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
  },
  orgSearchInput: {
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    paddingHorizontal: 10,
    color: IOS_COLORS.label,
  },
  orgList: {
    gap: 8,
  },
  orgRow: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  orgRowBody: {
    flex: 1,
    gap: 2,
  },
  orgName: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  orgMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orgMetaText: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  orgMetaDot: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
  },
  orgJoinModeLabel: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  orgActionButton: {
    minHeight: 30,
    minWidth: 82,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: IOS_COLORS.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  orgActionsColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },
  orgActionButtonActive: {
    borderColor: '#16A34A',
    backgroundColor: '#ECFDF3',
  },
  orgActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
  orgActionTextActive: {
    color: '#15803D',
  },
  leaveActionButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  leaveActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_COLORS.systemRed,
  },
  leaveHelperText: {
    fontSize: 10,
    color: IOS_COLORS.tertiaryLabel,
  },
  inviteRequiredPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  inviteRequiredText: {
    fontSize: 11,
    color: IOS_COLORS.secondaryLabel,
    fontWeight: '600',
  },
  pendingPill: {
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  pendingPillText: {
    color: '#1D4ED8',
  },
  orgHint: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  orgPendingHelper: {
    fontSize: 11,
    color: IOS_COLORS.tertiaryLabel,
  },
  orgNotice: {
    fontSize: 12,
    color: '#15803D',
    fontWeight: '500',
  },
  orgError: {
    fontSize: 12,
    color: IOS_COLORS.systemRed,
  },
  orgSearchLoading: {
    paddingVertical: 6,
    alignItems: 'flex-start',
  },
  adminToolsList: {
    gap: 8,
  },
  adminToolRow: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  adminToolLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  adminToolRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pendingCountBadge: {
    minWidth: 18,
    borderRadius: 999,
    backgroundColor: IOS_COLORS.systemRed,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  pendingCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cohortBadgeRow: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  cohortBadgeLabel: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    fontWeight: '600',
    marginRight: 2,
  },
  cohortPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cohortPillText: {
    fontSize: 11,
    color: '#1D4ED8',
    fontWeight: '600',
  },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  templateIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  templateBody: {
    flex: 1,
    gap: 2,
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  templateDescription: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 16,
  },
  primaryActionButton: {
    marginTop: 10,
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: IOS_COLORS.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  orgActionButtonDisabled: {
    borderColor: '#D1D5DB',
    backgroundColor: '#F8FAFC',
  },
  orgActionTextDisabled: {
    color: IOS_COLORS.secondaryLabel,
  },
  orgRestrictionText: {
    fontSize: 10,
    color: IOS_COLORS.tertiaryLabel,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  memberRowBody: {
    flex: 1,
    gap: 4,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  memberMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberMetaText: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
  },
  memberMetaDot: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
  },
  roleBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleBadgeCoach: {
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  roleBadgeCoachText: {
    color: '#1D4ED8',
  },
  statusBadgeActive: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  statusBadgeActiveText: {
    color: '#15803D',
  },
  statusBadgePending: {
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
  },
  statusBadgePendingText: {
    color: '#64748B',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  betterAtCourseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  betterAtCourseAccent: {
    width: 4,
    height: '80%',
    borderRadius: 2,
    marginRight: 12,
  },
  betterAtCourseInfo: {
    flex: 1,
  },
  betterAtCourseTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 3,
  },
  betterAtCourseDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 6,
  },
  betterAtCourseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  betterAtCourseLevel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'capitalize',
  },
  betterAtCourseMetaSep: {
    fontSize: 11,
    color: '#CBD5E1',
  },
  betterAtCourseLessons: {
    fontSize: 11,
    color: '#64748B',
  },
  betterAtCourseTopic: {
    fontSize: 11,
    color: '#64748B',
  },
});
