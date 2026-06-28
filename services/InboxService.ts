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
import { fetchUrlMetadata } from './UrlMetadataService';
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
 * Backfill a captured link's title from its Open Graph metadata. Fire-and-forget
 * after dropLink: capture stays instant (the row lands with no title and the
 * row renders the bare host), then this swaps in the real page title once the
 * extract-url-metadata edge function returns. Only writes when title is still
 * null, so it never clobbers a title the user typed. Returns the title it set,
 * or null when there was nothing to set.
 */
export async function enrichLinkTitle(
  insightId: string,
  url: string,
): Promise<string | null> {
  const meta = await fetchUrlMetadata(url);
  const title = meta?.title?.trim();
  if (!title) return null;

  const { data, error } = await supabase
    .from('playbook_insights')
    .update({ title })
    .eq('id', insightId)
    .is('title', null)
    .select('id')
    .maybeSingle();
  if (error) {
    logger.error('Failed to backfill inbox link title', error);
    return null;
  }
  return data ? title : null;
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
 * Count the viewer's unsorted captures across all interests. Drives the Library
 * tab badge ("you have stuff to triage") — head-only count, no rows fetched.
 */
export async function countUnsortedInbox(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('playbook_insights')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'unsorted');
  if (error) {
    logger.error('Failed to count unsorted inbox', error);
    return 0;
  }
  return count ?? 0;
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
  title: titleInput,
  description,
}: {
  insight: PlaybookInsightRecord;
  userId: string;
  interestId: string;
  title?: string | null;
  description?: string | null;
}): Promise<TimelineStepRecord> {
  const title = titleInput?.trim() || titleForInsight(insight, 'Untitled step');
  const note = String(insight.content ?? '').trim();
  const trimmedDescription = description?.trim();
  const descriptionParts = [
    trimmedDescription || null,
    insight.kind === 'link' && !trimmedDescription ? (note || null) : null,
    insight.kind === 'link' && insight.source_url ? `Source: ${insight.source_url}` : null,
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
 * Stamp a capture as graduated into a blueprint. The blueprint itself is built
 * by the Get Inspired wizard (interest + steps + calendar), which already
 * persists the source; this only records the lineage on the insight so it
 * leaves the unsorted pile. Caller passes the blueprintId the wizard returned.
 */
export async function refineToBlueprint({
  insight,
  blueprintId,
}: {
  insight: PlaybookInsightRecord;
  blueprintId: string;
}): Promise<void> {
  await stampRefined(insight.id, 'blueprint', blueprintId);
}

/**
 * Graduate a captured link into a Library resource. Link-only: a `library_items`
 * row has no body column, so a plain note would lose its text — those graduate to
 * a step or concept instead. Creates the item (kind='link', host as source label),
 * tags it to the interest via library_item_interests, then stamps refined→resource.
 */
export async function refineToResource({
  insight,
  userId,
  interestId,
  title: titleInput,
}: {
  insight: PlaybookInsightRecord;
  userId: string;
  interestId: string;
  title?: string | null;
}): Promise<{ id: string }> {
  if (insight.kind !== 'link' || !insight.source_url) {
    throw new Error('Only a captured link can become a resource.');
  }
  const title = titleInput?.trim() || titleForInsight(insight, 'Untitled resource');

  const { data: item, error: itemError } = await supabase
    .from('library_items')
    .insert({
      user_id: userId,
      kind: 'link',
      title,
      source_label: hostOf(insight.source_url),
      url_or_blob_id: insight.source_url,
      interest_id: interestId,
    })
    .select('id')
    .single();
  if (itemError) {
    logger.error('Failed to create library item from inbox link', itemError);
    throw itemError;
  }
  if (!item) throw new Error('Resource creation returned no row');

  const { error: tagError } = await supabase
    .from('library_item_interests')
    .insert({ item_id: item.id, interest_id: interestId });
  if (tagError) {
    logger.error('Resource created but failed to tag interest', tagError);
    throw tagError;
  }

  try {
    await stampRefined(insight.id, 'resource', item.id);
  } catch (err) {
    logger.error('Resource created but failed to stamp insight refined', err);
    throw err;
  }
  return { id: item.id };
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
  title: titleInput,
  body: bodyInput,
}: {
  insight: PlaybookInsightRecord;
  userId: string;
  interestId: string;
  title?: string | null;
  body?: string | null;
}): Promise<PlaybookConceptRecord> {
  const playbook = await getOrCreatePlaybook(userId, interestId);
  const title = titleInput?.trim() || titleForInsight(insight, 'Untitled concept');
  const note = String(insight.content ?? '').trim();
  const bodyParts = [
    note || null,
    insight.kind === 'link' && insight.source_url ? insight.source_url : null,
  ].filter(Boolean) as string[];
  const body = bodyInput?.trim() || bodyParts.join('\n\n');

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
