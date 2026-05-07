/**
 * Community Detail Screen
 *
 * Shows community info, members, and discussion feed.
 * Reddit-inspired layout with header, flairs/filters, and post list.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  IOS_COLORS,
  IOS_SPACING,
  IOS_RADIUS,
  IOS_TYPOGRAPHY,
} from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';
import { CommunityDetailHeader } from '@/components/community/CommunityDetailHeader';
import { CommunityMembersModal } from '@/components/community/CommunityMembersModal';
import { FeedPostCard } from '@/components/venue/feed/FeedPostCard';
import {
  useCommunityBySlug,
  useJoinCommunity,
  useLeaveCommunity,
  communityKeys,
} from '@/hooks/useCommunities';
import { useCommunityFeed, useCommunityPostsFeed, communityFeedKeys } from '@/hooks/useCommunityFeed';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import type { FeedPost, FeedSortType, PostType } from '@/types/community-feed';
import { POST_TYPE_CONFIG } from '@/types/community-feed';

const SORT_OPTIONS: { key: FeedSortType; label: string }[] = [
  { key: 'hot', label: 'Hot' },
  { key: 'new', label: 'New' },
  { key: 'rising', label: 'Rising' },
  { key: 'top', label: 'Top' },
];

const POST_TYPE_FILTERS: (PostType | 'all')[] = [
  'all',
  'tip',
  'question',
  'report',
  'discussion',
  'safety_alert',
];

export default function CommunityDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, signedIn } = useAuth();
  // Track if we've refetched after auth became available
  const hasRefetchedAfterAuth = useRef(false);

  // State
  const [feedSort, setFeedSort] = useState<FeedSortType>('hot');
  const [feedPostType, setFeedPostType] = useState<PostType | undefined>(undefined);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  // Data
  const { data: community, isLoading: isLoadingCommunity, refetch: refetchCommunity } = useCommunityBySlug(slug);
  const joinMutation = useJoinCommunity();
  const leaveMutation = useLeaveCommunity();

  // Refetch community data when auth state changes to signed in
  // This ensures membership status is correctly fetched after auth is established
  useEffect(() => {
    if (signedIn && user && !hasRefetchedAfterAuth.current && community && !community.is_member) {
      console.log('[Community] Auth detected, refetching community data for membership status');
      hasRefetchedAfterAuth.current = true;
      // Invalidate and refetch community data to get correct membership status
      queryClient.invalidateQueries({ queryKey: communityKeys.bySlug(slug || '') });
      refetchCommunity();
    }
  }, [signedIn, user, community, slug, queryClient, refetchCommunity]);

  // Get the linked venue_id for the feed query (if it's a venue community)
  const venueId = useMemo(() => {
    if (community?.linked_entity_type === 'sailing_venue' && community?.linked_entity_id) {
      return community.linked_entity_id;
    }
    return null;
  }, [community]);

  // Determine if user can post (must be a member)
  const canPost = community?.is_member;

  // Feed data for venue-linked communities (uses venue_id)
  const venueFeed = useCommunityFeed(venueId || '', {
    sort: feedSort,
    postType: feedPostType,
    enabled: !!venueId,
  });

  // Feed data for non-venue communities (uses community_id)
  const communityFeed = useCommunityPostsFeed(community?.id, {
    sort: feedSort,
    postType: feedPostType,
    enabled: !venueId && !!community?.id,
  });

  // Use the appropriate feed based on community type
  const {
    data: feedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingFeed,
    refetch: refetchFeed,
  } = venueId ? venueFeed : communityFeed;

  const posts = useMemo(
    () => feedData?.pages.flatMap((page) => page.data) || [],
    [feedData]
  );

  // Handlers
  const handleJoinToggle = useCallback(() => {
    console.log('[Community] handleJoinToggle called');
    console.log('[Community] community:', community?.id, community?.slug);
    console.log('[Community] is_member:', community?.is_member);

    if (!community) {
      console.log('[Community] No community data, returning');
      return;
    }

    triggerHaptic('impactMedium');

    if (community.is_member) {
      console.log('[Community] Leaving community:', community.id);
      leaveMutation.mutate(community.id);
    } else {
      console.log('[Community] Joining community:', community.id);
      joinMutation.mutate({ communityId: community.id });
    }
  }, [community, joinMutation, leaveMutation]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchCommunity(), refetchFeed()]);
  }, [refetchCommunity, refetchFeed]);

  const handleMembersPress = useCallback(() => {
    triggerHaptic('selection');
    setIsMembersModalOpen(true);
  }, []);

  const handlePostPress = useCallback(
    (post: FeedPost) => {
      queryClient.setQueryData(communityFeedKeys.post(post.id), post);
      router.push(`/venue/post/${post.id}`);
    },
    [router, queryClient]
  );

  const handleCreatePost = useCallback(() => {
    if (!community) return;
    // Pass communityId as primary parameter, with optional venueId for venue-linked communities
    const params = new URLSearchParams();
    params.set('communityId', community.id);
    if (venueId) {
      params.set('venueId', venueId);
    }
    router.push(`/venue/post/create?${params.toString()}`);
  }, [router, community, venueId]);

  const openSortPicker = useCallback(() => {
    if (Platform.OS === 'ios') {
      const labels = SORT_OPTIONS.map((o) => o.label);
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...labels, 'Cancel'],
          cancelButtonIndex: labels.length,
          title: 'Sort by',
        },
        (index) => {
          if (index < SORT_OPTIONS.length) {
            triggerHaptic('selection');
            setFeedSort(SORT_OPTIONS[index].key);
          }
        }
      );
    }
  }, []);

  const openFilterPicker = useCallback(() => {
    if (Platform.OS === 'ios') {
      const labels = POST_TYPE_FILTERS.map((t) =>
        t === 'all' ? 'All Types' : POST_TYPE_CONFIG[t as PostType].label
      );
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...labels, 'Cancel'],
          cancelButtonIndex: labels.length,
          title: 'Filter by type',
        },
        (index) => {
          if (index < POST_TYPE_FILTERS.length) {
            triggerHaptic('selection');
            const selected = POST_TYPE_FILTERS[index];
            setFeedPostType(selected === 'all' ? undefined : (selected as PostType));
          }
        }
      );
    }
  }, []);

  const isJoinPending = joinMutation.isPending || leaveMutation.isPending;

  // Membership status is loading when:
  // - User is signed in but hasn't refetched yet, AND
  // - Community data shows them as not a member (which may be stale)
  // This prevents showing "Join Community" to users who are already auto-joined via auth bridge
  const isMembershipLoading = signedIn && !hasRefetchedAfterAuth.current && community && !community.is_member;

  // Render helpers - must be defined before early return to maintain hooks order
  const renderItem = useCallback(
    ({ item }: { item: FeedPost }) => (
      <FeedPostCard
        post={item}
        onPress={() => handlePostPress(item)}
        onVenuePress={(vid) => router.push(`/venue/${vid}`)}
      />
    ),
    [handlePostPress, router]
  );

  const ListHeader = useMemo(
    () => {
      if (!community) return null;
      return (
        <>
          <CommunityDetailHeader
            community={community}
            onJoinToggle={handleJoinToggle}
            isJoinPending={isJoinPending}
            isMembershipLoading={isMembershipLoading}
            onMembersPress={handleMembersPress}
          />

        {/* Section Divider */}
        <View style={styles.sectionDivider}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Posts</Text>
            <Text style={styles.postCount}>
              {posts.length > 0 ? `${posts.length} posts` : ''}
            </Text>
          </View>
        </View>

        {/* Filter Bar */}
        <View style={styles.filterBar}>
          <View style={styles.filterButtons}>
            <Pressable onPress={openSortPicker} style={styles.filterButton}>
              <Ionicons name="swap-vertical-outline" size={16} color={IOS_COLORS.secondaryLabel} />
              <Text style={styles.filterButtonText}>
                {SORT_OPTIONS.find((o) => o.key === feedSort)?.label || 'Hot'}
              </Text>
            </Pressable>
            <Pressable onPress={openFilterPicker} style={styles.filterButton}>
              <Ionicons name="funnel-outline" size={16} color={IOS_COLORS.secondaryLabel} />
              <Text style={styles.filterButtonText}>
                {feedPostType ? POST_TYPE_CONFIG[feedPostType].label : 'All'}
              </Text>
            </Pressable>
          </View>
          {canPost && (
            <Pressable onPress={handleCreatePost} style={styles.createButton}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.createButtonText}>New Post</Text>
            </Pressable>
          )}
        </View>
      </>
      );
    },
    [community, handleJoinToggle, isJoinPending, isMembershipLoading, handleMembersPress, feedSort, feedPostType, openSortPicker, openFilterPicker, handleCreatePost, canPost, posts.length]
  );

  const ListEmpty = useMemo(
    () =>
      isLoadingFeed ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color={IOS_COLORS.systemGray3} />
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color={IOS_COLORS.systemBlue} />
          </View>
          <Text style={styles.emptyText}>Start the conversation!</Text>
          <Text style={styles.emptySubtext}>
            Be the first to share your knowledge, ask a question, or spark a discussion in this community.
          </Text>
          {canPost ? (
            <Pressable onPress={handleCreatePost} style={styles.emptyButton}>
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Create First Post</Text>
            </Pressable>
          ) : (
            <View style={styles.emptyJoinHint}>
              <Ionicons name="information-circle-outline" size={16} color={IOS_COLORS.secondaryLabel} />
              <Text style={styles.emptyJoinHintText}>
                Join this community to start posting
              </Text>
            </View>
          )}
        </View>
      ),
    [isLoadingFeed, handleCreatePost, canPost]
  );

  // Loading state - placed after all hooks to maintain consistent hook order
  if (isLoadingCommunity || !community) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Loading...',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: community.name,
          headerBackTitle: 'Back',
          // Cold deep-links (e.g. HKDW token bridge → /community/<slug>) have
          // no prior history, so the default back gesture has nowhere to go.
          // Render an explicit back button that falls back to the home tabs.
          headerLeft: () => (
            <Pressable
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/(tabs)' as any);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={28} color={IOS_COLORS.systemBlue} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={() => {
                // TODO: Community settings/menu
              }}
              hitSlop={8}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color={IOS_COLORS.systemBlue} />
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 }, // Extra padding to clear any banners
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={handleRefresh}
            tintColor={IOS_COLORS.systemBlue}
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
              <ActivityIndicator size="small" color={IOS_COLORS.systemGray3} />
            </View>
          ) : null
        }
      />

      {/* Members Modal */}
      <CommunityMembersModal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        communityId={community.id}
        communityName={community.name}
        memberCount={community.member_count}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  listContent: {
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  // Section divider between header and posts
  sectionDivider: {
    marginTop: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.md,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.sm,
  },
  sectionTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
  },
  postCount: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.secondaryLabel,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  filterButtons: {
    flexDirection: 'row',
    gap: IOS_SPACING.sm,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: IOS_RADIUS.full,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: IOS_RADIUS.full,
    backgroundColor: IOS_COLORS.systemBlue,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  separator: {
    height: 12,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: IOS_SPACING.xl,
    gap: IOS_SPACING.sm,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${IOS_COLORS.systemBlue}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: IOS_SPACING.sm,
  },
  emptyText: {
    ...IOS_TYPOGRAPHY.title3,
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  emptySubtext: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: IOS_SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: IOS_SPACING.xl,
    paddingVertical: IOS_SPACING.sm + 2,
    backgroundColor: IOS_COLORS.systemBlue,
    borderRadius: IOS_RADIUS.full,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyJoinHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: IOS_SPACING.md,
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.md,
  },
  emptyJoinHintText: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
