/**
 * POST /api/redeem
 *
 * Body: { token: string, userId: string }
 *
 * Resolves a redeem token, atomically marks it used, returns the blueprint id
 * and a session token the client can store locally for the 3-month free trial.
 *
 * 200 → { sessionToken, userId, firstStepId, blueprintId, alreadyUsed }
 * 400 → { error: 'invalid' | 'expired' | 'already-used' }
 */

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SAMPLE_TOKEN = 'HKDW-WLDS-2026-SAMPLE';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method-not-allowed' });
    return;
  }

  const body = (req.body ?? {}) as { token?: string; userId?: string };
  const token = (body.token ?? '').trim();
  const userId = (body.userId ?? '').trim();

  if (!token || !userId) {
    res.status(400).json({ error: 'invalid' });
    return;
  }

  if (token.toUpperCase() === SAMPLE_TOKEN && process.env.NODE_ENV !== 'production') {
    res.status(200).json({
      sessionToken: `sample-session-${Date.now()}`,
      userId,
      firstStepId: null,
      blueprintId: 'sample-blueprint',
      alreadyUsed: false,
    });
    return;
  }

  const { data, error } = await supabase.rpc('consume_redeem_token', {
    p_token: token,
    p_user_id: userId,
  });
  if (error) {
    console.error('consume_redeem_token failed', error);
    res.status(500).json({ error: 'server' });
    return;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    res.status(400).json({ error: 'expired' });
    return;
  }

  res.status(200).json({
    sessionToken: `redeem-${row.blueprint_id}-${Date.now()}`,
    userId,
    firstStepId: null,
    blueprintId: row.blueprint_id,
    alreadyUsed: Boolean(row.already_used),
  });
}
