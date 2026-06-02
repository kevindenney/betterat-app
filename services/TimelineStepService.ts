/**
 * TimelineStepService
 *
 * Data-access layer for timeline steps: CRUD, adoption from other users,
 * and org template operations.
 *
 * Tables:
 *   timeline_steps          - per-user timeline step records
 *   timeline_step_templates - org-defined learning path blueprints
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { isAbortError } from '@/lib/utils/fetchWithTimeout';
import { PlaybookAIService } from '@/services/ai/PlaybookAIService';
import type {
  TimelineStepRecord,
  CreateTimelineStepInput,
  UpdateTimelineStepInput,
} from '@/types/timeline-steps';
import type { StepMetadata } from '@/types/step-detail';
import type {
  CourseLesson,
  CourseStructure,
} from '@/types/library';

const logger = createLogger('TimelineStepService');

// Cache interest slug → id lookups for the session
const interestIdCache = new Map<string, string>();

export async function resolveInterestId(slug: string): Promise<string | null> {
  if (interestIdCache.has(slug)) return interestIdCache.get(slug)!;
  try {
    const { data, error } = await supabase
      .from('interests')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (error || !data) return null;
    const id = String((data as any).id);
    interestIdCache.set(slug, id);
    return id;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 1. Get a user's timeline steps
// ---------------------------------------------------------------------------

export async function getUserTimeline(
  userId: string,
  interestId?: string | string[] | null,
): Promise<TimelineStepRecord[]> {
  try {
    // Fetch own steps
    let ownQuery = supabase
      .from('timeline_steps')
      .select('*')
      .eq('user_id', userId)
      .eq('is_plan_template', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(200);

    if (interestId) {
      if (Array.isArray(interestId)) {
        ownQuery = ownQuery.in('interest_id', interestId);
      } else {
        ownQuery = ownQuery.eq('interest_id', interestId);
      }
    }

    // Fetch steps where user is a collaborator (shared with them)
    let collabQuery = supabase
      .from('timeline_steps')
      .select('*')
      .contains('collaborator_user_ids', [userId])
      .neq('user_id', userId)
      .eq('is_plan_template', false)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(200);

    if (interestId) {
      if (Array.isArray(interestId)) {
        collabQuery = collabQuery.in('interest_id', interestId);
      } else {
        collabQuery = collabQuery.eq('interest_id', interestId);
      }
    }

    // Also fetch cross-interest pinned steps (only for single-interest queries on own timeline)
    const singleInterestId = interestId && !Array.isArray(interestId) ? interestId : null;
    const pinnedPromise = singleInterestId
      ? getPinnedStepsForInterest(userId, singleInterestId)
      : Promise.resolve([]);

    const [ownResult, collabResult, pinnedSteps] = await Promise.all([
      ownQuery, collabQuery, pinnedPromise,
    ]);

    if (ownResult.error) throw ownResult.error;
    if (collabResult.error) throw collabResult.error;

    // Merge: own steps first (sorted), then collaborated steps, then pinned — deduplicated
    const ownSteps = (ownResult.data ?? []) as TimelineStepRecord[];
    const collabSteps = (collabResult.data ?? []) as TimelineStepRecord[];
    const seenIds = new Set(ownSteps.map((s) => s.id));
    const uniqueCollabSteps = collabSteps.filter((s) => {
      if (seenIds.has(s.id)) return false;
      seenIds.add(s.id);
      return true;
    });
    // Mark pinned steps so the UI can render a pin indicator
    const uniquePinnedSteps = pinnedSteps
      .filter((s) => !seenIds.has(s.id))
      .map((s) => ({ ...s, _pinned: true as const }));
    return [...ownSteps, ...uniqueCollabSteps, ...uniquePinnedSteps];
  } catch (err) {
    if (!isAbortError(err)) logger.error('Failed to fetch user timeline', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 1b. Get a single step by ID
// ---------------------------------------------------------------------------

export async function getStepById(stepId: string): Promise<TimelineStepRecord> {
  try {
    const { data, error } = await supabase
      .from('timeline_steps')
      .select('*')
      .eq('id', stepId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error(`Step ${stepId} not found`);
    return data as TimelineStepRecord;
  } catch (err) {
    if (!isAbortError(err)) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found')) {
        logger.warn('Step not found (may be deleted or from another account)', stepId);
      } else {
        logger.error('Failed to fetch step by ID', err);
      }
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 1c. Update step metadata with deep merge
// ---------------------------------------------------------------------------

export async function updateStepMetadata(
  stepId: string,
  partialMetadata: Partial<StepMetadata>,
): Promise<TimelineStepRecord> {
  try {
    // Fetch current step to merge metadata
    const { data: current, error: fetchErr } = await supabase
      .from('timeline_steps')
      .select('metadata')
      .eq('id', stepId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!current) throw new Error(`Step ${stepId} not found or not owned by current user`);

    const existingMetadata = (current?.metadata ?? {}) as StepMetadata;

    // Deep merge: for each top-level key (plan, act, review), merge objects
    const merged: StepMetadata = { ...existingMetadata };
    for (const key of Object.keys(partialMetadata) as (keyof StepMetadata)[]) {
      const existing = merged[key];
      const incoming = partialMetadata[key];
      if (
        existing &&
        incoming &&
        typeof existing === 'object' &&
        typeof incoming === 'object' &&
        !Array.isArray(existing) &&
        !Array.isArray(incoming)
      ) {
        (merged as any)[key] = { ...existing, ...incoming };
      } else {
        (merged as any)[key] = incoming;
      }
    }

    // Extract platform collaborator user_ids for the denormalized RLS column
    const collaborators = (merged.plan as any)?.collaborators as
      | { type: string; user_id?: string }[]
      | undefined;
    const collaboratorUserIds = (collaborators ?? [])
      .filter((c) => c.type === 'platform' && c.user_id)
      .map((c) => c.user_id!);

    const { data, error } = await supabase
      .from('timeline_steps')
      .update({
        metadata: merged,
        collaborator_user_ids: collaboratorUserIds,
      })
      .eq('id', stepId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error(`Step ${stepId} not found or not owned by current user`);

    // Mirror collaborators + location into dedicated tables. Lives inline
    // here (not in a separate PlanTab callback) so it can't be bypassed by
    // Fast Refresh closures — every metadata write that touches `plan`
    // reconciles both tables. Fire-and-forget; the metadata write is the
    // source of truth and shouldn't block on these side writes.
    if ('plan' in partialMetadata) {
      void (async () => {
        try {
          const { data: authData } = await supabase.auth.getUser();
          const userId = authData?.user?.id;
          if (!userId) return;

          const [{ syncStepCollaborators }, { syncStepLocation }] = await Promise.all([
            import('@/services/StepCollaboratorService'),
            import('@/services/StepLocationService'),
          ]);

          await Promise.allSettled([
            syncStepCollaborators(stepId, userId, (collaborators ?? []) as any),
            syncStepLocation(
              stepId,
              userId,
              (merged.plan as any)?.where_location,
            ),
          ]);
        } catch (syncErr) {
          logger.warn('step_collaborators/step_location sync failed (non-fatal)', syncErr);
        }
      })();
    }

    return data as TimelineStepRecord;
  } catch (err) {
    if (isAbortError(err)) {
      logger.warn('Step metadata update aborted (navigation or timeout)');
      throw err;
    }
    logger.error('Failed to update step metadata', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 2. Get timelines of users the current user follows
// ---------------------------------------------------------------------------

export async function getFollowedUsersTimelines(
  userId: string,
  interestId?: string | null,
): Promise<TimelineStepRecord[]> {
  try {
    // Get followed user IDs
    const { data: follows, error: followErr } = await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (followErr) throw followErr;
    if (!follows || follows.length === 0) return [];

    const followingIds = follows.map((f: any) => String(f.following_id));

    let query = supabase
      .from('timeline_steps')
      .select('*')
      .in('user_id', followingIds)
      .in('visibility', ['crew', 'fleet', 'public'])
      .order('updated_at', { ascending: false })
      .limit(200);

    if (interestId) {
      query = query.eq('interest_id', interestId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as TimelineStepRecord[];
  } catch (err) {
    logger.error('Failed to fetch followed users timelines', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 3. Create a timeline step
// ---------------------------------------------------------------------------

export async function createStep(
  input: CreateTimelineStepInput,
): Promise<TimelineStepRecord> {
  try {
    // Title may be empty/null (Atlas long-press drops a draft pin and expects
    // the user to type a title on /step/[id]). The RPC normalises '' → NULL
    // and downstream renderers fall back to 'Untitled step'.
    const trimmedTitle = input.title?.trim() ?? null;
    const normalizedInput = { ...input, title: trimmedTitle };

    logger.debug('Creating timeline step', { title: trimmedTitle, userId: input.user_id });

    // Single round-trip: the create_timeline_step RPC runs the visibility
    // cascade (interest default → profile default → 'private'), assigns a
    // monotonically-increasing sort_order, defaults starts_at to NOW() when
    // the caller omits it, and performs the insert — all server-side.
    const { data, error } = await supabase
      .rpc('create_timeline_step', { p_input: normalizedInput as unknown as Record<string, unknown> })
      .single();

    if (error) throw error;
    if (!data) throw new Error('create_timeline_step returned no row');

    const created = data as unknown as TimelineStepRecord;

    // Fire-and-forget: trigger cross-interest suggestions from other Playbooks.
    // Statically imported above (was previously dynamic-imported here) because
    // the dynamic import caused Metro to bundle ~1k modules mid-action on
    // first use, which forced a hot-reload of the whole app and wiped the
    // post-create navigation + optimistic cache. Static import preloads the
    // bundle so the trigger runs without a reload cycle.
    Promise.resolve()
      .then(() => PlaybookAIService.crossInterest(created.id))
      .catch((e) => logger.debug('Cross-interest trigger skipped', e));

    return created;
  } catch (err) {
    logger.error('Failed to create timeline step', err);
    throw err;
  }
}

export async function shiftTimelineSortOrdersAtOrAfter(
  userId: string,
  interestId: string,
  atOrAfter: number,
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('timeline_steps')
      .select('id, sort_order')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .gte('sort_order', atOrAfter)
      .order('sort_order', { ascending: false });

    if (error) throw error;

    for (const row of (data ?? []) as Pick<TimelineStepRecord, 'id' | 'sort_order'>[]) {
      const { error: updateError } = await supabase
        .from('timeline_steps')
        .update({ sort_order: row.sort_order + 1 })
        .eq('id', row.id);
      if (updateError) throw updateError;
    }
  } catch (err) {
    logger.error('Failed to shift timeline sort orders', err);
    throw err;
  }
}

/**
 * Reassign sort_order = index for the given step ids, in order. Use this to
 * place a step at a precise position when stored sort_orders are degenerate
 * (e.g. seeded demo data where every step shares sort_order 0, so value-based
 * shifting can't create a gap between two tied neighbours). Only rows whose
 * sort_order actually changes are written.
 */
