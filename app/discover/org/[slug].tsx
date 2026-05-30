/**
 * Discover · Org detail — iOS register
 *
 * The institutional detail surface. Implements the canonical defined in
 * `docs/redesign/ios-register/discover-detail-trio-canonical.html` Surface 1.
 *
 * Hero says "what is this and is it mine." Body answers "what's happening
 * here this week?" first, "who else is here?" second. External link is
 * offered, demoted. Same chrome as Person + Topic details.
 *
 * Data sources:
 *   - organizations (hero, mark)
 *   - global_clubs (location, founded year, member-count estimate, website)
 *   - organization_memberships + profiles (members-you-may-know xrows, count)
 *   - communities filtered by linked_entity (club-forums xrows)
 *   - canonical position: sections render only when content exists. Absences
 *     are intentional — no "no topics yet" placeholders.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { IOS_REGISTER } from '@/lib/design-tokens-ios';

import { supabase } from '@/services/supabase';
import {
  organizationDiscoveryService,
  type OrganizationJoinMode,
} from '@/services/OrganizationDiscoveryService';
import { initialsForName } from '@/components/discover/canonical';
import {
  IOSDetailNavBar,
  IOSDetailHero,
  IOSDetailSection,
  RelationshipButton,
  RelationshipMinePill,
  SignalRow,
  DRow,
  XRow,
  ExternalLinkRow,
  IOS_DETAIL_GROUND_BG,
  IOSOnlyNotice,
  pickSquareMarkColor,
  pickAvatarMarkColor,
  type SignalCellData,
} from '@/components/discover/detail';
import { ProposeAdoptionSheet } from '@/components/discover/ProposeAdoptionSheet';
import { EditOrgSheet } from '@/components/discover/EditOrgSheet';
import { InvitePeopleSheet } from '@/components/discover/InvitePeopleSheet';
import { useMyVerifiedAdminOrgs } from '@/hooks/useMyVerifiedAdminOrgs';
import { useArchiveOrg } from '@/hooks/useOrgManagement';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
import { useAuth } from '@/providers/AuthProvider';

type IconName = keyof typeof Ionicons.glyphMap;

type UpNextEvent = {
  title: string;
  sub?: string;
  meta?: string;
  meta_when?: string;
};

type UpNextData = {
  races_this_week?: number;
  entries_label?: string;
  entries_count?: number;
  next_start_day?: string;
  next_start_time?: string;
  events?: UpNextEvent[];
};

type OrgRow = {
  id: string;
  name: string;
  slug: string | null;
  join_mode: string | null;
  interest_slug: string | null;
  global_club_id: string | null;
  metadata: { up_next?: UpNextData } | null;
  creation_source: string | null;
  parent_org_id: string | null;
  official: boolean | null;
  global_clubs: {
    city: string | null;
    country: string | null;
    established_year: number | null;
    member_count_estimate: number | null;
    website: string | null;
  } | null;
};

type MemberXRow = {
  userId: string;
  name: string;
  initials: string;
  sub: string;
  tail?: string;
};

// Below this many members, a public count just advertises "barely anyone here"
// — unflattering for a young org and adds no discovery value. We still show the
// count once the org has real scale (or a canonical estimate clears the bar).
const MIN_PUBLIC_MEMBER_COUNT = 5;

type ForumXRow = {
  id: string;
  slug: string;
  name: string;
  sub: string;
  glyph: IconName;
};

function communityGlyph(communityType: string | null | undefined): IconName {
  switch (communityType) {
    case 'race':
      return 'compass-outline';
    case 'tuning':
      return 'construct-outline';
    case 'rules':
      return 'document-text-outline';
    case 'tactics':
      return 'navigate-outline';
    case 'venue':
      return 'location-outline';
    case 'boat_class':
      return 'boat-outline';
    case 'boat_builder':
    case 'sailmaker':
    case 'gear':
      return 'construct-outline';
    case 'event':
      return 'calendar-outline';
    default:
      return 'chatbubbles-outline';
  }
}

export default function OrgDetailScreen() {
  if (Platform.OS === 'web') return <IOSOnlyNotice surface="Org" />;
  return <OrgDetailScreenInner />;
}

function OrgDetailScreenInner() {
  const params = useLocalSearchParams<{ slug?: string; from?: string }>();
  const slug = typeof params.slug === 'string' ? params.slug.trim() : '';
  const backLabel = params.from === 'people' ? 'People' : params.from === 'forums' ? 'Forums' : 'Orgs';

  const { user } = useAuth();
  const [org, setOrg] = useState<OrgRow | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [members, setMembers] = useState<MemberXRow[]>([]);
  const [forums, setForums] = useState<ForumXRow[]>([]);
  const [docked, setDocked] = useState(false);
  const [joinState, setJoinState] = useState<'idle' | 'busy' | 'pending'>('idle');
  // Defaults to true (fail-open): only flips false once we confirm there's no
  // active approver, so a transient RPC failure never hides a real Join CTA.
  const [hasApprover, setHasApprover] = useState(true);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const archiveOrg = useArchiveOrg();
  const { data: verifiedAdminOrgs } = useMyVerifiedAdminOrgs();
  const canProposeAdoption =
    !!org &&
    org.creation_source === 'user' &&
    !org.parent_org_id &&
    (verifiedAdminOrgs?.length ?? 0) > 0;
  const isOwner = userRole === 'owner' || userRole === 'admin';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) return;
      const { data } = await supabase
        .from('organizations')
        .select(
          'id, name, slug, join_mode, interest_slug, global_club_id, metadata, creation_source, parent_org_id, official, global_clubs(city, country, established_year, member_count_estimate, website)'
        )
        .eq('slug', slug)
        .maybeSingle();
      if (!cancelled && data) {
        // supabase-js types nested selects as an array; flatten to a single record
        const raw = data as unknown as OrgRow & {
          global_clubs?: OrgRow['global_clubs'] | OrgRow['global_clubs'][];
        };
        const gc = Array.isArray(raw.global_clubs)
          ? raw.global_clubs[0] ?? null
          : raw.global_clubs ?? null;
        setOrg({ ...raw, global_clubs: gc });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Own membership state + member count (independent of who you may know)
  useEffect(() => {
    if (!org?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { count, error } = await supabase
          .from('organization_memberships')
          .select('user_id', { count: 'exact', head: true })
          .eq('organization_id', org.id)
          .eq('status', 'active');
        if (!cancelled && !error) setMemberCount(count ?? null);
      } catch (err) {
        console.warn('[OrgDetail] member-count query failed:', err);
      }

      try {
        const approverIds = await organizationDiscoveryService.getOrgsWithApprover([org.id]);
        if (!cancelled) setHasApprover(approverIds.has(org.id));
      } catch (err) {
        console.warn('[OrgDetail] approver check failed:', err);
      }

      if (user?.id) {
        try {
          const { data: my } = await supabase
            .from('organization_memberships')
            .select('joined_at, status, membership_status, created_at, role')
            .eq('user_id', user.id)
            .eq('organization_id', org.id)
            .maybeSingle();
          if (cancelled || !my) return;
          const active = my.status === 'active' || my.membership_status === 'active';
          setIsMember(active);
          if (active) {
            setUserRole((my as any).role || null);
          }
          const joined = (my as any).joined_at || (my as any).created_at;
          if (active && joined) {
            try {
              setMemberSince(`Member since ${new Date(joined).getFullYear()}`);
            } catch {
              setMemberSince('Member');
            }
          }
        } catch (err) {
          console.warn('[OrgDetail] membership query threw:', err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [org?.id, user?.id]);

  // Members you may know — other active members, top 5, excluding self.
  // PostgREST's embedded `profiles(...)` selector can't resolve here because
  // organization_memberships.user_id FKs to auth.users, not public.profiles.
  // Two-step: fetch memberships, then fetch profiles by id list.
  useEffect(() => {
    if (!org?.id) return;
    let cancelled = false;
    (async () => {
      // SECURITY DEFINER RPC — direct table reads return zero rows for
      // non-members (org_memberships RLS is owner-only). The RPC bounds the
      // exposure to active non-admin members so discovery can render.
      const { data: memberships, error } = await supabase.rpc(
        'discover_members_at_org',
        { p_org_id: org.id, p_limit: 12 },
      );
      if (cancelled || error || !memberships) return;
      const otherIds = memberships
        .filter((m) => m.user_id && m.user_id !== user?.id)
        .map((m) => m.user_id as string)
        .slice(0, 8);
      if (otherIds.length === 0) {
        setMembers([]);
        return;
      }
      // Fetch profiles + follow-graph + shared-topic data in parallel so the
      // xrow can render the canonical right-edge tags ("You follow", "Mutual",
      // "Shared topic"). Without these tags the cross-reference rows are flat.
      const [profilesQ, iFollowQ, theyFollowMeQ, mySubsQ, theirSubsQ] =
        await Promise.all([
          supabase
            .from('profiles')
            .select(
              'id, full_name, first_name, last_name, avatar_url, sailing_position, sailing_class, seasons_active'
            )
            .in('id', otherIds),
          user?.id
            ? supabase
                .from('user_follows')
                .select('following_id')
                .eq('follower_id', user.id)
                .in('following_id', otherIds)
            : Promise.resolve({ data: [] as { following_id: string }[] }),
          user?.id
            ? supabase
                .from('user_follows')
                .select('follower_id')
                .eq('following_id', user.id)
                .in('follower_id', otherIds)
            : Promise.resolve({ data: [] as { follower_id: string }[] }),
          user?.id
            ? supabase
                .from('community_memberships')
                .select('community_id')
                .eq('user_id', user.id)
            : Promise.resolve({ data: [] as { community_id: string }[] }),
          supabase
            .from('community_memberships')
            .select('user_id, community_id')
            .in('user_id', otherIds),
        ]);
      if (cancelled) return;

      const byId = new Map<string, any>();
      for (const p of profilesQ.data ?? []) byId.set(p.id, p);

      const iFollow = new Set<string>(
        (iFollowQ.data ?? []).map((r: any) => r.following_id)
      );
      const theyFollowMe = new Set<string>(
        (theyFollowMeQ.data ?? []).map((r: any) => r.follower_id)
      );
      const mySubs = new Set<string>(
        (mySubsQ.data ?? []).map((r: any) => r.community_id)
      );
      const theirSubs = new Map<string, Set<string>>();
      for (const row of (theirSubsQ.data ?? []) as { user_id: string; community_id: string }[]) {
        if (!theirSubs.has(row.user_id)) theirSubs.set(row.user_id, new Set());
        theirSubs.get(row.user_id)!.add(row.community_id);
      }

      const rows: MemberXRow[] = [];
      for (const m of memberships) {
        if (!m.user_id || m.user_id === user?.id) continue;
        const p = byId.get(m.user_id);
        const name =
          p?.full_name ||
          [p?.first_name, p?.last_name].filter(Boolean).join(' ') ||
          'Member';
        rows.push({
          userId: m.user_id,
          name,
          initials: initialsForName(name),
          sub: composeSailingIdentity(p, m.role, m.joined_at),
          tail: tailTagFor(m.user_id, { iFollow, theyFollowMe, mySubs, theirSubs }),
        });
        if (rows.length >= 5) break;
      }
      setMembers(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [org?.id, user?.id]);

  // Forums — communities linked to this org
  useEffect(() => {
    if (!org?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('communities')
        .select('id, slug, name, description, community_type, post_count, last_activity_at')
        .in('linked_entity_type', ['organization', 'org'])
        .eq('linked_entity_id', org.id)
        .order('last_activity_at', { ascending: false, nullsFirst: false })
        .limit(5);
      if (cancelled || !data) return;
      setForums(
        data.map((c: any) => ({
          id: c.id,
          slug: c.slug ?? c.id,
          name: c.name,
          glyph: communityGlyph(c.community_type),
          sub: c.post_count
            ? `${c.post_count.toLocaleString()} threads${c.last_activity_at ? ` · Active ${relativeTime(c.last_activity_at)}` : ''}`
            : c.description || 'Community',
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [org?.id]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setDocked(e.nativeEvent.contentOffset.y > 120);
  }, []);

  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/library?zone=orgs' as any);
  }, []);

  const handleOpenCalendar = useCallback(() => {
    if (!org?.id) return;
    router.push(`/club/${org.id}/calendar` as any);
  }, [org?.id]);

  const handleOpenAtlas = useCallback(() => {
    if (!org?.slug && !slug) return;
    router.push({ pathname: '/(tabs)/atlas', params: { orgSlug: org?.slug || slug } } as any);
  }, [org?.slug, slug]);

  const websiteUrl = org?.global_clubs?.website ?? null;
  const handleOpenWebsite = useCallback(() => {
    if (websiteUrl) Linking.openURL(websiteUrl);
  }, [websiteUrl]);

  const handleRequestJoin = useCallback(async () => {
    if (!org?.id || joinState === 'busy') return;
    setJoinState('busy');
    try {
      const result = await organizationDiscoveryService.requestJoin({
        orgId: org.id,
        mode: (org.join_mode || 'invite_only') as OrganizationJoinMode,
      });
      if (result.status === 'active' || result.status === 'existing') {
        setIsMember(true);
        setMemberSince(`Member since ${new Date().getFullYear()}`);
        setJoinState('idle');
      } else if (result.status === 'pending') {
        setJoinState('pending');
      } else {
        setJoinState('idle');
      }
    } catch (err) {
      console.warn('[OrgDetail] join request failed:', err);
      setJoinState('idle');
    }
  }, [org?.id, org?.join_mode, joinState]);

  const joinLabel = useMemo(() => {
    if (joinState === 'pending') return 'Pending approval';
    const mode = org?.join_mode || 'invite_only';
    if (mode === 'open_join') return 'Join';
    if (mode === 'request_to_join') return 'Request to join';
    return 'Invite only';
  }, [joinState, org?.join_mode]);

  // Two strings: a SHORT descriptor scope ("Hong Kong" — country/region) for
  // the hero descriptor line, and a SPECIFIC precinct ("Causeway Bay") for the
  // hero meta pellet. Canonical separates the two so the descriptor reads as
  // "what kind of place, broadly" and meta reads as "where exactly".
  const descriptorScope = useMemo(() => {
    if (!org?.global_clubs) return null;
    return org.global_clubs.country || null;
  }, [org?.global_clubs]);

  const precinct = useMemo(() => {
    if (!org?.global_clubs) return null;
    return org.global_clubs.city || null;
  }, [org?.global_clubs]);

  // Prefer the larger of (live count, estimate). The live count climbs from a
  // small dev seed; the estimate captures the canonical institution scale
  // (e.g. RHKYC's 2,840 sailors). Using the larger one keeps the hero meta
  // reading at the right weight while still honouring live growth.
  const effectiveMemberCount = useMemo(() => {
    const live = memberCount ?? 0;
    const est = org?.global_clubs?.member_count_estimate ?? 0;
    const max = Math.max(live, est);
    return max > 0 ? max : null;
  }, [memberCount, org?.global_clubs?.member_count_estimate]);

  const upNext = org?.metadata?.up_next ?? null;

  // Hero meta is intentionally empty on the Org detail per the Pass 11 brief
  // — founded year, member count, and location are reference facts, not
  // practice signals. They live in the About strip near the bottom of the
  // page, after the practice surface (Up next) and the cross-references
  // (Members you may know, Club forums). Keeps the hero focused on identity
  // and the one decision the page is asking for (Join / Calendar).
  const aboutFacts = useMemo(() => {
    const facts: { icon: IconName; text: string }[] = [];
    if (precinct) {
      const country = org?.global_clubs?.country;
      facts.push({
        icon: 'location-outline',
        text: country ? `${precinct}, ${country}` : precinct,
      });
    }
    if (org?.global_clubs?.established_year) {
      facts.push({
        icon: 'flag-outline',
        text: `Founded ${org.global_clubs.established_year}`,
      });
    }
    if (effectiveMemberCount && effectiveMemberCount >= MIN_PUBLIC_MEMBER_COUNT) {
      facts.push({
        icon: 'people-outline',
        text: `${effectiveMemberCount.toLocaleString()} ${effectiveMemberCount === 1 ? 'sailor' : 'sailors'}`,
      });
    }
    return facts;
  }, [
    precinct,
    org?.global_clubs?.country,
    org?.global_clubs?.established_year,
    effectiveMemberCount,
  ]);

  if (!org) {
    return (
      <SafeAreaView style={styles.ground} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <IOSDetailNavBar
          backLabel={backLabel}
          contextLabel="Org"
          onBack={onBack}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.ground} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <IOSDetailNavBar
        backLabel={backLabel}
        contextLabel="Org"
        dockedName={org.name}
        docked={docked}
        onBack={onBack}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <IOSDetailHero
          markShape="square"
          markText={initialsForName(org.name)}
          markColor={pickSquareMarkColor(org.id || org.slug || org.name)}
          name={org.name}
          descriptor={`Member club${descriptorScope ? ` · ${descriptorScope}` : ''}`}
        >
          {isMember ? (
            <>
              <RelationshipMinePill label={memberSince ?? 'Member'} />
              <RelationshipButton
                label="Calendar"
                icon="calendar-outline"
                secondary
                onPress={handleOpenCalendar}
              />
            </>
          ) : joinState === 'pending' ? (
            <RelationshipMinePill label="Pending approval" />
          ) : (org.join_mode || 'invite_only') === 'request_to_join' && !hasApprover ? (
            <RelationshipMinePill label="Not on BetterAt yet" />
          ) : (
            <RelationshipButton
              label={joinLabel}
              icon="add"
              loading={joinState === 'busy'}
              onPress={handleRequestJoin}
            />
          )}
          <RelationshipButton
            label="Open map"
            icon="map-outline"
            secondary
            fullWidth={false}
            onPress={handleOpenAtlas}
          />
        </IOSDetailHero>

        {/* Slice 5A — Verified-parent admin can propose adoption of this
            user-started org. Section absent unless the org is user-created,
            has no parent yet, and the viewer admins at least one verified
            org. See docs/redesign/specs/CREATE_ORG_FLOW_SPEC.md. */}
        {canProposeAdoption ? (
          <IOSDetailSection header="Adopt this org">
            <Pressable
              style={proposeStyles.cta}
              onPress={() => setProposeOpen(true)}
            >
              <Ionicons
                name="git-branch-outline"
                size={20}
                color="#0B63CE"
              />
              <View style={proposeStyles.body}>
                <Text style={proposeStyles.title}>
                  Propose adoption under your verified org
                </Text>
                <Text style={proposeStyles.hint}>
                  This is a user-started org. If one of your verified orgs
                  should adopt it, send a proposal — their admin decides.
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={IOS_REGISTER.labelSecondary}
              />
            </Pressable>
          </IOSDetailSection>
        ) : null}

        {/* Owner-only admin actions — edit, invite, archive. RLS gates
            the actual mutations via organizations_manage_by_owner_or_admin. */}
        {isOwner && org ? (
          <IOSDetailSection header="Manage org">
            <Pressable
              style={proposeStyles.cta}
              onPress={() => setEditOpen(true)}
            >
              <Ionicons name="create-outline" size={20} color="#0B63CE" />
              <View style={proposeStyles.body}>
                <Text style={proposeStyles.title}>Edit org details</Text>
                <Text style={proposeStyles.hint}>
                  Change name, kind, who can join, or description.
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={IOS_REGISTER.labelSecondary}
              />
            </Pressable>
            <Pressable
              style={proposeStyles.cta}
              onPress={() => setInviteOpen(true)}
            >
              <Ionicons name="person-add-outline" size={20} color="#0B63CE" />
              <View style={proposeStyles.body}>
                <Text style={proposeStyles.title}>Invite people</Text>
                <Text style={proposeStyles.hint}>
                  Generate a shareable link — send via Messages, WhatsApp,
                  anywhere.
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={IOS_REGISTER.labelSecondary}
              />
            </Pressable>
            <Pressable
              style={proposeStyles.cta}
              onPress={() => {
                showConfirm(
                  'Archive this org?',
                  `${org.name} will be hidden from your library. You can recover it later; nothing is hard-deleted.`,
                  async () => {
                    try {
                      await archiveOrg.mutateAsync(org.id);
                      router.replace('/(tabs)/library?zone=orgs' as any);
                    } catch (err) {
                      // eslint-disable-next-line no-console
                      console.warn('archive failed', err);
                    }
                  },
                  { destructive: true, confirmText: 'Archive' },
                );
              }}
            >
              <Ionicons name="archive-outline" size={20} color="#B42318" />
              <View style={proposeStyles.body}>
                <Text style={[proposeStyles.title, { color: '#B42318' }]}>
                  Archive org
                </Text>
                <Text style={proposeStyles.hint}>
                  Soft-archive — hidden from Discover, recoverable later.
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={IOS_REGISTER.labelSecondary}
              />
            </Pressable>
          </IOSDetailSection>
        ) : null}

        {/* "Up next at the club" — institutional activity signal.
            Three-pellet signal-row + the next two events. Pulled from
            organizations.metadata.up_next so each org carries its own
            schedule. Section absent when the org has no up_next data. */}
        {upNext && hasUpNextSignal(upNext) ? (
          <IOSDetailSection header="Up next at the club">
            <SignalRow cells={buildUpNextSignalCells(upNext)} />
            {(upNext.events ?? []).slice(0, 2).map((ev, idx) => (
              <DRow
                key={`${ev.title}-${idx}`}
                icon="boat-outline"
                title={ev.title}
                sub={ev.sub}
                meta={ev.meta}
                metaWhen={ev.meta_when}
              />
            ))}
          </IOSDetailSection>
        ) : null}

        {/* Cross-ref → People — actual members from this org.
            One suggestion still earns its place in discovery; absent only
            when the RPC returns zero rows. */}
        {members.length >= 1 &&
        (isMember ||
          isOwner ||
          (effectiveMemberCount ?? 0) >= MIN_PUBLIC_MEMBER_COUNT) ? (
          <IOSDetailSection
            header="Members you may know"
            seeAll={
              effectiveMemberCount && effectiveMemberCount > members.length
                ? {
                    label: `See all ${effectiveMemberCount.toLocaleString()}`,
                    onPress: () => router.push(`/org/${org.slug}/members` as any),
                  }
                : undefined
            }
          >
            {members.map((m, idx) => (
              <XRow
                key={m.userId}
                markVariant="circle"
                markText={m.initials}
                markColor={pickAvatarMarkColor(m.userId)}
                name={m.name}
                sub={m.sub}
                tail={m.tail}
                isFirst={idx === 0}
                onPress={() =>
                  router.push(
                    `/discover/person/${m.userId}?from=orgs&name=${encodeURIComponent(m.name)}&sub=${encodeURIComponent(m.sub)}&initials=${encodeURIComponent(m.initials)}` as any,
                  )
                }
              />
            ))}
          </IOSDetailSection>
        ) : null}

        {/* Cross-ref → Topics — communities linked to this org. */}
        {forums.length > 0 ? (
          <IOSDetailSection
            header="Club forums"
            seeAll={
              forums.length >= 5
                ? {
                    label: 'All',
                    onPress: () => router.push(`/org/${org.slug}/forums` as any),
                  }
                : undefined
            }
          >
            {forums.map((f, idx) => (
              <XRow
                key={f.id}
                markVariant="topic"
                markIcon={f.glyph}
                name={f.name}
                sub={f.sub}
                isFirst={idx === 0}
                onPress={() =>
                  router.push(
                    `/discover/topic/${f.slug}?from=orgs&name=${encodeURIComponent(f.name)}` as any,
                  )
                }
              />
            ))}
          </IOSDetailSection>
        ) : null}

        {/* About — reference facts demoted to a compact strip near the bottom,
            per the Pass 11 brief. Founded year, member count, and location
            are reference facts, not practice signals; they earn a quiet
            position after the practice surfaces (Up next, Members, Forums). */}
        {aboutFacts.length > 0 ? (
          <View style={styles.aboutStrip}>
            {aboutFacts.map((f, i) => (
              <View key={i} style={styles.aboutFact}>
                <Ionicons
                  name={f.icon}
                  size={12}
                  color={IOS_REGISTER.labelTertiary}
                />
                <Text style={styles.aboutFactText}>{f.text}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {websiteUrl ? (
          <ExternalLinkRow
            url={websiteUrl.replace(/^https?:\/\//, '')}
            onPress={handleOpenWebsite}
          />
        ) : null}

        <View style={styles.bottomPad} />
      </ScrollView>

      {org ? (
        <ProposeAdoptionSheet
          visible={proposeOpen}
          targetOrgId={org.id}
          targetOrgName={org.name}
          onClose={() => setProposeOpen(false)}
        />
      ) : null}

      {org && isOwner ? (
        <InvitePeopleSheet
          visible={inviteOpen}
          orgId={org.id}
          orgName={org.name}
          onClose={() => setInviteOpen(false)}
        />
      ) : null}

      {org && isOwner ? (
        <EditOrgSheet
          visible={editOpen}
          orgId={org.id}
          initial={{
            name: org.name,
            kind: org.organization_type || 'fleet',
            joinMode: (org.join_mode as any) || 'request_to_join',
            description:
              (org.metadata as any)?.description ?? null,
          }}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            // Reload the org so the hero reflects the new name.
            void supabase
              .from('organizations')
              .select(
                'id, name, slug, join_mode, interest_slug, global_club_id, metadata, creation_source, parent_org_id, official, global_clubs(city, country, established_year, member_count_estimate, website)'
              )
              .eq('id', org.id)
              .maybeSingle()
              .then(({ data }) => {
                if (!data) return;
                const raw = data as unknown as OrgRow & {
                  global_clubs?: OrgRow['global_clubs'] | OrgRow['global_clubs'][];
                };
                const gc = Array.isArray(raw.global_clubs)
                  ? raw.global_clubs[0] ?? null
                  : raw.global_clubs ?? null;
                setOrg({ ...raw, global_clubs: gc });
              });
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

/**
 * Compose the xrow sub line as sailing-identity language ("Dragon helm · 11 seasons"),
 * preferring on-water identity over org-admin metadata. Falls back through:
 *   1. position + class + seasons → "Dragon helm · 11 seasons"
 *   2. class + seasons            → "Dragon · 11 seasons"
 *   3. role + joined year         → "Member · joined 2026"
 *   4. role only                  → "Member"
 */
function composeSailingIdentity(
  profile: {
    sailing_position?: string | null;
    sailing_class?: string | null;
    seasons_active?: number | null;
  } | undefined,
  role: string | null | undefined,
  joinedAt: string | null | undefined,
): string {
  const position = profile?.sailing_position?.trim();
  const klass = profile?.sailing_class?.trim();
  const seasons = profile?.seasons_active;
  const seasonsStr =
    typeof seasons === 'number' && seasons > 0
      ? `${seasons} season${seasons === 1 ? '' : 's'}`
      : null;

  if (klass && position) {
    const identity = `${klass} ${position}`;
    return seasonsStr ? `${identity} · ${seasonsStr}` : identity;
  }
  if (klass && seasonsStr) return `${klass} · ${seasonsStr}`;
  if (klass) return klass;

  const formattedRole = role
    ? String(role).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Member';
  const joinedYear = joinedAt ? new Date(joinedAt).getFullYear() : null;
  return joinedYear ? `${formattedRole} · joined ${joinedYear}` : formattedRole;
}

function hasUpNextSignal(up: UpNextData | null | undefined): boolean {
  if (!up) return false;
  return Boolean(
    up.races_this_week ||
      up.entries_count ||
      (up.next_start_day && up.next_start_time) ||
      (up.events && up.events.length > 0),
  );
}

function buildUpNextSignalCells(up: UpNextData): SignalCellData[] {
  const cells: SignalCellData[] = [];
  if (up.races_this_week) {
    cells.push({
      num: String(up.races_this_week),
      small: 'races',
      label: 'This week',
    });
  }
  if (up.entries_count) {
    cells.push({
      num: up.entries_count.toLocaleString(),
      label: up.entries_label || 'Entries',
    });
  }
  if (up.next_start_day && up.next_start_time) {
    cells.push({
      num: up.next_start_day,
      label: `Next start · ${up.next_start_time}`,
    });
  }
  return cells;
}

/**
 * Compute the right-edge tag for a member xrow. Priority order matches the
 * canonical's grammar: relationships you've explicitly chosen win over
 * inferred-overlap signals.
 *   "Mutual"       — you follow them AND they follow you
 *   "You follow"   — you follow them
 *   "Follows you"  — they follow you
 *   "Shared topic" — neither follows the other, but you both subscribe to the
 *                    same community
 *   undefined      — no relationship signal worth surfacing
 */
function tailTagFor(
  userId: string,
  ctx: {
    iFollow: Set<string>;
    theyFollowMe: Set<string>;
    mySubs: Set<string>;
    theirSubs: Map<string, Set<string>>;
  },
): string | undefined {
  const i = ctx.iFollow.has(userId);
  const they = ctx.theyFollowMe.has(userId);
  if (i && they) return 'Mutual';
  if (i) return 'You follow';
  if (they) return 'Follows you';
  const subs = ctx.theirSubs.get(userId);
  if (subs && ctx.mySubs.size > 0) {
    for (const s of subs) if (ctx.mySubs.has(s)) return 'Shared topic';
  }
  return undefined;
}

function relativeTime(iso: string): string {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    const min = Math.floor(diff / 60000);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    if (d < 30) return `${d}d ago`;
    const mo = Math.floor(d / 30);
    return `${mo}mo ago`;
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  ground: { flex: 1, backgroundColor: IOS_DETAIL_GROUND_BG },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  bottomPad: { height: 120 },

  // About strip — Pass 11 demoted-facts row. Sits between the cross-references
  // and the external link. Flat horizontal layout, no card chrome, deliberately
  // quiet typography.
  aboutStrip: {
    marginTop: 24,
    paddingHorizontal: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 4,
  },
  aboutFact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aboutFactText: {
    fontSize: 12,
    letterSpacing: -0.05,
    color: IOS_REGISTER.labelTertiary,
  },
});

const proposeStyles = StyleSheet.create({
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  body: { flex: 1, gap: 2 },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: IOS_REGISTER.label,
  },
  hint: {
    fontSize: 12,
    color: IOS_REGISTER.labelSecondary,
    lineHeight: 16,
  },
});
