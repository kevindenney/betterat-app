/**
 * DiscoveryFeed
 *
 * FlatList-based component showing public race activity cards for
 * guests and users who haven't followed anyone yet. Uses the
 * usePublicDiscoveryFeed hook to fetch public race data without auth.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from 'react-native';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_TYPOGRAPHY, IOS_SPACING, IOS_RADIUS } from '@/lib/design-tokens-ios';
import { usePublicDiscoveryFeed } from '@/hooks/usePublicDiscoveryFeed';
import { useAuth } from '@/providers/AuthProvider';
import { SailorActivityCard } from './SailorActivityCard';
import type { PublicRacePreview } from '@/services/CrewFinderService';

// =============================================================================
// PROPS
// =============================================================================

interface DiscoveryFeedProps {
  toolbarOffset?: number;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

// =============================================================================
// HEADER BANNER
// =============================================================================

function DiscoveryBanner({ isGuest }: { isGuest: boolean }) {
  const router = useRouter();

  return (
    <View style={bannerStyles.container}>
      <View style={bannerStyles.iconRow}>
        <Ionicons name="compass-outline" size={28} color={IOS_COLORS.systemBlue} />
      </View>
      <Text style={bannerStyles.title}>Discover Sailors</Text>
      <Text style={bannerStyles.subtitle}>
        See what sailors are racing. Follow them to build your personalized feed.
      </Text>
      {isGuest ? (
        <Pressable
          style={bannerStyles.ctaButton}
          onPress={() => router.push('/(auth)/signup')}
        >
          <Text style={bannerStyles.ctaText}>Sign up to follow</Text>
        </Pressable>
      ) : (
        <Pressable
          style={bannerStyles.ctaButtonSecondary}
          onPress={() => router.push('/(tabs)/connect')}
        >
          <Text style={bannerStyles.ctaTextSecondary}>Browse sailors to follow</Text>
        </Pressable>
      )}
    </View>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DiscoveryFeed({ toolbarOffset = 0, onScroll }: DiscoveryFeedProps) {
  const { isGuest } = useAuth();
  const { races, isLoading, hasMore, isLoadingMore, loadMore, refresh, error } =
    usePublicDiscoveryFeed();

  const renderItem = useCallback(
    ({ item }: { item: PublicRacePreview }) => (
      <SailorActivityCard race={item} showComments={!isGuest} />
    ),
    [isGuest],
  );

  const keyExtractor = useCallback((item: PublicRacePreview) => item.id, []);
  const itemSeparator = useCallback(() => <View style={styles.separator} />, []);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: toolbarOffset }]}>
        <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { paddingTop: toolbarOffset }]}>
        <Ionicons name="cloud-offline-outline" size={48} color={IOS_COLORS.systemGray3} />
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorSubtitle}>Pull down to try again</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={races}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ItemSeparatorComponent={itemSeparator}
      contentContainerStyle={[styles.content, { paddingTop: toolbarOffset }]}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      ListHeaderComponent={<DiscoveryBanner isGuest={isGuest} />}
      onEndReached={() => {
        if (hasMore && !isLoadingMore) {
          loadMore();
        }
      }}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={refresh}
          tintColor={IOS_COLORS.systemBlue}
        />
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Ionicons name="boat-outline" size={48} color={IOS_COLORS.systemGray3} />
          <Text style={styles.emptyTitle}>No races to show yet</Text>
          <Text style={styles.emptySubtitle}>
            Check back soon — sailors are adding races all the time.
          </Text>
        </View>
      }
      ListFooterComponent={
        isLoadingMore ? (
          <View style={styles.loadingFooter}>
            <ActivityIndicator size="small" color={IOS_COLORS.systemBlue} />
          </View>
        ) : null
      }
    />
  );
}

// =============================================================================
// STYLES
// =============================================================================

const bannerStyles = StyleSheet.create({
  container: {
    marginBottom: IOS_SPACING.md,
    padding: IOS_SPACING.lg,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.lg,
    alignItems: 'center',
  },
  iconRow: {
    marginBottom: IOS_SPACING.sm,
  },
  title: {
    ...IOS_TYPOGRAPHY.title3,
    fontWeight: '700',
    color: IOS_COLORS.label,
    marginBottom: IOS_SPACING.xs,
  },
  subtitle: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: IOS_SPACING.md,
  },
  ctaButton: {
    backgroundColor: '#007AFF',
    borderRadius: IOS_RADIUS.sm,
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: 10,
  },
  ctaText: {
    ...IOS_TYPOGRAPHY.callout,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  ctaButtonSecondary: {
    backgroundColor: '#DBEAFE',
    borderRadius: IOS_RADIUS.sm,
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: 10,
  },
  ctaTextSecondary: {
    ...IOS_TYPOGRAPHY.callout,
    color: '#1D4ED8',
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingBottom: 120,
  },
  separator: {
    height: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: IOS_SPACING.sm,
  },
  errorTitle: {
    ...IOS_TYPOGRAPHY.title3,
    color: IOS_COLORS.label,
    marginTop: IOS_SPACING.md,
  },
  errorSubtitle: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: IOS_SPACING.sm,
  },
  emptyTitle: {
    ...IOS_TYPOGRAPHY.title3,
    color: IOS_COLORS.label,
    marginTop: IOS_SPACING.sm,
  },
  emptySubtitle: {
    ...IOS_TYPOGRAPHY.subhead,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: IOS_SPACING.lg,
  },
  loadingFooter: {
    paddingVertical: IOS_SPACING.lg,
    alignItems: 'center',
  },
});

export default DiscoveryFeed;
