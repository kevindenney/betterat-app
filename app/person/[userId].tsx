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
import { LinearGradient } from 'expo-linear-gradient';
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

const VISIBILITY_CYCLE: TimelineStepVisibility[] = ['private', 'crew', 'fleet', 'public'];
const VISIBILITY_LABELS: Record<TimelineStepVisibility, string> = {
  private: 'Private',
  crew: 'Crew',
  fleet: 'Fleet',
  public: 'Public',
};
const VISIBILITY_ICONS: Record<TimelineStepVisibility, string> = {
  private: 'lock-closed-outline',
  crew: 'people-outline',
  fleet: 'business-outline',
  public: 'globe-outline',
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

const PALETTE = {
  bg: '#ffffff',
  band: '#f1f6fd',
  card: '#ffffff',
  line: '#e2e5ec',
  lineSoft: '#edeff4',
  txt: '#1b1d23',
  txt2: '#5c616b',
  txt3: '#8b909a',
  blue: '#2d7ff9',
  blueD: '#1c6df0',
  green: '#34c759',
  purple: '#bf5af2',
  do: '#a8554a',
} as const;

const PHASE_BAND = [
  { key: 'plan', label: 'Plan', glyph: '1', color: PALETTE.blue },
  { key: 'do', label: 'Do', glyph: '2', color: PALETTE.do },
  { key: 'review', label: 'Review', glyph: '3', color: PALETTE.green },
  { key: 'discuss', label: 'Discuss', glyph: '💬', color: PALETTE.purple },
] as const;

/** PLAN · DO · REVIEW · DISCUSS phase band (kept per design — see memory). */
function PhaseBand() {
  return (
    <View style={dbStyles.phaseBand}>
      {PHASE_BAND.map((p, i) => (
        <React.Fragment key={p.key}>
          {i > 0 && <View style={dbStyles.phaseSep} />}
          <View style={dbStyles.phaseItem}>
            <View style={[dbStyles.phaseDot, { backgroundColor: p.color }]}>
              <Text style={dbStyles.phaseDotText}>{p.glyph}</Text>
            </View>
            <Text style={dbStyles.phaseLabel}>{p.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

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
  // Public-face section flags (owner always sees their own; peers gated). Both
  // default true so the sections never flash-hide before the profile loads.
  const [showOrgs, setShowOrgs] = useState(true);
  const [showPublishedBlueprints, setShowPublishedBlueprints] = useState(true);
  const [libExpanded, setLibExpanded] = useState(false);
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
          .select('id,full_name,avatar_url,profile_public,show_orgs,show_published_blueprints')
          .eq('id', userId)
          .maybeSingle();

        if (!profileResult.data && !isOwner) {
          throw new Error('This profile is private');
        }

        if (!cancelled) {
          // Owner previews their full face; peers honor the section flags.
          setShowOrgs(isOwner || ((profileResult.data as any)?.show_orgs ?? false));
          setShowPublishedBlueprints(
            isOwner || ((profileResult.data as any)?.show_published_blueprints ?? true),
          );
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

  // Combined org display: direct memberships or inferred from timelines.
  // Empty when the person hides orgs from their public face (owner exempt).
  const displayOrgs = useMemo(() => {
    if (!showOrgs) return [];
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
  }, [showOrgs, orgRows, inferredOrgs, inferredOrgDetails, allInterests]);

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const timelineCount = timelineQuery.data?.length ?? 0;

  const firstName = name.split(' ')[0] || name;

  // Blueprints ranked by reach; the top one is featured, the rest split into
  // active coaching blueprints (have subscribers) vs zero-subscriber
  // curriculum-template library.
  // Empty when the person hides published blueprints from their public face
  // (owner exempt) — featured/coaching/library/subscriber rollups all derive
  // from this, so they disappear together.
  const sortedBlueprints = useMemo(
    () =>
      showPublishedBlueprints
        ? [...blueprints].sort((a, b) => (b.subscriber_count ?? 0) - (a.subscriber_count ?? 0))
        : [],
    [showPublishedBlueprints, blueprints],
  );
  const featuredBlueprint = sortedBlueprints[0] ?? null;
  const coachingBlueprints = useMemo(
    () => sortedBlueprints.slice(1).filter((b) => (b.subscriber_count ?? 0) > 0),
    [sortedBlueprints],
  );
  const libraryBlueprints = useMemo(
    () => sortedBlueprints.slice(1).filter((b) => (b.subscriber_count ?? 0) === 0),
    [sortedBlueprints],
  );
  const subscriberTotal = useMemo(
    () => sortedBlueprints.reduce((sum, b) => sum + (b.subscriber_count ?? 0), 0),
    [sortedBlueprints],
  );

  // "Working on now": active steps first, then what's queued up next.
  const nowSteps = useMemo(() => {
    const data = timelineQuery.data ?? [];
    const active = data.filter((s) => s.status === 'in_progress');
    const upcoming = data.filter((s) => s.status !== 'in_progress' && s.status !== 'completed');
    return [...active, ...upcoming].slice(0, 6);
  }, [timelineQuery.data]);

  // Distinct interests this person has steps in — identity chips for the hero.
  const interestChips = useMemo(() => {
    const data = timelineQuery.data ?? [];
    const seen = new Set<string>();
    const chips: { id: string; name: string }[] = [];
    for (const s of data) {
      if (s.interest_id && !seen.has(s.interest_id)) {
        seen.add(s.interest_id);
        const it = allInterests.find((i) => i.id === s.interest_id);
        if (it) chips.push({ id: it.id, name: it.name });
      }
    }
    return chips.slice(0, 4);
  }, [timelineQuery.data, allInterests]);

  const interestNameById = useCallback(
    (interestId: string | null | undefined) =>
      interestId ? allInterests.find((i) => i.id === interestId)?.name ?? null : null,
    [allInterests],
  );

  const primaryRole = displayOrgs.length > 0
    ? `${capitalize(displayOrgs[0].role)} · ${displayOrgs[0].name}`
    : null;

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
          <ActivityIndicator size="small" color="#007AFF" />
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
          {/* ── Identity Hero ── */}
          <View style={dbStyles.heroSection}>
            <View style={dbStyles.heroRow}>
              <LinearGradient
                colors={[PALETTE.blue, PALETTE.blueD]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={dbStyles.avatar}
              >
                <Text style={dbStyles.avatarText}>{initials}</Text>
              </LinearGradient>
              <View style={dbStyles.heroBody}>
                <Text style={dbStyles.heroName}>{name}</Text>
                {primaryRole && <Text style={dbStyles.heroRole}>{primaryRole}</Text>}
                {interestChips.length > 0 && (
                  <View style={dbStyles.chips}>
                    {interestChips.map((c) => (
                      <View key={c.id} style={dbStyles.chip}>
                        <Text style={dbStyles.chipText}>{c.name}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={dbStyles.heroActions}>
                  {isOwner ? (
                    <Pressable
                      style={dbStyles.editBtn}
                      onPress={() => router.push('/settings/edit-profile' as any)}
                    >
                      <Ionicons name="create-outline" size={15} color={PALETTE.txt} />
                      <Text style={dbStyles.editBtnText}>Edit profile</Text>
                    </Pressable>
                  ) : isSignedIn ? (
                    <FollowButton
                      isFollowing={following}
                      isLoading={followLoading}
                      userName={name}
                      onFollow={handleFollow}
                      onUnfollow={handleUnfollow}
                      size="medium"
                      showDropdown={false}
                    />
                  ) : null}
                </View>
              </View>
            </View>

            {/* Stats */}
            <View style={dbStyles.statsRow}>
              <View style={dbStyles.statItem}>
                <Text style={dbStyles.statValue}>{subscriberTotal}</Text>
                <Text style={dbStyles.statLabel}>Subscribers</Text>
              </View>
              <View style={dbStyles.statItem}>
                <Text style={dbStyles.statValue}>{sortedBlueprints.length}</Text>
                <Text style={dbStyles.statLabel}>Blueprints</Text>
              </View>
              <View style={dbStyles.statItem}>
                <Text style={dbStyles.statValue}>{timelineCount}</Text>
                <Text style={dbStyles.statLabel}>Steps</Text>
              </View>
              <View style={dbStyles.statItem}>
                <Text style={dbStyles.statValue}>{displayOrgs.length}</Text>
                <Text style={dbStyles.statLabel}>Orgs</Text>
              </View>
            </View>
          </View>

          <View style={dbStyles.sections}>
            {/* ── Working on now ── */}
            {nowSteps.length > 0 && (
              <View style={dbStyles.section}>
                <Text style={dbStyles.secHeadText}>Working on now</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={dbStyles.nowStrip}
                >
                  {nowSteps.map((step) => {
                    const isDo = step.status === 'in_progress';
                    const chipInterest = interestNameById(step.interest_id);
                    return (
                      <View key={step.id} style={dbStyles.nowCard}>
                        <View style={[dbStyles.nowPhase, isDo ? dbStyles.phDo : dbStyles.phPlan]}>
                          <Text style={[dbStyles.nowPhaseText, isDo ? dbStyles.phDoText : dbStyles.phPlanText]}>
                            {isDo ? 'Do' : 'Plan'}
                          </Text>
                        </View>
                        <Text style={dbStyles.nowTitle} numberOfLines={2}>{step.title}</Text>
                        {chipInterest && (
                          <View style={dbStyles.nowInterest}>
                            <View style={dbStyles.nowInterestDot} />
                            <Text style={dbStyles.nowInterestText} numberOfLines={1}>{chipInterest}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* ── Featured blueprint ── */}
            {featuredBlueprint && (
              <View style={dbStyles.section}>
                <Text style={dbStyles.secHeadText}>Featured blueprint</Text>
                <Pressable
                  style={dbStyles.feature}
                  onPress={() => router.push(`/blueprint/${featuredBlueprint.slug}` as any)}
                >
                  <View style={dbStyles.featureTop}>
                    <View style={{ flex: 1 }}>
                      {featuredBlueprint.subscriber_count > 0 && (
                        <View style={dbStyles.featureEyebrow}>
                          <Ionicons name="star" size={12} color="#f5a623" />
                          <Text style={dbStyles.featureEyebrowText}>Most subscribed</Text>
                        </View>
                      )}
                      <Text style={dbStyles.featureTitle}>{featuredBlueprint.title}</Text>
                      {(featuredBlueprint.tagline || featuredBlueprint.description) && (
                        <Text style={dbStyles.featureDesc} numberOfLines={2}>
                          {featuredBlueprint.tagline || featuredBlueprint.description}
                        </Text>
                      )}
                    </View>
                    <View style={dbStyles.featureBadge}>
                      <Text style={dbStyles.featureBadgeNum}>{featuredBlueprint.subscriber_count}</Text>
                      <Text style={dbStyles.featureBadgeLabel}>
                        {featuredBlueprint.subscriber_count === 1 ? 'Sub' : 'Subs'}
                      </Text>
                    </View>
                  </View>
                  <PhaseBand />
                  <View style={dbStyles.featureFoot}>
                    <Text style={dbStyles.featureFootText} numberOfLines={1}>
                      By {firstName}
                      {featuredBlueprint.duration_weeks ? ` · ${featuredBlueprint.duration_weeks} wks` : ''}
                    </Text>
                    <View style={dbStyles.featureCta}>
                      <Text style={dbStyles.featureCtaText}>View</Text>
                      <Ionicons name="chevron-forward" size={14} color="#fff" />
                    </View>
                  </View>
                </Pressable>
              </View>
            )}

            {/* ── Coaching blueprints ── */}
            {coachingBlueprints.length > 0 && (
              <View style={dbStyles.section}>
                <Text style={dbStyles.secHeadText}>
                  {isOwner ? 'Your coaching blueprints' : `${firstName}'s coaching blueprints`}
                </Text>
                <View style={dbStyles.bpGrid}>
                  {coachingBlueprints.map((bp) => (
                    <Pressable
                      key={bp.id}
                      style={dbStyles.bpCard}
                      onPress={() => router.push(`/blueprint/${bp.slug}` as any)}
                    >
                      <View style={dbStyles.bpIcon}>
                        <Ionicons name="layers" size={16} color={PALETTE.blue} />
                      </View>
                      <Text style={dbStyles.bpTitle} numberOfLines={1}>{bp.title}</Text>
                      {bp.description && (
                        <Text style={dbStyles.bpDesc} numberOfLines={2}>{bp.description}</Text>
                      )}
                      <Text style={dbStyles.bpSubCt}>
                        {bp.subscriber_count} subscriber{bp.subscriber_count !== 1 ? 's' : ''}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* ── Timelines ── */}
            <View style={dbStyles.section}>
              <Text style={dbStyles.secHeadText}>Timelines</Text>
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
                        ? `Follow ${firstName} to see their timeline steps and progress.`
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
                    const currentVisibility = (steps[0]?.visibility as TimelineStepVisibility) || 'private';
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
            </View>

            {/* ── Curriculum library ── */}
            {libraryBlueprints.length > 0 && (
              <View style={dbStyles.lib}>
                <View style={dbStyles.libHead}>
                  <Text style={dbStyles.libTitle}>Curriculum library</Text>
                  <Text style={dbStyles.libCt}>
                    {libraryBlueprints.length} pathway template{libraryBlueprints.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Text style={dbStyles.libSub}>
                  Standards-based training pathways — adopt one wholesale or branch your own.
                </Text>
                <View>
                  {(libExpanded ? libraryBlueprints : libraryBlueprints.slice(0, 5)).map((bp) => (
                    <Pressable
                      key={bp.id}
                      style={dbStyles.libRow}
                      onPress={() => router.push(`/blueprint/${bp.slug}` as any)}
                    >
                      <Text style={dbStyles.libRowName} numberOfLines={1}>{bp.title}</Text>
                      <Ionicons name="chevron-forward" size={14} color={PALETTE.txt3} />
                    </Pressable>
                  ))}
                </View>
                {libraryBlueprints.length > 5 && (
                  <Pressable style={dbStyles.libToggle} onPress={() => setLibExpanded((v) => !v)}>
                    <Text style={dbStyles.libToggleText}>
                      {libExpanded ? 'Show less' : `Show all ${libraryBlueprints.length} templates`}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* ── Activities ── */}
            {activities.length > 0 && (
              <View style={dbStyles.section}>
                <Text style={dbStyles.secHeadText}>Activities</Text>
                {activities.map((activity) => (
                  <View key={activity.id} style={dbStyles.activityCard}>
                    <View style={dbStyles.activityIconWrap}>
                      <Ionicons name="flag-outline" size={16} color={PALETTE.blue} />
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
              </View>
            )}

            {/* ── Organizations ── */}
            {displayOrgs.length > 0 && (
              <View style={dbStyles.section}>
                <Text style={dbStyles.secHeadText}>Organizations</Text>
                <View style={dbStyles.orgChips}>
                  {displayOrgs.map((org, idx) => (
                    <Pressable
                      key={`${org.name}-${idx}`}
                      style={dbStyles.orgChip}
                      onPress={() => {
                        if (org.slug && org.interestSlug) {
                          router.push(`/${org.interestSlug}/${org.slug}` as any);
                        }
                      }}
                    >
                      <View style={dbStyles.orgChipIcon}>
                        <Text style={dbStyles.orgChipIconText}>{org.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flexShrink: 1 }}>
                        <Text style={dbStyles.orgChipName} numberOfLines={1}>{org.name}</Text>
                        <Text style={dbStyles.orgChipRole}>{capitalize(org.role)}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const MAXW = 720;

const dbStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: PALETTE.bg },

  // Nav bar
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: PALETTE.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: PALETTE.line,
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
  stateText: { fontSize: 14, color: PALETTE.txt2 },
  errorText: { fontSize: 14, color: '#B91C1C', textAlign: 'center', paddingHorizontal: 24 },
  errorBackBtn: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: PALETTE.txt,
  },
  errorBackBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  scrollContent: { paddingBottom: 48 },

  // Hero
  heroSection: {
    width: '100%',
    maxWidth: MAXW,
    alignSelf: 'center',
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 20,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroBody: { flex: 1, minWidth: 0 },
  heroName: {
    fontSize: 26,
    fontWeight: '700',
    color: PALETTE.txt,
    letterSpacing: -0.5,
  },
  heroRole: {
    fontSize: 14.5,
    fontWeight: '600',
    color: PALETTE.blue,
    marginTop: 3,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: PALETTE.line,
    backgroundColor: PALETTE.bg,
    borderRadius: 980,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: { fontSize: 12.5, fontWeight: '500', color: PALETTE.txt2 },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PALETTE.bg,
    borderWidth: 1,
    borderColor: PALETTE.line,
    borderRadius: 980,
    paddingHorizontal: 18,
    paddingVertical: 9,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  editBtnText: { fontSize: 14, fontWeight: '600', color: PALETTE.txt },
  statsRow: {
    flexDirection: 'row',
    gap: 28,
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: PALETTE.lineSoft,
  },
  statItem: { alignItems: 'flex-start' },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: PALETTE.txt,
    letterSpacing: -0.4,
  },
  statLabel: {
    fontSize: 12.5,
    color: PALETTE.txt3,
    fontWeight: '500',
    marginTop: 1,
  },

  // Section scaffolding
  sections: {
    width: '100%',
    maxWidth: MAXW,
    alignSelf: 'center',
    paddingHorizontal: 20,
    gap: 34,
    marginTop: 12,
  },
  section: { gap: 14 },
  secHeadText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: PALETTE.txt3,
  },

  // Working on now
  nowStrip: { gap: 12, paddingBottom: 4 },
  nowCard: {
    width: 220,
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: PALETTE.line,
    borderRadius: 16,
    padding: 15,
    ...Platform.select({ web: { boxShadow: '0 8px 30px rgba(28,40,64,.06)' } }),
  },
  nowPhase: {
    alignSelf: 'flex-start',
    borderRadius: 980,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  phDo: { backgroundColor: 'rgba(168,85,74,.13)' },
  phPlan: { backgroundColor: 'rgba(45,127,249,.12)' },
  nowPhaseText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  phDoText: { color: PALETTE.do },
  phPlanText: { color: PALETTE.blue },
  nowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: PALETTE.txt,
    letterSpacing: -0.2,
    marginTop: 11,
    lineHeight: 19,
  },
  nowInterest: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  nowInterestDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: PALETTE.blue },
  nowInterestText: { fontSize: 11.5, fontWeight: '600', color: PALETTE.txt2, flexShrink: 1 },

  // Featured blueprint
  feature: {
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: PALETTE.line,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({ web: { boxShadow: '0 22px 60px rgba(28,40,64,.11)', cursor: 'pointer' } }),
  },
  featureTop: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
    padding: 22,
    paddingBottom: 18,
  },
  featureEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  featureEyebrowText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: PALETTE.blue,
  },
  featureTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: PALETTE.txt,
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  featureDesc: {
    fontSize: 14.5,
    color: PALETTE.txt2,
    marginTop: 9,
    lineHeight: 20,
  },
  featureBadge: {
    alignItems: 'center',
    backgroundColor: PALETTE.band,
    borderWidth: 1,
    borderColor: PALETTE.lineSoft,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  featureBadgeNum: { fontSize: 22, fontWeight: '700', color: PALETTE.blue, letterSpacing: -0.4 },
  featureBadgeLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: PALETTE.txt3,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  phaseBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: PALETTE.lineSoft,
  },
  phaseItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phaseSep: { flex: 1, height: 1, backgroundColor: PALETTE.lineSoft, minWidth: 10 },
  phaseDot: { width: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  phaseDotText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
  phaseLabel: { fontSize: 12.5, fontWeight: '600', color: PALETTE.txt },
  featureFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
    backgroundColor: PALETTE.band,
  },
  featureFootText: { flex: 1, fontSize: 13, color: PALETTE.txt2 },
  featureCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: PALETTE.blue,
    borderRadius: 980,
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 8,
  },
  featureCtaText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  // Coaching blueprint grid
  bpGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  bpCard: {
    flexGrow: 1,
    flexBasis: 200,
    minWidth: 0,
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: PALETTE.line,
    borderRadius: 16,
    padding: 18,
    ...Platform.select({ web: { boxShadow: '0 8px 30px rgba(28,40,64,.06)', cursor: 'pointer' } }),
  },
  bpIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: PALETTE.band,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  bpTitle: { fontSize: 16, fontWeight: '600', color: PALETTE.txt, letterSpacing: -0.3 },
  bpDesc: { fontSize: 13.5, color: PALETTE.txt2, marginTop: 6, lineHeight: 19 },
  bpSubCt: { fontSize: 12.5, fontWeight: '600', color: PALETTE.blue, marginTop: 13 },

  // Curriculum library
  lib: {
    backgroundColor: PALETTE.band,
    borderWidth: 1,
    borderColor: PALETTE.lineSoft,
    borderRadius: 20,
    padding: 22,
  },
  libHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 4,
  },
  libTitle: { fontSize: 16, fontWeight: '700', color: PALETTE.txt, letterSpacing: -0.3 },
  libCt: { fontSize: 13, fontWeight: '600', color: PALETTE.txt3 },
  libSub: { fontSize: 13.5, color: PALETTE.txt2, marginBottom: 12, lineHeight: 19 },
  libRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: PALETTE.line,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  libRowName: { flex: 1, fontSize: 14.5, fontWeight: '500', color: PALETTE.txt },
  libToggle: {
    alignSelf: 'center',
    marginTop: 14,
    backgroundColor: PALETTE.bg,
    borderWidth: 1,
    borderColor: PALETTE.line,
    borderRadius: 980,
    paddingHorizontal: 18,
    paddingVertical: 8,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  libToggleText: { fontSize: 13.5, fontWeight: '600', color: PALETTE.txt2 },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: PALETTE.txt2 },
  emptyText: { fontSize: 13, color: PALETTE.txt3, textAlign: 'center', maxWidth: 280 },

  // Timeline cards
  timelineCard: {
    backgroundColor: PALETTE.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: PALETTE.line,
    padding: 16,
    gap: 12,
    ...Platform.select({ web: { boxShadow: '0 8px 30px rgba(28,40,64,.06)' } }),
  },
  timelineHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timelineIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineTitle: { fontSize: 15, fontWeight: '700', color: PALETTE.txt },
  timelineSubtitle: { fontSize: 12, color: PALETTE.txt3, marginTop: 1 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: PALETTE.lineSoft, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  visibilityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: PALETTE.band,
  },
  visibilityLabel: { fontSize: 11, color: PALETTE.txt2, fontWeight: '600' },

  // Adopt section
  adoptSection: { gap: 0 },
  adoptHeading: {
    fontSize: 11,
    fontWeight: '700',
    color: PALETTE.txt3,
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
  adoptRowDone: { backgroundColor: '#F0FDF4' },
  adoptStatusDot: { width: 8, height: 8, borderRadius: 4 },
  adoptStepTitle: { flex: 1, fontSize: 14, color: PALETTE.txt2 },
  adoptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  adoptBtnDone: {},
  adoptBtnText: { fontSize: 13, fontWeight: '600', color: PALETTE.blue },
  adoptBtnTextDone: { color: '#059669' },

  // Activity cards
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: PALETTE.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PALETTE.line,
    padding: 14,
  },
  activityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: PALETTE.band,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityName: { fontSize: 15, fontWeight: '600', color: PALETTE.txt, marginBottom: 3 },
  activityMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  activityMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activityMetaText: { fontSize: 12, color: PALETTE.txt3 },

  // Org chips
  orgChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 },
  orgChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: PALETTE.line,
    borderRadius: 14,
    paddingVertical: 11,
    paddingLeft: 12,
    paddingRight: 16,
    ...Platform.select({ web: { boxShadow: '0 8px 30px rgba(28,40,64,.06)', cursor: 'pointer' } }),
  },
  orgChipIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: PALETTE.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgChipIconText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  orgChipName: { fontSize: 14.5, fontWeight: '600', color: PALETTE.txt },
  orgChipRole: { fontSize: 12, color: PALETTE.txt3, fontWeight: '500', marginTop: 1 },
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
