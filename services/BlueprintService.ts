/**
 * BlueprintService
 *
 * Data-access layer for timeline blueprints: publishing, subscribing,
 * fetching new steps for subscribers, and tracking adopt/dismiss actions.
 *
 * Tables:
 *   timeline_blueprints      - published blueprint records
 *   blueprint_subscriptions  - subscriber tracking
 *   blueprint_step_actions   - per-step adopt/dismiss/seen tracking
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import type {
  BlueprintRecord,
  CreateBlueprintInput,
  UpdateBlueprintInput,
  BlueprintSubscriptionRecord,
  BlueprintStepActionRecord,
  BlueprintWithAuthor,
  BlueprintNewStep,
  BlueprintSuggestedNextStep,
  SubscriberProgress,
  PeerTimeline,
  PeerTimelineStep,
} from '@/types/blueprint';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import { createStep, adoptStep } from '@/services/TimelineStepService';
import { resolveInterestId } from '@/services/TimelineStepService';

const logger = createLogger('BlueprintService');

// ---------------------------------------------------------------------------
// 1. Blueprint CRUD
// ---------------------------------------------------------------------------

export async function createBlueprint(
  input: CreateBlueprintInput,
): Promise<BlueprintRecord> {
  try {
    logger.debug('Creating blueprint', { slug: input.slug });
    const { data, error } = await supabase
      .from('timeline_blueprints')
      .insert({
        user_id: input.user_id,
        interest_id: input.interest_id,
        slug: input.slug,
        title: input.title,
        description: input.description ?? null,
        cover_image_url: input.cover_image_url ?? null,
        is_published: input.is_published ?? false,
        organization_id: input.organization_id ?? null,
        program_id: input.program_id ?? null,
        access_level: input.access_level ?? 'public',
        price_cents: input.price_cents ?? null,
        currency: input.currency ?? 'usd',
      })
      .select()
      .single();

    if (error) throw error;
    return data as BlueprintRecord;
  } catch (err) {
    logger.error('Failed to create blueprint', err);
    throw err;
  }
}

export async function updateBlueprint(
  blueprintId: string,
  updates: UpdateBlueprintInput,
): Promise<BlueprintRecord> {
  try {
    const { data, error } = await supabase
      .from('timeline_blueprints')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', blueprintId)
      .select()
      .single();

    if (error) throw error;
    return data as BlueprintRecord;
  } catch (err) {
    logger.error('Failed to update blueprint', err);
    throw err;
  }
}

export async function deleteBlueprint(blueprintId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('timeline_blueprints')
      .delete()
      .eq('id', blueprintId);

    if (error) throw error;
  } catch (err) {
    logger.error('Failed to delete blueprint', err);
    throw err;
  }
}

/**
 * Move a blueprint to a different interest. Requires curated steps
 * (fallback mode is not supported for migration). Updates interest_id
 * and records the previous interest for audit trail.
 */
