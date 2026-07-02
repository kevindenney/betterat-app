/**
 * BlueprintSubscribeService — the single, source-agnostic subscribe path for
 * every blueprint source (System-A peer "follow a plan", institutional Studio
 * blueprints, and paid marketplace blueprints).
 *
 * Subscribing is a *relationship* ("this plan is in my Library, with progress").
 * Steps enter the learner's timeline only on the learner's terms: the subscribe
 * moment offers a starting choice — first step / whole plan / just subscribe —
 * and the rest stay pullable. No source auto-dumps its whole step list.
 *
 * See docs/redesign/specs/BLUEPRINT_SUBSCRIBE_UNIFIED_FLOW_SPEC.md.
 */

import { supabase } from '@/services/supabase';
import { logger } from '@/lib/logger';
import {
  getBlueprintById,
  getBlueprintSteps,
  markStepAction,
} from '@/services/BlueprintService';
import { adoptStep } from '@/services/TimelineStepService';
import {
  materializeAssignedBlueprint,
  materializeAssignedBlueprintDetailed,
  type MaterializeAssignedBlueprintResult,
  type MaterializeStepMode,
} from '@/services/CohortBlueprintService';

export type BlueprintSystem = 'timeline' | 'institutional' | 'marketplace';
export type EntryGranularity = 'first' | 'all' | 'none';

export interface SubscribeToBlueprintInput {
  userId: string;
  blueprintId: string;
  blueprintSystem: BlueprintSystem;
  /** Learner's chosen interest; null means "use the blueprint's authored interest". */
  targetInterestId: string | null;
  entryGranularity: EntryGranularity;
  /** Season the learner is currently viewing (System-A adopt stamps it on the copy). */
  viewedSeasonId?: string | null;
}

export interface SubscribeToBlueprintResult {
  subscriptionId: string | null;
  materializedCount: number;
}

const granularityToStepMode = (g: EntryGranularity): MaterializeStepMode => g;

/**
 * Write the relationship row + auto-follow the author + materialize the chosen
 * starting set. Idempotent at the relationship level (upsert on
 * blueprint_id+subscriber_id); materialization is idempotent per source.
 */
export async function subscribeToBlueprint(
  input: SubscribeToBlueprintInput,
): Promise<SubscribeToBlueprintResult> {
  const { userId, blueprintId, blueprintSystem, targetInterestId, entryGranularity } = input;

  if (blueprintSystem === 'timeline') {
    return subscribeTimeline(input);
  }

  // Institutional + marketplace both reference public.blueprints and share the
  // template-based materialization path.
  const subscriptionId = await upsertRelationshipRow({
    userId,
    blueprintId,
    blueprintSystem,
    targetInterestId,
    entryGranularity,
  });

  await autoFollowBlueprintsAuthor(userId, blueprintId);

  const materializedCount = await materializeAssignedBlueprint(userId, blueprintId, {
    stepMode: granularityToStepMode(entryGranularity),
    interestId: targetInterestId,
  });

  return { subscriptionId, materializedCount };
}

/**
 * System-A: reuse the existing relationship-row + access-check + author-follow,
 * then stamp the new source-agnostic columns and adopt the chosen starting set
 * through the per-step adopt path (so blueprint_step_actions stays in sync).
 */
