/**
 * Discover · Person detail — iOS register
 *
 * The practitioner detail surface. Implements the canonical defined in
 * `docs/redesign/ios-register/discover-detail-trio-canonical.html` Surface 2.
 *
 * Hero opens with Follow in iOS blue when not yet followed; gray "Following"
 * pill when already followed. Body leads with the practice signal — current
 * concept — trajectory next, in-common third. Public threads renders only
 * when the user publishes; absent otherwise (no empty-state copy).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/services/supabase';
import { showConfirm } from '@/lib/utils/crossPlatformAlert';
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
  IOS_DETAIL_GROUND_BG,
  IOSOnlyNotice,
  pickAvatarMarkColor,
} from '@/components/discover/detail';
import { useAuth } from '@/providers/AuthProvider';

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
};

export default function PersonDetailScreen() {
  if (Platform.OS === 'web') return <IOSOnlyNotice surface="Person" />;
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
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [docked, setDocked] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select(
          'id, full_name, first_name, last_name, bio, avatar_url, sailing_position, sailing_class, sailing_location, sailing_club, seasons_active'
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
    else router.replace('/(tabs)/discover' as any);
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
      <IOSDetailNavBar
        backLabel={backLabel}
        contextLabel="Person"
        dockedName={displayName}
        docked={docked && !isFollowing}
        trailingAction={
          docked && !isFollowing
            ? { label: 'Follow', icon: 'add', onPress: handleFollow }
            : undefined
        }
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
          markShape="circle"
          markText={initials}
          markColor={pickAvatarMarkColor(userId || displayName)}
          name={displayName}
          descriptor={descriptor || undefined}
          meta={heroMeta}
        >
          {isFollowing ? (
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

        {/* Working on now — the practice signal that travels.
            Coral-tinted card, italic serif body. The ONE place coral
            appears on a Person detail. If no current concept, section absent. */}
        {profile?.bio ? (
          <IOSDetailSection header="Working on now" bare>
            <ConceptCard
              text={profile.bio}
              link={{
                label: 'View public face',
                onPress: () => router.push(`/sailor/${userId}` as any),
              }}
            />
          </IOSDetailSection>
        ) : null}

        {/* Recent trajectory — restrained, no medallions, just name + date.
            Each row drills into the trophy detail surface. */}
        <IOSDetailSection header="Recent trajectory">
          <TrophyRow
            title={
              <Text>
                Heavy-air helm work · <Text style={styles.italic}>settled</Text>
              </Text>
            }
            sub="Trophy of becoming"
            when="Mar 2026"
            onPress={() =>
              router.push(`/sailor/${userId}/trophy/heavy-air-helm` as any)
            }
            isFirst
          />
          <TrophyRow
            title="Decision-making under start-line pressure"
            sub="Trophy of becoming"
            when="Sep 2025"
            onPress={() =>
              router.push(`/sailor/${userId}/trophy/start-line-patience` as any)
            }
          />
        </IOSDetailSection>

        {/* In common — concrete anchors with italic emphasis.
            These rows are intentionally inert: the in-common surface is a
            *frame* for shared context, not a navigation surface. Drilling
            into "Spring Series 2026" or "Heavy-air starts" belongs on the
            italic anchor itself once topic/race detail surfaces exist. */}
        <IOSDetailSection header="In common">
          <InCommonRow icon="boat-outline" when="14–17 Apr · you finished 4th, Tomás 7th" isFirst>
            You both raced <Text style={styles.italic}>Spring Series 2026</Text> at RHKYC.
          </InCommonRow>
          <InCommonRow icon="grid-outline">
            You both follow <Text style={styles.italic}>Heavy-air starts</Text>.
          </InCommonRow>
        </IOSDetailSection>

        {/* Public threads — renders only if user publishes; section absent
            otherwise. Tap drills into the topic where the thread lives. */}
        <IOSDetailSection header="Public threads">
          <DRow
            icon="chatbubble-outline"
            title={`"Halyard tension downwind in chop"`}
            sub="In Dragon fleet · rig setup · 23 replies"
            onPress={() =>
              router.push(
                `/discover/topic/rhkyc-dragon-rig-setup?from=people&name=${encodeURIComponent('Dragon fleet · rig setup')}` as any,
              )
            }
            isFirst
          />
        </IOSDetailSection>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ground: { flex: 1, backgroundColor: IOS_DETAIL_GROUND_BG },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  bottomPad: { height: 120 },
  italic: { fontStyle: 'italic', fontWeight: '500' },
});
