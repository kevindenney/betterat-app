/**
 * AIMemoryService — AI insight extraction, retrieval, and consolidation.
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import type { AIInterestInsight, InsightType, AIConversation } from '@/types/manifesto';
import type { StepActData, StepReviewData } from '@/types/step-detail';
import type { TimelineStepRecord } from '@/types/timeline-steps';

const logger = createLogger('AIMemoryService');

/**
 * Get all active insights for a user + interest.
 */
export async function getActiveInsights(
  userId: string,
  interestId: string,
): Promise<AIInterestInsight[]> {
  try {
    const { data, error } = await supabase
      .from('ai_interest_insights')
      .select('*')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .eq('active', true)
      .order('confidence', { ascending: false });

    if (error) {
      if (error.code === '42P01' || error.message?.includes('relation')) return [];
      throw error;
    }
    return (data ?? []) as AIInterestInsight[];
  } catch {
    return [];
  }
}

/**
 * Get insights grouped by type.
 */
export async function getInsightsByType(
  userId: string,
  interestId: string,
): Promise<Record<InsightType, AIInterestInsight[]>> {
  const insights = await getActiveInsights(userId, interestId);
  const grouped: Record<InsightType, AIInterestInsight[]> = {
    strength: [],
    weakness: [],
    pattern: [],
    recommendation: [],
    preference: [],
    deviation_pattern: [],
    personal_record: [],
    plateau: [],
    progressive_overload: [],
    recovery_pattern: [],
  };

  for (const insight of insights) {
    grouped[insight.insight_type].push(insight);
  }
  return grouped;
}

/**
 * Extract insights from a completed conversation using AI.
 * Runs asynchronously — does not block UI.
 */