async function subscribeTimeline(
  input: SubscribeToBlueprintInput,
): Promise<SubscribeToBlueprintResult> {
  const { userId, blueprintId, targetInterestId, entryGranularity, viewedSeasonId } = input;

  const blueprint = await getBlueprintById(blueprintId);
  if (!blueprint) throw new Error('Blueprint not found');

  const interestId = targetInterestId ?? blueprint.interest_id;

  const subscriptionId = await upsertRelationshipRow({
    userId,
    blueprintId,
    blueprintSystem: 'timeline',
    targetInterestId: interestId,
    entryGranularity,
  });

  // Auto-follow the author (non-blocking).
  if (blueprint.user_id !== userId) {
    await supabase
      .from('user_follows')
      .upsert(
        { follower_id: userId, following_id: blueprint.user_id },
        { onConflict: 'follower_id,following_id' },
      )
      .then(({ error }: { error: unknown }) => {
        if (error) logger.warn('Auto-follow failed (non-blocking)', error);
      });
  }

  if (entryGranularity === 'none') {
    return { subscriptionId, materializedCount: 0 };
  }

  const steps = await getBlueprintSteps(blueprintId);
  const toAdopt = entryGranularity === 'first' ? steps.slice(0, 1) : steps;

  let materializedCount = 0;
  for (const step of toAdopt) {
    try {
      const created = await adoptStep(userId, step.id, interestId, blueprintId, viewedSeasonId);
      if (subscriptionId) {
        await markStepAction(subscriptionId, step.id, 'adopted', created.id);
      }
      materializedCount += 1;
    } catch (err) {
      logger.warn('Failed to adopt System-A step during subscribe', { stepId: step.id, err });
    }
  }

  return { subscriptionId, materializedCount };
}

async function upsertRelationshipRow(params: {
  userId: string;
  blueprintId: string;
  blueprintSystem: BlueprintSystem;
  targetInterestId: string | null;
  entryGranularity: EntryGranularity;
}): Promise<string | null> {
  const { userId, blueprintId, blueprintSystem, targetInterestId, entryGranularity } = params;
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('blueprint_subscriptions')
    .upsert(
      {
        blueprint_id: blueprintId,
        subscriber_id: userId,
        blueprint_system: blueprintSystem,
        target_interest_id: targetInterestId,
        entry_granularity: entryGranularity,
        subscribed_at: nowIso,
        last_synced_at: nowIso,
      },
      { onConflict: 'blueprint_id,subscriber_id' },
    )
    .select('id')
    .single();

  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

async function autoFollowBlueprintsAuthor(userId: string, blueprintId: string): Promise<void> {
  const { data, error } = await supabase
    .from('blueprints')
    .select('author_user_id')
    .eq('id', blueprintId)
    .maybeSingle();
  if (error || !data) return;
  const authorId = (data as { author_user_id: string | null }).author_user_id;
  if (!authorId || authorId === userId) return;

  await supabase
    .from('user_follows')
    .upsert(
      { follower_id: userId, following_id: authorId },
      { onConflict: 'follower_id,following_id' },
    )
    .then(({ error: followErr }: { error: unknown }) => {
      if (followErr) logger.warn('Auto-follow (blueprints author) failed (non-blocking)', followErr);
    });
}

/**
 * Pull the next not-yet-adopted template from a subscribed institutional /
 * marketplace blueprint into the timeline. Used by the composer's per-step pull
 * and the preview's "Add next step".
 */
export async function addNextInstitutionalStep(
  userId: string,
  blueprintId: string,
  interestId?: string | null,
): Promise<MaterializeAssignedBlueprintResult> {
  return materializeAssignedBlueprintDetailed(userId, blueprintId, {
    stepMode: 'first',
    interestId,
  });
}

/**
 * Pull every remaining not-yet-adopted template from a subscribed institutional /
 * marketplace blueprint. Used by the preview's "Add remaining N".
 */
export async function addRemainingInstitutionalSteps(
  userId: string,
  blueprintId: string,
  interestId?: string | null,
): Promise<MaterializeAssignedBlueprintResult> {
  return materializeAssignedBlueprintDetailed(userId, blueprintId, { stepMode: 'all', interestId });
}

/**
 * Pull one specific template from a subscribed institutional / marketplace
 * blueprint into the timeline. Backs the per-step "Add" control on the assigned
 * preview, so a learner can choose exactly which step to bring in rather than
 * being forced to take the whole remaining set.
 */
export async function addInstitutionalStepById(
  userId: string,
  blueprintId: string,
  templateId: string,
  interestId?: string | null,
): Promise<MaterializeAssignedBlueprintResult> {
  return materializeAssignedBlueprintDetailed(userId, blueprintId, {
    stepMode: { stepIds: [templateId] },
    interestId,
  });
}
