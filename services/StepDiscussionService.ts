/**
 * StepDiscussionService — Phase 10 Surface C.
 *
 * Reads/writes step_discussions and step_discussion_reactions. Reactions are
 * three named verbs ("fire", "insight", "question"); toggling re-uses the
 * (discussion, user, kind) unique row.
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('StepDiscussionService');

export type StepDiscussionReactionKind = 'fire' | 'insight' | 'question';

export interface StepDiscussionEvidenceChip {
  kind: 'voice' | 'photo' | 'data';
  label: string;
}

export interface StepDiscussionQuote {
  step_id: string;
  body: string;
  /** Step title for header line ("From my Step 4: …"). null if unavailable. */
  step_title: string | null;
  /** Sequence number within parent blueprint if known. */
  step_number: number | null;
}

export interface StepDiscussionRow {
  id: string;
  step_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  evidence: StepDiscussionEvidenceChip[];
  is_coach_reply: boolean;
  created_at: string;
  author_name: string | null;
  author_initials: string | null;
  author_avatar_url: string | null;
  /** Reaction counts keyed by kind. */
  reaction_counts: Record<StepDiscussionReactionKind, number>;
  /** Reactions the viewer has set. */
  viewer_reactions: StepDiscussionReactionKind[];
  /** Pre-computed replies grouped under root notes. */
  replies?: StepDiscussionRow[];
  /** Optional cross-step quote captured at compose time. */
  quote: StepDiscussionQuote | null;
}

const ALL_KINDS: StepDiscussionReactionKind[] = ['fire', 'insight', 'question'];

function emptyCounts(): Record<StepDiscussionReactionKind, number> {
  return { fire: 0, insight: 0, question: 0 };
}

function initialsFrom(name: string | null): string | null {
  if (!name) return null;
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || null
  );
}

export async function getStepDiscussion(
  stepId: string,
  viewerUserId: string | null,
): Promise<StepDiscussionRow[]> {
  try {
    const { data: rows, error } = await supabase
      .from('step_discussions')
      .select(
        'id, step_id, user_id, parent_id, body, evidence, is_coach_reply, created_at, quoted_step_id, quote_body',
      )
      .eq('step_id', stepId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!rows || rows.length === 0) return [];

    const userIds = [...new Set(rows.map((r: any) => r.user_id))];
    const ids = rows.map((r: any) => r.id);
    const quotedStepIds = [
      ...new Set(
        rows
          .map((r: any) => r.quoted_step_id)
          .filter((v: unknown): v is string => typeof v === 'string' && v.length > 0),
      ),
    ];

    const [{ data: profiles }, { data: reactions }, quotedStepsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds),
      supabase
        .from('step_discussion_reactions')
        .select('discussion_id, user_id, kind')
        .in('discussion_id', ids),
      quotedStepIds.length > 0
        ? supabase
            .from('timeline_steps')
            .select('id, title, sort_order')
            .in('id', quotedStepIds)
        : Promise.resolve({ data: [] as { id: string; title: string | null; sort_order: number | null }[] }),
    ]);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const quotedStepMap = new Map(
      ((quotedStepsRes as any).data ?? []).map((s: any) => [s.id, s]),
    );
    const countsByDiscussion = new Map<string, Record<StepDiscussionReactionKind, number>>();
    const viewerByDiscussion = new Map<string, StepDiscussionReactionKind[]>();
    for (const r of (reactions as any[]) ?? []) {
      const counts = countsByDiscussion.get(r.discussion_id) ?? emptyCounts();
      const kind = r.kind as StepDiscussionReactionKind;
      if (ALL_KINDS.includes(kind)) {
        counts[kind] = (counts[kind] ?? 0) + 1;
      }
      countsByDiscussion.set(r.discussion_id, counts);
      if (viewerUserId && r.user_id === viewerUserId) {
        const list = viewerByDiscussion.get(r.discussion_id) ?? [];
        list.push(kind);
        viewerByDiscussion.set(r.discussion_id, list);
      }
    }

    const enriched: StepDiscussionRow[] = (rows as any[]).map((r) => {
      const profile = profileMap.get(r.user_id);
      const name = (profile as any)?.full_name ?? null;
      const quotedStep = r.quoted_step_id ? quotedStepMap.get(r.quoted_step_id) : null;
      const quote: StepDiscussionQuote | null = r.quote_body && r.quoted_step_id
        ? {
            step_id: r.quoted_step_id,
            body: r.quote_body,
            step_title: (quotedStep as any)?.title ?? null,
            step_number: (quotedStep as any)?.sort_order ?? null,
          }
        : null;
      return {
        id: r.id,
        step_id: r.step_id,
        user_id: r.user_id,
        parent_id: r.parent_id ?? null,
        body: r.body,
        evidence: Array.isArray(r.evidence) ? (r.evidence as StepDiscussionEvidenceChip[]) : [],
        is_coach_reply: Boolean(r.is_coach_reply),
        created_at: r.created_at,
        author_name: name,
        author_initials: initialsFrom(name),
        author_avatar_url: (profile as any)?.avatar_url ?? null,
        reaction_counts: countsByDiscussion.get(r.id) ?? emptyCounts(),
        viewer_reactions: viewerByDiscussion.get(r.id) ?? [],
        quote,
      };
    });

    // Group replies under their root note.
    const roots = enriched.filter((r) => !r.parent_id);
    const repliesByParent = new Map<string, StepDiscussionRow[]>();
    for (const r of enriched.filter((r) => r.parent_id)) {
      const list = repliesByParent.get(r.parent_id as string) ?? [];
      list.push(r);
      repliesByParent.set(r.parent_id as string, list);
    }
    for (const root of roots) {
      root.replies = (repliesByParent.get(root.id) ?? []).reverse();
    }
    return roots;
  } catch (err) {
    logger.error('Failed to load step discussion', err);
    return [];
  }
}

