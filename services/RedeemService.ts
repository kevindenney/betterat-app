import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('RedeemService');

export const SAMPLE_TOKEN = 'HKDW-WLDS-2026-SAMPLE';

export interface RedeemTokenInfo {
  token: string;
  blueprintId: string;
  source: string;
  validTo: string;
  alreadyUsed: boolean;
}

export interface RedeemBlueprintPreview {
  id: string;
  title: string;
  authorName: string;
  authorAffiliation: string | null;
  authorInitials: string;
  stepCount: number;
  durationMonths: number;
  capabilities: string[];
  subscriberCount: number;
}

const SAMPLE_INFO: RedeemTokenInfo = {
  token: SAMPLE_TOKEN,
  blueprintId: 'sample-blueprint',
  source: 'hkdw-2026',
  validTo: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString(),
  alreadyUsed: false,
};

const SAMPLE_PREVIEW: RedeemBlueprintPreview = {
  id: 'sample-blueprint',
  title: 'Prepare for the Dragon Worlds 2027.',
  authorName: 'Kevin Denney',
  authorAffiliation: 'RHKYC',
  authorInitials: 'KD',
  stepCount: 12,
  durationMonths: 6,
  capabilities: ['heavy-air helm', 'starts', 'wind reading', 'tactical', 'crew comms'],
  subscriberCount: 63,
};

function isSample(token: string): boolean {
  return token.toUpperCase() === SAMPLE_TOKEN;
}

function devEnv(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.env.NODE_ENV !== 'production'
  );
}

export async function resolveToken(token: string): Promise<RedeemTokenInfo | null> {
  if (isSample(token) && devEnv()) return SAMPLE_INFO;

  const { data, error } = await supabase.rpc('resolve_redeem_token', { p_token: token });
  if (error) {
    logger.error('resolve_redeem_token failed', error);
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    token: row.token,
    blueprintId: row.blueprint_id,
    source: row.source,
    validTo: row.valid_to,
    alreadyUsed: Boolean(row.already_used),
  };
}

export async function loadBlueprintPreview(blueprintId: string): Promise<RedeemBlueprintPreview | null> {
  if (blueprintId === SAMPLE_PREVIEW.id && devEnv()) return SAMPLE_PREVIEW;

  const { data: bp, error } = await supabase
    .from('timeline_blueprints')
    .select('id, title, duration_months, capability_goals, author_user_id')
    .eq('id', blueprintId)
    .maybeSingle();
  if (error || !bp) {
    logger.warn('Failed to load blueprint preview', error);
    return null;
  }

  const [{ data: author }, { count: stepCount }, { count: subscriberCount }] = await Promise.all([
    bp.author_user_id
      ? supabase.from('profiles').select('id, full_name').eq('id', bp.author_user_id).maybeSingle()
      : Promise.resolve({ data: null as { id: string; full_name?: string | null } | null }),
    supabase
      .from('blueprint_steps')
      .select('id', { count: 'exact', head: true })
      .eq('blueprint_id', blueprintId),
    supabase
      .from('blueprint_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('blueprint_id', blueprintId),
  ]);

  const authorName = (author as { full_name?: string | null } | null)?.full_name ?? 'Author';
  const initials = authorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return {
    id: (bp as { id: string }).id,
    title: (bp as { title: string }).title,
    authorName,
    authorAffiliation: null,
    authorInitials: initials || 'BP',
    stepCount: stepCount ?? 0,
    durationMonths: ((bp as { duration_months?: number | null }).duration_months) ?? 6,
    capabilities: ((bp as { capability_goals?: string[] | null }).capability_goals) ?? [],
    subscriberCount: subscriberCount ?? 0,
  };
}

export interface RedeemAcceptResult {
  sessionToken: string;
  userId: string;
  firstStepId: string | null;
  blueprintId: string;
  alreadyUsed: boolean;
}

export async function consumeTokenForUser(input: {
  token: string;
  userId: string;
}): Promise<RedeemAcceptResult> {
  if (isSample(input.token) && devEnv()) {
    return {
      sessionToken: `sample-session-${Date.now()}`,
      userId: input.userId,
      firstStepId: null,
      blueprintId: SAMPLE_INFO.blueprintId,
      alreadyUsed: false,
    };
  }

  const { data, error } = await supabase.rpc('consume_redeem_token', {
    p_token: input.token,
    p_user_id: input.userId,
  });
  if (error) {
    logger.error('consume_redeem_token failed', error);
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error('Token expired or invalid');
  }
  return {
    sessionToken: `redeem-${row.blueprint_id}-${Date.now()}`,
    userId: input.userId,
    firstStepId: null,
    blueprintId: row.blueprint_id,
    alreadyUsed: Boolean(row.already_used),
  };
}
