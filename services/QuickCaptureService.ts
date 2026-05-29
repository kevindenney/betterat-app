/**
 * QuickCaptureService — Phase 2 universal `+` sheet.
 *
 * Encapsulates the three write paths exposed by the sheet:
 *   1. createDraftStep(...)  → timeline_steps row (status='pending', metadata.draft=true)
 *   2. dropInsight(...)      → playbook_insights row (raw inbox for Phase 6 refinement)
 *   3. (voice transcription is handled in QuickCaptureComposer via VoiceNoteService)
 *
 * No UI here. Callers (the composer + sheet's secondary rows) invoke these and
 * surface their own toasts. Errors bubble; the sheet catches them and shows
 * a toast.
 */

import { supabase } from './supabase';
import { logger } from '@/lib/logger';
import { createStep } from './TimelineStepService';
import type { TimelineStepRecord } from '@/types/timeline-steps';
import type { StepLocation } from '@/types/step-detail';

export type QuickCaptureKind = 'text' | 'voice';

export interface QuickCapturePayload {
  kind: QuickCaptureKind;
  content: string;
  audioUri?: string;
  /** Structured place from the composer's WHERE picker, when set. */
  location?: StepLocation;
}

export interface CreateDraftStepArgs {
  userId: string;
  interestId: string;
  payload: QuickCapturePayload;
}

async function getOrderedTimelineSteps(
  userId: string,
  interestId: string,
): Promise<TimelineStepRecord[]> {
  const { data, error } = await supabase
    .from('timeline_steps')
    .select('*')
    .eq('user_id', userId)
    .eq('interest_id', interestId)
    .in('status', ['pending', 'in_progress', 'completed', 'settled'])
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('Failed to load ordered timeline steps for quick capture', error);
    throw error;
  }

  return (data ?? []) as TimelineStepRecord[];
}

async function shiftTimelineSortOrdersAfter(
  userId: string,
  interestId: string,
  afterSortOrder: number,
): Promise<void> {
  const { data, error } = await supabase
    .from('timeline_steps')
    .select('id, sort_order')
    .eq('user_id', userId)
    .eq('interest_id', interestId)
    .gt('sort_order', afterSortOrder)
    .order('sort_order', { ascending: false });

  if (error) {
    logger.error('Failed shifting quick-capture sort orders', error);
    throw error;
  }

  for (const row of (data ?? []) as Pick<TimelineStepRecord, 'id' | 'sort_order'>[]) {
    const { error: updateError } = await supabase
      .from('timeline_steps')
      .update({ sort_order: row.sort_order + 1 })
      .eq('id', row.id);
    if (updateError) {
      logger.error('Failed updating quick-capture sort order row', updateError);
      throw updateError;
    }
  }
}

async function resolveQuickCapturePlacement(userId: string, interestId: string) {
  const steps = await getOrderedTimelineSteps(userId, interestId);
  const currentStep =
    steps.find((step) => step.status === 'in_progress') ??
    steps.find((step) => step.status === 'pending') ??
    null;

  if (!currentStep) {
    return {
      sortOrder: (steps.at(-1)?.sort_order ?? 0) + 1,
      startsAt: null as string | null,
    };
  }

  await shiftTimelineSortOrdersAfter(userId, interestId, currentStep.sort_order);
  return {
    sortOrder: currentStep.sort_order + 1,
    startsAt: null as string | null,
  };
}

export async function createDraftStep({
  userId,
  interestId,
  payload,
}: CreateDraftStepArgs): Promise<TimelineStepRecord> {
  const trimmed = payload.content.trim();
  if (!trimmed) {
    throw new Error('Quick-capture content is empty.');
  }

  const placement = await resolveQuickCapturePlacement(userId, interestId);

  const location = payload.location;
  const hasLocationName = Boolean(location?.name?.trim());

  return createStep({
    user_id: userId,
    interest_id: interestId,
    title: trimmed,
    status: 'pending',
    starts_at: placement.startsAt,
    sort_order: placement.sortOrder,
    visibility: 'private',
    // Denormalized columns power Atlas pins + map feeds; the RPC reads
    // these straight off p_input.
    location_name: hasLocationName ? location!.name.trim() : null,
    location_lat: location?.lat ?? null,
    location_lng: location?.lng ?? null,
    metadata: {
      draft: true,
      capture_source: 'universal_plus_sheet',
      capture_kind: payload.kind,
      audio_uri: payload.audioUri ?? null,
      // Canonical source the Plan tab + timeline adapter read for WHERE.
      ...(hasLocationName ? { plan: { where_location: location } } : {}),
    },
  });
}

export interface DropInsightArgs {
  userId: string;
  interestId: string | null;
  payload: QuickCapturePayload;
}

export interface PlaybookInsightRecord {
  id: string;
  user_id: string;
  interest_id: string | null;
  kind: QuickCaptureKind;
  content: string;
  audio_uri: string | null;
  refined_to_concept_id: string | null;
  created_at: string;
}

export async function dropInsight({
  userId,
  interestId,
  payload,
}: DropInsightArgs): Promise<PlaybookInsightRecord> {
  const trimmed = payload.content.trim();
  if (!trimmed) {
    throw new Error('Insight content is empty.');
  }

  const { data, error } = await supabase
    .from('playbook_insights')
    .insert({
      user_id: userId,
      interest_id: interestId,
      kind: payload.kind,
      content: trimmed,
      audio_uri: payload.audioUri ?? null,
    })
    .select('*')
    .single();

  if (error) {
    logger.error('Failed to drop insight to playbook_insights', error);
    throw error;
  }
  if (!data) throw new Error('Insight insert returned no row');

  return data as PlaybookInsightRecord;
}

export async function listRecentDrafts({
  userId,
  interestId,
  limit = 5,
}: {
  userId: string;
  interestId: string;
  limit?: number;
}): Promise<TimelineStepRecord[]> {
  const { data, error } = await supabase
    .from('timeline_steps')
    .select('*')
    .eq('user_id', userId)
    .eq('interest_id', interestId)
    .eq('status', 'pending')
    .contains('metadata', { draft: true })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to list draft timeline steps', error);
    throw error;
  }
  return (data ?? []) as TimelineStepRecord[];
}
