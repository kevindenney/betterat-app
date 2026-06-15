/**
 * SuggestedSailorsSection - Strava-style sailor suggestions
 *
 * Shows algorithm-based suggestions with:
 * - "X SAILORS TO FOLLOW" header
 * - "Follow All" button
 * - SailorSuggestionCard list
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSailorSuggestions } from '@/hooks/useSailorSuggestions';
import { SailorSuggestionCard } from './SailorSuggestionCard';
import { SocialService } from '@/services/SocialService';
import { useAuth } from '@/providers/AuthProvider';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_LIST_INSETS,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';
import { showAlert } from '@/lib/utils/crossPlatformAlert';

interface SuggestedSailorsSectionProps {
  searchQuery?: string;
  /** Called when a sailor is pressed (before navigation) - use to close modals */
  onSailorPress?: () => void;
}

export function SuggestedSailorsSection({
  searchQuery = '',
  onSailorPress,
}: SuggestedSailorsSectionProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { suggestions, isLoading, refresh, toggleFollow, followedIds } =
    useSailorSuggestions(searchQuery);
  const [followingAll, setFollowingAll] = useState(false);

  // Filter out already-followed sailors
  const unfollowedSuggestions = suggestions.filter(
    (s) => !followedIds.has(s.userId)
  );

  const handleFollowAll = useCallback(async () => {
    if (!user?.id || unfollowedSuggestions.length === 0) return;

    try {
      setFollowingAll(true);
      triggerHaptic('impactMedium');

      const userIds = unfollowedSuggestions.map((s) => s.userId);
      const { followed, errors } = await SocialService.followMultipleUsers(
        user.id,
        userIds
      );

      if (errors > 0) {
        showAlert(
          'Partial Success',
          `Followed ${followed} sailors. ${errors} failed.`
        );
      } else {
        triggerHaptic('notificationSuccess');
      }

      // Refresh to update the list
      await refresh();
    } catch (error) {
      console.error('Error following all:', error);
      showAlert('Error', 'Failed to follow sailors. Please try again.');
    } finally {
      setFollowingAll(false);
    }
  }, [user?.id, unfollowedSuggestions, refresh]);

  const handleSailorPress = useCallback(
    (userId: string) => {
      // Close modal first if provided
      onSailorPress?.();
      router.push(`/profile/${userId}`);
    },
    [router, onSailorPress]
  );

  const handleToggleFollow = useCallback(
    async (userId: string) => {
      triggerHaptic('selection');
      await toggleFollow(userId);
    },
    [toggleFollow]
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={IOS_COLORS.systemBlue} />
      </View>
    );
  }

  if (suggestions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Suggestions</Text>
        <Text style={styles.emptyText}>
          {searchQuery
            ? `No sailors found matching "${searchQuery}"`
            : 'Join a fleet or club to get personalized suggestions!'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with Follow All */}
      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>
            {unfollowedSuggestions.length} People to Follow
          </Text>
          <Text style={styles.headerSubtitle}>
            People in your community
          </Text>
        </View>
        {unfollowedSuggestions.length > 0 && (
          <Pressable
            onPress={handleFollowAll}
            disabled={followingAll}
            style={({ pressed }) => [
              styles.followAllButton,
              pressed && styles.followAllButtonPressed,
            ]}
          >
            {followingAll ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.followAllText}>Follow All</Text>
            )}
          </Pressable>
        )}
      </View>

      {/* Suggestions List */}
      <View style={styles.listContainer}>
        {suggestions.map((sailor) => (
          <SailorSuggestionCard
            key={sailor.userId}
            sailor={sailor}
            isFollowing={followedIds.has(sailor.userId)}
            onPress={() => handleSailorPress(sailor.userId)}
            onToggleFollow={() => handleToggleFollow(sailor.userId)}

          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    padding: IOS_SPACING.xxl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: IOS_SPACING.xl,
    alignItems: 'center',
  },
  emptyTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
    marginBottom: IOS_SPACING.sm,
  },
  emptyText: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.lg,
    paddingTop: IOS_SPACING.xl,
    paddingBottom: IOS_SPACING.md,
  },
  headerTextContainer: {
    flex: 1,
    marginRight: IOS_SPACING.md,
  },
  headerTitle: {
    ...IOS_TYPOGRAPHY.headline,
    color: IOS_COLORS.label,
  },
  headerSubtitle: {
    ...IOS_TYPOGRAPHY.footnote,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  followAllButton: {
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.sm,
    borderRadius: IOS_RADIUS.full,
    backgroundColor: IOS_COLORS.systemBlue,
    minWidth: 90,
    alignItems: 'center',
    flexShrink: 0,
  },
  followAllButtonPressed: {
    opacity: 0.7,
  },
  followAllText: {
    ...IOS_TYPOGRAPHY.subhead,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listContainer: {
    marginHorizontal: IOS_LIST_INSETS.insetGrouped.marginHorizontal,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.md,
  },
});
