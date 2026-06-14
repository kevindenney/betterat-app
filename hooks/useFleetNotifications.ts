import { useState, useEffect, useRef, useCallback } from 'react';
import { fleetSocialService, FleetNotification } from '@/services/FleetSocialService';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('useFleetNotifications');

export function useFleetNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<FleetNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);
  const loadRunIdRef = useRef(0);
  const subscriptionRunIdRef = useRef(0);
  const activeUserIdRef = useRef<string | undefined>(userId);

  useEffect(() => {
    activeUserIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      loadRunIdRef.current += 1;
      subscriptionRunIdRef.current += 1;
    };
  }, []);

  const loadNotifications = useCallback(async () => {
    const runId = ++loadRunIdRef.current;
    const canCommit = () => isMountedRef.current && runId === loadRunIdRef.current;
    const targetUserId = userId;
    const isSameUser = () => activeUserIdRef.current === targetUserId;

    if (!targetUserId) {
      if (!canCommit()) return;
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    if (!canCommit()) return;
    setLoading(true);

    try {
      const data = await fleetSocialService.getNotifications(targetUserId, { limit: 50 });
      if (!canCommit() || !isSameUser()) return;
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.isRead).length);
    } catch (error) {
      logger.error('Error loading notifications', error);
    } finally {
      if (!canCommit() || !isSameUser()) return;
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setNotifications([]);
    setUnreadCount(0);
    setLoading(true);
    void loadNotifications();
  }, [userId, loadNotifications]);

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;
    const runId = ++subscriptionRunIdRef.current;
    const targetUserId = userId;
    const canCommit = () =>
      isMountedRef.current &&
      runId === subscriptionRunIdRef.current &&
      activeUserIdRef.current === targetUserId;

    const unsubscribe = fleetSocialService.subscribeToNotifications(
      userId,
      (newNotification) => {
        if (!canCommit()) return;
        setNotifications((prev) => {
          if (prev.some((notification) => notification.id === newNotification.id)) {
            return prev;
          }
          return [newNotification, ...prev];
        });
        if (!newNotification.isRead) {
          setUnreadCount((prev) => prev + 1);
        }
      }
    );

    return () => {
      if (subscriptionRunIdRef.current === runId) {
        subscriptionRunIdRef.current += 1;
      }
      unsubscribe();
    };
  }, [userId]);

  const markAsRead = useCallback(async (notificationId: string) => {
    const targetUserId = activeUserIdRef.current;
    if (!targetUserId) return;

    try {
      await fleetSocialService.markNotificationRead(notificationId);
      if (!isMountedRef.current || activeUserIdRef.current !== targetUserId) return;
      let didTransitionToRead = false;
      setNotifications((prev) =>
        prev.map((n) => {
          if (n.id !== notificationId || n.isRead) return n;
          didTransitionToRead = true;
          return { ...n, isRead: true };
        })
      );
      if (didTransitionToRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      logger.error('Error marking notification as read', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const targetUserId = activeUserIdRef.current;
    if (!targetUserId) return;

    try {
      await fleetSocialService.markAllNotificationsRead(targetUserId);
      if (!isMountedRef.current || activeUserIdRef.current !== targetUserId) return;
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      logger.error('Error marking all notifications as read', error);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    loading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
  };
}
