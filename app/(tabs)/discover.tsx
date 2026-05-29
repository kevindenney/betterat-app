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
import { useUserHomeVenue } from '@/hooks/useUserHomeVenue';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { DiscoverFeed } from '@/components/discover/DiscoverFeed';
import { DiscoverTodayContent } from '@/components/discover/DiscoverTodayContent';
import { DiscoverInterestsContent } from '@/components/discover/DiscoverInterestsContent';
import { DiscoverOrgsContent } from '@/components/discover/DiscoverOrgsContent';
import { DiscoverPeopleContent } from '@/components/discover/DiscoverPeopleContent';
import { DiscoverNearbyContent } from '@/components/discover/DiscoverNearbyContent';
import { DiscoverPlansContent } from '@/components/discover/DiscoverPlansContent';

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

const SEGMENT_LABELS: Record<DiscoverSegment, string> = {
  all: 'Discover',
  today: 'This week',
  nearby: 'Nearby',
  interests: 'Interests',
  orgs: 'Orgs',
  people: 'People',
  plans: 'Plans',
};

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
        <DiscoverFeed toolbarOffset={toolbarOffset} onSeeAll={handleSegmentChange} />
      ) : (
        <SegmentContent
          segment={segment}
          toolbarOffset={toolbarOffset + 48}
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

      {/* Focused segment views own their own scroll; a lightweight back
          pill sits below the toolbar so the user can return to the feed
          without a segmented control eating the top chrome. */}
      {segment !== 'all' ? (
        <View
          style={[styles.backHeader, { top: toolbarHeight + 4 }]}
          pointerEvents="box-none"
        >
          <Pressable
            style={styles.backPill}
            onPress={() => handleSegmentChange('all')}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={16} color={IOS_COLORS.systemBlue} />
            <Text style={styles.backPillText}>{SEGMENT_LABELS[segment]}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function SegmentContent({
  segment,
  toolbarOffset,
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
    return <DiscoverPlansContent toolbarOffset={toolbarOffset} />;
  }
  return null;
}

// Silence unused-import warnings if the underlying components stop
// using these types in a future signature change.
void ([] as NativeSyntheticEvent<NativeScrollEvent>[]);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  backHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'flex-start',
    paddingHorizontal: 16,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(242, 242, 247, 0.94)',
  },
  backPillText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.systemBlue,
  },
});
