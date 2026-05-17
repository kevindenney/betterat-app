import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('StepDeckService');

export type StepDeckSourceType = 'blueprint' | 'user_fork' | 'suggestion';
export type StepDeckStatus = 'on_deck' | 'placed' | 'discarded';

export interface StepDeckRecord {
  id: string;
  user_id: string;
  interest_id: string;
  source_type: StepDeckSourceType;
  source_id: string | null;
  title: string;
  body: string | null;
  status: StepDeckStatus;
  added_at: string;
  placed_at: string | null;
}

export interface CreateStepDeckInput {
  userId: string;
  interestId: string;
  sourceType: StepDeckSourceType;
  sourceId?: string | null;
  title: string;
  body?: string | null;
}

export async function listOnDeck(userId: string, interestId?: string | null): Promise<StepDeckRecord[]> {
  let query = supabase
    .from('step_deck')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'on_deck')
    .order('added_at', { ascending: false });

  if (interestId) query = query.eq('interest_id', interestId);

  const { data, error } = await query;
  if (error) {
    logger.error('Failed to list on-deck items', error);
    throw error;
  }
  return (data ?? []) as StepDeckRecord[];
}

export async function getOnDeckCount(userId: string, interestId?: string | null): Promise<number> {
  let query = supabase
    .from('step_deck')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'on_deck');
  if (interestId) query = query.eq('interest_id', interestId);
  const { count, error } = await query;
  if (error) {
    logger.error('Failed to count on-deck items', error);
    throw error;
  }
  return count ?? 0;
}

export async function createOnDeckItem(input: CreateStepDeckInput): Promise<StepDeckRecord> {
  const { data, error } = await supabase
    .from('step_deck')
    .insert({
      user_id: input.userId,
      interest_id: input.interestId,
      source_type: input.sourceType,
      source_id: input.sourceId ?? null,
      title: input.title.trim(),
      body: input.body ?? null,
      status: 'on_deck',
    })
    .select('*')
    .single();

  if (error) {
    logger.error('Failed to create on-deck item', error);
    throw error;
  }
  return data as StepDeckRecord;
}

export async function markOnDeckPlaced(id: string): Promise<void> {
  const { error } = await supabase
    .from('step_deck')
    .update({ status: 'placed', placed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    logger.error('Failed to mark on-deck item placed', error);
    throw error;
  }
}

export async function discardOnDeckItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('step_deck')
    .delete()
    .eq('id', id);
  if (error) {
    logger.error('Failed to discard on-deck item', error);
    throw error;
  }
}