/**
 * Same shape as getStepDiscussion, but reads the SHARED cohort
 * thread at the blueprint_step level. Anyone with an active plan
 * (or legacy blueprint_subscription) for the underlying blueprint
 * can see + post here. Returns [] when the viewer has no access.
 *
 * Note: a chunk of the enrichment logic mirrors getStepDiscussion.
 * Consolidating both into a shared helper is a follow-up; for now
 * the parallel implementation is the safer rev.
 */
export async function getBlueprintStepDiscussion(
  blueprintStepId: string,
  viewerUserId: string | null,
): Promise<StepDiscussionRow[]> {
  try {
    const { data: rows, error } = await supabase
      .from('step_discussions')
      .select(
        'id, step_id, blueprint_step_id, user_id, parent_id, body, evidence, is_coach_reply, created_at, quoted_step_id, quote_body',
      )
      .eq('blueprint_step_id', blueprintStepId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!rows || rows.length === 0) return [];

    const userIds = [...new Set(rows.map((r: any) => r.user_id))];
    const ids = rows.map((r: any) => r.id);
    const quotedStepIds = [
      ...new Set(
        rows
          .map((r: any) => r.quoted_step_id)
          .filter((v: unknown): v is string => typeof v === 'string' && v.length > 0),
      ),
    ];

    const [{ data: profiles }, { data: reactions }, quotedStepsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds),
      supabase
        .from('step_discussion_reactions')
        .select('discussion_id, user_id, kind')
        .in('discussion_id', ids),
      quotedStepIds.length > 0
        ? supabase
            .from('timeline_steps')
            .select('id, title, sort_order')
            .in('id', quotedStepIds)
        : Promise.resolve({ data: [] as { id: string; title: string | null; sort_order: number | null }[] }),
    ]);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const quotedStepMap = new Map(
      ((quotedStepsRes as any).data ?? []).map((s: any) => [s.id, s]),
    );
    const countsByDiscussion = new Map<string, Record<StepDiscussionReactionKind, number>>();
    const viewerByDiscussion = new Map<string, StepDiscussionReactionKind[]>();
    for (const r of (reactions as any[]) ?? []) {
      const counts = countsByDiscussion.get(r.discussion_id) ?? emptyCounts();
      const kind = r.kind as StepDiscussionReactionKind;
      if (ALL_KINDS.includes(kind)) {
        counts[kind] = (counts[kind] ?? 0) + 1;
      }
      countsByDiscussion.set(r.discussion_id, counts);
      if (viewerUserId && r.user_id === viewerUserId) {
        const list = viewerByDiscussion.get(r.discussion_id) ?? [];
        list.push(kind);
        viewerByDiscussion.set(r.discussion_id, list);
      }
    }

    const enriched: StepDiscussionRow[] = (rows as any[]).map((r) => {
      const profile = profileMap.get(r.user_id);
      const name = (profile as any)?.full_name ?? null;
      const quotedStep = r.quoted_step_id ? quotedStepMap.get(r.quoted_step_id) : null;
      const quote: StepDiscussionQuote | null = r.quote_body && r.quoted_step_id
        ? {
            step_id: r.quoted_step_id,
            body: r.quote_body,
            step_title: (quotedStep as any)?.title ?? null,
            step_number: (quotedStep as any)?.sort_order ?? null,
          }
        : null;
      return {
        id: r.id,
        step_id: r.step_id,
        user_id: r.user_id,
        parent_id: r.parent_id ?? null,
        body: r.body,
        evidence: Array.isArray(r.evidence) ? (r.evidence as StepDiscussionEvidenceChip[]) : [],
        is_coach_reply: Boolean(r.is_coach_reply),
        created_at: r.created_at,
        author_name: name,
        author_initials: initialsFrom(name),
        author_avatar_url: (profile as any)?.avatar_url ?? null,
        reaction_counts: countsByDiscussion.get(r.id) ?? emptyCounts(),
        viewer_reactions: viewerByDiscussion.get(r.id) ?? [],
        quote,
      };
    });

    const roots = enriched.filter((r) => !r.parent_id);
    const repliesByParent = new Map<string, StepDiscussionRow[]>();
    for (const r of enriched.filter((r) => r.parent_id)) {
      const list = repliesByParent.get(r.parent_id as string) ?? [];
      list.push(r);
      repliesByParent.set(r.parent_id as string, list);
    }
    for (const root of roots) {
      root.replies = (repliesByParent.get(root.id) ?? []).reverse();
    }
    return roots;
  } catch (err) {
    logger.error('Failed to load blueprint_step discussion', err);
    return [];
  }
}

