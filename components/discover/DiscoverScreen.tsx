/**
 * DiscoverScreen Component
 *
 * TikTok-style full-screen vertical swipe feed of sailor race journeys.
 * Each race card fills the entire viewport. Swipe up/down to navigate.
 *
 * Features:
 * - Full-screen race cards with rich content
 * - Snap-to-card scrolling
 * - Pull to refresh
 * - Infinite scroll pagination
 * - Navigate to full journey detail
 * - Copy race setup as template
 */

import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, ActionSheetIOS, Platform } from 'react-native';
import { showAlertWithButtons } from '@/lib/utils/crossPlatformAlert';
import { useRouter } from 'expo-router';
import { useDiscoveryFeed, FeedItem } from '@/hooks/useDiscoveryFeed';
import { VerticalRacePager } from './VerticalRacePager';
import { TUFTE_BACKGROUND } from '@/components/cards';
import type { FullScreenRaceCardData } from './FullScreenRaceCard';
import type { PublicRacePreview } from '@/services/CrewFinderService';

/**
 * Transform feed items to full-screen card data
 */
function transformToFullScreenData(feedItems: FeedItem[]): FullScreenRaceCardData[] {
  return feedItems
    .filter((item): item is FeedItem & { data: PublicRacePreview } =>
      item.type === 'race_card' && item.data !== undefined
    )
    .map((item) => ({
      id: item.data.id,
      name: item.data.name,
      startDate: item.data.startDate,
      venue: item.data.venue,
      userId: item.data.userId,
      userName: item.data.userName,
      avatarEmoji: item.data.avatarEmoji,
      avatarColor: item.data.avatarColor,
      boatClass: item.data.boatClass,
      hasPrepNotes: item.data.hasPrepNotes,
      hasTuning: item.data.hasTuning,
      hasPostRaceNotes: item.data.hasPostRaceNotes,
      hasLessons: item.data.hasLessons,
      isPast: item.data.isPast,
      daysUntil: item.data.daysUntil,
      isFollowing: item.data.isFollowing,
    }));
}

export function DiscoverScreen() {
  const router = useRouter();

  // Discovery feed hook
  const {
    feedItems,
    hasMore,
    loadMore,
    refresh,
    toggleFollow,
    isLoading,
    isLoadingMore,
  } = useDiscoveryFeed();

  // Transform feed items to full-screen card format
  const races = useMemo(
    () => transformToFullScreenData(feedItems),
    [feedItems]
  );

  // Handle viewing full journey - navigate to journey screen
  const handleViewJourney = useCallback((sailorId: string, raceId: string) => {
    router.push(`/sailor-journey/${sailorId}/${raceId}` as any);
  }, [router]);

  // Handle use template action
  const handleUseTemplate = useCallback((sailorId: string, raceId: string) => {
    const showTemplateOptions = () => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['Cancel', 'Copy to New Race', 'Copy to Existing Race'],
            cancelButtonIndex: 0,
            title: 'Use as Template',
            message: 'Copy this sailor\'s race preparation to your own race',
          },
          (buttonIndex) => {
            if (buttonIndex === 1) {
              // Copy to new race
              router.push({
                pathname: '/(tabs)/practice',
                params: {
                  templateSailorId: sailorId,
                  templateRaceId: raceId,
                  action: 'new',
                },
              });
            } else if (buttonIndex === 2) {
              // Copy to existing race
              router.push({
                pathname: '/(tabs)/practice',
                params: {
                  templateSailorId: sailorId,
                  templateRaceId: raceId,
                  action: 'existing',
                },
              });
            }
          }
        );
      } else {
        // Android/Web fallback
        showAlertWithButtons(
          'Use as Template',
          'Copy this sailor\'s race preparation to your own race',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Copy to New Race',
              onPress: () => {
                router.push({
                  pathname: '/(tabs)/practice',
                  params: {
                    templateSailorId: sailorId,
                    templateRaceId: raceId,
                    action: 'new',
                  },
                });
              },
            },
            {
              text: 'Copy to Existing Race',
              onPress: () => {
                router.push({
                  pathname: '/(tabs)/practice',
                  params: {
                    templateSailorId: sailorId,
                    templateRaceId: raceId,
                    action: 'existing',
                  },
                });
              },
            },
          ]
        );
      }
    };

    showTemplateOptions();
  }, [router]);

  // Handle toggle follow
  const handleToggleFollow = useCallback(async (userId: string) => {
    await toggleFollow(userId);
  }, [toggleFollow]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  // Handle load more
  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  return (
    <View style={styles.container}>
      <VerticalRacePager
        races={races}
        onViewJourney={handleViewJourney}
        onUseTemplate={handleUseTemplate}
        onToggleFollow={handleToggleFollow}
        onRefresh={handleRefresh}
        onLoadMore={handleLoadMore}
        isLoading={isLoading}
        isRefreshing={isLoading && races.length > 0}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TUFTE_BACKGROUND,
  },
});

export default DiscoverScreen;
