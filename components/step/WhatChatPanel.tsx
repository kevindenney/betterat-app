/**
 * WhatChatPanel — Inline multi-turn chat UI for AI plan suggestions.
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS } from '@/lib/step-theme';
import type { ChatMessage } from '@/types/step-detail';

interface WhatChatPanelProps {
  chatHistory: ChatMessage[];
  onSend: (text: string) => void;
  onApply: (text: string) => void;
  onClear: () => void;
  isLoading: boolean;
}

export function WhatChatPanel({ chatHistory, onSend, onApply, onClear, isLoading }: WhatChatPanelProps) {
  const [input, setInput] = React.useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [chatHistory.length, isLoading]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    onSend(trimmed);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="sparkles" size={14} color={IOS_COLORS.systemPurple} />
          <Text style={styles.headerTitle}>Chat</Text>
        </View>
        {chatHistory.length > 0 && (
          <Pressable onPress={onClear} hitSlop={8}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        )}
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator
        nestedScrollEnabled
      >
        {chatHistory.map((msg, i) => (
          <View
            key={`${msg.role}_${i}`}
            style={[
              styles.bubble,
              msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
            ]}
          >
            {msg.role === 'assistant' && (
              <View style={styles.bubbleIcon}>
                <Ionicons name="sparkles" size={12} color={IOS_COLORS.systemPurple} />
              </View>
            )}
            <Text style={[
              styles.bubbleText,
              msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant,
            ]}>
              {msg.content}
            </Text>
            {msg.role === 'assistant' && (
              <Pressable
                style={styles.useThisButton}
                onPress={() => onApply(msg.content)}
              >
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                <Text style={styles.useThisText}>Use This</Text>
              </Pressable>
            )}
          </View>
        ))}

        {isLoading && (
          <View style={[styles.bubble, styles.bubbleAssistant]}>
            <ActivityIndicator size="small" color={IOS_COLORS.systemPurple} />
            <Text style={styles.typingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          placeholder="Ask a follow-up..."
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          returnKeyType="send"
          editable={!isLoading}
        />
        <Pressable
          style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || isLoading}
        >
          <Ionicons
            name="send"
            size={16}
            color={input.trim() && !isLoading ? '#FFFFFF' : IOS_COLORS.systemGray3}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(175,82,222,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(175,82,222,0.15)',
    marginTop: IOS_SPACING.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: IOS_SPACING.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(175,82,222,0.12)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: IOS_COLORS.systemPurple,
    letterSpacing: 0.3,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  messages: {
    maxHeight: 400,
    ...Platform.select({
      web: { overflowY: 'scroll' } as any,
    }),
  },
  messagesContent: {
    padding: IOS_SPACING.sm,
    gap: IOS_SPACING.sm,
  },
  bubble: {
    borderRadius: 10,
    padding: IOS_SPACING.sm,
    maxWidth: '88%',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: STEP_COLORS.accent,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(175,82,222,0.12)',
    gap: IOS_SPACING.xs,
  },
  bubbleIcon: {
    alignSelf: 'flex-start',
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleTextUser: {
    color: '#FFFFFF',
  },
  bubbleTextAssistant: {
    color: IOS_COLORS.label,
  },
  typingText: {
    fontSize: 13,
    color: IOS_COLORS.systemPurple,
    fontStyle: 'italic',
  },
  useThisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: IOS_COLORS.systemPurple,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 2,
  },
  useThisText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS_SPACING.xs,
    padding: IOS_SPACING.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(175,82,222,0.12)',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: IOS_COLORS.systemPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: IOS_COLORS.systemGray5,
  },
});
