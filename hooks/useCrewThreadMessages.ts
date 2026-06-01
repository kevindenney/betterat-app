/**
 * useCrewThreadMessages Hook
 *
 * Fetches crew thread messages and subscribes to realtime updates via Supabase.
 * Combines initial query load with realtime INSERT events for cache-friendly updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import {
  CrewThreadService,
  CrewThreadMessage,
} from '@/services/CrewThreadService';
import { createLogger } from '@/lib/utils/logger';
import { CREW_THREADS_QUERY_KEY, CREW_THREAD_UNREAD_COUNT_KEY } from './useCrewThreads';

const logger = createLogger('useCrewThreadMessages');

/**
 * Validates if a string is a valid UUID format
 */
const isValidUUID = (id: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

interface UseCrewThreadMessagesOptions {
  threadId: string | undefined;
  /** Whether to subscribe to realtime updates (default: true) */
  realtime?: boolean;
  /** Initial page size (default: 50) */
  pageSize?: number;
  /** Auto mark as read when viewing (default: true) */
  autoMarkRead?: boolean;
}

interface UseCrewThreadMessagesReturn {
  messages: CrewThreadMessage[];
  isLoading: boolean;
  error: Error | null;
  /** Send a new text message */
  sendMessage: (text: string) => Promise<void>;
  /** Delete a message (own messages only) */
  deleteMessage: (messageId: string) => Promise<void>;
  /** Post a system message */
  postSystemMessage: (text: string) => Promise<void>;
  /** Whether a send is in progress */
  isSending: boolean;
  refetch: () => Promise<void>;
  /** Mark thread as read */
  markAsRead: () => Promise<void>;
  /** Whether there are more older messages to load */
  hasMore: boolean;
  /** Whether older messages are being loaded */
  isLoadingMore: boolean;
  /** Load older messages (for pagination) */
  loadMore: () => Promise<void>;
}

/**
 * Enrich a message row with profile data
 */
async function enrichWithProfile(msg: CrewThreadMessage): Promise<CrewThreadMessage> {
  if (!msg.userId) return msg;

  try {
    // Name lives on `profiles`; the emoji-avatar styling lives on
    // `sailor_profiles` (keyed by user_id). They must be read separately —
    // selecting avatar_emoji/avatar_color off `profiles` 42703s the whole
    // query, which made senders render as "Unknown" with no avatar.
    const [{ data: prof }, { data: sailor }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', msg.userId).maybeSingle(),
      supabase
        .from('sailor_profiles')
        .select('avatar_emoji, avatar_color')
        .eq('user_id', msg.userId)
        .maybeSingle(),
    ]);

    if (prof || sailor) {
      return {
        ...msg,
        profile: {
          fullName: prof?.full_name ?? null,
          avatarEmoji: sailor?.avatar_emoji ?? null,
          avatarColor: sailor?.avatar_color ?? null,
        },
      };
    }
  } catch {
    // Profile enrichment is best-effort
  }

  return msg;
}

