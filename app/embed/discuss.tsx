/**
 * Embeddable Discuss/Community Widget
 * Community feed display for iframe embedding in partner apps (e.g., HKDW)
 *
 * URL: /embed/discuss?community=xxx&theme=light|dark&showBanner=true
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  IOS_COLORS,
  IOS_SPACING,
  IOS_RADIUS,
  IOS_TYPOGRAPHY,
} from '@/lib/design-tokens-ios';
import { FeedPostCard } from '@/components/venue/feed/FeedPostCard';
import { CommunityDetailHeader } from '@/components/community/CommunityDetailHeader';
import { AppDownloadBanner } from '@/components/promo/AppDownloadBanner';
import {
  useCommunityBySlug,
  useJoinCommunity,
  useLeaveCommunity,
} from '@/hooks/useCommunities';
import { useCommunityPostsFeed, communityFeedKeys } from '@/hooks/useCommunityFeed';
import { useQueryClient } from '@tanstack/react-query';
import type { FeedPost } from '@/types/community-feed';

export default function EmbedDiscussWidget() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const communitySlug = params.community as string;
  const theme = (params.theme as string) || 'light';
  const showBanner = params.showBanner !== 'false'; // Default true
  const bottomOffset = parseInt((params.bottomOffset as string) || '0', 10);
  const accentColor = (params.accent as string) || '#007AFF';

  const isDark = theme === 'dark';

  // Data hooks
  const { data: community, isLoading: isLoadingCommunity, refetch: refetchCommunity } = useCommunityBySlug(communitySlug);
  const joinMutation = useJoinCommunity();
  const leaveMutation = useLeaveCommunity();

  const {
    data: feedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingFeed,
    refetch: refetchFeed,
  } = useCommunityPostsFeed(community?.id, {
    sort: 'new',
    enabled: !!community?.id,
  });

  const posts = useMemo(
    () => feedData?.pages.flatMap((page) => page.data) || [],
    [feedData]
  );

  // Send height to parent iframe
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.parent) {
      const sendHeight = () => {
        const height = document.documentElement.scrollHeight;
        window.parent.postMessage(
          JSON.stringify({ type: 'regattaflow:resize', widgetId: 'discuss', height }),
          '*'
        );
      };

      sendHeight();
      const observer = new MutationObserver(sendHeight);
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    }
  }, [posts]);

  // Handlers
  const handleJoinToggle = useCallback(() => {
    if (!community) return;
    if (community.is_member) {
      leaveMutation.mutate(community.id);
    } else {
      joinMutation.mutate({ communityId: community.id });
    }
  }, [community, joinMutation, leaveMutation]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchCommunity(), refetchFeed()]);
  }, [refetchCommunity, refetchFeed]);

  const handlePostPress = useCallback(
    (post: FeedPost) => {
      // Open in new tab or deep link to app
      const url = `https://better.at/venue/post/${post.id}`;
      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      }
    },
    []
  );

  const isJoinPending = joinMutation.isPending || leaveMutation.isPending;

  const colors = {
    bg: isDark ? '#000000' : IOS_COLORS.systemGroupedBackground,
    cardBg: isDark ? '#1C1C1E' : IOS_COLORS.secondarySystemGroupedBackground,
    text: isDark ? '#FFFFFF' : IOS_COLORS.label,
    textSecondary: isDark ? 'rgba(235, 235, 245, 0.6)' : IOS_COLORS.secondaryLabel,
    separator: isDark ? 'rgba(84, 84, 88, 0.65)' : IOS_COLORS.separator,
  };

  // Render helpers
  const renderItem = useCallback(
    ({ item }: { item: FeedPost }) => (
      <FeedPostCard
        post={item}
        onPress={() => handlePostPress(item)}
      />
    ),
    [handlePostPress]
  );

  const ListHeader = useMemo(() => {
    if (!community) return null;
    return (
      <CommunityDetailHeader
        community={community}
        onJoinToggle={handleJoinToggle}
        isJoinPending={isJoinPending}
      />
    );
  }, [community, handleJoinToggle, isJoinPending]);

  const ListEmpty = useMemo(
    () =>
      isLoadingFeed ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color={accentColor} />
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={40} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.text }]}>No posts yet</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Be the first to start a discussion!
          </Text>
        </View>
      ),
    [isLoadingFeed, accentColor, colors]
  );

  if (!communitySlug) {
    return (
      <View style={[styles.container, styles.error, { backgroundColor: colors.bg }]}>
        <Ionicons name="alert-circle-outline" size={32} color={colors.textSecondary} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          No community specified
        </Text>
      </View>
    );
  }

  if (isLoadingCommunity) {
    return (
      <View style={[styles.container, styles.loading, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={[styles.container, styles.error, { backgroundColor: colors.bg }]}>
        <Ionicons name="boat-outline" size={32} color={colors.textSecondary} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          Community not found
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.bg }]} />}
        contentContainerStyle={[
          styles.listContent,
          showBanner && { paddingBottom: 80 + bottomOffset }, // Space for sticky banner
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={handleRefresh}
            tintColor={accentColor}
          />
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={accentColor} />
            </View>
          ) : null
        }
      />

      {/* Sticky App Download Banner */}
      {showBanner && (
        <AppDownloadBanner
          variant="sticky"
          headline="Want more sailing discussions?"
          subheadline="Join 100+ communities on BetterAt"
          ctaText="Get the App"
          bottomOffset={bottomOffset}
          dismissible
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: IOS_SPACING.md,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 20,
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: IOS_SPACING.xl,
    gap: IOS_SPACING.sm,
  },
  emptyText: {
    ...IOS_TYPOGRAPHY.headline,
    marginTop: IOS_SPACING.sm,
  },
  emptySubtext: {
    ...IOS_TYPOGRAPHY.subhead,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
