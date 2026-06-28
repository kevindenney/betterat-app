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
import { createConcept, getOrCreatePlaybook } from './PlaybookService';
import { createStep } from './TimelineStepService';
import type { InboxStatus, PlaybookInsightRecord } from './QuickCaptureService';
import type { PlaybookConceptRecord } from '@/types/playbook';
import type { TimelineStepRecord } from '@/types/timeline-steps';

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

// ---------------------------------------------------------------------------
// Refine — graduate a capture into a real primitive (step / concept).
//
// Each refine creates the target, then stamps the insight refined: status
// flips to 'refined' and the polymorphic refined_to_{type,id} pair points at
// the new row. That removes the capture from the unsorted list (listInbox
// filters status='unsorted') without deleting it, so the trail back to the
// original dump survives.
// ---------------------------------------------------------------------------

function hostOf(url: string): string {
  try {
    const u = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** A short, human title for a capture — link title/host, or the note's first line. */
function titleForInsight(insight: PlaybookInsightRecord, fallback: string): string {
  if (insight.kind === 'link' && insight.source_url) {
    return (insight.title?.trim() || hostOf(insight.source_url)).slice(0, 80);
  }
  const content = String(insight.content ?? '').trim();
  const firstLine = content.split(/[.!?\n]/)[0]?.trim();
  return (firstLine || content).slice(0, 80) || fallback;
}

/** A slug from a title, mirroring PlaybookService's buildConceptSlug shape. */
function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || `concept-${Date.now().toString(36).slice(-4)}`;
}

async function stampRefined(
  insightId: string,
  type: 'step' | 'concept' | 'resource' | 'blueprint',
  targetId: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const { data, error } = await supabase
    .from('playbook_insights')
    .update({ status: 'refined', refined_to_type: type, refined_to_id: targetId, ...extra })
    .eq('id', insightId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Inbox item not found.');
}

/**
 * Graduate a capture into a timeline step. The link/note becomes the step's
 * title; a captured link is preserved in the description so the source
 * survives. Step lands via the create_timeline_step RPC (visibility cascade +
 * sort_order server-side), then the insight is stamped refined→step.
 */
export async function refineToStep({
  insight,
  userId,
  interestId,
}: {
  insight: PlaybookInsightRecord;
  userId: string;
  interestId: string;
}): Promise<TimelineStepRecord> {
  const title = titleForInsight(insight, 'Untitled step');
  const note = String(insight.content ?? '').trim();
  const descriptionParts = [
    insight.kind === 'link' && insight.source_url ? insight.source_url : null,
    insight.kind === 'link' ? (note || null) : null,
  ].filter(Boolean) as string[];

  const step = await createStep({
    user_id: userId,
    interest_id: interestId,
    source_type: 'manual',
    title,
    description: descriptionParts.length ? descriptionParts.join('\n\n') : null,
  });

  try {
    await stampRefined(insight.id, 'step', step.id);
  } catch (err) {
    logger.error('Step created but failed to stamp insight refined', err);
    throw err;
  }
  return step;
}

/**
 * Graduate a capture into a playbook concept. Resolves (or creates) the user's
 * playbook for the interest, mints a forming concept seeded with the capture's
 * text, then stamps the insight refined→concept (also setting the legacy
 * refined_to_concept_id so older concept-link reads keep working).
 */
export async function refineToConcept({
  insight,
  userId,
  interestId,
}: {
  insight: PlaybookInsightRecord;
  userId: string;
  interestId: string;
}): Promise<PlaybookConceptRecord> {
  const playbook = await getOrCreatePlaybook(userId, interestId);
  const title = titleForInsight(insight, 'Untitled concept');
  const note = String(insight.content ?? '').trim();
  const bodyParts = [
    note || null,
    insight.kind === 'link' && insight.source_url ? insight.source_url : null,
  ].filter(Boolean) as string[];
  const body = bodyParts.join('\n\n');

  const concept = await createConcept(userId, {
    playbook_id: playbook.id,
    origin: 'personal',
    interest_id: interestId,
    slug: slugify(title),
    title,
    body_md: body,
    body,
    state: 'forming',
  });

  try {
    await stampRefined(insight.id, 'concept', concept.id, {
      refined_to_concept_id: concept.id,
    });
  } catch (err) {
    logger.error('Concept created but failed to stamp insight refined', err);
    throw err;
  }
  return concept;
}
