/**
 * Discover · Person detail — iOS register
 *
 * The practitioner detail surface. Implements the canonical defined in
 * `docs/redesign/ios-register/discover-detail-trio-canonical.html` Surface 2.
 *
 * Hero opens with Follow in iOS blue when not yet followed; gray "Following"
 * pill when already followed; "This is you" pill on the viewer's own profile.
 * Body leads with the practice signal — current concept (bio) — then
 * trajectory (settled steps), in-common (shared orgs), and public threads
 * (discussion posts on public steps), all from usePersonPublicSections.
 * Sparse data means sections are absent, never empty placeholders.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/services/supabase';
import { showAlert, showConfirm } from '@/lib/utils/crossPlatformAlert';
import { initialsForName } from '@/components/discover/canonical';
import {
  IOSDetailNavBar,
  IOSDetailHero,
  IOSDetailSection,
  RelationshipButton,
  RelationshipMinePill,
  DRow,
  TrophyRow,
  InCommonRow,
  ConceptCard,
  WebDetailContainer,
  IOS_DETAIL_GROUND_BG,
  pickAvatarMarkColor,
} from '@/components/discover/detail';
import { useAuth } from '@/providers/AuthProvider';
import {
  usePersonPublicSections,
  formatPersonWhen,
} from '@/hooks/usePersonPublicSections';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { IOS_REGISTER } from '@/lib/design-tokens-ios';
import { SuggestStepComposer } from '@/components/sailor/SuggestStepComposer';

type ProfileRow = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  sailing_position?: string | null;
  sailing_class?: string | null;
  sailing_location?: string | null;
  sailing_club?: string | null;
  seasons_active?: number | null;
  updated_at?: string | null;
};

export default function PersonDetailScreen() {
  return <PersonDetailScreenInner />;
}

function PersonDetailScreenInner() {
  const params = useLocalSearchParams<{
    userId?: string;
    from?: string;
    name?: string;
    sub?: string;
    initials?: string;
  }>();
  const userId = typeof params.userId === 'string' ? params.userId.trim() : '';
  const fallbackName = typeof params.name === 'string' ? params.name.trim() : '';
  const fallbackSub = typeof params.sub === 'string' ? params.sub.trim() : '';
  const fallbackInitials =
    typeof params.initials === 'string' ? params.initials.trim() : '';
  const backLabel = params.from === 'orgs' ? 'Orgs' : params.from === 'forums' ? 'Forums' : 'People';

  const { user } = useAuth();
  const isSelf = Boolean(user?.id && user.id === userId);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [docked, setDocked] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const { data: sections } = usePersonPublicSections(userId);
  const trajectory = (sections?.trajectory ?? []).slice(0, 3);
  const inCommonOrgs = sections?.inCommonOrgs ?? [];
  const publicThreads = sections?.publicThreads ?? [];

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select(
          'id, full_name, first_name, last_name, bio, avatar_url, sailing_position, sailing_class, sailing_location, sailing_club, seasons_active, updated_at'
        )
        .eq('id', userId)
        .maybeSingle();
      if (!cancelled && data) setProfile(data as ProfileRow);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!user?.id || !userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_follows')
        .select('follower_id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle();
      if (!cancelled) setIsFollowing(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, userId]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setDocked(e.nativeEvent.contentOffset.y > 120);
  }, []);

  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/watch' as any);
  }, []);

  const handleFollow = useCallback(async () => {
    if (!user?.id || !userId || followBusy) return;
    setFollowBusy(true);
    try {
      if (isFollowing) {
        await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);
        setIsFollowing(false);
      } else {
        await supabase
          .from('user_follows')
          .insert({ follower_id: user.id, following_id: userId });
        setIsFollowing(true);
      }
    } catch (err) {
      console.warn('[PersonDetail] follow toggle failed:', err);
    } finally {
      setFollowBusy(false);
    }
  }, [followBusy, isFollowing, user?.id, userId]);

  const displayName = useMemo(
    () =>
      profile?.full_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
      fallbackName ||
      'Sailor',
    [profile, fallbackName],
  );

  // Hero descriptor scopes the practitioner — position + location.
  // Canonical example: "Dragon helm · Buenos Aires". Seasons belong in
  // the meta row, not the descriptor (seasons are a count, not an identity).
  const descriptor = useMemo(() => {
    if (profile) {
      const klass = profile.sailing_class?.trim();
      const position = profile.sailing_position?.trim();
      const identity = klass && position ? `${klass} ${position}` : klass || position || '';
      const loc = profile.sailing_location?.trim();
      return [identity, loc].filter(Boolean).join(' · ') || fallbackSub;
    }
    return fallbackSub;
  }, [profile, fallbackSub]);

  // Meta row pellets — club + seasons. Mirrors the canonical "YC Argentino · 12 seasons".
  const heroMeta = useMemo(() => {
    const items: { icon: any; text: string }[] = [];
    if (profile?.sailing_club) {
      items.push({ icon: 'location-outline', text: profile.sailing_club });
    }
    if (profile?.seasons_active) {
      const n = profile.seasons_active;
      items.push({ icon: 'calendar-outline', text: `${n} season${n === 1 ? '' : 's'}` });
    }
    return items;
  }, [profile?.sailing_club, profile?.seasons_active]);

  const initials = fallbackInitials || initialsForName(displayName);

  return (
    <SafeAreaView style={styles.ground} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <WebDetailContainer>
        <IOSDetailNavBar
          backLabel={backLabel}
          contextLabel="Person"
          dockedName={displayName}
          docked={docked && !isFollowing && !isSelf}
          trailingAction={
            docked && !isFollowing && !isSelf
              ? { label: 'Follow', icon: 'add', onPress: handleFollow }
              : undefined
          }
          onBack={onBack}
        />
      </WebDetailContainer>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <WebDetailContainer>
        <IOSDetailHero
          markShape="circle"
          markText={initials}
          markImageUrl={profile?.avatar_url ?? undefined}
          markColor={pickAvatarMarkColor(userId || displayName)}
          name={displayName}
          descriptor={descriptor || undefined}
          meta={heroMeta}
        >
          {isSelf ? (
            <RelationshipMinePill
              label="This is you · Edit profile"
              onPress={() => router.push('/settings/edit-profile' as any)}
            />
          ) : isFollowing ? (
            <RelationshipMinePill
              label="Following"
              onPress={() =>
                showConfirm(
                  `Unfollow ${displayName}?`,
                  'You can follow them again anytime.',
                  handleFollow,
                  { destructive: true, confirmText: 'Unfollow' },
                )
              }
            />
          ) : (
            <RelationshipButton
              label={followBusy ? 'Following...' : 'Follow'}
              icon="add"
              loading={followBusy}
              onPress={handleFollow}
            />
          )}
        </IOSDetailHero>

        {/* v3 screen-designs Phase C — dual CTA row: Suggest a step + Reflect.
            Sits below the hero, above the first content section. Gated by
            SUGGEST_VERB_V3. The Reflect path is a stub for v1 (peer
            reflections schema lands in a follow-up). */}
        {FEATURE_FLAGS.SUGGEST_VERB_V3 && !isSelf ? (
          <View style={dualCtaStyles.row}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Suggest a step"
              onPress={() => setComposerOpen(true)}
              style={dualCtaStyles.primary}
              activeOpacity={0.7}
            >
              <Ionicons name="bulb-outline" size={15} color="#FFFFFF" />
              <Text style={dualCtaStyles.primaryText}>Suggest a step</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Reflect"
              onPress={() => showAlert('Reflect', 'Peer reflections are coming soon.')}
              style={dualCtaStyles.secondary}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-outline" size={15} color={IOS_REGISTER.label} />
              <Text style={dualCtaStyles.secondaryText}>Reflect</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Working on now — the practice signal that travels.
            Coral-tinted card, italic serif body. The ONE place coral
            appears on a Person detail. If no current concept, section absent.
            Pass 11: provenance line under the quote ("captured at last
            debrief, three weeks ago") matches Component-2 grammar exactly. */}
        {profile?.bio ? (
          <IOSDetailSection header="Working on now" bare>
            <ConceptCard
              text={profile.bio}
              provenance={derivedProvenance(profile.updated_at)}
              link={{
                label: 'View public face',
                onPress: () => router.push(`/profile/${userId}` as any),
              }}
            />
          </IOSDetailSection>
        ) : null}

        {/* Recent trajectory — the person's settled/completed steps the
            viewer is allowed to see (RLS + visibility filter). Absent when
            there's nothing visible. */}
        {trajectory.length > 0 ? (
          <IOSDetailSection header="Recent trajectory">
            {trajectory.map((item, i) => (
              <TrophyRow
                key={item.stepId}
                title={
                  item.settled ? (
                    <Text>
                      {item.title} · <Text style={styles.italic}>settled</Text>
                    </Text>
                  ) : (
                    item.title
                  )
                }
                when={formatPersonWhen(item.whenISO)}
                isFirst={i === 0}
              />
            ))}
          </IOSDetailSection>
        ) : null}

        {/* In common — orgs where viewer and person are both active members.
            Never shown on your own profile. */}
        {!isSelf && inCommonOrgs.length > 0 ? (
          <IOSDetailSection header="In common">
            {inCommonOrgs.map((org, i) => (
              <InCommonRow
                key={org.orgId}
                icon="business-outline"
                onPress={
                  org.slug
                    ? () =>
                        router.push(`/discover/org/${org.slug}?from=people` as any)
                    : undefined
                }
                isFirst={i === 0}
              >
                You&apos;re both members of <Text style={styles.italic}>{org.name}</Text>.
              </InCommonRow>
            ))}
          </IOSDetailSection>
        ) : null}

        {/* Public threads — top-level discussion posts the person wrote on
            public steps. Absent when they haven't published. */}
        {publicThreads.length > 0 ? (
          <IOSDetailSection header="Public threads">
            {publicThreads.map((thread, i) => (
              <DRow
                key={thread.postId}
                icon="chatbubble-outline"
                title={`“${thread.snippet}”`}
                sub={`On ${thread.stepTitle}`}
                metaWhen={formatPersonWhen(thread.whenISO)}
                onPress={() =>
                  router.push(`/practice/step/${thread.stepId}/discussion` as any)
                }
                isFirst={i === 0}
              />
            ))}
          </IOSDetailSection>
        ) : null}

        <View style={styles.bottomPad} />
        </WebDetailContainer>
      </ScrollView>

      {FEATURE_FLAGS.SUGGEST_VERB_V3 && !isSelf ? (
        <SuggestStepComposer
          visible={composerOpen}
          onClose={() => setComposerOpen(false)}
          recipientId={userId || ''}
          recipientName={displayName}
          recipientInitials={initials}
          reContext={profile?.bio?.split(/[.!?]/)[0]?.trim() || null}
        />
      ) : null}
    </SafeAreaView>
  );
}

const dualCtaStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  primary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: IOS_REGISTER.label,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  secondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: IOS_REGISTER.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOS_REGISTER.separatorStrong,
  },
  secondaryText: {
    color: IOS_REGISTER.label,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});

