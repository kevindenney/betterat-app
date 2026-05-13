/**
 * Competency Service
 *
 * Supabase data-access layer for the competency tracking system.
 *
 * Tables:
 *   betterat_competencies          - competency definitions
 *   betterat_competency_progress   - per-user progress rows
 *   betterat_competency_attempts   - individual attempt logs
 *   betterat_competency_reviews    - faculty review decisions
 *
 * Status progression:
 *   not_started -> learning -> practicing -> checkoff_ready -> validated -> competent
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { isAbortError } from '@/lib/utils/fetchWithTimeout';
import { isMissingSupabaseColumn } from '@/lib/utils/supabaseSchemaFallback';
import { NURSING_CORE_V1_CAPABILITIES } from '@/configs/competencies/nursing-core-v1';
import type {
  Competency,
  CompetencyProgress,
  CompetencyAttempt,
  CompetencyWithProgress,
  CompetencyDetail,
  CompetencyDashboardSummary,
  CompetencyStatus,
  AttemptWithCompetency,
  LogAttemptPayload,
  PreceptorValidationPayload,
  FacultyReviewPayload,
  CreateCompetencyPayload,
  UpdateCompetencyPayload,
  CreateSubCompetencyPayload,
  UpdateSubCompetencyPayload,
} from '@/types/competency';
import type { SubCompetency } from '@/types/sub-competency';

const logger = createLogger('competencyService');
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NURSING_CAPABILITY_BY_ID = new Map(NURSING_CORE_V1_CAPABILITIES.map((item) => [item.id,item]));

// ---------------------------------------------------------------------------
// 1. Get all competency definitions for an interest
// ---------------------------------------------------------------------------

export async function getCompetencies(interestId: string): Promise<Competency[]> {
  try {
    logger.debug('Fetching competencies for interest', interestId);

    const { data, error } = await supabase
      .from('betterat_competencies')
      .select('*')
      .eq('interest_id', interestId)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    // Deduplicate: when an org-specific version exists, hide the template version
    const all = (data ?? []) as Competency[];
    const orgTitles = new Set(
      all.filter((c) => c.organization_id).map((c) => c.title.toLowerCase())
    );
    return all.filter(
      (c) => c.organization_id || !orgTitles.has(c.title.toLowerCase())
    );
  } catch (err) {
    if (!isAbortError(err)) logger.error('Failed to fetch competencies', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 2. Get user's progress on all competencies for an interest
// ---------------------------------------------------------------------------

export async function getUserCompetencyProgress(
  userId: string,
  interestId: string,
): Promise<CompetencyWithProgress[]> {
  try {
    logger.debug('Fetching competency progress', { userId, interestId });

    // Fetch all competencies for the interest
    const { data: competencies, error: compError } = await supabase
      .from('betterat_competencies')
      .select('*')
      .eq('interest_id', interestId)
      .order('sort_order', { ascending: true });

    if (compError) throw compError;

    if (!competencies || competencies.length === 0) {
      return [];
    }

    // Fetch all progress rows for this user in one query
    const competencyIds = competencies.map((c: Competency) => c.id);

    const { data: progressRows, error: progError } = await supabase
      .from('betterat_competency_progress')
      .select('*')
      .eq('user_id', userId)
      .in('competency_id', competencyIds);

    if (progError) throw progError;

    // Build a lookup map: competency_id -> progress
    const progressMap = new Map<string, CompetencyProgress>();
    for (const row of (progressRows ?? []) as CompetencyProgress[]) {
      progressMap.set(row.competency_id, row);
    }

    // Merge: every competency gets its progress (or null if not started)
    return competencies.map((comp: Competency) => ({
      ...comp,
      progress: progressMap.get(comp.id) ?? null,
    }));
  } catch (err) {
    logger.error('Failed to fetch user competency progress', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 3. Get detailed view for a single competency
// ---------------------------------------------------------------------------

export async function getCompetencyDetail(
  userId: string,
  competencyId: string,
): Promise<CompetencyDetail> {
  try {
    logger.debug('Fetching competency detail', { userId, competencyId });

    // Fire all four queries in parallel
    const [compResult, progressResult, attemptsResult, reviewsResult] = await Promise.all([
      supabase
        .from('betterat_competencies')
        .select('*')
        .eq('id', competencyId)
        .single(),

      supabase
        .from('betterat_competency_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('competency_id', competencyId)
        .maybeSingle(),

      supabase
        .from('betterat_competency_attempts')
        .select('*')
        .eq('user_id', userId)
        .eq('competency_id', competencyId)
        .order('created_at', { ascending: false }),

      // Reviews are linked through progress rows, so we first need the
      // progress id. We fetch all reviews for this user+competency by joining
      // through progress. Because progress may not exist yet we handle that
      // after we have the progress result.
      supabase
        .from('betterat_competency_progress')
        .select('id')
        .eq('user_id', userId)
        .eq('competency_id', competencyId)
        .maybeSingle(),
    ]);

    if (compResult.error) throw compResult.error;
    if (progressResult.error) throw progressResult.error;
    if (attemptsResult.error) throw attemptsResult.error;
    if (reviewsResult.error) throw reviewsResult.error;

    // Fetch reviews if a progress row exists
    let reviews: CompetencyDetail['reviews'] = [];
    const progressId = reviewsResult.data?.id;
    if (progressId) {
      const { data: reviewData, error: revError } = await supabase
        .from('betterat_competency_reviews')
        .select('*')
        .eq('progress_id', progressId)
        .order('created_at', { ascending: false });

      if (revError) throw revError;
      reviews = (reviewData ?? []) as CompetencyDetail['reviews'];
    }

    return {
      competency: compResult.data as Competency,
      progress: (progressResult.data as CompetencyProgress) ?? null,
      attempts: (attemptsResult.data ?? []) as CompetencyAttempt[],
      reviews,
    };
  } catch (err) {
    logger.error('Failed to fetch competency detail', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 4. Log a new attempt (student self-assessment)
// ---------------------------------------------------------------------------

export async function logAttempt(
  userId: string,
  payload: LogAttemptPayload,
): Promise<CompetencyAttempt> {
  try {
    logger.debug('Logging attempt', { userId, competencyId: payload.competency_id });

    // Ensure a progress row exists (upsert)
    const { data: existingProgress, error: fetchError } = await supabase
      .from('betterat_competency_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('competency_id', payload.competency_id)
      .maybeSingle();

    if (fetchError) throw fetchError;

    let progress: CompetencyProgress;

    if (!existingProgress) {
      // Create initial progress row
      const { data: newProgress, error: createError } = await supabase
        .from('betterat_competency_progress')
        .insert({
          user_id: userId,
          competency_id: payload.competency_id,
          status: 'learning' as CompetencyStatus,
          attempts_count: 0,
          last_attempt_at: null,
          notes: null,
        })
        .select('*')
        .single();

      if (createError) throw createError;
      progress = newProgress as CompetencyProgress;
    } else {
      progress = existingProgress as CompetencyProgress;
    }

    // Determine the next attempt number
    const nextAttemptNumber = progress.attempts_count + 1;

    // Insert the attempt
    const { data: attempt, error: attemptError } = await supabase
      .from('betterat_competency_attempts')
      .insert({
        user_id: userId,
        competency_id: payload.competency_id,
        event_id: payload.event_id ?? null,
        attempt_number: nextAttemptNumber,
        self_rating: payload.self_rating,
        self_notes: payload.self_notes ?? null,
        preceptor_id: payload.preceptor_id ?? null,
        clinical_context: payload.clinical_context ?? null,
      })
      .select('*')
      .single();

    if (attemptError) throw attemptError;

    // Compute the new status
    let newStatus: CompetencyStatus = progress.status;

    if (progress.status === 'not_started') {
      // First attempt moves from not_started to learning
      newStatus = 'learning';
    }

    if (
      progress.status === 'learning' &&
      (payload.self_rating === 'proficient' || payload.self_rating === 'confident') &&
      nextAttemptNumber >= 3
    ) {
      // After 3+ attempts with proficient/confident self-rating, move to practicing
      newStatus = 'practicing';
    }

    // Update progress row
    const { error: updateError } = await supabase
      .from('betterat_competency_progress')
      .update({
        attempts_count: nextAttemptNumber,
        last_attempt_at: new Date().toISOString(),
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', progress.id);

    if (updateError) throw updateError;

    return attempt as CompetencyAttempt;
  } catch (err) {
    logger.error('Failed to log attempt', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 5. Submit preceptor validation
// ---------------------------------------------------------------------------

export async function submitPreceptorValidation(
  preceptorId: string,
  payload: PreceptorValidationPayload,
): Promise<void> {
  try {
    logger.debug('Submitting preceptor validation', {
      preceptorId,
      attemptId: payload.attempt_id,
    });

    // Update the attempt with preceptor feedback
    const { data: attempt, error: attemptError } = await supabase
      .from('betterat_competency_attempts')
      .update({
        preceptor_rating: payload.preceptor_rating,
        preceptor_notes: payload.preceptor_notes ?? null,
        preceptor_reviewed_at: new Date().toISOString(),
      })
      .eq('id', payload.attempt_id)
      .select('*')
      .single();

    if (attemptError) throw attemptError;

    const typedAttempt = attempt as CompetencyAttempt;

    // If the preceptor rating is satisfactory or excellent, consider
    // advancing the progress status to checkoff_ready
    if (
      payload.preceptor_rating === 'satisfactory' ||
      payload.preceptor_rating === 'excellent'
    ) {
      const { data: progress, error: progError } = await supabase
        .from('betterat_competency_progress')
        .select('*')
        .eq('user_id', typedAttempt.user_id)
        .eq('competency_id', typedAttempt.competency_id)
        .maybeSingle();

      if (progError) throw progError;

      if (
        progress &&
        progress.status !== 'validated' &&
        progress.status !== 'competent' &&
        progress.status !== 'checkoff_ready'
      ) {
        const { error: updateError } = await supabase
          .from('betterat_competency_progress')
          .update({
            status: 'checkoff_ready' as CompetencyStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', progress.id);

        if (updateError) throw updateError;
      }
    }
  } catch (err) {
    logger.error('Failed to submit preceptor validation', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 6. Validate competency (preceptor marks as validated)
// ---------------------------------------------------------------------------

export async function validateCompetency(
  preceptorId: string,
  progressId: string,
): Promise<void> {
  try {
    logger.debug('Validating competency', { preceptorId, progressId });

    const { error } = await supabase
      .from('betterat_competency_progress')
      .update({
        status: 'validated' as CompetencyStatus,
        validated_by: preceptorId,
        validated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', progressId);

    if (error) throw error;
  } catch (err) {
    logger.error('Failed to validate competency', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 7. Submit faculty review
// ---------------------------------------------------------------------------

export async function submitFacultyReview(
  reviewerId: string,
  payload: FacultyReviewPayload,
): Promise<void> {
  try {
    logger.debug('Submitting faculty review', {
      reviewerId,
      progressId: payload.progress_id,
      decision: payload.decision,
    });

    // Insert the review record
    const { error: reviewError } = await supabase
      .from('betterat_competency_reviews')
      .insert({
        progress_id: payload.progress_id,
        reviewer_id: reviewerId,
        decision: payload.decision,
        notes: payload.notes ?? null,
      });

    if (reviewError) throw reviewError;

    // Update progress based on decision
    if (payload.decision === 'approved') {
      const { error: updateError } = await supabase
        .from('betterat_competency_progress')
        .update({
          status: 'competent' as CompetencyStatus,
          approved_by: reviewerId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.progress_id);

      if (updateError) throw updateError;
    } else if (payload.decision === 'needs_more_practice') {
      const { error: updateError } = await supabase
        .from('betterat_competency_progress')
        .update({
          status: 'practicing' as CompetencyStatus,
          // Clear validation since faculty sent it back
          validated_by: null,
          validated_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.progress_id);

      if (updateError) throw updateError;
    } else if (payload.decision === 'remediation_required') {
      const { data: existing, error: fetchError } = await supabase
        .from('betterat_competency_progress')
        .select('notes')
        .eq('id', payload.progress_id)
        .single();

      if (fetchError) throw fetchError;

      const existingNotes = (existing as { notes: string | null }).notes;
      const remediationNote = `[Remediation required - ${new Date().toISOString()}] ${payload.notes ?? 'See faculty review.'}`;
      const combinedNotes = existingNotes
        ? `${existingNotes}\n${remediationNote}`
        : remediationNote;

      const { error: updateError } = await supabase
        .from('betterat_competency_progress')
        .update({
          status: 'learning' as CompetencyStatus,
          // Clear validation since faculty sent it back
          validated_by: null,
          validated_at: null,
          notes: combinedNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.progress_id);

      if (updateError) throw updateError;
    }
  } catch (err) {
    logger.error('Failed to submit faculty review', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 7b. Record AI-assessed competency progress from step review
// ---------------------------------------------------------------------------

/**
 * Map AI demonstrated_level to competency status.
 * AI assessment can advance status but never regress it or bypass faculty approval.
 */
