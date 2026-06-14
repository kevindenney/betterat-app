/**
 * useRacePresence Hook
 *
 * Tracks which crew members are currently viewing a race detail screen
 * using Supabase Realtime Presence. No DB tables needed — presence is ephemeral.
 *
 * Usage:
 *   const { presentUserIds, isTracking } = useRacePresence({
 *     regattaId: 'some-uuid',
 *     userId: user?.id,
 *     displayName: user?.user_metadata?.full_name,
 *   });
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { realtimeService } from '@/services/RealtimeService';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('useRacePresence');

interface PresenceUser {
  userId: string;
  displayName?: string;
  joinedAt: string;
}

interface UseRacePresenceOptions {
  regattaId: string | undefined;
  userId: string | undefined;
  displayName?: string;
  /** Whether presence tracking is enabled (default: true) */
  enabled?: boolean;
}

interface UseRacePresenceReturn {
  /** Set of user IDs currently present on this race */
  presentUserIds: Set<string>;
  /** Full presence state for each user */
  presentUsers: PresenceUser[];
  /** Whether this client is actively tracking */
  isTracking: boolean;
}

export function useRacePresence({
  regattaId,
  userId,
  displayName,
  enabled = true,
}: UseRacePresenceOptions): UseRacePresenceReturn {
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const channelRef = useRef<ReturnType<typeof realtimeService.subscribePresence<PresenceUser>> | null>(null);
  const isMountedRef = useRef(true);
  const effectRunIdRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      effectRunIdRef.current += 1;
    };
  }, []);

  // Sync presence state from Supabase channel
  const syncPresence = useCallback((state: Record<string, any[]>) => {
    const users: PresenceUser[] = [];
    for (const presences of Object.values(state)) {
      for (const presence of presences) {
        if (presence.userId) {
          users.push({
            userId: presence.userId,
            displayName: presence.displayName,
            joinedAt: presence.joinedAt || new Date().toISOString(),
          });
        }
      }
    }
    setPresentUsers(users);
  }, []);

  useEffect(() => {
    const runId = ++effectRunIdRef.current;
    const canCommit = () => isMountedRef.current && runId === effectRunIdRef.current;

    if (!regattaId || !userId || !enabled) {
      if (canCommit()) {
        setPresentUsers([]);
        setIsTracking(false);
      }
      return;
    }

    const channelName = `race-presence:${regattaId}`;
    const channel = realtimeService.subscribePresence<PresenceUser>(
      channelName,
      {
        key: userId,
        onJoin: ({ newPresences }) => {
          if (!canCommit()) return;
          logger.info('Presence join:', newPresences?.length);
        },
        onLeave: ({ leftPresences }) => {
          if (!canCommit()) return;
          logger.info('Presence leave:', leftPresences?.length);
        },
        onStatus: (status) => {
          if (status !== 'SUBSCRIBED') return;
          void channelRef.current?.track({
            userId,
            displayName: displayName || 'Unknown',
            joinedAt: new Date().toISOString(),
          });
          if (canCommit()) {
            setIsTracking(true);
          }
        },
      },
      (state) => {
        if (!canCommit()) return;
        syncPresence(state);
      }
    );

    channelRef.current = channel;

    // Handle app state changes — untrack when backgrounded
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active') {
        void channel.track({
          userId,
          displayName: displayName || 'Unknown',
          joinedAt: new Date().toISOString(),
        });
      } else if (state === 'background') {
        void channel.untrack();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);

    return () => {
      subscription.remove();
      if (effectRunIdRef.current === runId) {
        effectRunIdRef.current += 1;
      }
      if (channelRef.current) {
        void channelRef.current.untrack();
        void realtimeService.unsubscribe(channelName);
        channelRef.current = null;
      }
      if (canCommit()) {
        setIsTracking(false);
      }
    };
  }, [regattaId, userId, displayName, enabled, syncPresence]);

  const presentUserIds = new Set(presentUsers.map((u) => u.userId));

  return {
    presentUserIds,
    presentUsers,
    isTracking,
  };
}

export default useRacePresence;
