/**
 * POST /api/account/claim
 *
 * Body: { sessionToken: string, email: string }
 *
 * Upgrades a session-level account (anonymous-but-persistent) to an
 * email-backed account by stamping claimed_email + claimed_at on the
 * matching session_accounts row. The actual email-magic-link send is
 * delegated to Supabase Auth via the client SDK after this returns OK.
 *
 * 200 → { userId, status: 'claimed' }
 * 400 → { error: 'invalid' | 'expired' | 'not-found' }
 */

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method-not-allowed' });
    return;
  }

  const body = (req.body ?? {}) as { sessionToken?: string; email?: string };
  const sessionToken = (body.sessionToken ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();

  if (!sessionToken || !email || !email.includes('@')) {
    res.status(400).json({ error: 'invalid' });
    return;
  }

  const { data: existing, error: lookupError } = await supabase
    .from('session_accounts')
    .select('id, user_id, expires_at, claimed_at')
    .eq('session_token', sessionToken)
    .maybeSingle();
  if (lookupError) {
    console.error('session_accounts lookup failed', lookupError);
    res.status(500).json({ error: 'server' });
    return;
  }
  if (!existing) {
    res.status(400).json({ error: 'not-found' });
    return;
  }
  if (new Date(existing.expires_at as string).getTime() < Date.now()) {
    res.status(400).json({ error: 'expired' });
    return;
  }

  const { error: updateError } = await supabase
    .from('session_accounts')
    .update({
      claimed_email: email,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', (existing as { id: string }).id);
  if (updateError) {
    console.error('session_accounts claim failed', updateError);
    res.status(500).json({ error: 'server' });
    return;
  }

  res.status(200).json({
    userId: (existing as { user_id: string }).user_id,
    status: 'claimed',
  });
}
