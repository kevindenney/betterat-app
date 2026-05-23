/**
 * Discover Tab — the canonical Discover trio
 *
 * Three sibling surfaces, one shared chrome — per
 * `docs/redesign/ios-register/discover-trio-canonical.html`:
 *
 *   - Orgs    — institution as the unit
 *   - People  — practitioner as the unit; current concept travels at a glance
 *   - Forums  — topic as the unit; ongoing spaces, not single threads
 *
 * The segmented control is the only switcher. Scroll position is preserved
 * per segment. Follow / join state is lifted here so it survives switches.
 * Works for authenticated and unauthenticated users (auth gate on actions).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';

import { DiscoverOrgsContent } from '@/components/discover/DiscoverOrgsContent';
import { DiscoverPeopleContent } from '@/components/discover/DiscoverPeopleContent';
import { DiscussContent } from '@/components/connect/DiscussContent';
import { IOSSegmentedControl } from '@/components/ui/ios/IOSSegmentedControl';
import { TabScreenToolbar } from '@/components/ui/TabScreenToolbar';
import { useScrollToolbarHide } from '@/hooks/useScrollToolbarHide';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { useUniversalPlus } from '@/components/capture';

// =============================================================================
// TYPES & CONSTANTS
// =============================================================================

type DiscoverSegment = 'organizations' | 'people' | 'forums';

const DISCOVER_SEGMENTS = [
  { value: 'organizations' as const, label: 'Orgs' },
  { value: 'people' as const, label: 'People' },
  { value: 'forums' as const, label: 'Forums' },
];

const VALID_SEGMENTS: DiscoverSegment[] = ['organizations', 'people', 'forums'];

// Legacy alias from the four-segment shape — deep links with ?segment=interests
// fall through to the canonical default rather than 404.
const LEGACY_SEGMENT_ALIASES: Record<string, DiscoverSegment> = {
  orgs: 'organizations',
  interests: 'organizations',
};

const STORAGE_KEY = 'regattaflow_discover_segment';
const FOLLOWED_IDS_KEY = 'regattaflow_connect_followed_ids';
const JOINED_IDS_KEY = 'regattaflow_connect_joined_ids';

function resolveSegmentParam(raw: string | string[] | undefined): DiscoverSegment | null {
  if (typeof raw !== 'string') return null;
  if (VALID_SEGMENTS.includes(raw as DiscoverSegment)) return raw as DiscoverSegment;
  return LEGACY_SEGMENT_ALIASES[raw] ?? null;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function DiscoverTab() {
  const universalPlus = useUniversalPlus();
  const params = useLocalSearchParams<{ segment?: string }>();
  const insets = useSafeAreaInsets();
  const [toolbarHeight, setToolbarHeight] = useState(0);
  const { toolbarHidden, handleScroll } = useScrollToolbarHide();
  const [activeSegment, setActiveSegment] = useState<DiscoverSegment>('organizations');

  // Shared follow/join state (lifted so it survives segment switches)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());

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

  const routeSegment = resolveSegmentParam(params.segment);

  // Load persisted state on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      const resolved = resolveSegmentParam(stored ?? undefined);
      if (resolved) setActiveSegment(resolved);
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
  }, []);

  // Allow deep links to force a starting segment
  useEffect(() => {
    if (routeSegment) {
      setActiveSegment(routeSegment);
      AsyncStorage.setItem(STORAGE_KEY, routeSegment).catch(() => {});
    }
  }, [routeSegment]);

  const handleSegmentChange = (segment: DiscoverSegment) => {
    setActiveSegment(segment);
    AsyncStorage.setItem(STORAGE_KEY, segment).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={[styles.statusBarBackground, { height: insets.top }]} />

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
          ...(universalPlus.isAvailable
            ? [
                {
                  icon: 'add-outline',
                  sfSymbol: 'plus',
                  label: 'Add',
                  onPress: () => universalPlus.open(),
                },
              ]
            : []),
          {
            icon: 'sparkles-outline',
            sfSymbol: 'wand.and.stars',
            label: 'Preview Discover Pass 11 iOS register',
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
