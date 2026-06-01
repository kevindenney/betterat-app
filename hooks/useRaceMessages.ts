/**
 * useRaceMessages Hook
 *
 * Fetches race messages and subscribes to realtime updates via Supabase.
 * Combines initial query load with realtime INSERT events for cache-friendly updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { isMissingIdColumn } from '@/lib/utils/supabaseSchemaFallback';
import {
  RaceMessage,
  RaceMessageRow,
  rowToRaceMessage,
} from '@/types/raceCollaboration';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('useRaceMessages');

/**
 * Validates if a string is a valid UUID format
 */
const isValidUUID = (id: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

interface UseRaceMessagesOptions {
  regattaId: string | undefined;
  /** Whether to subscribe to realtime updates (default: true) */
  realtime?: boolean;
  /** Initial page size (default: 50) */
  pageSize?: number;
}

interface UseRaceMessagesReturn {
  messages: RaceMessage[];
  isLoading: boolean;
  error: Error | null;
  /** Send a new text message */
  sendMessage: (text: string) => Promise<void>;
  /** Delete a message (own messages only) */
  deleteMessage: (messageId: string) => Promise<void>;
  /** Post a system message (e.g., checklist completion) */
  postSystemMessage: (text: string) => Promise<void>;
  /** Whether a send is in progress */
  isSending: boolean;
  refetch: () => Promise<void>;
}

/**
 * Enrich a message row with profile data
 */
async function enrichWithProfile(msg: RaceMessage): Promise<RaceMessage> {
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

export function useRaceMessages({
  regattaId,
  realtime = true,
  pageSize = 50,
}: UseRaceMessagesOptions): UseRaceMessagesReturn {
  const { user } = useAuth();
  const [messages, setMessages] = useState<RaceMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const profileCacheRef = useRef<Record<string, RaceMessage['profile']>>({});
  const messagesRef = useRef<RaceMessage[]>([]);
  const isMountedRef = useRef(true);
  const activeRegattaIdRef = useRef<string | undefined>(regattaId);
  const fetchRunIdRef = useRef(0);
  const realtimeRunIdRef = useRef(0);

  useEffect(() => {
    activeRegattaIdRef.current = regattaId;
  }, [regattaId]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      fetchRunIdRef.current += 1;
      realtimeRunIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const fetchMessages = useCallback(async () => {
    const runId = ++fetchRunIdRef.current;
    const targetRegattaId = regattaId;
    const canCommit = () =>
      isMountedRef.current &&
      runId === fetchRunIdRef.current &&
      activeRegattaIdRef.current === targetRegattaId;

    if (!targetRegattaId || !isValidUUID(targetRegattaId)) {
      // Skip Supabase query for missing or demo race IDs
      if (!canCommit()) return;
      setMessages([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    try {
      if (!canCommit()) return;
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('race_messages')
        .select('*')
        .eq('regatta_id', targetRegattaId)
        .order('created_at', { ascending: true })
        .limit(pageSize);
      let rowsData = data;
      let rowsError = fetchError;

      if (isMissingIdColumn(rowsError, 'race_messages', 'regatta_id')) {
        const fallback = await supabase
          .from('race_messages')
          .select('*')
          .eq('race_id', targetRegattaId)
          .order('created_at', { ascending: true })
          .limit(pageSize);
        rowsData = fallback.data;
        rowsError = fallback.error;
      }

      if (rowsError) {
        throw new Error(rowsError.message);
      }

      const rows = (rowsData || []) as RaceMessageRow[];
      const transformed = rows.map(rowToRaceMessage);

      // Batch-load profiles
      const userIds = [...new Set(transformed.map((m) => m.userId))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        if (profiles) {
          const map: Record<string, RaceMessage['profile']> = {};
          profiles.forEach((p: any) => {
            map[p.id] = {
              fullName: p.full_name,
              avatarEmoji: p.avatar_emoji,
              avatarColor: p.avatar_color,
            };
          });
          profileCacheRef.current = { ...profileCacheRef.current, ...map };

          transformed.forEach((msg) => {
            if (map[msg.userId]) {
              msg.profile = map[msg.userId];
            }
          });
        }
      }

      if (!canCommit()) return;
      setMessages(transformed);
    } catch (err) {
      logger.error('Failed to fetch messages:', err);
      if (!canCommit()) return;
      setError(err instanceof Error ? err : new Error('Failed to fetch messages'));
    } finally {
      if (!canCommit()) return;
      setIsLoading(false);
    }
  }, [regattaId, pageSize]);

  // Initial load
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!regattaId || !realtime || !isValidUUID(regattaId) || !user?.id) return;
    const runId = ++realtimeRunIdRef.current;
    const targetRegattaId = regattaId;
    const canCommit = () =>
      isMountedRef.current &&
      runId === realtimeRunIdRef.current &&
      activeRegattaIdRef.current === targetRegattaId;

    const channel = supabase
      .channel(`race-messages:${regattaId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'race_messages',
        },
        async (payload) => {
          const row = payload.new as RaceMessageRow;
          const payloadRaceId = (row as any).regatta_id || (row as any).race_id;
          if (payloadRaceId !== targetRegattaId) return;
          let msg = rowToRaceMessage(row);

          // Try cached profile first, then fetch
          if (profileCacheRef.current[msg.userId]) {
            msg.profile = profileCacheRef.current[msg.userId];
          } else {
            msg = await enrichWithProfile(msg);
            if (msg.profile) {
              profileCacheRef.current[msg.userId] = msg.profile;
            }
          }

          if (!canCommit()) return;
          setMessages((prev) => {
            // Avoid duplicates (e.g., from optimistic insert)
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          logger.warn('Realtime channel error for race messages');
        }
      });

    return () => {
      if (realtimeRunIdRef.current === runId) {
        realtimeRunIdRef.current += 1;
      }
      void supabase.removeChannel(channel);
    };
  }, [regattaId, realtime, user?.id]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!regattaId || !user?.id || !text.trim()) return;
      const targetRegattaId = regattaId;
      const targetUserId = user.id;

      if (!isMountedRef.current || activeRegattaIdRef.current !== targetRegattaId) return;
      setIsSending(true);
      try {
        const { error: insertError } = await supabase
          .from('race_messages')
          .insert({
            regatta_id: targetRegattaId,
            user_id: targetUserId,
            message: text.trim(),
            message_type: 'text',
          });
        let insertErr = insertError;

        if (isMissingIdColumn(insertErr, 'race_messages', 'regatta_id')) {
          const fallback = await supabase
            .from('race_messages')
            .insert({
              race_id: targetRegattaId,
              user_id: targetUserId,
              message: text.trim(),
              message_type: 'text',
            });
          insertErr = fallback.error;
        }

        if (insertErr) throw new Error(insertErr.message);
      } catch (err) {
        logger.error('Failed to send message:', err);
        throw err;
      } finally {
        if (!isMountedRef.current || activeRegattaIdRef.current !== targetRegattaId) return;
        setIsSending(false);
      }
    },
    [regattaId, user]
  );

  const deleteMessage = useCallback(
    async (messageId: string) => {
      // Optimistic removal
      const removed = messagesRef.current.find((m) => m.id === messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));

      try {
        const { error: deleteError } = await supabase
          .from('race_messages')
          .delete()
          .eq('id', messageId);

        if (deleteError) throw new Error(deleteError.message);
      } catch (err) {
        // Restore on failure
        if (removed) {
          setMessages((prev) => {
            const restored = [...prev, removed];
            restored.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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
      if (!regattaId || !user?.id) return;
      const targetRegattaId = regattaId;
      const targetUserId = user.id;
      if (!isMountedRef.current || activeRegattaIdRef.current !== targetRegattaId) return;

      try {
        const { error: insertError } = await supabase
          .from('race_messages')
          .insert({
            regatta_id: targetRegattaId,
            user_id: targetUserId,
            message: text,
            message_type: 'system',
          });
        let insertErr = insertError;

        if (isMissingIdColumn(insertErr, 'race_messages', 'regatta_id')) {
          const fallback = await supabase
            .from('race_messages')
            .insert({
              race_id: targetRegattaId,
              user_id: targetUserId,
              message: text,
              message_type: 'system',
            });
          insertErr = fallback.error;
        }

        if (insertErr) {
          logger.warn('Failed to post system message:', insertErr.message);
        }
      } catch (err) {
        // System messages are best-effort — don't throw
        logger.warn('Failed to post system message:', err);
      }
    },
    [regattaId, user]
  );

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    deleteMessage,
    postSystemMessage,
    isSending,
    refetch: fetchMessages,
  };
}

export default useRaceMessages;
