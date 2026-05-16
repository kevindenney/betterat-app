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
import { LinearGradient } from 'expo-linear-gradient';
import { IOS_COLORS, IOS_SPACING } from '@/lib/design-tokens-ios';
import { useAIConversation } from '@/hooks/useAIConversation';
import { getManifesto } from '@/services/ManifestoService';
import { getActiveInsights, formatInsightsForPrompt } from '@/services/AIMemoryService';
import { getMeasurementHistory, formatMeasurementsForPrompt } from '@/services/MeasurementExtractionService';
import { useAuth } from '@/providers/AuthProvider';
import { supabase } from '@/services/supabase';
import { getStepCategoryLabels } from '@/lib/step-category-config';
import { getUserLibrary, getResources } from '@/services/LibraryService';
import type { StepPlanData, SubStep } from '@/types/step-detail';
import {
  PlanDraftPreviewCard,
  type PlanDraftPreview,
} from './plan-tab/PlanDraftPreviewCard';

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
  /**
   * AI Coach · Frame 2 — render the "Refining the plan for X" context
   * strip above the conversation. Defaults to true; set false for
   * surfaces that should not announce a refinement target (e.g. the
   * paste overlay quick capture).
   */
  showContextStrip?: boolean;
}

// 25s ceiling for the structuring call — long enough for Gemini Flash on a
// slow connection, short enough that "Drafting your plan…" doesn't become a
// permanent state when the function or gateway stalls.
const DRAFT_TIMEOUT_MS = 25_000;

class DraftTimeoutError extends Error {
  constructor() {
    super('Draft request timed out');
    this.name = 'DraftTimeoutError';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new DraftTimeoutError()), ms);
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

