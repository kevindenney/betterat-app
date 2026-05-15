/**
 * NotificationsList - iOS-style Notifications List
 *
 * Features:
 * - Clean iOS design with subtle unread indicators
 * - Swipe-to-delete (like iOS Mail)
 * - Inline follow-back for follower notifications
 * - Clear visual hierarchy following Apple HIG
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import {
  UserPlus,
  Heart,
  MessageCircle,
  Flag,
  Bell,
  Trash2,
  ChevronDown,
} from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { type SocialNotification } from '@/services/NotificationService';
import { getInitials } from '@/components/account/accountStyles';
import {
  IOS_COLORS,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';
import { triggerHaptic } from '@/lib/haptics';
import { useAuth } from '@/providers/AuthProvider';
import { adoptStep } from '@/services/TimelineStepService';

// =============================================================================
// TYPES
// =============================================================================

interface NotificationsListProps {
  notifications: SocialNotification[];
  isLoading: boolean;
  onLoadMore: () => void;
  isLoadingMore: boolean;
  hasMore: boolean;
  onRefresh: () => Promise<any>;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  followingMap?: Map<string, boolean>;
  onToggleFollow?: (actorId: string, currentlyFollowing: boolean) => Promise<void>;
  /** Optional header component to render above notifications */
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
}

// =============================================================================
// HELPERS
// =============================================================================

function getNotificationIcon(type: SocialNotification['type']) {
  const iconSize = 14;
  const iconProps = { size: iconSize, strokeWidth: 2.5 };

  switch (type) {
    case 'new_follower':
      return <UserPlus {...iconProps} color={IOS_COLORS.systemBlue} />;
    case 'blueprint_subscribed':
      return <UserPlus {...iconProps} color="#6D28D9" />;
    case 'race_like':
      return <Heart {...iconProps} color={IOS_COLORS.systemPink} />;
    case 'race_comment':
    case 'race_comment_reply':
      return <MessageCircle {...iconProps} color={IOS_COLORS.systemGreen} />;
    case 'followed_user_race':
      return <Flag {...iconProps} color={IOS_COLORS.systemOrange} />;
    default:
      return <Bell {...iconProps} color={IOS_COLORS.systemGray} />;
  }
}

