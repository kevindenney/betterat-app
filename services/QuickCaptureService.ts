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

export type QuickCaptureKind = 'text' | 'voice';

export interface QuickCapturePayload {
  kind: QuickCaptureKind;
  content: string;
  audioUri?: string;
}

export interface CreateDraftStepArgs {
  userId: string;
  interestId: string;
  payload: QuickCapturePayload;
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

  return createStep({
    user_id: userId,
    interest_id: interestId,
    title: trimmed,
    status: 'pending',
    visibility: 'private',
    metadata: {
      draft: true,
      capture_source: 'universal_plus_sheet',
      capture_kind: payload.kind,
      audio_uri: payload.audioUri ?? null,
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