/**
 * Pass 11 provenance line for the Working-on-now ConceptCard.
 * Derives "captured at last debrief, N ago" from the profile's updated_at.
 * Returns undefined when the timestamp is missing or too fresh (< 1 day) to
 * avoid claiming provenance the user hasn't earned. Brand-new profiles
 * without a debrief loop yet should render the quote without the tag.
 */
function derivedProvenance(updatedAt: string | null | undefined): string | undefined {
  if (!updatedAt) return undefined;
  let then: number;
  try {
    then = new Date(updatedAt).getTime();
  } catch {
    return undefined;
  }
  if (!Number.isFinite(then)) return undefined;
  const diffMs = Math.max(0, Date.now() - then);
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < day) return undefined;
  const days = Math.floor(diffMs / day);
  if (days < 7) return `captured at last debrief, ${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `captured at last debrief, ${weeks} week${weeks === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `captured at last debrief, ${months} month${months === 1 ? '' : 's'} ago`;
  const years = Math.floor(days / 365);
  return `captured at last debrief, ${years} year${years === 1 ? '' : 's'} ago`;
}

const styles = StyleSheet.create({
  ground: { flex: 1, backgroundColor: IOS_DETAIL_GROUND_BG },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  bottomPad: { height: 120 },
  italic: { fontStyle: 'italic', fontWeight: '500' },
});