export async function migrateBlueprint(
  blueprintId: string,
  newInterestId: string,
): Promise<BlueprintRecord> {
  // Verify blueprint has curated steps (migration without curation is unsafe)
  const { data: curatedRows, error: curatedErr } = await supabase
    .from('blueprint_steps')
    .select('step_id')
    .eq('blueprint_id', blueprintId)
    .limit(1);

  if (curatedErr) throw curatedErr;
  if (!curatedRows || curatedRows.length === 0) {
    throw new Error('Blueprint must have curated steps before moving to a different interest. Please curate your steps first.');
  }

  // Get current interest_id for audit trail
  const current = await getBlueprintById(blueprintId);
  if (!current) throw new Error('Blueprint not found');

  if (current.interest_id === newInterestId) {
    throw new Error('Blueprint is already in this interest');
  }

  const { data, error } = await supabase
    .from('timeline_blueprints')
    .update({
      interest_id: newInterestId,
      migrated_from_interest_id: current.interest_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', blueprintId)
    .select()
    .single();

  if (error) throw error;
  return data as BlueprintRecord;
}

// ---------------------------------------------------------------------------
// 2. Blueprint lookups
// ---------------------------------------------------------------------------

async function enrichBlueprintWithAuthor(
  blueprint: BlueprintRecord,
): Promise<BlueprintWithAuthor> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, avatar_url, bio')
    .eq('id', blueprint.user_id)
    .maybeSingle();

  let authorName = (profile as any)?.full_name || (profile as any)?.email;

  if (!authorName) {
    const { data: userRow } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', blueprint.user_id)
      .maybeSingle();
    authorName = (userRow as any)?.full_name || (userRow as any)?.email;
  }

  const result: BlueprintWithAuthor = {
    ...blueprint,
    author_name: authorName || undefined,
    author_avatar_emoji: undefined,
    author_avatar_color: undefined,
    author_bio: (profile as any)?.bio ?? undefined,
  };

  if (blueprint.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name, slug')
      .eq('id', blueprint.organization_id)
      .maybeSingle();
    result.organization_name = (org as any)?.name ?? undefined;
    result.organization_slug = (org as any)?.slug ?? undefined;
  }

  if (blueprint.program_id) {
    const { data: program } = await supabase
      .from('programs')
      .select('title')
      .eq('id', blueprint.program_id)
      .maybeSingle();
    result.program_name = (program as any)?.title ?? undefined;
  }

  return result;
}

export async function getBlueprintBySlug(
  slug: string,
): Promise<BlueprintWithAuthor | null> {
  try {
    const { data, error } = await supabase
      .from('timeline_blueprints')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return enrichBlueprintWithAuthor(data as BlueprintRecord);
  } catch (err) {
    logger.error('Failed to get blueprint by slug', err);
    throw err;
  }
}

export async function getBlueprintById(
  blueprintId: string,
): Promise<BlueprintRecord | null> {
  try {
    const { data, error } = await supabase
      .from('timeline_blueprints')
      .select('*')
      .eq('id', blueprintId)
      .maybeSingle();

    if (error) throw error;
    return (data as BlueprintRecord) ?? null;
  } catch (err) {
    logger.error('Failed to get blueprint by id', err);
    throw err;
  }
}

export async function getBlueprintWithAuthorById(
  blueprintId: string,
): Promise<BlueprintWithAuthor | null> {
  try {
    const { data, error } = await supabase
      .from('timeline_blueprints')
      .select('*')
      .eq('id', blueprintId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return enrichBlueprintWithAuthor(data as BlueprintRecord);
  } catch (err) {
    logger.error('Failed to get blueprint with author by id', err);
    throw err;
  }
}

export async function getUserBlueprints(
  userId: string,
): Promise<BlueprintRecord[]> {
  try {
    const { data, error } = await supabase
      .from('timeline_blueprints')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as BlueprintRecord[]) ?? [];
  } catch (err) {
    logger.error('Failed to get user blueprints', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 3. Blueprint steps (author's non-private steps for the interest)
// ---------------------------------------------------------------------------

export async function getBlueprintSteps(
  blueprintId: string,
): Promise<TimelineStepRecord[]> {
  try {
    // First try curated blueprint_steps
    const { data: curatedRows, error: curatedErr } = await supabase
      .from('blueprint_steps')
      .select('step_id, sort_order')
      .eq('blueprint_id', blueprintId)
      .order('sort_order', { ascending: true });

    if (curatedErr) throw curatedErr;

    if (curatedRows && curatedRows.length > 0) {
      // Fetch the actual step records
      const stepIds = curatedRows.map((r: any) => r.step_id);
      const { data: steps, error: stepsErr } = await supabase
        .from('timeline_steps')
        .select('*')
        .in('id', stepIds);

      if (stepsErr) throw stepsErr;

      // Sort by the blueprint_steps sort_order
      const orderMap = new Map(curatedRows.map((r: any) => [r.step_id, r.sort_order]));
      return ((steps ?? []) as TimelineStepRecord[]).sort(
        (a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0),
      );
    }

    // No curated steps — return empty. Authors should curate explicitly.
    logger.warn('Blueprint has no curated steps, returning empty', { blueprintId });
    return [];
  } catch (err) {
    logger.error('Failed to get blueprint steps', err);
    throw err;
  }
}

export async function addStepToBlueprint(
  blueprintId: string,
  stepId: string,
  sortOrder?: number,
): Promise<void> {
  try {
    // If no sort_order provided, append at end
    let order = sortOrder;
    if (order === undefined) {
      const { data: maxRow } = await supabase
        .from('blueprint_steps')
        .select('sort_order')
        .eq('blueprint_id', blueprintId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      order = ((maxRow as any)?.sort_order ?? -1) + 1;
    }

    const { error } = await supabase
      .from('blueprint_steps')
      .upsert(
        { blueprint_id: blueprintId, step_id: stepId, sort_order: order },
        { onConflict: 'blueprint_id,step_id' },
      );

    if (error) throw error;
  } catch (err) {
    logger.error('Failed to add step to blueprint', err);
    throw err;
  }
}

export async function removeStepFromBlueprint(
  blueprintId: string,
  stepId: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from('blueprint_steps')
      .delete()
      .eq('blueprint_id', blueprintId)
      .eq('step_id', stepId);

    if (error) throw error;
  } catch (err) {
    logger.error('Failed to remove step from blueprint', err);
    throw err;
  }
}

export async function reorderBlueprintSteps(
  blueprintId: string,
  stepIds: string[],
): Promise<void> {
  try {
    const updates = stepIds.map((stepId, index) => ({
      blueprint_id: blueprintId,
      step_id: stepId,
      sort_order: index,
    }));

    // Upsert all with new sort_orders
    const { error } = await supabase
      .from('blueprint_steps')
      .upsert(updates, { onConflict: 'blueprint_id,step_id' });

    if (error) throw error;
  } catch (err) {
    logger.error('Failed to reorder blueprint steps', err);
    throw err;
  }
}

export async function setBlueprintSteps(
  blueprintId: string,
  stepIds: string[],
): Promise<void> {
  try {
    // Delete all existing
    const { error: delErr } = await supabase
      .from('blueprint_steps')
      .delete()
      .eq('blueprint_id', blueprintId);

    if (delErr) throw delErr;

    if (stepIds.length === 0) return;

    // Insert new
    const rows = stepIds.map((stepId, index) => ({
      blueprint_id: blueprintId,
      step_id: stepId,
      sort_order: index,
    }));

    const { error: insErr } = await supabase
      .from('blueprint_steps')
      .insert(rows);

    if (insErr) throw insErr;
  } catch (err) {
    logger.error('Failed to set blueprint steps', err);
    throw err;
  }
}

/**
 * Backfill existing non-private steps into blueprint_steps when auto-curate
 * is first enabled. Only adds steps not already curated.
 */
export async function backfillAutoCurateSteps(
  blueprintId: string,
  userId: string,
  interestId: string,
): Promise<number> {
  // Get existing curated step IDs
  const { data: existing } = await supabase
    .from('blueprint_steps')
    .select('step_id')
    .eq('blueprint_id', blueprintId);
  const existingIds = new Set((existing ?? []).map((r: any) => r.step_id));

  // Get author's non-private steps for this interest
  const { data: steps } = await supabase
    .from('timeline_steps')
    .select('id')
    .eq('user_id', userId)
    .eq('interest_id', interestId)
    .neq('visibility', 'private')
    .order('created_at', { ascending: true });

  const toAdd = (steps ?? []).filter((s: any) => !existingIds.has(s.id));
  if (toAdd.length === 0) return 0;

  const maxSort = existing?.length ?? 0;
  const rows = toAdd.map((s: any, i: number) => ({
    blueprint_id: blueprintId,
    step_id: s.id,
    sort_order: maxSort + i,
  }));

  const { error } = await supabase.from('blueprint_steps').insert(rows);
  if (error) {
    logger.error('Failed to backfill auto-curate steps', error);
    throw error;
  }
  return toAdd.length;
}

// ---------------------------------------------------------------------------
// 4. Subscriptions
// ---------------------------------------------------------------------------

export async function subscribe(
  subscriberId: string,
  blueprintId: string,
): Promise<BlueprintSubscriptionRecord> {
  try {
    logger.debug('Subscribing to blueprint', { subscriberId, blueprintId });

    // Fetch blueprint and check access
    const blueprint = await getBlueprintById(blueprintId);
    if (!blueprint) throw new Error('Blueprint not found');

    const access = await checkBlueprintAccess(subscriberId, blueprint);
    if (!access.allowed) {
      throw new Error(access.reason ?? 'Access denied');
    }

    // Insert subscription (upsert to handle re-subscribing)
    const { data, error } = await supabase
      .from('blueprint_subscriptions')
      .upsert(
        {
          blueprint_id: blueprintId,
          subscriber_id: subscriberId,
          subscribed_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: 'blueprint_id,subscriber_id' },
      )
      .select()
      .single();

    if (error) throw error;

    // Auto-follow the blueprint author
    if (blueprint.user_id !== subscriberId) {
      await supabase
        .from('user_follows')
        .upsert(
          {
            follower_id: subscriberId,
            following_id: blueprint.user_id,
          },
          { onConflict: 'follower_id,following_id' },
        )
        .then(({ error: followErr }) => {
          if (followErr) logger.warn('Auto-follow failed (non-blocking)', followErr);
        });
    }

    // Auto-adopt the first curated step so the subscriber's timeline isn't empty.
    // Remaining steps surface in the FOR YOU section as the user progresses.
    try {
      const steps = await getBlueprintSteps(blueprintId);
      if (steps.length > 0) {
        const firstStep = steps[0];
        logger.debug('Auto-adopting first blueprint step', { stepId: firstStep.id, totalSteps: steps.length });
        try {
          const adopted = await adoptStep(subscriberId, firstStep.id, blueprint.interest_id, blueprintId);
          // Record adopt action so ForYou doesn't re-suggest this step
          await markStepAction(data.id, firstStep.id, 'adopted', adopted.id);
        } catch (adoptErr) {
          logger.warn('Auto-adopt first step failed (non-blocking)', { stepId: firstStep.id, error: adoptErr });
        }
      }
    } catch (adoptErr) {
      // Non-fatal: subscription succeeded even if auto-adopt fails
      logger.error('Auto-adopt first blueprint step failed', adoptErr);
    }

    return data as BlueprintSubscriptionRecord;
  } catch (err) {
    logger.error('Failed to subscribe to blueprint', err);
    throw err;
  }
}

export async function unsubscribe(
  subscriberId: string,
  blueprintId: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from('blueprint_subscriptions')
      .delete()
      .eq('blueprint_id', blueprintId)
      .eq('subscriber_id', subscriberId);

    if (error) throw error;
  } catch (err) {
    logger.error('Failed to unsubscribe from blueprint', err);
    throw err;
  }
}

export async function getSubscription(
  subscriberId: string,
  blueprintId: string,
): Promise<BlueprintSubscriptionRecord | null> {
  try {
    const { data, error } = await supabase
      .from('blueprint_subscriptions')
      .select('*')
      .eq('blueprint_id', blueprintId)
      .eq('subscriber_id', subscriberId)
      .maybeSingle();

    if (error) throw error;
    return (data as BlueprintSubscriptionRecord) ?? null;
  } catch (err) {
    logger.error('Failed to get subscription', err);
    throw err;
  }
}

export async function getMySubscriptions(
  subscriberId: string,
): Promise<BlueprintSubscriptionRecord[]> {
  try {
    const { data, error } = await supabase
      .from('blueprint_subscriptions')
      .select('*')
      .eq('subscriber_id', subscriberId)
      .order('subscribed_at', { ascending: false });

    if (error) throw error;
    return (data as BlueprintSubscriptionRecord[]) ?? [];
  } catch (err) {
    logger.error('Failed to get subscriptions', err);
    throw err;
  }
}

/**
 * Get subscribed blueprints for a user, optionally filtered by interest.
 * Returns joined blueprint + author info for display.
 */
export async function getSubscribedBlueprints(
  subscriberId: string,
  interestId?: string | null,
): Promise<import('@/types/blueprint').SubscribedBlueprintInfo[]> {
  try {
    const { data: subs, error: subsErr } = await supabase
      .from('blueprint_subscriptions')
      .select('id, blueprint_id, subscribed_at')
      .eq('subscriber_id', subscriberId);
    if (subsErr) throw subsErr;
    if (!subs || subs.length === 0) return [];

    const blueprintIds = subs.map((s: any) => s.blueprint_id);
    let query = supabase
      .from('timeline_blueprints')
      .select('id, title, slug, user_id, interest_id')
      .in('id', blueprintIds)
      .eq('is_published', true);
    if (interestId) query = query.eq('interest_id', interestId);

    const { data: blueprints, error: bpErr } = await query;
    if (bpErr) throw bpErr;
    if (!blueprints || blueprints.length === 0) return [];

    // Fetch author names
    const authorIds = [...new Set((blueprints as any[]).map((bp) => bp.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', authorIds);
    const nameMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]));

    const subsMap = new Map(subs.map((s: any) => [s.blueprint_id, s]));

    return (blueprints as any[]).map((bp) => ({
      subscription_id: subsMap.get(bp.id)!.id,
      blueprint_id: bp.id,
      blueprint_title: bp.title,
      blueprint_slug: bp.slug,
      author_name: nameMap.get(bp.user_id) ?? null,
      subscribed_at: subsMap.get(bp.id)!.subscribed_at,
    }));
  } catch (err) {
    logger.error('Failed to get subscribed blueprints', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 5. New steps for subscriber (living subscription feed)
// ---------------------------------------------------------------------------

export async function getNewStepsForSubscriber(
  subscriberId: string,
  interestId?: string | null,
): Promise<BlueprintNewStep[]> {
  try {
    // Get all active subscriptions
    const { data: subs, error: subsErr } = await supabase
      .from('blueprint_subscriptions')
      .select('id, blueprint_id, last_synced_at')
      .eq('subscriber_id', subscriberId);

    if (subsErr) throw subsErr;
    if (!subs || subs.length === 0) return [];

    const results: BlueprintNewStep[] = [];

    for (const sub of subs) {
      // Get the blueprint
      const { data: bp } = await supabase
        .from('timeline_blueprints')
        .select('*')
        .eq('id', (sub as any).blueprint_id)
        .eq('is_published', true)
        .maybeSingle();

      if (!bp) continue;
      const blueprint = bp as BlueprintRecord;

      // Skip if filtering by interest and doesn't match
      if (interestId && blueprint.interest_id !== interestId) continue;

      // Get steps from the blueprint author that haven't been acted on
      const { data: actedStepIds } = await supabase
        .from('blueprint_step_actions')
        .select('source_step_id')
        .eq('subscription_id', (sub as any).id);

      const excludeIds = (actedStepIds ?? []).map((a: any) => a.source_step_id);

      // Get steps: prefer curated blueprint_steps, fallback to all non-private
      const { data: curatedRows } = await supabase
        .from('blueprint_steps')
        .select('step_id, sort_order')
        .eq('blueprint_id', blueprint.id)
        .order('sort_order', { ascending: true });

      let stepQuery;
      // Track curated sort order for post-query sorting
      let curatedSortMap: Map<string, number> | null = null;
      if (curatedRows && curatedRows.length > 0) {
        curatedSortMap = new Map(curatedRows.map((r: any) => [r.step_id, r.sort_order]));
        const curatedIds = curatedRows.map((r: any) => r.step_id);
        // Filter out already-acted steps
        const remainingIds = curatedIds.filter((id: string) => !excludeIds.includes(id));
        if (remainingIds.length === 0) continue;

        stepQuery = supabase
          .from('timeline_steps')
          .select('id, title, description, status, created_at, user_id')
          .in('id', remainingIds);
      } else {
        stepQuery = supabase
          .from('timeline_steps')
          .select('id, title, description, status, created_at, user_id')
          .eq('user_id', blueprint.user_id)
          .eq('interest_id', blueprint.interest_id)
          .neq('visibility', 'private')
          .order('sort_order', { ascending: true });

        if (excludeIds.length > 0) {
          stepQuery = stepQuery.not('id', 'in', `(${excludeIds.join(',')})`);
        }
      }

      const { data: steps, error: stepsErr } = await stepQuery;
      if (stepsErr) {
        logger.warn('Failed to fetch blueprint steps', stepsErr);
        continue;
      }

      // Get author name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', blueprint.user_id)
        .maybeSingle();

      // Sort by curated blueprint_steps sort_order when available
      const sortedSteps = curatedSortMap
        ? [...(steps ?? [])].sort((a, b) => (curatedSortMap!.get((a as any).id) ?? 999) - (curatedSortMap!.get((b as any).id) ?? 999))
        : (steps ?? []);

      for (const step of sortedSteps) {
        results.push({
          step_id: (step as any).id,
          step_title: (step as any).title,
          step_description: (step as any).description,
          step_status: (step as any).status,
          step_created_at: (step as any).created_at,
          blueprint_id: blueprint.id,
          blueprint_title: blueprint.title,
          blueprint_slug: blueprint.slug,
          interest_id: blueprint.interest_id,
          author_id: blueprint.user_id,
          author_name: (profile as any)?.full_name ?? undefined,
          subscription_id: (sub as any).id,
        });
      }
    }

    return results;
  } catch (err) {
    logger.error('Failed to get new steps for subscriber', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 6. Step actions (adopt / dismiss / seen)
// ---------------------------------------------------------------------------

export async function markStepAction(
  subscriptionId: string,
  sourceStepId: string,
  action: 'adopted' | 'dismissed' | 'seen',
  adoptedStepId?: string | null,
): Promise<BlueprintStepActionRecord> {
  try {
    const { data, error } = await supabase
      .from('blueprint_step_actions')
      .upsert(
        {
          subscription_id: subscriptionId,
          source_step_id: sourceStepId,
          action,
          acted_at: new Date().toISOString(),
          adopted_step_id: adoptedStepId ?? null,
        },
        { onConflict: 'subscription_id,source_step_id' },
      )
      .select()
      .single();

    if (error) throw error;
    return data as BlueprintStepActionRecord;
  } catch (err) {
    logger.error('Failed to mark step action', err);
    throw err;
  }
}

export async function updateLastSynced(
  subscriptionId: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from('blueprint_subscriptions')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', subscriptionId);

    if (error) throw error;
  } catch (err) {
    logger.error('Failed to update last synced', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 7. Organization blueprints & access control
// ---------------------------------------------------------------------------

export async function getOrganizationBlueprints(
  orgId: string,
): Promise<BlueprintRecord[]> {
  try {
    const { data, error } = await supabase
      .from('timeline_blueprints')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as BlueprintRecord[]) ?? [];
  } catch (err) {
    logger.error('Failed to get organization blueprints', err);
    throw err;
  }
}

export async function getProgramBlueprints(
  programId: string,
): Promise<BlueprintRecord[]> {
  try {
    const { data, error } = await supabase
      .from('timeline_blueprints')
      .select('*')
      .eq('program_id', programId)
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as BlueprintRecord[]) ?? [];
  } catch (err) {
    logger.error('Failed to get program blueprints', err);
    throw err;
  }
}

export async function checkBlueprintAccess(
  userId: string,
  blueprint: BlueprintRecord,
): Promise<{ allowed: boolean; reason?: string; requiresPurchase?: boolean }> {
  if (blueprint.access_level === 'public') return { allowed: true };

  // Check org membership (applies to both org_members and paid)
  let isOrgMember = false;
  if (blueprint.organization_id) {
    try {
      const { data } = await supabase
        .from('organization_memberships')
        .select('id')
        .eq('user_id', userId)
        .eq('organization_id', blueprint.organization_id)
        .in('membership_status', ['active'])
        .maybeSingle();
      isOrgMember = !!data;
    } catch (err) {
      logger.error('Failed to check org membership', err);
    }
  }

  if (blueprint.access_level === 'org_members') {
    if (!blueprint.organization_id) return { allowed: true };
    if (isOrgMember) return { allowed: true };
    return { allowed: false, reason: 'You must be a member of this organization to subscribe.' };
  }

  if (blueprint.access_level === 'paid') {
    // Org members get free access to paid blueprints
    if (isOrgMember) return { allowed: true };

    // Check for completed purchase
    try {
      const { data: purchase } = await supabase
        .from('blueprint_purchases')
        .select('id')
        .eq('blueprint_id', blueprint.id)
        .eq('buyer_id', userId)
        .eq('status', 'completed')
        .maybeSingle();

      if (purchase) return { allowed: true };
    } catch (err) {
      logger.error('Failed to check blueprint purchase', err);
    }

    return {
      allowed: false,
      requiresPurchase: true,
      reason: 'This blueprint requires purchase.',
    };
  }

  return { allowed: false, reason: 'Access denied.' };
}

/**
 * Check if a user has purchased a specific blueprint
 */
export async function checkBlueprintPurchase(
  userId: string,
  blueprintId: string,
): Promise<{ purchased: boolean; status?: string }> {
  try {
    const { data, error } = await supabase
      .from('blueprint_purchases')
      .select('id, status')
      .eq('blueprint_id', blueprintId)
      .eq('buyer_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { purchased: false };
    return { purchased: data.status === 'completed', status: data.status };
  } catch (err) {
    logger.error('Failed to check blueprint purchase', err);
    return { purchased: false };
  }
}

export async function getBlueprintAccessInfo(
  slug: string,
): Promise<{
  exists: boolean;
  access_level?: string;
  is_published?: boolean;
  org_id?: string;
  org_name?: string;
  org_slug?: string;
  title?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('get_blueprint_access_info', { p_slug: slug });
    if (error) throw error;
    return (data as any) ?? { exists: false };
  } catch (err) {
    logger.error('Failed to get blueprint access info', err);
    return { exists: false };
  }
}

// ---------------------------------------------------------------------------
// 8. Blueprint subscribers
// ---------------------------------------------------------------------------

export async function getBlueprintSubscribers(
  blueprintId: string,
): Promise<
  {
    id: string;
    subscriber_id: string;
    subscriber_name: string | null;
    subscriber_avatar_url: string | null;
    subscribed_at: string;
  }[]
> {
  try {
    const { data: subs, error } = await supabase
      .from('blueprint_subscriptions')
      .select('id, subscriber_id, subscribed_at')
      .eq('blueprint_id', blueprintId)
      .order('subscribed_at', { ascending: false });

    if (error) throw error;
    if (!subs || subs.length === 0) return [];

    const subscriberIds = (subs as any[]).map((s) => s.subscriber_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', subscriberIds);

    const profileMap = new Map(
      (profiles ?? []).map((p: any) => [p.id, p]),
    );

    return (subs as any[]).map((s) => {
      const profile = profileMap.get(s.subscriber_id);
      return {
        id: s.id,
        subscriber_id: s.subscriber_id,
        subscriber_name: profile?.full_name ?? null,
        subscriber_avatar_url: profile?.avatar_url ?? null,
        subscribed_at: s.subscribed_at,
      };
    });
  } catch (err) {
    logger.error('Failed to get blueprint subscribers', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 9. Subscriber progress (for blueprint authors)
// ---------------------------------------------------------------------------

export async function getBlueprintSubscriberProgress(
  blueprintId: string,
): Promise<SubscriberProgress[]> {
  try {
    const { data, error } = await supabase.rpc('get_blueprint_subscriber_progress', {
      p_blueprint_id: blueprintId,
    });

    if (error) throw error;

    const rows = (data as any[]) ?? [];
    return rows.map((row) => {
      const steps = row.steps ?? [];
      return {
        subscriber_id: row.subscriber_id,
        name: row.name,
        avatar_url: row.avatar_url,
        subscribed_at: row.subscribed_at,
        steps,
        adopted_count: steps.filter((s: any) => s.action === 'adopted').length,
        completed_count: steps.filter((s: any) => s.status === 'completed').length,
        dismissed_count: steps.filter((s: any) => s.action === 'dismissed').length,
      };
    });
  } catch (err) {
    logger.error('Failed to get blueprint subscriber progress', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 9a. Co-subscriber progress (peer-visible, for Co-practitioners surface)
// ---------------------------------------------------------------------------

/**
 * Returns peer step_user_progress rows readable under the Phase 7
 * `step_user_progress_co_subscriber_read` RLS policy. Unlike the author-only
 * RPC `get_blueprint_subscriber_progress`, this works for any subscriber.
 * Each peer row carries their current/planned/settled step plus the
 * capability tags pulled from the linked timeline_step.
 */
export async function getCoSubscriberProgressForBlueprint(
  blueprintId: string,
): Promise<SubscriberProgress[]> {
  const { data, error } = await supabase
    .from('step_user_progress')
    .select(
      `
      blueprint_step_id,
      status,
      user_id,
      updated_at,
      blueprint_step:blueprint_steps!inner(
        blueprint_id,
        step:timeline_steps!inner(id, title, metadata)
      )
      `,
    )
    .eq('blueprint_step.blueprint_id', blueprintId);

  if (error) throw error;

  const byUser = new Map<string, SubscriberProgress>();
  for (const row of (data as any[]) ?? []) {
    const userId = row.user_id as string;
    if (!byUser.has(userId)) {
      byUser.set(userId, {
        subscriber_id: userId,
        name: '',
        avatar_url: null,
        subscribed_at: row.updated_at,
        steps: [],
        adopted_count: 0,
        completed_count: 0,
        dismissed_count: 0,
      });
    }
    const peer = byUser.get(userId)!;
    const plan = (row.blueprint_step?.step?.metadata?.plan ?? {}) as Record<string, unknown>;
    const capabilities = [
      ...(((plan.capability_goals as string[] | undefined) ?? []).filter(Boolean)),
      ...(((plan.competency_labels as string[] | undefined) ?? []).filter(Boolean)),
    ];
    peer.steps.push({
      source_step_id: row.blueprint_step?.step?.id ?? '',
      adopted_step_id: null,
      action: 'adopted',
      status: row.status,
      overall_rating: null,
      has_evidence: false,
      step_title: row.blueprint_step?.step?.title ?? 'Step',
      capabilities,
    } as any);
    if (row.status === 'settled') peer.completed_count += 1;
  }

  return Array.from(byUser.values());
}

// ---------------------------------------------------------------------------
// 9b. Subscriber adopted step details (for creator mentoring dashboard)
// ---------------------------------------------------------------------------

export interface SubscriberAdoptedStep {
  source_step_id: string;
  adopted_step_id: string;
  step: TimelineStepRecord;
  sort_order: number;
}

export async function getSubscriberAdoptedSteps(
  blueprintId: string,
  subscriberId: string,
): Promise<SubscriberAdoptedStep[]> {
  try {
    // Get the subscription for this subscriber + blueprint
    const { data: sub, error: subErr } = await supabase
      .from('blueprint_subscriptions')
      .select('id')
      .eq('blueprint_id', blueprintId)
      .eq('subscriber_id', subscriberId)
      .maybeSingle();

    if (subErr) throw subErr;
    if (!sub) return [];

    // Get all adopted step actions for this subscription
    const { data: actions, error: actErr } = await supabase
      .from('blueprint_step_actions')
      .select('source_step_id, adopted_step_id')
      .eq('subscription_id', sub.id)
      .eq('action', 'adopted')
      .not('adopted_step_id', 'is', null);

    if (actErr) throw actErr;
    if (!actions || actions.length === 0) return [];

    const adoptedIds = actions.map((a: any) => a.adopted_step_id).filter(Boolean);

    // Fetch the full adopted step records (RLS grants blueprint author SELECT access)
    const { data: steps, error: stepErr } = await supabase
      .from('timeline_steps')
      .select('*')
      .in('id', adoptedIds);

    if (stepErr) throw stepErr;

    const stepMap = new Map((steps ?? []).map((s: any) => [s.id, s]));

    // Get sort order from blueprint_steps to maintain curation order
    const sourceIds = actions.map((a: any) => a.source_step_id);
    const { data: bpSteps } = await supabase
      .from('blueprint_steps')
      .select('step_id, sort_order')
      .eq('blueprint_id', blueprintId)
      .in('step_id', sourceIds);

    const sortMap = new Map((bpSteps ?? []).map((bs: any) => [bs.step_id, bs.sort_order]));

    return actions
      .filter((a: any) => stepMap.has(a.adopted_step_id))
      .map((a: any) => ({
        source_step_id: a.source_step_id,
        adopted_step_id: a.adopted_step_id,
        step: stepMap.get(a.adopted_step_id) as TimelineStepRecord,
        sort_order: sortMap.get(a.source_step_id) ?? 999,
      }))
      .sort((a, b) => a.sort_order - b.sort_order);
  } catch (err) {
    logger.error('Failed to get subscriber adopted steps', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 10. Suggested next steps (for smart add sheet)
// ---------------------------------------------------------------------------

export async function getSuggestedNextSteps(
  subscriberId: string,
  interestId?: string | null,
): Promise<BlueprintSuggestedNextStep[]> {
  try {
    const { data, error } = await supabase.rpc('get_suggested_next_steps', {
      p_subscriber_id: subscriberId,
      p_interest_id: interestId ?? null,
    });

    if (error) throw error;
    return (data as BlueprintSuggestedNextStep[]) ?? [];
  } catch (err) {
    logger.error('Failed to get suggested next steps', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 11. Peer subscriber timelines (for peer progress display)
// ---------------------------------------------------------------------------

export async function getPeerSubscriberTimelines(
  blueprintId: string,
  excludeUserId: string,
  interestId: string,
  blueprintTitle: string,
): Promise<PeerTimeline[]> {
  try {
    // 1. Get subscribers for this blueprint
    const subscribers = await getBlueprintSubscribers(blueprintId);
    const peerIds = subscribers
      .map((s) => s.subscriber_id)
      .filter((id) => id !== excludeUserId);

    if (peerIds.length === 0) return [];

    // Limit to 10 peers
    const limitedPeerIds = peerIds.slice(0, 10);

    // 2. Batch-fetch non-private timeline_steps for these peers
    const { data: steps, error } = await supabase
      .from('timeline_steps')
      .select('id, title, status, completed_at, user_id')
      .in('user_id', limitedPeerIds)
      .eq('interest_id', interestId)
      .neq('visibility', 'private')
      .order('sort_order', { ascending: true })
      .limit(200); // 10 peers × 20 steps max

    if (error) throw error;

    // 3. Group by user, limit 20 steps per peer
    const stepsByUser = new Map<string, PeerTimelineStep[]>();
    for (const step of (steps ?? []) as any[]) {
      const userId = step.user_id;
      if (!stepsByUser.has(userId)) stepsByUser.set(userId, []);
      const userSteps = stepsByUser.get(userId)!;
      if (userSteps.length < 20) {
        userSteps.push({
          id: step.id,
          title: step.title,
          status: step.status,
          completed_at: step.completed_at,
        });
      }
    }

    // 4. Build subscriber name/avatar map
    const subMap = new Map(
      subscribers.map((s) => [s.subscriber_id, s]),
    );

    // 5. Return only peers with ≥1 visible step
    const results: PeerTimeline[] = [];
    for (const peerId of limitedPeerIds) {
      const peerSteps = stepsByUser.get(peerId);
      if (!peerSteps || peerSteps.length === 0) continue;

      const sub = subMap.get(peerId);
      const completedCount = peerSteps.filter((s) => s.status === 'completed').length;

      results.push({
        blueprint_id: blueprintId,
        blueprint_title: blueprintTitle,
        subscriber_id: peerId,
        subscriber_name: sub?.subscriber_name ?? null,
        subscriber_avatar_emoji: null,
        subscriber_avatar_color: null,
        steps: peerSteps,
        completed_count: completedCount,
        total_count: peerSteps.length,
      });
    }

    return results;
  } catch (err) {
    logger.error('Failed to get peer subscriber timelines', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 12. Discover published blueprints for an interest
// ---------------------------------------------------------------------------

export interface DiscoveredBlueprint extends BlueprintRecord {
  author_name: string | null;
  author_avatar_url: string | null;
  organization_name: string | null;
}

/**
 * Fetch all published blueprints for an interest, with author and org info.
 * Returns blueprints grouped by: org-associated first, then self-published.
 */
export async function discoverBlueprints(
  interestId: string,
): Promise<DiscoveredBlueprint[]> {
  try {
    // Fetch published blueprints (no joins — FKs may not exist to profiles/organizations)
    const { data: blueprints, error } = await supabase
      .from('timeline_blueprints')
      .select('*')
      .eq('interest_id', interestId)
      .eq('is_published', true)
      .order('subscriber_count', { ascending: false });

    if (error) throw error;
    if (!blueprints?.length) return [];

    // Batch-fetch author profiles
    const userIds = [...new Set(blueprints.map(b => b.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);
    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

    // Batch-fetch org names
    const orgIds = [...new Set(blueprints.map(b => b.organization_id).filter(Boolean))] as string[];
    let orgMap = new Map<string, string>();
    if (orgIds.length) {
      const { data: orgs } = await supabase
        .from('organizations')
        .select('id, name')
        .in('id', orgIds);
      orgMap = new Map((orgs ?? []).map(o => [o.id, o.name]));
    }

    return blueprints.map(row => {
      const profile = profileMap.get(row.user_id);
      return {
        ...row,
        author_name: profile?.full_name ?? null,
        author_avatar_url: profile?.avatar_url ?? null,
        organization_name: row.organization_id ? (orgMap.get(row.organization_id) ?? null) : null,
      } as DiscoveredBlueprint;
    });
  } catch (err) {
    logger.error('Failed to discover blueprints', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 13. Slug generation helper
// ---------------------------------------------------------------------------

export function generateBlueprintSlug(
  displayName: string,
  interestName: string,
): string {
  const base = `${displayName}-${interestName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);

  // Add short random suffix for uniqueness
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

// ---------------------------------------------------------------------------
// 14. Create blueprint from AI-generated curriculum
// ---------------------------------------------------------------------------

export interface CurriculumStep {
  title: string;
  description?: string | null;
  step_type?: string;
  module_ids?: string[];
  suggested_competency_ids?: string[];
  /** Sub-steps for the "how" section of the plan */
  sub_steps?: string[];
  /** Reasoning for the "why" section of the plan */
  reasoning?: string;
  /** Estimated duration in days */
  estimated_duration_days?: number;
}

export interface CreateBlueprintFromCurriculumInput {
  userId: string;
  /** Optional — omit for personal (non-org) blueprints */
  organizationId?: string | null;
  interestSlug: string;
  /** Pass directly to skip slug→ID resolution (avoids RLS issues with private interests) */
  interestId?: string;
  blueprintTitle: string;
  blueprintDescription?: string | null;
  steps: CurriculumStep[];
  accessLevel?: 'public' | 'org_members' | 'paid';
  /** Inspiration source tracking */
  inspirationSourceUrl?: string | null;
  inspirationSourceText?: string | null;
  inspirationSourceType?: 'url' | 'text' | 'description' | null;
}

/**
 * Creates a full blueprint from AI-generated curriculum steps.
 * 1. Resolves interest slug → ID
 * 2. Creates timeline_steps owned by the admin
 * 3. Creates a timeline_blueprints record for the org
 * 4. Links steps via blueprint_steps
 */
export async function createBlueprintFromCurriculum(
  input: CreateBlueprintFromCurriculumInput,
): Promise<{ blueprint: BlueprintRecord; steps: TimelineStepRecord[] }> {
  const {
    userId,
    organizationId = null,
    interestSlug,
    interestId: directInterestId,
    blueprintTitle,
    blueprintDescription,
    steps: curriculumSteps,
    accessLevel,
    inspirationSourceUrl,
    inspirationSourceText,
    inspirationSourceType,
  } = input;

  // Derive defaults based on whether this is an org or personal blueprint
  const isPersonal = !organizationId;
  const effectiveAccessLevel = accessLevel ?? (isPersonal ? 'public' : 'org_members');
  const stepVisibility = isPersonal ? 'crew' : 'fleet';

  // 1. Resolve interest ID — use direct ID if provided, otherwise look up by slug
  const interestId = directInterestId ?? await resolveInterestId(interestSlug);
  if (!interestId) {
    throw new Error(`Could not resolve interest ID for slug "${interestSlug}"`);
  }

  // 2. Create timeline steps
  const createdSteps: TimelineStepRecord[] = [];
  for (const step of curriculumSteps) {
    // Build plan metadata from extended fields
    const planMetadata: Record<string, unknown> = {};
    if (step.sub_steps?.length) {
      planMetadata.how_sub_steps = step.sub_steps.map((text, i) => ({
        id: `sub_${Date.now()}_${i}`,
        text,
        sort_order: i,
        completed: false,
      }));
    }
    if (step.reasoning) {
      planMetadata.why_reasoning = step.reasoning;
    }
    if (step.estimated_duration_days) {
      planMetadata.estimated_duration_days = step.estimated_duration_days;
    }

    const created = await createStep({
      user_id: userId,
      interest_id: interestId,
      organization_id: organizationId ?? undefined,
      title: step.title,
      description: step.description ?? null,
      source_type: isPersonal ? 'blueprint' : 'template',
      category: step.step_type ?? 'general',
      visibility: stepVisibility,
      metadata: {
        ...(step.module_ids?.length ? { module_ids: step.module_ids } : {}),
        ...(step.suggested_competency_ids?.length
          ? { suggested_competency_ids: step.suggested_competency_ids }
          : {}),
        ...(Object.keys(planMetadata).length > 0 ? { plan: planMetadata } : {}),
        generated_from: isPersonal ? 'ai_inspiration' : 'ai_curriculum',
      },
    });
    createdSteps.push(created);
  }

  // 3. Create the blueprint
  const slug = generateBlueprintSlug(blueprintTitle, interestSlug);
  const blueprintInsert: CreateBlueprintInput = {
    user_id: userId,
    interest_id: interestId,
    slug,
    title: blueprintTitle,
    description: blueprintDescription ?? null,
    is_published: !isPersonal, // Personal blueprints start as drafts
    organization_id: organizationId,
    access_level: effectiveAccessLevel,
  };

  const blueprint = await createBlueprint(blueprintInsert);

  // 3b. Set inspiration source columns if provided
  if (inspirationSourceType) {
    await supabase
      .from('timeline_blueprints')
      .update({
        inspiration_source_url: inspirationSourceUrl ?? null,
        inspiration_source_text: inspirationSourceText ?? null,
        inspiration_source_type: inspirationSourceType,
      })
      .eq('id', blueprint.id);
  }

  // 4. Link steps to blueprint
  await setBlueprintSteps(
    blueprint.id,
    createdSteps.map((s) => s.id),
  );

  return { blueprint, steps: createdSteps };
}
