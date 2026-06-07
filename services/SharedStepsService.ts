import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { buildShareUrl, createShareToken } from '@/services/ShareTokenService';
import type {
  SharedInboxItem,
  SharedStepCommentRecord,
  SharedStepRecord,
  ShareStepGroupKind,
  ShareTokenRecord,
} from '@/types/sharing';

const logger = createLogger('SharedStepsService');

const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const TOKEN_LENGTH = 32;
const SHARE_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function generateToken(): string {
  let out = '';
  for (let i = 0; i < TOKEN_LENGTH; i += 1) {
    out += TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)];
  }
  return out;
}

function isMissingTableError(error: unknown, tableName: string): boolean {
  const candidate = error as { code?: string; message?: string } | null;
  return (
    candidate?.code === 'PGRST205' &&
    typeof candidate.message === 'string' &&
    candidate.message.includes(`'public.${tableName}'`)
  );
}

function isMissingColumnError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null;
  return (
    candidate?.code === '42703' ||
    candidate?.code === 'PGRST204' ||
    candidate?.message?.toLowerCase().includes('column') === true
  );
}

async function assertStepOwner(input: { senderUserId: string; stepId: string }): Promise<void> {
  const { data, error } = await supabase
    .from('timeline_steps')
    .select('id')
    .eq('id', input.stepId)
    .eq('user_id', input.senderUserId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('You can only create links for your own steps.');
}

async function insertShareTokenFallback(input: {
  senderUserId: string;
  stepId: string;
  expiresAt: string;
}): Promise<ShareTokenRecord> {
  await assertStepOwner(input);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = generateToken();
    const modernInsert = await supabase
      .from('share_tokens')
      .insert({
        target_type: 'step',
        target_id: input.stepId,
        scope: 'step:read',
        token,
        created_by: input.senderUserId,
        expires_at: input.expiresAt,
      })
      .select('id, token, target_id, created_by, created_at, expires_at')
      .single();

    if (!modernInsert.error && modernInsert.data) {
      const row = modernInsert.data as {
        id: string;
        token: string;
        target_id: string;
        created_by: string;
        created_at: string;
        expires_at: string | null;
      };
      return {
        id: row.id,
        token: row.token,
        step_id: row.target_id,
        created_by_user_id: row.created_by,
        created_at: row.created_at,
        expires_at: row.expires_at ?? '',
        used_count: 0,
      };
    }

    if (modernInsert.error?.code === '23505') continue;
    if (!isMissingColumnError(modernInsert.error)) {
      logger.error('Failed to create share link fallback', modernInsert.error);
      throw modernInsert.error;
    }

    const legacyInsert = await supabase
      .from('share_tokens')
      .insert({
        token,
        step_id: input.stepId,
        created_by_user_id: input.senderUserId,
        expires_at: input.expiresAt,
      })
      .select('*')
      .single();

    if (!legacyInsert.error && legacyInsert.data) {
      return legacyInsert.data as ShareTokenRecord;
    }
    if (legacyInsert.error?.code === '23505') continue;

    logger.error('Failed to create legacy share link fallback', legacyInsert.error);
    throw legacyInsert.error;
  }

  throw new Error('Could not generate a unique share token.');
}

export async function shareStepDirect(input: {
  senderUserId: string;
  stepId: string;
  recipientUserId: string;
}): Promise<SharedStepRecord> {
  const { data, error } = await supabase
    .from('shared_steps')
    .insert({
      sender_user_id: input.senderUserId,
      step_id: input.stepId,
      recipient_user_id: input.recipientUserId,
    })
    .select('*')
    .single();
  if (error) {
    if (isMissingTableError(error, 'shared_steps')) {
      logger.warn('Direct step sharing is unavailable because shared_steps is not in the active schema');
      throw new Error('Direct step sharing is not available in this environment.');
    }
    logger.error('Failed to share step direct', error);
    throw error;
  }
  return data as SharedStepRecord;
}

export async function shareStepToGroup(input: {
  senderUserId: string;
  stepId: string;
  groupId: string;
  groupKind: ShareStepGroupKind;
}): Promise<SharedStepRecord> {
  const { data, error } = await supabase
    .from('shared_steps')
    .insert({
      sender_user_id: input.senderUserId,
      step_id: input.stepId,
      group_id: input.groupId,
      group_kind: input.groupKind,
    })
    .select('*')
    .single();
  if (error) {
    if (isMissingTableError(error, 'shared_steps')) {
      logger.warn('Group step sharing is unavailable because shared_steps is not in the active schema');
      throw new Error('Group step sharing is not available in this environment.');
    }
    logger.error('Failed to share step to group', error);
    throw error;
  }
  return data as SharedStepRecord;
}

