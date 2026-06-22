/**
 * StepPlanAIService — generates AI-powered planning suggestions
 * for timeline steps based on enriched context:
 *
 * - User's full step history with reflections and capability ratings
 * - Organization memberships and their competency definitions
 * - Followed users' recent completed steps (social learning)
 * - Organization programs the user participates in
 * - Linked library resources and capability goals
 *
 * Uses the step-plan-suggest edge function with a structured system prompt.
 * Falls back to race-coaching-chat if the new function is unavailable.
 */

import { supabase } from '@/services/supabase';
import { AIUsageService } from '@/services/ai/AIUsageService';
import type { LibraryResourceRecord } from '@/types/library';
import { getCourseCompletionPercent } from '@/types/library';
import type { StepPlanData, StepReviewData, StepActData, StepMetadata, CrossInterestSuggestion, ChatMessage, BrainDumpData, ExtractedUrl } from '@/types/step-detail';
import { getReviewSections, getReviewSectionContent } from '@/lib/step/getReviewSections';
import { sailorBoatService, type SailorBoat } from '@/services/SailorBoatService';
import { equipmentService, type BoatEquipment } from '@/services/EquipmentService';
import { getUserLibrary, getResources } from '@/services/LibraryService';
import { getManifesto } from '@/services/ManifestoService';
import { getActiveInsights, formatInsightsForPrompt } from '@/services/AIMemoryService';
import { getMeasurementHistory, formatMeasurementsForPrompt, type MeasurementHistorySummary } from '@/services/MeasurementExtractionService';
import { getPlaybookByUserInterest, getConcepts, getPatterns, getReviews } from '@/services/PlaybookService';
import type { UserInterestManifesto, AIInterestInsight } from '@/types/manifesto';
import type { PlaybookConceptRecord, PlaybookPatternRecord, PlaybookReviewRecord } from '@/types/playbook';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrichedPlanContext {
  interestName: string;
  interestId?: string;
  stepTitle: string;
  currentWhat?: string;
  linkedResources: LibraryResourceRecord[];
  capabilityGoals: string[];
  // Enriched context (gathered automatically)
  stepHistory: StepHistoryEntry[];
  orgCompetencies: OrgCompetencySummary[];
  followedUsersActivity: FollowedUserActivity[];
  orgPrograms: OrgProgramSummary[];
  userCapabilityProgress: CapabilityProgressEntry[];
  /** Full library resources for this interest (not just step-linked) */
  libraryResources: LibraryResourceRecord[];
  /** User's manifesto (vision/philosophy) for this interest */
  manifesto?: UserInterestManifesto | null;
  /** AI-extracted insights about this user's patterns */
  aiInsights?: AIInterestInsight[];
  /** Measurement history from recent sessions */
  measurementHistory?: MeasurementHistorySummary;
  /** User-authored distilled concepts from their playbook */
  playbookConcepts?: PlaybookConceptRecord[];
  /** AI-detected patterns across the user's own practice */
  playbookPatterns?: PlaybookPatternRecord[];
  /** Most recent weekly review (focus + knowledge health) */
  latestPlaybookReview?: PlaybookReviewRecord | null;
}

/** Legacy interface kept for backward compat */
interface PlanContext {
  interestName: string;
  stepTitle: string;
  currentWhat?: string;
  linkedResources: LibraryResourceRecord[];
  capabilityGoals: string[];
  previousStepSummaries: PreviousStepSummary[];
}

interface PreviousStepSummary {
  title: string;
  what: string;
  learned: string;
  nextNotes: string;
}

export interface StepHistoryEntry {
  title: string;
  status: string;
  what: string;
  learned: string;
  nextNotes: string;
  capabilityRatings: Record<string, number>;
  subStepsCompleted: number;
  subStepsTotal: number;
  updatedAt: string;
}

export interface OrgCompetencySummary {
  orgName: string;
  competencies: { title: string; category: string; status: string }[];
}

export interface FollowedUserActivity {
  userName: string;
  recentSteps: { title: string; what: string; learned: string }[];
}

export interface OrgProgramSummary {
  orgName: string;
  programName: string;
  description?: string;
  status: string;
}

export interface CapabilityProgressEntry {
  competencyTitle: string;
  category: string;
  status: string;
  attemptCount: number;
}

// ---------------------------------------------------------------------------
// Context Gathering
// ---------------------------------------------------------------------------

/**
 * Gather all enriched context for AI planning in parallel.
 */
export async function gatherEnrichedContext(
  userId: string,
  interestId: string,
): Promise<{
  stepHistory: StepHistoryEntry[];
  orgCompetencies: OrgCompetencySummary[];
  followedUsersActivity: FollowedUserActivity[];
  orgPrograms: OrgProgramSummary[];
  userCapabilityProgress: CapabilityProgressEntry[];
  libraryResources: LibraryResourceRecord[];
  manifesto: UserInterestManifesto | null;
  aiInsights: AIInterestInsight[];
  measurementHistory: MeasurementHistorySummary;
  playbookConcepts: PlaybookConceptRecord[];
  playbookPatterns: PlaybookPatternRecord[];
  latestPlaybookReview: PlaybookReviewRecord | null;
}> {
  const [stepHistory, orgCompetencies, followedUsersActivity, orgPrograms, userCapabilityProgress, libraryResources, manifesto, aiInsights, measurementHistory, playbookLayers] =
    await Promise.all([
      getFullStepHistory(userId, interestId),
      getOrgCompetencies(userId, interestId),
      getFollowedUsersActivity(userId, interestId),
      getUserOrgPrograms(userId, interestId),
      getUserCapabilityProgress(userId, interestId),
      getFullLibraryResources(userId, interestId),
      getManifesto(userId, interestId).catch(() => null),
      getActiveInsights(userId, interestId).catch(() => []),
      getMeasurementHistory(userId, interestId).catch(() => ({ hasData: false, recentSessions: [], exercisePRs: {} }) as MeasurementHistorySummary),
      gatherPlaybookLayers(userId, interestId),
    ]);

  return {
    stepHistory,
    orgCompetencies,
    followedUsersActivity,
    orgPrograms,
    userCapabilityProgress,
    libraryResources,
    manifesto,
    aiInsights,
    measurementHistory,
    playbookConcepts: playbookLayers.concepts,
    playbookPatterns: playbookLayers.patterns,
    latestPlaybookReview: playbookLayers.latestReview,
  };
}

/**
 * Fetch the user's *synthesized* playbook layers (distilled concepts,
 * AI-detected patterns, latest weekly review) for an interest. Read-only:
 * returns empty results when the user has no playbook yet, and never creates
 * one. Each sub-fetch is independently defensive so a single failure can't
 * sink the planning context.
 */
export async function gatherPlaybookLayers(
  userId: string,
  interestId: string,
): Promise<{
  concepts: PlaybookConceptRecord[];
  patterns: PlaybookPatternRecord[];
  latestReview: PlaybookReviewRecord | null;
}> {
  try {
    const playbook = await getPlaybookByUserInterest(userId, interestId);
    if (!playbook) return { concepts: [], patterns: [], latestReview: null };

    const [concepts, patterns, reviews] = await Promise.all([
      getConcepts(playbook.id, interestId).catch(() => [] as PlaybookConceptRecord[]),
      getPatterns(playbook.id).catch(() => [] as PlaybookPatternRecord[]),
      getReviews(playbook.id, 1).catch(() => [] as PlaybookReviewRecord[]),
    ]);

    return { concepts, patterns, latestReview: reviews[0] ?? null };
  } catch {
    return { concepts: [], patterns: [], latestReview: null };
  }
}

/**
 * Step Arch E — Read review prompt content from sections[] when present,
 * falling back to legacy flat fields. Used by step-history summarizers.
 */
function readReviewPrompt(
  metadata: unknown,
  prompt: 'what_did_you_learn' | 'anything_else',
  flatFallback: string | undefined,
): string {
  const sections = getReviewSections(metadata as StepMetadata | undefined).sections;
  return getReviewSectionContent(sections, prompt) ?? flatFallback ?? '';
}

