/**
 * CommunityFeedHeader
 *
 * Sort tabs (Hot/New/Rising/Top/Conditions Match) + horizontal topic tag filter chips.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TufteTokens } from '@/constants/designSystem';
import type { FeedSortType, PostType, TopicTag } from '@/types/community-feed';
import { POST_TYPE_CONFIG } from '@/types/community-feed';

interface CommunityFeedHeaderProps {
  sort: FeedSortType;
  onSortChange: (sort: FeedSortType) => void;
  selectedPostType?: PostType;
  onPostTypeChange: (type: PostType | undefined) => void;
  topicTags: TopicTag[];
  selectedTagIds: string[];
  onTagToggle: (tagId: string) => void;
  showConditionsSort?: boolean;
}

const SORT_OPTIONS: { key: FeedSortType; label: string; icon: string }[] = [
  { key: 'hot', label: 'Hot', icon: 'flame-outline' },
  { key: 'new', label: 'New', icon: 'time-outline' },
  { key: 'rising', label: 'Rising', icon: 'trending-up-outline' },
  { key: 'top', label: 'Top', icon: 'arrow-up-outline' },
];

const POST_TYPES: (PostType | 'all')[] = ['all', 'tip', 'question', 'report', 'discussion', 'safety_alert'];

export function CommunityFeedHeader({
  sort,
  onSortChange,
  selectedPostType,
  onPostTypeChange,
  topicTags,
  selectedTagIds,
  onTagToggle,
  showConditionsSort = false,
}: CommunityFeedHeaderProps) {
  const sortOptions = showConditionsSort
    ? [...SORT_OPTIONS, { key: 'conditions_match' as FeedSortType, label: 'Conditions', icon: 'cloudy-outline' }]
    : SORT_OPTIONS;

  return (
    <View style={styles.container}>
      {/* Sort Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortContainer}
      >
        {sortOptions.map((option) => {
          const isSelected = sort === option.key;
          return (
            <Pressable
              key={option.key}
              style={[styles.sortTab, isSelected && styles.sortTabSelected]}
              onPress={() => onSortChange(option.key)}
            >
              <Ionicons
                name={option.icon as any}
                size={14}
                color={isSelected ? '#007AFF' : '#6B7280'}
              />
              <Text style={[styles.sortTabText, isSelected && styles.sortTabTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Post Type Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeContainer}
      >
        {POST_TYPES.map((type) => {
          const isAll = type === 'all';
          const isSelected = isAll ? !selectedPostType : selectedPostType === type;
          const config = isAll ? null : POST_TYPE_CONFIG[type as PostType];

          return (
            <Pressable
              key={type}
              style={[
                styles.typeChip,
                isSelected && {
                  backgroundColor: isAll ? '#EFF6FF' : config?.bgColor || '#F3F4F6',
                },
              ]}
              onPress={() => onPostTypeChange(isAll ? undefined : type as PostType)}
            >
              {config && (
                <Ionicons
                  name={config.icon as any}
                  size={12}
                  color={isSelected ? config.color : '#9CA3AF'}
                />
              )}
              <Text
                style={[
                  styles.typeChipText,
                  isSelected && {
                    color: isAll ? '#007AFF' : config?.color || '#374151',
                    fontWeight: '600',
                  },
                ]}
              >
                {isAll ? 'All' : config?.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Topic Tag Filter Chips */}
      {topicTags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagContainer}
        >
          {topicTags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <Pressable
                key={tag.id}
                style={[
                  styles.tagChip,
                  isSelected && { backgroundColor: `${tag.color}15` },
                ]}
                onPress={() => onTagToggle(tag.id)}
              >
                {tag.icon && (
                  <Ionicons
                    name={tag.icon as any}
                    size={12}
                    color={isSelected ? tag.color || '#6B7280' : '#9CA3AF'}
                  />
                )}
                <Text
                  style={[
                    styles.tagChipText,
                    isSelected && { color: tag.color || '#374151', fontWeight: '600' },
                  ]}
                >
                  {tag.display_name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: TufteTokens.spacing.compact,
    paddingVertical: TufteTokens.spacing.standard,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderBottomColor: TufteTokens.borders.colorSubtle,
  },
  // Sort tabs
  sortContainer: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: TufteTokens.spacing.section,
  },
  sortTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: TufteTokens.spacing.standard,
    paddingVertical: TufteTokens.spacing.compact,
    borderRadius: TufteTokens.borderRadius.subtle,
  },
  sortTabSelected: {
    backgroundColor: '#EFF6FF',
  },
  sortTabText: {
    ...TufteTokens.typography.tertiary,
    color: '#6B7280',
    fontWeight: '500',
  },
  sortTabTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  // Post type filter
  typeContainer: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: TufteTokens.spacing.section,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: TufteTokens.spacing.compact,
    paddingVertical: TufteTokens.spacing.tight,
    backgroundColor: TufteTokens.backgrounds.subtle,
    borderRadius: TufteTokens.borderRadius.subtle,
  },
  typeChipText: {
    ...TufteTokens.typography.micro,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  // Tag chips
  tagContainer: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: TufteTokens.spacing.section,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: TufteTokens.spacing.compact,
    paddingVertical: TufteTokens.spacing.tight,
    backgroundColor: TufteTokens.backgrounds.subtle,
    borderRadius: TufteTokens.borderRadius.subtle,
  },
  tagChipText: {
    ...TufteTokens.typography.micro,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});

export default CommunityFeedHeader;
