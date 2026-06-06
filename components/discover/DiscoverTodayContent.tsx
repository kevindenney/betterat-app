/**
 * DiscoverTodayContent — the Cover front door of the Discover tab
 *
 * Pass 11 (docs/redesign/ios-register/discover-pass-11-brief.md):
 *
 *   The front of the magazine. One thing happening now, one editorial pick,
 *   three cross-shelf invitations. The five sub-tabs share one structure;
 *   the Cover is the front door.
 *
 *   - Title is time-stamped rather than categorical ("This Sunday" instead of
 *     "Discover") — the title does editorial work.
 *   - NOW HAPPENING AT YOUR {INSTITUTION} — home-org spotlight, the one
 *     earned chrome-break. Skipped entirely if no home org (the Cover
 *     doesn't pad).
 *   - THIS WEEK'S PICK and ALSO FOR YOU are intentionally NOT rendered yet —
 *     they require automated editor-like weekly scoring that the brief
 *     captures but the live tab doesn't have data for. Per the brief's
 *     "no empty state" rule, omitted is correct.
 *
 * Wire-up status (2026-05-23):
 *   - Home org: wired to the user's first active organization_membership
 *     scoped to the current interest. Both `status` and `membership_status`
 *     are checked (feedback_membership_status_split). Cross-interest
 *     fallback is intentionally absent — a nursing-school membership
 *     mustn't show under Sail Racing.
 *   - Eyebrow is plain "NOW HAPPENING". The brief's "AT YOUR CLUB" was
 *     sailing-specific; the home-org card directly below already names the
 *     institution.
 *   - "This week's pick" + "Also for you" land when automated scoring is
 *     implemented. The scoring sketch lives in the Pass 11 brief.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { usePopularCommunities } from '@/hooks/useCommunities';
import { useSailorSuggestions } from '@/hooks/useSailorSuggestions';
import { supabase } from '@/services/supabase';
import { IOS_COLORS, IOS_REGISTER } from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import {
  initialsForName,
  pickAvatarMarkColor,
  pickSquareMarkColor,
} from '@/components/discover/canonical';
import type { Community } from '@/types/community';

interface DiscoverTodayContentProps {
  toolbarOffset: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

// =============================================================================
// HOME-ORG QUERY — Pass 11 "Now happening" wiring
// =============================================================================

export interface HomeOrg {
  orgId: string;
  name: string;
  slug: string | null;
  role: string | null;
}

export function useHomeOrg(): HomeOrg | null {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const [club, setClub] = useState<HomeOrg | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setClub(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Two-step lookup. (1) fetch every membership row this user has and
        // filter by BOTH status columns in JS — `status` and
        // `membership_status` can diverge in the seed data
        // (feedback_membership_status_split). (2) fetch the org rows for the
        // matching IDs and pick one scoped to the current interest. Embedded
        // !inner joins also don't work here because
        // organization_memberships → auth.users isn't a relationship
        // PostgREST can resolve through the public schema
        // (feedback_supabase_embed_needs_fk).
        const { data: memberships, error: memErr } = await supabase
          .from('organization_memberships')
          .select('organization_id, role, status, membership_status, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (memErr) throw memErr;
        if (cancelled) return;

        const activeRows = (memberships ?? []).filter((r: any) => {
          const a = r.status === 'active' || r.status === 'invite_accepted';
          const b =
            r.membership_status === 'active' ||
            r.membership_status === 'invite_accepted';
          return a || b;
        }) as { organization_id: string; role: string | null }[];

        if (activeRows.length === 0) {
          setClub(null);
          return;
        }

        const orgIds = activeRows.map((r) => r.organization_id);
        const { data: orgs, error: orgErr } = await supabase
          .from('organizations')
          .select('id, name, slug, interest_slug, is_active')
          .in('id', orgIds)
          .eq('is_active', true);
        if (orgErr) throw orgErr;
        if (cancelled) return;

        const orgsById = new Map<string, any>();
        for (const o of orgs ?? []) orgsById.set(o.id, o);

        // Only pick an org scoped to the user's current interest. Without
        // this guard a nursing-school membership leaks into the Sail Racing
        // Today surface (and vice versa). The Cover represents what's
        // happening at your institution *in this interest*; cross-interest
        // orgs belong on the Today surface for those interests, not this one.
        const interestSlug = currentInterest?.slug ?? null;
        let pick: { row: { organization_id: string; role: string | null }; org: any } | null =
          null;
        for (const row of activeRows) {
          const org = orgsById.get(row.organization_id);
          if (!org) continue;
          if (!interestSlug || org.interest_slug === interestSlug) {
            pick = { row, org };
            break;
          }
        }

        if (pick) {
          setClub({
            orgId: pick.org.id,
            name: pick.org.name,
            slug: pick.org.slug ?? null,
            role: pick.row.role,
          });
        } else {
          setClub(null);
        }
      } catch (err) {
        console.warn('[DiscoverToday] home-org query failed:', err);
        if (!cancelled) setClub(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, currentInterest?.slug]);

  return club;
}

// =============================================================================
// ALSO-FOR-YOU · A CLUB — first active org in the current interest the user
// isn't already a member of. The simplest of the three "Also for you" picks
// to wire; sailor + room land in follow-up commits. Brief's automated
// editor-like picking starts here: real query, real org, no placeholder.
// =============================================================================

interface AlsoClubPick {
  orgId: string;
  name: string;
  slug: string | null;
}

function useAlsoClub(homeOrgId: string | null): AlsoClubPick | null {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const [pick, setPick] = useState<AlsoClubPick | null>(null);

  useEffect(() => {
    if (!currentInterest?.slug) {
      setPick(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Collect the user's existing memberships so we don't suggest an org
        // they're already in. Membership state uses both status columns
        // (feedback_membership_status_split).
        const ownedOrgIds = new Set<string>();
        if (homeOrgId) ownedOrgIds.add(homeOrgId);
        if (user?.id) {
          const { data: mine } = await supabase
            .from('organization_memberships')
            .select('organization_id, status, membership_status')
            .eq('user_id', user.id);
          for (const row of (mine ?? []) as any[]) {
            const a = row.status === 'active' || row.status === 'invite_accepted';
            const b =
              row.membership_status === 'active' ||
              row.membership_status === 'invite_accepted';
            if (a || b) ownedOrgIds.add(row.organization_id);
          }
        }

        const { data: orgs, error } = await supabase
          .from('organizations')
          .select('id, name, slug')
          .eq('interest_slug', currentInterest.slug)
          .eq('is_active', true)
          .order('name')
          .limit(20);
        if (error) throw error;
        if (cancelled) return;

        const candidate = (orgs ?? []).find((o: any) => !ownedOrgIds.has(o.id));
        if (candidate) {
          setPick({ orgId: candidate.id, name: candidate.name, slug: candidate.slug ?? null });
        } else {
          setPick(null);
        }
      } catch (err) {
        console.warn('[DiscoverToday] also-club query failed:', err);
        if (!cancelled) setPick(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, currentInterest?.slug, homeOrgId]);

  return pick;
}

// =============================================================================
// ALSO-FOR-YOU · A ROOM — first popular community the user isn't already a
// member of. Communities aren't currently scoped to BetterAt interests (their
// linked-entity types are all sailing-flavored), so this currently lands a
// useful pick for sailing users and quietly omits the section for other
// interests until communities generalize.
// =============================================================================

interface AlsoRoomPick {
  id: string;
  slug: string;
  name: string;
  descriptor: string;
}

function useAlsoRoom(): AlsoRoomPick | null {
  // Communities aren't interest-scoped (linked_entity_type is sailing-only),
  // so this hook would bleed sailing rooms into nursing / fitness / drawing
  // surfaces. Gate to sail-racing until the communities schema generalizes.
  const { currentInterest } = useInterest();
  const enabled = currentInterest?.slug === 'sail-racing';
  const { data: popular } = usePopularCommunities(20);

  return useMemo(() => {
    if (!enabled) return null;
    if (!popular || popular.length === 0) return null;
    const candidate = (popular as Community[]).find((c) => !c.is_member);
    if (!candidate) return null;
    const descriptorParts: string[] = [];
    if (candidate.category_name) descriptorParts.push(candidate.category_name);
    return {
      id: candidate.id,
      slug: candidate.slug ?? candidate.id,
      name: candidate.name,
      descriptor:
        descriptorParts.length > 0
          ? descriptorParts.join(' · ')
          : 'Worth knowing exists.',
    };
  }, [enabled, popular]);
}

// =============================================================================
// THIS WEEK'S PICK — first live blueprint from an org the user belongs to in
// the current interest. The brief's "most considered editorial move per
// week" — v1 ranks on recency (most-recently-published wins). Concept-
// overlap + author-authority scoring lands later. Italic-serif Component-1
// treatment; coral dot for the "extends your X" line (omitted until we
// score against current concepts).
// =============================================================================

export interface ThisWeeksPick {
  id: string;
  slug: string;
  title: string;
  description: string;
  authorName: string | null;
  stepCount: number;
}

export function useThisWeeksPick(): ThisWeeksPick | null {
  const { user } = useAuth();
  const { currentInterest } = useInterest();
  const [pick, setPick] = useState<ThisWeeksPick | null>(null);

  useEffect(() => {
    if (!user?.id || !currentInterest?.slug) {
      setPick(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // First find orgs the user belongs to in the current interest. RLS
        // on blueprints requires active membership, so blueprints in any
        // other org won't return anyway — but scoping to the right interest
        // up front avoids surfacing cross-interest content.
        const { data: memberships } = await supabase
          .from('organization_memberships')
          .select('organization_id, status, membership_status')
          .eq('user_id', user.id);
        const myOrgIds = new Set<string>();
        for (const row of (memberships ?? []) as any[]) {
          const a = row.status === 'active' || row.status === 'invite_accepted';
          const b =
            row.membership_status === 'active' ||
            row.membership_status === 'invite_accepted';
          if (a || b) myOrgIds.add(row.organization_id);
        }
        if (myOrgIds.size === 0) {
          setPick(null);
          return;
        }
        const { data: scopedOrgs } = await supabase
          .from('organizations')
          .select('id, interest_slug')
          .in('id', Array.from(myOrgIds))
          .eq('interest_slug', currentInterest.slug);
        const interestOrgIds = (scopedOrgs ?? [])
          .map((o: any) => o.id as string)
          .filter(Boolean);
        if (interestOrgIds.length === 0) {
          setPick(null);
          return;
        }

        const { data: blueprints, error } = await supabase
          .from('blueprints')
          .select('id, slug, title, description, author_user_id, step_count, published_at')
          .in('org_id', interestOrgIds)
          .eq('status', 'live')
          .not('published_at', 'is', null)
          .order('published_at', { ascending: false })
          .limit(1);
        if (error) throw error;
        if (cancelled) return;

        const winner = (blueprints ?? [])[0];
        if (!winner) {
          setPick(null);
          return;
        }

        let authorName: string | null = null;
        if (winner.author_user_id) {
          const { data: author } = await supabase
            .from('profiles')
            .select('full_name, first_name, last_name')
            .eq('id', winner.author_user_id)
            .maybeSingle();
          if (author) {
            authorName =
              author.full_name ||
              [author.first_name, author.last_name].filter(Boolean).join(' ') ||
              null;
          }
        }

        if (!cancelled) {
          setPick({
            id: winner.id,
            slug: winner.slug,
            title: winner.title,
            description: winner.description ?? '',
            authorName,
            stepCount: winner.step_count ?? 0,
          });
        }
      } catch (err) {
        console.warn('[DiscoverToday] this-weeks-pick query failed:', err);
        if (!cancelled) setPick(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, currentInterest?.slug]);

  return pick;
}

// =============================================================================
// ALSO-FOR-YOU · A SAILOR — first sailor suggestion the user isn't already
// following. Uses the CrewFinder similarity service through
// useSailorSuggestions; pick falls out as the first row not already followed.
// Sailing-flavored today (CrewFinder is sailing-named); will quietly omit
// for other interests until the cross-interest people graph generalizes.
// =============================================================================

interface AlsoSailorPick {
  userId: string;
  fullName: string;
  initials: string;
  descriptor: string;
}

function useAlsoSailor(): AlsoSailorPick | null {
  // CrewFinderService.getSimilarSailors is sailing-named and built on
  // sailing-specific similarity signals (boat class, fleet, sailing position).
  // Surfacing a Dragon helm under a Nursing user reads as a bug, so gate
  // to sail-racing until the people similarity graph generalizes.
  const { currentInterest } = useInterest();
  const enabled = currentInterest?.slug === 'sail-racing';
  const { suggestions } = useSailorSuggestions();
  return useMemo(() => {
    if (!enabled) return null;
    if (!suggestions || suggestions.length === 0) return null;
    const candidate = suggestions[0];
    if (!candidate) return null;
    const reason = candidate.similarityReason?.trim();
    return {
      userId: candidate.userId,
      fullName: candidate.fullName,
      initials: initialsForName(candidate.fullName),
      descriptor: reason && reason.length > 0 ? reason : 'Worth knowing exists.',
    };
  }, [enabled, suggestions]);
}

// =============================================================================
// MAIN
// =============================================================================

export function DiscoverTodayContent({
  toolbarOffset,
  onScroll,
}: DiscoverTodayContentProps) {
  const router = useRouter();
  const homeOrg = useHomeOrg();
  const thisWeeksPick = useThisWeeksPick();
  const alsoClub = useAlsoClub(homeOrg?.orgId ?? null);
  const alsoRoom = useAlsoRoom();
  const alsoSailor = useAlsoSailor();
  const todayLabel = useMemo(() => formatTodayLabel(new Date()), []);

  // Eyebrow is intentionally plain "NOW HAPPENING" instead of the brief's
  // sailing-flavored "NOW HAPPENING AT YOUR CLUB". The home-org card
  // directly below already names the institution; an "AT YOUR ___" framer
  // either repeats that or, worse, miscategorizes it (calling a nursing
  // school a "club" or a "clinical site"). The plain eyebrow generalizes
  // across every interest without vocab gymnastics.
  const nowHappeningEyebrow = 'NOW HAPPENING';

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={[styles.scrollContent, { paddingTop: toolbarOffset }]}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{todayLabel}</Text>
      </View>

      {/* Home-org spotlight — omitted entirely when no home org in this
          interest (per brief: the Cover doesn't pad). */}
      {homeOrg ? (
        <>
          <View style={styles.sectionEyebrowRow}>
            <Text style={styles.sectionEyebrow}>{nowHappeningEyebrow}</Text>
          </View>
          <Pressable
            style={styles.homeClubCard}
            disabled={!homeOrg.slug}
            onPress={() => {
              if (homeOrg.slug) {
                router.push(
                  `/discover/org/${homeOrg.slug}?from=today` as any,
                );
              }
            }}
          >
            <View
              style={[
                styles.avatar44,
                { backgroundColor: pickSquareMarkColor(homeOrg.orgId) },
              ]}
            >
              <Text style={styles.avatarInitials}>
                {initialsForName(homeOrg.name)}
              </Text>
            </View>
            <View style={styles.homeClubNameBlock}>
              <Text style={styles.homeClubName}>{homeOrg.name}</Text>
              <Text style={styles.homeClubDescriptor}>
                {homeOrg.role ? capitalize(homeOrg.role) : 'Member'}
              </Text>
            </View>
            {homeOrg.slug ? (
              <Ionicons
                name="chevron-forward"
                size={16}
                color={IOS_REGISTER.labelTertiary}
              />
            ) : null}
          </Pressable>
        </>
      ) : null}

      {/* THIS WEEK'S PICK — one Path, italic-serif treatment, the brief's
          "most considered editorial move per week". v1 ranks on recency;
          concept-overlap scoring lands later. Tap routes to the blueprint
          detail. Omitted if no live blueprint in user's accessible
          interest-scoped orgs. */}
      {thisWeeksPick ? (
        <>
          <View style={styles.sectionEyebrowRow}>
            <Text style={styles.sectionEyebrow}>THIS WEEK'S PICK</Text>
          </View>
          <Pressable
            style={styles.pickCard}
            onPress={() => {
              router.push(`/blueprint/${thisWeeksPick.id}` as any);
            }}
          >
            <Text style={styles.pickEyebrow}>FOR YOU, {todayLabel.toUpperCase()}</Text>
            <Text style={styles.pickTitle}>{thisWeeksPick.title}</Text>
            <Text style={styles.pickSource}>
              {thisWeeksPick.authorName ? `From ${thisWeeksPick.authorName}` : 'Blueprint'}
              {thisWeeksPick.stepCount > 0 ? (
                <>
                  <Text style={styles.cardSourceSep}> · </Text>
                  {thisWeeksPick.stepCount}{' '}
                  {thisWeeksPick.stepCount === 1 ? 'step' : 'steps'}
                </>
              ) : null}
            </Text>
            {thisWeeksPick.description ? (
              <Text style={styles.pickQuote}>{thisWeeksPick.description}</Text>
            ) : null}
          </Pressable>
        </>
      ) : null}

      {/* ALSO FOR YOU — three cross-shelf invitations (sailor / room / club).
          Brief's "no empty state" rule: sections without a real pick are
          omitted; the whole header is omitted if no picks at all. */}
      {alsoSailor || alsoClub || alsoRoom ? (
        <View style={styles.sectionEyebrowRow}>
          <Text style={styles.sectionEyebrow}>ALSO FOR YOU</Text>
        </View>
      ) : null}
      {alsoSailor ? (
        <Pressable
          style={styles.alsoCard}
          onPress={() => {
            router.push(
              `/discover/person/${alsoSailor.userId}?from=today&name=${encodeURIComponent(alsoSailor.fullName)}&initials=${encodeURIComponent(alsoSailor.initials)}` as any,
            );
          }}
        >
          <Text style={styles.alsoTag}>A SAILOR</Text>
          <View style={styles.alsoRowBody}>
            <View
              style={[
                styles.avatar44,
                { backgroundColor: pickAvatarMarkColor(alsoSailor.userId) },
              ]}
            >
              <Text style={styles.avatarInitials}>{alsoSailor.initials}</Text>
            </View>
            <View style={styles.alsoRowText}>
              <Text style={styles.alsoRowTitle}>{alsoSailor.fullName}</Text>
              <Text style={styles.alsoRowDesc}>{alsoSailor.descriptor}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={IOS_REGISTER.labelTertiary}
            />
          </View>
        </Pressable>
      ) : null}
      {alsoClub ? (
        <Pressable
          style={styles.alsoCard}
          onPress={() => {
            if (alsoClub.slug) {
              router.push(`/discover/org/${alsoClub.slug}?from=today` as any);
            }
          }}
        >
          <Text style={styles.alsoTag}>AN ORG</Text>
          <View style={styles.alsoRowBody}>
            <View
              style={[
                styles.avatar44,
                { backgroundColor: pickSquareMarkColor(alsoClub.orgId) },
              ]}
            >
              <Text style={styles.avatarInitials}>
                {initialsForName(alsoClub.name)}
              </Text>
            </View>
            <View style={styles.alsoRowText}>
              <Text style={styles.alsoRowTitle}>{alsoClub.name}</Text>
              <Text style={styles.alsoRowDesc}>
                Worth knowing exists in your interest.
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={IOS_REGISTER.labelTertiary}
            />
          </View>
        </Pressable>
      ) : null}
      {alsoRoom ? (
        <Pressable
          style={styles.alsoCard}
          onPress={() => {
            router.push(
              `/discover/topic/${alsoRoom.slug}?from=today&name=${encodeURIComponent(alsoRoom.name)}` as any,
            );
          }}
        >
          <Text style={styles.alsoTag}>A ROOM</Text>
          <View style={styles.alsoRowBody}>
            <View style={styles.roomGlyph}>
              <Ionicons
                name="chatbubble-outline"
                size={18}
                color={IOS_REGISTER.labelSecondary}
              />
            </View>
            <View style={styles.alsoRowText}>
              <Text style={styles.alsoRowTitle}>{alsoRoom.name}</Text>
              <Text style={styles.alsoRowDesc}>{alsoRoom.descriptor}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={IOS_REGISTER.labelTertiary}
            />
          </View>
        </Pressable>
      ) : null}

      {/* Banner only renders when the surface is completely empty — per the
          brief's "no empty state" rule, the Cover doesn't pad; but a totally
          empty Today is disorienting and needs a nudge toward joining an
          org. Otherwise the picks above speak for themselves. */}
      {!homeOrg && !thisWeeksPick && !alsoSailor && !alsoClub && !alsoRoom ? (
        <View style={styles.previewBanner}>
          <Ionicons
            name="information-circle"
            size={14}
            color={IOS_REGISTER.labelSecondary}
          />
          <Text style={styles.previewBannerText}>
            Nothing for you yet in this interest. Open Orgs to join one, or
            switch interests at the top.
          </Text>
        </View>
      ) : null}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatTodayLabel(date: Date): string {
  const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  if (isToday) return `This ${weekday}`;
  return weekday;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 120, paddingHorizontal: 16 },

  titleBlock: {
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 34,
    fontWeight: '400',
    lineHeight: 38,
    letterSpacing: -0.88,
    color: IOS_REGISTER.label,
  },

  // Section eyebrow
  sectionEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 16,
    marginBottom: 10,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // Home-org spotlight card
  homeClubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 10,
    ...Platform.select({
      web: {
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  homeClubNameBlock: {
    flex: 1,
  },
  homeClubName: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  homeClubDescriptor: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },
  avatar44: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomGlyph: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: IOS_COLORS.systemGray6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // This week's pick — italic-serif treatment, coral-tinted border (the
  // brief's full Component-1 weight for the editorial bet).
  pickCard: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 87, 0.25)',
    ...Platform.select({
      web: {
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  pickEyebrow: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D97757',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  pickTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  pickSource: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
    marginBottom: 10,
  },
  pickQuote: {
    fontSize: 15,
    color: IOS_REGISTER.label,
    lineHeight: 22,
    letterSpacing: -0.15,
    fontStyle: 'italic',
    ...Platform.select({
      ios: { fontFamily: fontFamily.serif },
      android: { fontFamily: fontFamily.serif },
      web: { fontFamily: fontFamily.serif } as any,
    }),
  },
  cardSourceSep: {
    color: IOS_REGISTER.labelTertiary,
  },

  // Also-for-you card — same shape as home-org card but with a tag
  // eyebrow ("AN ORG" / "A SAILOR" / "A ROOM" once wired).
  alsoCard: {
    backgroundColor: IOS_REGISTER.cardBg,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    marginBottom: 10,
    ...Platform.select({
      web: {
        boxShadow:
          '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
      } as any,
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
      },
    }),
  },
  alsoTag: {
    fontSize: 10,
    fontWeight: '600',
    color: IOS_REGISTER.labelTertiary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  alsoRowBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  alsoRowText: {
    flex: 1,
  },
  alsoRowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_REGISTER.label,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  alsoRowDesc: {
    fontSize: 13,
    color: IOS_REGISTER.labelSecondary,
    letterSpacing: -0.1,
  },

  // Preview banner — a single line explaining the not-yet-wired sections
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 8,
  },
  previewBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: IOS_REGISTER.labelSecondary,
  },
});
