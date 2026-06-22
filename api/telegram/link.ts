import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/telegram/link
 * Body: { code: string }
 * Auth: Bearer token (user JWT)
 *
 * Completes the Telegram account linking flow by associating a link_code
 * with the authenticated BetterAt user.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // --- Extract and validate bearer token ---
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  // User-scoped client for auth validation
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const userId = userData.user.id;

  // --- Validate request body ---
  const { code } = req.body ?? {};
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Missing or invalid code' });
    return;
  }

  // Service-role client for the linking operation (needs to update rows not owned by the user yet)
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- Find the link code ---
  const { data: linkRow, error: findError } = await supabase
    .from('telegram_links')
    .select('id, telegram_user_id, telegram_username, linked_at, link_code_expires_at')
    .eq('link_code', code.toUpperCase())
    .is('linked_at', null)
    .maybeSingle();

  if (findError) {
    console.error('Telegram link lookup error:', JSON.stringify(findError));
    console.error('Query was: link_code =', code.toUpperCase(), 'linked_at IS NULL');
    res.status(500).json({ error: 'Internal error' });
    return;
  }

  if (!linkRow) {
    res.status(400).json({ error: 'Invalid or expired link code' });
    return;
  }

  // Check expiry
  if (linkRow.link_code_expires_at && new Date(linkRow.link_code_expires_at) < new Date()) {
    res.status(400).json({ error: 'Link code has expired. Send a new message to the bot to get a fresh code.' });
    return;
  }

  // --- Complete the link ---
  const { data: updatedLink, error: updateError } = await supabase
    .from('telegram_links')
    .update({
      user_id: userId,
      linked_at: new Date().toISOString(),
      link_code: null,
      link_code_expires_at: null,
    })
    .eq('id', linkRow.id)
    .eq('link_code', code.toUpperCase())
    .is('linked_at', null)
    .select('id')
    .maybeSingle();

  if (updateError) {
    console.error('Telegram link update error:', updateError);
    res.status(500).json({ error: 'Failed to link account' });
    return;
  }

  if (!updatedLink) {
    res.status(400).json({ error: 'Invalid or expired link code' });
    return;
  }

  res.status(200).json({
    linked: true,
    telegram_username: linkRow.telegram_username,
    telegram_user_id: linkRow.telegram_user_id,
  });
}
