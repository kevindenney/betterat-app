/**
 * Discover tab — six-segment landing.
 *
 * All · Today · Interests · Orgs · People · Plans.
 *
 * Each non-All segment defers to a focused content component built in
 * the Pass 11 work; this shell owns only the toolbar, segmented pill,
 * and the cross-segment state (added interests + followed people) that
 * the children write back to.
 *
 * Orgs segment renders organizations and affinity_groups at the same
 * level (per the user's "a student group is a kind of org" model —
 * JHU, JHSON, and a JHU nursing students group all sit beside each
 * other in the same list).
 *
 * Plans = published blueprints. The DB tables and code identifiers
 * still say `blueprints`; copy uses "Plans" because that's how the
 * user talks about them.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabScreenToolbar } from '@/components/ui/TabScreenToolbar';
import { LocationAnchor } from '@/components/ui/LocationAnchor';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/navigation/FloatingTabBar';
import { IOSSegmentedControl } from '@/components/ui/ios/IOSSegmentedControl';
import { useUserHomeVenue } from '@/hooks/useUserHomeVenue';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { DiscoverTodayContent } from '@/components/discover/DiscoverTodayContent';
import { DiscoverInterestsContent } from '@/components/discover/DiscoverInterestsContent';
import { DiscoverOrgsContent } from '@/components/discover/DiscoverOrgsContent';
import { DiscoverPeopleContent } from '@/components/discover/DiscoverPeopleContent';
import { DiscoverNearbyContent } from '@/components/discover/DiscoverNearbyContent';
import { useInterest } from '@/providers/InterestProvider';
import { useSubscribedBlueprints } from '@/hooks/useBlueprint';

type DiscoverSegment =
  | 'all'
  | 'today'
  | 'nearby'
  | 'interests'
  | 'orgs'
  | 'people'
  | 'plans';

const VALID_SEGMENTS: DiscoverSegment[] = [
  'all',
  'today',
  'nearby',
  'interests',
  'orgs',
  'people',
  'plans',
];

const SEGMENTS: { value: DiscoverSegment; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'nearby', label: 'Nearby' },
  { value: 'interests', label: 'Interests' },
  { value: 'orgs', label: 'Orgs' },
  { value: 'people', label: 'People' },
  { value: 'plans', label: 'Plans' },
];

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const homeVenue = useUserHomeVenue();
  const params = useLocalSearchParams<{ segment?: string; category?: string }>();
  const [toolbarHeight, setToolbarHeight] = useState(0);

  // Legacy ?category=… deep links from earlier Discover surfaces map
  // onto the new segment ids so existing links keep working.
  const initialFromLegacy = useMemo<DiscoverSegment | null>(() => {
    const raw = Array.isArray(params.category) ? params.category[0] : params.category;
    if (!raw) return null;
    if (raw === 'organizations') return 'orgs';
    if (raw === 'blueprints') return 'plans';
    if ((VALID_SEGMENTS as string[]).includes(raw)) return raw as DiscoverSegment;
    return null;
  }, [params.category]);

  const initialSegment: DiscoverSegment = useMemo(() => {
    const raw = Array.isArray(params.segment) ? params.segment[0] : params.segment;
    if (raw && (VALID_SEGMENTS as string[]).includes(raw)) {
      return raw as DiscoverSegment;
    }
    return initialFromLegacy ?? 'all';
  }, [params.segment, initialFromLegacy]);

  const [segment, setSegment] = useState<DiscoverSegment>(initialSegment);
  useEffect(() => {
    setSegment(initialSegment);
  }, [initialSegment]);

  const handleSegmentChange = useCallback((next: DiscoverSegment) => {
    setSegment(next);
    router.setParams({
      segment: next === 'all' ? '' : next,
      category: '',
    });
  }, []);

  // Cross-segment state — children read + write so the Add/Follow chips
  // stay sticky as the user pivots between Interests and People.
  const [addedInterestSlugs, setAddedInterestSlugs] = useState<Set<string>>(new Set());
  const onAddInterest = useCallback((slug: string) => {
    setAddedInterestSlugs((prev) => {
      const next = new Set(prev);
      next.add(slug);
      return next;
    });
  }, []);

  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const onToggleFollow = useCallback((id: string) => {
    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Children that own their own ScrollView read `toolbarOffset` so the
  // first card clears the floating chrome. All segment renders inside
  // the shell's ScrollView; the others render full-bleed.
  const toolbarOffset = toolbarHeight;

  return (
    <View style={styles.container}>
      {segment === 'all' ? (
        <ScrollView
          style={styles.body}
          contentContainerStyle={{
            paddingTop: toolbarHeight + IOS_SPACING.md,
            paddingBottom: FLOATING_TAB_BAR_HEIGHT + insets.bottom + 24,
          }}
        >
          <SegmentBar segment={segment} onSegmentChange={handleSegmentChange} />
          <DiscoverAll
            onJumpToSegment={handleSegmentChange}
            addedInterestCount={addedInterestSlugs.size}
            followedCount={followedIds.size}
          />
        </ScrollView>
      ) : (
        <SegmentContent
          segment={segment}
          toolbarOffset={toolbarOffset + 48}
          onSegmentChange={handleSegmentChange}
          addedInterestSlugs={addedInterestSlugs}
          onAddInterest={onAddInterest}
          followedIds={followedIds}
          onToggleFollow={onToggleFollow}
          homeVenueLat={homeVenue?.lat ?? null}
          homeVenueLng={homeVenue?.lng ?? null}
          homeVenueLabel={homeVenue?.venue ?? homeVenue?.region ?? null}
        />
      )}

      <TabScreenToolbar
        subtitleContent={
          homeVenue ? (
            <LocationAnchor region={homeVenue.region} venue={homeVenue.venue} />
          ) : undefined
        }
        topInset={insets.top}
        backgroundColor="rgba(242, 242, 247, 0.94)"
        onMeasuredHeight={setToolbarHeight}
        actions={[
          {
            icon: 'search-outline',
            sfSymbol: 'magnifyingglass',
            label: 'Search Discover',
            onPress: () => router.push('/search?context=discover' as never),
          },
        ]}
      />

      {/* When a non-All segment owns its own scroll, the segment bar
          sits as a floating pill below the toolbar so the user can
          pivot without losing scroll position inside the content. */}
      {segment !== 'all' ? (
        <View
          style={[styles.floatingSegmentBar, { top: toolbarHeight + 4 }]}
          pointerEvents="box-none"
        >
          <SegmentBar segment={segment} onSegmentChange={handleSegmentChange} />
        </View>
      ) : null}
    </View>
  );
}