export async function extractInsights(
  userId: string,
  interestId: string,
  conversation: AIConversation,
): Promise<AIInterestInsight[]> {
  const existingInsights = await getActiveInsights(userId, interestId);

  const existingBlock = existingInsights.length
    ? existingInsights.map((i) => `- [${i.insight_type}] ${i.content} (confidence: ${i.confidence})`).join('\n')
    : '(no existing insights)';

  const messagesBlock = conversation.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n\n');

  const systemPrompt = `You are an AI coaching memory system. Analyze this conversation and extract insights about the user's learning patterns.

EXISTING INSIGHTS (avoid duplicates, update if evidence strengthens):
${existingBlock}

Your response must be ONLY valid JSON array:
[{
  "insight_type": "strength|weakness|pattern|recommendation|preference|deviation_pattern|personal_record|plateau|progressive_overload|recovery_pattern",
  "content": "Concise insight description",
  "confidence": 0.1-1.0,
  "supersedes_content": "exact content of existing insight this replaces, or null"
}]

Guidelines:
- strength: Things they consistently do well
- weakness: Areas where they consistently struggle
- pattern: Behavioral patterns (e.g., "tends to skip warm-ups", "most productive in mornings")
- recommendation: Specific suggestions based on observed patterns
- preference: User preferences for how they like to work/train
- deviation_pattern: How and why they deviate from plans
- personal_record: New personal bests achieved (exercise, performance)
- plateau: Stalled progress on a metric over multiple sessions
- progressive_overload: Consistent improvement trends on a metric
- recovery_pattern: Patterns in recovery, fatigue, or readiness

Only extract insights with genuine evidence from the conversation. Be conservative — high confidence requires multiple data points. Return empty array if no clear insights emerge.`;

  try {
    const { data, error } = await supabase.functions.invoke('step-plan-suggest', {
      body: { system: systemPrompt, prompt: messagesBlock, max_tokens: 768 },
    });

    if (error || !data?.text) return [];

    const cleaned = data.text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as {
      insight_type: InsightType;
      content: string;
      confidence: number;
      supersedes_content?: string | null;
    }[];

    const created: AIInterestInsight[] = [];

    for (const item of parsed) {
      // If this supersedes an existing insight, mark old one as inactive
      if (item.supersedes_content) {
        const existing = existingInsights.find((i) => i.content === item.supersedes_content);
        if (existing) {
          await supabase
            .from('ai_interest_insights')
            .update({ active: false, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        }
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('ai_interest_insights')
        .insert({
          user_id: userId,
          interest_id: interestId,
          insight_type: item.insight_type,
          content: item.content,
          confidence: Math.min(1, Math.max(0.1, item.confidence)),
          evidence_step_ids: conversation.context_id ? [conversation.context_id] : [],
          active: true,
        })
        .select()
        .single();

      if (!insertErr && inserted) {
        created.push(inserted as AIInterestInsight);
      }
    }

    return created;
  } catch (err) {
    logger.error('extractInsights failed', err);
    return [];
  }
}

/**
 * Dismiss (deactivate) an insight.
 */
export async function dismissInsight(insightId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_interest_insights')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', insightId);

  if (error) throw error;
}

/**
 * Extract durable insights from a completed step's own captures + reflection —
 * even when the learner never opened a Train chat. The conversational extractor
 * (StepCritiqueContent / useAIConversation) only fires when a chat exists, so a
 * plain "write notes → mark done" flow otherwise leaves no memory behind. This
 * wraps the step's notes as a single-turn conversation and runs the same path.
 * Fire-and-forget; returns [] when there isn't enough signal to learn from.
 */
export async function extractInsightsFromStepReflection(
  userId: string,
  interestId: string,
  step: TimelineStepRecord,
): Promise<AIInterestInsight[]> {
  const metadata = (step.metadata ?? {}) as { act?: StepActData; review?: StepReviewData };
  const text = buildStepReflectionText(step, metadata.act ?? {}, metadata.review ?? {});
  // Below ~40 chars there's nothing worth an AI round-trip (and noise produces
  // low-value insights). Mirrors the capability-tagger's conservatism.
  if (text.length < 40) return [];

  const now = new Date().toISOString();
  const conversation: AIConversation = {
    id: step.id,
    user_id: userId,
    interest_id: interestId,
    context_type: 'review',
    context_id: step.id,
    messages: [{ role: 'user', content: text, timestamp: now }],
    summary: null,
    status: 'completed',
    created_at: step.completed_at ?? now,
    updated_at: now,
  };

  return extractInsights(userId, interestId, conversation);
}

function buildStepReflectionText(
  step: TimelineStepRecord,
  act: StepActData,
  review: StepReviewData,
): string {
  const parts: string[] = [];
  const title = (step.title ?? '').trim();
  if (title) parts.push(`Step: ${title}`);

  for (const obs of act.observations ?? []) {
    const t = obs.text?.trim();
    if (t) parts.push(`Observation: ${t}`);
  }
  for (const upload of act.media_uploads ?? []) {
    const c = upload.caption?.trim();
    if (c) parts.push(`Note: ${c}`);
  }

  for (const section of review.sections ?? []) {
    const c = section.content?.trim();
    if (c) parts.push(c);
  }
  const flat = review as StepReviewData & { what_worked?: string; what_didnt?: string };
  for (const value of [
    flat.what_worked,
    flat.what_didnt,
    review.what_learned,
    review.deviation_reason,
    review.next_step_notes,
    review.key_takeaway,
    review.teaching_reflection,
  ]) {
    const t = value?.trim();
    if (t) parts.push(t);
  }

  return parts.join('\n');
}

/**
 * Format active insights into a text block for AI prompts.
 */
export function formatInsightsForPrompt(insights: AIInterestInsight[]): string {
  if (insights.length === 0) return '';

  const grouped: Record<string, string[]> = {};
  for (const i of insights) {
    const key = i.insight_type;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(`${i.content} (confidence: ${(i.confidence * 100).toFixed(0)}%)`);
  }

  const sections = Object.entries(grouped).map(
    ([type, items]) => `${type.toUpperCase()}:\n${items.map((i) => `  - ${i}`).join('\n')}`,
  );

  return sections.join('\n');
}
