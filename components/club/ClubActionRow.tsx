/**
 * ClubActionRow - Strava-style club action icons
 *
 * Displays a row of action icons for club pages:
 * - Join/Leave toggle
 * - Overview (scroll to about)
 * - Share club link
 * - Stats (club leaderboard)
 * - Posts (club feed)
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Share,
  StyleSheet,
} from 'react-native';
import {
  UserPlus,
  UserMinus,
  Info,
  Share2,
  BarChart3,
  MessageSquare,
} from 'lucide-react-native';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import {
  IOS_COLORS,
  IOS_TYPOGRAPHY,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';

interface ClubActionRowProps {
  clubId: string;
  clubName: string;
  /** Whether the current user has joined this club */
  isMember: boolean;
  /** Whether join/leave is currently in progress */
  isJoining?: boolean;
  /** Callback when join/leave is pressed */
  onToggleMembership: () => void;
  /** Callback when Overview is pressed */
  onOverview?: () => void;
  /** Callback when Stats is pressed */
  onStats?: () => void;
  /** Callback when Posts is pressed */
  onPosts?: () => void;
}

interface ActionIconProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  isActive?: boolean;
  isLoading?: boolean;
}

function ActionIcon({ icon, label, onPress, isActive, isLoading }: ActionIconProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionIcon,
        pressed && styles.actionIconPressed,
      ]}
      onPress={onPress}
      disabled={isLoading}
    >
      <View
        style={[
          styles.iconCircle,
          isActive && styles.iconCircleActive,
        ]}
      >
        {icon}
      </View>
      <Text style={[styles.actionLabel, isActive && styles.actionLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ClubActionRow({
  clubId,
  clubName,
  isMember,
  isJoining = false,
  onToggleMembership,
  onOverview,
  onStats,
  onPosts,
}: ClubActionRowProps) {
  const handleShare = useCallback(async () => {
    triggerHaptic('selection');

    const clubUrl = `https://better.at/club/${clubId}`;
    const message = `Check out ${clubName} on BetterAt! ${clubUrl}`;

    try {
      await Share.share({
        message,
        title: `${clubName} on BetterAt`,
        url: clubUrl,
      });
    } catch (error) {
      if ((error as Error).message !== 'User did not share') {
        showAlert('Error', 'Failed to share club');
      }
    }
  }, [clubId, clubName]);

  const handleJoinLeave = useCallback(() => {
    triggerHaptic('selection');
    onToggleMembership();
  }, [onToggleMembership]);

  const handleOverview = useCallback(() => {
    triggerHaptic('selection');
    onOverview?.();
  }, [onOverview]);

  const handleStats = useCallback(() => {
    triggerHaptic('selection');
    onStats?.();
  }, [onStats]);

  const handlePosts = useCallback(() => {
    triggerHaptic('selection');
    onPosts?.();
  }, [onPosts]);

  return (
    <View style={styles.container}>
      {/* Join/Leave */}
      <ActionIcon
        icon={
          isMember ? (
            <UserMinus size={20} color={IOS_COLORS.systemRed} />
          ) : (
            <UserPlus size={20} color={IOS_COLORS.systemBlue} />
          )
        }
        label={isMember ? 'Leave' : 'Join'}
        onPress={handleJoinLeave}
        isActive={isMember}
        isLoading={isJoining}
      />

      {/* Overview */}
      {onOverview && (
        <ActionIcon
          icon={<Info size={20} color={IOS_COLORS.secondaryLabel} />}
          label="Overview"
          onPress={handleOverview}
        />
      )}

      {/* Share */}
      <ActionIcon
        icon={<Share2 size={20} color={IOS_COLORS.secondaryLabel} />}
        label="Share"
        onPress={handleShare}
      />

      {/* Stats */}
      {onStats && (
        <ActionIcon
          icon={<BarChart3 size={20} color={IOS_COLORS.secondaryLabel} />}
          label="Stats"
          onPress={handleStats}
        />
      )}

      {/* Posts */}
      {onPosts && (
        <ActionIcon
          icon={<MessageSquare size={20} color={IOS_COLORS.secondaryLabel} />}
          label="Posts"
          onPress={handlePosts}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: IOS_SPACING.md,
    paddingHorizontal: IOS_SPACING.lg,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.lg,
    marginHorizontal: IOS_SPACING.lg,
    marginTop: IOS_SPACING.md,
  },
  actionIcon: {
    alignItems: 'center',
    minWidth: 56,
  },
  actionIconPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: IOS_COLORS.systemGray6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: IOS_SPACING.xs,
  },
  iconCircleActive: {
    backgroundColor: IOS_COLORS.systemBlue + '15',
  },
  actionLabel: {
    ...IOS_TYPOGRAPHY.caption2,
    color: IOS_COLORS.secondaryLabel,
  },
  actionLabelActive: {
    color: IOS_COLORS.systemBlue,
    fontWeight: '500',
  },
});
