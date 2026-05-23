/**
 * Discover · Topic detail — iOS register
 *
 * The topic detail surface. Implements the canonical defined in
 * `docs/redesign/ios-register/discover-detail-trio-canonical.html` Surface 3.
 *
 * Subscribe lives in the hero AND docks into the nav once the user scrolls
 * past the hero — same affordance, two sizes, two ends of the bar. Body:
 * pinned slot, recent threads, who's active (loading-aware), related orgs.
 * Demonstrates the per-section loading position: hero solid first, sections
 * fill progressively.
 *
 * Topics are not currently a first-class Supabase entity in this codebase,
 * so this surface renders from the URL slug + mock data; the chrome is the
 * point of this pass. Wiring to a topics/threads schema is a later layer.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  IOSDetailNavBar,
  IOSDetailHero,
  IOSDetailSection,
  RelationshipButton,
  RelationshipMinePill,
  DRow,
  XRow,
  SectionSkeleton,
  IOS_DETAIL_GROUND_BG,
  IOSOnlyNotice,
} from '@/components/discover/detail';

type TopicData = {
  name: string;
  descriptor: string;
  glyph: keyof typeof Ionicons.glyphMap;
  threadCount: number;
  sailorCount: number;
  activeAgo: string;
  hostOrgName?: string;
  hostOrgSlug?: string;
};

// Lightweight slug → topic registry. Replace with Supabase query when topics
// become a first-class entity. Slugs that don't match fall back to a generic
// topic shaped from the slug itself, so deep links still render.
const TOPIC_REGISTRY: Record<string, TopicData> = {
  'downwind-mark-trim': {
    name: 'Downwind mark trim',
    descriptor: 'Dragon class · Boat handling',
    glyph: 'swap-vertical-outline',
    threadCount: 247,
    sailorCount: 184,
    activeAgo: 'Active 1h ago',
    hostOrgName: 'Royal Hong Kong Yacht Club',
    hostOrgSlug: 'rhkyc',
  },
  'wednesday-night-racing': {
    name: 'Wednesday-night racing',
    descriptor: 'All classes · Club series',
    glyph: 'moon-outline',
    threadCount: 312,
    sailorCount: 220,
    activeAgo: 'Active yesterday',
    hostOrgName: 'Royal Hong Kong Yacht Club',
    hostOrgSlug: 'rhkyc',
  },
  'dragon-rig-setup': {
    name: 'Dragon fleet · rig setup',
    descriptor: 'Dragon class · Tuning',
    glyph: 'construct-outline',
    threadCount: 186,
    sailorCount: 94,
    activeAgo: 'Active 4h ago',
    hostOrgName: 'Royal Hong Kong Yacht Club',
    hostOrgSlug: 'rhkyc',
  },
};

function deriveTopicFromSlug(slug: string): TopicData {
  const name = slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    name,
    descriptor: 'Topic',
    glyph: 'chatbubbles-outline',
    threadCount: 0,
    sailorCount: 0,
    activeAgo: 'No activity yet',
  };
}

export default function TopicDetailScreen() {
  if (Platform.OS === 'web') return <IOSOnlyNotice surface="Topic" />;
  return <TopicDetailScreenInner />;
}

function TopicDetailScreenInner() {
  const params = useLocalSearchParams<{ slug?: string; from?: string; name?: string }>();
  const slug = typeof params.slug === 'string' ? params.slug.trim() : '';
  const providedName = typeof params.name === 'string' ? params.name.trim() : '';
  const backLabel = params.from === 'orgs' ? 'Orgs' : params.from === 'people' ? 'People' : 'Forums';

  const topic = useMemo<TopicData>(() => {
    const base = TOPIC_REGISTRY[slug] ?? deriveTopicFromSlug(slug);
    return providedName ? { ...base, name: providedName } : base;
  }, [slug, providedName]);

  const [subscribed, setSubscribed] = useState(false);
  const [docked, setDocked] = useState(false);
  const [activeLoading, setActiveLoading] = useState(true);

  useEffect(() => {
    // Simulated per-section progressive resolve. The "Active this month"
    // section is the slow recommendation compute referenced in the canonical;
    // the rest of the surface is already solid by the time this resolves.
    const timer = setTimeout(() => setActiveLoading(false), 1400);
    return () => clearTimeout(timer);
  }, [slug]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setDocked(e.nativeEvent.contentOffset.y > 120);
  }, []);

  const onBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/discover' as any);
  }, []);

  const handleSubscribe = useCallback(() => {
    setSubscribed((v) => !v);
  }, []);

  return (
    <SafeAreaView style={styles.ground} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <IOSDetailNavBar
        backLabel={backLabel}
        contextLabel="Topic"
        dockedName={topic.name}
        docked={docked && !subscribed}
        trailingAction={
          docked && !subscribed
            ? { label: 'Subscribe', icon: 'add', onPress: handleSubscribe }
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
          markShape="topic"
          markIcon={topic.glyph}
          name={topic.name}
          descriptor={topic.descriptor}
          meta={[
            { icon: 'chatbubbles-outline', text: `${topic.threadCount} threads` },
            { icon: 'people-outline', text: `${topic.sailorCount} sailors` },
            { icon: 'time-outline', text: topic.activeAgo },
          ]}
        >
          {subscribed ? (
            <RelationshipMinePill label="Subscribed" />
          ) : (
            <RelationshipButton label="Subscribe" icon="add" onPress={handleSubscribe} />
          )}
        </IOSDetailHero>

        {/* Pinned — one slot. Topic-author or moderator-curated. */}
        <IOSDetailSection header="Pinned">
          <DRow
            pinned
            icon="bookmark"
            title="Trim numbers for 8–14 kt — first-time intro"
            sub="By Yvonne Leung · updated Apr 2026"
            isFirst
          />
        </IOSDetailSection>

        {/* Recent threads — title, replies, last activity, chevron. */}
        <IOSDetailSection
          header="Recent threads"
          seeAll={{
            label: `All ${topic.threadCount}`,
            onPress: () => router.push(`/discover/topic/${slug}/threads` as any),
          }}
        >
          <DRow
            icon="chatbubble-outline"
            title="When does the boom come in for the bear-away?"
            sub="14 replies"
            metaWhen="22m ago"
            isFirst
          />
          <DRow
            icon="chatbubble-outline"
            title="Backstay on/off through the gate?"
            sub="21 replies"
            metaWhen="4h ago"
          />
          <DRow
            icon="chatbubble-outline"
            title="Felt slow last weekend — chute setup?"
            sub="6 replies"
            metaWhen="yesterday"
          />
          <DRow
            icon="chatbubble-outline"
            title="Light air dec — when to bear away early"
            sub="33 replies"
            metaWhen="2d ago"
          />
        </IOSDetailSection>

        {/* Active this month — demonstrates per-section loading.
            Skeleton fills the body, narration line lives between header and
            skeleton. Hero is solid above; nothing else is held hostage. */}
        <IOSDetailSection
          header="Active this month"
          loadingLine={activeLoading ? 'Finding who’s been here lately.' : undefined}
          seeAll={
            activeLoading
              ? undefined
              : {
                  label: 'See all 12',
                  onPress: () => router.push(`/discover/topic/${slug}/active` as any),
                }
          }
        >
          {activeLoading ? (
            <SectionSkeleton rows={3} />
          ) : (
            <>
              <XRow
                markVariant="circle"
                markText="YL"
                name="Yvonne Leung"
                sub="Dragon helm · 17 seasons"
                tail="Mutual"
                isFirst
                onPress={() =>
                  router.push(`/discover/person/yvonne-leung?from=forums` as any)
                }
              />
              <XRow
                markVariant="circle"
                markText="MT"
                name="Markus Tham"
                sub="Dragon helm · 11 seasons"
                tail="You follow"
                onPress={() =>
                  router.push(`/discover/person/markus-tham?from=forums` as any)
                }
              />
              <XRow
                markVariant="circle"
                markText="TR"
                name="Tomás Renart"
                sub="Dragon helm · Buenos Aires"
                onPress={() =>
                  router.push(`/discover/person/tomas-renart?from=forums` as any)
                }
              />
            </>
          )}
        </IOSDetailSection>

        {/* Hosted by — one row is the common case for a club topic. Definitional,
            not a thinned-out list. If a topic has no host, section is absent. */}
        {topic.hostOrgName ? (
          <IOSDetailSection header="Hosted by">
            <XRow
              markVariant="square"
              markText="RH"
              name={topic.hostOrgName}
              sub="Member club · 2,840 sailors"
              tail="You’re a member"
              isFirst
              onPress={() =>
                topic.hostOrgSlug
                  ? router.push(`/discover/org/${topic.hostOrgSlug}?from=forums` as any)
                  : undefined
              }
            />
          </IOSDetailSection>
        ) : null}

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
});