const AI_LEVEL_TO_STATUS: Record<string, CompetencyStatus> = {
  initial_exposure: 'learning',
  developing: 'practicing',
  proficient: 'checkoff_ready',
};

/**
 * Status rank for comparing progress — higher = more advanced.
 */
const STATUS_RANK: Record<CompetencyStatus, number> = {
  not_started: 0,
  learning: 1,
  practicing: 2,
  checkoff_ready: 3,
  validated: 4,
  competent: 5,
};

/**
 * Write AI competency assessment results back to betterat_competency_progress.
 * Only advances status forward (never regresses). Skips competencies without IDs.
 */
export async function recordAIAssessedProgress(
  userId: string,
  results: { competency_id?: string; demonstrated_level: string }[],
  stepId: string,
): Promise<number> {
  let updated = 0;
  for (const result of results) {
    if (!result.competency_id) continue;
    const targetStatus = AI_LEVEL_TO_STATUS[result.demonstrated_level];
    if (!targetStatus) continue; // not_demonstrated → skip

    try {
      // Fetch existing progress
      const { data: existing } = await supabase
        .from('betterat_competency_progress')
        .select('id, status, attempts_count')
        .eq('user_id', userId)
        .eq('competency_id', result.competency_id)
        .maybeSingle();

      const now = new Date().toISOString();

      if (!existing) {
        // Create new progress row
        const { error } = await supabase
          .from('betterat_competency_progress')
          .insert({
            user_id: userId,
            competency_id: result.competency_id,
            status: targetStatus,
            attempts_count: 1,
            last_attempt_at: now,
            notes: `AI-assessed from step ${stepId}`,
          });
        if (!error) updated++;
      } else {
        // Only advance status, never regress
        const currentRank = STATUS_RANK[existing.status as CompetencyStatus] ?? 0;
        const targetRank = STATUS_RANK[targetStatus] ?? 0;
        const newStatus = targetRank > currentRank ? targetStatus : existing.status;

        const { error } = await supabase
          .from('betterat_competency_progress')
          .update({
            status: newStatus,
            attempts_count: (existing.attempts_count ?? 0) + 1,
            last_attempt_at: now,
            updated_at: now,
          })
          .eq('id', existing.id);
        if (!error) updated++;
      }
    } catch (err) {
      logger.warn('Failed to record AI progress for competency', { competencyId: result.competency_id, err });
    }
  }
  logger.info(`Recorded AI-assessed progress for ${updated}/${results.length} competencies (step ${stepId})`);
  return updated;
}

