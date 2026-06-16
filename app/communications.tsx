import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/providers/AuthProvider';
import { useOrganization } from '@/providers/OrganizationProvider';
import {
  CommunicationThreadRecord,
  programService,
} from '@/services/ProgramService';
import {
  buildClearProgramCommunicationsHref,
  parseCommunicationsFocusParam,
  parseProgramIdParam,
  parseProgramTitleParam,
} from '@/lib/communications/drillDown';

type ThreadRow = {
  thread: CommunicationThreadRecord;
  unread: boolean;
};

export default function CommunicationsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ focus?: string; program_id?: string; program_title?: string }>();
  const { user } = useAuth();
  const { activeOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [threads, setThreads] = useState<CommunicationThreadRecord[]>([]);
  const [unreadIds, setUnreadIds] = useState<string[]>([]);

  const organizationId = activeOrganization?.id ?? null;
  const userId = user?.id ?? null;
  const focus = parseCommunicationsFocusParam(params.focus);
  const unreadOnly = focus === 'unread';
  const selectedProgramId = parseProgramIdParam(params.program_id);
  const selectedProgramTitle = parseProgramTitleParam(params.program_title, Boolean(selectedProgramId));

  const loadData = useCallback(async () => {
    if (!organizationId || !userId) {
      setThreads([]);
      setUnreadIds([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      if (!refreshing) setLoading(true);
      const [threadRows, unreadThreadIds] = await Promise.all([
        programService.listOrganizationCommunicationThreads(organizationId, 100, {
          program_id: selectedProgramId,
        }),
        programService.listUnreadThreadIds(organizationId, userId, 1000, selectedProgramId),
      ]);
      setThreads(threadRows);
      setUnreadIds(unreadThreadIds);
    } catch (error) {
      console.error('[communications] Failed to load threads', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [organizationId, refreshing, selectedProgramId, userId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rows = useMemo<ThreadRow[]>(() => {
    const unreadSet = new Set(unreadIds);
    const base = threads.map((thread) => ({
      thread,
      unread: unreadSet.has(thread.id),
    }));
    if (!unreadOnly) return base;
    return base.filter((row) => row.unread);
  }, [threads, unreadIds, unreadOnly]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadData();
  }, [loadData]);

  const handleThreadPress = useCallback(async (threadId: string) => {
    if (!organizationId || !userId) return;
    try {
      await programService.markThreadRead(organizationId, userId, threadId);
      setUnreadIds((prev) => prev.filter((id) => id !== threadId));
      router.push((`/communications/${threadId}`) as any);
    } catch (error) {
      console.error('[communications] Failed to mark thread read', error);
    }
  }, [organizationId, router, userId]);

  const handleMarkAllRead = useCallback(async () => {
    if (!organizationId || !userId) return;
    try {
      await programService.markAllThreadsRead(organizationId, userId, selectedProgramId);
      setUnreadIds([]);
    } catch (error) {
      console.error('[communications] Failed to mark all threads read', error);
    }
  }, [organizationId, selectedProgramId, userId]);

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Loading communications…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <ThemedText style={styles.title}>Communications</ThemedText>
            <ThemedText style={styles.subtitle}>
              {selectedProgramId
                ? `Program threads${selectedProgramTitle ? ` • ${selectedProgramTitle}` : ''}`
                : unreadOnly
                  ? 'Unread threads'
                  : 'Organization thread updates'}
            </ThemedText>
          </View>
          <TouchableOpacity style={styles.actionChip} onPress={handleMarkAllRead}>
            <Ionicons name="checkmark-done-outline" size={14} color="#1D4ED8" />
            <ThemedText style={styles.actionChipText}>Mark all read</ThemedText>
          </TouchableOpacity>
        </View>

        {selectedProgramId ? (
          <View style={styles.filterRow}>
            <TouchableOpacity style={[styles.filterChip, styles.filterChipActive]}>
              <ThemedText style={[styles.filterChipText, styles.filterChipTextActive]}>
                Program: {selectedProgramTitle || selectedProgramId}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterChip}
              onPress={() => router.replace(buildClearProgramCommunicationsHref(params) as any)}
            >
              <ThemedText style={styles.filterChipText}>Clear program</ThemedText>
            </TouchableOpacity>
          </View>
        ) : null}

        {rows.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color="#94A3B8" />
            <ThemedText style={styles.emptyTitle}>
              {unreadOnly ? 'No unread threads' : 'No threads yet'}
            </ThemedText>
            <ThemedText style={styles.emptyBody}>
              {unreadOnly
                ? 'You are caught up on current communication threads.'
                : 'Program and cohort communications will appear here.'}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.listColumn}>
            {rows.map(({ thread, unread }) => (
              <TouchableOpacity
                key={thread.id}
                style={[styles.threadRow, unread && styles.threadRowUnread]}
                onPress={() => void handleThreadPress(thread.id)}
              >
                <View style={styles.threadIconWrap}>
                  <Ionicons
                    name={unread ? 'mail-unread-outline' : 'mail-open-outline'}
                    size={18}
                    color={unread ? '#1D4ED8' : '#64748B'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.threadTitle}>{thread.title}</ThemedText>
                  <ThemedText style={styles.threadMeta}>
                    {thread.thread_type} • {formatDistanceToNow(new Date(thread.updated_at), { addSuffix: true })}
                  </ThemedText>
                </View>
                {unread ? <View style={styles.unreadDot} /> : null}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, gap: 14 },
  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadingText: { color: '#64748B', fontSize: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  actionChipText: { color: '#1D4ED8', fontSize: 12, fontWeight: '600' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  filterChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    borderColor: '#007AFF',
    backgroundColor: '#EFF6FF',
  },
  filterChipText: { color: '#334155', fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: '#1D4ED8' },
  listColumn: { gap: 10 },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  threadRowUnread: {
    borderColor: '#BFDBFE',
    backgroundColor: '#F8FAFF',
  },
  threadIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  threadMeta: { fontSize: 12, color: '#64748B', marginTop: 2, textTransform: 'capitalize' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1D4ED8' },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingVertical: 42,
    paddingHorizontal: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginTop: 10 },
  emptyBody: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 6, lineHeight: 18 },
});
