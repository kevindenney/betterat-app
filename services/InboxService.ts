/**
 * InboxService — the capture-first Inbox (BETTERAT_INBOX_SPEC.md).
 *
 * The Inbox is the universal "dump now, refine later" pile, stored in
 * `playbook_insights` (the table already modelled text/voice → concept; the
 * 20260628180000 migration generalized it with a `status` state machine, a
 * first-class `link` kind, and a polymorphic refined_to_{type,id} pair).
 *
 * This service owns the Inbox *surface*: dropping a link/note, listing what's
 * still unsorted, and the keep/archive triage. Graduating a capture into a
 * step/concept/resource/blueprint (the refine actions) lands in a follow-up.
 *
 * RLS gives the owner full CRUD on their own rows (user_id = auth.uid()), so
 * every call here is a direct table read/write — no RPC needed.
 */

import { supabase } from './supabase';
import { logger } from '@/lib/logger';
import type { InboxStatus, PlaybookInsightRecord } from './QuickCaptureService';

export interface DropLinkArgs {
  userId: string;
  interestId: string | null;
  /** The captured URL. Stored on source_url. */
  url: string;
  /** Optional one-line note. Stored on content (which is NOT NULL → ''). */
  note?: string | null;
}

export interface DropNoteArgs {
  userId: string;
  interestId: string | null;
  text: string;
}

/**
 * Capture a link into the Inbox. Lands unsorted (DB default) with kind='link'.
 * A bare URL with no note stores content='' — the spec's "paste and move on".
 */
export async function dropLink({
  userId,
  interestId,
  url,
  note,
}: DropLinkArgs): Promise<PlaybookInsightRecord> {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) throw new Error('Paste a link to capture.');

  const { data, error } = await supabase
    .from('playbook_insights')
    .insert({
      user_id: userId,
      interest_id: interestId,
      kind: 'link',
      source_url: trimmedUrl,
      content: note?.trim() ?? '',
    })
    .select('*')
    .single();

  if (error) {
    logger.error('Failed to drop link to inbox', error);
    throw error;
  }
  if (!data) throw new Error('Link capture returned no row');
  return data as PlaybookInsightRecord;
}

/**
 * Capture a plain text note into the Inbox. Lands unsorted with kind='text'.
 * Mirrors dropInsight but is part of the Inbox vocabulary (kept here so the
 * Inbox surface has one import for its writes).
 */
export async function dropNote({
  userId,
  interestId,
  text,
}: DropNoteArgs): Promise<PlaybookInsightRecord> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Write a note to capture.');

  const { data, error } = await supabase
    .from('playbook_insights')
    .insert({
      user_id: userId,
      interest_id: interestId,
      kind: 'text',
      content: trimmed,
    })
    .select('*')
    .single();

  if (error) {
    logger.error('Failed to drop note to inbox', error);
    throw error;
  }
  if (!data) throw new Error('Note capture returned no row');
  return data as PlaybookInsightRecord;
}

/**
 * List the viewer's unsorted Inbox, newest first. Scoped to one interest when
 * provided; otherwise spans all interests (the Inbox is cross-craft by design,
 * but the Library surface passes the active interest to keep it focused).
 */
export async function listInbox({
  userId,
  interestId,
  limit = 50,
}: {
  userId: string;
  interestId?: string | null;
  limit?: number;
}): Promise<PlaybookInsightRecord[]> {
  let query = supabase
    .from('playbook_insights')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'unsorted')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (interestId) query = query.eq('interest_id', interestId);

  const { data, error } = await query;
  if (error) {
    logger.error('Failed to list inbox', error);
    throw error;
  }
  return (data ?? []) as PlaybookInsightRecord[];
}

/**
 * Move a capture out of the unsorted pile. 'kept' = "I want this, leave it";
 * 'archived' = "not now". Both drop it off the unsorted list. Returns the id
 * so the caller can confirm a row actually changed (RLS no-op → zero rows).
 */
export async function setInboxStatus(
  insightId: string,
  status: InboxStatus,
): Promise<void> {
  const { data, error } = await supabase
    .from('playbook_insights')
    .update({ status })
    .eq('id', insightId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Inbox item not found.');
}

export const keepInsight = (insightId: string) =>
  setInboxStatus(insightId, 'kept');

export const archiveInsight = (insightId: string) =>
  setInboxStatus(insightId, 'archived');
