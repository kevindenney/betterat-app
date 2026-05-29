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
import type { StepLocation, StepPlanData, SubStep } from '@/types/step-detail';

export type QuickCaptureKind = 'text' | 'voice';

export interface QuickCapturePayload {
  kind: QuickCaptureKind;
  /** The WHAT — becomes the step title. Optional fields below are separate. */
  content: string;
  audioUri?: string;
  /** Structured place from the composer's WHERE picker, when set. */
  location?: StepLocation;
  /** Optional WHY — maps to plan.why_reasoning. */
  why?: string;
  /** Optional HOW — newline-split into plan.how_sub_steps. */
  how?: string;
  /** Optional WHEN — free text, stored as the step description. */
  when?: string;
}

/**
 * Maps a QuickCapturePayload to the structured columns + plan schema a step
 * expects. Shared by createDraftStep and the optimistic step in
 * UniversalPlusProvider so the two never drift on field placement.
 *
 * Title = WHAT only. Why/How/Where land in metadata.plan; When in description.
 */
export interface QuickCaptureStepFields {
  title: string;
  description: string | null;
  locationName: string | null;
  locationLat: number | null;
  locationLng: number | null;
  plan: StepPlanData | null;
}

function splitSubSteps(how: string): SubStep[] {
  const base = Date.now();
  return how
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: `sub-${base}-${index}`,
      text,
      sort_order: index,
      completed: false,
    }));
}

export function buildQuickCaptureStepFields(
  payload: QuickCapturePayload,
): QuickCaptureStepFields {
  const title = payload.content.trim();
  const why = payload.why?.trim();
  const how = payload.how?.trim();
  const when = payload.when?.trim();
  const location = payload.location;
  const hasLocationName = Boolean(location?.name?.trim());

  const plan: StepPlanData = {};
  if (title) plan.what_will_you_do = title;
  if (why) plan.why_reasoning = why;
  if (how) plan.how_sub_steps = splitSubSteps(how);
  if (hasLocationName) {
    plan.where_location = { ...location!, name: location!.name.trim() };
  }

  return {
    title,
    description: when || null,
    locationName: hasLocationName ? location!.name.trim() : null,
    locationLat: location?.lat ?? null,
    locationLng: location?.lng ?? null,
    plan: Object.keys(plan).length > 0 ? plan : null,
  };
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

// New captures append to the end of the sequence. Inserting them right
// after the current step (the old behavior) wedged fresh steps into the
// middle of the timeline, which read as misplacement on this
// sequence-first surface. "Unscheduled" (starts_at null) keeps the step
// ordered purely by sort_order rather than pinned to today's date bucket.
async function resolveQuickCapturePlacement(userId: string, interestId: string) {
  const steps = await getOrderedTimelineSteps(userId, interestId);
  return {
    sortOrder: (steps.at(-1)?.sort_order ?? 0) + 1,
    startsAt: null as string | null,
  };
}

export async function createDraftStep({
  userId,
  interestId,
  payload,
}: CreateDraftStepArgs): Promise<TimelineStepRecord> {
  const fields = buildQuickCaptureStepFields(payload);
  if (!fields.title) {
    throw new Error('Quick-capture content is empty.');
  }

  const placement = await resolveQuickCapturePlacement(userId, interestId);

  return createStep({
    user_id: userId,
    interest_id: interestId,
    title: fields.title,
    description: fields.description,
    status: 'pending',
    starts_at: placement.startsAt,
    sort_order: placement.sortOrder,
    visibility: 'private',
    // Denormalized columns power Atlas pins + map feeds; the RPC reads
    // these straight off p_input.
    location_name: fields.locationName,
    location_lat: fields.locationLat,
    location_lng: fields.locationLng,
    metadata: {
      draft: true,
      capture_source: 'universal_plus_sheet',
      capture_kind: payload.kind,
      audio_uri: payload.audioUri ?? null,
      // Canonical source the Plan tab + timeline adapter read for WHAT/WHY/HOW/WHERE.
      ...(fields.plan ? { plan: fields.plan } : {}),
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
