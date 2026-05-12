/**
 * ConversationalCapture — Chat-first step creation interface.
 *
 * Replaces brain-dump → "Structure with AI" flow with conversational input.
 * Conversation populates the same StepPlanData fields (what, how, why, who, where).
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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { STEP_COLORS } from '@/lib/step-theme';
import { useAIConversation } from '@/hooks/useAIConversation';
import { getManifesto } from '@/services/ManifestoService';
import { getActiveInsights, formatInsightsForPrompt } from '@/services/AIMemoryService';
import { getMeasurementHistory, formatMeasurementsForPrompt } from '@/services/MeasurementExtractionService';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { getStepCategoryLabels } from '@/lib/step-category-config';
import { getUserLibrary, getResources } from '@/services/LibraryService';
import type { StepPlanData, SubStep } from '@/types/step-detail';

interface ConversationalCaptureProps {
  interestId: string;
  interestName: string;
  stepTitle: string;
  onCreateStep: (planData: Partial<StepPlanData>, suggestedTitle?: string) => void;
  embedded?: boolean;
  /** Step category for AI context (e.g. 'nutrition', 'strength') */
  stepCategory?: string;
  /** When true, focus the input on mount and bring up the keyboard. Use this
   *  when the component renders inside a freshly-created step — the user
   *  already expressed intent ("+ → Add Step"), so the next gesture is to
   *  describe what they're working on. */
  autoFocus?: boolean;
}

