/**
 * POST /api/v1/partner/:partnerId/mint-token
 *
 * Partner-authenticated endpoint that mints (or re-fetches) a per-user
 * BetterAt redeem token. Counterpart to DragonWorlds' /api/betterat/redeem
 * proxy at https://github.com/kevindenney/DragonWorldsHK2027 — that proxy
 * sends competitor metadata + a Bearer partner key, and expects either a
 * fresh redeem_url or a 409 if the user has already consumed their token.
 *
 * Auth: Authorization: Bearer <env: HKDW_PARTNER_KEY>
 *
 * Body: {
 *   hkdw_user_id: string  (required — drives the deterministic token)
 *   competitor_id?: string
 *   boat_class?: string
 *   sail_number?: string
 *   club?: string
 * }
 *
 * Idempotency: tokens are deterministic per hkdw_user_id, so retries return
 * the same token whether or not it has been consumed. The DragonWorlds
 * proxy already passes x-idempotency-key = hkdw_user_id — we double up
 * with deterministic generation so concurrent calls also collapse cleanly.
 *
 * Responses:
 *   200 → { redeem_url, expires_at }                 — token available
 *   409 → { redeem_url, error: 'already_used' }      — sailor already redeemed
 *   400 → { error: 'missing_hkdw_user_id' }
 *   401 → { error: 'invalid_partner_key' }
 *   503 → { error: 'not_configured' | 'service-unavailable' }
 */

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const REDEEM_BASE = process.env.BETTERAT_REDEEM_BASE_URL || 'https://www.better.at';
const TOKEN_TTL_DAYS = 180;

interface PartnerConfig {
  partnerKey: string;
  blueprintSlug: string;
  tokenPrefix: string;
}

function getPartnerConfig(partnerId: string): PartnerConfig | null {
  if (partnerId === 'hkdw-2027') {
    return {
      partnerKey: process.env.HKDW_PARTNER_KEY || '',
      blueprintSlug: 'dragon-worlds-2027-peak-performance',
      tokenPrefix: 'HKDW-2027',
    };
  }
  return null;
}

function deterministicToken(prefix: string, userId: string): string {
  // Token visible in redeem URLs — keep readable, predictable, capped.
  const cleaned = userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24).toUpperCase();
  return `${prefix}-${cleaned}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const partnerId = String(req.query.partnerId || '').toLowerCase();
  const config = getPartnerConfig(partnerId);
  if (!config) {
    res.status(404).json({ error: 'unknown_partner' });
    return;
  }
  if (!config.partnerKey) {
    console.error(`[partner/${partnerId}/mint-token] missing HKDW_PARTNER_KEY env var`);
    res.status(503).json({ error: 'not_configured' });
    return;
  }

  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${config.partnerKey}`) {
    res.status(401).json({ error: 'invalid_partner_key' });
    return;
  }

  const body = (req.body ?? {}) as { hkdw_user_id?: string };
  const userId = (body.hkdw_user_id ?? '').trim();
  if (!userId) {
    res.status(400).json({ error: 'missing_hkdw_user_id' });
    return;
  }

  // Resolve blueprint UUID once per request — slug is the stable handle
  // outside the DB so the endpoint doesn't break when the blueprint is
  // recreated, but the redeem_tokens row needs the UUID FK.
  const { data: blueprint, error: blueprintErr } = await supabase
    .from('timeline_blueprints')
    .select('id')
    .eq('slug', config.blueprintSlug)
    .maybeSingle();

  if (blueprintErr || !blueprint?.id) {
    console.error(`[partner/${partnerId}/mint-token] blueprint lookup failed:`, blueprintErr, 'slug:', config.blueprintSlug);
    res.status(503).json({ error: 'service-unavailable' });
    return;
  }

  const token = deterministicToken(config.tokenPrefix, userId);
  const validTo = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error: insertErr } = await supabase
    .from('redeem_tokens')
    .insert({
      token,
      blueprint_id: blueprint.id,
      source: 'partner',
      valid_to: validTo,
    });

  // 23505 = unique_violation — existing row for this user, fall through to read.
  if (insertErr && insertErr.code !== '23505') {
    console.error(`[partner/${partnerId}/mint-token] insert failed:`, insertErr);
    res.status(503).json({ error: 'service-unavailable' });
    return;
  }

  const { data: row, error: readErr } = await supabase
    .from('redeem_tokens')
    .select('token, valid_to, used_at')
    .eq('token', token)
    .maybeSingle();

  if (readErr || !row) {
    console.error(`[partner/${partnerId}/mint-token] read failed:`, readErr);
    res.status(503).json({ error: 'service-unavailable' });
    return;
  }

  const redeemUrl = `${REDEEM_BASE.replace(/\/$/, '')}/r/${row.token}`;

  if (row.used_at) {
    res.status(409).json({ redeem_url: redeemUrl, error: 'already_used' });
    return;
  }

  res.status(200).json({
    redeem_url: redeemUrl,
    expires_at: row.valid_to,
  });
}
