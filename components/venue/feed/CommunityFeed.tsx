/**
 * CommunityFeed
 *
 * Main Reddit-style community knowledge feed. FlatList with infinite scroll,
 * sort tabs, topic tag filter chips, and pull-to-refresh.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TufteTokens } from '@/constants/designSystem';
import { useCommunityFeed, useTopicTags } from '@/hooks/useCommunityFeed';
import { CommunityFeedHeader } from './CommunityFeedHeader';
import { FeedPostCard } from './FeedPostCard';
import type { FeedPost, FeedSortType, PostType, CurrentConditions } from '@/types/community-feed';

interface CommunityFeedProps {
  venueId: string;
  poiId?: string | null;
  currentConditions?: CurrentConditions;
  onPostPress?: (post: FeedPost) => void;
  onCreatePost?: () => void;
  emptyMessage?: string;
  /** Override default sort/filter state from parent (used by VenueFeedSegment) */
  sort?: FeedSortType;
  onSortChange?: (sort: FeedSortType) => void;
  selectedPostType?: PostType;
  onPostTypeChange?: (type: PostType | undefined) => void;
  selectedTagIds?: string[];
  onTagToggle?: (tagId: string) => void;
  /** Custom header to replace the default CommunityFeedHeader */
  renderHeader?: () => React.ReactElement | null;
}

export function CommunityFeed({
  venueId,
  poiId,
  currentConditions,
  onPostPress,
  onCreatePost,
  emptyMessage = 'No posts yet',
  sort: externalSort,
  onSortChange: externalOnSortChange,
  selectedPostType: externalPostType,
  onPostTypeChange: externalOnPostTypeChange,
  selectedTagIds: externalTagIds,
  onTagToggle: externalOnTagToggle,
  renderHeader,
}: CommunityFeedProps) {
  // Internal state (used when no external control is provided)
  const [internalSort, setInternalSort] = useState<FeedSortType>('hot');
  const [internalPostType, setInternalPostType] = useState<PostType | undefined>();
  const [internalTagIds, setInternalTagIds] = useState<string[]>([]);

  // Use external state when provided, otherwise fall back to internal
  const sort = externalSort ?? internalSort;
  const setSort = externalOnSortChange ?? setInternalSort;
  const selectedPostType = externalPostType !== undefined ? externalPostType : internalPostType;
  const setSelectedPostType = externalOnPostTypeChange ?? setInternalPostType;
  const selectedTagIds = externalTagIds ?? internalTagIds;

  const {
    data,
    isLoading,
    isRefetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = useCommunityFeed(venueId, {
    sort,
    postType: selectedPostType,
    tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    poiId,
    currentConditions,
  });

  const { data: topicTags } = useTopicTags();

  // Flatten infinite query pages
  const posts = useMemo(() => {
    return data?.pages.flatMap(page => page.data) || [];
  }, [data]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleTagToggle = useCallback((tagId: string) => {
    if (externalOnTagToggle) {
      externalOnTagToggle(tagId);
    } else {
      setInternalTagIds(prev =>
        prev.includes(tagId)
          ? prev.filter(id => id !== tagId)
          : [...prev, tagId]
      );
    }
  }, [externalOnTagToggle]);

  const renderItem = useCallback(({ item }: { item: FeedPost }) => (
    <FeedPostCard
      post={item}
      onPress={() => onPostPress?.(item)}
      showConditionMatch={sort === 'conditions_match'}
    />
  ), [onPostPress, sort]);

  const keyExtractor = useCallback((item: FeedPost) => item.id, []);

  const ListHeaderComponent = useMemo(() => {
    if (renderHeader) return renderHeader();
    return (
      <CommunityFeedHeader
        sort={sort}
        onSortChange={setSort}
        selectedPostType={selectedPostType}
        onPostTypeChange={setSelectedPostType}
        topicTags={topicTags || []}
        selectedTagIds={selectedTagIds}
        onTagToggle={handleTagToggle}
        showConditionsSort={!!currentConditions}
      />
    );
  }, [sort, setSort, selectedPostType, setSelectedPostType, topicTags, selectedTagIds, handleTagToggle, currentConditions, renderHeader]);

  const ListEmptyComponent = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color="#6B7280" />
          <Text style={styles.emptyText}>Loading feed...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={32} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>{emptyMessage}</Text>
        <Text style={styles.emptyText}>
          Be the first to share local knowledge
        </Text>
        {onCreatePost && (
          <Pressable style={styles.emptyAction} onPress={onCreatePost}>
            <Ionicons name="add" size={16} color="#007AFF" />
            <Text style={styles.emptyActionText}>Create Post</Text>
          </Pressable>
        )}
      </View>
    );
  }, [isLoading, emptyMessage, onCreatePost]);

  const ListFooterComponent = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#6B7280" />
      </View>
    );
  }, [isFetchingNextPage]);

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TufteTokens.backgrounds.paper,
  },
  listContent: {
    flexGrow: 1,
  },
  separator: {
    height: TufteTokens.borders.hairline,
    backgroundColor: TufteTokens.borders.colorSubtle,
    marginHorizontal: TufteTokens.spacing.section,
  },
  footer: {
    padding: TufteTokens.spacing.section,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: TufteTokens.spacing.section,
  },
  emptyTitle: {
    ...TufteTokens.typography.secondary,
    color: '#6B7280',
    marginTop: TufteTokens.spacing.standard,
  },
  emptyText: {
    ...TufteTokens.typography.tertiary,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: TufteTokens.spacing.standard,
    paddingHorizontal: TufteTokens.spacing.standard,
    paddingVertical: TufteTokens.spacing.compact,
    backgroundColor: '#EFF6FF',
    borderRadius: TufteTokens.borderRadius.subtle,
  },
  emptyActionText: {
    ...TufteTokens.typography.tertiary,
    fontWeight: '600',
    color: '#007AFF',
  },
});

export default CommunityFeed;