/**
 * Full step history (up to 10 most recent completed + in-progress).
 */
async function getFullStepHistory(userId: string, interestId: string): Promise<StepHistoryEntry[]> {
  try {
    const { data, error } = await supabase
      .from('timeline_steps')
      .select('title, status, metadata, updated_at')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .in('status', ['completed', 'in_progress'])
      .order('updated_at', { ascending: false })
      .limit(10);

    if (error || !data) return [];

    return data.map((row: any) => {
      const plan: StepPlanData = row.metadata?.plan ?? {};
      const review: StepReviewData = row.metadata?.review ?? {};
      const act: StepActData = row.metadata?.act ?? {};
      const subSteps = plan.how_sub_steps ?? [];
      const progress = act.sub_step_progress ?? {};
      return {
        title: row.title,
        status: row.status,
        what: plan.what_will_you_do ?? '',
        learned: readReviewPrompt(row.metadata, 'what_did_you_learn', review.what_learned),
        nextNotes: readReviewPrompt(row.metadata, 'anything_else', review.next_step_notes),
        capabilityRatings: review.capability_progress ?? {},
        subStepsCompleted: subSteps.filter((s) => progress[s.id]).length,
        subStepsTotal: subSteps.length,
        updatedAt: row.updated_at,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Competency definitions from organizations the user belongs to.
 */
async function getOrgCompetencies(userId: string, interestId: string): Promise<OrgCompetencySummary[]> {
  try {
    // Get user's active org memberships
    const { data: memberships, error: memErr } = await supabase
      .from('organization_memberships')
      .select('organization_id')
      .eq('user_id', userId)
      .in('status', ['active', 'verified']);

    if (memErr || !memberships?.length) return [];

    const orgIds = memberships.map((m: any) => m.organization_id);

    // Get org names
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', orgIds);

    const orgMap = new Map((orgs ?? []).map((o: any) => [o.id, o.name]));

    // Get competencies for this interest
    const { data: competencies } = await supabase
      .from('betterat_competencies')
      .select('id, title, category, interest_id')
      .eq('interest_id', interestId)
      .order('sort_order', { ascending: true })
      .limit(50);

    if (!competencies?.length) return [];

    // Get user's progress on these competencies
    const compIds = competencies.map((c: any) => c.id);
    const { data: progressRows } = await supabase
      .from('betterat_competency_progress')
      .select('competency_id, status')
      .eq('user_id', userId)
      .in('competency_id', compIds);

    const progressMap = new Map((progressRows ?? []).map((p: any) => [p.competency_id, p.status]));

    // Group by org
    // Group all competencies under the first org name (competencies are interest-scoped, not org-scoped)
    const orgName = orgMap.values().next().value || 'Organization';
    const items = (competencies as any[]).map((c) => ({
      title: c.title,
      category: c.category ?? '',
      status: progressMap.get(c.id) ?? 'not_started',
    }));

    return items.length > 0 ? [{ orgName, competencies: items }] : [];
  } catch {
    return [];
  }
}

/**
 * Recent completed steps from users this person follows.
 */
export async function getFollowedUsersActivity(
  userId: string,
  interestId: string,
): Promise<FollowedUserActivity[]> {
  try {
    // Get followed user IDs
    const { data: follows, error: followErr } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId)
      .limit(20);

    if (followErr || !follows?.length) return [];

    const followedIds = follows.map((f: any) => f.following_id);

    // Get recent completed steps from followed users for same interest
    const { data: steps } = await supabase
      .from('timeline_steps')
      .select('user_id, title, metadata')
      .in('user_id', followedIds)
      .eq('interest_id', interestId)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(15);

    if (!steps?.length) return [];

    // Get user names
    const uniqueUserIds = [...new Set(steps.map((s: any) => s.user_id))];
    const { data: profiles } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', uniqueUserIds);

    const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name || 'Someone you follow']));

    // Group by user
    const byUser = new Map<string, { title: string; what: string; learned: string }[]>();
    for (const s of steps as any[]) {
      const name = nameMap.get(s.user_id) || 'Someone you follow';
      if (!byUser.has(name)) byUser.set(name, []);
      const plan: StepPlanData = s.metadata?.plan ?? {};
      const review: StepReviewData = s.metadata?.review ?? {};
      byUser.get(name)!.push({
        title: s.title,
        what: plan.what_will_you_do ?? '',
        learned: readReviewPrompt(s.metadata, 'what_did_you_learn', review.what_learned),
      });
    }

    return Array.from(byUser.entries()).map(([userName, recentSteps]) => ({
      userName,
      recentSteps: recentSteps.slice(0, 3), // max 3 per user
    }));
  } catch {
    return [];
  }
}

/**
 * Organization programs the user participates in.
 */
export async function getUserOrgPrograms(userId: string, interestId: string): Promise<OrgProgramSummary[]> {
  try {
    // Get programs user participates in
    const { data: participations } = await supabase
      .from('program_participants')
      .select('program_id')
      .eq('user_id', userId)
      .limit(10);

    if (!participations?.length) return [];

    const programIds = participations.map((p: any) => p.program_id);

    const { data: programs } = await supabase
      .from('programs')
      .select('id, title, description, status, organization_id, interest_id')
      .in('id', programIds);

    if (!programs?.length) return [];

    // Filter to relevant interest (or include all if interest_id isn't set on program)
    const relevant = (programs as any[]).filter(
      (p) => !p.interest_id || p.interest_id === interestId,
    );

    if (!relevant.length) return [];

    // Get org names
    const orgIds = [...new Set(relevant.map((p) => p.organization_id).filter(Boolean))];
    const { data: orgs } = orgIds.length
      ? await supabase.from('organizations').select('id, name').in('id', orgIds)
      : { data: [] };

    const orgMap = new Map((orgs ?? []).map((o: any) => [o.id, o.name]));

    return relevant.map((p) => ({
      orgName: orgMap.get(p.organization_id) || '',
      programName: p.title,
      description: p.description ?? undefined,
      status: p.status,
    }));
  } catch {
    return [];
  }
}

/**
 * User's competency progress across all orgs for this interest.
 */
export async function getUserCapabilityProgress(
  userId: string,
  interestId: string,
): Promise<CapabilityProgressEntry[]> {
  try {
    // Get competencies for this interest
    const { data: competencies } = await supabase
      .from('betterat_competencies')
      .select('id, title, category')
      .eq('interest_id', interestId)
      .limit(100);

    if (!competencies?.length) return [];

    const compIds = competencies.map((c: any) => c.id);
    const compMap = new Map(
      (competencies as any[]).map((c) => [c.id, { title: c.title, category: c.category ?? '' }]),
    );

    // Get user's progress
    const { data: progressRows } = await supabase
      .from('betterat_competency_progress')
      .select('competency_id, status, attempts_count')
      .eq('user_id', userId)
      .in('competency_id', compIds);

    if (!progressRows?.length) return [];

    return (progressRows as any[]).map((p) => ({
      competencyTitle: compMap.get(p.competency_id)?.title ?? '',
      category: compMap.get(p.competency_id)?.category ?? '',
      status: p.status,
      attemptCount: p.attempts_count ?? 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch the user's full library for this interest (up to 50 resources).
 */
async function getFullLibraryResources(
  userId: string,
  interestId: string,
): Promise<LibraryResourceRecord[]> {
  try {
    const library = await getUserLibrary(userId, interestId);
    return await getResources(library.id);
  } catch {
    return [];
  }
}

/**
 * Format library resources into a concise text block for AI prompts.
 */
export function formatLibraryForPrompt(resources: LibraryResourceRecord[]): string {
  if (resources.length === 0) return '';

  const lines = resources.map((r) => {
    let line = `- ${r.title}`;
    if (r.author_or_creator) line += ` by ${r.author_or_creator}`;
    line += ` (${r.resource_type})`;
    if (r.url) line += ` — ${r.url}`;

    // Show course progress if applicable
    if (r.resource_type === 'online_course') {
      const pct = getCourseCompletionPercent(r);
      if (pct !== null) line += ` [${pct}% complete]`;
    }

    // Show capability goals
    if (r.capability_goals?.length) {
      line += `\n  Skills: ${r.capability_goals.join(', ')}`;
    }

    return line;
  });

  return lines.join('\n');
}

/** Collapse markdown/whitespace to a single trimmed line, capped to maxLen. */
function oneLineExcerpt(text: string | null | undefined, maxLen = 160): string {
  if (!text) return '';
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > maxLen ? `${flat.slice(0, maxLen - 1)}…` : flat;
}

/**
 * User-authored distilled concepts. Baselines (playbook_id null) are platform
 * content, not the user's own knowledge, so we drop them. Settled concepts rank
 * first, then most recently updated. Capped at 8, one line each.
 */
export function formatConceptsForPrompt(concepts: PlaybookConceptRecord[]): string {
  const authored = concepts.filter((c) => c.playbook_id);
  if (authored.length === 0) return '';

  const ranked = [...authored].sort((a, b) => {
    const aSettled = a.state === 'settled' ? 1 : 0;
    const bSettled = b.state === 'settled' ? 1 : 0;
    if (aSettled !== bSettled) return bSettled - aSettled;
    return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
  });

  return ranked
    .slice(0, 8)
    .map((c) => {
      const excerpt = oneLineExcerpt(c.ai_synthesis_text || c.body_md || c.body, 140);
      return excerpt ? `- ${c.title}: ${excerpt}` : `- ${c.title}`;
    })
    .join('\n');
}

/**
 * AI-detected patterns in the user's own practice. Pinned first, then most
 * recent (input is already non-dismissed, sorted by created_at desc). Cap 5.
 */
export function formatPatternsForPrompt(patterns: PlaybookPatternRecord[]): string {
  if (patterns.length === 0) return '';

  const ranked = [...patterns].sort((a, b) => {
    const aPinned = a.status === 'pinned' ? 1 : 0;
    const bPinned = b.status === 'pinned' ? 1 : 0;
    return bPinned - aPinned;
  });

  return ranked
    .slice(0, 5)
    .map((p) => {
      const excerpt = oneLineExcerpt(p.body_md, 140);
      return excerpt ? `- ${p.title}: ${excerpt}` : `- ${p.title}`;
    })
    .join('\n');
}

/** Latest weekly review — surface the focus suggestion and any flagged gaps. */
export function formatLatestReviewForPrompt(review: PlaybookReviewRecord | null | undefined): string {
  if (!review) return '';

  const parts: string[] = [];
  const focus = oneLineExcerpt(review.focus_suggestion_md, 240);
  if (focus) parts.push(`Focus suggestion: ${focus}`);

  const gaps = review.knowledge_health?.gaps ?? [];
  if (gaps.length) {
    const gapLines = gaps
      .slice(0, 3)
      .map((g) => `  - ${g.topic}${g.description ? `: ${oneLineExcerpt(g.description, 100)}` : ''}`);
    parts.push(`Knowledge gaps to address:\n${gapLines.join('\n')}`);
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Prompt Building
// ---------------------------------------------------------------------------

function buildEnrichedPrompt(ctx: EnrichedPlanContext): string {
  const sections: string[] = [];

  // Manifesto (highest priority — user's vision and philosophy)
  if (ctx.manifesto?.content?.trim()) {
    let manifestoSection = `MANIFESTO (user's vision and philosophy):\n${ctx.manifesto.content}`;
    if (ctx.manifesto.philosophies?.length) {
      manifestoSection += `\nPhilosophies: ${ctx.manifesto.philosophies.join(', ')}`;
    }
    if (ctx.manifesto.role_models?.length) {
      manifestoSection += `\nRole models: ${ctx.manifesto.role_models.join(', ')}`;
    }
    const cadenceEntries = Object.entries(ctx.manifesto.weekly_cadence ?? {}).filter(([, v]) => v != null);
    if (cadenceEntries.length) {
      manifestoSection += `\nWeekly cadence: ${cadenceEntries.map(([k, v]) => `${k}: ${v}x/wk`).join(', ')}`;
    }
    sections.push(manifestoSection);
  }

  // AI Insights (patterns the AI has learned about this user)
  if (ctx.aiInsights?.length) {
    const insightsBlock = formatInsightsForPrompt(ctx.aiInsights);
    if (insightsBlock) {
      sections.push(`AI INSIGHTS (learned patterns about this user):\n${insightsBlock}`);
    }
  }

  // Playbook — the user's own distilled knowledge. Highest-signal context after
  // their manifesto: concepts they wrote, patterns detected in their practice,
  // and their latest weekly focus. Suggestions should build on these by name.
  if (ctx.playbookConcepts?.length) {
    const conceptsBlock = formatConceptsForPrompt(ctx.playbookConcepts);
    if (conceptsBlock) {
      sections.push(`YOUR DISTILLED KNOWLEDGE (concepts you've written):\n${conceptsBlock}`);
    }
  }

  if (ctx.playbookPatterns?.length) {
    const patternsBlock = formatPatternsForPrompt(ctx.playbookPatterns);
    if (patternsBlock) {
      sections.push(`PATTERNS IN YOUR OWN PRACTICE:\n${patternsBlock}`);
    }
  }

  if (ctx.latestPlaybookReview) {
    const reviewBlock = formatLatestReviewForPrompt(ctx.latestPlaybookReview);
    if (reviewBlock) {
      sections.push(`YOUR LATEST WEEKLY FOCUS:\n${reviewBlock}`);
    }
  }

  // Measurement history (exercise PRs, recent training data)
  if (ctx.measurementHistory?.hasData) {
    const measurementBlock = formatMeasurementsForPrompt(ctx.measurementHistory);
    if (measurementBlock) {
      sections.push(measurementBlock);
    }
  }

  // Step history
  if (ctx.stepHistory.length) {
    const historyLines = ctx.stepHistory.map((s) => {
      let line = `- "${s.title}" (${s.status})`;
      if (s.what) line += `\n  Focus: ${s.what}`;
      if (s.learned) line += `\n  Learned: ${s.learned}`;
      if (s.nextNotes) line += `\n  Next ideas: ${s.nextNotes}`;
      if (s.subStepsTotal > 0) line += `\n  Sub-steps: ${s.subStepsCompleted}/${s.subStepsTotal} completed`;
      const ratings = Object.entries(s.capabilityRatings);
      if (ratings.length) {
        line += `\n  Self-ratings: ${ratings.map(([k, v]) => `${k}: ${v}/5`).join(', ')}`;
      }
      return line;
    });
    sections.push(`STEP HISTORY (most recent first):\n${historyLines.join('\n')}`);
  } else {
    sections.push('STEP HISTORY: This is their first step — no prior history.');
  }

  // Org competencies
  if (ctx.orgCompetencies.length) {
    const orgLines = ctx.orgCompetencies.map((org) => {
      const compLines = org.competencies.map(
        (c) => `  - ${c.title} [${c.category}] — ${c.status}`,
      );
      return `${org.orgName}:\n${compLines.join('\n')}`;
    });
    sections.push(`ORGANIZATION COMPETENCIES:\n${orgLines.join('\n')}`);
  }

  // User's capability progress
  if (ctx.userCapabilityProgress.length) {
    const inProgress = ctx.userCapabilityProgress.filter((c) => c.status !== 'competent');
    const mastered = ctx.userCapabilityProgress.filter((c) => c.status === 'competent');
    const lines: string[] = [];
    if (inProgress.length) {
      lines.push('Still developing:');
      inProgress.forEach((c) => lines.push(`  - ${c.competencyTitle} [${c.category}]: ${c.status} (${c.attemptCount} attempts)`));
    }
    if (mastered.length) {
      lines.push('Mastered:');
      mastered.forEach((c) => lines.push(`  - ${c.competencyTitle} [${c.category}]`));
    }
    sections.push(`CAPABILITY PROGRESS:\n${lines.join('\n')}`);
  }

  // Followed users' activity
  if (ctx.followedUsersActivity.length) {
    const activityLines = ctx.followedUsersActivity.map((u) => {
      const stepLines = u.recentSteps.map((s) => {
        let line = `  - "${s.title}"`;
        if (s.what) line += `: ${s.what}`;
        if (s.learned) line += ` → Learned: ${s.learned}`;
        return line;
      });
      return `${u.userName}:\n${stepLines.join('\n')}`;
    });
    sections.push(`WHAT PEOPLE YOU FOLLOW ARE WORKING ON:\n${activityLines.join('\n')}`);
  }

  // Org programs
  if (ctx.orgPrograms.length) {
    const progLines = ctx.orgPrograms.map(
      (p) => `- ${p.programName}${p.orgName ? ` (${p.orgName})` : ''}: ${p.status}${p.description ? ` — ${p.description}` : ''}`,
    );
    sections.push(`PROGRAMS YOU'RE ENROLLED IN:\n${progLines.join('\n')}`);
  }

  // Full library (all resources the user has curated for this interest)
  if (ctx.libraryResources?.length) {
    const linkedIds = new Set(ctx.linkedResources.map((r) => r.id));
    // Show unlinked library resources — the linked ones appear separately below
    const unlinkedResources = ctx.libraryResources.filter((r) => !linkedIds.has(r.id));
    if (unlinkedResources.length) {
      const libraryBlock = formatLibraryForPrompt(unlinkedResources);
      sections.push(`USER'S RESOURCE LIBRARY (available but not yet linked to this step):\n${libraryBlock}`);
    }
  }

  // Linked resources (specifically chosen for this step)
  const resourceList = ctx.linkedResources
    .map((r) => `- ${r.title}${r.author_or_creator ? ` by ${r.author_or_creator}` : ''} (${r.resource_type})`)
    .join('\n');
  if (resourceList) {
    sections.push(`LINKED LIBRARY RESOURCES (chosen for this step):\n${resourceList}`);
  }

  // Capability goals for this step
  if (ctx.capabilityGoals.length) {
    sections.push(`CAPABILITY GOALS FOR THIS STEP:\n${ctx.capabilityGoals.map((g) => `- ${g}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Generate an enriched plan suggestion using full user context.
 */
export async function generateEnrichedPlanSuggestion(ctx: EnrichedPlanContext): Promise<string> {
  const contextBlock = buildEnrichedPrompt(ctx);

  const systemPrompt = `You are an expert learning coach on the BetterAt platform. You help people deliberately practice and improve at "${ctx.interestName}".

Your role is to suggest what the user should focus on in their next practice session, considering:
1. Their own distilled knowledge — concepts they've written, patterns detected in their practice, and their latest weekly focus. This is what they've personally learned; build directly on it.
2. Their full step history — what they've done, learned, and where they rated themselves low
3. Organization-defined competencies — especially ones they haven't mastered yet
4. What people they follow are working on — for social learning and inspiration
5. Programs they're enrolled in — to align with structured learning paths
6. Their linked resources — to suggest specific exercises from materials they have
7. Their resource library — suggest specific resources they already own that are relevant to this session. For courses, note their progress and suggest the next unfinished lesson.

Be specific and practical. Suggest 2-3 concrete activities or exercises. Prioritize:
- Building on the user's own concepts, patterns, and weekly focus — reference them by name ("Building on your note about X…") so the suggestion visibly connects to what they've already learned
- Competencies where they're still developing (not yet "competent")
- Skills where they rated themselves low (1-2 out of 5)
- Natural progressions from what they learned in recent steps
- Alignment with any active program curriculum
- Interesting approaches from people they follow
- Specific resources from their library (by name) that would help with this session

Keep it under 200 words. Write in second person ("You could..."). Do not use markdown formatting.

IMPORTANT: Start your response with a concise session title on its own line (5-10 words, no quotes, no prefix), then a blank line, then the suggestion body. Example:
Lace Pattern Basics with Yarn Overs

You could start by practicing...`;

  const userMessage = `The user is planning a step titled "${ctx.stepTitle}".
${ctx.currentWhat ? `They've started writing: "${ctx.currentWhat}"` : 'They haven\'t written anything yet.'}

Here is their full context:

${contextBlock}

Based on all of this, suggest what they should focus on in this session.`;

  // Try the dedicated edge function first, fall back to generic
  try {
    const { data, error } = await supabase.functions.invoke('step-plan-suggest', {
      body: { system: systemPrompt, prompt: userMessage, max_tokens: 768 },
    });
    if (!error && data?.text) {
      void AIUsageService.recordUsage('plan_generation');
      return data.text;
    }
  } catch {
    // Fall through to fallback
  }

  // Fallback: pack everything into a single prompt for the generic function
  const fallbackPrompt = `${systemPrompt}\n\n${userMessage}`;
  const { data, error } = await supabase.functions.invoke('race-coaching-chat', {
    body: { prompt: fallbackPrompt, max_tokens: 768 },
  });

  if (error) throw error;
  void AIUsageService.recordUsage('plan_generation');
  return data?.text || 'Unable to generate suggestion. Try again.';
}

/**
 * Generate a chat-based plan suggestion using multi-turn conversation.
 * Prepends enriched context as the first user message, then appends the full chat history.
 */
export async function generateChatPlanSuggestion(
  ctx: EnrichedPlanContext,
  chatHistory: ChatMessage[],
): Promise<string> {
  const contextBlock = buildEnrichedPrompt(ctx);

  const systemPrompt = `You are an expert learning coach on the BetterAt platform. You help people deliberately practice and improve at "${ctx.interestName}".

Your role is to have a conversation about what the user should focus on in their practice session. Consider:
1. Their own distilled knowledge — concepts they've written, patterns detected in their practice, and their latest weekly focus. Build directly on it and reference it by name.
2. Their full step history — what they've done, learned, and where they rated themselves low
3. Organization-defined competencies — especially ones they haven't mastered yet
4. What people they follow are working on — for social learning and inspiration
5. Programs they're enrolled in — to align with structured learning paths
6. Their linked resources — to suggest specific exercises from materials they have
7. Their resource library — reference specific resources they already own. For courses, note progress and suggest the next lesson.

Be specific and practical. When suggesting activities, give 2-3 concrete exercises. Build on the user's own concepts, patterns, and weekly focus by name when relevant, and reference specific resources from their library by name when relevant. Respond conversationally but concisely (under 200 words per response). Write in second person ("You could..."). Do not use markdown formatting.`;

  // Build messages array: enriched context as first user message, then full chat history
  const contextMessage = `The user is planning a step titled "${ctx.stepTitle}".
${ctx.currentWhat ? `They've started writing: "${ctx.currentWhat}"` : 'They haven\'t written anything yet.'}

Here is their full context:

${contextBlock}

Based on all of this, suggest what they should focus on in this session.`;

  const messages: { role: string; content: string }[] = [
    { role: 'user', content: contextMessage },
    ...chatHistory.map((m) => ({ role: m.role, content: m.content })),
  ];

  // Try dedicated edge function with messages array
  try {
    const { data, error } = await supabase.functions.invoke('step-plan-suggest', {
      body: { system: systemPrompt, messages, max_tokens: 768 },
    });
    if (!error && data?.text) return data.text;
  } catch {
    // Fall through to fallback
  }

  // Fallback: pack into single prompt
  const fallbackPrompt = `${systemPrompt}\n\n${messages.map((m) => `${m.role}: ${m.content}`).join('\n\n')}`;
  const { data, error } = await supabase.functions.invoke('race-coaching-chat', {
    body: { prompt: fallbackPrompt, max_tokens: 768 },
  });

  if (error) throw error;
  return data?.text || 'Unable to generate suggestion. Try again.';
}

// ---------------------------------------------------------------------------
// Critique / Review Insight
// ---------------------------------------------------------------------------

export interface CritiqueInsightContext {
  interestName: string;
  stepTitle: string;
  planWhat: string;
  actNotes: string;
  subStepsCompleted: number;
  subStepsTotal: number;
  workedToPlan: boolean | null;
  deviationReason: string;
  whatLearned: string;
  capabilityRatings: Record<string, number>;
  stepHistory: StepHistoryEntry[];
  // Competency + evidence context (Phase 1 enrichment)
  plannedCompetencies?: { id: string; title: string; category: string; description: string | null }[];
  userCompetencyProgress?: CapabilityProgressEntry[];
  orgCompetencies?: OrgCompetencySummary[];
  mediaUploads?: { caption?: string; type: string }[];
  actNutritionSummary?: string;
  actMeasurementSummary?: string;
  planCapabilityGoals?: string[];
}

/**
 * Generate an AI insight for the critique/review phase.
 * Analyzes evidence against planned competencies and patterns across history.
 */
export async function generateCritiqueInsight(ctx: CritiqueInsightContext): Promise<string> {
  const historyBlock = ctx.stepHistory.length
    ? ctx.stepHistory.map((s) => {
        let line = `- "${s.title}" (${s.status})`;
        if (s.what) line += `\n  Focus: ${s.what}`;
        if (s.learned) line += `\n  Learned: ${s.learned}`;
        const ratings = Object.entries(s.capabilityRatings);
        if (ratings.length) {
          line += `\n  Ratings: ${ratings.map(([k, v]) => `${k}: ${v}/5`).join(', ')}`;
        }
        return line;
      }).join('\n')
    : '(no prior steps)';

  const currentRatings = Object.entries(ctx.capabilityRatings);
  const ratingsBlock = currentRatings.length
    ? currentRatings.map(([k, v]) => `- ${k}: ${v}/5`).join('\n')
    : '(no ratings yet)';

  // Build competency context blocks
  const hasCompetencies = (ctx.plannedCompetencies?.length ?? 0) > 0;
  const hasEvidence = (ctx.mediaUploads?.length ?? 0) > 0 || ctx.actNotes || ctx.actNutritionSummary || ctx.actMeasurementSummary;

  const competencyBlock = hasCompetencies
    ? ctx.plannedCompetencies!.map((c) => {
        const progress = ctx.userCompetencyProgress?.find(p => p.competencyTitle === c.title);
        return `- ${c.title} [${c.category}]: ${c.description || '(no description)'} — Status: ${progress?.status ?? 'not started'}, Attempts: ${progress?.attemptCount ?? 0}`;
      }).join('\n')
    : '';

  const evidenceBlock = [
    ctx.actNotes ? `Notes: ${ctx.actNotes}` : '',
    (ctx.mediaUploads?.length ?? 0) > 0
      ? `Photos/videos: ${ctx.mediaUploads!.length} uploads${ctx.mediaUploads!.filter(m => m.caption).map(m => ` ("${m.caption}")`).join(',')}`
      : '',
    ctx.actMeasurementSummary ? `Measurements: ${ctx.actMeasurementSummary}` : '',
    ctx.actNutritionSummary ? `Nutrition: ${ctx.actNutritionSummary}` : '',
  ].filter(Boolean).join('\n');

  const frameworkBlock = ctx.orgCompetencies?.length
    ? ctx.orgCompetencies.flatMap(org =>
        org.competencies
          .filter(c => c.status !== 'competent')
          .slice(0, 8)
          .map(c => `- ${c.title} [${c.category}]: ${c.status}`)
      ).join('\n')
    : '';

  const systemPrompt = `You are an expert learning coach on the BetterAt platform, reviewing a ${ctx.interestName} session.

Your role is to assess whether the evidence from this session demonstrates the planned skills, and to surface patterns across their learning history.

Analyze in this order:
${hasCompetencies && hasEvidence ? `1. EVIDENCE vs PLAN: For each planned competency, does the evidence (notes, photos, measurements, nutrition) indicate it was practiced? At what level — initial exposure, developing, or proficient?
2. UNPLANNED SKILLS: Did the evidence show any additional skills not explicitly planned?
3. GAPS: What's still needed to advance these competencies? Be specific.
4. PATTERNS: How does this session fit into their broader history — improving, plateauing, or stuck?` : `1. PATTERNS: How their self-ratings have changed over time — improving, plateauing, or stuck?
2. PLAN ADHERENCE: Whether they consistently deviate from plans — and what that means.
3. RECURRING THEMES: Are they circling the same challenges?
4. GROWTH: What are their strongest growth areas?`}

Be encouraging but honest. Point out 2-3 specific observations. Reference specific competency names and evidence when possible.

Keep it under 250 words. Write in second person ("You've been..."). Do not use markdown formatting.`;

  const userMessage = `Current session: "${ctx.stepTitle}"
Plan: ${ctx.planWhat || '(not specified)'}
${ctx.planCapabilityGoals?.length ? `Skill goals: ${ctx.planCapabilityGoals.join(', ')}` : ''}
Sub-steps: ${ctx.subStepsCompleted}/${ctx.subStepsTotal} completed
Worked to plan: ${ctx.workedToPlan === null ? 'not answered' : ctx.workedToPlan ? 'yes' : 'no'}${ctx.deviationReason ? `\nDeviation: ${ctx.deviationReason}` : ''}
What they learned: ${ctx.whatLearned || '(not yet filled in)'}
${competencyBlock ? `\nPLANNED COMPETENCIES FOR THIS SESSION:\n${competencyBlock}` : ''}
${evidenceBlock ? `\nEVIDENCE FROM THIS SESSION:\n${evidenceBlock}` : ''}
Current session ratings:
${ratingsBlock}
${frameworkBlock ? `\nFRAMEWORK COMPETENCIES STILL IN PROGRESS:\n${frameworkBlock}` : ''}
Previous step history (most recent first):
${historyBlock}`;

  try {
    const { data, error } = await supabase.functions.invoke('step-plan-suggest', {
      body: { system: systemPrompt, prompt: userMessage, max_tokens: 768 },
    });
    if (!error && data?.text) return data.text;
  } catch {
    // Fall through
  }

  const fallbackPrompt = `${systemPrompt}\n\n${userMessage}`;
  const { data, error } = await supabase.functions.invoke('race-coaching-chat', {
    body: { prompt: fallbackPrompt, max_tokens: 768 },
  });

  if (error) throw error;
  return data?.text || 'Unable to generate insight. Try again.';
}

// ---------------------------------------------------------------------------
// Cross-Interest Suggestions
// ---------------------------------------------------------------------------

export interface OtherInterestSummary {
  slug: string;
  name: string;
  accentColor: string;
  iconName: string | null;
  recentSteps: { title: string; what: string }[];
  capabilityProgress: { title: string; status: string }[];
}

export interface CrossInterestContextData {
  otherInterests: OtherInterestSummary[];
}

/**
 * Gather context from user's other interests (max 4) for cross-interest suggestions.
 */
export async function gatherCrossInterestContext(
  userId: string,
  currentInterestId: string,
  otherInterests: { id: string; slug: string; name: string; accent_color: string; icon_name: string | null }[],
): Promise<CrossInterestContextData> {
  const limited = otherInterests.slice(0, 4);

  const results = await Promise.all(
    limited.map(async (interest) => {
      const [stepsResult, progressResult] = await Promise.all([
        Promise.resolve(
          supabase
            .from('timeline_steps')
            .select('title, metadata')
            .eq('user_id', userId)
            .eq('interest_id', interest.id)
            .in('status', ['completed', 'in_progress'])
            .order('updated_at', { ascending: false })
            .limit(5),
        )
          .then(({ data }) =>
            (data ?? []).map((row: any) => ({
              title: row.title,
              what: (row.metadata?.plan as StepPlanData)?.what_will_you_do ?? '',
            })),
          )
          .catch(() => [] as { title: string; what: string }[]),
        getUserCapabilityProgress(userId, interest.id)
          .then((entries) =>
            entries.slice(0, 5).map((e) => ({ title: e.competencyTitle, status: e.status })),
          )
          .catch(() => [] as { title: string; status: string }[]),
      ]);

      return {
        slug: interest.slug,
        name: interest.name,
        accentColor: interest.accent_color,
        iconName: interest.icon_name,
        recentSteps: stepsResult,
        capabilityProgress: progressResult,
      } satisfies OtherInterestSummary;
    }),
  );

  return { otherInterests: results };
}

/**
 * Generate cross-interest suggestions using AI.
 */
export async function generateCrossInterestSuggestions(ctx: {
  currentInterestName: string;
  stepTitle: string;
  currentWhat?: string;
  capabilityGoals: string[];
  crossContext: CrossInterestContextData;
  focusHint?: string;
}): Promise<CrossInterestSuggestion[]> {
  if (ctx.crossContext.otherInterests.length === 0) return [];

  const otherInterestBlock = ctx.crossContext.otherInterests
    .map((oi) => {
      const steps = oi.recentSteps.length
        ? oi.recentSteps.map((s) => `  - "${s.title}"${s.what ? `: ${s.what}` : ''}`).join('\n')
        : '  (no recent steps)';
      const progress = oi.capabilityProgress.length
        ? oi.capabilityProgress.map((c) => `  - ${c.title}: ${c.status}`).join('\n')
        : '  (no capability data)';
      return `${oi.name} (${oi.slug}):\n  Recent steps:\n${steps}\n  Skills:\n${progress}`;
    })
    .join('\n\n');

  const systemPrompt = `You are a creative learning coach on the BetterAt platform. You find meaningful connections between a user's different interests to suggest cross-disciplinary activities.

Given the user's current interest (${ctx.currentInterestName}) and their other interests, suggest 2-3 concrete activities that draw on skills or knowledge from their other interests to enhance their current practice.

Each suggestion should:
- Be a specific, actionable activity (under 60 words)
- Genuinely connect two interests in a useful way
- Include a brief relevance note (under 30 words) explaining why it helps
- Include a suggested_category from: nutrition, strength, cardio, hiit, sport, or general

Respond with ONLY a JSON array, no other text:
[{ "source_interest_slug": "slug", "suggestion": "...", "relevance": "...", "suggested_category": "general" }]`;

  const userMessage = `Current interest: ${ctx.currentInterestName}
Step: "${ctx.stepTitle}"
${ctx.currentWhat ? `Current plan: "${ctx.currentWhat}"` : 'No plan written yet.'}
${ctx.capabilityGoals.length ? `Goals: ${ctx.capabilityGoals.join(', ')}` : ''}
${ctx.focusHint ? `\nUser focus: "${ctx.focusHint}" — tailor suggestions toward this area.` : ''}

Other interests:
${otherInterestBlock}`;

  try {
    let responseText = '';

    // Try dedicated edge function
    try {
      const { data, error } = await supabase.functions.invoke('step-plan-suggest', {
        body: { system: systemPrompt, prompt: userMessage, max_tokens: 2048 },
      });
      if (!error && data?.text) responseText = data.text;
    } catch {
      // Fall through to fallback
    }

    // Fallback
    if (!responseText) {
      const fallbackPrompt = `${systemPrompt}\n\n${userMessage}`;
      const { data, error } = await supabase.functions.invoke('race-coaching-chat', {
        body: { prompt: fallbackPrompt, max_tokens: 512 },
      });
      if (error || !data?.text) return [];
      responseText = data.text;
    }

    // Parse JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as {
      source_interest_slug: string;
      suggestion: string;
      relevance: string;
      suggested_category?: string;
    }[];

    // Enrich with interest metadata
    const interestMap = new Map(
      ctx.crossContext.otherInterests.map((oi) => [oi.slug, oi]),
    );

    return parsed
      .filter((item) => item.source_interest_slug && item.suggestion)
      .map((item) => {
        const interest = interestMap.get(item.source_interest_slug);
        return {
          id: `cis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          sourceInterestSlug: item.source_interest_slug,
          sourceInterestName: interest?.name ?? item.source_interest_slug,
          sourceInterestColor: interest?.accentColor ?? '#888888',
          sourceInterestIcon: interest?.iconName ?? null,
          suggestion: item.suggestion,
          relevance: item.relevance,
          suggestedCategory: item.suggested_category || undefined,
        };
      });
  } catch {
    return [];
  }
}

/**
 * Legacy: basic plan suggestion (kept for backward compat).
 */
export async function generatePlanSuggestion(ctx: PlanContext): Promise<string> {
  const resourceList = ctx.linkedResources
    .map((r) => `- ${r.title}${r.author_or_creator ? ` by ${r.author_or_creator}` : ''} (${r.resource_type})`)
    .join('\n');

  const goalList = ctx.capabilityGoals.length
    ? ctx.capabilityGoals.map((g) => `- ${g}`).join('\n')
    : '(none set)';

  const historyBlock = ctx.previousStepSummaries.length
    ? ctx.previousStepSummaries
        .map(
          (s) =>
            `Step: ${s.title}\n  What they did: ${s.what || '(empty)'}\n  Learned: ${s.learned || '(empty)'}\n  Next ideas: ${s.nextNotes || '(empty)'}`,
        )
        .join('\n\n')
    : '(first step — no history)';

  const prompt = `You are a learning coach helping someone plan their next practice session for ${ctx.interestName}.

Their step is titled "${ctx.stepTitle}".
${ctx.currentWhat ? `They've started writing: "${ctx.currentWhat}"` : ''}

Library resources they can reference:
${resourceList || '(no resources linked)'}

Capability goals:
${goalList}

Recent step history:
${historyBlock}

Based on this context, suggest what they should focus on in this session. Be specific and practical — give 2-3 concrete activities or exercises. Keep it under 150 words. Write in second person ("You could..."). Do not use markdown formatting.`;

  const { data, error } = await supabase.functions.invoke('race-coaching-chat', {
    body: { prompt, max_tokens: 512 },
  });

  if (error) throw error;
  return data?.text || 'Unable to generate suggestion. Try again.';
}

/**
 * Fetch recent completed steps for context (legacy helper).
 */
export async function getRecentStepSummaries(
  userId: string,
  interestId: string,
  limit = 3,
): Promise<PreviousStepSummary[]> {
  const { data, error } = await supabase
    .from('timeline_steps')
    .select('title, metadata')
    .eq('user_id', userId)
    .eq('interest_id', interestId)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row: any) => {
    const plan: StepPlanData = row.metadata?.plan ?? {};
    const review: StepReviewData = row.metadata?.review ?? {};
    return {
      title: row.title,
      what: plan.what_will_you_do ?? '',
      learned: readReviewPrompt(row.metadata, 'what_did_you_learn', review.what_learned),
      nextNotes: readReviewPrompt(row.metadata, 'anything_else', review.next_step_notes),
    };
  });
}

// ---------------------------------------------------------------------------
// Resource-Driven Plan Generation
// ---------------------------------------------------------------------------

export interface ResourcePlanSuggestion {
  what_will_you_do: string;
  how_sub_steps: string[];
  why_reasoning: string;
  capability_goals: string[];
}

/**
 * Generate a full plan (what, how, why, capabilities) from a library resource.
 * Called when user links a resource via "Add from Library".
 */
export async function generatePlanFromResource(params: {
  resource: LibraryResourceRecord;
  interestName: string;
  stepHistory?: StepHistoryEntry[];
  existingSkillGoals?: string[];
}): Promise<ResourcePlanSuggestion> {
  const { resource, interestName, stepHistory = [], existingSkillGoals = [] } = params;

  const resourceInfo = [
    `Title: ${resource.title}`,
    resource.author_or_creator ? `Creator: ${resource.author_or_creator}` : null,
    resource.description ? `Description: ${resource.description}` : null,
    `Type: ${resource.resource_type}`,
    resource.url ? `URL: ${resource.url}` : null,
  ].filter(Boolean).join('\n');

  const historyBlock = stepHistory.length
    ? stepHistory.slice(0, 5).map((s) => {
        let line = `- "${s.title}"`;
        if (s.what) line += `: ${s.what}`;
        if (s.learned) line += ` → Learned: ${s.learned}`;
        return line;
      }).join('\n')
    : '(first session — no prior history)';

  const systemPrompt = `You are an expert learning coach on BetterAt. The user is planning a ${interestName} practice session using a resource from their library.

Generate a structured practice plan based on this resource. Your response must be ONLY valid JSON with this exact shape:

{
  "what_will_you_do": "A 1-2 sentence description of what to focus on during this session",
  "how_sub_steps": ["Step 1...", "Step 2...", "Step 3..."],
  "why_reasoning": "A 1-2 sentence explanation of why this is the right thing to work on next",
  "capability_goals": ["Skill 1", "Skill 2"]
}

Guidelines:
- what_will_you_do: Be specific about the activity, referencing the resource
- how_sub_steps: 3-6 concrete, actionable steps. Include time estimates where helpful. Write in natural domain language ("Assess all assigned patients during report", "Sketch three thumbnails before committing to a composition"). Do NOT use fitness-style sets×reps notation like "3x3 patients" or "1x1 shift" unless the interest is explicitly strength/fitness training.
- why_reasoning: Connect to their learning journey and the specific skills this develops
- capability_goals: 2-4 specific skills this session develops. IMPORTANT: If the user already has skill goals that are relevant to this session, use those EXACT names instead of inventing new ones. Only create new skill names for capabilities not covered by existing goals.

Respond with ONLY the JSON object, no markdown or other text.`;

  const skillsBlock = existingSkillGoals.length
    ? `\nUser's existing skill goals (prefer these names when relevant):\n${existingSkillGoals.map((s) => `- ${s}`).join('\n')}\n`
    : '';

  const userMessage = `Resource:
${resourceInfo}

User's recent ${interestName} history:
${historyBlock}
${skillsBlock}
Generate a practice plan for a session using this resource.`;

  try {
    let responseText = '';

    try {
      const { data, error } = await supabase.functions.invoke('step-plan-suggest', {
        body: { system: systemPrompt, prompt: userMessage, max_tokens: 768 },
      });
      if (!error && data?.text) responseText = data.text;
    } catch {
      // Fall through
    }

    if (!responseText) {
      const fallbackPrompt = `${systemPrompt}\n\n${userMessage}`;
      const { data, error } = await supabase.functions.invoke('race-coaching-chat', {
        body: { prompt: fallbackPrompt, max_tokens: 768 },
      });
      if (error || !data?.text) throw new Error('AI generation failed');
      responseText = data.text;
    }

    // Strip markdown fences if present
    const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]) as ResourcePlanSuggestion;

    return {
      what_will_you_do: parsed.what_will_you_do || '',
      how_sub_steps: Array.isArray(parsed.how_sub_steps) ? parsed.how_sub_steps : [],
      why_reasoning: parsed.why_reasoning || '',
      capability_goals: Array.isArray(parsed.capability_goals) ? parsed.capability_goals : [],
    };
  } catch (err) {
    console.error('generatePlanFromResource failed:', err);
    // Return a basic fallback based on the resource info
    return {
      what_will_you_do: `Study and practice along with "${resource.title}"${resource.author_or_creator ? ` by ${resource.author_or_creator}` : ''}.`,
      how_sub_steps: [
        `Watch/review "${resource.title}"`,
        'Take notes on key techniques and concepts',
        'Practice the main technique or exercise shown',
        'Reflect on what worked and what to revisit',
      ],
      why_reasoning: `This resource covers important ${interestName} fundamentals worth studying.`,
      capability_goals: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Brain Dump → Structured Plan
// ---------------------------------------------------------------------------

export interface BrainDumpPlanResult {
  suggested_title: string;
  what_will_you_do: string;
  how_sub_steps: string[];
  why_reasoning: string;
  who_collaborators: string[];
  capability_goals: string[];
  extracted_entities?: {
    people?: { name: string; context?: string }[];
    equipment?: { text: string; category: string; ownership: string }[];
    locations?: { text: string; context?: string }[];
    dates?: { text: string; iso: string; has_time: boolean }[];
  };
}

function formatUrlsForPrompt(urls: ExtractedUrl[]): string {
  if (!urls.length) return '';
  const lines = urls.map((u) => {
    const label = u.title ? `"${u.title}"` : u.url;
    return `- [${u.platform}] ${label} (${u.url})`;
  });
  return `LINKS PASTED BY USER:\n${lines.join('\n')}`;
}

/**
 * Structure a brain dump into a full plan using AI.
 *
 * Takes the raw text + client-side extractions + enriched user context,
 * sends to the step-plan-suggest edge function, and returns a structured
 * plan that populates StepPlanData fields.
 */
export async function structureBrainDump(params: {
  brainDump: BrainDumpData;
  interestName: string;
  interestId?: string;
  interestSlug?: string;
  userId: string;
  existingSkillGoals?: string[];
}): Promise<BrainDumpPlanResult> {
  const { brainDump, interestName, interestId, interestSlug, userId, existingSkillGoals = [] } = params;

  // Gather enriched context and equipment context in parallel
  let enrichedContext = '';
  let userBoats: SailorBoat[] = [];
  let userEquipment: BoatEquipment[] = [];

  const isSailing = interestSlug?.includes('sail') || interestName.toLowerCase().includes('sail');

  if (interestId || isSailing) {
    const promises: Promise<void>[] = [];

    if (interestId) {
      promises.push(
        gatherEnrichedContext(userId, interestId)
          .then((ctx) => {
            const fakeCtx: EnrichedPlanContext = {
              interestName, interestId, stepTitle: '', linkedResources: [], capabilityGoals: [], ...ctx,
            };
            enrichedContext = buildEnrichedPrompt(fakeCtx);
          })
          .catch(() => {}),
      );
    }

    if (isSailing && userId) {
      promises.push(
        sailorBoatService.listBoatsForSailor(userId)
          .then(async (boats) => {
            userBoats = boats;
            // Get equipment for primary boat
            const primaryBoat = boats.find((b) => b.is_primary) || boats[0];
            if (primaryBoat) {
              try {
                userEquipment = await equipmentService.getEquipmentForBoat(primaryBoat.id);
              } catch {}
            }
          })
          .catch(() => {}),
      );
    }

    await Promise.all(promises);
  }

  const urlBlock = formatUrlsForPrompt(brainDump.extracted_urls);
  const peopleBlock = brainDump.extracted_people.length
    ? `PEOPLE MENTIONED: ${brainDump.extracted_people.join(', ')}`
    : '';
  const topicsBlock = brainDump.extracted_topics.length
    ? `TOPICS DETECTED: ${brainDump.extracted_topics.join(', ')}`
    : '';
  const seedBlock = brainDump.source_review_notes
    ? `NOTES FROM PREVIOUS SESSION:\n${brainDump.source_review_notes}`
    : '';
  const datesBlock = brainDump.extracted_dates?.length
    ? `DATES DETECTED: ${brainDump.extracted_dates.map((d) => `${d.raw} (${d.rough_iso})`).join(', ')}`
    : '';
  const equipmentBlock = brainDump.extracted_equipment?.length
    ? `EQUIPMENT MENTIONED: ${brainDump.extracted_equipment.join(', ')}`
    : '';
  const locationsBlock = brainDump.extracted_locations?.length
    ? `LOCATIONS MENTIONED: ${brainDump.extracted_locations.join(', ')}`
    : '';

  // User equipment context for sailing
  let userEquipmentBlock = '';
  if (isSailing && userBoats.length > 0) {
    const boatLines = userBoats.map((b) =>
      `- ${b.boat_class?.name || 'Unknown class'} "${b.name || 'unnamed'}"${b.sail_number ? ` (sail #${b.sail_number})` : ''}${b.is_primary ? ' [PRIMARY]' : ''}`
    );
    userEquipmentBlock = `USER'S BOATS:\n${boatLines.join('\n')}`;

    if (userEquipment.length > 0) {
      const eqLines = userEquipment
        .slice(0, 20) // limit to avoid token bloat
        .map((e) => `- ${e.custom_name}${e.manufacturer ? ` (${e.manufacturer}${e.model ? ' ' + e.model : ''})` : ''} [${e.category}]`);
      userEquipmentBlock += `\nUSER'S EQUIPMENT:\n${eqLines.join('\n')}`;
    }
  }

  const currentDate = new Date().toISOString().split('T')[0];

  const interestEquipmentHint = (() => {
    if (isSailing) return 'recognize boats, sails, rigging equipment, instruments, and sailing gear';
    switch (interestSlug) {
      case 'knitting': return 'recognize yarn (brands, weights, fibers), needles (circular, DPN, interchangeable), notions (stitch markers, tapestry needles, blocking tools), and knitting accessories';
      case 'fiber-arts': return 'recognize yarn, fiber, needles, hooks, spinning wheels, looms, dye supplies, and fiber arts tools';
      case 'global-health': return 'recognize medical equipment, diagnostic tools, clinical supplies, and field kit items';
      case 'painting-printing': return 'recognize paints, brushes, canvases, easels, printmaking tools, inks, and art supplies';
      case 'drawing': return 'recognize drawing media (pencils, charcoal, ink), paper types, erasers, blending tools, and digital art tools';
      case 'fitness':
      case 'health-and-fitness': return 'recognize gym equipment, weights, bands, machines, and fitness accessories';
      default: return 'recognize any equipment, tools, or gear mentioned';
    }
  })();
  const entityInstructions = `
- For ${interestName}: ${interestEquipmentHint}
- Classify equipment as "mine" (user owns it), "needed" (required for session but not confirmed owned), or "unknown"${isSailing ? '\n- Match boat references to the user\'s known boats when possible' : ''}`;

  const systemPrompt = `You are an expert learning coach on BetterAt. The user has dumped raw, unstructured notes about an upcoming ${interestName} session. Your job is to organize this into a clear, structured practice plan.

Today's date is ${currentDate}. Resolve relative dates (e.g., "next Saturday", "tomorrow") to absolute ISO dates.

Your response must be ONLY valid JSON with this exact shape:

{
  "suggested_title": "Short title for this session (3-8 words)",
  "what_will_you_do": "1-3 sentence summary of the session objective",
  "how_sub_steps": ["Step 1...", "Step 2...", "Step 3..."],
  "why_reasoning": "1-2 sentence explanation of why this is valuable for their development",
  "who_collaborators": ["Name1", "Name2"],
  "capability_goals": ["Skill 1", "Skill 2"],
  "extracted_entities": {
    "people": [{ "name": "Name", "context": "practicing with" }],
    "equipment": [{ "text": "equipment name", "category": "gear|tool|instrument|material|other", "ownership": "mine|needed|unknown" }],
    "locations": [{ "text": "Place Name", "context": "practicing at" }],
    "dates": [{ "text": "next Saturday", "iso": "2026-03-28", "has_time": false }]
  }
}

Guidelines:
- suggested_title: Capture the essence of the session in a short, descriptive title
- what_will_you_do: Synthesize the raw notes into a clear objective — don't just repeat the raw text. Focus on what they'll actually practice/achieve
- how_sub_steps: 3-7 concrete, ordered steps. If URLs/videos were shared, include "Watch/review [title]" steps. Include practice drills, discussion points, or exercises as appropriate. Add time estimates where helpful (e.g., "15 min"). Write in natural domain language for the interest ("Assess all assigned patients during report", "Sketch three thumbnails before committing"). Do NOT use fitness-style sets×reps notation like "3x3 patients" or "1x1 shift" unless the interest is explicitly strength/fitness training.
- why_reasoning: Connect to their learning journey. Reference their step history or capability gaps if available. Explain why this session matters
- who_collaborators: Extract names of people they'll practice with (from the brain dump text)
- capability_goals: 2-5 specific skills this session develops. IMPORTANT: If the user already has skill goals that are relevant, use those EXACT names instead of inventing new ones. Only create new skill names for capabilities not covered by existing goals. Use the detected topics as a starting point but refine them into clear skill names
- extracted_entities: Identify ALL people, equipment, locations, and dates mentioned in the text${entityInstructions}

Respond with ONLY the JSON object, no markdown fences or other text.`;

  const existingSkillsBlock = existingSkillGoals.length
    ? `EXISTING SKILL GOALS (prefer these names when relevant):\n${existingSkillGoals.map((s) => `- ${s}`).join('\n')}`
    : '';

  const userMessage = `RAW BRAIN DUMP:
${brainDump.raw_text}

${urlBlock}
${peopleBlock}
${topicsBlock}
${datesBlock}
${equipmentBlock}
${locationsBlock}
${seedBlock}
${existingSkillsBlock}
${userEquipmentBlock}

${enrichedContext ? `USER CONTEXT:\n${enrichedContext}` : ''}

Organize this into a structured ${interestName} practice plan.`.trim();

  try {
    let responseText = '';

    try {
      const { data, error } = await supabase.functions.invoke('step-plan-suggest', {
        body: { system: systemPrompt, prompt: userMessage, max_tokens: 1024 },
      });
      if (!error && data?.text) responseText = data.text;
    } catch {
      // Fall through to fallback
    }

    if (!responseText) {
      const fallbackPrompt = `${systemPrompt}\n\n${userMessage}`;
      const { data, error } = await supabase.functions.invoke('race-coaching-chat', {
        body: { prompt: fallbackPrompt, max_tokens: 1024 },
      });
      if (error || !data?.text) throw new Error('AI generation failed');
      responseText = data.text;
    }

    // Strip markdown fences if present
    const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]) as BrainDumpPlanResult;

    void AIUsageService.recordUsage('plan_generation');
    return {
      suggested_title: parsed.suggested_title || '',
      what_will_you_do: parsed.what_will_you_do || '',
      how_sub_steps: Array.isArray(parsed.how_sub_steps) ? parsed.how_sub_steps : [],
      why_reasoning: parsed.why_reasoning || '',
      who_collaborators: Array.isArray(parsed.who_collaborators) ? parsed.who_collaborators : brainDump.extracted_people,
      capability_goals: Array.isArray(parsed.capability_goals) ? parsed.capability_goals : brainDump.extracted_topics,
      extracted_entities: parsed.extracted_entities,
    };
  } catch (err) {
    console.error('structureBrainDump failed:', err);
    // Return a client-side fallback using the extracted data
    return buildFallbackPlan(brainDump, interestName);
  }
}

/** Fallback when AI is unavailable — uses client-side extractions */
function buildFallbackPlan(dump: BrainDumpData, interestName: string): BrainDumpPlanResult {
  const urlSteps = dump.extracted_urls.map((u) => {
    const label = u.title ?? u.url;
    const prefix = u.platform === 'youtube' ? 'Watch' :
      u.platform === 'pdf' ? 'Review' :
      u.platform === 'article' ? 'Read' : 'Check out';
    return `${prefix}: ${label}`;
  });

  return {
    suggested_title: dump.extracted_topics.length
      ? `${dump.extracted_topics[0]} practice`
      : `${interestName} session`,
    what_will_you_do: dump.raw_text,
    how_sub_steps: urlSteps.length > 0 ? urlSteps : ['Practice the techniques discussed', 'Debrief with the group'],
    why_reasoning: '',
    who_collaborators: dump.extracted_people,
    capability_goals: dump.extracted_topics,
  };
}
