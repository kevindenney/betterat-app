/**
 * Discover Tab — Browse interests, organizations, people, and forums
 *
 * Four top-level segments:
 * - Interests (default): Browse and add interests
 * - Organizations: Search and join organizations for current interest
 * - People: Discover peers, manage follows, view activity posts
 * - Forums: Community feed, browse and join communities
 *
 * Follow/join/added state is lifted here so it survives segment switches.
 * Works for both authenticated and unauthenticated users (auth gate on actions).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';

import { DiscoverInterestsContent } from '@/components/discover/DiscoverInterestsContent';
import { DiscoverOrgsContent } from '@/components/discover/DiscoverOrgsContent';
import { DiscoverPeopleContent } from '@/components/discover/DiscoverPeopleContent';
import { DiscussContent } from '@/components/connect/DiscussContent';
import { IOSSegmentedControl } from '@/components/ui/ios/IOSSegmentedControl';
import { TabScreenToolbar } from '@/components/ui/TabScreenToolbar';
import { useScrollToolbarHide } from '@/hooks/useScrollToolbarHide';
import { IOS_COLORS } from '@/lib/design-tokens-ios';

// =============================================================================
// TYPES & CONSTANTS
// =============================================================================

type DiscoverSegment = 'interests' | 'organizations' | 'people' | 'forums';

const DISCOVER_SEGMENTS = [
  { value: 'interests' as const, label: 'Interests' },
  { value: 'organizations' as const, label: 'Orgs' },
  { value: 'people' as const, label: 'People' },
  { value: 'forums' as const, label: 'Forums' },
];

const VALID_SEGMENTS: DiscoverSegment[] = ['interests', 'organizations', 'people', 'forums'];

const STORAGE_KEY = 'regattaflow_discover_segment';
const FOLLOWED_IDS_KEY = 'regattaflow_connect_followed_ids';
const JOINED_IDS_KEY = 'regattaflow_connect_joined_ids';
const ADDED_INTEREST_SLUGS_KEY = 'regattaflow_discover_added_interests';

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function DiscoverTab() {
  const params = useLocalSearchParams<{ segment?: string }>();
  const insets = useSafeAreaInsets();
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const { toolbarHidden, handleScroll } = useScrollToolbarHide();
  const [activeSegment, setActiveSegment] = useState<DiscoverSegment>('interests');

  // Shared follow/join state (lifted so it survives segment switches)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [addedInterestSlugs, setAddedInterestSlugs] = useState<Set<string>>(new Set());

  const toggleFollow = useCallback((id: string) => {
    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      AsyncStorage.setItem(FOLLOWED_IDS_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  const toggleJoin = useCallback((id: string) => {
    setJoinedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      AsyncStorage.setItem(JOINED_IDS_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  const addInterestSlug = useCallback((slug: string) => {
    setAddedInterestSlugs((prev) => {
      const next = new Set(prev);
      next.add(slug);
      AsyncStorage.setItem(ADDED_INTEREST_SLUGS_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  // Parse route segment param
  const routeSegment = VALID_SEGMENTS.includes(params.segment as DiscoverSegment)
    ? (params.segment as DiscoverSegment)
    : null;

  // Load persisted state on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && VALID_SEGMENTS.includes(stored as DiscoverSegment)) {
        setActiveSegment(stored as DiscoverSegment);
      }
    }).catch(() => {});

    AsyncStorage.getItem(FOLLOWED_IDS_KEY).then((stored) => {
      if (stored) {
        try { setFollowedIds(new Set(JSON.parse(stored))); } catch {}
      }
    }).catch(() => {});

    AsyncStorage.getItem(JOINED_IDS_KEY).then((stored) => {
      if (stored) {
        try { setJoinedIds(new Set(JSON.parse(stored))); } catch {}
      }
    }).catch(() => {});

    AsyncStorage.getItem(ADDED_INTEREST_SLUGS_KEY).then((stored) => {
      if (stored) {
        try { setAddedInterestSlugs(new Set(JSON.parse(stored))); } catch {}
      }
    }).catch(() => {});
  }, []);

  // Allow deep links to force a starting segment
  useEffect(() => {
    if (routeSegment) {
      setActiveSegment(routeSegment);
      AsyncStorage.setItem(STORAGE_KEY, routeSegment).catch(() => {});
    }
  }, [routeSegment]);

  // Save segment on change
  const handleSegmentChange = (segment: DiscoverSegment) => {
    setActiveSegment(segment);
    AsyncStorage.setItem(STORAGE_KEY, segment).catch(() => {});
  };

  return (
    <View style={styles.container}>
      {/* Fixed status bar background */}
      <View style={[styles.statusBarBackground, { height: insets.top }]} />

      {/* Content */}
      {activeSegment === 'interests' && (
        <DiscoverInterestsContent
          toolbarOffset={toolbarHeight}
          onScroll={handleScroll}
          addedInterestSlugs={addedInterestSlugs}
          onAddInterest={addInterestSlug}
        />
      )}
      {activeSegment === 'organizations' && (
        <DiscoverOrgsContent
          toolbarOffset={toolbarHeight}
          onScroll={handleScroll}
        />
      )}
      {activeSegment === 'people' && (
        <DiscoverPeopleContent
          toolbarOffset={toolbarHeight}
          onScroll={handleScroll}
          followedIds={followedIds}
          onToggleFollow={toggleFollow}
        />
      )}
      {activeSegment === 'forums' && (
        <DiscussContent
          toolbarOffset={toolbarHeight}
          onScroll={handleScroll}
          joinedIds={joinedIds}
          onToggleJoin={toggleJoin}
        />
      )}

      {/* Toolbar */}
      <TabScreenToolbar
        title="Discover"
        topInset={insets.top}
        actions={[
          {
            icon: 'notifications-outline',
            sfSymbol: 'bell',
            label: 'Notifications',
            onPress: () => router.push('/social-notifications'),
          },
          {
            icon: 'sparkles-outline',
            sfSymbol: 'wand.and.stars',
            label: 'Preview iOS register',
            onPress: () => router.push('/discover-ios' as any),
          },
        ]}
        onMeasuredHeight={setToolbarHeight}
        hidden={toolbarHidden}
        backgroundColor="rgba(242, 242, 247, 0.94)"
      >
        <View style={styles.segmentContainer}>
          <IOSSegmentedControl
            segments={DISCOVER_SEGMENTS}
            selectedValue={activeSegment}
            onValueChange={handleSegmentChange}
          />
        </View>
      </TabScreenToolbar>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  statusBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 99,
    backgroundColor: 'rgba(242, 242, 247, 0.94)',
  },
  segmentContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
});
