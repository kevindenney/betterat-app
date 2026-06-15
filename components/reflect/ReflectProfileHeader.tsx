/**
 * ReflectProfileHeader - Strava-style profile header for Reflect tab
 *
 * Shows avatar, name, bio, follower counts, and key stats overview.
 * Similar to Strava's profile header in the "You" tab.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { IOS_COLORS, IOS_SHADOWS } from '@/lib/design-tokens-ios';
import type { UserProfile, ProfileStats } from '@/hooks/useReflectProfile';

interface ReflectProfileHeaderProps {
  profile: UserProfile;
  stats: ProfileStats;
  onEditProfile?: () => void;
  /** Vocabulary lookup – when provided, stat labels adapt to the current interest */
  vocab?: (key: string) => string;
}

function formatMemberSince(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return `Member since ${date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })}`;
}

function formatHours(minutes: number): string {
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}

export function ReflectProfileHeader({
  profile,
  stats,
  onEditProfile,
  vocab,
}: ReflectProfileHeaderProps) {
  const isSailing = !vocab || vocab('Learning Event') === 'Race';
  const eventLabel = vocab ? vocab('Learning Event') + 's' : 'Races';
  const winsLabel = isSailing ? 'Wins' : 'Completed';
  const podiumsLabel = isSailing ? 'Podiums' : 'Top Marks';
  const timeLabel = vocab ? vocab('Do Phase') : 'On Water';
  const handleFollowersPress = () => {
    router.push(`/profile/${profile.userId}/followers`);
  };

  const handleFollowingPress = () => {
    router.push(`/profile/${profile.userId}/following`);
  };

  return (
    <View style={styles.container}>
      {/* Profile Row */}
      <View style={styles.profileRow}>
        {/* Avatar */}
        {profile.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{profile.avatarInitials}</Text>
          </View>
        )}

        {/* Name & Bio */}
        <View style={styles.profileInfo}>
          <Text style={styles.displayName} numberOfLines={1}>
            {profile.displayName}
          </Text>
          {profile.bio && (
            <Text style={styles.bio} numberOfLines={2}>
              {profile.bio}
            </Text>
          )}
          {profile.location && (
            <View style={styles.locationRow}>
              <Ionicons
                name="location-outline"
                size={12}
                color={IOS_COLORS.secondaryLabel}
              />
              <Text style={styles.locationText}>{profile.location}</Text>
              {profile.homeClub && (
                <>
                  <Text style={styles.locationDot}>·</Text>
                  <Text style={styles.locationText} numberOfLines={1}>
                    {profile.homeClub}
                  </Text>
                </>
              )}
            </View>
          )}
        </View>

        {/* Edit Button */}
        {onEditProfile && (
          <Pressable
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.editButtonPressed,
            ]}
            onPress={onEditProfile}
          >
            <Ionicons
              name="pencil"
              size={16}
              color={IOS_COLORS.systemBlue}
            />
          </Pressable>
        )}
      </View>

      {/* Followers/Following Row */}
      <View style={styles.socialRow}>
        <Pressable
          style={({ pressed }) => [
            styles.socialItem,
            pressed && styles.socialItemPressed,
          ]}
          onPress={handleFollowersPress}
        >
          <Text style={styles.socialCount}>{profile.followerCount}</Text>
          <Text style={styles.socialLabel}>Followers</Text>
        </Pressable>
        <View style={styles.socialDivider} />
        <Pressable
          style={({ pressed }) => [
            styles.socialItem,
            pressed && styles.socialItemPressed,
          ]}
          onPress={handleFollowingPress}
        >
          <Text style={styles.socialCount}>{profile.followingCount}</Text>
          <Text style={styles.socialLabel}>Following</Text>
        </Pressable>
      </View>

      {/* Quick Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: IOS_COLORS.systemBlue + '15' }]}>
            <Ionicons name="flag" size={16} color={IOS_COLORS.systemBlue} />
          </View>
          <Text style={styles.statValue}>{stats.totalRaces}</Text>
          <Text style={styles.statLabel}>{eventLabel}</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: IOS_COLORS.systemYellow + '15' }]}>
            <Ionicons name="trophy" size={16} color={IOS_COLORS.systemYellow} />
          </View>
          <Text style={styles.statValue}>{stats.totalWins}</Text>
          <Text style={styles.statLabel}>{winsLabel}</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: IOS_COLORS.systemOrange + '15' }]}>
            <Ionicons name="medal" size={16} color={IOS_COLORS.systemOrange} />
          </View>
          <Text style={styles.statValue}>{stats.totalPodiums}</Text>
          <Text style={styles.statLabel}>{podiumsLabel}</Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: IOS_COLORS.systemTeal + '15' }]}>
            <Ionicons name="time" size={16} color={IOS_COLORS.systemTeal} />
          </View>
          <Text style={styles.statValue}>{formatHours(stats.totalTimeOnWater)}</Text>
          <Text style={styles.statLabel}>{timeLabel}</Text>
        </View>
      </View>

      {/* Member Since */}
      {stats.memberSince && (
        <Text style={styles.memberSince}>
          {formatMemberSince(stats.memberSince)}
        </Text>
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
  profileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: IOS_COLORS.systemBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 20,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.41,
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    fontWeight: '400',
    color: IOS_COLORS.secondaryLabel,
    lineHeight: 18,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  locationText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    maxWidth: 150,
  },
  locationDot: {
    fontSize: 12,
    color: IOS_COLORS.tertiaryLabel,
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.systemBlue + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonPressed: {
    opacity: 0.7,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOS_COLORS.separator,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
    marginBottom: 16,
  },
  socialItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  socialItemPressed: {
    opacity: 0.6,
  },
  socialCount: {
    fontSize: 18,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.41,
  },
  socialLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  socialDivider: {
    width: 1,
    height: 24,
    backgroundColor: IOS_COLORS.separator,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: IOS_COLORS.label,
    letterSpacing: -0.24,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  memberSince: {
    fontSize: 12,
    fontWeight: '400',
    color: IOS_COLORS.tertiaryLabel,
    textAlign: 'center',
  },
});

export default ReflectProfileHeader;
