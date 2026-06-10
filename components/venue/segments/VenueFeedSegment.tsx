/**
 * VenueFeedSegment
 *
 * Feed segment wrapping CommunityFeed with a SimplifiedFeedHeader
 * via the renderHeader override. Manages local filter state.
 */

import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { IOS_COLORS } from '@/lib/design-tokens-ios';
import { CommunityFeed } from '../feed/CommunityFeed';
import { SimplifiedFeedHeader } from '../feed/SimplifiedFeedHeader';
import { useTopicTags } from '@/hooks/useCommunityFeed';
import type { FeedPost, FeedSortType, PostType } from '@/types/community-feed';

interface VenueFeedSegmentProps {
  venueId: string;
  poiId?: string | null;
  onPostPress: (post: FeedPost) => void;
  onCreatePost: () => void;
}

export function VenueFeedSegment({
  venueId,
  poiId,
  onPostPress,
  onCreatePost,
}: VenueFeedSegmentProps) {
  // Local filter state
  const [sort, setSort] = useState<FeedSortType>('hot');
  const [selectedPostType, setSelectedPostType] = useState<PostType | undefined>();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const { data: topicTags } = useTopicTags();

  const handleTagToggle = useCallback((tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  }, []);

  // Render the simplified header via CommunityFeed's renderHeader prop
  const renderHeader = useCallback(() => (
    <SimplifiedFeedHeader
      sort={sort}
      onSortChange={setSort}
      selectedPostType={selectedPostType}
      onPostTypeChange={setSelectedPostType}
      topicTags={topicTags || []}
      selectedTagIds={selectedTagIds}
      onTagToggle={handleTagToggle}
      showConditionsSort={false}
    />
  ), [sort, selectedPostType, topicTags, selectedTagIds, handleTagToggle]);

  return (
    <View style={styles.container}>
      <CommunityFeed
        venueId={venueId}
        poiId={poiId}
        onPostPress={onPostPress}
        onCreatePost={onCreatePost}
        sort={sort}
        onSortChange={setSort}
        selectedPostType={selectedPostType}
        onPostTypeChange={setSelectedPostType}
        selectedTagIds={selectedTagIds}
        onTagToggle={handleTagToggle}
        renderHeader={renderHeader}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
});

export default VenueFeedSegment;
