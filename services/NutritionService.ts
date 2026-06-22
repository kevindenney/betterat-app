/**
 * NutritionService — CRUD and aggregation for nutrition_entries.
 *
 * Nutrition is daily/ambient (not step-bound), so it has its own table.
 * Daily targets come from manifesto weekly_cadence.
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { getManifesto } from '@/services/ManifestoService';
import type { StepNutritionEntry, StepNutritionDaySummary } from '@/types/step-nutrition';
import type {
  NutritionEntry,
  NutritionEntryCreateInput,
  NutritionDaySummary,
  NutritionTargets,
} from '@/types/nutrition';

const logger = createLogger('NutritionService');

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createNutritionEntry(
  input: NutritionEntryCreateInput,
): Promise<NutritionEntry | null> {
  try {
    const { data, error } = await supabase
      .from('nutrition_entries')
      .insert({
        user_id: input.user_id,
        interest_id: input.interest_id,
        conversation_id: input.conversation_id ?? null,
        logged_at: input.logged_at ?? new Date().toISOString(),
        meal_type: input.meal_type ?? null,
        description: input.description,
        calories: input.calories ?? null,
        protein_g: input.protein_g ?? null,
        carbs_g: input.carbs_g ?? null,
        fat_g: input.fat_g ?? null,
        fiber_g: input.fiber_g ?? null,
        water_oz: input.water_oz ?? null,
        confidence: input.confidence ?? 'estimated',
        source: input.source ?? 'conversation',
      })
      .select()
      .single();

    if (error) {
      logger.error('createNutritionEntry failed', error);
      return null;
    }
    return data as NutritionEntry;
  } catch (err) {
    logger.error('createNutritionEntry failed', err);
    return null;
  }
}

export async function updateNutritionEntry(
  id: string,
  updates: Partial<Omit<NutritionEntry, 'id' | 'user_id' | 'created_at'>>,
): Promise<NutritionEntry | null> {
  try {
    const { data, error } = await supabase
      .from('nutrition_entries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('updateNutritionEntry failed', error);
      return null;
    }
    return data as NutritionEntry;
  } catch (err) {
    logger.error('updateNutritionEntry failed', err);
    return null;
  }
}

export async function deleteNutritionEntry(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('nutrition_entries')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) {
    logger.error('deleteNutritionEntry failed', error);
    return false;
  }
  if (!data) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get today's nutrition entries and summary for a user + interest.
 */
export async function getTodaySummary(
  userId: string,
  interestId: string,
): Promise<NutritionDaySummary> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

  try {
    const { data, error } = await supabase
      .from('nutrition_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .gte('logged_at', startOfDay)
      .lt('logged_at', endOfDay)
      .order('logged_at', { ascending: true });

    if (error) {
      if (error.code === '42P01' || error.message?.includes('relation')) {
        return emptyDaySummary(today);
      }
      throw error;
    }

    const entries = (data ?? []) as NutritionEntry[];
    return buildDaySummary(today, entries);
  } catch (err) {
    logger.error('getTodaySummary failed', err);
    return emptyDaySummary(today);
  }
}

/**
 * Get weekly summaries (last 7 days) for a user + interest.
 */
export async function getWeeklySummary(
  userId: string,
  interestId: string,
): Promise<NutritionDaySummary[]> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const startOfRange = new Date(sevenDaysAgo.getFullYear(), sevenDaysAgo.getMonth(), sevenDaysAgo.getDate()).toISOString();
  const endOfRange = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  try {
    const { data, error } = await supabase
      .from('nutrition_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .gte('logged_at', startOfRange)
      .lt('logged_at', endOfRange)
      .order('logged_at', { ascending: true });

    if (error) {
      if (error.code === '42P01' || error.message?.includes('relation')) return [];
      throw error;
    }

    const entries = (data ?? []) as NutritionEntry[];

    // Group by day
    const byDay = new Map<string, NutritionEntry[]>();
    for (const entry of entries) {
      const day = entry.logged_at.slice(0, 10); // YYYY-MM-DD
      const existing = byDay.get(day) ?? [];
      existing.push(entry);
      byDay.set(day, existing);
    }

    // Build summaries for each of the 7 days
    const summaries: NutritionDaySummary[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(sevenDaysAgo.getFullYear(), sevenDaysAgo.getMonth(), sevenDaysAgo.getDate() + i);
      const dayStr = date.toISOString().slice(0, 10);
      const dayEntries = byDay.get(dayStr) ?? [];
      summaries.push(buildDaySummary(date, dayEntries));
    }

    return summaries;
  } catch (err) {
    logger.error('getWeeklySummary failed', err);
    return [];
  }
}

