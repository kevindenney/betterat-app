/**
 * Post Create Route
 *
 * Standalone post creation screen (for deep linking).
 * When communityId/venueId is provided, opens PostComposer directly.
 * Otherwise, shows a community picker with search so the user can choose where to post.
 * User's joined communities appear first, then communities grouped by type.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  SectionList,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PostComposer } from '@/components/venue/post/PostComposer';
import {
  useUserCommunities,
  useCommunitySearch,
  usePopularCommunities,
} from '@/hooks/useCommunities';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';
import { COMMUNITY_TYPE_CONFIG, type Community } from '@/types/community';

export default function PostCreateRoute() {
  const {
    venueId: paramVenueId,
    communityId: paramCommunityId,
    areaPoiId,
    poiId,
    poiName,
    interestSlug,
    catalogRaceId,
    catalogRaceName,
  } = useLocalSearchParams<{
    venueId?: string;
    communityId?: string;
    areaPoiId?: string;
    poiId?: string;
    poiName?: string;
    interestSlug?: string;
    catalogRaceId?: string;
    catalogRaceName?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedCommunity, setSelectedCommunity] = useState<{
    id: string;
    venueId?: string;
  } | null>(
    paramCommunityId
      ? { id: paramCommunityId, venueId: paramVenueId }
      : paramVenueId
        ? { id: '', venueId: paramVenueId }
        : null
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Community data for picker
  const { data: userCommunities, isLoading: isLoadingUser } = useUserCommunities();
  const { data: searchResults, isLoading: isSearching } = useCommunitySearch(
    searchQuery,
    {},
    searchQuery.length >= 2
  );
  const { data: popularCommunities, isLoading: isLoadingPopular } = usePopularCommunities(20);

  const isSearchMode = searchQuery.trim().length >= 2;
  const isLoading = isLoadingUser || isLoadingPopular;

  // Build sections for the list
  const sections = useMemo(() => {
    const result: { title: string; data: Community[] }[] = [];

    if (isSearchMode && searchResults) {
      // Search mode - show search results
      if (searchResults.data.length > 0) {
        result.push({ title: 'SEARCH RESULTS', data: searchResults.data });
      }
    } else {
      // Browse mode - show joined communities first, then by type
      const joined = userCommunities?.joined || [];
      if (joined.length > 0) {
        result.push({ title: 'YOUR COMMUNITIES', data: joined });
      }

      // Group popular communities by type
      const popular = popularCommunities?.data || [];
      const joinedIds = new Set(joined.map((c) => c.id));
      const notJoined = popular.filter((c) => !joinedIds.has(c.id));

      // Group by community_type
      const typeGroups = new Map<string, Community[]>();
      for (const c of notJoined) {
        const type = c.community_type;
        if (!typeGroups.has(type)) typeGroups.set(type, []);
        typeGroups.get(type)!.push(c);
      }

      // Sort types: venues first, then alphabetically
      const typeOrder = ['venue', 'boat_class', 'race', 'sailmaker', 'gear', 'rules', 'tactics', 'tuning', 'general'];
      const sortedTypes = Array.from(typeGroups.keys()).sort((a, b) => {
        const aIdx = typeOrder.indexOf(a);
        const bIdx = typeOrder.indexOf(b);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });

      for (const type of sortedTypes) {
        const communities = typeGroups.get(type)!;
        const config = COMMUNITY_TYPE_CONFIG[type as keyof typeof COMMUNITY_TYPE_CONFIG];
        result.push({
          title: config?.label?.toUpperCase() || type.toUpperCase(),
          data: communities.slice(0, 10), // Limit per type
        });
      }
    }

    return result;
  }, [isSearchMode, searchResults, userCommunities, popularCommunities]);

  const handleDismiss = useCallback(() => {
    router.back();
  }, [router]);

  const handleSuccess = useCallback(() => {
    router.replace('/(tabs)/connect');
  }, [router]);

  const handleSelectCommunity = useCallback((community: Community) => {
    // For venue communities, we need to pass the linked_entity_id as venueId
    const venueId = community.community_type === 'venue' ? community.linked_entity_id : undefined;
    setSelectedCommunity({ id: community.id, venueId: venueId || undefined });
  }, []);

  const handleCreateCommunity = useCallback(() => {
    router.push('/community/create');
  }, [router]);

  // POI-anchored knowledge posts skip the community picker entirely —
  // the place IS the destination (createPost accepts poi_id alone).
  if (poiId) {
    return (
      <View style={styles.container}>
        <PostComposer
          visible={true}
          poiId={poiId}
          poiName={poiName}
          interestSlug={interestSlug}
          onDismiss={handleDismiss}
          onSuccess={handleSuccess}
        />
      </View>
    );
  }

  // If we have a community selected, show the composer
  // Allow posting if we have either a venueId OR a communityId
  if (selectedCommunity && (selectedCommunity.venueId || selectedCommunity.id)) {
    return (
      <View style={styles.container}>
        <PostComposer
          visible={true}
          venueId={selectedCommunity.venueId || undefined}
          communityId={selectedCommunity.id || undefined}
          areaPoiId={areaPoiId}
          catalogRaceId={catalogRaceId}
          catalogRaceName={catalogRaceName}
          onDismiss={handleDismiss}
          onSuccess={handleSuccess}
        />
      </View>
    );
  }

  const hasResults = sections.some((s) => s.data.length > 0);

  // Otherwise show community picker
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleDismiss} hitSlop={8}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Choose Community</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={16}
          color={IOS_COLORS.tertiaryLabel}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search communities..."
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
          autoFocus
        />
      </View>

      {isLoading || isSearching ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
        </View>
      ) : !hasResults ? (
        <View style={styles.empty}>
          <Ionicons
            name="people-outline"
            size={48}
            color={IOS_COLORS.systemGray3}
          />
          <Text style={styles.emptyTitle}>
            {searchQuery.trim() ? 'No communities found' : 'No communities available'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery.trim()
              ? 'Try a different search term or create a new community'
              : 'Join some communities or create your own'}
          </Text>
          {/* Create community CTA in empty state */}
          <Pressable style={styles.createButton} onPress={handleCreateCommunity}>
            <Ionicons
              name="add-circle-outline"
              size={20}
              color={IOS_COLORS.systemBlue}
            />
            <Text style={styles.createButtonText}>Create a Community</Text>
          </Pressable>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionTitle}>{title}</Text>
          )}
          renderItem={({ item }) => {
            const typeConfig = COMMUNITY_TYPE_CONFIG[item.community_type as keyof typeof COMMUNITY_TYPE_CONFIG];
            return (
              <Pressable
                style={styles.communityRow}
                onPress={() => handleSelectCommunity(item)}
              >
                <View style={[styles.communityIcon, { backgroundColor: typeConfig?.bgColor || '#F3F4F6' }]}>
                  <Ionicons
                    name={(typeConfig?.icon as any) || 'chatbubbles-outline'}
                    size={20}
                    color={typeConfig?.color || IOS_COLORS.secondaryLabel}
                  />
                </View>
                <View style={styles.communityInfo}>
                  <Text style={styles.communityName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.communityMeta} numberOfLines={1}>
                    {item.member_count.toLocaleString()} members · {typeConfig?.label || item.community_type}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={IOS_COLORS.tertiaryLabel}
                />
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderSectionFooter={() => <View style={styles.sectionFooter} />}
          ListFooterComponent={() => (
            <Pressable
              style={styles.listFooter}
              onPress={handleCreateCommunity}
            >
              <Ionicons
                name="add-circle-outline"
                size={20}
                color={IOS_COLORS.systemBlue}
              />
              <View>
                <Text style={styles.createTitle}>
                  Can't find your community?
                </Text>
                <Text style={styles.createSubtitle}>
                  Create a new one
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: IOS_COLORS.systemGroupedBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  cancelText: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.systemBlue,
  },
  headerTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
  },
  headerSpacer: {
    width: 50,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: IOS_SPACING.lg,
    marginTop: IOS_SPACING.md,
    marginBottom: IOS_SPACING.sm,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: IOS_RADIUS.sm,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: IOS_COLORS.label,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
      default: {},
    }),
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: IOS_COLORS.secondaryLabel,
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.sm,
  },
  sectionFooter: {
    height: IOS_SPACING.xs,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    padding: 32,
  },
  emptyTitle: {
    ...IOS_TYPOGRAPHY.title3,
    color: IOS_COLORS.label,
    marginTop: IOS_SPACING.md,
  },
  emptySubtitle: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  communityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.md,
  },
  communityIcon: {
    width: 40,
    height: 40,
    borderRadius: IOS_RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: IOS_SPACING.md,
  },
  communityInfo: {
    flex: 1,
    gap: 2,
  },
  communityName: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.label,
    fontWeight: '500',
  },
  communityMeta: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOS_COLORS.separator,
    marginLeft: IOS_SPACING.lg + 40 + IOS_SPACING.md, // Icon width + margins
  },
  listFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.xl,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.sm,
    marginTop: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.sm,
    paddingHorizontal: IOS_SPACING.lg,
    backgroundColor: IOS_COLORS.systemBlue,
    borderRadius: IOS_RADIUS.full,
  },
  createButtonText: {
    ...IOS_TYPOGRAPHY.subhead,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  createTitle: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.systemBlue,
    fontWeight: '600',
  },
  createSubtitle: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.secondaryLabel,
  },
});
