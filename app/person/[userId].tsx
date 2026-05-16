import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TabScreenToolbar } from '@/components/ui/TabScreenToolbar';
import { supabase } from '@/services/supabase';
import { isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback';
import { useInterest } from '@/providers/InterestProvider';
import { useAuth } from '@/providers/AuthProvider';
import { findPersonBySlug, type PersonSearchResult, type SampleTimelineStep } from '@/lib/landing/sampleData';
import { SimpleLandingNav } from '@/components/landing/SimpleLandingNav';
import { Footer } from '@/components/landing/Footer';
import { ScrollFix } from '@/components/landing/ScrollFix';
import { PersonTimelineRow } from '@/components/landing/PersonTimelineRow';
import { InterestTimelineCard } from '@/components/profile/InterestTimelineCard';
import { FollowButton } from '@/components/social/FollowButton';
import { CrewFinderService } from '@/services/CrewFinderService';
import { useUserTimeline, useAdoptStep, useUpdateStep } from '@/hooks/useTimelineSteps';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import type { TimelineStepVisibility } from '@/types/timeline-steps';
import type { BlueprintRecord } from '@/types/blueprint';

// UUID v4 pattern check
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VISIBILITY_CYCLE: TimelineStepVisibility[] = ['followers', 'organization', 'private'];
const VISIBILITY_LABELS: Record<TimelineStepVisibility, string> = {
  followers: 'Followers',
  organization: 'Organization',
  private: 'Private',
  coaches: 'Coaches',
};
const VISIBILITY_ICONS: Record<TimelineStepVisibility, string> = {
  followers: 'people-outline',
  organization: 'business-outline',
  private: 'lock-closed-outline',
  coaches: 'school-outline',
};

// ── DB user profile (existing behavior) ─────────────────────────────

type MembershipRow = {
  organization_id: string;
  role: string | null;
  status: string | null;
  membership_status: string | null;
};

type OrganizationRow = {
  id: string;
  name: string;
  slug: string | null;
  interest_slug: string | null;
};

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isActiveMembership(row: MembershipRow): boolean {
  const membershipStatus = normalize(row.membership_status);
  const status = normalize(row.status);
  return membershipStatus === 'active' || status === 'active';
}

/** Convert DB TimelineStepRecord status to SampleTimelineStep status */
function toSampleStatus(status: string): SampleTimelineStep['status'] {
  if (status === 'completed') return 'completed';
  if (status === 'in_progress') return 'current';
  return 'upcoming';
}

type ProfileTab = 'timelines' | 'activities' | 'organizations';

function DbUserProfile({ userId }: { userId: string }) {
  const { user } = useAuth();
  const isOwner = user?.id === userId;
  const isSignedIn = Boolean(user?.id);
  const insets = useSafeAreaInsets();

  const [toolbarHeight, setToolbarHeight] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [name, setName] = useState('Unknown');
  const [email, setEmail] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [organizations, setOrganizations] = useState<Map<string, OrganizationRow>>(new Map());
  const [activities, setActivities] = useState<{ id: string; name: string; date: string | null; venue: string | null }[]>([]);
  const [blueprints, setBlueprints] = useState<BlueprintRecord[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>('timelines');
  const timelineQuery = useUserTimeline(userId);
  const { allInterests } = useInterest();

  // Follow state
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Refetch profile data when screen regains focus (e.g. after editing settings)
  const focusCount = useRef(0);
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      // Skip the initial mount — only refetch on subsequent focuses
      if (focusCount.current > 0) {
        setRefreshKey((k) => k + 1);
      }
      focusCount.current += 1;
    }, [])
  );

  useEffect(() => {
    if (!isSignedIn || isOwner || !user?.id) return;
    CrewFinderService.isFollowing(user.id, userId).then(setFollowing).catch(() => {});
  }, [isSignedIn, isOwner, user?.id, userId]);

  const handleFollow = useCallback(async () => {
    if (!user?.id) return;
    setFollowLoading(true);
    try {
      await CrewFinderService.followUser(user.id, userId);
      setFollowing(true);
    } finally {
      setFollowLoading(false);
    }
  }, [user?.id, userId]);

  const handleUnfollow = useCallback(async () => {
    if (!user?.id) return;
    setFollowLoading(true);
    try {
      await CrewFinderService.unfollowUser(user.id, userId);
      setFollowing(false);
    } finally {
      setFollowLoading(false);
    }
  }, [user?.id, userId]);

  // Adopt state
  const adoptMutation = useAdoptStep();
  const [adoptedStepIds, setAdoptedStepIds] = useState<Set<string>>(new Set());

  const handleAdopt = useCallback((stepId: string, interestId: string) => {
    adoptMutation.mutate(
      { sourceStepId: stepId, interestId },
      { onSuccess: () => setAdoptedStepIds((prev) => new Set(prev).add(stepId)) },
    );
  }, [adoptMutation]);

  // Visibility controls (owner only)
  const updateStepMutation = useUpdateStep();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErrorText(null);
      try {
        // Try profiles table first. For non-owners, do not fall back to
        // `users` if RLS hides a private profile; that would leak name/email.
        const profileResult = await supabase
          .from('profiles')
          .select('id,full_name,avatar_url,profile_public')
          .eq('id', userId)
          .maybeSingle();

        if (!profileResult.data && !isOwner) {
          throw new Error('This profile is private');
        }

        const userResult = isOwner
          ? await supabase
              .from('users')
              .select('id,full_name,email')
              .eq('id', userId)
              .maybeSingle()
          : { data: null };

        if (!profileResult.data && !userResult.data) throw new Error('User not found');
        if (!cancelled) {
          setName(String(
            profileResult.data?.full_name ||
            (userResult.data as any)?.full_name ||
            (userResult.data as any)?.email ||
            userId
          ));
          setEmail(isOwner && (userResult.data as any)?.email ? String((userResult.data as any).email) : null);
        }

        let membershipResult = await supabase
          .from('organization_memberships')
          .select('organization_id,role,status,membership_status')
          .eq('user_id', userId)
          .limit(3000);
        if (membershipResult.error && isMissingSupabaseColumn(membershipResult.error, 'organization_memberships.membership_status')) {
          membershipResult = await supabase
            .from('organization_memberships')
            .select('organization_id,role,status')
            .eq('user_id', userId)
            .limit(3000);
        }
        if (membershipResult.error) throw membershipResult.error;
        const membershipRows: MembershipRow[] = (membershipResult.data || []).map((row: any) => ({
          organization_id: String(row.organization_id || ''),
          role: row.role ? String(row.role) : null,
          status: row.status ? String(row.status) : null,
          membership_status: row.membership_status ? String(row.membership_status) : null,
        }));
        const activeMemberships = membershipRows.filter(isActiveMembership);
        if (!cancelled) setMemberships(activeMemberships);

        const orgIds = Array.from(new Set(activeMemberships.map((m) => m.organization_id).filter(Boolean)));
        if (orgIds.length > 0) {
          const orgResult = await supabase
            .from('organizations')
            .select('id,name,slug,interest_slug')
            .in('id', orgIds)
            .limit(4000);
          if (orgResult.error) throw orgResult.error;
          const map = new Map<string, OrganizationRow>();
          for (const row of orgResult.data || []) {
            map.set(String((row as any).id), {
              id: String((row as any).id),
              name: String((row as any).name || ''),
              slug: (row as any).slug ? String((row as any).slug) : null,
              interest_slug: (row as any).interest_slug ? String((row as any).interest_slug) : null,
            });
          }
          if (!cancelled) setOrganizations(map);
        } else if (!cancelled) {
          setOrganizations(new Map());
        }

        const activityResult = await supabase
          .from('regattas')
          .select('id,name,start_date,start_area_name')
          .eq('created_by', userId)
          .order('start_date', { ascending: false })
          .limit(20);
        if (!activityResult.error && !cancelled) {
          setActivities(
            (activityResult.data || []).map((row: any) => ({
              id: String(row.id),
              name: String(row.name || 'Untitled Activity'),
              date: row.start_date ? String(row.start_date) : null,
              venue: row.start_area_name ? String(row.start_area_name) : null,
            })),
          );
        }

        // Fetch published blueprints
        try {
          const bpResult = await supabase
            .from('timeline_blueprints')
            .select('*')
            .eq('user_id', userId)
            .eq('is_published', true)
            .order('created_at', { ascending: false });
          if (!bpResult.error && !cancelled) {
            setBlueprints((bpResult.data as BlueprintRecord[]) ?? []);
          }
        } catch {}
      } catch (error: any) {
        if (!cancelled) setErrorText(String(error?.message || 'Failed to load profile'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (userId) void load();
    else {
      setLoading(false);
      setErrorText('Missing user id');
    }
    return () => {
      cancelled = true;
    };
  }, [userId, isOwner, refreshKey]);

  const orgRows = useMemo(
    () =>
      memberships.map((membership) => ({
        ...membership,
        org: organizations.get(membership.organization_id) || null,
      })),
    [memberships, organizations],
  );

  // Derive orgs from timeline steps when direct membership query returns empty (RLS blocks cross-user reads)
  const inferredOrgs = useMemo(() => {
    if (orgRows.length > 0 || !timelineQuery.data) return [];
    const orgIds = new Set<string>();
    const result: { orgId: string; interestId: string | null }[] = [];
    for (const step of timelineQuery.data) {
      if (step.organization_id && !orgIds.has(step.organization_id)) {
        orgIds.add(step.organization_id);
        result.push({ orgId: step.organization_id, interestId: step.interest_id || null });
      }
    }
    return result;
  }, [orgRows.length, timelineQuery.data]);

  // Fetch org names for inferred orgs
  const [inferredOrgDetails, setInferredOrgDetails] = useState<Map<string, OrganizationRow>>(new Map());
  useEffect(() => {
    if (inferredOrgs.length === 0) return;
    const ids = inferredOrgs.map((o) => o.orgId);
    supabase
      .from('organizations')
      .select('id,name,slug,interest_slug')
      .in('id', ids)
      .then(({ data }) => {
        if (!data) return;
        const map = new Map<string, OrganizationRow>();
        for (const row of data) {
          map.set(String((row as any).id), {
            id: String((row as any).id),
            name: String((row as any).name || ''),
            slug: (row as any).slug ? String((row as any).slug) : null,
            interest_slug: (row as any).interest_slug ? String((row as any).interest_slug) : null,
          });
        }
        setInferredOrgDetails(map);
      });
  }, [inferredOrgs]);

  // Combined org display: direct memberships or inferred from timelines
  const displayOrgs = useMemo(() => {
    if (orgRows.length > 0) {
      return orgRows.map((row) => ({
        name: row.org?.name || row.organization_id,
        role: row.role || 'Member',
        slug: row.org?.slug || null,
        interestSlug: row.org?.interest_slug || null,
      }));
    }
    return inferredOrgs.map((o) => {
      const detail = inferredOrgDetails.get(o.orgId);
      const interest = o.interestId ? allInterests.find((i) => i.id === o.interestId) : null;
      return {
        name: detail?.name || 'Organization',
        role: 'Member',
        slug: detail?.slug || null,
        interestSlug: detail?.interest_slug || interest?.slug || null,
      };
    });
  }, [orgRows, inferredOrgs, inferredOrgDetails, allInterests]);

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const timelineCount = timelineQuery.data?.length ?? 0;

  const tabs: { key: ProfileTab; label: string; icon: string; count?: number }[] = [
    { key: 'timelines', label: 'Timelines', icon: 'git-branch-outline', count: timelineCount },
    { key: 'activities', label: 'Activities', icon: 'trophy-outline', count: activities.length },
    { key: 'organizations', label: 'Orgs', icon: 'business-outline', count: displayOrgs.length },
  ];

  return (
    <SafeAreaView style={dbStyles.safeArea} edges={isOwner ? ['bottom', 'left', 'right'] : undefined}>
      {/* Navigation bar */}
      {isOwner ? (
        <TabScreenToolbar
          title="Profile"
          topInset={insets.top}
          onMeasuredHeight={setToolbarHeight}
        />
      ) : (
        <View style={dbStyles.navBar}>
          <Pressable onPress={() => router.back()} style={dbStyles.navBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>
      )}

      {loading ? (
        <View style={[dbStyles.centerState, isOwner && { paddingTop: toolbarHeight }]}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={dbStyles.stateText}>Loading profile…</Text>
        </View>
      ) : null}

      {!loading && errorText ? (
        <View style={[dbStyles.centerState, isOwner && { paddingTop: toolbarHeight }]}>
          <Ionicons name="alert-circle-outline" size={32} color="#B91C1C" />
          <Text style={dbStyles.errorText}>{errorText}</Text>
          <Pressable onPress={() => router.back()} style={dbStyles.errorBackBtn}>
            <Text style={dbStyles.errorBackBtnText}>Go Back</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !errorText ? (
        <ScrollView contentContainerStyle={[dbStyles.scrollContent, isOwner && { paddingTop: toolbarHeight }]} showsVerticalScrollIndicator={false}>
          {/* ── Profile Hero ── */}
          <View style={dbStyles.heroSection}>
            <View style={dbStyles.avatar}>
              <Text style={dbStyles.avatarText}>{initials}</Text>
            </View>
            <Text style={dbStyles.heroName}>{name}</Text>
            {email && <Text style={dbStyles.heroEmail}>{email}</Text>}

            {/* Stats row */}
            <View style={dbStyles.statsRow}>
              <View style={dbStyles.statItem}>
                <Text style={dbStyles.statValue}>{timelineCount}</Text>
                <Text style={dbStyles.statLabel}>Steps</Text>
              </View>
              <View style={dbStyles.statDivider} />
              <View style={dbStyles.statItem}>
                <Text style={dbStyles.statValue}>{activities.length}</Text>
                <Text style={dbStyles.statLabel}>Activities</Text>
              </View>
              <View style={dbStyles.statDivider} />
              <View style={dbStyles.statItem}>
                <Text style={dbStyles.statValue}>{displayOrgs.length}</Text>
                <Text style={dbStyles.statLabel}>Orgs</Text>
              </View>
            </View>

            {/* Follow button for visitors */}
            {isSignedIn && !isOwner && (
              <View style={dbStyles.followContainer}>
                <FollowButton
                  isFollowing={following}
                  isLoading={followLoading}
                  userName={name}
                  onFollow={handleFollow}
                  onUnfollow={handleUnfollow}
                  size="medium"
                  showDropdown={false}
                />
              </View>
            )}
          </View>

          {/* ── Tab Navigation ── */}
          <View style={dbStyles.tabBar}>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  style={[dbStyles.tab, isActive && dbStyles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Ionicons
                    name={tab.icon as any}
                    size={16}
                    color={isActive ? '#2563EB' : '#9CA3AF'}
                  />
                  <Text style={[dbStyles.tabLabel, isActive && dbStyles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                  {(tab.count ?? 0) > 0 && (
                    <View style={[dbStyles.tabBadge, isActive && dbStyles.tabBadgeActive]}>
                      <Text style={[dbStyles.tabBadgeText, isActive && dbStyles.tabBadgeTextActive]}>
                        {tab.count}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* ── Tab Content ── */}
          <View style={dbStyles.tabContent}>
            {/* Timelines Tab */}
            {activeTab === 'timelines' && (
              <>
                {/* Published Blueprints */}
                {blueprints.length > 0 && (
                  <View style={dbStyles.blueprintsSection}>
                    <Text style={dbStyles.sectionHeader}>Published Blueprints</Text>
                    {blueprints.map((bp) => (
                      <Pressable
                        key={bp.id}
                        style={dbStyles.blueprintCard}
                        onPress={() => router.push(`/blueprint/${bp.slug}` as any)}
                      >
                        <View style={dbStyles.blueprintIcon}>
                          <Ionicons name="layers" size={18} color="#2563EB" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={dbStyles.blueprintTitle}>{bp.title}</Text>
                          {bp.description && (
                            <Text style={dbStyles.blueprintDesc} numberOfLines={2}>{bp.description}</Text>
                          )}
                          <Text style={dbStyles.blueprintMeta}>
                            {bp.subscriber_count} subscriber{bp.subscriber_count !== 1 ? 's' : ''}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                      </Pressable>
                    ))}
                  </View>
                )}

                {(!timelineQuery.data || timelineQuery.data.length === 0) && (
                  <View style={dbStyles.emptyState}>
                    <Ionicons
                      name={isOwner ? 'git-branch-outline' : (!following ? 'people-outline' : 'git-branch-outline')}
                      size={32}
                      color="#D1D5DB"
                    />
                    <Text style={dbStyles.emptyTitle}>
                      {isOwner
                        ? 'No timelines yet'
                        : !following
                          ? 'Follow to see timelines'
                          : 'No visible timelines'}
                    </Text>
                    <Text style={dbStyles.emptyText}>
                      {isOwner
                        ? 'Start building your timeline by adding steps.'
                        : !following
                          ? `Follow ${name.split(' ')[0]} to see their timeline steps and progress.`
                          : 'This person hasn\'t shared any timeline steps yet.'}
                    </Text>
                  </View>
                )}
                {timelineQuery.data && timelineQuery.data.length > 0 && (() => {
                  const byInterest = new Map<string, TimelineStepRecord[]>();
                  for (const step of timelineQuery.data) {
                    const key = step.interest_id || '__none__';
                    if (!byInterest.has(key)) byInterest.set(key, []);
                    byInterest.get(key)!.push(step);
                  }
                  return Array.from(byInterest.entries()).map(([interestId, steps]) => {
                    const interest = interestId !== '__none__' ? allInterests.find((i) => i.id === interestId) : null;
                    const hasOrg = steps.some((s) => s.organization_id);
                    const orgRow = hasOrg ? orgRows.find((r) => r.org?.interest_slug === interest?.slug) : null;
                    const sectionName = orgRow?.org?.name || interest?.name || 'Personal';
                    const currentVisibility = (steps[0]?.visibility as TimelineStepVisibility) || 'followers';
                    const completedCount = steps.filter((s) => s.status === 'completed').length;
                    const progressPct = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;
                    return (
                      <View key={interestId} style={dbStyles.timelineCard}>
                        {/* Timeline header */}
                        <View style={dbStyles.timelineHeader}>
                          <View style={[dbStyles.timelineIcon, { backgroundColor: hasOrg ? '#EFF6FF' : '#F5F3FF' }]}>
                            <Ionicons
                              name={hasOrg ? 'business' : 'person'}
                              size={16}
                              color={hasOrg ? '#2563EB' : '#8B5CF6'}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={dbStyles.timelineTitle}>{sectionName}</Text>
                            <Text style={dbStyles.timelineSubtitle}>
                              {completedCount}/{steps.length} steps completed
                            </Text>
                          </View>
                          {isOwner && (
                            <Pressable
                              style={dbStyles.visibilityBtn}
                              onPress={() => {
                                const idx = VISIBILITY_CYCLE.indexOf(currentVisibility);
                                const next = VISIBILITY_CYCLE[(idx + 1) % VISIBILITY_CYCLE.length];
                                for (const step of steps) {
                                  updateStepMutation.mutate({ stepId: step.id, input: { visibility: next } });
                                }
                                timelineQuery.refetch();
                              }}
                            >
                              <Ionicons
                                name={VISIBILITY_ICONS[currentVisibility] as any}
                                size={13}
                                color="#6B7280"
                              />
                              <Text style={dbStyles.visibilityLabel}>
                                {VISIBILITY_LABELS[currentVisibility]}
                              </Text>
                            </Pressable>
                          )}
                        </View>

                        {/* Progress bar */}
                        <View style={dbStyles.progressTrack}>
                          <View
                            style={[
                              dbStyles.progressFill,
                              {
                                width: `${progressPct}%` as any,
                                backgroundColor: hasOrg ? '#2563EB' : '#8B5CF6',
                              },
                            ]}
                          />
                        </View>

                        {/* Timeline visualization */}
                        <PersonTimelineRow
                          person={{
                            name,
                            role: email || userId,
                            timeline: steps.map((step: TimelineStepRecord) => ({
                              label: step.title,
                              status: toSampleStatus(step.status),
                              detail: step.description ?? undefined,
                            })),
                            userId,
                          }}
                          accentColor={hasOrg ? '#2563EB' : '#8B5CF6'}
                          realStepIds={steps.map((step: TimelineStepRecord) => step.id)}
                          interestId={interestId !== '__none__' ? interestId : undefined}
                        />

                        {/* Adopt buttons for visitors */}
                        {isSignedIn && !isOwner && interestId !== '__none__' && (
                          <View style={dbStyles.adoptSection}>
                            <Text style={dbStyles.adoptHeading}>Add to your timeline</Text>
                            {steps.map((step) => {
                              const adopted = adoptedStepIds.has(step.id);
                              return (
                                <Pressable
                                  key={step.id}
                                  style={[dbStyles.adoptRow, adopted && dbStyles.adoptRowDone]}
                                  disabled={adopted || adoptMutation.isPending}
                                  onPress={() => handleAdopt(step.id, interestId)}
                                >
                                  <View style={[
                                    dbStyles.adoptStatusDot,
                                    { backgroundColor: step.status === 'completed' ? '#059669' : step.status === 'in_progress' ? '#F59E0B' : '#D1D5DB' },
                                  ]} />
                                  <Text style={dbStyles.adoptStepTitle} numberOfLines={1}>
                                    {step.title}
                                  </Text>
                                  <View style={[dbStyles.adoptBtn, adopted && dbStyles.adoptBtnDone]}>
                                    <Ionicons
                                      name={adopted ? 'checkmark-circle' : 'add-circle-outline'}
                                      size={16}
                                      color={adopted ? '#059669' : '#2563EB'}
                                    />
                                    <Text style={[dbStyles.adoptBtnText, adopted && dbStyles.adoptBtnTextDone]}>
                                      {adopted ? 'Added' : 'Adopt'}
                                    </Text>
                                  </View>
                                </Pressable>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  });
                })()}
              </>
            )}

            {/* Activities Tab */}
            {activeTab === 'activities' && (
              <>
                {activities.length === 0 && (
                  <View style={dbStyles.emptyState}>
                    <Ionicons name="trophy-outline" size={32} color="#D1D5DB" />
                    <Text style={dbStyles.emptyTitle}>No activities yet</Text>
                    <Text style={dbStyles.emptyText}>Activities will appear here once created.</Text>
                  </View>
                )}
                {activities.map((activity) => (
                  <View key={activity.id} style={dbStyles.activityCard}>
                    <View style={dbStyles.activityIconWrap}>
                      <Ionicons name="flag-outline" size={16} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={dbStyles.activityName}>{activity.name}</Text>
                      <View style={dbStyles.activityMeta}>
                        {activity.date && (
                          <View style={dbStyles.activityMetaItem}>
                            <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
                            <Text style={dbStyles.activityMetaText}>
                              {new Date(activity.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </Text>
                          </View>
                        )}
                        {activity.venue && (
                          <View style={dbStyles.activityMetaItem}>
                            <Ionicons name="location-outline" size={12} color="#9CA3AF" />
                            <Text style={dbStyles.activityMetaText}>{activity.venue}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Organizations Tab */}
            {activeTab === 'organizations' && (
              <>
                {displayOrgs.length === 0 && (
                  <View style={dbStyles.emptyState}>
                    <Ionicons name="business-outline" size={32} color="#D1D5DB" />
                    <Text style={dbStyles.emptyTitle}>No organizations</Text>
                    <Text style={dbStyles.emptyText}>No active organization memberships.</Text>
                  </View>
                )}
                {displayOrgs.map((org, idx) => (
                  <Pressable
                    key={`${org.name}-${idx}`}
                    style={dbStyles.orgCard}
                    onPress={() => {
                      if (org.slug && org.interestSlug) {
                        router.push(`/${org.interestSlug}/${org.slug}` as any);
                      }
                    }}
                  >
                    <View style={dbStyles.orgIconWrap}>
                      <Ionicons name="business" size={18} color="#6366F1" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={dbStyles.orgName}>{org.name}</Text>
                      <Text style={dbStyles.orgMeta}>
                        {org.interestSlug || 'General'} · {org.role}
                      </Text>
                    </View>
                    {org.slug && (
                      <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                    )}
                  </Pressable>
                ))}
              </>
            )}
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const dbStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },

  // Nav bar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },

  // Loading / error
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  stateText: { fontSize: 14, color: '#6B7280' },
  errorText: { fontSize: 14, color: '#B91C1C', textAlign: 'center', paddingHorizontal: 24 },
  errorBackBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1F2937',
  },
  errorBackBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  scrollContent: { paddingBottom: 32 },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 2,
  },
  heroEmail: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    marginBottom: 4,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  followContainer: {
    marginTop: 12,
  },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#2563EB',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabLabelActive: {
    color: '#2563EB',
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  tabBadgeActive: {
    backgroundColor: '#EFF6FF',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  tabBadgeTextActive: {
    color: '#2563EB',
  },

  // Tab content
  tabContent: {
    padding: 16,
    gap: 12,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    maxWidth: 260,
  },

  // Timeline cards
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 12,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timelineIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  timelineSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  visibilityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  visibilityLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600' },

  // Adopt section
  adoptSection: { gap: 0 },
  adoptHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  adoptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    gap: 8,
  },
  adoptRowDone: {
    backgroundColor: '#F0FDF4',
  },
  adoptStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  adoptStepTitle: { flex: 1, fontSize: 14, color: '#374151' },
  adoptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  adoptBtnDone: {},
  adoptBtnText: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  adoptBtnTextDone: { color: '#059669' },

  // Activity cards
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  activityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 3,
  },
  activityMeta: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  activityMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityMetaText: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  // Org cards
  orgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  orgIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  orgMeta: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },

  // Blueprint cards
  blueprintsSection: { marginBottom: 16 },
  sectionHeader: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingHorizontal: 16 },
  blueprintCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 12, marginHorizontal: 16, marginBottom: 8, gap: 10 },
  blueprintIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  blueprintTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  blueprintDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  blueprintMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
});

// ── Sample data public profile ──────────────────────────────────────

function SamplePersonProfile({ result }: { result: PersonSearchResult }) {
  const { person, contexts } = result;
  const orgContexts = contexts.filter((c) => !c.isPersonal);
  const personalContexts = contexts.filter((c) => c.isPersonal);
  const primaryContext = orgContexts[0] || contexts[0];
  const accentColor = primaryContext?.interestColor ?? '#4338CA';

  const initials = person.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const content = (
    <>
      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: accentColor }]}>
        <View style={styles.heroContent}>
          {/* Breadcrumbs */}
          <View style={styles.breadcrumbs}>
            <TouchableOpacity onPress={() => router.push('/' as any)}>
              <Text style={styles.breadcrumbLink}>BetterAt</Text>
            </TouchableOpacity>
            {primaryContext && !primaryContext.isPersonal && (
              <>
                <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.5)" />
                <TouchableOpacity onPress={() => router.push(`/${primaryContext.interestSlug}` as any)}>
                  <Text style={styles.breadcrumbLink}>{primaryContext.interestName}</Text>
                </TouchableOpacity>
                {primaryContext.orgSlug && (
                  <>
                    <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.5)" />
                    <TouchableOpacity onPress={() => router.push(`/${primaryContext.interestSlug}/${primaryContext.orgSlug}` as any)}>
                      <Text style={styles.breadcrumbLink}>{primaryContext.orgName}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
            <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.5)" />
            <Text style={styles.breadcrumbCurrent}>{person.name}</Text>
          </View>

          {/* Avatar + name */}
          <View style={styles.heroRow}>
            <View style={[styles.heroAvatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.heroInitials}>{initials}</Text>
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroName}>{person.name}</Text>
              <Text style={styles.heroRole}>{person.role}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Interests & Progress */}
      <View style={styles.body}>
        <Text style={styles.sectionTitle}>Interests & Progress</Text>
        <Text style={styles.sectionSubtitle}>
          {person.name.split(' ')[0]}'s learning journey across {contexts.length} interest{contexts.length !== 1 ? 's' : ''}
        </Text>

        <View style={styles.interestCards}>
          {/* Org-linked interests — use the person's main timeline */}
          {orgContexts.map((ctx) => (
            <InterestTimelineCard
              key={`${ctx.interestSlug}-${ctx.orgSlug}`}
              interestName={ctx.interestName}
              interestSlug={ctx.interestSlug}
              accentColor={ctx.interestColor}
              orgName={ctx.orgName}
              orgSlug={ctx.orgSlug}
              role={ctx.role || person.role}
              person={person}
            />
          ))}

          {/* Personal interests — each has its own timeline */}
          {personalContexts.map((ctx) => (
            <InterestTimelineCard
              key={`personal-${ctx.interestSlug}`}
              interestName={ctx.interestName}
              interestSlug={ctx.interestSlug}
              accentColor={ctx.interestColor}
              role={ctx.role}
              person={{
                name: person.name,
                role: ctx.role || 'Personal',
                timeline: ctx.timeline || [],
                userId: person.userId,
              }}
              isPersonal
            />
          ))}
        </View>
      </View>

      <Footer />
    </>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <ScrollFix />
        <SimpleLandingNav currentInterestSlug={primaryContext?.interestSlug} />
        {content}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <SimpleLandingNav currentInterestSlug={primaryContext?.interestSlug} />
      {content}
    </ScrollView>
  );
}

// ── Route handler ───────────────────────────────────────────────────

export default function PersonProfilePage() {
  const params = useLocalSearchParams<{ userId?: string }>();
  const paramValue = typeof params.userId === 'string' ? params.userId.trim() : '';

  // If it looks like a UUID, show the DB profile
  if (UUID_RE.test(paramValue)) {
    return <DbUserProfile userId={paramValue} />;
  }

  // Otherwise treat it as a sample data person slug
  const result = findPersonBySlug(paramValue);

  if (!result) {
    return (
      <View style={styles.container}>
        {Platform.OS === 'web' && <ScrollFix />}
        <SimpleLandingNav />
        <View style={styles.notFound}>
          <Ionicons name="person-outline" size={48} color="#D1D5DB" />
          <Text style={styles.notFoundTitle}>Person Not Found</Text>
          <Text style={styles.notFoundText}>
            We couldn't find a profile for this person.
          </Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={16} color="#FFFFFF" />
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return <SamplePersonProfile result={result} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Hero
  hero: {
    paddingTop: 100,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  heroContent: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  breadcrumbLink: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    textDecorationLine: 'underline',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  breadcrumbCurrent: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroInitials: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroRole: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 22,
  },

  // Body sections
  body: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
    padding: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 20,
  },

  // Interest timeline cards
  interestCards: {
    gap: 20,
    marginTop: 12,
  },

  // Not found
  notFound: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
    paddingHorizontal: 24,
    gap: 12,
  },
  notFoundTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
  },
  notFoundText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#1F2937',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
