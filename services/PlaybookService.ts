/**
 * PlaybookService — CRUD for the BetterAt Playbook system.
 *
 * Replaces LibraryService in the post-rename schema (user_libraries → playbooks,
 * library_resources → playbook_resources) and exposes read/list helpers for the
 * new Playbook tables: concepts, patterns, reviews, qa, suggestions, inbox,
 * shares, and typed step↔playbook links.
 *
 * See `supabase/migrations/20260405000000_playbook_system.sql` for schema.
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { isPersistedRaceId } from '@/lib/races/isPersistedRaceId';
import type {
  PlaybookRecord,
  PlaybookResourceRecord,
  PlaybookConceptRecord,
  PlaybookConceptLifecycleState,
  PlaybookPatternRecord,
  PlaybookReviewRecord,
  PlaybookQARecord,
  PlaybookSuggestionRecord,
  PlaybookInboxItemRecord,
  PlaybookShareRecord,
  StepPlaybookLinkRecord,
  StepConceptLinkRecord,
  PlaybookInsightRecord,
  ConceptTrailQuoteRecord,
  CreatePlaybookResourceInput,
  UpdatePlaybookResourceInput,
  CreatePlaybookConceptInput,
  UpdatePlaybookConceptInput,
  CreatePlaybookInboxItemInput,
  CreatePlaybookShareInput,
  ResourceType,
  SuggestionStatus,
} from '@/types/playbook';

const logger = createLogger('PlaybookService');

// ---------------------------------------------------------------------------
// 1. Get or auto-create a playbook for (user, interest)
// ---------------------------------------------------------------------------

export async function getOrCreatePlaybook(
  userId: string,
  interestId: string,
): Promise<PlaybookRecord> {
  if (!userId?.trim() || !interestId?.trim()) {
    throw new Error('getOrCreatePlaybook requires valid userId and interestId');
  }

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('playbooks')
      .select('*')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .maybeSingle();

    if (fetchErr) {
      if (fetchErr.code === '42P01' || fetchErr.message?.includes('relation')) {
        logger.warn('playbooks table not found — migration may not be applied');
        throw new Error('Playbook system not yet available');
      }
      throw fetchErr;
    }
    if (existing) return existing as PlaybookRecord;

    // Use upsert with the unique constraint to handle race conditions
    // (e.g. two concurrent calls both find no existing row)
    const { data: created, error: createErr } = await supabase
      .from('playbooks')
      .upsert(
        { user_id: userId, interest_id: interestId, name: 'My Playbook' },
        { onConflict: 'user_id,interest_id', ignoreDuplicates: true },
      )
      .select()
      .single();

    if (createErr) {
      // If upsert still fails (e.g. ignoreDuplicates returns no rows),
      // re-fetch — the row must exist from a concurrent insert
      const { data: refetched } = await supabase
        .from('playbooks')
        .select('*')
        .eq('user_id', userId)
        .eq('interest_id', interestId)
        .maybeSingle();
      if (refetched) return refetched as PlaybookRecord;
      throw createErr;
    }
    return created as PlaybookRecord;
  } catch (err) {
    logger.error('Failed to get/create playbook', err);
    throw err;
  }
}

/**
 * Fetch a playbook by id. Used by the shared read-only coach view; RLS
 * grants SELECT to accepted invitees via the shared-read policy.
 */
