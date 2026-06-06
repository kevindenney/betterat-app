/**
 * FollowContent — People segment for the Connect tab
 *
 * Single unified scroll: search → following → activity → discover more.
 * Matches the Forums tab ordering: your stuff → content → discover.
 *
 * For sailing: uses live data (SuggestedSailorsSection, WatchFeed).
 * For other interests: renders config-driven demo peers and posts.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

import { WatchFeed } from '@/components/follow';
import { useFollowActivityFeed } from '@/hooks/useFollowActivityFeed';
import { SuggestedSailorsSection } from '@/components/search/SuggestedSailorsSection';

import { useSailorSuggestions } from '@/hooks/useSailorSuggestions';
import {
  IOS_COLORS,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { useAuth } from '@/providers/AuthProvider';
import { useInterest } from '@/providers/InterestProvider';
import { getConnectDemoData } from '@/configs/connectDemoData';
import { DemoPeerCard, DemoPostCard } from './DemoCards';

// =============================================================================
// PROPS
// =============================================================================

interface FollowContentProps {
  toolbarOffset: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onGoToDiscuss?: () => void;
  /** Lifted follow state from parent */
  followedIds: Set<string>;
  onToggleFollow: (id: string) => void;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function FollowContent({
  toolbarOffset,
  onScroll,
  onGoToDiscuss: _onGoToDiscuss,
  followedIds,
  onToggleFollow,
}: FollowContentProps) {
  const { isGuest } = useAuth();
  const { currentInterest } = useInterest();
  const rawSlug = currentInterest?.slug ?? 'sail-racing';
  const isSailingInterest = rawSlug === 'sail-racing';
  const demoData = useMemo(() => getConnectDemoData(rawSlug), [rawSlug]);

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  // Sailing-specific hooks
  const { hasFollowing } = useFollowActivityFeed();
  const { suggestions } = useSailorSuggestions();

  // ----- Non-sailing interests: unified single scroll -----
  if (!isSailingInterest && demoData) {
    const filteredPeers = searchQuery
      ? demoData.peers.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : demoData.peers;

    // Build set of followed peer names for filtering posts
    const followedNames = new Set(
      demoData.peers.filter((p) => followedIds.has(p.id)).map((p) => p.name)
    );
    const followedPosts = demoData.posts.filter((p) => followedNames.has(p.authorName));

    const hasFollows = followedIds.size > 0;
    const followedPeers = filteredPeers.filter((p) => followedIds.has(p.id));
    const discoverPeers = filteredPeers.filter((p) => !followedIds.has(p.id));

    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: toolbarOffset }]}
          showsVerticalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={IOS_COLORS.secondaryLabel} style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder={demoData.searchPlaceholder}
                placeholderTextColor={IOS_COLORS.secondaryLabel}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
            </View>
          </View>

          {searchQuery ? (
            /* Search results */
            <View style={s.section}>
              <Text style={s.sectionHeaderText}>SEARCH RESULTS</Text>
              {filteredPeers.length > 0 ? (
                filteredPeers.map((peer) => (
                  <DemoPeerCard
                    key={peer.id}
                    peer={peer}
                    isFollowing={followedIds.has(peer.id)}
                    onToggleFollow={onToggleFollow}
                  />
                ))
              ) : (
                <View style={s.inlineEmpty}>
                  <Text style={s.inlineEmptyText}>No people found</Text>
                </View>
              )}
            </View>
          ) : (
            <>
              {/* Following section (your people) */}
              {hasFollows && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Text style={s.sectionHeaderText}>
                      FOLLOWING · {followedIds.size}
                    </Text>
                  </View>
                  {followedPeers.map((peer) => (
                    <DemoPeerCard
                      key={peer.id}
                      peer={peer}
                      isFollowing={true}
                      onToggleFollow={onToggleFollow}
                    />
                  ))}
                </View>
              )}

              {/* Activity — posts from followed people */}
              {hasFollows && (
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Text style={s.sectionHeaderText}>RECENT ACTIVITY</Text>
                  </View>
                  <View style={s.activityContainer}>
                    {followedPosts.length > 0 ? (
                      followedPosts.map((post) => (
                        <DemoPostCard key={post.id} post={post} />
                      ))
                    ) : (
                      <View style={s.inlineEmpty}>
                        <Ionicons name="newspaper-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
                        <Text style={s.inlineEmptyText}>
                          No posts from people you follow yet.
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Discover more people */}
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Text style={s.sectionHeaderText}>
                    {hasFollows ? 'DISCOVER MORE PEOPLE' : 'FIND PEOPLE TO FOLLOW'}
                  </Text>
                </View>
                {!hasFollows && (
                  <Text style={s.discoverSubtitle}>
                    Follow classmates and preceptors to see their activity and shared reflections.
                  </Text>
                )}
                {discoverPeers.map((peer) => (
                  <DemoPeerCard
                    key={peer.id}
                    peer={peer}
                    isFollowing={false}
                    onToggleFollow={onToggleFollow}
                  />
                ))}
                {discoverPeers.length === 0 && (
                  <View style={s.inlineEmpty}>
                    <Ionicons name="checkmark-circle-outline" size={28} color={IOS_COLORS.tertiaryLabel} />
                    <Text style={s.inlineEmptyText}>You're following everyone!</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // ----- Sailing: live data -----
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: toolbarOffset }]}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        {suggestions.length > 0 && (
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={IOS_COLORS.secondaryLabel} style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search people"
                placeholderTextColor={IOS_COLORS.secondaryLabel}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
            </View>
          </View>
        )}
        <SuggestedSailorsSection searchQuery={searchQuery} />
      </ScrollView>

      {!isGuest && hasFollowing && (
        <View style={styles.watchFeedContainer}>
          <WatchFeed hideEmptySuggestions />
        </View>
      )}
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  watchFeedContainer: { flex: 1 },
  searchContainer: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.sm,
    paddingBottom: IOS_SPACING.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOS_COLORS.tertiarySystemFill,
    borderRadius: IOS_RADIUS.sm,
    paddingHorizontal: IOS_SPACING.sm,
    height: 36,
  },
  searchIcon: { marginRight: IOS_SPACING.xs },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: IOS_COLORS.label,
    paddingVertical: 0,
  },
});

const s = StyleSheet.create({
  section: {
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.md,
    paddingBottom: IOS_SPACING.sm,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontFamily: fontFamily.mono,
    fontWeight: '500',
    letterSpacing: 0.5,
    color: IOS_COLORS.secondaryLabel,
  },
  discoverSubtitle: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    paddingHorizontal: IOS_SPACING.lg,
    marginBottom: IOS_SPACING.sm,
    lineHeight: 20,
  },
  activityContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  inlineEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  inlineEmptyText: {
    fontSize: 14,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
});
