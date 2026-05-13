/**
 * TrainChatPanel — In-session AI coaching chat.
 *
 * Replaces Quick Notes textarea with conversational AI coaching during training.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import { useAIConversation } from '@/hooks/useAIConversation';
import { getManifesto } from '@/services/ManifestoService';
import { getActiveInsights, formatInsightsForPrompt } from '@/services/AIMemoryService';
import { getMeasurementHistory, formatMeasurementsForPrompt } from '@/services/MeasurementExtractionService';
import { getUserLibrary, getResources } from '@/services/LibraryService';
import { useAuth } from '@/providers/AuthProvider';

interface TrainChatPanelProps {
  interestId: string;
  interestName: string;
  interestSlug?: string;
  stepId: string;
  stepTitle: string;
  planWhat?: string;
  /** Called when notes should be persisted (for backward compat with onUpdateNotes) */
  onUpdateNotes?: (notes: string) => void;
  /** Pre-fill the input with a question (e.g. from "Ask AI" on a sub-step) */
  pendingQuestion?: string;
  /** Called after the pending question is consumed so parent can clear state */
  onPendingQuestionConsumed?: () => void;
}

export function TrainChatPanel({
  interestId,
  interestName,
  interestSlug,
  stepId,
  stepTitle,
  planWhat,
  onUpdateNotes,
  pendingQuestion,
  onPendingQuestionConsumed,
}: TrainChatPanelProps) {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [openingMessage, setOpeningMessage] = useState<string | undefined>();

  // Consume pending question from parent (e.g. "Ask AI" on a sub-step)
  useEffect(() => {
    if (pendingQuestion) {
      setInput(pendingQuestion);
      onPendingQuestionConsumed?.();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingQuestion]);

  // Build system prompt with manifesto + insights + step context
  useEffect(() => {
    if (!user?.id || !interestId) return;

    (async () => {
      let manifestoBlock = '';
      let insightsBlock = '';
      let measurementBlock = '';
      let libraryBlock = '';
      let loadedInsights: Awaited<ReturnType<typeof getActiveInsights>> = [];

      try {
        const [manifesto, insights, measurementHistory, libraryResources] = await Promise.all([
          getManifesto(user.id, interestId),
          getActiveInsights(user.id, interestId),
          getMeasurementHistory(user.id, interestId).catch(() => null),
          getUserLibrary(user.id, interestId)
            .then((lib) => getResources(lib.id))
            .catch(() => [] as any[]),
        ]);

        loadedInsights = insights;
        if (manifesto?.content?.trim()) {
          manifestoBlock = `\n\nUSER'S MANIFESTO:\n${manifesto.content}`;
        }
        if (insights.length) {
          insightsBlock = `\n\nAI INSIGHTS:\n${formatInsightsForPrompt(insights)}`;
        }
        if (measurementHistory?.hasData) {
          const formatted = formatMeasurementsForPrompt(measurementHistory);
          if (formatted) {
            measurementBlock = `\n\n${formatted}`;
          }
        }
        if (libraryResources.length) {
          const resourceLines = libraryResources.map((r: any) => {
            let line = `- ${r.title}`;
            if (r.author_or_creator) line += ` by ${r.author_or_creator}`;
            if (r.resource_type) line += ` (${r.resource_type.replace(/_/g, ' ')})`;
            if (r.description) line += `: ${r.description}`;
            if (r.capability_goals?.length) line += ` [goals: ${r.capability_goals.join(', ')}]`;
            return line;
          });
          libraryBlock = `\n\nUSER'S LEARNING LIBRARY:\n${resourceLines.join('\n')}`;
        }
      } catch {}

      const prompt = `You are an in-session AI coach on BetterAt, helping someone during their ${interestName} practice.

CURRENT SESSION: "${stepTitle}"
${planWhat ? `PLAN: ${planWhat}` : ''}${manifestoBlock}${insightsBlock}${measurementBlock}${libraryBlock}

Guidelines:
- Be encouraging and concise (under 100 words per response)
- Help them stay focused on their plan
- Ask about technique, form, or observations when appropriate
- If they report deviations, help them adapt in real-time
- Reference their manifesto and patterns when relevant
- Do not use markdown formatting`;

      setSystemPrompt(prompt);

      // Pick the most relevant recent insight for a personalized opening
      let insightOpener = '';
      if (loadedInsights.length) {
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const recent = loadedInsights
          .filter((i: { created_at: string }) => new Date(i.created_at) > twoWeeksAgo)
          .sort((a: { confidence: number }, b: { confidence: number }) => b.confidence - a.confidence);
        if (recent.length) {
          insightOpener = ` By the way — from our past sessions I noticed: ${recent[0].content}.`;
        }
      }

      setOpeningMessage(
        planWhat
          ? `Your plan today is: ${planWhat.slice(0, 100)}${planWhat.length > 100 ? '...' : ''} How are you feeling about getting started?${insightOpener}`
          : `Ready to start "${stepTitle}"? How are you feeling?${insightOpener}`,
      );
    })();
  }, [user?.id, interestId, interestName, stepTitle, planWhat]);

  const { messages, isLoading, sendMessage } = useAIConversation({
    interestId,
    interestName,
    interestSlug,
    contextType: 'train',
    contextId: stepId,
    systemPrompt: systemPrompt || `You are a training coach for ${interestName}.`,
    openingMessage,
  });

  // Auto-scroll
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length, isLoading]);

  // Persist user messages as notes for backward compat
  const prevNotesRef = useRef<string>('');
  useEffect(() => {
    if (!onUpdateNotes) return;
    const userMessages = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content);
    if (userMessages.length > 0) {
      const joined = userMessages.join('\n');
      if (joined !== prevNotesRef.current) {
        prevNotesRef.current = joined;
        onUpdateNotes(joined);
      }
    }
  }, [messages, onUpdateNotes]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    sendMessage(trimmed);
  }, [input, isLoading, sendMessage]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={14} color={IOS_COLORS.systemPurple} />
        <Text style={styles.headerTitle}>Coaching</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg, i) => (
          <View
            key={`${msg.role}_${i}`}
            style={[
              styles.bubble,
              msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
            ]}
          >
            {msg.role === 'assistant' && (
              <Ionicons name="sparkles" size={10} color={IOS_COLORS.systemPurple} />
            )}
            <Text
              style={[
                styles.bubbleText,
                msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant,
              ]}
            >
              {msg.content}
            </Text>
          </View>
        ))}

        {isLoading && (
          <View style={[styles.bubble, styles.bubbleAssistant]}>
            <ActivityIndicator size="small" color={IOS_COLORS.systemPurple} />
          </View>
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          placeholder="Log observations..."
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
            size={14}
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(175,82,222,0.12)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: IOS_SPACING.sm,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(175,82,222,0.12)',
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: IOS_COLORS.systemPurple,
    letterSpacing: 0.3,
  },
  messages: {
    maxHeight: 200,
  },
  messagesContent: {
    padding: IOS_SPACING.xs,
    gap: IOS_SPACING.xs,
  },
  bubble: {
    borderRadius: 8,
    padding: 8,
    maxWidth: '85%',
    gap: 3,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: IOS_COLORS.systemGreen,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(175,82,222,0.12)',
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 18,
  },
  bubbleTextUser: {
    color: '#FFFFFF',
  },
  bubbleTextAssistant: {
    color: IOS_COLORS.label,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(175,82,222,0.12)',
  },
  input: {
    flex: 1,
    fontSize: 13,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...Platform.select({
      web: { outlineStyle: 'none' } as any,
    }),
  },
  sendButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: IOS_COLORS.systemPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: IOS_COLORS.systemGray5,
  },
});