export async function createShareLink(input: {
  senderUserId: string;
  stepId: string;
}): Promise<{ token: string; url: string; record: ShareTokenRecord }> {
  const expiresAt = new Date(Date.now() + SHARE_LINK_TTL_MS);
  let record: ShareTokenRecord | null = null;
  let token: string;

  try {
    token = await createShareToken('step', input.stepId, expiresAt);
  } catch (error) {
    logger.warn('create_share_token RPC unavailable; falling back to direct share token insert', error);
    record = await insertShareTokenFallback({
      ...input,
      expiresAt: expiresAt.toISOString(),
    });
    token = record.token;
  }

  return {
    token,
    url: buildShareUrl(token),
    record:
      record ?? {
        id: token,
        token,
        step_id: input.stepId,
        created_by_user_id: input.senderUserId,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        used_count: 0,
      },
  };
}

export async function getSharedWithYouInbox(viewerUserId: string): Promise<SharedInboxItem[]> {
  const { data, error } = await supabase
    .from('shared_steps')
    .select('id, step_id, sender_user_id, shared_at, read_at, forked_to_step_id')
    .eq('recipient_user_id', viewerUserId)
    .order('shared_at', { ascending: false })
    .limit(50);
  if (error) {
    if (isMissingTableError(error, 'shared_steps')) {
      logger.warn('Shared-with-you inbox is unavailable because shared_steps is not in the active schema');
      return [];
    }
    logger.error('Failed to load shared-with-you inbox', error);
    throw error;
  }

  const rows = (data ?? []) as Pick<
    SharedStepRecord,
    'id' | 'step_id' | 'sender_user_id' | 'shared_at' | 'read_at' | 'forked_to_step_id'
  >[];
  if (rows.length === 0) return [];

  const stepIds = Array.from(new Set(rows.map((row) => row.step_id)));
  const senderIds = Array.from(new Set(rows.map((row) => row.sender_user_id)));

  const [{ data: steps }, { data: profiles }] = await Promise.all([
    supabase.from('timeline_steps').select('id, title, description').in('id', stepIds),
    supabase.from('profiles').select('id, full_name').in('id', senderIds),
  ]);

  const stepMap = new Map((steps ?? []).map((s: any) => [s.id, s]));
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  return rows.map((row) => {
    const step = stepMap.get(row.step_id);
    const profile = profileMap.get(row.sender_user_id);
    const senderName = (profile?.full_name as string | undefined) ?? 'Practitioner';
    const initials = senderName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase() ?? '')
      .join('');
    return {
      id: row.id,
      kind: 'step' as const,
      shared_step_id: row.id,
      step_id: row.step_id,
      sender_user_id: row.sender_user_id,
      sender_name: senderName,
      sender_initials: initials || 'PR',
      step_title: (step?.title as string | undefined) ?? 'Shared step',
      step_body: (step?.description as string | undefined) ?? '',
      shared_at: row.shared_at,
      read_at: row.read_at,
      forked_to_step_id: row.forked_to_step_id,
    } satisfies SharedInboxItem;
  });
}

export async function markSharedStepRead(sharedStepId: string): Promise<void> {
  const { error } = await supabase
    .from('shared_steps')
    .update({ read_at: new Date().toISOString() })
    .eq('id', sharedStepId);
  if (error) {
    logger.error('Failed to mark shared step read', error);
    throw error;
  }
}

export async function recordForkedSharedStep(input: {
  sharedStepId: string;
  forkedStepId: string;
}): Promise<void> {
  const { error } = await supabase
    .from('shared_steps')
    .update({ forked_to_step_id: input.forkedStepId, read_at: new Date().toISOString() })
    .eq('id', input.sharedStepId);
  if (error) {
    logger.error('Failed to record fork on shared step', error);
    throw error;
  }
}

export async function listSharedStepComments(sharedStepId: string): Promise<SharedStepCommentRecord[]> {
  const { data, error } = await supabase
    .from('shared_step_comments')
    .select('*')
    .eq('shared_step_id', sharedStepId)
    .order('created_at', { ascending: true });
  if (error) {
    logger.error('Failed to list shared step comments', error);
    throw error;
  }
  return (data ?? []) as SharedStepCommentRecord[];
}

export async function addSharedStepComment(input: {
  sharedStepId: string;
  commenterUserId: string;
  body: string;
}): Promise<SharedStepCommentRecord> {
  const { data, error } = await supabase
    .from('shared_step_comments')
    .insert({
      shared_step_id: input.sharedStepId,
      commenter_user_id: input.commenterUserId,
      body: input.body.trim(),
    })
    .select('*')
    .single();
  if (error) {
    logger.error('Failed to add shared step comment', error);
    throw error;
  }
  return data as SharedStepCommentRecord;
}

export async function claimShareLink(token: string): Promise<{ stepId: string; expiresAt: string } | null> {
  const { data, error } = await supabase.rpc('claim_share_token', { p_token: token });
  if (error) {
    logger.error('Failed to claim share token', error);
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    stepId: row.step_id as string,
    expiresAt: row.expires_at as string,
  };
}