/**
 * Post to the SHARED cohort thread at a blueprint_step. RLS gates
 * the insert through is_plan_member_for_blueprint_step — if the
 * caller doesn't have an active plan / legacy subscription, the
 * insert fails and we return null.
 */
export async function postBlueprintStepNote(input: {
  blueprintStepId: string;
  userId: string;
  body: string;
  parentId?: string | null;
  evidence?: StepDiscussionEvidenceChip[];
  isCoachReply?: boolean;
  quotedStepId?: string | null;
  quoteBody?: string | null;
}): Promise<StepDiscussionRow | null> {
  const { data, error } = await supabase
    .from('step_discussions')
    .insert({
      blueprint_step_id: input.blueprintStepId,
      step_id: null,
      user_id: input.userId,
      parent_id: input.parentId ?? null,
      body: input.body,
      evidence: input.evidence ?? [],
      is_coach_reply: input.isCoachReply ?? false,
      quoted_step_id: input.quotedStepId ?? null,
      quote_body: input.quoteBody ?? null,
    })
    .select('*')
    .single();

  if (error) {
    logger.error('Failed to post blueprint_step note', error);
    throw error;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', input.userId)
    .maybeSingle();
  const name = (profile as any)?.full_name ?? null;

  return {
    id: (data as any).id,
    step_id: (data as any).step_id,
    user_id: (data as any).user_id,
    parent_id: (data as any).parent_id ?? null,
    body: (data as any).body,
    evidence: ((data as any).evidence ?? []) as StepDiscussionEvidenceChip[],
    is_coach_reply: Boolean((data as any).is_coach_reply),
    created_at: (data as any).created_at,
    author_name: name,
    author_initials: initialsFrom(name),
    author_avatar_url: (profile as any)?.avatar_url ?? null,
    reaction_counts: emptyCounts(),
    viewer_reactions: [],
    quote: null,
  };
}

export async function postStepNote(input: {
  stepId: string;
  userId: string;
  body: string;
  parentId?: string | null;
  evidence?: StepDiscussionEvidenceChip[];
  isCoachReply?: boolean;
  quotedStepId?: string | null;
  quoteBody?: string | null;
}): Promise<StepDiscussionRow | null> {
  const { data, error } = await supabase
    .from('step_discussions')
    .insert({
      step_id: input.stepId,
      user_id: input.userId,
      parent_id: input.parentId ?? null,
      body: input.body,
      evidence: input.evidence ?? [],
      is_coach_reply: input.isCoachReply ?? false,
      quoted_step_id: input.quotedStepId ?? null,
      quote_body: input.quoteBody ?? null,
    })
    .select('*')
    .single();

  if (error) {
    logger.error('Failed to post step note', error);
    throw error;
  }

  // Light enrichment for optimistic UI insertion.
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', input.userId)
    .maybeSingle();
  const name = (profile as any)?.full_name ?? null;

  let quote: StepDiscussionQuote | null = null;
  if ((data as any).quoted_step_id && (data as any).quote_body) {
    const { data: quotedStep } = await supabase
      .from('timeline_steps')
      .select('id, title, sort_order')
      .eq('id', (data as any).quoted_step_id)
      .maybeSingle();
    quote = {
      step_id: (data as any).quoted_step_id,
      body: (data as any).quote_body,
      step_title: (quotedStep as any)?.title ?? null,
      step_number: (quotedStep as any)?.sort_order ?? null,
    };
  }

  return {
    id: (data as any).id,
    step_id: (data as any).step_id,
    user_id: (data as any).user_id,
    parent_id: (data as any).parent_id ?? null,
    body: (data as any).body,
    evidence: ((data as any).evidence ?? []) as StepDiscussionEvidenceChip[],
    is_coach_reply: Boolean((data as any).is_coach_reply),
    created_at: (data as any).created_at,
    author_name: name,
    author_initials: initialsFrom(name),
    author_avatar_url: (profile as any)?.avatar_url ?? null,
    reaction_counts: emptyCounts(),
    viewer_reactions: [],
    quote,
  };
}

/**
 * Edit the body of a note the viewer authored. RLS
 * (step_discussions_author_update) enforces ownership; the explicit
 * user_id filter keeps a non-owner from even attempting the write.
 */
export async function editStepNote(input: {
  discussionId: string;
  userId: string;
  body: string;
}): Promise<void> {
  const { error } = await supabase
    .from('step_discussions')
    .update({ body: input.body })
    .eq('id', input.discussionId)
    .eq('user_id', input.userId);
  if (error) {
    logger.error('Failed to edit step note', error);
    throw error;
  }
}

/**
 * Delete a note the viewer authored. Replies (parent_id) cascade via the
 * FK ON DELETE CASCADE, so deleting a root note removes its thread.
 */
export async function deleteStepNote(input: {
  discussionId: string;
  userId: string;
}): Promise<void> {
  const { error } = await supabase
    .from('step_discussions')
    .delete()
    .eq('id', input.discussionId)
    .eq('user_id', input.userId);
  if (error) {
    logger.error('Failed to delete step note', error);
    throw error;
  }
}

export async function toggleStepReaction(input: {
  discussionId: string;
  userId: string;
  kind: StepDiscussionReactionKind;
  shouldSet: boolean;
}): Promise<void> {
  const { discussionId, userId, kind, shouldSet } = input;
  if (shouldSet) {
    // ignoreDuplicates → ON CONFLICT DO NOTHING. The DO UPDATE form an
    // ordinary upsert generates re-plans the table's RLS policies on the
    // conflict path, which balloons (461 InitPlans) and hits the statement
    // timeout → 500. A reaction toggle never needs to mutate an existing
    // row, so DO NOTHING is both correct and ~100x faster.
    const { error } = await supabase.from('step_discussion_reactions').upsert(
      { discussion_id: discussionId, user_id: userId, kind },
      { onConflict: 'discussion_id,user_id,kind', ignoreDuplicates: true },
    );
    if (error && error.code !== '23505') {
      logger.error('Failed to add step reaction', error);
      throw error;
    }
  } else {
    const { error } = await supabase
      .from('step_discussion_reactions')
      .delete()
      .eq('discussion_id', discussionId)
      .eq('user_id', userId)
      .eq('kind', kind);
    if (error) {
      logger.error('Failed to remove step reaction', error);
      throw error;
    }
  }
}

/**
 * Record that a user just opened a step's Discussion thread, so the unread
 * badge clears. Bumps last_seen_at to now() for this (step, user) pair.
 */
export async function markStepDiscussionSeen(
  stepId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.from('step_discussion_views').upsert(
    { step_id: stepId, user_id: userId, last_seen_at: new Date().toISOString() },
    { onConflict: 'step_id,user_id' },
  );
  if (error) {
    logger.error('Failed to mark step discussion seen', error);
    throw error;
  }
}
