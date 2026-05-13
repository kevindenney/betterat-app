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
