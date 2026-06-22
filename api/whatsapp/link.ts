import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/whatsapp/link
 * Body: {code: string}
 * Auth: Bearer token (user JWT)
 *
 * Completes the WhatsApp account linking flow by associating a link_code
 * minted by the webhook with the authenticated BetterAt user.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({error: 'Method not allowed'});
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({error: 'Unauthorized'});
    return;
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    res.status(401).json({error: 'Unauthorized'});
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    res.status(500).json({error: 'Server not configured'});
    return;
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {headers: {Authorization: `Bearer ${token}`}},
    auth: {persistSession: false, autoRefreshToken: false},
  });

  const {data: userData, error: userError} = await userClient.auth.getUser(token);
  if (userError || !userData.user) {
    res.status(401).json({error: 'Unauthorized'});
    return;
  }

  const {code} = req.body ?? {};
  if (!code || typeof code !== 'string') {
    res.status(400).json({error: 'Missing or invalid code'});
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });

  const normalizedCode = code.toUpperCase();
  const {data: linkRow, error: findError} = await supabase
    .from('whatsapp_links')
    .select('id, whatsapp_phone, whatsapp_profile_name, linked_at, link_code_expires_at')
    .eq('link_code', normalizedCode)
    .is('linked_at', null)
    .maybeSingle();

  if (findError) {
    console.error('WhatsApp link lookup error:', JSON.stringify(findError));
    res.status(500).json({error: 'Internal error'});
    return;
  }

  if (!linkRow) {
    res.status(400).json({error: 'Invalid or expired link code'});
    return;
  }

  if (linkRow.link_code_expires_at && new Date(linkRow.link_code_expires_at) < new Date()) {
    res.status(400).json({error: 'Link code has expired. Send a new message to the bot to get a fresh code.'});
    return;
  }

  const {data: updatedLink, error: updateError} = await supabase
    .from('whatsapp_links')
    .update({
      user_id: userData.user.id,
      linked_at: new Date().toISOString(),
      link_code: null,
      link_code_expires_at: null,
      is_active: true,
    })
    .eq('id', linkRow.id)
    .eq('link_code', normalizedCode)
    .is('linked_at', null)
    .select('id')
    .maybeSingle();

  if (updateError) {
    console.error('WhatsApp link update error:', updateError);
    res.status(500).json({error: 'Failed to link account'});
    return;
  }

  if (!updatedLink) {
    res.status(400).json({error: 'Invalid or expired link code'});
    return;
  }

  res.status(200).json({
    linked: true,
    whatsapp_phone: linkRow.whatsapp_phone,
    whatsapp_profile_name: linkRow.whatsapp_profile_name,
  });
}
