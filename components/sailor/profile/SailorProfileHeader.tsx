/**
 * SailorProfileHeader - Profile header with avatar, name, bio, and follow stats
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Share,
} from 'react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import { ChevronLeft, Share2 } from 'lucide-react-native';
import { getInitials } from '@/components/account/accountStyles';
import { FollowButton } from '@/components/social/FollowButton';
import type { FullSailorProfile } from '@/services/SailorProfileService';
import { IOSDetailSection, ConceptCard } from '@/components/discover/detail';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
  IOS_LIST_INSETS,
  IOS_SHADOWS,
} from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';

const AVATAR_COLORS = [
  IOS_COLORS.systemBlue,
  IOS_COLORS.systemGreen,
  IOS_COLORS.systemOrange,
  IOS_COLORS.systemRed,
  IOS_COLORS.systemPurple,
  IOS_COLORS.systemTeal,
] as const;

function getAvatarColor(userId: string): string {
  return AVATAR_COLORS[userId.charCodeAt(0) % AVATAR_COLORS.length];
}

interface SailorProfileHeaderProps {
  profile: FullSailorProfile;
  onFollowersPress: () => void;
  onFollowingPress: () => void;
  onToggleFollow: () => void;
  onToggleFavorite?: () => void;
  onToggleNotifications?: () => void;
  onToggleMute?: () => void;
  isToggling: boolean;
  onBack: () => void;
}

export function SailorProfileHeader({
  profile,
  onFollowersPress,
  onFollowingPress,
  onToggleFollow,
  onToggleFavorite,
  onToggleNotifications,
  onToggleMute,
  isToggling,
  onBack,
}: SailorProfileHeaderProps) {
  const showEmoji =
    profile.avatarEmoji && profile.avatarEmoji !== '\u26F5';
  const avatarBg = showEmoji
    ? profile.avatarColor || IOS_COLORS.systemGray5
    : getAvatarColor(profile.userId);
  const initials = getInitials(profile.displayName);

  const handleShare = async () => {
    try {
      triggerHaptic('selection');
      const profileUrl = `https://regattaflow.app/profile/${profile.userId}`;
      await Share.share({
        message: `Check out ${profile.displayName} on RegattaFlow! ${profileUrl}`,
        url: profileUrl,
        title: `${profile.displayName} on RegattaFlow`,
      });
    } catch (error) {
      if ((error as Error).message !== 'User did not share') {
        showAlert('Error', 'Failed to share profile');
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Navigation Bar */}
      <View style={styles.navBar}>
        <Pressable
          style={({ pressed }) => [
            styles.navButton,
            pressed && styles.navButtonPressed,
          ]}
          onPress={onBack}
        >
          <ChevronLeft size={24} color={IOS_COLORS.systemBlue} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.navButton,
            pressed && styles.navButtonPressed,
          ]}
          onPress={handleShare}
        >
          <Share2 size={20} color={IOS_COLORS.systemBlue} />
        </Pressable>
      </View>

      {/* Profile Content */}
      <View style={styles.profileCard}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
          {showEmoji ? (
            <Text style={styles.avatarEmoji}>{profile.avatarEmoji}</Text>
          ) : (
            <Text style={styles.avatarInitials}>{initials}</Text>
          )}
        </View>

        {/* Name & Location */}
        <Text style={styles.name}>{profile.displayName}</Text>
        {profile.location && (
          <Text style={styles.location}>{profile.location}</Text>
        )}

        {/* Follow Stats */}
        <View style={styles.statsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.statItem,
              pressed && styles.statItemPressed,
            ]}
            onPress={onFollowersPress}
          >
            <Text style={styles.statValue}>{profile.followerCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </Pressable>
          <View style={styles.statDivider} />
          <Pressable
            style={({ pressed }) => [
              styles.statItem,
              pressed && styles.statItemPressed,
            ]}
            onPress={onFollowingPress}
          >
            <Text style={styles.statValue}>{profile.followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </Pressable>
        </View>

        {/* Action Buttons */}
        {!profile.isOwnProfile && (
          <View style={styles.actionRow}>
            <FollowButton
              isFollowing={profile.isFollowing}
              onFollow={onToggleFollow}
              onUnfollow={onToggleFollow}
              userName={profile.displayName}
              isLoading={isToggling}
              isFavorite={profile.isFavorite}
              notificationsEnabled={profile.notificationsEnabled}
              isMuted={profile.isMuted}
              onToggleFavorite={onToggleFavorite}
              onToggleNotifications={onToggleNotifications}
              onToggleMute={onToggleMute}
            />
          </View>
        )}
      </View>

      {/* Working on now — the practice signal carried over from Discover
          Person detail. Same coral CURRENT CONCEPT treatment so the public
          face matches the canonical practice-signal voice. */}
      {profile.bio ? (
        <IOSDetailSection header="Working on now" bare>
          <ConceptCard text={profile.bio} />
        </IOSDetailSection>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: IOS_SPACING.sm,
  },
  navButton: {
    padding: IOS_SPACING.sm,
    borderRadius: IOS_RADIUS.full,
  },
  navButtonPressed: {
    backgroundColor: IOS_COLORS.quaternarySystemFill,
  },
  profileCard: {
    alignItems: 'center',
    paddingHorizontal: IOS_LIST_INSETS.insetGrouped.marginHorizontal,
    paddingBottom: IOS_SPACING.xl,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: IOS_SPACING.md,
    ...IOS_SHADOWS.md,
  },
  avatarEmoji: {
    fontSize: 44,
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  name: {
    ...IOS_TYPOGRAPHY.title2,
    fontWeight: '700',
    color: IOS_COLORS.label,
    textAlign: 'center',
  },
  location: {
    ...IOS_TYPOGRAPHY.subheadline,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  bio: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    marginTop: IOS_SPACING.md,
    paddingHorizontal: IOS_SPACING.xl,
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: IOS_SPACING.lg,
    paddingHorizontal: IOS_SPACING.xl,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: IOS_SPACING.sm,
    borderRadius: IOS_RADIUS.sm,
  },
  statItemPressed: {
    backgroundColor: IOS_COLORS.quaternarySystemFill,
  },
  statValue: {
    ...IOS_TYPOGRAPHY.headline,
    fontWeight: '700',
    color: IOS_COLORS.label,
  },
  statLabel: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: IOS_COLORS.separator,
    marginHorizontal: IOS_SPACING.md,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: IOS_SPACING.lg,
    gap: IOS_SPACING.md,
  },
  followButton: {
    flex: 1,
    maxWidth: 200,
  },
});