function SegmentBar({
  segment,
  onSegmentChange,
}: {
  segment: DiscoverSegment;
  onSegmentChange: (next: DiscoverSegment) => void;
}) {
  return (
    <View style={styles.segmentBarWrap}>
      <IOSSegmentedControl
        segments={SEGMENTS}
        selectedValue={segment}
        onValueChange={(v) => onSegmentChange(v as DiscoverSegment)}
      />
    </View>
  );
}

function SegmentContent({
  segment,
  toolbarOffset,
  onSegmentChange,
  addedInterestSlugs,
  onAddInterest,
  followedIds,
  onToggleFollow,
  homeVenueLat,
  homeVenueLng,
  homeVenueLabel,
}: {
  segment: DiscoverSegment;
  toolbarOffset: number;
  onSegmentChange: (next: DiscoverSegment) => void;
  addedInterestSlugs: Set<string>;
  onAddInterest: (slug: string) => void;
  followedIds: Set<string>;
  onToggleFollow: (id: string) => void;
  homeVenueLat: number | null;
  homeVenueLng: number | null;
  homeVenueLabel: string | null;
}) {
  if (segment === 'today') {
    return <DiscoverTodayContent toolbarOffset={toolbarOffset} />;
  }
  if (segment === 'nearby') {
    return (
      <DiscoverNearbyContent
        toolbarOffset={toolbarOffset}
        homeVenueLat={homeVenueLat}
        homeVenueLng={homeVenueLng}
        homeVenueLabel={homeVenueLabel}
      />
    );
  }
  if (segment === 'interests') {
    return (
      <DiscoverInterestsContent
        toolbarOffset={toolbarOffset}
        addedInterestSlugs={addedInterestSlugs}
        onAddInterest={onAddInterest}
      />
    );
  }
  if (segment === 'orgs') {
    return <DiscoverOrgsContent toolbarOffset={toolbarOffset} />;
  }
  if (segment === 'people') {
    return (
      <DiscoverPeopleContent
        toolbarOffset={toolbarOffset}
        followedIds={followedIds}
        onToggleFollow={onToggleFollow}
      />
    );
  }
  if (segment === 'plans') {
    return (
      <PlansPlaceholder
        toolbarOffset={toolbarOffset}
        onJumpToSegment={onSegmentChange}
      />
    );
  }
  return null;
}