export async function getPlaybookById(
  playbookId: string,
): Promise<PlaybookRecord | null> {
  try {
    const { data, error } = await supabase
      .from('playbooks')
      .select('*')
      .eq('id', playbookId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as PlaybookRecord | null;
  } catch (err) {
    logger.error('Failed to fetch playbook by id', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 2. Resources — CRUD (ported from LibraryService)
// ---------------------------------------------------------------------------

export async function getResources(
  playbookId: string,
  filters?: { resourceType?: ResourceType },
): Promise<PlaybookResourceRecord[]> {
  try {
    let query = supabase
      .from('playbook_resources')
      .select('*')
      .eq('playbook_id', playbookId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (filters?.resourceType) {
      query = query.eq('resource_type', filters.resourceType);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as PlaybookResourceRecord[];
  } catch (err) {
    logger.error('Failed to fetch playbook resources', err);
    throw err;
  }
}

export async function addResource(
  userId: string,
  input: CreatePlaybookResourceInput,
): Promise<PlaybookResourceRecord> {
  try {
    const { data, error } = await supabase
      .from('playbook_resources')
      .insert({
        playbook_id: input.playbook_id,
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
    return data as PlaybookResourceRecord;
  } catch (err) {
    logger.error('Failed to add playbook resource', err);
    throw err;
  }
}

export async function updateResource(
  resourceId: string,
  input: UpdatePlaybookResourceInput,
): Promise<PlaybookResourceRecord> {
  try {
    const { data, error } = await supabase
      .from('playbook_resources')
      .update(input)
      .eq('id', resourceId)
      .select()
      .single();

    if (error) throw error;
    return data as PlaybookResourceRecord;
  } catch (err) {
    logger.error('Failed to update playbook resource', err);
    throw err;
  }
}

export async function deleteResource(resourceId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('playbook_resources')
      .delete()
      .eq('id', resourceId);

    if (error) throw error;
  } catch (err) {
    logger.error('Failed to delete playbook resource', err);
    throw err;
  }
}

export async function getResourcesByIds(
  ids: string[],
): Promise<PlaybookResourceRecord[]> {
  if (ids.length === 0) return [];
  try {
    const { data, error } = await supabase
      .from('playbook_resources')
      .select('*')
      .in('id', ids);

    if (error) throw error;
    return (data ?? []) as PlaybookResourceRecord[];
  } catch (err) {
    logger.error('Failed to fetch resources by ids', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 3. Concepts — list + inherited baselines
// ---------------------------------------------------------------------------

/**
 * List concepts visible to this playbook: personal/forked rows owned by this
 * playbook PLUS baseline rows (playbook_id IS NULL) for the same interest.
 */
export async function getConcepts(
  playbookId: string,
  interestId: string,
): Promise<PlaybookConceptRecord[]> {
  try {
    const { data, error } = await supabase
      .from('playbook_concepts')
      .select('*')
      .or(`playbook_id.eq.${playbookId},and(playbook_id.is.null,interest_id.eq.${interestId})`)
      .order('title', { ascending: true });

    if (error) throw error;
    return (data ?? []) as PlaybookConceptRecord[];
  } catch (err) {
    logger.error('Failed to fetch concepts', err);
    throw err;
  }
}

export async function getConceptBySlug(
  playbookId: string,
  interestId: string,
  slug: string,
): Promise<PlaybookConceptRecord | null> {
  try {
    const { data, error } = await supabase
      .from('playbook_concepts')
      .select('*')
      .or(`playbook_id.eq.${playbookId},and(playbook_id.is.null,interest_id.eq.${interestId})`)
      .eq('slug', slug)
      .order('playbook_id', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as PlaybookConceptRecord | null;
  } catch (err) {
    logger.error('Failed to fetch concept by slug', err);
    throw err;
  }
}

export async function getConceptById(
  conceptId: string,
): Promise<PlaybookConceptRecord | null> {
  try {
    const { data, error } = await supabase
      .from('playbook_concepts')
      .select('*')
      .eq('id', conceptId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as PlaybookConceptRecord | null;
  } catch (err) {
    logger.error('Failed to fetch concept by id', err);
    throw err;
  }
}

export async function createConcept(
  userId: string,
  input: CreatePlaybookConceptInput,
): Promise<PlaybookConceptRecord> {
  try {
    let slug = input.slug;
    const row = {
      playbook_id: input.playbook_id,
      user_id: userId,
      origin: input.origin,
      source_concept_id: input.source_concept_id ?? null,
      interest_id: input.interest_id,
      pathway_id: input.pathway_id ?? null,
      slug,
      title: input.title,
      body_md: input.body_md ?? '',
      body: input.body ?? input.body_md ?? '',
      state: input.state ?? 'forming',
      updated_by: userId,
    };
    const { data, error } = await supabase
      .from('playbook_concepts')
      .insert(row)
      .select()
      .single();
    // If slug collides, append a short suffix and retry once.
    if (error && error.code === '23505' && error.message?.includes('slug')) {
      slug = `${input.slug}-${Date.now().toString(36).slice(-4)}`;
      const { data: retry, error: retryErr } = await supabase
        .from('playbook_concepts')
        .insert({ ...row, slug })
        .select()
        .single();
      if (retryErr) throw retryErr;
      return retry as PlaybookConceptRecord;
    }
    if (error) throw error;
    return data as PlaybookConceptRecord;
  } catch (err) {
    logger.error('Failed to create concept', err);
    throw err;
  }
}

export async function updateConcept(
  userId: string,
  conceptId: string,
  input: UpdatePlaybookConceptInput,
): Promise<PlaybookConceptRecord> {
  try {
    const { data, error } = await supabase
      .from('playbook_concepts')
      .update({ ...input, updated_by: userId })
      .eq('id', conceptId)
      .select()
      .single();
    if (error) throw error;
    return data as PlaybookConceptRecord;
  } catch (err) {
    logger.error('Failed to update concept', err);
    throw err;
  }
}

export async function deleteConcept(conceptId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('playbook_concepts')
      .delete()
      .eq('id', conceptId);
    if (error) throw error;
  } catch (err) {
    logger.error('Failed to delete concept', err);
    throw err;
  }
}

/**
 * Fork a baseline concept into this playbook. Clones title/body_md/slug with
 * `origin='forked'` and `source_concept_id` pointing at the original. Safe to
 * call when the baseline body has diverged — we still take a snapshot at fork
 * time, so personal edits on the clone will not be clobbered by upstream
 * changes. Pulling latest is a separate explicit action.
 */
export async function forkConcept(
  userId: string,
  playbookId: string,
  sourceConceptId: string,
): Promise<PlaybookConceptRecord> {
  try {
    const source = await getConceptById(sourceConceptId);
    if (!source) throw new Error('Source concept not found');
    if (source.origin !== 'platform_baseline' && source.origin !== 'pathway_baseline') {
      throw new Error('Only baseline concepts can be forked');
    }
    return await createConcept(userId, {
      playbook_id: playbookId,
      origin: 'forked',
      source_concept_id: source.id,
      interest_id: source.interest_id,
      pathway_id: source.pathway_id,
      slug: source.slug,
      title: source.title,
      body_md: source.body_md,
    });
  } catch (err) {
    logger.error('Failed to fork concept', err);
    throw err;
  }
}

/**
 * Pull the latest body from the upstream source concept. Overwrites the
 * current body_md with the upstream version. Callers should only invoke this
 * after showing the user a three-way diff and confirming.
 */
export async function pullLatestConcept(
  userId: string,
  conceptId: string,
): Promise<PlaybookConceptRecord> {
  try {
    const current = await getConceptById(conceptId);
    if (!current) throw new Error('Concept not found');
    if (!current.source_concept_id) {
      throw new Error('Concept has no upstream source');
    }
    const source = await getConceptById(current.source_concept_id);
    if (!source) throw new Error('Upstream source concept missing');
    return await updateConcept(userId, conceptId, {
      title: source.title,
      body_md: source.body_md,
    });
  } catch (err) {
    logger.error('Failed to pull latest concept', err);
    throw err;
  }
}

/**
 * True when the upstream source has a newer `updated_at` than this fork.
 * Used to surface the "Pull latest available" badge on forked rows.
 */
export async function hasUpstreamUpdate(
  concept: PlaybookConceptRecord,
): Promise<boolean> {
  if (!concept.source_concept_id) return false;
  try {
    const source = await getConceptById(concept.source_concept_id);
    if (!source) return false;
    return new Date(source.updated_at) > new Date(concept.updated_at);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 4. Patterns / Reviews / Q&A — list helpers
// ---------------------------------------------------------------------------

export async function getPatterns(
  playbookId: string,
): Promise<PlaybookPatternRecord[]> {
  try {
    const { data, error } = await supabase
      .from('playbook_patterns')
      .select('*')
      .eq('playbook_id', playbookId)
      .neq('status', 'dismissed')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as PlaybookPatternRecord[];
  } catch (err) {
    logger.error('Failed to fetch patterns', err);
    throw err;
  }
}

export async function getReviews(
  playbookId: string,
  limit = 20,
): Promise<PlaybookReviewRecord[]> {
  try {
    const { data, error } = await supabase
      .from('playbook_reviews')
      .select('*')
      .eq('playbook_id', playbookId)
      .order('period_end', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as PlaybookReviewRecord[];
  } catch (err) {
    logger.error('Failed to fetch reviews', err);
    throw err;
  }
}

export async function updatePatternStatus(
  patternId: string,
  status: 'active' | 'pinned' | 'dismissed',
): Promise<void> {
  try {
    const { error } = await supabase
      .from('playbook_patterns')
      .update({ status })
      .eq('id', patternId);
    if (error) throw error;
  } catch (err) {
    logger.error('Failed to update pattern status', err);
    throw err;
  }
}

export interface CreatePlaybookQAInput {
  playbook_id: string;
  user_id: string;
  question: string;
  answer_md: string;
  sources?: Record<string, unknown>[];
  pinned?: boolean;
}

export async function createQA(
  input: CreatePlaybookQAInput,
): Promise<PlaybookQARecord> {
  try {
    const { data, error } = await supabase
      .from('playbook_qa')
      .insert({
        playbook_id: input.playbook_id,
        user_id: input.user_id,
        question: input.question,
        answer_md: input.answer_md,
        sources: input.sources ?? [],
        pinned: input.pinned ?? false,
      })
      .select()
      .single();
    if (error) throw error;
    return data as PlaybookQARecord;
  } catch (err) {
    logger.error('Failed to create qa', err);
    throw err;
  }
}

export async function setQAPinned(
  qaId: string,
  pinned: boolean,
): Promise<void> {
  try {
    const { error } = await supabase
      .from('playbook_qa')
      .update({ pinned })
      .eq('id', qaId);
    if (error) throw error;
  } catch (err) {
    logger.error('Failed to pin/unpin qa', err);
    throw err;
  }
}

export async function deleteQA(qaId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('playbook_qa')
      .delete()
      .eq('id', qaId);
    if (error) throw error;
  } catch (err) {
    logger.error('Failed to delete qa', err);
    throw err;
  }
}

export async function getQA(
  playbookId: string,
  limit = 50,
): Promise<PlaybookQARecord[]> {
  try {
    const { data, error } = await supabase
      .from('playbook_qa')
      .select('*')
      .eq('playbook_id', playbookId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as PlaybookQARecord[];
  } catch (err) {
    logger.error('Failed to fetch qa', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 5. Suggestions queue
// ---------------------------------------------------------------------------

export async function getSuggestions(
  playbookId: string,
  status: SuggestionStatus = 'pending',
  limit = 100,
): Promise<PlaybookSuggestionRecord[]> {
  try {
    const { data, error } = await supabase
      .from('playbook_suggestions')
      .select('*')
      .eq('playbook_id', playbookId)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as PlaybookSuggestionRecord[];
  } catch (err) {
    logger.error('Failed to fetch suggestions', err);
    throw err;
  }
}

/**
 * Fetch pending cross_interest_idea suggestions that target a specific step.
 * Cross-interest suggestions are written to the *source* playbook with
 * `payload.target_step_id` set, so we query across all playbook_suggestions
 * and filter by the JSON path. RLS ensures only the owner sees them.
 */
export async function getCrossInterestSuggestionsForStep(
  stepId: string,
): Promise<PlaybookSuggestionRecord[]> {
  try {
    const { data, error } = await supabase
      .from('playbook_suggestions')
      .select('*')
      .eq('kind', 'cross_interest_idea')
      .eq('status', 'pending')
      .filter('payload->>target_step_id', 'eq', stepId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as PlaybookSuggestionRecord[];
  } catch (err) {
    logger.error('Failed to fetch cross-interest suggestions for step', err);
    return [];
  }
}

export async function countPendingSuggestions(
  playbookId: string,
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('playbook_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('playbook_id', playbookId)
      .eq('status', 'pending');

    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    logger.error('Failed to count pending suggestions', err);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// 6. Raw Inbox
// ---------------------------------------------------------------------------

export async function getInboxItems(
  playbookId: string,
  status: 'pending' | 'ingesting' | 'ingested' | 'dismissed' | 'failed' = 'pending',
): Promise<PlaybookInboxItemRecord[]> {
  try {
    const { data, error } = await supabase
      .from('playbook_inbox_items')
      .select('*')
      .eq('playbook_id', playbookId)
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as PlaybookInboxItemRecord[];
  } catch (err) {
    logger.error('Failed to fetch inbox items', err);
    throw err;
  }
}

export async function addInboxItem(
  userId: string,
  input: CreatePlaybookInboxItemInput,
): Promise<PlaybookInboxItemRecord> {
  try {
    const { data, error } = await supabase
      .from('playbook_inbox_items')
      .insert({
        playbook_id: input.playbook_id,
        user_id: userId,
        kind: input.kind,
        title: input.title ?? null,
        source_url: input.source_url ?? null,
        storage_path: input.storage_path ?? null,
        raw_text: input.raw_text ?? null,
        metadata: input.metadata ?? {},
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data as PlaybookInboxItemRecord;
  } catch (err) {
    logger.error('Failed to add inbox item', err);
    throw err;
  }
}

export async function dismissInboxItem(itemId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('playbook_inbox_items')
      .update({ status: 'dismissed' })
      .eq('id', itemId);

    if (error) throw error;
  } catch (err) {
    logger.error('Failed to dismiss inbox item', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 7. Shares — coach / teammate read-only access
// ---------------------------------------------------------------------------

export async function getShares(
  playbookId: string,
): Promise<PlaybookShareRecord[]> {
  try {
    const { data, error } = await supabase
      .from('playbook_shares')
      .select('*')
      .eq('playbook_id', playbookId)
      .in('invite_status', ['pending', 'accepted'])
      .order('invited_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as PlaybookShareRecord[];
  } catch (err) {
    logger.error('Failed to fetch shares', err);
    throw err;
  }
}

export async function createShare(
  ownerUserId: string,
  input: CreatePlaybookShareInput,
): Promise<PlaybookShareRecord> {
  try {
    const { data, error } = await supabase
      .from('playbook_shares')
      .insert({
        playbook_id: input.playbook_id,
        owner_user_id: ownerUserId,
        shared_with_email: input.shared_with_email,
        shared_with_user_id: input.shared_with_user_id ?? null,
        role: 'view',
        invite_status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data as PlaybookShareRecord;
  } catch (err) {
    logger.error('Failed to create share', err);
    throw err;
  }
}

export async function revokeShare(shareId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('playbook_shares')
      .update({ invite_status: 'revoked' })
      .eq('id', shareId);

    if (error) throw error;
  } catch (err) {
    logger.error('Failed to revoke share', err);
    throw err;
  }
}

/**
 * Accept a pending share by flipping invite_status to 'accepted'.
 * Called when an invitee first visits the shared playbook view.
 */
export async function acceptShare(
  userId: string,
  playbookId: string,
): Promise<void> {
  try {
    // Find the user's email from profiles to match against shared_with_email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (!profile?.email) return;

    const { error } = await supabase
      .from('playbook_shares')
      .update({
        invite_status: 'accepted',
        shared_with_user_id: userId,
        accepted_at: new Date().toISOString(),
      })
      .eq('playbook_id', playbookId)
      .eq('shared_with_email', profile.email)
      .eq('invite_status', 'pending');

    if (error) throw error;
  } catch (err) {
    logger.error('Failed to accept share', err);
    // Don't throw — accepting is best-effort on page load
  }
}

/**
 * Fetch playbooks that have been shared with the current user.
 */
export async function getPlaybooksSharedWithMe(
  userId: string,
): Promise<(PlaybookShareRecord & { playbook_name: string; interest_name: string; owner_email: string; owner_name: string })[]> {
  try {
    // First get the user's email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (!profile?.email) return [];

    // Find shares where user is accepted OR pending by email
    const { data, error } = await supabase
      .from('playbook_shares')
      .select('*, playbooks!inner(name, interest_id)')
      .or(`shared_with_user_id.eq.${userId},shared_with_email.eq.${profile.email}`)
      .in('invite_status', ['pending', 'accepted'])
      .order('invited_at', { ascending: false });

    if (error) throw error;
    if (!data?.length) return [];

    interface ShareWithPlaybook {
      owner_user_id: string;
      playbooks?: { name: string; interest_id: string } | null;
    }
    interface InterestRow { id: string; name: string }
    interface OwnerRow { id: string; email: string; full_name: string | null }

    // Resolve interest names and owner emails in parallel
    const interestIds = [...new Set((data as ShareWithPlaybook[]).map((r) => r.playbooks?.interest_id).filter((id): id is string => typeof id === 'string'))];
    const ownerIds = [...new Set((data as ShareWithPlaybook[]).map((r) => r.owner_user_id).filter((id): id is string => typeof id === 'string'))];

    const [interestRes, ownerRes] = await Promise.all([
      interestIds.length
        ? supabase.from('interests').select('id, name').in('id', interestIds)
        : { data: [] },
      ownerIds.length
        ? supabase.from('profiles').select('id, email, full_name').in('id', ownerIds)
        : { data: [] },
    ]);

    const interestMap = new Map((interestRes.data ?? []).map((i: InterestRow) => [i.id, i.name]));
    const ownerMap = new Map((ownerRes.data ?? []).map((o: OwnerRow) => [o.id, { email: o.email, name: o.full_name }]));

    return (data as (typeof data[number] & ShareWithPlaybook)[]).map((row) => ({
      ...row,
      playbook_name: row.playbooks?.name ?? 'Playbook',
      interest_name: interestMap.get(row.playbooks?.interest_id) ?? 'Unknown',
      owner_email: ownerMap.get(row.owner_user_id)?.email ?? 'Unknown',
      owner_name: ownerMap.get(row.owner_user_id)?.name ?? '',
    }));
  } catch (err) {
    logger.error('Failed to get shared playbooks', err);
    return [];
  }
}

/**
 * Fetch section counts for multiple playbooks in parallel.
 * Used by the instructor dashboard to show aggregate stats per student.
 */
export async function getBatchSectionCounts(
  playbooks: { playbook_id: string; interest_id: string }[],
): Promise<Map<string, PlaybookSectionCounts>> {
  const results = await Promise.all(
    playbooks.map(async (p) => {
      const counts = await getSectionCounts(p.playbook_id, p.interest_id);
      return [p.playbook_id, counts] as const;
    }),
  );
  return new Map(results);
}

/**
 * Fetch the latest review for multiple playbooks in parallel.
 * Returns a map of playbook_id → latest review summary.
 */
export async function getBatchLatestReviews(
  playbookIds: string[],
): Promise<Map<string, { summary_md: string; period_end: string }>> {
  const results = await Promise.all(
    playbookIds.map(async (id) => {
      try {
        const { data } = await supabase
          .from('playbook_reviews')
          .select('summary_md, period_end')
          .eq('playbook_id', id)
          .order('period_end', { ascending: false })
          .limit(1)
          .maybeSingle();
        return [id, data] as const;
      } catch {
        return [id, null] as const;
      }
    }),
  );
  return new Map(
    results
      .filter((r): r is [string, { summary_md: string; period_end: string }] => r[1] != null),
  );
}

/**
 * Fetch competency progress summary for a student (via their playbook share).
 * Returns total competencies, count by status, and overall percent validated/competent.
 */
export interface CompetencyProgressSummary {
  total: number;
  validated: number;
  practicing: number;
  learning: number;
  overallPercent: number;
}

export async function getStudentCompetencySummary(
  studentUserId: string,
  interestId: string,
): Promise<CompetencyProgressSummary> {
  try {
    // Get all competencies for this interest
    const { data: competencies, error: compErr } = await supabase
      .from('betterat_competencies')
      .select('id')
      .eq('interest_id', interestId);

    if (compErr) throw compErr;
    const total = competencies?.length ?? 0;
    if (total === 0) return { total: 0, validated: 0, practicing: 0, learning: 0, overallPercent: 0 };

    // Get student's progress rows
    const { data: progress, error: progErr } = await supabase
      .from('betterat_competency_progress')
      .select('status')
      .eq('user_id', studentUserId)
      .in('competency_id', (competencies ?? []).map((c: { id: string }) => c.id));

    if (progErr) throw progErr;

    let validated = 0;
    let practicing = 0;
    let learning = 0;

    for (const row of progress ?? []) {
      const s = (row as { status: string }).status;
      if (s === 'validated' || s === 'competent') validated++;
      else if (s === 'practicing' || s === 'checkoff_ready') practicing++;
      else if (s === 'learning') learning++;
    }

    return {
      total,
      validated,
      practicing,
      learning,
      overallPercent: total > 0 ? Math.round((validated / total) * 100) : 0,
    };
  } catch (err) {
    logger.warn('Failed to get student competency summary', err);
    return { total: 0, validated: 0, practicing: 0, learning: 0, overallPercent: 0 };
  }
}

/**
 * Batch fetch competency summaries for multiple students.
 */
export async function getBatchCompetencySummaries(
  students: { user_id: string; interest_id: string }[],
): Promise<Map<string, CompetencyProgressSummary>> {
  const results = await Promise.all(
    students.map(async (s) => {
      const summary = await getStudentCompetencySummary(s.user_id, s.interest_id);
      return [s.user_id, summary] as const;
    }),
  );
  return new Map(results);
}

// ---------------------------------------------------------------------------
// 8. Recent debriefs — last N steps with populated `metadata.review`
// ---------------------------------------------------------------------------

export interface RecentDebriefStep {
  id: string;
  title: string | null;
  step_date: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function getRecentDebriefs(
  userId: string,
  interestId: string,
  limit = 5,
): Promise<RecentDebriefStep[]> {
  try {
    // Pull recent steps for this user+interest; filter client-side for
    // metadata.review presence (pg jsonb "is not empty" is awkward at the
    // supabase-js layer and this list is small).
    // timeline_steps has `starts_at` / `completed_at` / `due_at` — there is no
    // `step_date` column. We project `completed_at` into `step_date` for the
    // UI and sort by completed_at then starts_at then created_at.
    const { data, error } = await supabase
      .from('timeline_steps')
      .select('id, title, completed_at, starts_at, metadata, created_at')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .order('completed_at', { ascending: false, nullsFirst: false })
      .order('starts_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit * 4);

    if (error) throw error;

    type TimelineStepRow = {
      id: string;
      title: string | null;
      completed_at: string | null;
      starts_at: string | null;
      metadata: Record<string, unknown> | null;
      created_at: string;
    };
    const rows = (data ?? []) as TimelineStepRow[];
    return rows
      .filter((r) => {
        const review = (r.metadata as { review?: Record<string, unknown> } | null)?.review;
        return review && Object.keys(review).length > 0;
      })
      .slice(0, limit)
      .map<RecentDebriefStep>((r) => ({
        id: r.id,
        title: r.title,
        step_date: r.completed_at ?? r.starts_at ?? null,
        metadata: r.metadata,
        created_at: r.created_at,
      }));
  } catch (err) {
    logger.error('Failed to fetch recent debriefs', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 9. Section counts (for Playbook home tabs)
// ---------------------------------------------------------------------------

export interface PlaybookSectionCounts {
  concepts: number;
  resources: number;
  patterns: number;
  reviews: number;
  qa: number;
}

async function tableCount(
  table: string,
  playbookId: string,
  extraFilter?: (q: any) => any,
): Promise<number> {
  try {
    let q: any = supabase.from(table).select('id', { count: 'exact', head: true }).eq('playbook_id', playbookId);
    if (extraFilter) q = extraFilter(q);
    const { count, error } = await q;
    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    logger.warn(`Failed to count ${table}`, err);
    return 0;
  }
}

export async function getSectionCounts(
  playbookId: string,
  interestId: string,
): Promise<PlaybookSectionCounts> {
  const [concepts, resources, patterns, reviews, qa] = await Promise.all([
    // Concepts include baselines
    (async () => {
      try {
        const { count, error } = await supabase
          .from('playbook_concepts')
          .select('id', { count: 'exact', head: true })
          .or(`playbook_id.eq.${playbookId},and(playbook_id.is.null,interest_id.eq.${interestId})`);
        if (error) throw error;
        return count ?? 0;
      } catch (err) {
        logger.warn('Failed to count concepts', err);
        return 0;
      }
    })(),
    tableCount('playbook_resources', playbookId),
    tableCount('playbook_patterns', playbookId),
    tableCount('playbook_reviews', playbookId),
    tableCount('playbook_qa', playbookId),
  ]);

  return { concepts, resources, patterns, reviews, qa };
}

// ---------------------------------------------------------------------------
// 10. Phase 6 — insights + lifecycle concepts
// ---------------------------------------------------------------------------

export interface Phase6ConceptRecord extends PlaybookConceptRecord {
  state: PlaybookConceptLifecycleState;
  linked_step_count: number;
  quote_count: number;
  evidence_step_count: number;
  capability_count: number;
}

function isMissingPhase6Table(err: unknown) {
  if (!err || typeof err !== 'object') return false;
  const code = String((err as { code?: string }).code ?? '');
  const message = String((err as { message?: string }).message ?? '');
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    message.includes('Could not find the table') ||
    message.includes('relation') ||
    message.includes('schema cache')
  );
}

function isRecoverablePlaybookReadError(err: unknown) {
  if (!err || typeof err !== 'object') return false;
  const code = String((err as { code?: string }).code ?? '');
  const message = String((err as { message?: string }).message ?? '').toLowerCase();
  return (
    code === '57014' ||
    code === 'PGRST205' ||
    code === '42P01' ||
    message.includes('statement timeout') ||
    message.includes('could not find the table') ||
    message.includes('relation') ||
    message.includes('schema cache')
  );
}

function normalizeLifecycleState(
  concept: Partial<PlaybookConceptRecord>,
  linkedStepCount: number,
): PlaybookConceptLifecycleState {
  if (concept.state === 'settled' || concept.settled_at) return 'settled';
  if (linkedStepCount > 0) return 'testing';
  return concept.state === 'seed' ? 'seed' : 'forming';
}

function buildConceptSlug(title: string) {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || `concept-${Date.now().toString(36)}`;
}

export async function getRecentInsights(
  userId: string,
  interestId: string | null,
): Promise<PlaybookInsightRecord[]> {
  try {
    let query = supabase
      .from('playbook_insights')
      .select('*')
      .eq('user_id', userId)
      .is('refined_to_concept_id', null)
      .order('created_at', { ascending: false })
      .limit(24);

    if (interestId) {
      query = query.eq('interest_id', interestId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as PlaybookInsightRecord[];
  } catch (err) {
    if (isMissingPhase6Table(err)) {
      logger.warn('playbook_insights unavailable in this environment');
      throw new Error('Playbook insights unavailable in this environment');
    }
    logger.error('Failed to fetch recent insights', err);
    throw err;
  }
}

export async function discardInsight(insightId: string): Promise<void> {
  const { error } = await supabase
    .from('playbook_insights')
    .delete()
    .eq('id', insightId);
  if (error) throw error;
}

export async function refineInsightToConcept(args: {
  userId: string;
  playbookId: string;
  insightId: string;
  interestId: string;
}): Promise<PlaybookConceptRecord> {
  const { userId, playbookId, insightId, interestId } = args;

  const { data: insight, error: insightError } = await supabase
    .from('playbook_insights')
    .select('*')
    .eq('id', insightId)
    .single();
  if (insightError) throw insightError;

  const content = String(insight.content ?? '').trim();
  const title = content.split(/[.!?\n]/)[0]?.trim().slice(0, 80) || 'Untitled concept';

  const concept = await createConcept(userId, {
    playbook_id: playbookId,
    origin: 'personal',
    interest_id: interestId,
    slug: buildConceptSlug(title),
    title,
    body_md: content,
    body: content,
    state: 'forming',
  });

  const { error: updateError } = await supabase
    .from('playbook_insights')
    .update({ refined_to_concept_id: concept.id })
    .eq('id', insightId);
  if (updateError) throw updateError;

  return concept;
}

export async function getLifecycleConcepts(
  userId: string,
  interestId: string,
): Promise<Phase6ConceptRecord[]> {
  try {
    const { data: concepts, error } = await supabase
      .from('playbook_concepts')
      .select('*')
      .eq('user_id', userId)
      .eq('interest_id', interestId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const conceptRows = (concepts ?? []) as PlaybookConceptRecord[];
    if (conceptRows.length === 0) return [];

    const conceptIds = conceptRows.map((c) => c.id);
    const [stepLinksResult, quotesResult, capabilityCounts] = await Promise.all([
      supabase
        .from('step_concept_links')
        .select('concept_id,step_id')
        .in('concept_id', conceptIds),
      supabase
        .from('concept_trail_quotes')
        .select('concept_id,id')
        .in('concept_id', conceptIds),
      getCapabilityCountsForConcepts(conceptIds),
    ]);

    if (stepLinksResult.error) throw stepLinksResult.error;
    if (quotesResult.error) throw quotesResult.error;

    const linksByConcept = new Map<string, Set<string>>();
    (stepLinksResult.data ?? []).forEach((row: any) => {
      const set = linksByConcept.get(row.concept_id) ?? new Set<string>();
      set.add(row.step_id);
      linksByConcept.set(row.concept_id, set);
    });

    const quoteCountByConcept = new Map<string, number>();
    (quotesResult.data ?? []).forEach((row: any) => {
      quoteCountByConcept.set(row.concept_id, (quoteCountByConcept.get(row.concept_id) ?? 0) + 1);
    });

    return conceptRows.map((concept) => {
      const linkedSteps = linksByConcept.get(concept.id) ?? new Set<string>();
      const linkedStepCount = linkedSteps.size;
      const quoteCount = quoteCountByConcept.get(concept.id) ?? 0;
      const capabilityCount = capabilityCounts.get(concept.id) ?? 0;
      const state = normalizeLifecycleState(concept, linkedStepCount);

      return {
        ...concept,
        state,
        linked_step_count: linkedStepCount,
        quote_count: quoteCount,
        evidence_step_count: quoteCount > 0 ? linkedStepCount : 0,
        capability_count: capabilityCount,
      };
    });
  } catch (err) {
    if (isMissingPhase6Table(err)) {
      logger.warn('Phase 6 concept lifecycle tables unavailable in this environment');
      throw new Error('Playbook concept lifecycle unavailable in this environment');
    }
    throw err;
  }
}

async function getCapabilityCountsForConcepts(conceptIds: string[]) {
  const counts = new Map<string, number>();
  if (conceptIds.length === 0) return counts;

  const { data: links, error: linkError } = await supabase
    .from('step_concept_links')
    .select('concept_id,step_id')
    .in('concept_id', conceptIds);
  if (linkError || !links?.length) return counts;

  const stepIds = [...new Set(links.map((row: any) => row.step_id))];
  const { data: evidence, error: evidenceError } = await supabase
    .from('step_capability_evidence')
    .select('step_id,capability_id')
    .eq('confirmed', true)
    .in('step_id', stepIds);
  if (evidenceError || !evidence?.length) return counts;

  const capabilitiesByStep = new Map<string, Set<string>>();
  evidence.forEach((row: any) => {
    const set = capabilitiesByStep.get(row.step_id) ?? new Set<string>();
    set.add(row.capability_id);
    capabilitiesByStep.set(row.step_id, set);
  });

  conceptIds.forEach((conceptId) => {
    const linked = links.filter((row: any) => row.concept_id === conceptId);
    const ids = new Set<string>();
    linked.forEach((row: any) => {
      (capabilitiesByStep.get(row.step_id) ?? new Set()).forEach((id) => ids.add(id));
    });
    counts.set(conceptId, ids.size);
  });

  return counts;
}

export async function getConceptTrailQuotes(
  conceptId: string,
): Promise<ConceptTrailQuoteRecord[]> {
  const { data, error } = await supabase
    .from('concept_trail_quotes')
    .select('*')
    .eq('concept_id', conceptId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ConceptTrailQuoteRecord[];
}

export async function addConceptTrailQuote(input: {
  conceptId: string;
  captureId: string;
  quoteText: string;
  sourceLabel: string;
}): Promise<ConceptTrailQuoteRecord> {
  const { data, error } = await supabase
    .from('concept_trail_quotes')
    .insert({
      concept_id: input.conceptId,
      capture_id: input.captureId,
      quote_text: input.quoteText,
      source_label: input.sourceLabel,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as ConceptTrailQuoteRecord;
}

export async function getStepConceptLinks(
  stepId: string,
): Promise<StepConceptLinkRecord[]> {
  const { data, error } = await supabase
    .from('step_concept_links')
    .select('*')
    .eq('step_id', stepId)
    .order('linked_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as StepConceptLinkRecord[];
}

export async function linkConceptToStep(
  stepId: string,
  conceptId: string,
): Promise<void> {
  const { error } = await supabase
    .from('step_concept_links')
    .insert({ step_id: stepId, concept_id: conceptId });
  if (error && error.code !== '23505') throw error;

  await addStepLink(stepId, 'concept', conceptId).catch(() => undefined);

  const { data: concept } = await supabase
    .from('playbook_concepts')
    .select('state')
    .eq('id', conceptId)
    .maybeSingle();
  if (concept && concept.state !== 'settled') {
    await supabase
      .from('playbook_concepts')
      .update({ state: 'testing' })
      .eq('id', conceptId)
      .neq('state', 'settled');
  }
}

export async function unlinkConceptFromStep(
  stepId: string,
  conceptId: string,
): Promise<void> {
  const { error } = await supabase
    .from('step_concept_links')
    .delete()
    .eq('step_id', stepId)
    .eq('concept_id', conceptId);
  if (error) throw error;

  await removeStepLink(stepId, 'concept', conceptId).catch(() => undefined);
}

export async function getConceptTestedSteps(conceptId: string): Promise<any[]> {
  const { data: links, error: linkError } = await supabase
    .from('step_concept_links')
    .select('step_id, linked_at')
    .eq('concept_id', conceptId)
    .order('linked_at', { ascending: false });
  if (linkError || !links?.length) return [];

  const stepIds = links.map((row: any) => row.step_id);
  const { data: steps, error } = await supabase
    .from('timeline_steps')
    .select('id,title,status,created_at,completed_at,interest_id')
    .in('id', stepIds);
  if (error) throw error;
  return steps ?? [];
}

export async function getConceptCapabilityChips(conceptId: string): Promise<string[]> {
  const { data: links, error: linkError } = await supabase
    .from('step_concept_links')
    .select('step_id')
    .eq('concept_id', conceptId);
  if (linkError || !links?.length) return [];

  const stepIds = links.map((row: any) => row.step_id);
  const { data: evidence, error } = await supabase
    .from('step_capability_evidence')
    .select('capability_name')
    .eq('confirmed', true)
    .in('step_id', stepIds);
  if (error || !evidence) return [];
  return [...new Set(evidence.map((row: any) => row.capability_name).filter(Boolean))];
}

export async function promoteConceptToSettled(conceptId: string): Promise<void> {
  const { error } = await supabase
    .from('playbook_concepts')
    .update({
      state: 'settled',
      settled_at: new Date().toISOString(),
      settled_by_promotion_at: new Date().toISOString(),
    })
    .eq('id', conceptId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// 11. Step ↔ Playbook typed links
// ---------------------------------------------------------------------------

export async function getStepLinks(
  stepId: string,
): Promise<StepPlaybookLinkRecord[]> {
  // Skip optimistic/demo ids — they are not persisted UUIDs and Postgres
  // will reject them with 22P02 (invalid UUID syntax).
  if (!isPersistedRaceId(stepId)) return [];

  try {
    const { data, error } = await supabase
      .from('step_playbook_links')
      .select('*')
      .eq('step_id', stepId);

    if (error) throw error;
    return (data ?? []) as StepPlaybookLinkRecord[];
  } catch (err) {
    if (isRecoverablePlaybookReadError(err)) {
      logger.warn('Step playbook links unavailable; continuing without linked playbook context', err);
      return [];
    }
    logger.error('Failed to fetch step links', err);
    return [];
  }
}

/**
 * Add a single link between a step and a playbook item. Idempotent — ignores
 * unique-constraint collisions.
 */
export async function addStepLink(
  stepId: string,
  itemType: StepPlaybookLinkRecord['item_type'],
  itemId: string,
): Promise<void> {
  const { error } = await supabase
    .from('step_playbook_links')
    .insert({ step_id: stepId, item_type: itemType, item_id: itemId });
  if (error && error.code !== '23505') throw error;
}

export async function removeStepLink(
  stepId: string,
  itemType: StepPlaybookLinkRecord['item_type'],
  itemId: string,
): Promise<void> {
  const { error } = await supabase
    .from('step_playbook_links')
    .delete()
    .eq('step_id', stepId)
    .eq('item_type', itemType)
    .eq('item_id', itemId);
  if (error) throw error;
}
