/**
 * Cross-Interest AI Suggestion Service
 *
 * Generates contextual suggestions that transfer insights from one interest
 * to another. Watches for cross-pollination opportunities based on recent
 * user activity across all enrolled interests.
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import {
  CROSS_REFERENCES,
  getCrossReferencesToInterest,
  getUniversalSkill,
} from '@/lib/skillTaxonomy';
import type {
  CrossReference,
  InterestSlug,
  SuggestionType,
  UniversalSkillId,
} from '@/lib/skillTaxonomy';

const logger = createLogger('crossInterestSuggestions');

// =============================================================================
// TYPES
// =============================================================================

export interface AISuggestion {
  id: string;
  userId: string;
  sourceInterestId: string;
  targetInterestId: string;
  suggestionType: SuggestionType;
  title: string;
  body: string;
  sourceEvidence: SuggestionEvidence | null;
  status: 'active' | 'applied' | 'dismissed' | 'saved';
  appliedToEventId: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface AISuggestionRow {
  id: string;
  user_id: string;
  source_interest_id: string;
  target_interest_id: string;
  suggestion_type: string;
  title: string;
  body: string;
  source_evidence: SuggestionEvidence | null;
  status: string;
  applied_to_event_id: string | null;
  created_at: string;
  expires_at: string;
}

export interface SuggestionEvidence {
  recentActivities: ActivitySummary[];
  universalSkillId: UniversalSkillId;
  crossReferenceIndex: number;
  confidence: number;
}

export interface ActivitySummary {
  eventId: string;
  eventType: string;
  title: string;
  date: string;
  skillsUsed: string[];
}

export interface UserInterestActivity {
  interestId: string;
  interestSlug: InterestSlug;
  recentEvents: ActivitySummary[];
  activeSkills: string[];
}

export interface GenerateSuggestionsInput {
  userId: string;
  targetInterestId: string;
  targetInterestSlug: InterestSlug;
  userActivities: UserInterestActivity[];
  maxSuggestions?: number;
}

export interface GenerateSuggestionsResult {
  suggestions: GeneratedSuggestion[];
  reasoning: string;
}

export interface GeneratedSuggestion {
  title: string;
  body: string;
  suggestionType: SuggestionType;
  sourceInterestId: string;
  sourceEvidence: SuggestionEvidence;
}

// =============================================================================
// ROW MAPPING
// =============================================================================

function rowToAISuggestion(row: AISuggestionRow): AISuggestion {
  return {
    id: row.id,
    userId: row.user_id,
    sourceInterestId: row.source_interest_id,
    targetInterestId: row.target_interest_id,
    suggestionType: row.suggestion_type as SuggestionType,
    title: row.title,
    body: row.body,
    sourceEvidence: row.source_evidence,
    status: row.status as AISuggestion['status'],
    appliedToEventId: row.applied_to_event_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

// =============================================================================
// QUERIES
// =============================================================================

export async function getActiveSuggestions(
  userId: string,
  targetInterestId: string,
): Promise<AISuggestion[]> {
  const { data, error } = await supabase
    .from('betterat_ai_suggestions')
    .select('*')
    .eq('user_id', userId)
    .eq('target_interest_id', targetInterestId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    logger.error('[getActiveSuggestions] Error:', error);
    throw error;
  }

  return (data as AISuggestionRow[]).map(rowToAISuggestion);
}

export async function getSavedSuggestions(
  userId: string,
): Promise<AISuggestion[]> {
  const { data, error } = await supabase
    .from('betterat_ai_suggestions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'saved')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    logger.error('[getSavedSuggestions] Error:', error);
    throw error;
  }

  return (data as AISuggestionRow[]).map(rowToAISuggestion);
}

export async function getSuggestion(
  suggestionId: string,
): Promise<AISuggestion | null> {
  const { data, error } = await supabase
    .from('betterat_ai_suggestions')
    .select('*')
    .eq('id', suggestionId)
    .maybeSingle();

  if (error) {
    logger.error('[getSuggestion] Error:', error);
    throw error;
  }

  return data ? rowToAISuggestion(data as AISuggestionRow) : null;
}

// =============================================================================
// MUTATIONS
// =============================================================================

export async function updateSuggestionStatus(
  suggestionId: string,
  status: 'applied' | 'dismissed' | 'saved',
  appliedToEventId?: string,
): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (appliedToEventId) {
    updates.applied_to_event_id = appliedToEventId;
  }

  const { error } = await supabase
    .from('betterat_ai_suggestions')
    .update(updates)
    .eq('id', suggestionId);

  if (error) {
    logger.error('[updateSuggestionStatus] Error:', error);
    throw error;
  }
}

export async function saveSuggestions(
  userId: string,
  targetInterestId: string,
  suggestions: GeneratedSuggestion[],
): Promise<AISuggestion[]> {
  if (suggestions.length === 0) return [];

  const rows = suggestions.map((s) => ({
    user_id: userId,
    source_interest_id: s.sourceInterestId,
    target_interest_id: targetInterestId,
    suggestion_type: s.suggestionType,
    title: s.title,
    body: s.body,
    source_evidence: s.sourceEvidence,
    status: 'active',
  }));

  const { data, error } = await supabase
    .from('betterat_ai_suggestions')
    .insert(rows)
    .select('*');

  if (error) {
    logger.error('[saveSuggestions] Error:', error);
    throw error;
  }

  return (data as AISuggestionRow[]).map(rowToAISuggestion);
}

export async function cleanExpiredSuggestions(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('betterat_ai_suggestions')
    .delete()
    .eq('user_id', userId)
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    logger.error('[cleanExpiredSuggestions] Error:', error);
    return 0;
  }

  return data?.length ?? 0;
}

// =============================================================================
// SUGGESTION GENERATION ENGINE
// =============================================================================

export function generateSuggestions(
  input: GenerateSuggestionsInput,
): GenerateSuggestionsResult {
  const {
    targetInterestSlug,
    userActivities,
    maxSuggestions = 3,
  } = input;

  const relevantCrossRefs = getCrossReferencesToInterest(targetInterestSlug);

  if (relevantCrossRefs.length === 0) {
    return {
      suggestions: [],
      reasoning: 'No cross-references found targeting ' + targetInterestSlug,
    };
  }

  const activityByInterest = new Map<InterestSlug, UserInterestActivity>();
  for (const activity of userActivities) {
    activityByInterest.set(activity.interestSlug, activity);
  }

  const scoredRefs: {
    ref: CrossReference;
    refIndex: number;
    score: number;
    sourceActivity: UserInterestActivity;
  }[] = [];

  for (const ref of relevantCrossRefs) {
    const sourceActivity = activityByInterest.get(ref.sourceInterest);
    if (!sourceActivity || sourceActivity.recentEvents.length === 0) {
      continue;
    }

    const recencyScore = calculateRecencyScore(sourceActivity.recentEvents);
    const skillMatchScore = calculateSkillMatchScore(
      ref.sourceSkillId,
      ref.sourceInterest,
      sourceActivity.activeSkills,
    );

    const totalScore = ref.transferStrength * recencyScore * skillMatchScore;

    if (totalScore > 0.1) {
      const refIndex = CROSS_REFERENCES.indexOf(ref);
      scoredRefs.push({ ref, refIndex, score: totalScore, sourceActivity });
    }
  }

  scoredRefs.sort((a, b) => b.score - a.score);
  const topRefs = scoredRefs.slice(0, maxSuggestions);

  const suggestions: GeneratedSuggestion[] = topRefs.map(({ ref, refIndex, score, sourceActivity }) => {
    const universalSkill = getUniversalSkill(ref.sourceSkillId);

    return {
      title: buildSuggestionTitle(ref, universalSkill?.label ?? ref.sourceSkillId),
      body: personalizeSuggestion(ref, sourceActivity),
      suggestionType: ref.suggestionType,
      sourceInterestId: sourceActivity.interestId,
      sourceEvidence: {
        recentActivities: sourceActivity.recentEvents.slice(0, 3),
        universalSkillId: ref.sourceSkillId,
        crossReferenceIndex: refIndex,
        confidence: score,
      },
    };
  });

  const topInterests = topRefs.map((r) => r.ref.sourceInterest).join(', ');

  return {
    suggestions,
    reasoning: 'Generated ' + suggestions.length + ' suggestions from ' + scoredRefs.length + ' candidate cross-references. Top interests: ' + topInterests,
  };
}

// =============================================================================
// SCORING HELPERS
// =============================================================================

function calculateRecencyScore(events: ActivitySummary[]): number {
  if (events.length === 0) return 0;

  const now = Date.now();
  const mostRecent = Math.max(
    ...events.map((e) => new Date(e.date).getTime()),
  );

  const daysSince = (now - mostRecent) / (1000 * 60 * 60 * 24);

  if (daysSince <= 3) return 1.0;
  if (daysSince <= 14) return 1.0 - (daysSince - 3) / 11;
  return 0;
}

function calculateSkillMatchScore(
  skillId: UniversalSkillId,
  interest: InterestSlug,
  activeSkills: string[],
): number {
  const universalSkill = getUniversalSkill(skillId);
  if (!universalSkill) return 0.3;

  const manifest = universalSkill.manifests[interest];
  if (!manifest) return 0.3;

  const matchCount = manifest.developedBy.filter((d) =>
    activeSkills.some((s) => s.includes(d) || d.includes(s)),
  ).length;

  if (matchCount === 0) return 0.3;
  return Math.min(1.0, 0.3 + (matchCount / manifest.developedBy.length) * 0.7);
}

// =============================================================================
// PERSONALIZATION HELPERS
// =============================================================================

function buildSuggestionTitle(
  ref: CrossReference,
  skillLabel: string,
): string {
  const typeLabels: Record<SuggestionType, string> = {
    skill_transfer: 'Skill Transfer',
    mental_model: 'Mental Model',
    practice_method: 'Practice Method',
    recovery_insight: 'Recovery Insight',
    metacognitive: 'Metacognitive',
  };

  const interestLabels: Record<InterestSlug, string> = {
    'sail-racing': 'Sailing',
    nursing: 'Nursing',
    drawing: 'Drawing',
    fitness: 'Fitness',
    'lifelong-learning': 'Lifelong Learning',
    'regenerative-agriculture': 'Regenerative Agriculture',
  };

  return typeLabels[ref.suggestionType] + ': ' + skillLabel + ' from ' + interestLabels[ref.sourceInterest];
}

function personalizeSuggestion(
  ref: CrossReference,
  sourceActivity: UserInterestActivity,
): string {
  let body = ref.exampleSuggestion;

  const recentEvent = sourceActivity.recentEvents[0];
  if (recentEvent) {
    const daysAgo = Math.round(
      (Date.now() - new Date(recentEvent.date).getTime()) / (1000 * 60 * 60 * 24),
    );
    const timeLabel =
      daysAgo === 0
        ? 'today'
        : daysAgo === 1
          ? 'yesterday'
          : daysAgo + ' days ago';

    body = 'Based on your ' + recentEvent.title + ' (' + timeLabel + '): ' + body;
  }

  return body;
}

// =============================================================================
// ORCHESTRATION
// =============================================================================

export async function generateAndSaveSuggestions(
  userId: string,
  targetInterestId: string,
  targetInterestSlug: InterestSlug,
  userActivities: UserInterestActivity[],
): Promise<AISuggestion[]> {
  const existing = await getActiveSuggestions(userId, targetInterestId);
  if (existing.length >= 2) {
    logger.info(
      '[generateAndSaveSuggestions] User ' + userId + ' already has ' + existing.length + ' active suggestions for ' + targetInterestSlug,
    );
    return existing;
  }

  await cleanExpiredSuggestions(userId);

  const result = generateSuggestions({
    userId,
    targetInterestId,
    targetInterestSlug,
    userActivities,
    maxSuggestions: 3 - existing.length,
  });

  logger.info('[generateAndSaveSuggestions] ' + result.reasoning);

  if (result.suggestions.length === 0) {
    return existing;
  }

  const saved = await saveSuggestions(
    userId,
    targetInterestId,
    result.suggestions,
  );

  return [...existing, ...saved];
}