/**
 * Get daily nutrition targets from manifesto weekly_cadence.
 */
export async function getDailyTargets(
  userId: string,
  interestId: string,
): Promise<NutritionTargets> {
  try {
    const manifesto = await getManifesto(userId, interestId);
    if (!manifesto?.weekly_cadence) return {};

    const c = manifesto.weekly_cadence;
    return {
      calories_daily: typeof c.calories_daily === 'number' ? c.calories_daily : undefined,
      protein_daily_g: typeof c.protein_daily_g === 'number' ? c.protein_daily_g : undefined,
      carbs_daily_g: typeof c.carbs_daily_g === 'number' ? c.carbs_daily_g : undefined,
      fat_daily_g: typeof c.fat_daily_g === 'number' ? c.fat_daily_g : undefined,
      fiber_daily_g: typeof c.fiber_daily_g === 'number' ? c.fiber_daily_g : undefined,
      water_daily_oz: typeof c.water_daily_oz === 'number' ? c.water_daily_oz : undefined,
    };
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Format for AI prompt injection
// ---------------------------------------------------------------------------

/**
 * Format today's nutrition summary for AI system prompts.
 */
export function formatNutritionForPrompt(
  summary: NutritionDaySummary,
  targets: NutritionTargets,
): string {
  const parts: string[] = ['NUTRITION TODAY:'];

  if (summary.meal_count === 0) {
    parts.push('No meals logged yet today.');
  } else {
    parts.push(
      `${summary.total_calories} cal, ${summary.total_protein}g protein, ${summary.total_carbs}g carbs, ${summary.total_fat}g fat (${summary.meal_count} meals)`,
    );
  }

  const targetParts: string[] = [];
  if (targets.calories_daily) targetParts.push(`${targets.calories_daily} cal`);
  if (targets.protein_daily_g) targetParts.push(`${targets.protein_daily_g}g protein`);
  if (targetParts.length) {
    parts.push(`Daily targets: ${targetParts.join(', ')}`);
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDaySummary(date: Date, entries: NutritionEntry[]): NutritionDaySummary {
  return {
    day: date.toISOString().slice(0, 10),
    meal_count: entries.length,
    total_calories: sum(entries, 'calories'),
    total_protein: sum(entries, 'protein_g'),
    total_carbs: sum(entries, 'carbs_g'),
    total_fat: sum(entries, 'fat_g'),
    total_fiber: sum(entries, 'fiber_g'),
    total_water: sum(entries, 'water_oz'),
    entries,
  };
}

function emptyDaySummary(date: Date): NutritionDaySummary {
  return buildDaySummary(date, []);
}

function sum(entries: NutritionEntry[], field: keyof NutritionEntry): number {
  return entries.reduce((acc, e) => acc + (typeof e[field] === 'number' ? (e[field] as number) : 0), 0);
}

function sumStepEntries(entries: StepNutritionEntry[], field: keyof StepNutritionEntry): number {
  return entries.reduce((acc, e) => acc + (typeof e[field] === 'number' ? (e[field] as number) : 0), 0);
}

// ---------------------------------------------------------------------------
// Step-based nutrition aggregation (reads from timeline_steps.metadata)
// ---------------------------------------------------------------------------

/**
 * Get today's nutrition aggregated from step metadata.
 */
export async function getStepNutritionToday(
  userId: string,
  interestId: string,
): Promise<StepNutritionDaySummary> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

  try {
    const { data, error } = await supabase
      .from('timeline_steps')
      .select('id, metadata, starts_at, completed_at')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .gte('starts_at', startOfDay)
      .order('starts_at', { ascending: true });

    if (error) {
      if (error.code === '42P01') return emptyStepDaySummary(today);
      throw error;
    }

    const allEntries: StepNutritionEntry[] = [];
    const stepIds: string[] = [];

    for (const step of data ?? []) {
      const nutrition = (step.metadata as Record<string, any>)?.act?.nutrition;
      const entries = nutrition?.entries as StepNutritionEntry[] | undefined;
      if (entries?.length) {
        allEntries.push(...entries);
        stepIds.push(step.id);
      }
    }

    return buildStepDaySummary(today, allEntries, stepIds);
  } catch (err) {
    logger.error('getStepNutritionToday failed', err);
    return emptyStepDaySummary(today);
  }
}

/**
 * Get weekly nutrition history from step metadata.
 */
export async function getStepNutritionHistory(
  userId: string,
  interestId: string,
  days = 7,
): Promise<StepNutritionDaySummary[]> {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const startOfRange = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).toISOString();

  try {
    const { data, error } = await supabase
      .from('timeline_steps')
      .select('id, metadata, starts_at')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .gte('starts_at', startOfRange)
      .order('starts_at', { ascending: true });

    if (error) return [];

    // Group by day
    const byDay = new Map<string, { entries: StepNutritionEntry[]; stepIds: string[] }>();
    for (const step of data ?? []) {
      const nutrition = (step.metadata as Record<string, any>)?.act?.nutrition;
      const entries = nutrition?.entries as StepNutritionEntry[] | undefined;
      if (!entries?.length) continue;

      const day = (step.starts_at || '').slice(0, 10);
      if (!day) continue;

      const existing = byDay.get(day) ?? { entries: [], stepIds: [] };
      existing.entries.push(...entries);
      existing.stepIds.push(step.id);
      byDay.set(day, existing);
    }

    const summaries: StepNutritionDaySummary[] = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      const dayStr = date.toISOString().slice(0, 10);
      const dayData = byDay.get(dayStr);
      summaries.push(buildStepDaySummary(date, dayData?.entries ?? [], dayData?.stepIds ?? []));
    }

    return summaries;
  } catch (err) {
    logger.error('getStepNutritionHistory failed', err);
    return [];
  }
}

/**
 * Format step-based nutrition summary for AI prompts.
 */
export function formatStepNutritionForPrompt(summary: StepNutritionDaySummary, targets: NutritionTargets): string {
  const parts: string[] = ['NUTRITION TODAY (from steps):'];

  if (summary.meal_count === 0) {
    parts.push('No nutrition logged in steps today.');
  } else {
    parts.push(
      `${summary.total_calories} cal, ${Math.round(summary.total_protein)}g protein, ${Math.round(summary.total_carbs)}g carbs, ${Math.round(summary.total_fat)}g fat (${summary.meal_count} entries)`,
    );
  }

  const targetParts: string[] = [];
  if (targets.calories_daily) targetParts.push(`${targets.calories_daily} cal`);
  if (targets.protein_daily_g) targetParts.push(`${targets.protein_daily_g}g protein`);
  if (targetParts.length) {
    parts.push(`Daily targets: ${targetParts.join(', ')}`);
  }

  return parts.join('\n');
}

function buildStepDaySummary(
  date: Date,
  entries: StepNutritionEntry[],
  stepIds: string[],
): StepNutritionDaySummary {
  return {
    day: date.toISOString().slice(0, 10),
    meal_count: entries.length,
    total_calories: sumStepEntries(entries, 'calories'),
    total_protein: sumStepEntries(entries, 'protein_g'),
    total_carbs: sumStepEntries(entries, 'carbs_g'),
    total_fat: sumStepEntries(entries, 'fat_g'),
    total_fiber: sumStepEntries(entries, 'fiber_g'),
    total_water: sumStepEntries(entries, 'water_oz'),
    entries,
    source_step_ids: stepIds,
  };
}

function emptyStepDaySummary(date: Date): StepNutritionDaySummary {
  return buildStepDaySummary(date, [], []);
}
