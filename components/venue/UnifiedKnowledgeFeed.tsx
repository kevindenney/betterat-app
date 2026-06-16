/**
 * @deprecated Use CommunityFeed from components/venue/feed/CommunityFeed.tsx instead.
 * This component is maintained for backward compatibility only.
 *
 * UnifiedKnowledgeFeed
 *
 * Single scrollable feed combining discussions, documents, tips, and insights.
 * Tufte-inspired: high information density, minimal chrome, clear hierarchy.
 * Replaces siloed tabs with a unified, filterable feed.
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TufteTokens } from '@/constants/designSystem';

// ============================================================================
// TYPES
// ============================================================================

type KnowledgeItemType = 'discussion' | 'document' | 'tip' | 'insight';

interface BaseKnowledgeItem {
  id: string;
  type: KnowledgeItemType;
  title: string;
  createdAt: string;
  authorName?: string;
  upvotes?: number;
  racingAreaId?: string;
  racingAreaName?: string;
}

interface DiscussionItem extends BaseKnowledgeItem {
  type: 'discussion';
  commentCount: number;
  category: string;
  lastActivityAt: string;
  isActive?: boolean;
}

interface DocumentItem extends BaseKnowledgeItem {
  type: 'document';
  documentType: 'pdf' | 'video' | 'link';
  viewCount: number;
  extractionStatus?: 'pending' | 'completed' | 'failed';
  insightCount?: number;
}

interface TipItem extends BaseKnowledgeItem {
  type: 'tip';
  category: string;
  description: string;
  confidence: number;
  verificationStatus: 'pending' | 'community_verified' | 'expert_verified';
  conditions?: {
    windDirection?: string;
    windSpeed?: string;
    tidePhase?: string;
    season?: string;
  };
}

interface InsightItem extends BaseKnowledgeItem {
  type: 'insight';
  category: string;
  content: string;
  source?: string; // Document it came from
  confidence?: number;
  verificationStatus?: string;
}

type KnowledgeItem = DiscussionItem | DocumentItem | TipItem | InsightItem;

interface UnifiedKnowledgeFeedProps {
  venueId: string;
  racingAreaId?: string | null;
  items: KnowledgeItem[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onItemPress?: (item: KnowledgeItem) => void;
  onFilterChange?: (filter: KnowledgeItemType | 'all') => void;
  emptyMessage?: string;
  showFilters?: boolean;
  showAreaFilter?: boolean;
}

// ============================================================================
// FILTER CHIPS
// ============================================================================

const FILTERS: { key: KnowledgeItemType | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: 'All', icon: 'layers-outline' },
  { key: 'discussion', label: 'Discussions', icon: 'chatbubbles-outline' },
  { key: 'document', label: 'Documents', icon: 'document-text-outline' },
  { key: 'tip', label: 'Tips', icon: 'bulb-outline' },
  { key: 'insight', label: 'Insights', icon: 'sparkles-outline' },
];

function FilterChips({
  selected,
  onSelect,
}: {
  selected: KnowledgeItemType | 'all';
  onSelect: (filter: KnowledgeItemType | 'all') => void;
}) {
  return (
    <View style={styles.filterContainer}>
      {FILTERS.map((filter) => {
        const isSelected = selected === filter.key;
        return (
          <Pressable
            key={filter.key}
            style={[styles.filterChip, isSelected && styles.filterChipSelected]}
            onPress={() => onSelect(filter.key)}
          >
            <Ionicons
              name={filter.icon as any}
              size={14}
              color={isSelected ? '#007AFF' : '#6B7280'}
            />
            <Text style={[styles.filterChipText, isSelected && styles.filterChipTextSelected]}>
              {filter.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ============================================================================
// ITEM RENDERERS
// ============================================================================

function DiscussionItemRow({
  item,
  onPress,
}: {
  item: DiscussionItem;
  onPress: () => void;
}) {
  const isRecent = Date.now() - new Date(item.lastActivityAt).getTime() < 24 * 60 * 60 * 1000;

  return (
    <Pressable style={styles.itemRow} onPress={onPress}>
      <View style={styles.itemIcon}>
        <Ionicons name="chatbubbles" size={16} color="#6B7280" />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.itemMeta}>
          <Text style={styles.itemMetaText}>{item.category}</Text>
          <Text style={styles.itemMetaDot}>·</Text>
          <Text style={styles.itemMetaText}>
            {item.commentCount} {item.commentCount === 1 ? 'reply' : 'replies'}
          </Text>
          {isRecent && (
            <>
              <Text style={styles.itemMetaDot}>·</Text>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>Active</Text>
              </View>
            </>
          )}
        </View>
        {item.racingAreaName && (
          <Text style={styles.itemAreaTag}>{item.racingAreaName}</Text>
        )}
      </View>
      {item.upvotes !== undefined && item.upvotes > 0 && (
        <View style={styles.itemUpvotes}>
          <Ionicons name="arrow-up" size={12} color="#6B7280" />
          <Text style={styles.itemUpvotesText}>{item.upvotes}</Text>
        </View>
      )}
    </Pressable>
  );
}

function DocumentItemRow({
  item,
  onPress,
}: {
  item: DocumentItem;
  onPress: () => void;
}) {
  const typeIcon = item.documentType === 'video' ? 'play-circle' : item.documentType === 'link' ? 'link' : 'document';

  return (
    <Pressable style={styles.itemRow} onPress={onPress}>
      <View style={[styles.itemIcon, styles.itemIconDocument]}>
        <Ionicons name={typeIcon} size={16} color="#007AFF" />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.itemMeta}>
          <Text style={styles.itemMetaText}>{item.viewCount} views</Text>
          {item.insightCount && item.insightCount > 0 && (
            <>
              <Text style={styles.itemMetaDot}>·</Text>
              <Text style={styles.itemMetaText}>{item.insightCount} insights</Text>
            </>
          )}
          {item.extractionStatus === 'pending' && (
            <>
              <Text style={styles.itemMetaDot}>·</Text>
              <Text style={styles.itemMetaProcessing}>Processing...</Text>
            </>
          )}
        </View>
        {item.racingAreaName && (
          <Text style={styles.itemAreaTag}>{item.racingAreaName}</Text>
        )}
      </View>
    </Pressable>
  );
}

function TipItemRow({
  item,
  onPress,
}: {
  item: TipItem;
  onPress: () => void;
}) {
  const isVerified = item.verificationStatus === 'community_verified' || item.verificationStatus === 'expert_verified';

  return (
    <Pressable style={styles.itemRow} onPress={onPress}>
      <View style={[styles.itemIcon, isVerified && styles.itemIconVerified]}>
        <Ionicons name="bulb" size={16} color={isVerified ? '#059669' : '#D97706'} />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.itemDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.itemMeta}>
          <Text style={styles.itemMetaText}>{item.category}</Text>
          {item.conditions?.windDirection && (
            <>
              <Text style={styles.itemMetaDot}>·</Text>
              <Text style={styles.itemMetaText}>{item.conditions.windDirection} wind</Text>
            </>
          )}
          {isVerified && (
            <>
              <Text style={styles.itemMetaDot}>·</Text>
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={10} color="#059669" />
                <Text style={styles.verifiedBadgeText}>Verified</Text>
              </View>
            </>
          )}
        </View>
      </View>
      {item.upvotes !== undefined && item.upvotes > 0 && (
        <View style={styles.itemUpvotes}>
          <Ionicons name="arrow-up" size={12} color="#059669" />
          <Text style={[styles.itemUpvotesText, { color: '#059669' }]}>{item.upvotes}</Text>
        </View>
      )}
    </Pressable>
  );
}

function InsightItemRow({
  item,
  onPress,
}: {
  item: InsightItem;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.itemRow} onPress={onPress}>
      <View style={[styles.itemIcon, styles.itemIconInsight]}>
        <Ionicons name="sparkles" size={16} color="#7C3AED" />
      </View>
      <View style={styles.itemContent}>
        <View style={styles.insightHeader}>
          <Text style={styles.itemCategory}>{item.category}</Text>
          {item.source && <Text style={styles.itemSource}>from {item.source}</Text>}
        </View>
        <Text style={styles.insightContent} numberOfLines={3}>
          {item.content}
        </Text>
        {item.racingAreaName && (
          <Text style={styles.itemAreaTag}>{item.racingAreaName}</Text>
        )}
      </View>
    </Pressable>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UnifiedKnowledgeFeed({
  venueId: _venueId,
  racingAreaId,
  items,
  isLoading = false,
  isRefreshing = false,
  onRefresh,
  onItemPress,
  onFilterChange,
  emptyMessage = 'No knowledge shared yet',
  showFilters = false, // Tufte: hide chrome by default, show data
}: UnifiedKnowledgeFeedProps) {
  const [filter, setFilter] = useState<KnowledgeItemType | 'all'>('all');

  const handleFilterChange = useCallback(
    (newFilter: KnowledgeItemType | 'all') => {
      setFilter(newFilter);
      onFilterChange?.(newFilter);
    },
    [onFilterChange]
  );

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = items;

    // Filter by type
    if (filter !== 'all') {
      result = result.filter((item) => item.type === filter);
    }

    // Filter by racing area if specified
    if (racingAreaId) {
      result = result.filter(
        (item) => !item.racingAreaId || item.racingAreaId === racingAreaId
      );
    }

    // Sort by date (most recent first)
    return result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [items, filter, racingAreaId]);

  const renderItem = useCallback(
    ({ item }: { item: KnowledgeItem }) => {
      const handlePress = () => onItemPress?.(item);

      switch (item.type) {
        case 'discussion':
          return <DiscussionItemRow item={item} onPress={handlePress} />;
        case 'document':
          return <DocumentItemRow item={item} onPress={handlePress} />;
        case 'tip':
          return <TipItemRow item={item} onPress={handlePress} />;
        case 'insight':
          return <InsightItemRow item={item} onPress={handlePress} />;
        default:
          return null;
      }
    },
    [onItemPress]
  );

  const keyExtractor = useCallback((item: KnowledgeItem) => `${item.type}-${item.id}`, []);

  const ListEmptyComponent = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color="#6B7280" />
          <Text style={styles.emptyText}>Loading knowledge...</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="library-outline" size={32} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>{emptyMessage}</Text>
        <Text style={styles.emptyText}>
          Be the first to share local knowledge about this area
        </Text>
      </View>
    );
  }, [isLoading, emptyMessage]);

  return (
    <View style={styles.container}>
      {showFilters && (
        <FilterChips selected={filter} onSelect={handleFilterChange} />
      )}

      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListEmptyComponent={ListEmptyComponent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          ) : undefined
        }
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TufteTokens.backgrounds.paper,
  },

  // Filters
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TufteTokens.spacing.compact,
    paddingHorizontal: TufteTokens.spacing.section,
    paddingVertical: TufteTokens.spacing.standard,
    borderBottomWidth: TufteTokens.borders.hairline,
    borderBottomColor: TufteTokens.borders.colorSubtle,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: TufteTokens.spacing.compact,
    paddingVertical: TufteTokens.spacing.tight,
    backgroundColor: TufteTokens.backgrounds.subtle,
    borderRadius: TufteTokens.borderRadius.subtle,
  },
  filterChipSelected: {
    backgroundColor: '#EFF6FF',
  },
  filterChipText: {
    ...TufteTokens.typography.micro,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterChipTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },

  // List
  listContent: {
    paddingVertical: TufteTokens.spacing.compact,
    flexGrow: 1,
  },
  separator: {
    height: TufteTokens.borders.hairline,
    backgroundColor: TufteTokens.borders.colorSubtle,
    marginHorizontal: TufteTokens.spacing.section,
  },

  // Item row
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: TufteTokens.spacing.section,
    paddingVertical: TufteTokens.spacing.standard,
    gap: TufteTokens.spacing.standard,
  },
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: TufteTokens.backgrounds.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemIconDocument: {
    backgroundColor: '#EFF6FF',
  },
  itemIconVerified: {
    backgroundColor: '#ECFDF5',
  },
  itemIconInsight: {
    backgroundColor: '#F5F3FF',
  },
  itemContent: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    ...TufteTokens.typography.secondary,
    color: '#111827',
    fontWeight: '500',
  },
  itemDescription: {
    ...TufteTokens.typography.tertiary,
    color: '#6B7280',
    lineHeight: 18,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  itemMetaText: {
    ...TufteTokens.typography.micro,
    color: '#9CA3AF',
  },
  itemMetaDot: {
    ...TufteTokens.typography.micro,
    color: '#D1D5DB',
  },
  itemMetaProcessing: {
    ...TufteTokens.typography.micro,
    color: '#007AFF',
  },
  itemAreaTag: {
    ...TufteTokens.typography.micro,
    color: '#6B7280',
    backgroundColor: TufteTokens.backgrounds.subtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: TufteTokens.borderRadius.minimal,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  itemUpvotes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: TufteTokens.backgrounds.subtle,
    borderRadius: TufteTokens.borderRadius.subtle,
  },
  itemUpvotesText: {
    ...TufteTokens.typography.micro,
    color: '#6B7280',
    fontWeight: '600',
  },

  // Badges
  activeBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: '#DCFCE7',
    borderRadius: TufteTokens.borderRadius.minimal,
  },
  activeBadgeText: {
    ...TufteTokens.typography.micro,
    fontSize: 9,
    color: '#059669',
    fontWeight: '600',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  verifiedBadgeText: {
    ...TufteTokens.typography.micro,
    fontSize: 9,
    color: '#059669',
    fontWeight: '600',
  },

  // Insight-specific
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemCategory: {
    ...TufteTokens.typography.micro,
    color: '#7C3AED',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemSource: {
    ...TufteTokens.typography.micro,
    color: '#9CA3AF',
  },
  insightContent: {
    ...TufteTokens.typography.tertiary,
    color: '#374151',
    lineHeight: 18,
    fontStyle: 'italic',
  },

  // Empty state
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
});

export default UnifiedKnowledgeFeed;