function getNotificationText(notification: SocialNotification): { primary: string; secondary?: string } {
  const actorName = notification.actorName || 'Someone';

  switch (notification.type) {
    case 'new_follower':
      return { primary: actorName, secondary: 'started following you' };
    case 'blueprint_subscribed': {
      const bpTitle = notification.data?.blueprint_title;
      return { primary: actorName, secondary: bpTitle ? `subscribed to "${bpTitle}"` : 'subscribed to your blueprint' };
    }
    case 'race_like':
      return {
        primary: actorName,
        secondary: `liked your race${notification.regattaName ? ` "${notification.regattaName}"` : ''}`,
      };
    case 'race_comment':
      return {
        primary: actorName,
        secondary: notification.body || 'commented on your race',
      };
    case 'race_comment_reply':
      return { primary: actorName, secondary: 'replied to your comment' };
    case 'followed_user_race':
      return {
        primary: actorName,
        secondary: `added a new race${notification.regattaName ? `: ${notification.regattaName}` : ''}`,
      };
    default:
      return { primary: notification.title, secondary: notification.body };
  }
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// =============================================================================
// NOTIFICATION ROW
// =============================================================================

interface NotificationRowProps {
  notification: SocialNotification;
  onPress: () => void;
  onDelete: () => void;
  isFollowingBack?: boolean;
  onToggleFollow?: (e: any) => void;
  isTogglingFollow?: boolean;
  isLast: boolean;
}

function NotificationRow({
  notification,
  onPress,
  onDelete,
  isFollowingBack,
  onToggleFollow,
  isTogglingFollow,
  isLast,
}: NotificationRowProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const { primary, secondary } = getNotificationText(notification);
  const isFollowerNotification = notification.type === 'new_follower' && notification.actorId;

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <Pressable
        style={styles.deleteAction}
        onPress={() => {
          swipeableRef.current?.close();
          onDelete();
        }}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <Trash2 size={22} color="#FFFFFF" />
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
    >
      <Pressable
        style={({ pressed }) => [
          styles.row,
          pressed && styles.rowPressed,
        ]}
        onPress={onPress}
      >
        {/* Unread indicator */}
        <View style={styles.unreadColumn}>
          {!notification.isRead && <View style={styles.unreadDot} />}
        </View>

        {/* Avatar with icon badge */}
        <View style={styles.avatarContainer}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: notification.actorAvatarColor || IOS_COLORS.systemBlue },
            ]}
          >
            {notification.actorAvatarEmoji ? (
              <Text style={styles.avatarEmoji}>{notification.actorAvatarEmoji}</Text>
            ) : (
              <Text style={styles.avatarInitials}>
                {getInitials(notification.actorName || 'U')}
              </Text>
            )}
          </View>
          <View style={styles.iconBadge}>
            {getNotificationIcon(notification.type)}
          </View>
        </View>

        {/* Content */}
        <View style={[styles.content, !isLast && styles.contentBorder]}>
          <View style={styles.textContainer}>
            <Text style={styles.primaryText} numberOfLines={1}>
              {primary}
              <Text style={styles.secondaryText}> {secondary}</Text>
            </Text>
            <Text style={styles.timeText}>{formatTime(notification.createdAt)}</Text>
          </View>

          {/* Follow button for follower notifications */}
          {isFollowerNotification && onToggleFollow && (
            <Pressable
              style={({ pressed }) => [
                styles.followButton,
                isFollowingBack && styles.followButtonFollowing,
                pressed && styles.followButtonPressed,
              ]}
              onPress={onToggleFollow}
              disabled={isTogglingFollow}
            >
              {isTogglingFollow ? (
                <ActivityIndicator
                  size="small"
                  color={isFollowingBack ? IOS_COLORS.label : '#FFFFFF'}
                />
              ) : (
                <View style={styles.followButtonContent}>
                  <Text
                    style={[
                      styles.followButtonText,
                      isFollowingBack && styles.followButtonTextFollowing,
                    ]}
                  >
                    {isFollowingBack ? 'Following' : 'Follow'}
                  </Text>
                  {isFollowingBack && (
                    <ChevronDown size={10} color={IOS_COLORS.label} />
                  )}
                </View>
              )}
            </Pressable>
          )}
        </View>
      </Pressable>
    </Swipeable>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function NotificationsList({
  notifications,
  isLoading,
  onLoadMore,
  isLoadingMore,
  hasMore,
  onRefresh,
  onMarkRead,
  onDelete,
  followingMap = new Map(),
  onToggleFollow,
  ListHeaderComponent,
}: NotificationsListProps) {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [togglingFollow, setTogglingFollow] = useState<string | null>(null);
  const [adoptingStepNotifId, setAdoptingStepNotifId] = useState<string | null>(null);
  const [adoptedStepNotifIds, setAdoptedStepNotifIds] = useState<Set<string>>(new Set());

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }, [onRefresh]);

  const handleFollowBack = useCallback(
    async (actorId: string, currentlyFollowing: boolean, e: any) => {
      e?.stopPropagation?.();
      if (!onToggleFollow || togglingFollow) return;

      triggerHaptic('selection');
      setTogglingFollow(actorId);

      try {
        await onToggleFollow(actorId, currentlyFollowing);
        triggerHaptic('notificationSuccess');
      } catch {
        triggerHaptic('notificationError');
      } finally {
        setTogglingFollow(null);
      }
    },
    [onToggleFollow, togglingFollow]
  );

  const handleAdoptStep = useCallback(
    async (notification: SocialNotification) => {
      if (!user?.id || adoptingStepNotifId) return;
      const sourceStepId = notification.data?.source_step_id as string | undefined;
      const interestId = notification.data?.interest_id as string | undefined;
      if (!sourceStepId) return;

      setAdoptingStepNotifId(notification.id);
      triggerHaptic('selection');

      try {
        await adoptStep(user.id, sourceStepId, interestId || '', null);
        setAdoptedStepNotifIds((prev) => new Set(prev).add(notification.id));
        triggerHaptic('notificationSuccess');
        queryClient.invalidateQueries({ queryKey: ['timeline-steps'] });
        if (!notification.isRead) onMarkRead(notification.id);
      } catch {
        triggerHaptic('notificationError');
      } finally {
        setAdoptingStepNotifId(null);
      }
    },
    [user?.id, adoptingStepNotifId, queryClient, onMarkRead],
  );

  const handlePress = useCallback(
    (notification: SocialNotification) => {
      if (!notification.isRead) {
        onMarkRead(notification.id);
      }

      switch (notification.type) {
        case 'new_follower':
          if (notification.actorId) {
            router.push(`/sailor/${notification.actorId}`);
          }
          break;
        case 'race_like':
        case 'race_comment':
        case 'race_comment_reply':
        case 'followed_user_race':
          if (notification.regattaId) {
            router.push(`/race/${notification.regattaId}`);
          }
          break;
        case 'followed_user_step_completed':
          if (notification.actorId) {
            router.push(`/person/${notification.actorId}` as any);
          }
          break;
        case 'step_suggested':
          router.push('/(tabs)/practice' as any);
          break;
      }
    },
    [router, onMarkRead]
  );

  const renderNotification = useCallback(
    ({ item, index }: { item: SocialNotification; index: number }) => {
      const isFollowingBack = item.actorId ? followingMap.get(item.actorId) : false;
      const isTogglingThis = togglingFollow === item.actorId;

      return (
        <NotificationRow
          notification={item}
          onPress={() => handlePress(item)}
          onDelete={() => onDelete(item.id)}
          isFollowingBack={isFollowingBack}
          onToggleFollow={
            item.type === 'new_follower' && item.actorId && onToggleFollow
              ? (e) => handleFollowBack(item.actorId!, isFollowingBack || false, e)
              : undefined
          }
          isTogglingFollow={isTogglingThis}
          onAdoptStep={
            item.type === 'step_suggested' && item.data?.source_step_id
              ? () => handleAdoptStep(item)
              : undefined
          }
          isAdoptingStep={adoptingStepNotifId === item.id}
          isStepAdopted={adoptedStepNotifIds.has(item.id)}
          isLast={index === notifications.length - 1}
        />
      );
    },
    [notifications.length, handlePress, onDelete, followingMap, togglingFollow, onToggleFollow, handleFollowBack, handleAdoptStep, adoptingStepNotifId, adoptedStepNotifIds]
  );

  const keyExtractor = useCallback((item: SocialNotification) => item.id, []);

  const ListEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={IOS_COLORS.systemGray3} />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Bell size={40} color={IOS_COLORS.systemGray3} strokeWidth={1.5} />
        </View>
        <Text style={styles.emptyTitle}>No Notifications</Text>
        <Text style={styles.emptyText}>
          When someone follows you or interacts with your races, you'll see it here.
        </Text>
      </View>
    );
  };

  const ListFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoading}>
        <ActivityIndicator size="small" color={IOS_COLORS.systemGray3} />
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={keyExtractor}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        onEndReached={hasMore ? onLoadMore : undefined}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={IOS_COLORS.systemGray3}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </GestureHandlerRootView>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
  },
  rowPressed: {
    backgroundColor: IOS_COLORS.tertiarySystemGroupedBackground,
  },

  // Unread indicator
  unreadColumn: {
    width: 20,
    alignItems: 'center',
    paddingTop: IOS_SPACING.md + 14,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: IOS_COLORS.systemBlue,
  },

  // Avatar
  avatarContainer: {
    position: 'relative',
    paddingVertical: IOS_SPACING.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 18,
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  iconBadge: {
    position: 'absolute',
    bottom: IOS_SPACING.md - 4,
    right: -6,
    backgroundColor: IOS_COLORS.secondarySystemGroupedBackground,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  // Content
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: IOS_SPACING.sm,
    paddingRight: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.md,
    minHeight: 64,
  },
  contentBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOS_COLORS.separator,
  },
  textContainer: {
    flex: 1,
    marginRight: IOS_SPACING.sm,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: IOS_COLORS.label,
    lineHeight: 20,
  },
  secondaryText: {
    fontWeight: '400',
    color: IOS_COLORS.label,
  },
  timeText: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
    marginTop: 2,
  },

  // Follow button
  followButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: IOS_COLORS.systemBlue,
    borderRadius: IOS_RADIUS.lg,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButtonFollowing: {
    backgroundColor: IOS_COLORS.tertiarySystemFill,
  },
  followButtonPressed: {
    opacity: 0.8,
  },
  followButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  followButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  followButtonTextFollowing: {
    color: IOS_COLORS.label,
  },

  // Delete action
  deleteAction: {
    backgroundColor: IOS_COLORS.systemRed,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: IOS_SPACING.xxl,
    marginTop: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: IOS_COLORS.systemGray6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: IOS_SPACING.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: IOS_COLORS.label,
    marginBottom: IOS_SPACING.xs,
  },
  emptyText: {
    fontSize: 15,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Footer
  footerLoading: {
    paddingVertical: IOS_SPACING.lg,
    alignItems: 'center',
  },
});