/**
 * Stitched "All" view — terse preview of each segment with jump
 * affordances. Acts as a default landing that orients a brand-new
 * user without forcing a category pick first.
 */
function DiscoverAll({
  onJumpToSegment,
  addedInterestCount,
  followedCount,
}: {
  onJumpToSegment: (segment: DiscoverSegment) => void;
  addedInterestCount: number;
  followedCount: number;
}) {
  const cards: {
    segment: DiscoverSegment;
    title: string;
    body: string;
    icon: keyof typeof Ionicons.glyphMap;
    badge?: string;
  }[] = [
    {
      segment: 'today',
      title: 'Today',
      body: 'A curated front door — what is happening at your home org, this week\'s pick, and a few suggestions tuned to your current interest.',
      icon: 'sparkles-outline',
    },
    {
      segment: 'interests',
      title: 'Interests',
      body: 'Browse craft and discipline interests. Add the ones you are working on.',
      icon: 'compass-outline',
      badge: addedInterestCount > 0 ? `${addedInterestCount} added` : undefined,
    },
    {
      segment: 'orgs',
      title: 'Orgs',
      body: 'Schools, clubs, programs, and groups — Johns Hopkins, JHSON, the JHU nursing student groups all sit at the same level. Join the ones that shape your practice.',
      icon: 'business-outline',
    },
    {
      segment: 'people',
      title: 'People',
      body: 'Coaches, peers, mentors. Follow the ones you want to learn from.',
      icon: 'people-outline',
      badge: followedCount > 0 ? `${followedCount} followed` : undefined,
    },
    {
      segment: 'plans',
      title: 'Plans',
      body: 'Published plans you can subscribe to and pull into your timeline. (Plans = blueprints in the DB; the UI uses "plan" because that\'s how you talk about them.)',
      icon: 'reader-outline',
    },
  ];

  return (
    <View style={styles.allWrap}>
      <View style={styles.allHero}>
        <Text style={styles.allEyebrow}>Discover</Text>
        <Text style={styles.allTitle}>Before it is yours</Text>
        <Text style={styles.allCopy}>
          Find interests, orgs, people, and plans you do not yet practice with.
          Pick a tab to drill in, or browse here.
        </Text>
      </View>

      <View style={styles.allCardStack}>
        {cards.map((c) => (
          <Pressable
            key={c.segment}
            style={styles.allCard}
            onPress={() => onJumpToSegment(c.segment)}
          >
            <View style={styles.allCardHead}>
              <View style={styles.allCardIcon}>
                <Ionicons name={c.icon} size={18} color={IOS_COLORS.systemBlue} />
              </View>
              <Text style={styles.allCardTitle}>{c.title}</Text>
              {c.badge ? (
                <View style={styles.allCardBadge}>
                  <Text style={styles.allCardBadgeText}>{c.badge}</Text>
                </View>
              ) : null}
              <Ionicons
                name="chevron-forward"
                size={16}
                color={IOS_COLORS.tertiaryLabel}
              />
            </View>
            <Text style={styles.allCardBody}>{c.body}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function PlansPlaceholder({
  toolbarOffset,
  onJumpToSegment,
}: {
  toolbarOffset: number;
  onJumpToSegment: (segment: DiscoverSegment) => void;
}) {
  // Surface the user's subscribed blueprints right here so Discover →
  // Plans isn't a dead-end shell. The full catalog browser (published
  // blueprints with subscribe) lands later; for now this is the
  // shortest path between "I have a subscribed plan" and "I can tap it
  // and see what's inside it."
  const { currentInterest } = useInterest();
  const { data: blueprints = [] } = useSubscribedBlueprints(currentInterest?.id);

  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={{
        paddingTop: toolbarOffset + IOS_SPACING.md,
        paddingBottom: FLOATING_TAB_BAR_HEIGHT + 80,
        paddingHorizontal: IOS_SPACING.lg,
        gap: 12,
      }}
    >
      {blueprints.length > 0 ? (
        <View style={styles.subscribedSection}>
          <Text style={styles.subscribedHeader}>Your subscribed Blueprints</Text>
          {blueprints.map((bp) => (
            <Pressable
              key={bp.blueprint_id}
              style={styles.subscribedCard}
              onPress={() =>
                router.push(`/(tabs)/library/blueprints/${bp.blueprint_id}` as never)
              }
            >
              <Text style={styles.subscribedCardTitle} numberOfLines={2}>
                {bp.blueprint_title}
              </Text>
              <Text style={styles.subscribedCardMeta} numberOfLines={1}>
                {bp.author_name ?? 'Author'} · subscribed{' '}
                {new Date(bp.subscribed_at).toLocaleDateString()}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.placeholderCard}>
        <Ionicons name="reader-outline" size={26} color={IOS_COLORS.systemBlue} />
        <Text style={styles.placeholderTitle}>Blueprints</Text>
        <Text style={styles.placeholderBody}>
          Published Blueprints you can subscribe to. The dedicated catalog
          browser lands next — for now, the Library Blueprints surface lists
          everything you have already adopted, and the Studio is where authors
          publish new ones.
        </Text>
        <View style={styles.placeholderRow}>
          <Pressable
            style={[styles.placeholderAction, styles.placeholderActionPrimary]}
            onPress={() => router.push('/(tabs)/library/blueprints' as never)}
          >
            <Text style={styles.placeholderActionPrimaryText}>
              All your Blueprints
            </Text>
          </Pressable>
          <Pressable
            style={styles.placeholderAction}
            onPress={() => onJumpToSegment('orgs')}
          >
            <Text style={styles.placeholderActionText}>
              Orgs that publish Blueprints
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

// Silence unused-import warnings if the underlying components stop
// using these types in a future signature change.
void ([] as NativeSyntheticEvent<NativeScrollEvent>[]);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  body: {
    flex: 1,
  },
  segmentBarWrap: {
    paddingHorizontal: IOS_SPACING.lg,
    marginBottom: IOS_SPACING.md,
  },
  floatingSegmentBar: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  allWrap: {
    paddingHorizontal: IOS_SPACING.lg,
    gap: IOS_SPACING.md,
  },
  allHero: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    gap: 6,
  },
  allEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: IOS_COLORS.systemBlue,
  },
  allTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    color: IOS_COLORS.label,
  },
  allCopy: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
  },
  allCardStack: {
    gap: 10,
  },
  allCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    gap: 8,
  },
  allCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  allCardIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
  },
  allCardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  allCardBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#DCEAFE',
  },
  allCardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.systemBlue,
  },
  allCardBody: {
    fontSize: 13,
    lineHeight: 18,
    color: IOS_COLORS.secondaryLabel,
  },
  placeholderCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    gap: 10,
  },
  placeholderTitle: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    color: IOS_COLORS.label,
  },
  placeholderBody: {
    fontSize: 14,
    lineHeight: 20,
    color: IOS_COLORS.secondaryLabel,
  },
  placeholderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  placeholderAction: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  placeholderActionPrimary: {
    backgroundColor: IOS_COLORS.systemBlue,
  },
  placeholderActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  placeholderActionPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subscribedSection: {
    gap: 8,
  },
  subscribedHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  subscribedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60,60,67,0.12)',
    padding: 14,
    gap: 4,
  },
  subscribedCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  subscribedCardMeta: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
  },
});
