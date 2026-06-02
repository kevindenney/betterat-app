/**
 * useNotifications - Hook for social notifications
 */

import { useCallback, useEffect, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProvider';
import { NotificationService, type SocialNotification } from '@/services/NotificationService';
import { groupNotifications, type NotificationGroup } from '@/lib/notifications/dedupe';

const PAGE_SIZE = 20;

function upsertRealtimeNotificationIntoPages(previousData: any, notification: SocialNotification) {
  if (!previousData || !Array.isArray(previousData.pages)) {
    return {
      pageParams: [0],
      pages: [{ notifications: [notification], hasMore: false }],
    };
  }

  const pages = [...previousData.pages];
  if (!pages[0]) {
    pages[0] = { notifications: [notification], hasMore: false };
    return { ...previousData, pages };
  }

  // Remove any pre-existing copy of the notification from every page first.
  const nextPages = pages.map((page) => {
    const rows = Array.isArray(page?.notifications) ? page.notifications : [];
    return {
      ...page,
      notifications: rows.filter((entry: SocialNotification) => entry.id !== notification.id),
    };
  });

  const firstPage = nextPages[0] || { notifications: [], hasMore: false };
  const existingNotifications = Array.isArray(firstPage.notifications)
    ? firstPage.notifications
    : [];
  const merged = [notification, ...existingNotifications].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return bTime - aTime;
  });

  nextPages[0] = {
    ...firstPage,
    notifications: merged,
  };

  return { ...previousData, pages: nextPages };
}

function getGroupedUnreadCountFromPages(previousData: any): number {
  const rows: SocialNotification[] = previousData?.pages?.flatMap((page: any) =>
    Array.isArray(page?.notifications) ? page.notifications : []
  ) || [];
  return groupNotifications(rows, { windowHours: 24 }).unreadCount;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const subscriptionRunIdRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(user?.id ?? null);

  useEffect(() => {
    activeUserIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    return () => {
      subscriptionRunIdRef.current += 1;
    };
  }, []);

  // Fetch notifications with pagination
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['social-notifications', user?.id],
    queryFn: async ({ pageParam = 0 }) => {
      if (!user?.id) return { notifications: [], hasMore: false };
      return NotificationService.getNotifications(user.id, {
        limit: PAGE_SIZE,
        offset: pageParam,
      });
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.length * PAGE_SIZE;
    },
    initialPageParam: 0,
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Subscribe to realtime notifications via centralized NotificationService
  useEffect(() => {
    if (!user?.id) return;
    const runId = ++subscriptionRunIdRef.current;
    const targetUserId = user.id;
    const canCommit = () =>
      runId === subscriptionRunIdRef.current && activeUserIdRef.current === targetUserId;

    const unsubscribe = NotificationService.subscribeToNotifications(
      user.id,
      (notification) => {
        if (!canCommit()) return;
        queryClient.setQueryData(
          ['social-notifications', targetUserId],
          (previousData: any) =>
            upsertRealtimeNotificationIntoPages(previousData, notification)
        );
        queryClient.setQueryData(
          ['unread-notification-count', targetUserId],
          () => {
            const cache = queryClient.getQueryData(['social-notifications', targetUserId]);
            if (!cache) return notification.isRead ? 0 : 1;
            return getGroupedUnreadCountFromPages(cache);
          }
        );
        // NOTE: no invalidateQueries here. The setQueryData calls above already
        // merge the (fully enriched) realtime notification into both caches, so
        // a refetch is redundant. Invalidating per delivery caused a fetch storm
        // on reconnect, when backfill replays each missed notification one-by-one.

        // When a mentor reviews a step, invalidate the step detail cache
        // so the mentee sees the feedback in real time.
        if (notification.type === 'step_reviewed' && notification.data?.step_id) {
          queryClient.invalidateQueries({
            queryKey: ['timeline-steps', 'detail', notification.data.step_id],
          });
        }
      }
    );

    return () => {
      if (subscriptionRunIdRef.current === runId) {
        subscriptionRunIdRef.current += 1;
      }
      unsubscribe();
    };
  }, [user?.id, queryClient]);

  // Flatten pages + dedupe into grouped notifications
  const rawNotifications: SocialNotification[] =
    data?.pages.flatMap((page) => page.notifications) || [];
  const groupedResult = groupNotifications(rawNotifications, { windowHours: 24 });
  const groupedNotifications: NotificationGroup[] = groupedResult.groups;
  const unreadCountGrouped = groupedResult.unreadCount;
  const unreadCountRaw = rawNotifications.filter((notification) => !notification.isRead).length;

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: ({ notificationId, userId }: { notificationId: string; userId: string }) => {
      return NotificationService.markAsRead(userId, notificationId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['social-notifications', variables.userId],
      });
      queryClient.invalidateQueries({
        queryKey: ['unread-notification-count', variables.userId],
      });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: ({ userId, notificationIds }: { userId: string; notificationIds?: string[] }) => {
      if (notificationIds && notificationIds.length > 0) {
        return NotificationService.markManyAsRead(userId, notificationIds);
      }
      return NotificationService.markAllAsRead(userId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['social-notifications', variables.userId],
      });
      queryClient.invalidateQueries({
        queryKey: ['unread-notification-count', variables.userId],
      });
    },
  });

  // Delete notification mutation
  const deleteMutation = useMutation({
    mutationFn: ({ notificationId, userId }: { notificationId: string; userId: string }) => {
      return NotificationService.deleteNotification(userId, notificationId);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['social-notifications', variables.userId],
      });
    },
  });

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      await markReadMutation.mutateAsync({ notificationId, userId: user.id });
    },
    [markReadMutation, user?.id]
  );

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) throw new Error('Not authenticated');
    const notificationIds = groupedNotifications.flatMap((group) => group.ids);
    await markAllReadMutation.mutateAsync({ userId: user.id, notificationIds });
  }, [markAllReadMutation, groupedNotifications, user?.id]);

  const markGroupAsRead = useCallback(
    async (groupIds: string[]) => {
      if (!user?.id) throw new Error('Not authenticated');
      if (groupIds.length === 0) return;
      await markAllReadMutation.mutateAsync({ userId: user.id, notificationIds: groupIds });
    },
    [markAllReadMutation, user?.id]
  );

  const deleteNotification = useCallback(
    async (notificationId: string) => {
      if (!user?.id) throw new Error('Not authenticated');
      await deleteMutation.mutateAsync({ notificationId, userId: user.id });
    },
    [deleteMutation, user?.id]
  );

  return {
    notifications: groupedNotifications,
    groupedNotifications,
    rawNotifications,
    unreadCount: unreadCountGrouped,
    unreadCountGrouped,
    unreadCountRaw,
    isLoading,
    error,
    hasMore: hasNextPage || false,
    loadMore,
    isLoadingMore: isFetchingNextPage,
    refresh: refetch,
    markAsRead,
    markAllAsRead,
    markGroupAsRead,
    deleteNotification,
  };
}

