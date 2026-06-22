/**
 * SkillGoalService — CRUD for user-defined skill goals.
 *
 * User-owned capability tracking for self-directed learners.
 * Parallel to org-scoped competencyService but simpler — no sign-off chain.
 */

import { supabase } from './supabase';
import type { UserSkillGoal, CreateSkillGoalInput, SkillGoalSourceType } from '@/types/skill-goal';

const TABLE = 'user_skill_goals';

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Get all active skill goals for a user + interest */
export async function getSkillGoals(
  userId: string,
  interestId: string,
): Promise<UserSkillGoal[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', userId)
    .eq('interest_id', interestId)
    .eq('status', 'active')
    .order('category', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Get a single skill goal by ID */
export async function getSkillGoal(id: string): Promise<UserSkillGoal | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Get skill goal titles for autocomplete (just titles, fast) */
export async function getSkillGoalTitles(
  userId: string,
  interestId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('title')
    .eq('user_id', userId)
    .eq('interest_id', interestId)
    .eq('status', 'active')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => r.title);
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/** Create a new skill goal */
export async function createSkillGoal(
  userId: string,
  interestId: string,
  input: CreateSkillGoalInput,
): Promise<UserSkillGoal> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      interest_id: interestId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category?.trim() || null,
      source_type: input.source_type ?? 'manual',
      source_resource_id: input.source_resource_id ?? null,
      source_url: input.source_url ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Batch-create skill goals (e.g., from AI extraction). Skips duplicates. */
export async function createSkillGoalsBatch(
  userId: string,
  interestId: string,
  inputs: CreateSkillGoalInput[],
): Promise<UserSkillGoal[]> {
  if (!inputs.length) return [];

  // Get existing titles to skip duplicates
  const existing = new Set(await getSkillGoalTitles(userId, interestId));

  const toInsert = inputs
    .filter((i) => !existing.has(i.title.trim()))
    .map((input, idx) => ({
      user_id: userId,
      interest_id: interestId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category?.trim() || null,
      source_type: input.source_type ?? 'manual',
      source_resource_id: input.source_resource_id ?? null,
      source_url: input.source_url ?? null,
      sort_order: idx,
    }));

  if (!toInsert.length) return [];

  // Use upsert with ignoreDuplicates to gracefully handle concurrent calls
  // that race to insert the same (user_id, interest_id, title) row.
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(toInsert, { onConflict: 'user_id,interest_id,title', ignoreDuplicates: true })
    .select();

  if (error) throw error;
  return data ?? [];
}

/**
 * Ensure skill goals exist for a list of titles.
 * Creates any that don't exist yet. Used when step review rates goals
 * that haven't been formally created as skill goals.
 */
export async function ensureSkillGoals(
  userId: string,
  interestId: string,
  titles: string[],
): Promise<void> {
  if (!titles.length) return;
  const existing = new Set(await getSkillGoalTitles(userId, interestId));
  const missing = titles.filter((t) => !existing.has(t.trim()));
  if (!missing.length) return;

  await createSkillGoalsBatch(
    userId,
    interestId,
    missing.map((title) => ({ title, source_type: 'ai_generated' as SkillGoalSourceType })),
  );
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/** Update a skill goal's details */
export async function updateSkillGoal(
  id: string,
  updates: Partial<Pick<UserSkillGoal, 'title' | 'description' | 'category' | 'sort_order'>>,
): Promise<UserSkillGoal> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Record a rating from a step review.
 * Updates current_rating (latest), bumps rating_count, sets last_rated_at.
 */
export async function recordRating(
  userId: string,
  interestId: string,
  title: string,
  rating: number,
): Promise<void> {
  // Try update first — most common case is the row already exists (ensureSkillGoals ran).
  // This avoids insert conflicts when concurrent upserts race.
  const { data: updated, error: updateErr } = await supabase
    .from(TABLE)
    .update({
      current_rating: rating,
      last_rated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('interest_id', interestId)
    .eq('title', title.trim())
    .select('id')
    .maybeSingle();

  if (updateErr) {
    console.warn('[SkillGoalService] recordRating update failed:', updateErr);
  }

  // Row didn't exist yet — upsert to create it
  if (!updated) {
    const { error } = await supabase
      .from(TABLE)
      .upsert(
        {
          user_id: userId,
          interest_id: interestId,
          title: title.trim(),
          current_rating: rating,
          rating_count: 1,
          last_rated_at: new Date().toISOString(),
          source_type: 'manual',
        },
        { onConflict: 'user_id,interest_id,title' },
      );

    if (error) {
      console.warn('[SkillGoalService] recordRating upsert failed:', error);
    }
  }
}

/**
 * Sync capability_progress from a step review to skill goals.
 * Called after a step review is saved.
 */
export async function syncStepReviewRatings(
  userId: string,
  interestId: string,
  capabilityProgress: Record<string, number>,
): Promise<void> {
  const entries = Object.entries(capabilityProgress);
  if (!entries.length) return;

  // Ensure all goals exist
  await ensureSkillGoals(userId, interestId, entries.map(([title]) => title));

  // Record each rating
  await Promise.allSettled(
    entries.map(([title, rating]) => recordRating(userId, interestId, title, rating)),
  );
}

/**
 * Record a coach/instructor rating on a student's skill goal.
 * Stub for future coach-facing UI.
 */
export async function recordCoachRating(
  goalId: string,
  coachId: string,
  rating: number,
): Promise<void> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      coach_rating: rating,
      coach_id: coachId,
      coach_rated_at: new Date().toISOString(),
    })
    .eq('id', goalId)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Skill goal not found.');
}

// ---------------------------------------------------------------------------
// Archive / Delete
// ---------------------------------------------------------------------------

/** Archive a skill goal (soft delete) */
export async function archiveSkillGoal(id: string): Promise<void> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'archived' })
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Skill goal not found.');
}

/** Permanently delete a skill goal */
export async function deleteSkillGoal(id: string): Promise<void> {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Skill goal not found.');
}