// ---------------------------------------------------------------------------
// 8. Get dashboard summary
// ---------------------------------------------------------------------------

export async function getCompetencyDashboardSummary(
  userId: string,
  interestId: string,
): Promise<CompetencyDashboardSummary> {
  try {
    logger.debug('Fetching dashboard summary', { userId, interestId });

    // Re-use the joined query to get competencies with progress
    const competenciesWithProgress = await getUserCompetencyProgress(userId, interestId);

    const total = competenciesWithProgress.length;

    // Count by status
    const byStatus: Record<CompetencyStatus, number> = {
      not_started: 0,
      learning: 0,
      practicing: 0,
      checkoff_ready: 0,
      validated: 0,
      competent: 0,
    };

    // Group by category
    const byCategory: CompetencyDashboardSummary['byCategory'] = {};

    for (const item of competenciesWithProgress) {
      const status: CompetencyStatus = item.progress?.status ?? 'not_started';
      byStatus[status]++;

      if (!byCategory[item.category]) {
        byCategory[item.category] = { total: 0, completed: 0, items: [] };
      }

      byCategory[item.category].total++;
      if (status === 'validated' || status === 'competent') {
        byCategory[item.category].completed++;
      }
      byCategory[item.category].items.push(item);
    }

    // Overall percent: count of validated + competent out of total
    const completedCount = byStatus.validated + byStatus.competent;
    const overallPercent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

    return {
      total,
      byStatus,
      byCategory,
      overallPercent,
    };
  } catch (err) {
    logger.error('Failed to fetch dashboard summary', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 9. Get pending validations for a preceptor
// ---------------------------------------------------------------------------

export async function getPendingValidations(
  preceptorId: string,
): Promise<AttemptWithCompetency[]> {
  try {
    logger.debug('Fetching pending validations', { preceptorId });

    const { data, error } = await supabase
      .from('betterat_competency_attempts')
      .select(
        `
        *,
        competency:betterat_competencies!competency_id (
          title,
          competency_number,
          category
        )
      `,
      )
      .eq('preceptor_id', preceptorId)
      .is('preceptor_rating', null)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Shape the joined data into AttemptWithCompetency
    return ((data ?? []) as any[]).map((row) => {
      const { competency, ...attempt } = row;
      return {
        ...attempt,
        competency: competency as AttemptWithCompetency['competency'],
      } as AttemptWithCompetency;
    });
  } catch (err) {
    logger.error('Failed to fetch pending validations', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 10. Get pending faculty reviews
// ---------------------------------------------------------------------------

export async function getPendingFacultyReviews(
  interestId: string,
): Promise<(CompetencyProgress & { competency: Competency; user_name?: string })[]> {
  try {
    logger.debug('Fetching pending faculty reviews', { interestId });

    // Get all competency IDs for this interest first
    const { data: competencies, error: compError } = await supabase
      .from('betterat_competencies')
      .select('id')
      .eq('interest_id', interestId);

    if (compError) throw compError;

    if (!competencies || competencies.length === 0) {
      return [];
    }

    const competencyIds = competencies.map((c: { id: string }) => c.id);

    // Fetch progress rows that are checkoff_ready, joined with competency data
    const { data, error } = await supabase
      .from('betterat_competency_progress')
      .select(
        `
        *,
        competency:betterat_competencies!competency_id (*)
      `,
      )
      .eq('status', 'checkoff_ready')
      .in('competency_id', competencyIds)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Try to enrich with user names from the users table
    const rows = (data ?? []) as any[];
    const userIds = [...new Set(rows.map((r) => r.user_id))];

    let userMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', userIds);

      if (!userError && users) {
        for (const u of users as { id: string; full_name: string }[]) {
          userMap.set(u.id, u.full_name);
        }
      }
    }

    return rows.map((row) => {
      const { competency, ...progress } = row;
      return {
        ...progress,
        competency: competency as Competency,
        user_name: userMap.get(row.user_id) ?? undefined,
      } as CompetencyProgress & { competency: Competency; user_name?: string };
    });
  } catch (err) {
    logger.error('Failed to fetch pending faculty reviews', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Sub-competencies & program-competency mapping
// ---------------------------------------------------------------------------

export async function getSubCompetencies(
  competencyId: string,
): Promise<{ id: string; competency_id: string; title: string; description: string | null; sort_order: number; created_at: string }[]> {
  try {
    const { data, error } = await supabase
      .from('betterat_sub_competencies')
      .select('*')
      .eq('competency_id', competencyId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data ?? []) as any[];
  } catch (err) {
    logger.error('Failed to fetch sub-competencies', err);
    throw err;
  }
}

export async function getProgramCompetencies(
  programId: string,
): Promise<{ id: string; program_id: string; competency_id: string; is_required: boolean; sort_order: number }[]> {
  try {
    const { data, error } = await supabase
      .from('program_competencies')
      .select('*')
      .eq('program_id', programId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data ?? []) as any[];
  } catch (err) {
    logger.error('Failed to fetch program competencies', err);
    throw err;
  }
}

export async function getProgramCompetenciesWithDetails(
  programId: string,
): Promise<(Competency & { is_required: boolean })[]> {
  try {
    const mappings = await getProgramCompetencies(programId);
    if (mappings.length === 0) return [];

    const competencyIds = mappings.map((m) => m.competency_id);
    const { data, error } = await supabase
      .from('betterat_competencies')
      .select('*')
      .in('id', competencyIds)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    const requiredMap = new Map(mappings.map((m) => [m.competency_id, m.is_required]));
    return ((data ?? []) as Competency[]).map((c) => ({
      ...c,
      is_required: requiredMap.get(c.id) ?? true,
    }));
  } catch (err) {
    logger.error('Failed to fetch program competencies with details', err);
    throw err;
  }
}

export async function getProgramSubCompetencies(
  programId: string,
): Promise<{ id: string; program_id: string; sub_competency_id: string; is_required: boolean; sort_order: number }[]> {
  try {
    const { data, error } = await supabase
      .from('program_sub_competencies')
      .select('*')
      .eq('program_id', programId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data ?? []) as any[];
  } catch (err) {
    logger.error('Failed to fetch program sub-competencies', err);
    throw err;
  }
}

export async function getProgramCapabilityCount(
  programId: string,
): Promise<{ competencies: number; subCompetencies: number }> {
  try {
    const [compResult, subResult] = await Promise.all([
      supabase.from('program_competencies').select('id', { count: 'exact', head: true }).eq('program_id', programId),
      supabase.from('program_sub_competencies').select('id', { count: 'exact', head: true }).eq('program_id', programId),
    ]);
    return {
      competencies: compResult.count ?? 0,
      subCompetencies: subResult.count ?? 0,
    };
  } catch (err) {
    logger.error('Failed to get program capability count', err);
    return { competencies: 0, subCompetencies: 0 };
  }
}

export async function logUnvalidatedArtifactAttempts(input: {
  userId: string;
  candidateCompetencyIds: string[];
  artifactId?: string | null;
  eventType?: string | null;
  eventId?: string | null;
}): Promise<string[]> {
  const candidateIds = input.candidateCompetencyIds.filter((id) => typeof id === 'string' && id.trim().length > 0);
  if (candidateIds.length === 0) return [];

  const resolvedCompetencyIds = await resolveNursingCompetencyIds(candidateIds);
  if (resolvedCompetencyIds.length === 0) {
    logger.warn('[logUnvalidatedArtifactAttempts] No competency ids resolved for insertion', { candidateIds });
    return [];
  }

  const nextAttemptByCompetency = await getNextAttemptNumbers(input.userId, resolvedCompetencyIds);
  const inserted: string[] = [];

  for (const competencyId of resolvedCompetencyIds) {
    const row: Record<string, any> = {
      user_id: input.userId,
      competency_id: competencyId,
      attempt_number: nextAttemptByCompetency.get(competencyId) || 1,
      self_notes: null,
      clinical_context: 'clinical_reasoning_feedback',
      status: 'unvalidated',
      artifact_id: input.artifactId || null,
      event_type: input.eventType || null,
      event_id: input.eventId || null,
    };

    const created = await insertAttemptWithFallback(row);
    if (created) {
      inserted.push(competencyId);
    }
  }

  return inserted;
}

// ---------------------------------------------------------------------------
// Org-Scoped Competency CRUD
// ---------------------------------------------------------------------------

export async function getOrgCompetencies(
  interestId: string,
  orgId: string,
): Promise<Competency[]> {
  try {
    logger.debug('Fetching org + template competencies', { interestId, orgId });

    const { data, error } = await supabase
      .from('betterat_competencies')
      .select('*')
      .eq('interest_id', interestId)
      .or(`organization_id.is.null,organization_id.eq.${orgId}`)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return (data ?? []) as Competency[];
  } catch (err) {
    logger.error('Failed to fetch org competencies', err);
    throw err;
  }
}

export async function createCompetency(payload: CreateCompetencyPayload): Promise<Competency> {
  try {
    logger.debug('Creating org-scoped competency', payload);

    const { data, error } = await supabase
      .from('betterat_competencies')
      .insert({
        interest_id: payload.interest_id,
        organization_id: payload.organization_id,
        category: payload.category,
        competency_number: payload.competency_number,
        title: payload.title,
        description: payload.description ?? null,
        requires_supervision: payload.requires_supervision ?? false,
        sort_order: payload.sort_order ?? 0,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as Competency;
  } catch (err) {
    logger.error('Failed to create competency', err);
    throw err;
  }
}

export async function updateCompetency(
  id: string,
  payload: UpdateCompetencyPayload,
): Promise<Competency> {
  try {
    logger.debug('Updating competency', { id, payload });

    const { data, error } = await supabase
      .from('betterat_competencies')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as Competency;
  } catch (err) {
    logger.error('Failed to update competency', err);
    throw err;
  }
}

export async function deleteCompetency(id: string): Promise<void> {
  try {
    logger.debug('Deleting competency', { id });

    const { error } = await supabase
      .from('betterat_competencies')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (err) {
    logger.error('Failed to delete competency', err);
    throw err;
  }
}

export async function createSubCompetency(payload: CreateSubCompetencyPayload): Promise<SubCompetency> {
  try {
    logger.debug('Creating sub-competency', payload);

    const { data, error } = await supabase
      .from('betterat_sub_competencies')
      .insert({
        competency_id: payload.competency_id,
        organization_id: payload.organization_id,
        title: payload.title,
        description: payload.description ?? null,
        sort_order: payload.sort_order ?? 0,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as SubCompetency;
  } catch (err) {
    logger.error('Failed to create sub-competency', err);
    throw err;
  }
}

export async function updateSubCompetency(
  id: string,
  payload: UpdateSubCompetencyPayload,
): Promise<SubCompetency> {
  try {
    logger.debug('Updating sub-competency', { id, payload });

    const { data, error } = await supabase
      .from('betterat_sub_competencies')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as SubCompetency;
  } catch (err) {
    logger.error('Failed to update sub-competency', err);
    throw err;
  }
}

export async function deleteSubCompetency(id: string): Promise<void> {
  try {
    logger.debug('Deleting sub-competency', { id });

    const { error } = await supabase
      .from('betterat_sub_competencies')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (err) {
    logger.error('Failed to delete sub-competency', err);
    throw err;
  }
}

export async function reorderCompetencies(ids: string[]): Promise<void> {
  try {
    logger.debug('Reordering competencies', { count: ids.length });

    // Update sort_order for each competency in sequence
    for (let i = 0; i < ids.length; i++) {
      const { error } = await supabase
        .from('betterat_competencies')
        .update({ sort_order: i })
        .eq('id', ids[i]);

      if (error) throw error;
    }
  } catch (err) {
    logger.error('Failed to reorder competencies', err);
    throw err;
  }
}

export async function adoptTemplateCompetency(
  templateId: string,
  orgId: string,
): Promise<Competency> {
  try {
    logger.debug('Adopting template competency', { templateId, orgId });

    // Fetch the template
    const { data: template, error: fetchError } = await supabase
      .from('betterat_competencies')
      .select('*')
      .eq('id', templateId)
      .is('organization_id', null)
      .single();

    if (fetchError) throw fetchError;

    const t = template as Competency;

    // Find the next competency_number for this org
    const { data: existing } = await supabase
      .from('betterat_competencies')
      .select('competency_number')
      .eq('interest_id', t.interest_id)
      .eq('organization_id', orgId)
      .order('competency_number', { ascending: false })
      .limit(1);

    const nextNumber = existing && existing.length > 0
      ? (existing[0] as any).competency_number + 1
      : t.competency_number;

    // Clone into org scope
    const { data: cloned, error: insertError } = await supabase
      .from('betterat_competencies')
      .insert({
        interest_id: t.interest_id,
        organization_id: orgId,
        category: t.category,
        competency_number: nextNumber,
        title: t.title,
        description: t.description,
        requires_supervision: t.requires_supervision,
        sort_order: t.sort_order,
      })
      .select('*')
      .single();

    if (insertError) throw insertError;

    // Clone sub-competencies too
    const { data: subComps } = await supabase
      .from('betterat_sub_competencies')
      .select('*')
      .eq('competency_id', templateId);

    if (subComps && subComps.length > 0) {
      const clonedComp = cloned as Competency;
      const subInserts = (subComps as SubCompetency[]).map((sc) => ({
        competency_id: clonedComp.id,
        organization_id: orgId,
        title: sc.title,
        description: sc.description,
        sort_order: sc.sort_order,
      }));

      await supabase.from('betterat_sub_competencies').insert(subInserts);
    }

    return cloned as Competency;
  } catch (err) {
    logger.error('Failed to adopt template competency', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers (below)
// ---------------------------------------------------------------------------

async function getNextAttemptNumbers(userId: string, competencyIds: string[]): Promise<Map<string, number>> {
  const fallback = new Map(competencyIds.map((id) => [id,1]));
  const { data, error } = await supabase
    .from('betterat_competency_attempts')
    .select('competency_id,attempt_number')
    .eq('user_id', userId)
    .in('competency_id', competencyIds)
    .order('attempt_number', { ascending: false });

  if (error) {
    logger.warn('[getNextAttemptNumbers] Falling back to first attempt numbers', { error });
    return fallback;
  }

  const nextByComp = new Map<string, number>();
  for (const competencyId of competencyIds) {
    nextByComp.set(competencyId, 1);
  }
  for (const row of (data || []) as {competency_id: string; attempt_number: number}[]) {
    if (!nextByComp.has(row.competency_id)) continue;
    const current = nextByComp.get(row.competency_id) || 1;
    const candidateNext = (row.attempt_number || 0) + 1;
    if (candidateNext > current) {
      nextByComp.set(row.competency_id, candidateNext);
    }
  }
  return nextByComp;
}

async function resolveNursingCompetencyIds(candidateIds: string[]): Promise<string[]> {
  const directUuidIds = candidateIds.filter((id) => UUID_PATTERN.test(id));
  const slugIds = candidateIds.filter((id) => !UUID_PATTERN.test(id));
  if (slugIds.length === 0) return [...new Set(directUuidIds)];

  const targetTitles = slugIds
    .map((id) => NURSING_CAPABILITY_BY_ID.get(id)?.title)
    .filter((title): title is string => Boolean(title));
  if (targetTitles.length === 0) return [...new Set(directUuidIds)];

  const { data: interestRow } = await supabase
    .from('interests')
    .select('id')
    .eq('slug', 'nursing')
    .maybeSingle();
  const nursingInterestId = (interestRow as {id?: string} | null)?.id;
  if (!nursingInterestId) return [...new Set(directUuidIds)];

  const { data, error } = await supabase
    .from('betterat_competencies')
    .select('id,title')
    .eq('interest_id', nursingInterestId)
    .in('title', targetTitles);

  if (error) {
    logger.warn('[resolveNursingCompetencyIds] Failed title->id mapping', { error });
    return [...new Set(directUuidIds)];
  }

  const byTitle = new Map<string, string>();
  for (const row of (data || []) as {id: string; title: string}[]) {
    byTitle.set(row.title, row.id);
  }

  const mapped = slugIds
    .map((id) => NURSING_CAPABILITY_BY_ID.get(id)?.title)
    .map((title) => (title ? byTitle.get(title) : undefined))
    .filter((id): id is string => Boolean(id));

  return [...new Set([...directUuidIds, ...mapped])];
}

async function insertAttemptWithFallback(initialRow: Record<string, any>): Promise<boolean> {
  let row = { ...initialRow };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { error } = await supabase
      .from('betterat_competency_attempts')
      .insert(row);

    if (!error) return true;
    if (!isMissingSupabaseColumn(error)) {
      logger.warn('[insertAttemptWithFallback] Insert failed', { error, row });
      return false;
    }

    const message = String(error.message || '');
    const nextRow = { ...row };
    let dropped = false;
    for (const key of ['artifact_id', 'event_type', 'event_id', 'status']) {
      if (message.includes(`betterat_competency_attempts.${key}`) && key in nextRow) {
        delete nextRow[key];
        dropped = true;
      }
    }
    if (!dropped) {
      logger.warn('[insertAttemptWithFallback] Missing column fallback failed to match', { error, row });
      return false;
    }
    row = nextRow;
  }

  return false;
}
