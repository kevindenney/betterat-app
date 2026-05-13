import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  StyleProp,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAIChatSession } from '@/hooks/ai/useAIChatSession';

interface ClubAiAssistantProps {
  clubId: string | null;
  title?: string;
  promptSuggestions?: string[];
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}

export function ClubAiAssistant({
  clubId,
  title = 'Claude club assistant',
  promptSuggestions,
  style,
  compact = false,
}: ClubAiAssistantProps) {
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  const {
    messages,
    loading,
    isSending,
    error,
    assistantMeta,
    sendMessage,
    refresh,
  } = useAIChatSession({
    clubId,
    limit: 60,
  });

  const suggestions = useMemo(
    () =>
      promptSuggestions ?? [
        'Draft a welcome email for new members',
        'Summarize yesterday’s regatta performance',
        'How should we brief volunteers for check-in?',
      ],
    [promptSuggestions]
  );

  const handleSend = async () => {
    if (!input.trim()) return;
    const message = input.trim();
    setInput('');
    await sendMessage(message);
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 150);
  };

  if (!clubId) {
    return (
      <View style={[styles.container, style]}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={refresh} accessibilityRole="button">
            <Ionicons name="refresh" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>
        <View style={styles.placeholder}>
          <Ionicons name="lock-closed-outline" size={28} color="#94A3B8" />
          <Text style={styles.placeholderTitle}>Connect your club workspace</Text>
          <Text style={styles.placeholderText}>
            Finish onboarding to chat with Claude about member support, race briefs, and daily operations.
          </Text>
        </View>
      </View>
    );
  }

  const renderMessage = ({ item }: any) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser ? styles.rowRight : styles.rowLeft]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Ionicons name="sparkles" size={18} color="#FFFFFF" />
          </View>
        )}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          <Text style={[styles.messageText, isUser && styles.userText]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={compact ? 0 : 24}
      style={[styles.container, style]}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Answers from your schedules, members, and registrations.</Text>
        </View>
        <TouchableOpacity onPress={refresh} disabled={loading || isSending}>
          <Ionicons name="refresh" size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {assistantMeta?.suggestedAction && (
        <View style={styles.metaCard}>
          <Ionicons name="bulb-outline" size={18} color="#2563EB" style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.metaTitle}>Suggested action</Text>
            <Text style={styles.metaText}>{assistantMeta.suggestedAction}</Text>
          </View>
          {assistantMeta.needsHandoff && (
            <View style={styles.handoffChip}>
              <Ionicons name="alert-circle" size={14} color="#F97316" style={{ marginRight: 4 }} />
              <Text style={styles.handoffText}>Review manually</Text>
            </View>
          )}
        </View>
      )}

      {error && (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle" size={18} color="#EF4444" style={{ marginRight: 6 }} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.placeholder}>
              <Ionicons name="chatbubble-ellipses-outline" size={28} color="#94A3B8" />
              <Text style={styles.placeholderTitle}>Ask Claude anything</Text>
              <Text style={styles.placeholderText}>
                Try a prompt below to get a tailored response for your club operations.
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          isSending ? (
            <View style={styles.typingIndicator}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.typingText}>Drafting a reply…</Text>
            </View>
          ) : null
        }
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={styles.suggestionRow}>
        {suggestions.map((suggestion) => (
          <TouchableOpacity
            key={suggestion}
            style={styles.suggestionChip}
            onPress={() => setInput(suggestion)}
          >
            <Ionicons name="flash-outline" size={16} color="#2563EB" style={{ marginRight: 6 }} />
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ask Claude for help…"
          placeholderTextColor="#94A3B8"
          value={input}
          onChangeText={setInput}
          editable={!isSending}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 16,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
  },
  metaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  metaTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  metaText: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  handoffChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEDD5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  handoffText: {
    fontSize: 11,
    color: '#C2410C',
    fontWeight: '600',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    flex: 1,
  },
  listContent: {
    gap: 12,
    paddingBottom: 12,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  rowLeft: {
    justifyContent: 'flex-start',
  },
  avatar: {
    height: 28,
    width: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  assistantBubble: {
    backgroundColor: '#EFF6FF',
    borderTopLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: '#2563EB',
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#1E293B',
  },
  userText: {
    color: '#FFFFFF',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 12,
    color: '#64748B',
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  suggestionText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    fontSize: 14,
    color: '#0F172A',
  },
  sendButton: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 32,
    paddingHorizontal: 12,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
