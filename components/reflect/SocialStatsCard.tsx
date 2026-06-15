/**
 * SocialStatsCard - Display follower/following counts with navigation
 *
 * Tappable card showing social stats that navigates to follower/following
 * lists when pressed, similar to Instagram/Strava profile stats.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { IOS_COLORS, IOS_SHADOWS } from '@/lib/design-tokens-ios';

interface SocialStatsCardProps {
  userId: string;
  followersCount: number;
  followingCount: number;
  isOwnProfile?: boolean;
}

function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

export function SocialStatsCard({
  userId,
  followersCount,
  followingCount,
  isOwnProfile = true,
}: SocialStatsCardProps) {
  const router = useRouter();

  const handleFollowersPress = () => {
    router.push(`/profile/${userId}/followers`);
  };

  const handleFollowingPress = () => {
    router.push(`/profile/${userId}/following`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="people" size={18} color={IOS_COLORS.systemBlue} />
        <Text style={styles.title}>Social</Text>
      </View>

      <View style={styles.statsRow}>
        {/* Followers */}
        <Pressable
          style={({ pressed }) => [
            styles.statItem,
            pressed && styles.statItemPressed,
          ]}
          onPress={handleFollowersPress}
        >
          <Text style={styles.statValue}>{formatCount(followersCount)}</Text>
          <Text style={styles.statLabel}>Followers</Text>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={IOS_COLORS.tertiaryLabel}
            style={styles.chevron}
          />
        </Pressable>

        <View style={styles.divider} />

        {/* Following */}
        <Pressable
          style={({ pressed }) => [
            styles.statItem,
            pressed && styles.statItemPressed,
          ]}
          onPress={handleFollowingPress}
        >
          <Text style={styles.statValue}>{formatCount(followingCount)}</Text>
          <Text style={styles.statLabel}>Following</Text>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={IOS_COLORS.tertiaryLabel}
            style={styles.chevron}
          />
        </Pressable>
      </View>

      {isOwnProfile && (
        <Pressable
          style={({ pressed }) => [
            styles.findFriendsButton,
            pressed && styles.findFriendsButtonPressed,
          ]}
          onPress={() => router.push('/search')}
        >
          <Ionicons name="person-add" size={16} color={IOS_COLORS.systemBlue} />
          <Text style={styles.findFriendsText}>Find People to Follow</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...IOS_SHADOWS.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
    letterSpacing: -0.41,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: IOS_COLORS.systemBackground,
    borderRadius: 10,
    overflow: 'hidden',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    position: 'relative',
  },
  statItemPressed: {
    backgroundColor: IOS_COLORS.systemGray5,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.41,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  chevron: {
    position: 'absolute',
    right: 8,
    top: '50%',
    marginTop: -7,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: IOS_COLORS.separator,
  },
  findFriendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
  },
  findFriendsButtonPressed: {
    opacity: 0.6,
  },
  findFriendsText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.systemBlue,
  },
});

export default SocialStatsCard;
