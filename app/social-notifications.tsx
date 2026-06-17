/**
 * Unified Activity Screen
 *
 * Apple-style activity feed with large title, vertical messages preview,
 * and time-grouped notifications with improved visual hierarchy.
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SectionList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MessagesPreviewList } from '@/components/activity/MessagesPreviewList';
import { NotificationRow } from '@/components/social/NotificationRow';
import { useNotifications } from '@/hooks/useNotifications';
import { useCrewThreads } from '@/hooks/useCrewThreads';
import { useSailorSuggestions } from '@/hooks/useSailorSuggestions';
import { useAuth } from '@/providers/AuthProvider';
import { CrewFinderService } from '@/services/CrewFinderService';
import { supabase } from '@/services/supabase';
import { routeCohortDiscussionNotification } from '@/lib/notifications/routeDiscussionNotification';
import { type NotificationGroup } from '@/lib/notifications/dedupe';
import { getInitials } from '@/components/account/accountStyles';
import { triggerHaptic } from '@/lib/haptics';
import { showAlert } from '@/lib/utils/crossPlatformAlert';
import {
  IOS_COLORS,
  IOS_SPACING,
  IOS_RADIUS,
} from '@/lib/design-tokens-ios';
import { fontFamily } from '@/lib/design-tokens-editorial';
import { STEP_PALETTE } from '@/lib/step-theme';

// =============================================================================
// TYPES
// =============================================================================

interface GroupedNotificationSection {
  title: string;
  data: NotificationGroup[];
  unreadCount: number;
}

interface RawNotificationSection {
  title: string;
  data: SocialNotification[];
  unreadCount: number;
}

// =============================================================================
// HELPERS
// =============================================================================

function groupGroupedNotificationsByTime(notifications: NotificationGroup[]): GroupedNotificationSection[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const today: NotificationGroup[] = [];
  const yesterday: NotificationGroup[] = [];
  const thisWeek: NotificationGroup[] = [];
  const earlier: NotificationGroup[] = [];

  notifications.forEach((n) => {
    const date = new Date(n.latestAt);
    if (date >= todayStart) {
      today.push(n);
    } else if (date >= yesterdayStart) {
      yesterday.push(n);
    } else if (date >= weekStart) {
      thisWeek.push(n);
    } else {
      earlier.push(n);
    }
  });

  const sections: GroupedNotificationSection[] = [];

  if (today.length > 0) {
    sections.push({
      title: 'Today',
      data: today,
      unreadCount: today.filter((n) => n.hasUnread).length,
    });
  }
  if (yesterday.length > 0) {
    sections.push({
      title: 'Yesterday',
      data: yesterday,
      unreadCount: yesterday.filter((n) => n.hasUnread).length,
    });
  }
  if (thisWeek.length > 0) {
    sections.push({
      title: 'This Week',
      data: thisWeek,
      unreadCount: thisWeek.filter((n) => n.hasUnread).length,
    });
  }
  if (earlier.length > 0) {
    sections.push({
      title: 'Earlier',
      data: earlier,
      unreadCount: earlier.filter((n) => n.hasUnread).length,
    });
  }

  return sections;
}

function groupRawNotificationsByTime(notifications: SocialNotification[]): RawNotificationSection[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const today: SocialNotification[] = [];
  const yesterday: SocialNotification[] = [];
  const thisWeek: SocialNotification[] = [];
  const earlier: SocialNotification[] = [];

  notifications.forEach((n) => {
    const date = new Date(n.createdAt);
    if (date >= todayStart) {
      today.push(n);
    } else if (date >= yesterdayStart) {
      yesterday.push(n);
    } else if (date >= weekStart) {
      thisWeek.push(n);
    } else {
      earlier.push(n);
    }
  });

  const sections: RawNotificationSection[] = [];
  if (today.length > 0) sections.push({ title: 'Today', data: today, unreadCount: today.filter((n) => !n.isRead).length });
  if (yesterday.length > 0) sections.push({ title: 'Yesterday', data: yesterday, unreadCount: yesterday.filter((n) => !n.isRead).length });
  if (thisWeek.length > 0) sections.push({ title: 'This Week', data: thisWeek, unreadCount: thisWeek.filter((n) => !n.isRead).length });
  if (earlier.length > 0) sections.push({ title: 'Earlier', data: earlier, unreadCount: earlier.filter((n) => !n.isRead).length });
  return sections;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

// =============================================================================
// AVATAR COLORS
// =============================================================================

const AVATAR_COLORS = [
  IOS_COLORS.systemBlue,
  IOS_COLORS.systemGreen,
  IOS_COLORS.systemOrange,
  IOS_COLORS.systemRed,
  IOS_COLORS.systemPurple,
  IOS_COLORS.systemPink,
  IOS_COLORS.systemTeal,
  IOS_COLORS.systemIndigo,
] as const;

function getAvatarColor(userId: string): string {
  return AVATAR_COLORS[userId.charCodeAt(0) % AVATAR_COLORS.length];
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function SocialNotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { threads } = useCrewThreads();
  const {
    groupedNotifications,
    rawNotifications,
    unreadCountGrouped,
    unreadCountRaw,
    isLoading,
    hasMore,
    loadMore,
    isLoadingMore,
    refresh,
    markAsRead,
    markAllAsRead,
    markGroupAsRead,
    deleteNotification,
  } = useNotifications();
  const [viewMode, setViewMode] = useState<'grouped' | 'all'>('grouped');

  // Sailor suggestions
  const {
    suggestions,
    followedIds,
    toggleFollow: toggleSuggestionFollow,
  } = useSailorSuggestions();

  // Filter to unfollowed suggestions only, limit to 5
  const unfollowedSuggestions = useMemo(() => {
    return suggestions
      .filter((s) => !followedIds.has(s.userId))
      .slice(0, 5);
  }, [suggestions, followedIds]);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const saved = window.localStorage.getItem('betterat.notifications.viewMode');
      if (saved === 'grouped' || saved === 'all') {
        setViewMode(saved);
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      window.localStorage.setItem('betterat.notifications.viewMode', viewMode);
    } catch {
      // ignore storage failures
    }
  }, [viewMode]);

  // Group notifications by time
  const groupedSections = useMemo(
    () => groupGroupedNotificationsByTime(groupedNotifications),
    [groupedNotifications]
  );
  const rawSections = useMemo(
    () => groupRawNotificationsByTime(rawNotifications),
    [rawNotifications]
  );

  // Get unique actor IDs from new_follower notifications
  const actorIds = useMemo(() => {
    const ids = groupedNotifications
      .filter((n) => n.latest.type === 'new_follower' && n.latest.actorId)
      .map((n) => n.latest.actorId as string);
    return [...new Set(ids)];
  }, [groupedNotifications]);

  // Fetch which actors the current user is following
  const { data: followingData } = useQuery({
    queryKey: ['following-status', user?.id, actorIds],
    queryFn: async () => {
      if (!user?.id || actorIds.length === 0) return new Map<string, boolean>();

      const { data } = await supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .in('following_id', actorIds);

      const followingSet = new Set((data || []).map((f: any) => f.following_id));
      const map = new Map<string, boolean>();
      actorIds.forEach((id) => map.set(id, followingSet.has(id)));
      return map;
    },
    enabled: !!user?.id && actorIds.length > 0,
    staleTime: 30 * 1000,
  });

  // Stable identity for the follow-map fallback so the two useCallbacks below
  // that read it don't re-create on every render.
  const followingMap = useMemo(
    () => followingData || new Map<string, boolean>(),
    [followingData],
  );

  // Follow/unfollow mutation
  const toggleFollowMutation = useMutation({
    mutationFn: async ({
      actorId,
      currentlyFollowing,
    }: {
      actorId: string;
      currentlyFollowing: boolean;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      if (currentlyFollowing) {
        await CrewFinderService.unfollowUser(user.id, actorId);
      } else {
        await CrewFinderService.followUser(user.id, actorId);
      }
      return { actorId, newFollowingState: !currentlyFollowing };
    },
    onSuccess: ({ actorId, newFollowingState }) => {
      queryClient.setQueryData(
        ['following-status', user?.id, actorIds],
        (old: Map<string, boolean> | undefined) => {
          const newMap = new Map(old || []);
          newMap.set(actorId, newFollowingState);
          return newMap;
        }
      );
      queryClient.invalidateQueries({ queryKey: ['following-status'] });
      queryClient.invalidateQueries({ queryKey: ['sailor-suggestions'] });
    },
    onError: (err: any, { currentlyFollowing }) => {
      showAlert(
        currentlyFollowing ? 'Could Not Unfollow' : 'Could Not Follow',
        err?.message || 'Something went wrong. Please try again.',
      );
    },
  });

  const handleToggleFollow = useCallback(
    async (actorId: string, currentlyFollowing: boolean) => {
      // onError surfaces the failure; swallow the rejection so this
      // fire-and-forget onPress handler doesn't raise an unhandled rejection.
      try {
        await toggleFollowMutation.mutateAsync({ actorId, currentlyFollowing });
      } catch {
        /* handled by mutation onError */
      }
    },
    [toggleFollowMutation]
  );

  // Handle suggestion follow
  const handleSuggestionFollow = useCallback(
    async (userId: string) => {
      triggerHaptic('selection');
      await toggleSuggestionFollow(userId);
    },
    [toggleSuggestionFollow]
  );

  // Navigate to sailor profile
  const handleSailorPress = useCallback(
    (userId: string) => {
      router.push(`/profile/${userId}`);
    },
    [router]
  );

  // Navigate to Follow tab
  const handleSeeAllSuggestions = useCallback(() => {
    router.push('/(tabs)/connect');
  }, [router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleSeeAllMessages = useCallback(() => {
    router.push('/messages');
  }, [router]);

  const totalUnreadMessages = threads.reduce((sum, t) => sum + t.unreadCount, 0);
  const visibleUnreadCount = viewMode === 'grouped' ? unreadCountGrouped : unreadCountRaw;

  // Render notification row with rounded section container
  const renderGroupedNotification = useCallback(
    ({ item, index, section }: { item: NotificationGroup; index: number; section: GroupedNotificationSection }) => {
      const latest = item.latest;
      const isFollowingBack = latest.actorId ? followingMap.get(latest.actorId) : false;
      const isFirst = index === 0;
      const isLast = index === section.data.length - 1;

      return (
        <View
          style={[
            styles.notificationRowWrapper,
            isFirst && styles.notificationRowFirst,
            isLast && styles.notificationRowLast,
          ]}
        >
          {item.count > 1 && (
            <View style={styles.groupCountChip}>
              <Text style={styles.groupCountText}>+{item.count - 1}</Text>
            </View>
          )}
          <NotificationRow
            notification={latest}
            onPress={() => {
              if (item.hasUnread) {
                if (item.ids.length > 1) {
                  markGroupAsRead(item.ids);
                } else {
                  markAsRead(latest.id);
                }
              }
              // Navigate based on type
              // eslint-disable-next-line no-console
              console.log('[social-notifications] Tap:', { type: latest.type, data: latest.data, id: latest.id });
              if (latest.type === 'new_follower' && latest.actorId) {
                router.push(`/profile/${latest.actorId}`);
              } else if (latest.type === 'org_invite_received' && latest.data?.invite_token) {
                // eslint-disable-next-line no-console
                console.log('[social-notifications] Navigating to invite:', latest.data.invite_token);
                router.push(`/invite/${latest.data.invite_token}` as any);
              } else if (latest.type === 'org_membership_approved') {
                router.push({
                  pathname: '/org-welcome-modal',
                  params: {
                    orgId: latest.data?.organization_id,
                    orgName: latest.data?.organization_name,
                  },
                } as any);
              } else if (latest.type === 'org_invite_accepted' && latest.data?.organization_id) {
                router.push('/organization/members' as any);
              } else if (latest.type === 'step_suggested') {
                // Suggestion handled via Adopt button or the Suggested Steps bar on the timeline
                // Just mark as read — no navigation needed
              } else if (latest.type === 'step_reviewed') {
                // Review feedback visible on the step's Reflect tab
                router.push('/(tabs)/races' as any);
              } else if (latest.type === 'cohort_discussion_post') {
                void routeCohortDiscussionNotification(latest, user?.id);
              } else if (latest.type === 'step_discussion_post' && latest.data?.step_id) {
                router.push({
                  pathname: '/(tabs)/races',
                  params: { selected: latest.data.step_id, tab: 'discussion' },
                } as any);
              } else if (latest.regattaId) {
                router.push(`/race/${latest.regattaId}`);
              }
            }}
            onDelete={() => {
              deleteNotification(latest.id);
            }}
            isFollowingBack={isFollowingBack}
            onToggleFollow={
              latest.type === 'new_follower' && latest.actorId
                ? () => handleToggleFollow(latest.actorId!, isFollowingBack || false)
                : undefined
            }
            isLast={isLast}
          />
        </View>
      );
    },
    [followingMap, markAsRead, markGroupAsRead, deleteNotification, handleToggleFollow, router, user?.id]
  );

  const renderRawNotification = useCallback(
    ({ item, index, section }: { item: SocialNotification; index: number; section: RawNotificationSection }) => {
      const isFollowingBack = item.actorId ? followingMap.get(item.actorId) : false;
      const isFirst = index === 0;
      const isLast = index === section.data.length - 1;

      return (
        <View
          style={[
            styles.notificationRowWrapper,
            isFirst && styles.notificationRowFirst,
            isLast && styles.notificationRowLast,
          ]}
        >
          <NotificationRow
            notification={item}
            onPress={() => {
              if (!item.isRead) markAsRead(item.id);
              if (item.type === 'new_follower' && item.actorId) {
                router.push(`/profile/${item.actorId}`);
              } else if (item.type === 'org_invite_received' && item.data?.invite_token) {
                router.push(`/invite/${item.data.invite_token}` as any);
              } else if (item.type === 'org_membership_approved') {
                router.push({
                  pathname: '/onboarding/org-welcome',
                  params: {
                    orgId: item.data?.organization_id,
                    orgName: item.data?.organization_name,
                  },
                } as any);
              } else if (item.type === 'org_invite_accepted' && item.data?.organization_id) {
                router.push('/organization/members' as any);
              } else if (item.type === 'step_suggested') {
                // Handled via Adopt button or Suggested Steps bar
              } else if (item.type === 'step_reviewed') {
                // Review feedback visible on the step's Reflect tab
                router.push('/(tabs)/races' as any);
              } else if (item.type === 'cohort_discussion_post') {
                void routeCohortDiscussionNotification(item, user?.id);
              } else if (item.type === 'step_discussion_post' && item.data?.step_id) {
                router.push({
                  pathname: '/(tabs)/races',
                  params: { selected: item.data.step_id, tab: 'discussion' },
                } as any);
              } else if (item.regattaId) {
                router.push(`/race/${item.regattaId}`);
              }
            }}
            onDelete={() => {
              deleteNotification(item.id);
            }}
            isFollowingBack={isFollowingBack}
            onToggleFollow={
              item.type === 'new_follower' && item.actorId
                ? () => handleToggleFollow(item.actorId!, isFollowingBack || false)
                : undefined
            }
            isLast={isLast}
          />
        </View>
      );
    },
    [followingMap, markAsRead, deleteNotification, handleToggleFollow, router, user?.id]
  );

  // Section header with unread count
  const renderSectionHeader = useCallback(
    ({ section }: { section: GroupedNotificationSection | RawNotificationSection }) => (
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderContent}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.unreadCount > 0 && (
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{section.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    ),
    []
  );

  // List header with large title, messages, and suggestions
  const ListHeader = useCallback(
    () => (
      <View style={styles.listHeader}>
        {/* Large Title */}
        <View style={styles.largeTitleRow}>
          <Text style={styles.largeTitle}>Activity</Text>
          {visibleUnreadCount > 0 && (
            <Pressable
              onPress={async () => {
                if (viewMode === 'grouped') {
                  await markAllAsRead();
                  return;
                }
                const ids = rawNotifications.map((notification) => notification.id);
                await markGroupAsRead(ids);
              }}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <Text style={styles.markAllText}>Mark All Read</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.viewModeRow}>
          <Pressable
            onPress={() => setViewMode('grouped')}
            style={[
              styles.viewModePill,
              viewMode === 'grouped' && styles.viewModePillActive,
            ]}
          >
            <Text
              style={[
                styles.viewModePillText,
                viewMode === 'grouped' && styles.viewModePillTextActive,
              ]}
            >
              Grouped
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('all')}
            style={[
              styles.viewModePill,
              viewMode === 'all' && styles.viewModePillActive,
            ]}
          >
            <Text
              style={[
                styles.viewModePillText,
                viewMode === 'all' && styles.viewModePillTextActive,
              ]}
            >
              All
            </Text>
          </Pressable>
        </View>

        {/* Messages Section */}
        {threads.length > 0 && (
          <View style={styles.messagesSection}>
            <Pressable
              style={styles.messagesSectionHeader}
              onPress={handleSeeAllMessages}
            >
              <View style={styles.messagesTitleRow}>
                <Text style={styles.messagesTitle}>Messages</Text>
                {totalUnreadMessages > 0 && (
                  <View style={styles.messageBadge}>
                    <Text style={styles.messageBadgeText}>
                      {totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.seeAllRow}>
                <Text style={styles.seeAllText}>See All</Text>
                <ChevronRight size={16} color={IOS_COLORS.tertiaryLabel} />
              </View>
            </Pressable>
            <MessagesPreviewList threads={threads} maxItems={3} />
          </View>
        )}

        {/* Suggestions Section */}
        {unfollowedSuggestions.length > 0 && (
          <View style={styles.suggestionsSection}>
            <Pressable
              style={styles.suggestionsSectionHeader}
              onPress={handleSeeAllSuggestions}
            >
              <Text style={styles.suggestionsTitle}>Suggestions for you</Text>
              <View style={styles.seeAllRow}>
                <Text style={styles.seeAllText}>See All</Text>
                <ChevronRight size={16} color={IOS_COLORS.tertiaryLabel} />
              </View>
            </Pressable>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsScrollContent}
            >
              {unfollowedSuggestions.map((sailor) => {
                const showEmoji = sailor.avatarEmoji && sailor.avatarEmoji !== '\u26F5';
                const avatarBg = showEmoji
                  ? sailor.avatarColor || IOS_COLORS.systemGray5
                  : getAvatarColor(sailor.userId);
                const initials = getInitials(sailor.fullName);

                return (
                  <View key={sailor.userId} style={styles.suggestionCard}>
                    <Pressable
                      onPress={() => handleSailorPress(sailor.userId)}
                      style={({ pressed }) => [
                        styles.suggestionCardInner,
                        pressed && styles.suggestionCardPressed,
                      ]}
                    >
                      <View style={[styles.suggestionAvatar, { backgroundColor: avatarBg }]}>
                        {showEmoji ? (
                          <Text style={styles.suggestionAvatarEmoji}>{sailor.avatarEmoji}</Text>
                        ) : (
                          <Text style={styles.suggestionAvatarInitials}>{initials}</Text>
                        )}
                      </View>
                      <Text style={styles.suggestionName} numberOfLines={1}>
                        {sailor.fullName.split(' ')[0]}
                      </Text>
                      {sailor.similarityReason && (
                        <Text style={styles.suggestionReason} numberOfLines={1}>
                          {sailor.similarityReason}
                        </Text>
                      )}
                    </Pressable>
                    <TouchableOpacity
                      style={styles.suggestionFollowButton}
                      onPress={() => handleSuggestionFollow(sailor.userId)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestionFollowText}>Follow</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

      </View>
    ),
    [viewMode, visibleUnreadCount, rawNotifications, threads, totalUnreadMessages, markAllAsRead, markGroupAsRead, handleSeeAllMessages, unfollowedSuggestions, handleSailorPress, handleSuggestionFollow, handleSeeAllSuggestions]
  );

  // Empty state
  const ListEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={IOS_COLORS.systemGray3} />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No Activity Yet</Text>
        <Text style={styles.emptyText}>
          When sailors follow you, comment on your races, or interact with your content, you'll see it here.
        </Text>
      </View>
    );
  }, [isLoading]);

  // Footer loader
  const ListFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={IOS_COLORS.systemGray3} />
      </View>
    );
  }, [isLoadingMore]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <GestureHandlerRootView style={styles.container}>
        {/* Minimal Nav Bar */}
        <View style={[styles.navBar, { paddingTop: insets.top }]}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
            onPress={handleBack}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <ChevronLeft size={28} color={STEP_PALETTE.textPrimary} />
          </Pressable>
        </View>

        {/* Main List */}
        <SectionList
          sections={viewMode === 'grouped' ? groupedSections : rawSections}
          renderItem={viewMode === 'grouped' ? (renderGroupedNotification as any) : (renderRawNotification as any)}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item: any) => (viewMode === 'grouped' ? item.latest.id : item.id)}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          ListFooterComponent={ListFooter}
          onEndReached={hasMore ? loadMore : undefined}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={IOS_COLORS.systemGray3}
            />
          }
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + IOS_SPACING.lg },
          ]}
          showsVerticalScrollIndicator={false}
        />
      </GestureHandlerRootView>
    </>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: STEP_PALETTE.bgPrimary,
  },

  // Nav Bar (minimal)
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: IOS_SPACING.sm,
    paddingBottom: IOS_SPACING.xs,
    backgroundColor: STEP_PALETTE.bgPrimary,
  },
  backButton: {
    padding: IOS_SPACING.xs,
    borderRadius: IOS_RADIUS.sm,
  },
  backButtonPressed: {
    opacity: 0.6,
  },

  // List content
  listContent: {
    flexGrow: 1,
    paddingHorizontal: IOS_SPACING.lg,
  },

  // List Header
  listHeader: {
    // No horizontal padding - handled by listContent
  },
  largeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: IOS_SPACING.xs,
    paddingBottom: IOS_SPACING.lg,
  },
  largeTitle: {
    // Serif page header per redesign §11 (consistent with TabScreenToolbar large
    // title — Activity is reached from a modal route, not a tab, so the toolbar
    // doesn't provide this).
    fontFamily: fontFamily.serif,
    fontSize: 30,
    fontWeight: '500',
    color: STEP_PALETTE.textPrimary,
    letterSpacing: -0.4,
  },
  markAllText: {
    fontSize: 15,
    color: STEP_PALETTE.textPrimary,
    textDecorationLine: 'underline',
    textDecorationColor: STEP_PALETTE.textTertiary,
  },
  viewModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    marginTop: -IOS_SPACING.sm,
    marginBottom: IOS_SPACING.lg,
  },
  viewModePill: {
    paddingHorizontal: IOS_SPACING.md,
    paddingVertical: IOS_SPACING.xs,
    borderRadius: IOS_RADIUS.full,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: STEP_PALETTE.borderSecondary,
  },
  viewModePillActive: {
    backgroundColor: STEP_PALETTE.ctaBg,
    borderColor: STEP_PALETTE.ctaBg,
  },
  viewModePillText: {
    fontSize: 13,
    fontWeight: '600',
    color: STEP_PALETTE.textSecondary,
  },
  viewModePillTextActive: {
    color: STEP_PALETTE.ctaText,
  },

  // Messages Section
  messagesSection: {
    marginBottom: IOS_SPACING.xl,
  },
  messagesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: IOS_SPACING.sm,
  },
  messagesTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
  },
  messagesTitle: {
    // Section titles step down from page header — use serif body 20pt to
    // distinguish from sans eyebrows below.
    fontFamily: fontFamily.serif,
    fontSize: 20,
    fontWeight: '500',
    color: STEP_PALETTE.textPrimary,
    letterSpacing: -0.3,
  },
  messageBadge: {
    backgroundColor: STEP_PALETTE.textInfo,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  messageBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: STEP_PALETTE.ctaText,
  },
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 15,
    color: STEP_PALETTE.textTertiary,
  },

  // Suggestions Section
  suggestionsSection: {
    marginBottom: IOS_SPACING.xl,
  },
  suggestionsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: IOS_SPACING.sm,
  },
  suggestionsTitle: {
    fontFamily: fontFamily.serif,
    fontSize: 20,
    fontWeight: '500',
    color: STEP_PALETTE.textPrimary,
    letterSpacing: -0.3,
  },
  suggestionsScrollContent: {
    paddingRight: IOS_SPACING.lg,
    gap: IOS_SPACING.sm,
  },
  suggestionCard: {
    width: 130,
    backgroundColor: STEP_PALETTE.bgSecondary,
    borderRadius: IOS_RADIUS.md,
    padding: IOS_SPACING.md,
    alignItems: 'center',
  },
  suggestionCardInner: {
    alignItems: 'center',
    width: '100%',
  },
  suggestionCardPressed: {
    opacity: 0.7,
  },
  suggestionAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: IOS_SPACING.sm,
  },
  suggestionAvatarEmoji: {
    fontSize: 26,
  },
  suggestionAvatarInitials: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: IOS_COLORS.label,
    textAlign: 'center',
    marginBottom: 2,
  },
  suggestionReason: {
    fontSize: 12,
    color: IOS_COLORS.secondaryLabel,
    textAlign: 'center',
    marginBottom: IOS_SPACING.sm,
  },
  suggestionFollowButton: {
    backgroundColor: STEP_PALETTE.ctaBg,
    borderRadius: IOS_RADIUS.full,
    paddingHorizontal: IOS_SPACING.lg,
    paddingVertical: IOS_SPACING.xs,
    marginTop: IOS_SPACING.xs,
  },
  suggestionFollowText: {
    fontSize: 13,
    fontWeight: '600',
    color: STEP_PALETTE.ctaText,
  },

  // Notification row wrapper for rounded corners
  notificationRowWrapper: {
    backgroundColor: STEP_PALETTE.bgSecondary,
    overflow: 'hidden',
  },
  notificationRowFirst: {
    borderTopLeftRadius: IOS_RADIUS.md,
    borderTopRightRadius: IOS_RADIUS.md,
  },
  notificationRowLast: {
    borderBottomLeftRadius: IOS_RADIUS.md,
    borderBottomRightRadius: IOS_RADIUS.md,
  },
  groupCountChip: {
    position: 'absolute',
    right: IOS_SPACING.md,
    top: IOS_SPACING.sm,
    backgroundColor: STEP_PALETTE.bgSecondary,
    borderRadius: IOS_RADIUS.full,
    paddingHorizontal: IOS_SPACING.xs,
    paddingVertical: 2,
    zIndex: 2,
  },
  groupCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: STEP_PALETTE.textTertiary,
  },

  // Section headers — sans uppercase eyebrow per audit §2.5
  sectionHeader: {
    paddingTop: IOS_SPACING.lg,
    paddingBottom: IOS_SPACING.sm,
    backgroundColor: STEP_PALETTE.bgPrimary,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: STEP_PALETTE.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  sectionBadge: {
    backgroundColor: STEP_PALETTE.textInfo,
    borderRadius: 8,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: STEP_PALETTE.ctaText,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: IOS_SPACING.xxl,
    paddingHorizontal: IOS_SPACING.lg,
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
  footerLoader: {
    paddingVertical: IOS_SPACING.lg,
    alignItems: 'center',
  },
});
