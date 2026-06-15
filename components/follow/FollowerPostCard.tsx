/**
 * FollowerPostCard
 *
 * Card component for displaying a follower's published post in the Watch feed.
 * Matches SailorActivityCard styling patterns.
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { MessageCircle, Heart, Trash2 } from 'lucide-react-native';
import { IOS_COLORS, IOS_TYPOGRAPHY, IOS_SPACING, IOS_RADIUS } from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';
import { useAuth } from '@/providers/AuthProvider';
import type { FollowerPost, FollowerPostType } from '@/services/FollowerPostService';
import { getSafeImageUri } from '@/lib/utils/safeImageUri';

// =============================================================================
// CONSTANTS
// =============================================================================

const POST_TYPE_CONFIG: Record<FollowerPostType, { label: string; icon: string; color: string }> = {
  general: { label: 'Update', icon: 'chatbubble-outline', color: IOS_COLORS.systemBlue },
  race_recap: { label: 'Race Recap', icon: 'trophy-outline', color: IOS_COLORS.systemOrange },
  tip: { label: 'Tip', icon: 'bulb-outline', color: IOS_COLORS.systemYellow },
  gear_update: { label: 'Gear', icon: 'construct-outline', color: IOS_COLORS.systemPurple },
  milestone: { label: 'Milestone', icon: 'ribbon-outline', color: IOS_COLORS.systemGreen },
};

// =============================================================================
// COMPONENT
// =============================================================================

interface FollowerPostCardProps {
  post: FollowerPost;
  onSailorPress?: (userId: string) => void;
  onDelete?: (postId: string) => void;
}

export function FollowerPostCard({ post, onSailorPress, onDelete }: FollowerPostCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const isOwner = user?.id === post.userId;
  const typeConfig = POST_TYPE_CONFIG[post.postType] || POST_TYPE_CONFIG.general;
  const safeAvatarUrl = getSafeImageUri(post.avatarUrl);

  const handleSailorPress = useCallback(() => {
    triggerHaptic('selection');
    if (onSailorPress) {
      onSailorPress(post.userId);
    } else {
      router.push(`/profile/${post.userId}`);
    }
  }, [onSailorPress, post.userId, router]);

  const handleLinkedRacePress = useCallback(() => {
    if (post.linkedRaceId) {
      triggerHaptic('selection');
      router.push(`/profile/${post.userId}/race/${post.linkedRaceId}`);
    }
  }, [post.linkedRaceId, post.userId, router]);

  const handleDelete = useCallback(() => {
    if (onDelete) {
      triggerHaptic('warning');
      onDelete(post.id);
    }
  }, [onDelete, post.id]);

  // Format relative time
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <View style={styles.cardContainer}>
      <View style={styles.card}>
        {/* Author Header */}
        <Pressable onPress={handleSailorPress} style={styles.authorRow}>
          {safeAvatarUrl ? (
            <Image source={{ uri: safeAvatarUrl }} style={styles.avatarImage} />
          ) : (
            <View
              style={[
                styles.avatar,
                { backgroundColor: post.avatarColor || IOS_COLORS.systemGray5 },
              ]}
            >
              <Text style={styles.avatarEmoji}>{post.avatarEmoji || '⛵'}</Text>
            </View>
          )}
          <View style={styles.authorInfo}>
            <Text style={styles.authorName} numberOfLines={1}>
              {post.userName || 'Sailor'}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons
                name={typeConfig.icon as any}
                size={12}
                color={typeConfig.color}
              />
              <Text style={styles.metaText}>
                {typeConfig.label} · {formatTime(post.createdAt)}
              </Text>
            </View>
          </View>

          {/* Delete button for own posts */}
          {isOwner && onDelete && (
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.deleteButtonPressed,
              ]}
            >
              <Trash2 size={14} color={IOS_COLORS.systemRed} />
            </Pressable>
          )}
        </Pressable>

        {/* Post Content */}
        <View style={styles.contentSection}>
          <Text style={styles.contentText}>{post.content}</Text>

          {/* Linked Race */}
          {post.linkedRaceId && post.linkedRaceName && (
            <Pressable onPress={handleLinkedRacePress} style={styles.linkedRace}>
              <Ionicons name="flag-outline" size={14} color={IOS_COLORS.systemBlue} />
              <Text style={styles.linkedRaceText} numberOfLines={1}>
                {post.linkedRaceName}
              </Text>
              <Ionicons name="chevron-forward" size={12} color={IOS_COLORS.tertiaryLabel} />
            </Pressable>
          )}

          {/* Action Row */}
          <View style={styles.actionRow}>
            <View style={styles.actionButton}>
              <Heart size={14} color={IOS_COLORS.secondaryLabel} />
              <Text style={styles.actionText}>
                {post.likeCount > 0 ? post.likeCount : 'Like'}
              </Text>
            </View>
            <View style={styles.actionButton}>
              <MessageCircle size={14} color={IOS_COLORS.secondaryLabel} />
              <Text style={styles.actionText}>
                {post.commentCount > 0 ? post.commentCount : 'Comment'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.lg,
    overflow: 'hidden',
  },
  card: {
    padding: IOS_SPACING.md,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: IOS_SPACING.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: IOS_SPACING.sm,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: IOS_SPACING.sm,
  },
  avatarEmoji: {
    fontSize: 20,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    ...IOS_TYPOGRAPHY.subhead,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  metaText: {
    ...IOS_TYPOGRAPHY.caption2,
    color: IOS_COLORS.secondaryLabel,
  },
  deleteButton: {
    padding: IOS_SPACING.xs,
    borderRadius: IOS_RADIUS.sm,
  },
  deleteButtonPressed: {
    opacity: 0.6,
  },
  contentSection: {
    marginLeft: 40 + IOS_SPACING.sm, // align with text after avatar
  },
  contentText: {
    ...IOS_TYPOGRAPHY.body,
    color: IOS_COLORS.label,
    lineHeight: 22,
  },
  linkedRace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: IOS_SPACING.sm,
    paddingVertical: IOS_SPACING.xs,
    paddingHorizontal: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.sm,
  },
  linkedRaceText: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.systemBlue,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: IOS_SPACING.sm,
    gap: IOS_SPACING.md,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: IOS_SPACING.xs,
    paddingHorizontal: IOS_SPACING.sm,
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
    borderRadius: IOS_RADIUS.sm,
  },
  actionText: {
    ...IOS_TYPOGRAPHY.caption1,
    color: IOS_COLORS.secondaryLabel,
  },
});

export default FollowerPostCard;
