/**
 * useAIConversation — manages AI conversation state, sending messages, persistence.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import {
  createConversation,
  appendMessage,
  completeConversation,
  getActiveConversation,
} from '@/services/AIConversationService';
import { extractInsights } from '@/services/AIMemoryService';
import { useAIUsage } from '@/hooks/useAIUsage';
import { AIUsageService } from '@/services/ai/AIUsageService';
import { extractMeasurements } from '@/services/MeasurementExtractionService';
import { extractNutritionToStep } from '@/services/ai/NutritionExtractionService';
import { supabase } from '@/services/supabase';
import { useQueryClient } from '@tanstack/react-query';
import type {
  AIConversation,
  ConversationMessage,
  ConversationContextType,
} from '@/types/manifesto';

interface UseAIConversationOptions {
  interestId: string;
  interestName: string;
  interestSlug?: string;
  contextType: ConversationContextType;
  contextId?: string;
  systemPrompt: string;
  /** Opening AI message to send automatically */
  openingMessage?: string;
}

// Per-turn ceiling for the edge function. Long enough for Gemini Flash on a
// slow connection, short enough that "Thinking…" never becomes permanent.
const SEND_TIMEOUT_MS = 25_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function useAIConversation(options: UseAIConversationOptions) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const aiUsage = useAIUsage();
  const [conversation, setConversation] = useState<AIConversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  // Initialize or resume conversation
  const initialize = useCallback(async () => {
    if (!user?.id || !options.interestId || initializedRef.current) return;
    initializedRef.current = true;
    setIsInitializing(true);

    try {
      // Try to resume existing active conversation
      const existing = await getActiveConversation(
        user.id,
        options.interestId,
        options.contextType,
        options.contextId,
      );

      if (existing) {
        setConversation(existing);
        setMessages(existing.messages);
        conversationIdRef.current = existing.id;
        setIsInitializing(false);
        return;
      }

      // Create new conversation
      const newConv = await createConversation({
        user_id: user.id,
        interest_id: options.interestId,
        context_type: options.contextType,
        context_id: options.contextId,
      });

      setConversation(newConv);
      conversationIdRef.current = newConv.id;

      // Send opening message if provided
      if (options.openingMessage) {
        const openingMsg: ConversationMessage = {
          role: 'assistant',
          content: options.openingMessage,
          timestamp: new Date().toISOString(),
        };
        setMessages([openingMsg]);
        await appendMessage(newConv.id, openingMsg).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to initialize conversation:', err);
    } finally {
      setIsInitializing(false);
    }
  }, [user?.id, options.interestId, options.contextType, options.contextId, options.openingMessage]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Send a user message and get AI response
  const sendMessage = useCallback(
    async (text: string): Promise<string | null> => {
      if (!conversationIdRef.current || !text.trim()) return null;

      // Soft paywall: free users get a monthly allowance of coach messages.
      // Surface the cap as a display-only assistant turn (this hook already
      // reports failures that way) rather than a modal, and keep the user's
      // text in the box so they can decide whether to upgrade.
      if (!aiUsage.canUse('coach_chat')) {
        const limitMsg: ConversationMessage = {
          role: 'assistant',
          content:
            "You've used all your free coaching messages this month. Upgrade for unlimited AI coaching.",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, limitMsg]);
        return null;
      }

      setIsLoading(true);

      const userMsg: ConversationMessage = {
        role: 'user',
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };

      // Optimistically add user message
      setMessages((prev) => [...prev, userMsg]);

      try {
        // Persist user message
        await appendMessage(conversationIdRef.current, userMsg);

        // Build messages array for AI (include all previous messages)
        const allMessages = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // Call edge function with a hard timeout so a stalled Gemini/gateway
        // can't strand the user on a permanent "Thinking…" indicator.
        const { data, error } = await withTimeout(
          supabase.functions.invoke('step-plan-suggest', {
            body: {
              system: options.systemPrompt,
              messages: allMessages,
              max_tokens: 768,
            },
          }),
          SEND_TIMEOUT_MS,
          'step-plan-suggest',
        );

        let responseText = '';
        if (!error && data?.text) {
          responseText = data.text;
        } else {
          // Fallback
          const fallbackPrompt = `${options.systemPrompt}\n\n${allMessages.map((m) => `${m.role}: ${m.content}`).join('\n\n')}`;
          const fallback = await withTimeout(
            supabase.functions.invoke('race-coaching-chat', {
              body: { prompt: fallbackPrompt, max_tokens: 768 },
            }),
            SEND_TIMEOUT_MS,
            'race-coaching-chat',
          );
          responseText = fallback.data?.text || 'I couldn\'t generate a response. Please try again.';
        }

        const assistantMsg: ConversationMessage = {
          role: 'assistant',
          content: responseText,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMsg]);
        await appendMessage(conversationIdRef.current!, assistantMsg).catch(() => {});

        void AIUsageService.recordUsage('coach_chat');
        aiUsage.refresh();

        return responseText;
      } catch (err) {
        console.error('sendMessage failed:', err);
        // Keep the user's message in place — silently dropping it is worse
        // than acknowledging the failure. Surface an assistant turn so the
        // user knows to retry rather than wondering why nothing happened.
        const isTimeout = err instanceof Error && err.message.includes('timed out');
        const errorMsg: ConversationMessage = {
          role: 'assistant',
          content: isTimeout
            ? "I'm not hearing back from the coach right now. Mind sending that again?"
            : "Something went wrong on my end. Try sending that again?",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [messages, options.systemPrompt, aiUsage],
  );

  // Complete the conversation and trigger insight extraction
  const complete = useCallback(
    async (summary?: string) => {
      if (!conversationIdRef.current || !user?.id) return;

      try {
        await completeConversation(conversationIdRef.current, summary);

        // Insight extraction — surface what was learned
        if (conversation) {
          const updatedConv = { ...conversation, messages, status: 'completed' as const };

          // Extract insights and show "I just learned" message
          extractInsights(user.id, options.interestId, updatedConv)
            .then((newInsights) => {
              if (newInsights.length > 0) {
                // Surface the learning moment as a display-only message
                const topInsight = newInsights[0];
                const learnedMsg: ConversationMessage = {
                  role: 'assistant',
                  content: `I noticed something new about you: ${topInsight.content}`,
                  timestamp: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, learnedMsg]);
                // Refresh insight caches so nudge banners and growth counters update
                queryClient.invalidateQueries({ queryKey: ['ai-insights', user.id, options.interestId] });
              }
            })
            .catch(() => {});

          // Async measurement + nutrition extraction for training conversations
          if (options.contextType === 'train' && options.contextId) {
            if (options.interestSlug) {
              extractMeasurements(
                user.id,
                options.interestId,
                options.contextId,
                updatedConv,
                options.interestSlug,
              ).catch(() => {});
            }
            extractNutritionToStep(
              user.id,
              options.interestId,
              options.contextId,
              updatedConv,
            ).catch(() => {});
          }
        }
      } catch (err) {
        console.error('completeConversation failed:', err);
      }
    },
    [
      conversation,
      messages,
      user?.id,
      options.interestId,
      options.contextId,
      options.contextType,
      options.interestSlug,
      queryClient,
    ],
  );

  return {
    messages,
    isLoading,
    isInitializing,
    conversationId: conversationIdRef.current,
    sendMessage,
    complete,
  };
}
