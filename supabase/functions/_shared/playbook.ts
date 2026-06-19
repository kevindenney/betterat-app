/**
 * Shared helpers for Playbook edge functions.
 *
 * - CORS headers
 * - Auth resolution from the request
 * - Service-role Supabase client construction
 * - JSON extraction from Gemini responses (handles ```json fences)
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export interface AuthContext {
  userId: string;
  supabase: SupabaseClient;
}

export async function authenticate(req: Request): Promise<AuthContext | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Missing authorization' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('Missing required environment variable: SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (error || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

  return { userId: user.id, supabase };
}

/**
 * Authenticate EITHER a real user JWT (in-app callers via
 * `supabase.functions.invoke`, which attaches the session token) OR a
 * service-role bearer + `x-user-id` header (server-to-server callers like the
 * Telegram bot).
 *
 * Two non-obvious traps this navigates:
 *   1. `getUser()` rejects any service-role key ("missing sub claim"), so the
 *      bot path can never resolve a user from the JWT — it must name the acting
 *      user via `x-user-id`.
 *   2. The platform now injects a NEW-format secret key as the function's
 *      `SUPABASE_SERVICE_ROLE_KEY`, which differs from the legacy JWT service
 *      key callers still hold — so we must NOT string-match the incoming bearer
 *      against the env key. Instead we use the incoming bearer AS the client:
 *      a genuine service key bypasses RLS and works; a forged/invalid one fails
 *      every query, so this is self-securing (no escalation beyond what holding
 *      a real service key already grants).
 */
export async function authenticateUserOrService(
  req: Request,
): Promise<AuthContext | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Missing authorization' }, 401);
  const bearer = authHeader.replace('Bearer ', '').trim();

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('Missing required environment variable: SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');

  // Path 1 — user JWT (in-app). Resolve the user with a service-role client.
  const serviceClient = createClient(supabaseUrl, serviceKey);
  const { data: { user } } = await serviceClient.auth.getUser(bearer);
  if (user) return { userId: user.id, supabase: serviceClient };

  // Path 2 — service-role bearer + x-user-id (bot / server-to-server). Use the
  // incoming bearer as the client key so only a genuine service key works.
  const xUserId = req.headers.get('x-user-id');
  if (xUserId) {
    return { userId: xUserId, supabase: createClient(supabaseUrl, bearer) };
  }

  return jsonResponse({ error: 'Unauthorized' }, 401);
}

/**
 * Extract a JSON object/array from a Gemini text response.
 * Tolerates ```json fences and leading/trailing prose.
 */
export function extractJson<T = unknown>(text: string): T {
  const cleaned = text.trim();
  // Try fenced block first
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : cleaned;
  // Find first { or [
  const firstBrace = candidate.search(/[[{]/);
  const lastBrace = Math.max(
    candidate.lastIndexOf('}'),
    candidate.lastIndexOf(']'),
  );
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No JSON object found in response');
  }
  const slice = candidate.slice(firstBrace, lastBrace + 1);
  return JSON.parse(slice) as T;
}

/**
 * Verify the user owns the playbook (or throw).
 */
export async function assertPlaybookOwnership(
  supabase: SupabaseClient,
  userId: string,
  playbookId: string,
): Promise<{ interest_id: string }> {
  const { data, error } = await supabase
    .from('playbooks')
    .select('id, user_id, interest_id')
    .eq('id', playbookId)
    .single();
  if (error) throw new Error(`Playbook fetch failed: ${error.message}`);
  if (data.user_id !== userId) throw new Error('Forbidden: not your playbook');
  return { interest_id: data.interest_id };
}

/**
 * Insert one or more suggestions in a single call.
 */
export async function insertSuggestions(
  supabase: SupabaseClient,
  rows: {
    playbook_id: string;
    user_id: string;
    kind: string;
    payload: Record<string, unknown>;
    provenance: Record<string, unknown>;
  }[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const withStatus = rows.map((r) => ({ ...r, status: 'pending' }));
  const { error } = await supabase.from('playbook_suggestions').insert(withStatus);
  if (error) throw new Error(`Suggestion insert failed: ${error.message}`);
  return rows.length;
}
