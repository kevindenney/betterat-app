/**
 * LibraryService — CRUD for user libraries and resources.
 *
 * DEPRECATED: Phase 1 of the Playbook migration renamed `user_libraries` →
 * `playbooks` and `library_resources` → `playbook_resources` (with
 * `library_id` → `playbook_id`). This file stays as a thin compat shim so the
 * `components/library-resources/*` UI keeps working unchanged; Phase 10 deletes it in
 * favor of PlaybookService + ported UI.
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import type {
  LibraryRecord,
  LibraryResourceRecord,
  CreateLibraryResourceInput,
  UpdateLibraryResourceInput,
  ResourceType,
  CourseMetadata,
  CourseProgress,
} from '@/types/library';

const logger = createLogger('LibraryService');

// ---------------------------------------------------------------------------
// 1. Get or auto-create user library for an interest
// ---------------------------------------------------------------------------

export async function getUserLibrary(
  userId: string,
  interestId: string,
): Promise<LibraryRecord> {
  if (!userId?.trim() || !interestId?.trim()) {
    throw new Error('getUserLibrary requires valid userId and interestId');
  }

  try {
    // Try to find existing library
    const { data: existing, error: fetchErr } = await supabase
      .from('playbooks')
      .select('*')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .maybeSingle();

    if (fetchErr) {
      // Table may not exist yet — surface a clear message instead of cryptic 400
      if (fetchErr.code === '42P01' || fetchErr.message?.includes('relation')) {
        logger.warn('playbooks table not found — migration may not be applied');
        throw new Error('Library system not yet available');
      }
      throw fetchErr;
    }
    if (existing) return existing as LibraryRecord;

    // Auto-create
    const { data: created, error: createErr } = await supabase
      .from('playbooks')
      .insert({ user_id: userId, interest_id: interestId, name: 'My Playbook' })
      .select()
      .single();

    if (createErr) throw createErr;
    return created as LibraryRecord;
  } catch (err) {
    logger.error('Failed to get/create user library', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 2. List resources in a library
// ---------------------------------------------------------------------------

export async function getResources(
  libraryId: string,
  filters?: { resourceType?: ResourceType },
): Promise<LibraryResourceRecord[]> {
  try {
    let query = supabase
      .from('playbook_resources')
      .select('*')
      .eq('playbook_id', libraryId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (filters?.resourceType) {
      query = query.eq('resource_type', filters.resourceType);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as LibraryResourceRecord[];
  } catch (err) {
    logger.error('Failed to fetch library resources', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 3. Add a resource
// ---------------------------------------------------------------------------

export async function addResource(
  userId: string,
  input: CreateLibraryResourceInput,
): Promise<LibraryResourceRecord> {
  try {
    const { data, error } = await supabase
      .from('playbook_resources')
      .insert({
        playbook_id: input.library_id,
        user_id: userId,
        title: input.title,
        url: input.url ?? null,
        resource_type: input.resource_type ?? 'other',
        source_platform: input.source_platform ?? null,
        author_or_creator: input.author_or_creator ?? null,
        description: input.description ?? null,
        thumbnail_url: input.thumbnail_url ?? null,
        capability_goals: input.capability_goals ?? [],
        tags: input.tags ?? [],
        sort_order: input.sort_order ?? 0,
        metadata: input.metadata ?? {},
      })
      .select()
      .single();

    if (error) throw error;
    return data as LibraryResourceRecord;
  } catch (err) {
    logger.error('Failed to add library resource', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 4. Update a resource
// ---------------------------------------------------------------------------

export async function updateResource(
  resourceId: string,
  input: UpdateLibraryResourceInput,
): Promise<LibraryResourceRecord> {
  try {
    const { data, error } = await supabase
      .from('playbook_resources')
      .update(input)
      .eq('id', resourceId)
      .select()
      .single();

    if (error) throw error;
    return data as LibraryResourceRecord;
  } catch (err) {
    logger.error('Failed to update library resource', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 5. Delete a resource
// ---------------------------------------------------------------------------

export async function deleteResource(resourceId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('playbook_resources')
      .delete()
      .eq('id', resourceId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Library resource not found.');
  } catch (err) {
    logger.error('Failed to delete library resource', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 6. Get resources by IDs (for loading linked resources from a step)
// ---------------------------------------------------------------------------

export async function getResourcesByIds(
  ids: string[],
): Promise<LibraryResourceRecord[]> {
  if (ids.length === 0) return [];
  try {
    const { data, error } = await supabase
      .from('playbook_resources')
      .select('*')
      .in('id', ids);

    if (error) throw error;
    return (data ?? []) as LibraryResourceRecord[];
  } catch (err) {
    logger.error('Failed to fetch resources by IDs', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 7. Mark a course lesson as completed (progress tracking)
// ---------------------------------------------------------------------------

export async function markLessonCompleted(
  resourceId: string,
  lessonId: string,
): Promise<LibraryResourceRecord> {
  try {
    const { data: resource, error: fetchErr } = await supabase
      .from('playbook_resources')
      .select('metadata')
      .eq('id', resourceId)
      .single();

    if (fetchErr) throw fetchErr;

    const meta = (resource?.metadata ?? {}) as CourseMetadata & Record<string, unknown>;
    const progress: CourseProgress = meta.progress ?? { completed_lesson_ids: [] };
    if (!progress.completed_lesson_ids.includes(lessonId)) {
      progress.completed_lesson_ids.push(lessonId);
    }
    progress.last_completed_at = new Date().toISOString();

    const updatedMeta = { ...meta, progress };

    const { data, error } = await supabase
      .from('playbook_resources')
      .update({ metadata: updatedMeta })
      .eq('id', resourceId)
      .select()
      .single();

    if (error) throw error;
    return data as LibraryResourceRecord;
  } catch (err) {
    logger.error('Failed to mark lesson completed', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 8. Unmark a course lesson (toggle off)
// ---------------------------------------------------------------------------

export async function unmarkLessonCompleted(
  resourceId: string,
  lessonId: string,
): Promise<LibraryResourceRecord> {
  try {
    const { data: resource, error: fetchErr } = await supabase
      .from('playbook_resources')
      .select('metadata')
      .eq('id', resourceId)
      .single();

    if (fetchErr) throw fetchErr;

    const meta = (resource?.metadata ?? {}) as CourseMetadata & Record<string, unknown>;
    const progress: CourseProgress = meta.progress ?? { completed_lesson_ids: [] };
    progress.completed_lesson_ids = progress.completed_lesson_ids.filter(
      (id) => id !== lessonId,
    );

    const updatedMeta = { ...meta, progress };

    const { data, error } = await supabase
      .from('playbook_resources')
      .update({ metadata: updatedMeta })
      .eq('id', resourceId)
      .select()
      .single();

    if (error) throw error;
    return data as LibraryResourceRecord;
  } catch (err) {
    logger.error('Failed to unmark lesson', err);
    throw err;
  }
}
