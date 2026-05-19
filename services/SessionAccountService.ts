import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('SessionAccountService');

export interface SessionAccountRecord {
  id: string;
  user_id: string;
  session_token: string;
  redeem_token: string | null;
  blueprint_id: string | null;
  blueprint_subscription_id: string | null;
  source: string;
  created_at: string;
  expires_at: string;
  claimed_email: string | null;
  claimed_at: string | null;
}

export async function createSessionAccount(input: {
  userId: string;
  sessionToken: string;
  redeemToken: string | null;
  blueprintId: string | null;
  subscriptionId: string | null;
  source?: string;
}): Promise<SessionAccountRecord> {
  const { data, error } = await supabase
    .from('session_accounts')
    .insert({
      user_id: input.userId,
      session_token: input.sessionToken,
      redeem_token: input.redeemToken,
      blueprint_id: input.blueprintId,
      blueprint_subscription_id: input.subscriptionId,
      source: input.source ?? 'hkdw-2026',
    })
    .select('*')
    .single();
  if (error) {
    logger.error('Failed to create session account', error);
    throw error;
  }
  return data as SessionAccountRecord;
}

export async function loadSessionAccount(sessionToken: string): Promise<SessionAccountRecord | null> {
  const { data, error } = await supabase
    .from('session_accounts')
    .select('*')
    .eq('session_token', sessionToken)
    .maybeSingle();
  if (error) {
    logger.warn('Failed to load session account', error);
    return null;
  }
  return (data as SessionAccountRecord | null) ?? null;
}

export async function claimSessionAccount(input: {
  sessionToken: string;
  email: string;
}): Promise<SessionAccountRecord> {
  const { data, error } = await supabase
    .from('session_accounts')
    .update({ claimed_email: input.email, claimed_at: new Date().toISOString() })
    .eq('session_token', input.sessionToken)
    .select('*')
    .single();
  if (error) {
    logger.error('Failed to claim session account', error);
    throw error;
  }
  return data as SessionAccountRecord;
}