/**
 * Hook for unread notification count only
 */
export function useUnreadNotificationCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const subscriptionRunIdRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(user?.id ?? null);

  useEffect(() => {
    activeUserIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    return () => {
      subscriptionRunIdRef.current += 1;
    };
  }, []);

  const { data: unreadCount = 0, isLoading } = useQuery({
    queryKey: ['unread-notification-count', user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { notifications } = await NotificationService.getNotifications(user.id, {
        limit: 200,
        offset: 0,
      });
      return groupNotifications(notifications, { windowHours: 24 }).unreadCount;
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000,
  });

  // Subscribe to realtime count updates
  useEffect(() => {
    if (!user?.id) return;
    const runId = ++subscriptionRunIdRef.current;
    const targetUserId = user.id;
    const canCommit = () =>
      runId === subscriptionRunIdRef.current && activeUserIdRef.current === targetUserId;

    const unsubscribe = NotificationService.subscribeToNotifications(
      user.id,
      (notification) => {
        if (!canCommit()) return;
        queryClient.setQueryData(
          ['unread-notification-count', targetUserId],
          () => {
            const previousData = queryClient.getQueryData(['social-notifications', targetUserId]);
            if (!previousData) return notification.isRead ? 0 : 1;
            const nextData = upsertRealtimeNotificationIntoPages(previousData, notification);
            return getGroupedUnreadCountFromPages(nextData);
          }
        );
        // No invalidateQueries: the setQueryData above is authoritative. See the
        // note in useNotifications() — invalidating per delivery caused a refetch
        // storm during reconnect backfill.
      }
    );

    return () => {
      if (subscriptionRunIdRef.current === runId) {
        subscriptionRunIdRef.current += 1;
      }
      unsubscribe();
    };
  }, [user?.id, queryClient]);

  return {
    unreadCount,
    isLoading,
  };
}
