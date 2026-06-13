import { useCallback, useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '@/providers/AuthProvider';
import { useOrganization } from '@/providers/OrganizationProvider';
import { programService } from '@/services/ProgramService';
import { realtimeService } from '@/services/RealtimeService';

export function useOrganizationCommunicationsUnread() {
  const { user } = useAuth();
  const { ready, activeOrganization } = useOrganization();
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadCountByProgram, setUnreadCountByProgram] = useState<Record<string, number>>({});

  const organizationId = activeOrganization?.id ?? null;
  const userId = user?.id ?? null;

  const refresh = useCallback(async () => {
    if (!organizationId || !userId) {
      setUnreadCount(0);
      setUnreadCountByProgram({});
      return;
    }
    setLoading(true);
    try {
      const [nextCount, nextCountByProgram] = await Promise.all([
        programService.getUnreadThreadCount(organizationId, userId),
        programService.getUnreadThreadCountsByProgram(organizationId, userId),
      ]);
      setUnreadCount(nextCount);
      setUnreadCountByProgram(nextCountByProgram);
    } finally {
      setLoading(false);
    }
  }, [organizationId, userId]);

  useEffect(() => {
    if (!ready || !isFocused || !organizationId || !userId) {
      return;
    }

    void refresh();

    const channelName = `org-unread-count:${organizationId}:${userId}`;
    const handleUnreadChange = () => void refresh();
    realtimeService.subscribe(
      channelName,
      {
        table: 'communication_messages',
        changes: [
          { event: '*', schema: 'public', table: 'communication_messages', filter: `organization_id=eq.${organizationId}` },
          { event: '*', schema: 'public', table: 'communication_thread_reads', filter: `organization_id=eq.${organizationId}` },
          { event: '*', schema: 'public', table: 'communication_threads', filter: `organization_id=eq.${organizationId}` },
        ],
      },
      handleUnreadChange,
    );

    const interval = setInterval(() => {
      void refresh();
    }, 60_000);

    return () => {
      clearInterval(interval);
      void realtimeService.unsubscribe(channelName, handleUnreadChange);
    };
  }, [ready, isFocused, organizationId, userId, refresh]);

  return {
    unreadCount,
    unreadCountByProgram,
    loading,
    refresh,
  };
}