export function useCrewThreadMessages({
  threadId,
  realtime = true,
  pageSize = 50,
  autoMarkRead = true,
}: UseCrewThreadMessagesOptions): UseCrewThreadMessagesReturn {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<CrewThreadMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const profileCacheRef = useRef<Record<string, CrewThreadMessage['profile']>>({});
  const messagesRef = useRef<CrewThreadMessage[]>([]);
  const isMountedRef = useRef(true);
  const activeThreadIdRef = useRef<string | undefined>(threadId);
  const fetchRunIdRef = useRef(0);
  const loadMoreRunIdRef = useRef(0);
  const realtimeRunIdRef = useRef(0);

  useEffect(() => {
    activeThreadIdRef.current = threadId;
  }, [threadId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const fetchMessages = useCallback(async () => {
    const runId = ++fetchRunIdRef.current;
    const canCommit = () => isMountedRef.current && runId === fetchRunIdRef.current;

    if (!threadId || !isValidUUID(threadId)) {
      if (!canCommit()) return;
      setMessages([]);
      setError(null);
      setIsLoading(false);
      setHasMore(false);
      return;
    }

    try {
      setError(null);
      const fetchedMessages = await CrewThreadService.getMessages(threadId, {
        limit: pageSize,
      });

      // Cache profiles
      fetchedMessages.forEach((msg) => {
        if (msg.profile) {
          profileCacheRef.current[msg.userId] = msg.profile;
        }
      });

      if (!canCommit()) return;
      setMessages(fetchedMessages);
      // If we got fewer messages than pageSize, there are no more older messages
      setHasMore(fetchedMessages.length >= pageSize);
    } catch (err) {
      logger.error('Failed to fetch messages:', err);
      if (!canCommit()) return;
      setError(err instanceof Error ? err : new Error('Failed to fetch messages'));
    } finally {
      if (!canCommit()) return;
      setIsLoading(false);
    }
  }, [threadId, pageSize]);

  // Initial load
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Mark as read on mount (if autoMarkRead)
  useEffect(() => {
    if (threadId && autoMarkRead && user?.id) {
      const targetThreadId = threadId;
      const targetUserId = user.id;
      CrewThreadService.markAsRead(threadId)
        .then(() => {
          if (!isMountedRef.current || activeThreadIdRef.current !== targetThreadId) return;
          // Invalidate unread count
          queryClient.invalidateQueries({ queryKey: [CREW_THREAD_UNREAD_COUNT_KEY, targetUserId] });
          queryClient.invalidateQueries({ queryKey: [CREW_THREADS_QUERY_KEY, targetUserId] });
        })
        .catch((err) => {
          logger.debug('Auto mark-as-read failed (non-blocking):', err);
        });
    }
  }, [threadId, autoMarkRead, user?.id, queryClient]);

  // Realtime subscription
  useEffect(() => {
    if (!threadId || !realtime || !isValidUUID(threadId)) return;
    const runId = ++realtimeRunIdRef.current;
    const targetThreadId = threadId;
    const canCommit = () => isMountedRef.current && runId === realtimeRunIdRef.current;

    const channel = supabase
      .channel(`crew-thread-messages:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'crew_thread_messages',
          filter: `thread_id=eq.${threadId}`,
        },
          async (payload) => {
            const row = payload.new as any;
          let msg: CrewThreadMessage = {
            id: row.id,
            threadId: row.thread_id,
            userId: row.user_id,
            message: row.message,
            messageType: row.message_type,
            createdAt: row.created_at,
            profile: null,
          };

          // Try cached profile first, then fetch
          if (profileCacheRef.current[msg.userId]) {
            msg.profile = profileCacheRef.current[msg.userId];
          } else {
            msg = await enrichWithProfile(msg);
            if (msg.profile) {
              profileCacheRef.current[msg.userId] = msg.profile;
            }
          }

          if (!canCommit() || activeThreadIdRef.current !== targetThreadId) return;
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });

          // Mark as read if it's not from current user
          if (autoMarkRead && msg.userId !== user?.id) {
            void CrewThreadService.markAsRead(targetThreadId);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'crew_thread_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const deletedId = payload.old.id;
          if (!canCommit() || activeThreadIdRef.current !== targetThreadId) return;
          setMessages((prev) => prev.filter((m) => m.id !== deletedId));
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          logger.error('Realtime channel error for crew thread messages');
        }
      });

    return () => {
      if (realtimeRunIdRef.current === runId) {
        realtimeRunIdRef.current += 1;
      }
      void supabase.removeChannel(channel);
    };
  }, [threadId, realtime, user?.id, autoMarkRead]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!threadId || !user?.id || !text.trim()) return;
      const targetThreadId = threadId;

      if (!isMountedRef.current || activeThreadIdRef.current !== targetThreadId) return;
      setIsSending(true);
      try {
        const newMessage = await CrewThreadService.sendMessage(threadId, text.trim());
        if (!newMessage) {
          throw new Error('Failed to send message');
        }
        // Add message to local state immediately (realtime will deduplicate)
        if (newMessage.profile) {
          profileCacheRef.current[newMessage.userId] = newMessage.profile;
        }
        if (!isMountedRef.current || activeThreadIdRef.current !== targetThreadId) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
      } catch (err) {
        logger.error('Failed to send message:', err);
        throw err;
      } finally {
        if (!isMountedRef.current) return;
        setIsSending(false);
      }
    },
    [threadId, user]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      // Optimistic removal
      const removed = messagesRef.current.find((m) => m.id === messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));

      try {
        const success = await CrewThreadService.deleteMessage(messageId);
        if (!success) throw new Error('Failed to delete message');
      } catch (err) {
        // Restore on failure
        if (removed) {
          setMessages((prev) => {
            const restored = [...prev, removed];
            restored.sort(
              (a, b) =>
                new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            return restored;
          });
        }
        logger.error('Failed to delete message:', err);
        throw err;
      }
    },
    []
  );

  const postSystemMessage = useCallback(
    async (text: string) => {
      if (!threadId || !user?.id) return;

      try {
        await CrewThreadService.sendMessage(threadId, text, 'system');
      } catch (err) {
        // System messages are best-effort
        logger.warn('Failed to post system message:', err);
      }
    },
    [threadId, user]
  );

  const markAsRead = useCallback(async () => {
    const targetThreadId = activeThreadIdRef.current;
    const targetUserId = user?.id;
    if (!targetThreadId) return;
    await CrewThreadService.markAsRead(targetThreadId);
    if (!isMountedRef.current || activeThreadIdRef.current !== targetThreadId) return;
    if (targetUserId) {
      queryClient.invalidateQueries({ queryKey: [CREW_THREAD_UNREAD_COUNT_KEY, targetUserId] });
      queryClient.invalidateQueries({ queryKey: [CREW_THREADS_QUERY_KEY, targetUserId] });
      return;
    }
    queryClient.invalidateQueries({ queryKey: [CREW_THREAD_UNREAD_COUNT_KEY] });
    queryClient.invalidateQueries({ queryKey: [CREW_THREADS_QUERY_KEY] });
  }, [queryClient, user?.id]);

  const loadMore = useCallback(async () => {
    const runId = ++loadMoreRunIdRef.current;
    const targetThreadId = threadId;
    const canCommit = () =>
      isMountedRef.current &&
      runId === loadMoreRunIdRef.current &&
      activeThreadIdRef.current === targetThreadId;

    if (!targetThreadId || !hasMore || isLoadingMore || messages.length === 0) return;

    // Get the oldest message's createdAt as the cursor
    const oldestMessage = messages[0];
    if (!oldestMessage) return;

    setIsLoadingMore(true);
    try {
      const olderMessages = await CrewThreadService.getMessages(targetThreadId, {
        limit: pageSize,
        before: oldestMessage.createdAt,
      });

      // Cache profiles from older messages
      olderMessages.forEach((msg) => {
        if (msg.profile) {
          profileCacheRef.current[msg.userId] = msg.profile;
        }
      });

      if (olderMessages.length > 0) {
        // Prepend older messages to the beginning
        if (!canCommit()) return;
        setMessages((prev) => [...olderMessages, ...prev]);
      }

      // If we got fewer than pageSize, no more messages to load
      if (!canCommit()) return;
      setHasMore(olderMessages.length >= pageSize);
    } catch (err) {
      logger.error('Failed to load more messages:', err);
    } finally {
      if (!canCommit()) return;
      setIsLoadingMore(false);
    }
  }, [threadId, hasMore, isLoadingMore, messages, pageSize]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    deleteMessage,
    postSystemMessage,
    isSending,
    refetch: fetchMessages,
    markAsRead,
    hasMore,
    isLoadingMore,
    loadMore,
  };
}

export default useCrewThreadMessages;