export function ConversationalCapture({
  interestId,
  interestName,
  stepTitle: _stepTitle,
  onCreateStep,
  embedded,
  stepCategory,
  autoFocus,
}: ConversationalCaptureProps) {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [showPasteOverlay, setShowPasteOverlay] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [isStructuring, setIsStructuring] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Honor autoFocus once the input has mounted. We don't pass `autoFocus`
  // directly to TextInput because Android occasionally drops it when the
  // input mounts inside a sheet/modal — calling .focus() on a layout tick
  // is more reliable across platforms.
  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => {
      inputRef.current?.focus();
    }, 80);
    return () => clearTimeout(t);
  }, [autoFocus]);

  // Build system prompt with manifesto + insights context
  const [systemPrompt, setSystemPrompt] = useState('');
  const [openingMessage, setOpeningMessage] = useState<string | undefined>();

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
          manifestoBlock = `\n\nUSER'S MANIFESTO (their vision and philosophy for ${interestName}):\n${manifesto.content}`;
          if (manifesto.philosophies?.length) {
            manifestoBlock += `\nPhilosophies: ${manifesto.philosophies.join(', ')}`;
          }
          if (manifesto.role_models?.length) {
            manifestoBlock += `\nRole models: ${manifesto.role_models.join(', ')}`;
          }
          const cadenceEntries = Object.entries(manifesto.weekly_cadence ?? {}).filter(([, v]) => v != null);
          if (cadenceEntries.length) {
            manifestoBlock += `\nWeekly cadence: ${cadenceEntries.map(([k, v]) => `${k}: ${v}x/wk`).join(', ')}`;
          }
        }

        if (insights.length) {
          insightsBlock = `\n\nAI INSIGHTS (what we've learned about this user):\n${formatInsightsForPrompt(insights)}`;
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
          libraryBlock = `\n\nUSER'S LEARNING LIBRARY (resources they've curated for ${interestName}):\n${resourceLines.join('\n')}`;
        }
      } catch {
        // Continue without manifesto/insights/measurements
      }

      const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const catConfig = getStepCategoryLabels(stepCategory);
      const categoryGuidance = catConfig.aiGuidance ? `\n\nSTEP TYPE GUIDANCE:\n${catConfig.aiGuidance}` : '';

      const prompt = `You are an expert learning coach on BetterAt, helping someone plan their ${interestName} practice.

Your role is to have a natural conversation to understand what they want to work on, then help them structure it into a clear plan. You know their history, philosophy, and patterns.${manifestoBlock}${insightsBlock}${measurementBlock}${libraryBlock}${categoryGuidance}

Guidelines:
- Be conversational and concise (under 150 words per response)
- Reference their manifesto, library resources, patterns, and insights when relevant
- Ask clarifying questions to fill gaps (what specifically, how they'll approach it, why it matters, who's involved, where)
- If they paste a wall of text, help organize it into a coherent plan
- Write in second person ("You could...")
- Do not use markdown formatting`;

      setSystemPrompt(prompt);

      // Build contextual opening message with insight enrichment
      let opening = `What are you working on today?`;
      try {
        const manifesto = await getManifesto(user.id, interestId);
        if (manifesto?.content?.trim()) {
          const cadenceEntries = Object.entries(manifesto.weekly_cadence ?? {}).filter(([, v]) => v != null);
          if (cadenceEntries.length) {
            opening = `Hey! It's ${dayOfWeek}. Based on your plan, what are you focusing on today?`;
          } else {
            opening = `What are you working on for ${interestName} today?`;
          }
        }
      } catch {}

      // Enrich with most relevant recent insight
      if (loadedInsights.length) {
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const recent = loadedInsights
          .filter((i: { created_at: string }) => new Date(i.created_at) > twoWeeksAgo)
          .sort((a: { confidence: number }, b: { confidence: number }) => b.confidence - a.confidence);
        if (recent.length) {
          opening += ` From our recent conversations, I noticed: ${recent[0].content}.`;
        }
      }

      setOpeningMessage(opening);
    })();
  }, [user?.id, interestId, interestName]);

  const { messages, isLoading, sendMessage, complete } = useAIConversation({
    interestId,
    interestName,
    contextType: 'capture',
    systemPrompt: systemPrompt || `You are a learning coach for ${interestName}. Help plan a practice session.`,
    openingMessage,
  });

  // Auto-scroll on new messages
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length, isLoading]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    sendMessage(trimmed);
  }, [input, isLoading, sendMessage]);

  const handlePasteSend = useCallback(() => {
    const trimmed = pasteText.trim();
    if (!trimmed) return;
    setShowPasteOverlay(false);
    setPasteText('');
    sendMessage(trimmed);
  }, [pasteText, sendMessage]);

  // Structure conversation into StepPlanData
  const handleCreateStep = useCallback(async () => {
    setIsStructuring(true);

    const conversationText = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n\n');

    const structurePrompt = `Based on this conversation about a ${interestName} practice session, extract a structured plan.

Respond with ONLY valid JSON:
{
  "suggested_title": "Short title (3-8 words)",
  "what_will_you_do": "1-3 sentence objective",
  "how_sub_steps": ["Step 1", "Step 2", "Step 3"],
  "why_reasoning": "1-2 sentence rationale",
  "who_collaborators": ["Name"],
  "capability_goals": ["Skill 1", "Skill 2"],
  "where_location_name": "location name or null"
}`;

    try {
      const { data, error } = await supabase.functions.invoke('step-plan-suggest', {
        body: { system: structurePrompt, prompt: conversationText, max_tokens: 768 },
      });

      let parsed: any = {};
      if (!error && data?.text) {
        const cleaned = data.text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      }

      const planData: Partial<StepPlanData> = {
        what_will_you_do: parsed.what_will_you_do || '',
        how_sub_steps: (parsed.how_sub_steps ?? []).map((text: string, i: number): SubStep => ({
          id: `conv_${Date.now()}_${i}`,
          text,
          sort_order: i,
          completed: false,
        })),
        why_reasoning: parsed.why_reasoning || '',
        who_collaborators: parsed.who_collaborators || [],
        capability_goals: parsed.capability_goals || [],
      };

      if (parsed.where_location_name) {
        planData.where_location = { name: parsed.where_location_name };
      }

      // Complete the conversation with a summary
      await complete(parsed.what_will_you_do || 'Plan created from conversation');

      onCreateStep(planData, parsed.suggested_title);
    } catch (err) {
      console.error('Structure conversation failed:', err);
      // Fallback: use last assistant message as what
      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
      onCreateStep({
        what_will_you_do: lastAssistant?.content || '',
      });
    } finally {
      setIsStructuring(false);
    }
  }, [messages, interestName, complete, onCreateStep]);

  const hasConversation = messages.length > 1; // More than just opening message

  return (
    <View style={[styles.container, embedded && styles.containerEmbedded]}>
      {/* Header — neutral framing per redesign spec §10.2 ("AI never speaks as itself") */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="chatbubbles" size={14} color={IOS_COLORS.systemPurple} />
          <Text style={styles.headerTitle}>Talk it through</Text>
        </View>
      </View>

      {/* Messages */}
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
              <View style={styles.bubbleIcon}>
                <Ionicons name="sparkles" size={12} color={IOS_COLORS.systemPurple} />
              </View>
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
            <Text style={styles.typingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      {/* Create Step button */}
      {hasConversation && !isLoading && (
        <Pressable
          style={styles.createStepButton}
          onPress={handleCreateStep}
          disabled={isStructuring}
        >
          {isStructuring ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.createStepText}>Create Step from Conversation</Text>
            </>
          )}
        </Pressable>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        <Pressable
          style={styles.pasteButton}
          onPress={() => setShowPasteOverlay(true)}
        >
          <Ionicons name="clipboard-outline" size={18} color={IOS_COLORS.systemPurple} />
        </Pressable>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          placeholder="What are you working on..."
          placeholderTextColor={IOS_COLORS.tertiaryLabel}
          returnKeyType="send"
          editable={!isLoading && !isStructuring}
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

      {/* Paste overlay modal */}
      {showPasteOverlay && (
        <Modal transparent animationType="fade" visible>
          <Pressable
            style={styles.overlayBackdrop}
            onPress={() => setShowPasteOverlay(false)}
          >
            <Pressable style={styles.overlayContent} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.overlayTitle}>Paste Notes</Text>
              <Text style={styles.overlaySubtitle}>
                Dump a wall of text and the AI will help organize it
              </Text>
              <TextInput
                style={styles.overlayTextArea}
                value={pasteText}
                onChangeText={setPasteText}
                placeholder="Paste your notes, ideas, links..."
                placeholderTextColor={IOS_COLORS.tertiaryLabel}
                multiline
                textAlignVertical="top"
                autoFocus
              />
              <View style={styles.overlayActions}>
                <Pressable
                  style={styles.overlayCancelButton}
                  onPress={() => setShowPasteOverlay(false)}
                >
                  <Text style={styles.overlayCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.overlaySendButton, !pasteText.trim() && styles.sendButtonDisabled]}
                  onPress={handlePasteSend}
                  disabled={!pasteText.trim()}
                >
                  <Ionicons name="send" size={16} color="#FFFFFF" />
                  <Text style={styles.overlaySendText}>Send to AI</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(175,82,222,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(175,82,222,0.15)',
    overflow: 'hidden',
  },
  containerEmbedded: {
    borderRadius: 0,
    borderWidth: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(175,82,222,0.12)',
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
  messages: {
    maxHeight: 350,
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
  createStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: STEP_COLORS.accent,
    marginHorizontal: IOS_SPACING.sm,
    marginVertical: IOS_SPACING.xs,
    paddingVertical: 10,
    borderRadius: 10,
  },
  createStepText: {
    fontSize: 14,
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
  pasteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(175,82,222,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
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
  // Paste overlay
  overlayBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: IOS_SPACING.lg,
  },
  overlayContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: IOS_SPACING.md,
    width: '100%',
    maxWidth: 500,
    gap: IOS_SPACING.sm,
  },
  overlayTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  overlaySubtitle: {
    fontSize: 13,
    color: IOS_COLORS.secondaryLabel,
  },
  overlayTextArea: {
    fontSize: 14,
    color: IOS_COLORS.label,
    backgroundColor: IOS_COLORS.systemGray6,
    borderRadius: 10,
    padding: IOS_SPACING.sm,
    minHeight: 160,
    maxHeight: 300,
    ...Platform.select({
      web: { outlineStyle: 'none', resize: 'vertical' } as any,
    }),
  },
  overlayActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: IOS_SPACING.sm,
  },
  overlayCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  overlayCancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: IOS_COLORS.secondaryLabel,
  },
  overlaySendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: IOS_COLORS.systemPurple,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  overlaySendText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