export async function resequenceTimelineSortOrders(orderedStepIds: string[]): Promise<void> {
  try {
    for (let index = 0; index < orderedStepIds.length; index += 1) {
      const { error } = await supabase
        .from('timeline_steps')
        .update({ sort_order: index })
        .eq('id', orderedStepIds[index]);
      if (error) throw error;
    }
  } catch (err) {
    logger.error('Failed to resequence timeline sort orders', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 4. Update a timeline step
// ---------------------------------------------------------------------------

export async function updateStep(
  stepId: string,
  input: UpdateTimelineStepInput,
): Promise<TimelineStepRecord> {
  try {
    logger.debug('Updating timeline step', { stepId });

    // Auto-set completed_at when status changes
    const payload: Record<string, unknown> = { ...input };
    if (input.status === 'completed' || input.status === 'settled') {
      payload.completed_at = new Date().toISOString();
    } else if (input.status) {
      payload.completed_at = null;
    }

    const { data, error } = await supabase
      .from('timeline_steps')
      .update(payload)
      .eq('id', stepId)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error(`Step ${stepId} not found or not owned by current user`);
    return data as TimelineStepRecord;
  } catch (err) {
    logger.error('Failed to update timeline step', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 5. Delete a timeline step
// ---------------------------------------------------------------------------

export async function deleteStep(stepId: string): Promise<void> {
  try {
    logger.debug('Deleting timeline step', { stepId });

    // A server-side AFTER DELETE trigger (cleanup_blueprint_step_action_on_delete)
    // handles the blueprint_step_actions cleanup when the deleted step was
    // adopted from a blueprint, so this is a single round-trip.
    //
    // .select() returns the rows actually removed. Under RLS, deleting a
    // step the viewer doesn't own matches zero rows and returns no error —
    // which the UI would otherwise read as success and navigate away,
    // leaving the step in place. Treat a 0-row delete as an explicit
    // ownership failure so the caller can surface it.
    const { data, error } = await supabase
      .from('timeline_steps')
      .delete()
      .eq('id', stepId)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error(
        "This step couldn't be deleted. You can only delete steps you created.",
      );
    }
  } catch (err) {
    logger.error('Failed to delete timeline step', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 6. Adopt a step from another user (copy with source tracking)
// ---------------------------------------------------------------------------

export async function adoptStep(
  userId: string,
  sourceStepId: string,
  interestId: string,
  blueprintId?: string | null,
): Promise<TimelineStepRecord> {
  try {
    logger.debug('Adopting step', { userId, sourceStepId });

    // Fetch the source step
    const { data: source, error: fetchErr } = await supabase
      .from('timeline_steps')
      .select('*')
      .eq('id', sourceStepId)
      .single();

    if (fetchErr) throw fetchErr;
    if (!source) throw new Error('Source step not found');

    // Get the max sort_order for the adopter's timeline
    const { data: maxRow } = await supabase
      .from('timeline_steps')
      .select('sort_order')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSort = (maxRow?.sort_order ?? 0) + 1;

    // Copy metadata but strip brain_dump (it's author-specific context, not relevant to adopter)
    const sourceMetadata = { ...((source as any).metadata ?? {}) };
    delete sourceMetadata.brain_dump;

    // Copy linked library resources via SECURITY DEFINER RPC so the adopter
    // can read the author's resources (RLS normally blocks cross-user reads).
    const linkedIds: string[] = sourceMetadata.plan?.linked_resource_ids ?? [];
    if (linkedIds.length > 0) {
      try {
        const { data: idMap, error: rpcErr } = await supabase.rpc(
          'copy_library_resources_for_adoption',
          {
            p_source_resource_ids: linkedIds,
            p_adopter_user_id: userId,
            p_interest_id: interestId,
          },
        );

        if (rpcErr) {
          logger.warn('RPC copy_library_resources_for_adoption failed', rpcErr);
        } else if (idMap && Object.keys(idMap).length > 0) {
          // Rewrite linked_resource_ids to point to the adopter's copies
          sourceMetadata.plan = {
            ...(sourceMetadata.plan ?? {}),
            linked_resource_ids: linkedIds.map((id) => idMap[id] ?? id),
          };
          logger.debug('Library resources copied for adoption', { count: Object.keys(idMap).length });
        }
      } catch (err) {
        // Non-fatal — step adoption still works without library resources
        logger.warn('Failed to copy library resources during adoption', err);
      }
    }

    // Guard against the source step having a null/empty title. Without this,
    // adopters inherited blank titles that rendered as "Untitled step" cards.
    const sourceTitle = typeof (source as any).title === 'string'
      ? (source as any).title.trim()
      : '';
    const adoptedTitle = sourceTitle.length > 0
      ? sourceTitle
      : `Step ${nextSort}`;

    const insertPayload: Record<string, unknown> = {
        user_id: userId,
        interest_id: interestId,
        organization_id: (source as any).organization_id ?? null,
        source_type: 'copied',
        source_id: sourceStepId,
        copied_from_user_id: (source as any).user_id,
        title: adoptedTitle,
        description: (source as any).description,
        category: (source as any).category ?? 'general',
        status: 'pending',
        starts_at: (source as any).starts_at ?? null,
        ends_at: (source as any).ends_at ?? null,
        location_name: (source as any).location_name,
        location_lat: (source as any).location_lat,
        location_lng: (source as any).location_lng,
        location_place_id: (source as any).location_place_id,
        visibility: 'private',
        share_approximate_location: false,
        sort_order: nextSort,
        metadata: sourceMetadata,
    };

    if (blueprintId) {
      insertPayload.source_blueprint_id = blueprintId;
      // Resolve the blueprint_steps join row for (blueprintId, sourceStepId)
      // so the adopter's timeline_step keeps the back-pointer to the
      // canonical blueprint step. Without this the WITH cohort count + the
      // Discuss tab's Cohort thread can't find the shared blueprint_step
      // and silently fall back to "no cohort thread to share into" even
      // though this is a blueprint-derived step.
      const { data: bsRow, error: bsErr } = await supabase
        .from('blueprint_steps')
        .select('id')
        .eq('blueprint_id', blueprintId)
        .eq('step_id', sourceStepId)
        .maybeSingle();
      if (bsErr) {
        logger.warn(
          'Failed to resolve blueprint_steps row during adoption — adopted step will be unlinked',
          { blueprintId, sourceStepId, error: bsErr },
        );
      } else if (bsRow?.id) {
        insertPayload.source_blueprint_step_id = bsRow.id;
      }
    }

    const { data, error } = await supabase
      .from('timeline_steps')
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;
    return data as TimelineStepRecord;
  } catch (err) {
    logger.error('Failed to adopt step', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 6b. Adopt the step pull-quoted into a discussion note
// ---------------------------------------------------------------------------

export interface AdoptQuotedStepResult {
  step: TimelineStepRecord;
  /** True when the caller already had this source step in their timeline,
   *  so nothing new was created. Lets the UI say "Already in your plan". */
  alreadyAdopted: boolean;
}

/**
 * Copy the step a discussion note quotes (quoted_step_id) into the caller's
 * timeline. The source belongs to another user and is normally walled off by
 * timeline_steps RLS, so we read its adoptable fields through the
 * get_quoted_step_for_adoption SECURITY DEFINER RPC, which only returns a row
 * when the caller can actually see the discussion the quote lives in. The
 * insert itself runs under the caller's own RLS (they own the new row).
 */
export async function adoptQuotedStep(
  userId: string,
  discussionId: string,
  interestId: string,
): Promise<AdoptQuotedStepResult> {
  try {
    const { data: rows, error: rpcErr } = await supabase.rpc(
      'get_quoted_step_for_adoption',
      { p_discussion_id: discussionId },
    );
    if (rpcErr) throw rpcErr;
    const source = (Array.isArray(rows) ? rows[0] : null) as
      | {
          source_step_id: string;
          owner_id: string;
          title: string | null;
          description: string | null;
          category: string | null;
          organization_id: string | null;
          location_name: string | null;
          location_lat: number | null;
          location_lng: number | null;
          location_place_id: string | null;
          visibility: string | null;
          metadata: Record<string, any> | null;
        }
      | null;
    if (!source) {
      throw new Error('This quoted step is no longer available to add.');
    }

    // Idempotent: if the caller already adopted this source into this
    // interest, return the existing copy rather than duplicating it.
    const { data: existing } = await supabase
      .from('timeline_steps')
      .select('*')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .eq('source_id', source.source_step_id)
      .limit(1)
      .maybeSingle();
    if (existing) {
      return { step: existing as TimelineStepRecord, alreadyAdopted: true };
    }

    const { data: maxRow } = await supabase
      .from('timeline_steps')
      .select('sort_order')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSort = (maxRow?.sort_order ?? 0) + 1;

    // Strip author-specific brain_dump; re-point linked library resources to
    // the adopter's own copies (cross-user reads handled by the same RPC
    // adoptStep uses).
    const sourceMetadata = { ...(source.metadata ?? {}) };
    delete sourceMetadata.brain_dump;
    const linkedIds: string[] = sourceMetadata.plan?.linked_resource_ids ?? [];
    if (linkedIds.length > 0) {
      try {
        const { data: idMap, error: resErr } = await supabase.rpc(
          'copy_library_resources_for_adoption',
          {
            p_source_resource_ids: linkedIds,
            p_adopter_user_id: userId,
            p_interest_id: interestId,
          },
        );
        if (resErr) {
          logger.warn('copy_library_resources_for_adoption failed (quoted adopt)', resErr);
        } else if (idMap && Object.keys(idMap).length > 0) {
          sourceMetadata.plan = {
            ...(sourceMetadata.plan ?? {}),
            linked_resource_ids: linkedIds.map((id) => (idMap as any)[id] ?? id),
          };
        }
      } catch (err) {
        logger.warn('Failed to copy library resources during quoted adoption', err);
      }
    }

    const sourceTitle =
      typeof source.title === 'string' ? source.title.trim() : '';
    const adoptedTitle = sourceTitle.length > 0 ? sourceTitle : `Step ${nextSort}`;

    const { data, error } = await supabase
      .from('timeline_steps')
      .insert({
        user_id: userId,
        interest_id: interestId,
        organization_id: source.organization_id ?? null,
        source_type: 'copied',
        source_id: source.source_step_id,
        copied_from_user_id: source.owner_id,
        title: adoptedTitle,
        description: source.description,
        category: source.category ?? 'general',
        status: 'pending',
        location_name: source.location_name,
        location_lat: source.location_lat,
        location_lng: source.location_lng,
        location_place_id: source.location_place_id,
        visibility: 'private',
        share_approximate_location: false,
        sort_order: nextSort,
        metadata: sourceMetadata,
      })
      .select()
      .single();
    if (error) throw error;
    return { step: data as TimelineStepRecord, alreadyAdopted: false };
  } catch (err) {
    logger.error('Failed to adopt quoted step', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 7. Org template operations
// ---------------------------------------------------------------------------

export interface TimelineStepTemplate {
  id: string;
  organization_id: string;
  interest_id: string;
  path_name: string;
  title: string;
  description: string | null;
  category: string;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function getTemplatesForOrg(
  orgId: string,
  interestId?: string | null,
): Promise<TimelineStepTemplate[]> {
  try {
    let query = supabase
      .from('timeline_step_templates')
      .select('*')
      .eq('organization_id', orgId)
      .order('path_name')
      .order('sort_order', { ascending: true });

    if (interestId) {
      query = query.eq('interest_id', interestId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as TimelineStepTemplate[];
  } catch (err) {
    logger.error('Failed to fetch templates', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 8. Batch-create timeline steps from course lessons
// ---------------------------------------------------------------------------

export interface CourseToTimelineOptions {
  userId: string;
  interestId: string;
  resourceId: string;
  courseTitle: string;
  authorOrCreator?: string;
  lessons: CourseLesson[];
  /** Days between each step (0 = all on the same day) */
  spacingDays?: number;
  startDate?: string;
}

export async function createStepsFromCourse(
  options: CourseToTimelineOptions,
): Promise<TimelineStepRecord[]> {
  const {
    userId,
    interestId,
    resourceId,
    courseTitle,
    authorOrCreator,
    lessons,
    spacingDays = 0,
    startDate,
  } = options;

  try {
    logger.debug('Creating steps from course', {
      userId,
      resourceId,
      lessonCount: lessons.length,
    });

    // Get user's current max sort_order
    const { data: maxRow } = await supabase
      .from('timeline_steps')
      .select('sort_order')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextSort = (maxRow?.sort_order ?? 0) + 1;
    const baseDate = startDate ? new Date(startDate) : null;

    const rows = lessons.map((lesson, idx) => {
      const startsAt = baseDate
        ? new Date(
            baseDate.getTime() + idx * spacingDays * 24 * 60 * 60 * 1000,
          ).toISOString()
        : null;

      const metadata: StepMetadata = {
        plan: {
          what_will_you_do: lesson.description || `Complete: ${lesson.title}`,
          linked_resource_ids: [resourceId],
        },
        course_context: {
          resource_id: resourceId,
          course_title: courseTitle,
          author_or_creator: authorOrCreator,
          lesson_id: lesson.id,
          lesson_index: idx,
          total_lessons: lessons.length,
        },
      };

      return {
        user_id: userId,
        interest_id: interestId,
        source_type: 'template' as const,
        source_id: resourceId,
        title: lesson.title,
        description: lesson.description ?? null,
        category: 'lesson',
        status: 'pending' as const,
        visibility: 'private' as const,
        sort_order: nextSort++,
        starts_at: startsAt,
        metadata,
      };
    });

    const { data, error } = await supabase
      .from('timeline_steps')
      .insert(rows)
      .select();

    if (error) throw error;
    return (data ?? []) as TimelineStepRecord[];
  } catch (err) {
    logger.error('Failed to create steps from course', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 9. Adopt an org-published course (creates steps + library resource)
// ---------------------------------------------------------------------------

export interface OrgCourseAdoptionInput {
  userId: string;
  interestId: string;
  orgId: string;
  /** The path_name for the course's template group */
  coursePath: string;
  /** Library ID where the mirror resource should be created */
  libraryId: string;
}

export async function adoptOrgCourse(
  input: OrgCourseAdoptionInput,
): Promise<{ steps: TimelineStepRecord[]; resourceId: string }> {
  const { userId, interestId, orgId, coursePath, libraryId } = input;

  try {
    logger.debug('Adopting org course', { userId, orgId, coursePath });

    // 1. Fetch the org's template steps for this course
    const { data: templates, error: fetchErr } = await supabase
      .from('timeline_step_templates')
      .select('*')
      .eq('organization_id', orgId)
      .eq('path_name', coursePath)
      .order('sort_order', { ascending: true });

    if (fetchErr) throw fetchErr;
    if (!templates || templates.length === 0) {
      throw new Error('Course template not found');
    }

    // 2. Get org name for display
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single();

    const orgName = (org as any)?.name || 'Organization';

    // 3. Create a library resource to mirror the course
    const courseStructure: CourseStructure = {
      modules: [
        {
          id: 'main',
          title: coursePath,
          sort_order: 0,
          lessons: (templates as any[]).map((t, i) => ({
            id: t.id,
            title: t.title,
            sort_order: i,
            description: t.description,
          })),
        },
      ],
      total_lessons: templates.length,
    };

    const { data: resource, error: resErr } = await supabase
      .from('library_resources')
      .insert({
        library_id: libraryId,
        user_id: userId,
        title: coursePath,
        resource_type: 'online_course',
        author_or_creator: orgName,
        description: `Adopted from ${orgName}`,
        metadata: { course_structure: courseStructure, progress: { completed_lesson_ids: [] } },
      })
      .select()
      .single();

    if (resErr) throw resErr;
    const resourceId = (resource as any).id;

    // 4. Create timeline steps from the templates
    const { data: maxRow } = await supabase
      .from('timeline_steps')
      .select('sort_order')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextSort = (maxRow?.sort_order ?? 0) + 1;

    const rows = (templates as any[]).map((t, idx) => ({
      user_id: userId,
      interest_id: interestId,
      organization_id: orgId,
      source_type: 'template' as const,
      source_id: t.id,
      title: t.title,
      description: t.description,
      category: t.category ?? 'lesson',
      status: 'pending' as const,
      visibility: 'private' as const,
      sort_order: nextSort++,
      metadata: {
        ...((t.metadata as Record<string, unknown>) ?? {}),
        plan: {
          linked_resource_ids: [resourceId],
        },
        course_context: {
          resource_id: resourceId,
          course_title: coursePath,
          author_or_creator: orgName,
          lesson_id: t.id,
          lesson_index: idx,
          total_lessons: templates.length,
        },
      },
    }));

    const { data: steps, error: stepErr } = await supabase
      .from('timeline_steps')
      .insert(rows)
      .select();

    if (stepErr) throw stepErr;

    return {
      steps: (steps ?? []) as TimelineStepRecord[],
      resourceId,
    };
  } catch (err) {
    logger.error('Failed to adopt org course', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 10. Get steps where the user is a collaborator (not the owner)
// ---------------------------------------------------------------------------

export async function getCollaboratedSteps(
  userId: string,
  interestId?: string | null,
): Promise<TimelineStepRecord[]> {
  try {
    let query = supabase
      .from('timeline_steps')
      .select('*')
      .contains('collaborator_user_ids', [userId])
      .neq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (interestId) {
      query = query.eq('interest_id', interestId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as TimelineStepRecord[];
  } catch (err) {
    logger.error('Failed to fetch collaborated steps', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 11. Public sharing — generate/retrieve share tokens
// ---------------------------------------------------------------------------

function generateShareToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function getShareUrl(token: string): string {
  const base =
    typeof window !== 'undefined' ? window.location.origin : 'https://regattaflow.com';
  return `${base}/p/step/${token}`;
}

export async function enableStepSharing(
  stepId: string,
): Promise<{ token: string; url: string }> {
  try {
    // Check if step already has a share token
    const { data: existing, error: fetchErr } = await supabase
      .from('timeline_steps')
      .select('share_token, share_enabled')
      .eq('id', stepId)
      .single();

    if (fetchErr) throw fetchErr;

    if (existing?.share_token && existing?.share_enabled) {
      return { token: existing.share_token, url: getShareUrl(existing.share_token) };
    }

    const token = existing?.share_token || generateShareToken();

    const { error } = await supabase
      .from('timeline_steps')
      .update({
        share_token: token,
        share_enabled: true,
        public_shared_at: new Date().toISOString(),
      })
      .eq('id', stepId);

    if (error) throw error;

    return { token, url: getShareUrl(token) };
  } catch (err) {
    logger.error('Failed to enable step sharing', err);
    throw err;
  }
}

export async function getStepShareInfo(
  stepId: string,
): Promise<{ share_enabled: boolean; share_token: string | null; url: string | null } | null> {
  try {
    const { data, error } = await supabase
      .from('timeline_steps')
      .select('share_enabled, share_token')
      .eq('id', stepId)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      share_enabled: data.share_enabled ?? false,
      share_token: data.share_token ?? null,
      url: data.share_token ? getShareUrl(data.share_token) : null,
    };
  } catch (err) {
    logger.error('Failed to get step share info', err);
    throw err;
  }
}

export async function adoptTemplate(
  userId: string,
  orgId: string,
  pathName: string,
  interestId: string,
): Promise<TimelineStepRecord[]> {
  try {
    logger.debug('Adopting template path', { userId, orgId, pathName });

    // Fetch the template steps for this path
    const { data: templates, error: fetchErr } = await supabase
      .from('timeline_step_templates')
      .select('*')
      .eq('organization_id', orgId)
      .eq('path_name', pathName)
      .order('sort_order', { ascending: true });

    if (fetchErr) throw fetchErr;
    if (!templates || templates.length === 0) throw new Error('Template path not found');

    // Get user's current max sort_order
    const { data: maxRow } = await supabase
      .from('timeline_steps')
      .select('sort_order')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    let nextSort = (maxRow?.sort_order ?? 0) + 1;

    const rows = (templates as any[]).map((t) => ({
      user_id: userId,
      interest_id: interestId,
      organization_id: orgId,
      source_type: 'template' as const,
      source_id: t.id,
      title: t.title,
      description: t.description,
      category: t.category ?? 'general',
      status: 'pending' as const,
      visibility: 'private' as const,
      sort_order: nextSort++,
      metadata: t.metadata ?? {},
    }));

    const { data, error } = await supabase
      .from('timeline_steps')
      .insert(rows)
      .select();

    if (error) throw error;
    return (data ?? []) as TimelineStepRecord[];
  } catch (err) {
    logger.error('Failed to adopt template', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Cross-interest step pins
// ---------------------------------------------------------------------------

export async function pinStepToInterest(
  stepId: string,
  userId: string,
  interestId: string,
): Promise<void> {
  const { error } = await supabase
    .from('timeline_step_pins')
    .upsert({ step_id: stepId, user_id: userId, interest_id: interestId }, {
      onConflict: 'step_id,user_id,interest_id',
    });
  if (error) throw error;
}

/**
 * Pin a step to multiple interests at once. Used by the inspiration flow
 * to auto-pin steps that overlap with user's existing interests.
 */
export async function bulkPinStepToInterests(
  stepId: string,
  userId: string,
  interestSlugs: string[],
): Promise<void> {
  if (interestSlugs.length === 0) return;

  // Resolve slugs to IDs
  const { data: interests, error: lookupError } = await supabase
    .from('interests')
    .select('id, slug')
    .in('slug', interestSlugs);

  if (lookupError || !interests?.length) return;

  // Upsert pins for each interest
  const rows = interests.map((i: { id: string }) => ({
    step_id: stepId,
    user_id: userId,
    interest_id: i.id,
  }));

  const { error } = await supabase
    .from('timeline_step_pins')
    .upsert(rows, { onConflict: 'step_id,user_id,interest_id' });

  if (error) {
    logger.warn('[TimelineStepService] bulkPinStepToInterests failed:', error.message);
  }
}

export async function unpinStepFromInterest(
  stepId: string,
  userId: string,
  interestId: string,
): Promise<void> {
  const { error } = await supabase
    .from('timeline_step_pins')
    .delete()
    .eq('step_id', stepId)
    .eq('user_id', userId)
    .eq('interest_id', interestId);
  if (error) throw error;
}

export async function getPinnedStepsForInterest(
  userId: string,
  interestId: string,
): Promise<TimelineStepRecord[]> {
  const { data: pins, error: pinErr } = await supabase
    .from('timeline_step_pins')
    .select('step_id')
    .eq('user_id', userId)
    .eq('interest_id', interestId);

  if (pinErr) {
    // Graceful degradation — table may not exist yet after migration
    logger.warn('[TimelineStepService] getPinnedStepsForInterest failed:', pinErr.message);
    return [];
  }
  if (!pins || pins.length === 0) return [];

  const { data: steps, error: stepErr } = await supabase
    .from('timeline_steps')
    .select('*')
    .in('id', pins.map((p) => p.step_id))
    .eq('user_id', userId);

  if (stepErr) {
    logger.warn('[TimelineStepService] Failed to fetch pinned steps:', stepErr.message);
    return [];
  }
  return (steps ?? []) as TimelineStepRecord[];
}

export async function getStepPinInterestIds(
  stepId: string,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('timeline_step_pins')
    .select('interest_id')
    .eq('step_id', stepId)
    .eq('user_id', userId);

  if (error) {
    logger.warn('[TimelineStepService] getStepPinInterestIds failed:', error.message);
    return [];
  }
  return (data ?? []).map((p) => p.interest_id);
}
