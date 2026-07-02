/**
 * ShareTokenService
 *
 * Thin wrapper around the `create_share_token` / `revoke_share_token` /
 * `resolve_share_token` SQL RPCs (migration `20260513120000_share_tokens.sql`).
 * Used by:
 * - In-app callers (step detail "Share" button, blueprint settings) to mint
 *   tokens and build a `/share/<token>` URL for a coach/parent/etc.
 * - The public `app/share/[token].tsx` route to resolve tokens for
 *   unauthenticated viewers via the SECURITY DEFINER `resolve_share_token` RPC.
 *
 * The unified `share_tokens` table replaces the legacy per-table `share_token`
 * columns on `timeline_steps` / `sailor_race_preparation` for the new
 * `/share/*` surface. Legacy `/p/step/*` and `/p/strategy/*` routes still read
 * from those columns directly.
 */

import { Platform } from 'react-native';

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ShareTokenService');

export type ShareTargetType = 'step' | 'blueprint';

export interface ResolvedStepShare {
  target_type: 'step';
  step: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    starts_at: string | null;
    ends_at: string | null;
    due_at: string | null;
    completed_at: string | null;
    created_at: string;
    metadata: Record<string, unknown> | null;
  };
  author: { full_name: string | null; avatar_url: string | null } | null;
}

export interface ResolvedBlueprintShare {
  target_type: 'blueprint';
  blueprint: {
    id: string;
    title: string;
    slug: string | null;
    description: string | null;
    interest_id: string | null;
    subscriber_count: number | null;
    is_published: boolean | null;
  };
  author: { full_name: string | null; avatar_url: string | null } | null;
  step_count: number;
}

export type ResolvedShare = ResolvedStepShare | ResolvedBlueprintShare;

export type ShareResolveError = 'revoked' | 'expired' | 'rate_limited' | 'target_missing' | 'not_found';

/**
 * Mint a new share token. Caller must own the target (step or blueprint);
 * the RPC enforces ownership via auth.uid().
 */
export async function createShareToken(
  targetType: ShareTargetType,
  targetId: string,
  expiresAt?: Date | null,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_share_token', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_expires_at: expiresAt ? expiresAt.toISOString() : null,
  });

  if (error) {
    logger.warn('create_share_token failed', { targetType, targetId, message: error.message });
    throw new Error(error.message);
  }
  if (typeof data !== 'string') {
    throw new Error('create_share_token returned no token');
  }
  return data;
}

/** Revoke an existing token. Returns true when a row was updated. */
export async function revokeShareToken(token: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('revoke_share_token', { p_token: token });
  if (error) {
    logger.warn('revoke_share_token failed', { message: error.message });
    throw new Error(error.message);
  }
  return data === true;
}

/**
 * Resolve a token to its (redacted) payload. Returns either the resolved
 * payload or an error string ('revoked' | 'expired' | 'rate_limited' |
 * 'target_missing' | 'not_found'). Public — callable while signed out.
 */
export async function resolveShareToken(
  token: string,
): Promise<{ ok: true; payload: ResolvedShare } | { ok: false; error: ShareResolveError }> {
  const { data, error } = await supabase.rpc('resolve_share_token', { p_token: token });

  if (error) {
    logger.warn('resolve_share_token failed', { message: error.message });
    return { ok: false, error: 'not_found' };
  }
  if (data == null) {
    return { ok: false, error: 'not_found' };
  }
  if (typeof data === 'object' && 'error' in (data as Record<string, unknown>)) {
    const err = (data as { error?: string }).error;
    if (err === 'revoked' || err === 'expired' || err === 'rate_limited' || err === 'target_missing') {
      return { ok: false, error: err };
    }
    return { ok: false, error: 'not_found' };
  }
  return { ok: true, payload: data as ResolvedShare };
}

/**
 * Build the absolute `/share/<token>` URL for sharing externally.
 * On web uses `window.location.origin`; otherwise falls back to
 * EXPO_PUBLIC_API_URL or better.at.
 */
export function buildShareUrl(token: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/share/${token}`;
  }
  const base = process.env.EXPO_PUBLIC_API_URL || 'https://better.at';
  return `${base.replace(/\/$/, '')}/share/${token}`;
}
