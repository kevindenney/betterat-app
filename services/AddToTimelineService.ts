import { supabase } from '@/services/supabase';
import type { TimelineStepRecord, TimelineStepSourceType } from '@/types/timeline-steps';
import { createStep } from '@/services/TimelineStepService';
import { createOnDeckItem, discardOnDeckItem, markOnDeckPlaced, type StepDeckSourceType } from '@/services/StepDeckService';

export type TimelinePlacement = 'next-up' | 'end' | 'specific-date';

export interface TimelineAddPreview {
  sourceLabel: string;
  title: string;
  body: string;
  capabilities: string[];
}

export interface AddToTimelineInput {
  userId: string;
  interestId: string;
  preview: TimelineAddPreview;
  placement: TimelinePlacement;
  sourceType: Extract<TimelineStepSourceType, 'blueprint' | 'user_fork' | 'suggestion'>;
  sourceId?: string | null;
  sourceUserId?: string | null;
  date?: string;
}

async function getOwnOrderedSteps(userId: string, interestId: string): Promise<TimelineStepRecord[]> {
  const { data, error } = await supabase
    .from('timeline_steps')
    .select('*')
    .eq('user_id', userId)
    .eq('interest_id', interestId)
    .in('status', ['pending', 'in_progress', 'completed', 'settled'])
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TimelineStepRecord[];
}

async function shiftSortOrdersAfter(userId: string, interestId: string, after: number): Promise<void> {
  const { data, error } = await supabase
    .from('timeline_steps')
    .select('id, sort_order')
    .eq('user_id', userId)
    .eq('interest_id', interestId)
    .gt('sort_order', after)
    .order('sort_order', { ascending: false });
  if (error) throw error;
  for (const row of (data ?? []) as Pick<TimelineStepRecord, 'id' | 'sort_order'>[]) {
    const { error: updateError } = await supabase
      .from('timeline_steps')
      .update({ sort_order: row.sort_order + 1 })
      .eq('id', row.id);
    if (updateError) throw updateError;
  }
}

async function resolvePlacement(userId: string, interestId: string, placement: TimelinePlacement, date?: string) {
  const steps = await getOwnOrderedSteps(userId, interestId);
  const currentStep = steps.find((step) => step.status === 'in_progress') ?? steps.find((step) => step.status === 'pending') ?? null;

  if (placement === 'next-up') {
    const anchor = currentStep?.sort_order ?? (steps.at(-1)?.sort_order ?? 0);
    await shiftSortOrdersAfter(userId, interestId, anchor);
    return { sortOrder: anchor + 1, startsAt: null as string | null };
  }

  if (placement === 'specific-date') {
    const nextSort = (steps.at(-1)?.sort_order ?? 0) + 1;
    const startsAt = date ? new Date(date).toISOString() : null;
    return { sortOrder: nextSort, startsAt };
  }

  return {
    sortOrder: (steps.at(-1)?.sort_order ?? 0) + 1,
    startsAt: null as string | null,
  };
}

export async function addToTimeline(input: AddToTimelineInput): Promise<TimelineStepRecord> {
  const placement = await resolvePlacement(input.userId, input.interestId, input.placement, input.date);

  const metadata: Record<string, unknown> = {
    plan: {
      what_will_you_do: input.preview.title,
      why_is_this_next: input.preview.body,
      capability_goals: input.preview.capabilities,
    },
  };

  if (input.sourceUserId) {
    metadata.source_user_id = input.sourceUserId;
  }

  return createStep({
    user_id: input.userId,
    interest_id: input.interestId,
    title: input.preview.title,
    description: input.preview.body || null,
    status: 'pending',
    category: 'general',
    source_type: input.sourceType,
    source_id: input.sourceId ?? null,
    starts_at: placement.startsAt,
    sort_order: placement.sortOrder,
    visibility: 'private',
    metadata,
  });
}

export async function saveToDeck(input: Omit<AddToTimelineInput, 'placement' | 'date'>) {
  return createOnDeckItem({
    userId: input.userId,
    interestId: input.interestId,
    sourceType: input.sourceType as StepDeckSourceType,
    sourceId: input.sourceId ?? null,
    title: input.preview.title,
    body: input.preview.body,
  });
}

export async function placeDeckItem(deckItemId: string, input: AddToTimelineInput): Promise<TimelineStepRecord> {
  const created = await addToTimeline(input);
  await markOnDeckPlaced(deckItemId);
  return created;
}

export async function discardDeck(deckItemId: string): Promise<void> {
  await discardOnDeckItem(deckItemId);
}
