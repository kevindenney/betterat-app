import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/providers/AuthProvider';
import { useOrganization } from '@/providers/OrganizationProvider';
import {
  CommunicationMessageRecord,
  CommunicationThreadRecord,
  programService,
} from '@/services/ProgramService';

export default function CommunicationThreadDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ threadId?: string }>();
  const { user } = useAuth();
  const { activeOrganization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [thread, setThread] = useState<CommunicationThreadRecord | null>(null);
  const [messages, setMessages] = useState<CommunicationMessageRecord[]>([]);
  const [draftMessage, setDraftMessage] = useState('');

  const organizationId = activeOrganization?.id ?? null;
  const userId = user?.id ?? null;
  const threadId = String(Array.isArray(params.threadId) ? params.threadId[0] : params.threadId || '').trim();

  const loadThread = useCallback(async () => {
    if (!organizationId || !userId || !threadId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [threadRows, messageRows] = await Promise.all([
        programService.listOrganizationCommunicationThreads(organizationId, 200),
        programService.listThreadMessages(threadId, 500),
      ]);
      const match = threadRows.find((row) => row.id === threadId) || null;
      setThread(match);
      setMessages(messageRows);
      await programService.markThreadRead(organizationId, userId, threadId);
    } catch (error) {
      console.error('[communications.thread] Failed to load thread detail', error);
    } finally {
      setLoading(false);
    }
  }, [organizationId, threadId, userId]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  const submitMessage = useCallback(async () => {
    const body = draftMessage.trim();
    if (!organizationId || !userId || !threadId || !body) return;
    try {
      setSending(true);
      const created = await programService.createCommunicationMessage({
        organization_id: organizationId,
        thread_id: threadId,
        sender_id: userId,
        body,
      });
      setMessages((prev) => [...prev, created]);
      setDraftMessage('');
      await programService.markThreadRead(organizationId, userId, threadId);
    } catch (error) {
      console.error('[communications.thread] Failed to send message', error);
    } finally {
      setSending(false);
    }
  }, [draftMessage, organizationId, threadId, userId]);

  const messageRows = useMemo(() => messages, [messages]);

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Loading thread…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.title}>{thread?.title || 'Thread'}</ThemedText>
            <ThemedText style={styles.subtitle}>
              {thread?.thread_type || 'discussion'} • {messageRows.length} messages
            </ThemedText>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {messageRows.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color="#94A3B8" />
              <ThemedText style={styles.emptyTitle}>No messages yet</ThemedText>
              <ThemedText style={styles.emptyBody}>Start the thread with a quick update.</ThemedText>
            </View>
          ) : (
            messageRows.map((message) => {
              const mine = message.sender_id === userId;
              return (
                <View key={message.id} style={[styles.messageBubble, mine ? styles.messageMine : styles.messageOther]}>
                  <ThemedText style={[styles.messageBody, mine && styles.messageBodyMine]}>{message.body}</ThemedText>
                  <ThemedText style={[styles.messageMeta, mine && styles.messageMetaMine]}>
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                  </ThemedText>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.composerRow}>
          <TextInput
            value={draftMessage}
            onChangeText={setDraftMessage}
            style={styles.composerInput}
            placeholder="Reply to this thread"
            placeholderTextColor="#94A3B8"
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, (!draftMessage.trim() || sending) && styles.sendButtonDisabled]}
            onPress={() => void submitMessage()}
            disabled={!draftMessage.trim() || sending}
          >
            <Ionicons name="send-outline" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: '#64748B', fontSize: 13 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2, textTransform: 'capitalize' },
  content: { padding: 16, gap: 10 },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: { marginTop: 8, fontSize: 15, fontWeight: '700', color: '#0F172A' },
  emptyBody: { marginTop: 4, fontSize: 12, color: '#64748B' },
  messageBubble: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: '92%',
  },
  messageMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  messageOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  messageBody: { fontSize: 13, color: '#0F172A' },
  messageBodyMine: { color: '#FFFFFF' },
  messageMeta: { marginTop: 4, fontSize: 11, color: '#64748B' },
  messageMetaMine: { color: '#DBEAFE' },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
});