export function ConversationalCapture({
  interestId,
  interestName,
  stepTitle,
  onCreateStep,
  embedded,
  stepCategory,
  autoFocus,
  showContextStrip = true,
}: ConversationalCaptureProps) {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [showPasteOverlay, setShowPasteOverlay] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [isStructuring, setIsStructuring] = useState(false);
  const [draft, setDraft] = useState<PlanDraftPreview | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Flipped on unmount so async resolutions don't write to state on a closed
  // modal. Modal close in PlanTabInterior is gate-rendered, so unmount fires.
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [messages.length, isLoading, isStructuring, draft, draftError]);

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

  // Structure the conversation into a draft preview, surfaced inline
  // for the user to accept or keep refining (AI Coach · Frame 3).
  const handleDraftPlan = useCallback(async () => {
    if (isStructuring) return;
    setIsStructuring(true);
    setDraftError(null);

    const latestUserMessage = [...messages].reverse().find((m) => m.role === 'user' && m.content?.trim())?.content?.trim();
    const latestAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant' && m.content?.trim())?.content?.trim();
    const firstUserMessage = messages.find((m) => m.role === 'user' && m.content?.trim())?.content?.trim();
    const localFallbackWhat = latestUserMessage || latestAssistantMessage || firstUserMessage;

    if (localFallbackWhat) {
      setDraft({
        suggestedTitle: localFallbackWhat.split(/[.\n]/).filter(Boolean)[0]?.trim().slice(0, 64),
        planData: {
          what_will_you_do: localFallbackWhat,
          how_sub_steps: [
            {
              id: `local_${Date.now()}_0`,
              text: `Practice ${localFallbackWhat.toLowerCase()}`,
              sort_order: 0,
              completed: false,
            },
          ],
          why_reasoning: 'Drafted from the conversation so you can accept and edit immediately.',
        },
      });
    }

    const conversationText = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n\n');

    const structurePrompt = `Based on this conversation about a ${interestName} practice session, extract a structured plan.

Respond with ONLY valid JSON:
{
  "suggested_title": "Short title (3-8 words)",
  "what_will_you_do": "1-3 sentence objective",
  "how_sub_steps": ["Step 1", "Step 2", "Step 3"],
  "how_sub_step_tags": ["Optional capability tag per sub-step, or null"],
  "why_reasoning": "1-2 sentence rationale",
  "who_collaborators": ["Name"],
  "capability_goals": ["Skill 1", "Skill 2"],
  "where_location_name": "location name or null"
}`;

    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke('step-plan-suggest', {
          body: { system: structurePrompt, prompt: conversationText, max_tokens: 768 },
        }),
        DRAFT_TIMEOUT_MS,
      );

      if (cancelledRef.current) return;

      let parsed: any = {};
      if (!error && data?.text) {
        const cleaned = data.text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {
            parsed = {};
          }
        }
      }

      const fallbackWhat = parsed.what_will_you_do?.trim()
        || parsed.suggested_title?.trim()
        || latestUserMessage
        || latestAssistantMessage
        || firstUserMessage;
      const howSubSteps = Array.isArray(parsed.how_sub_steps) ? parsed.how_sub_steps : [];
      const howSubStepTags = Array.isArray(parsed.how_sub_step_tags)
        ? parsed.how_sub_step_tags
        : [];

      if (!fallbackWhat?.trim() && howSubSteps.length === 0 && !parsed.why_reasoning?.trim()) {
        if (!localFallbackWhat) {
          setDraftError("I couldn't find enough plan detail yet. Add one sentence, then tap Draft my plan again.");
        }
        return;
      }

      const planData: Partial<StepPlanData> = {
        what_will_you_do: fallbackWhat || 'Plan created from conversation',
        how_sub_steps: howSubSteps.map((text: string, i: number): SubStep => ({
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

      setDraft({
        suggestedTitle: parsed.suggested_title?.trim() || undefined,
        planData,
        subStepTags: howSubStepTags.map((t: unknown) =>
          typeof t === 'string' && t.trim() ? t.trim() : null,
        ),
      });
    } catch (err) {
      if (cancelledRef.current) return;
      console.error('Draft plan failed:', err);
      const timedOut = err instanceof DraftTimeoutError;
      setDraftError(
        timedOut
          ? "The coach didn't respond in time. Tap to retry."
          : "Couldn't draft the plan. Tap to retry.",
      );
      // Fallback: surface a minimal draft from the last assistant turn so
      // the user can still accept-and-edit rather than losing their work.
      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
      if (lastAssistant?.content) {
        setDraft({
          planData: { what_will_you_do: lastAssistant.content },
        });
      }
    } finally {
      if (!cancelledRef.current) {
        setIsStructuring(false);
      }
    }
  }, [isStructuring, messages, interestName]);

  const handleAcceptDraft = useCallback(() => {
    if (!draft) return;
    const summary = draft.planData.what_will_you_do || draft.suggestedTitle || '';
    // complete() runs insight extraction in the background and writes to
    // remote tables — slow or flaky, and unrelated to step creation. Fire it
    // and move on so Accept never blocks on a remote round-trip.
    complete(summary).catch((err) => {
      console.error('complete() failed (non-blocking):', err);
    });
    onCreateStep(draft.planData, draft.suggestedTitle);
    setDraft(null);
  }, [draft, complete, onCreateStep]);

  const handleKeepRefining = useCallback(() => {
    setDraft(null);
    // Refocus the composer so the user can immediately respond.
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  const hasUserMessage = messages.some((message) => message.role === 'user' && message.content?.trim());
  const showDraftCta = hasUserMessage && !draft;

  return (
    <View style={[styles.container, embedded && styles.containerEmbedded]}>
      {/* Header — neutral framing per redesign spec §10.2 ("AI never speaks as itself") */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="chatbubbles" size={14} color={IOS_COLORS.systemPurple} />
          <Text style={styles.headerTitle}>Talk it through</Text>
        </View>
        {showDraftCta && (
          <Pressable
            style={[styles.headerDraftButton, isStructuring && styles.headerDraftButtonDisabled]}
            onPress={handleDraftPlan}
            disabled={isStructuring}
            accessibilityRole="button"
            accessibilityLabel="Draft my plan"
            accessibilityState={{ disabled: isStructuring }}
          >
            {isStructuring ? (
              <ActivityIndicator size="small" color={IOS_COLORS.systemPurple} />
            ) : (
              <Ionicons name="sparkles" size={12} color={IOS_COLORS.systemPurple} />
            )}
            <Text style={styles.headerDraftText}>{isStructuring ? 'Drafting' : 'Draft'}</Text>
          </Pressable>
        )}
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {showContextStrip && stepTitle ? (
          <View style={styles.contextStrip} accessibilityLabel="Refinement target">
            <Ionicons name="flag-outline" size={12} color={IOS_COLORS.systemBlue} />
            <Text style={styles.contextText} numberOfLines={2}>
              {'Refining the plan for '}
              <Text style={styles.contextStrong}>{stepTitle}</Text>
            </Text>
          </View>
        ) : null}

        {messages.map((msg, i) => {
          if (msg.role === 'assistant') {
            return (
              <View key={`assistant_${i}`} style={styles.aiRow}>
                <LinearGradient
                  colors={['#007AFF', '#5856D6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.aiAvatar}
                >
                  <Ionicons name="sparkles" size={12} color="#FFFFFF" />
                </LinearGradient>
                <View style={[styles.bubble, styles.bubbleAssistant]}>
                  <Text style={[styles.bubbleText, styles.bubbleTextAssistant]}>
                    {msg.content}
                  </Text>
                </View>
              </View>
            );
          }
          return (
            <View key={`user_${i}`} style={[styles.bubble, styles.bubbleUser]}>
              <Text style={[styles.bubbleText, styles.bubbleTextUser]}>
                {msg.content}
              </Text>
            </View>
          );
        })}

        {isLoading && (
          <View style={styles.aiRow}>
            <LinearGradient
              colors={['#007AFF', '#5856D6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.aiAvatar}
            >
              <Ionicons name="sparkles" size={12} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.typing}>
              <View style={styles.typingDots}>
                <View style={styles.typingDot} />
                <View style={[styles.typingDot, styles.typingDotMid]} />
                <View style={[styles.typingDot, styles.typingDotLow]} />
              </View>
              <Text style={styles.typingText}>Thinking…</Text>
            </View>
          </View>
        )}

        {isStructuring && (
          <View style={styles.aiRow}>
            <LinearGradient
              colors={['#007AFF', '#5856D6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.aiAvatar}
            >
              <Ionicons name="sparkles" size={12} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.typing}>
              <ActivityIndicator size="small" color={IOS_COLORS.secondaryLabel} />
              <Text style={styles.typingText}>Drafting your plan now…</Text>
            </View>
          </View>
        )}

        {draft && (
          <PlanDraftPreviewCard
            draft={draft}
            onAccept={handleAcceptDraft}
            onKeepRefining={handleKeepRefining}
          />
        )}
      </ScrollView>

      {draftError && !isStructuring && (
        <Pressable
          style={styles.draftErrorBanner}
          onPress={handleDraftPlan}
          accessibilityRole="button"
          accessibilityLabel={draftError}
        >
          <Ionicons name="warning-outline" size={14} color={IOS_COLORS.systemOrange} />
          <Text style={styles.draftErrorText}>{draftError}</Text>
        </Pressable>
      )}

      {/* Draft my plan CTA — surfaces a draft preview inline once the
          conversation has enough material. Hidden while a draft is
          already showing so the user focuses on Accept / Keep refining. */}
      {showDraftCta && (
        <Pressable
          style={[styles.draftCtaButton, isStructuring && styles.draftCtaButtonDisabled]}
          onPress={handleDraftPlan}
          disabled={isStructuring}
          accessibilityRole="button"
          accessibilityLabel="Draft my plan"
          accessibilityState={{ disabled: isStructuring }}
        >
          {isStructuring ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="sparkles" size={16} color="#FFFFFF" />
          )}
          <Text style={styles.draftCtaText}>{isStructuring ? 'Drafting your plan…' : 'Draft my plan'}</Text>
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
                Dump a wall of text and we'll help organize it
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
                  <Text style={styles.overlaySendText}>Send</Text>
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
  headerDraftButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(175,82,222,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(175,82,222,0.26)',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  headerDraftButtonDisabled: {
    opacity: 0.7,
  },
  headerDraftText: {
    fontSize: 12,
    fontWeight: '800',
    color: IOS_COLORS.systemPurple,
  },
  messages: {
    maxHeight: 350,
  },
  messagesContent: {
    padding: IOS_SPACING.sm,
    gap: IOS_SPACING.sm,
  },
  contextStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 122, 255, 0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 122, 255, 0.15)',
    marginBottom: 2,
  },
  contextText: {
    flex: 1,
    fontSize: 11,
    color: IOS_COLORS.label,
    letterSpacing: -0.05,
    lineHeight: 15,
  },
  contextStrong: {
    fontWeight: '600',
    color: IOS_COLORS.label,
  },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    gap: 8,
    maxWidth: '86%',
  },
  aiAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '78%',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: IOS_COLORS.systemBlue,
    borderBottomRightRadius: 5,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: IOS_COLORS.systemGray6,
    borderBottomLeftRadius: 5,
    flexShrink: 1,
  },
  bubbleText: {
    fontSize: 13.5,
    lineHeight: 18,
    letterSpacing: -0.15,
  },
  bubbleTextUser: {
    color: '#FFFFFF',
  },
  bubbleTextAssistant: {
    color: IOS_COLORS.label,
  },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 5,
    backgroundColor: IOS_COLORS.systemGray6,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  typingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: IOS_COLORS.secondaryLabel,
  },
  typingDotMid: {
    opacity: 0.7,
  },
  typingDotLow: {
    opacity: 0.5,
  },
  typingText: {
    fontSize: 12.5,
    color: IOS_COLORS.secondaryLabel,
    letterSpacing: -0.1,
  },
  draftErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: IOS_SPACING.sm,
    marginTop: IOS_SPACING.xs,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255,149,0,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,149,0,0.30)',
  },
  draftErrorText: {
    flex: 1,
    fontSize: 12,
    color: IOS_COLORS.label,
    letterSpacing: -0.05,
  },
  draftCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: IOS_COLORS.systemBlue,
    marginHorizontal: IOS_SPACING.sm,
    marginVertical: IOS_SPACING.xs,
    paddingVertical: 11,
    borderRadius: 12,
    shadowColor: IOS_COLORS.systemBlue,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  draftCtaButtonDisabled: {
    opacity: 0.78,
  },
  draftCtaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
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
