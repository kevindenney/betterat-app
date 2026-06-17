/**
 * AI Club Support edge function.
 *
 * Ported from the (paused) Vercel route api/ai/club/support.ts. Answers a club
 * member's question using the club's profile + recent shared conversation,
 * generated with Gemini Flash. Persists the turn to ai_conversations and logs
 * to ai_activity_logs.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { callGemini } from '../_shared/gemini.ts';
import { loadClubContext, resolveClubId, extractJson } from '../_shared/clubAuth.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface ClubSummary {
  clubId: string;
  name: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401);

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);

  const body = await req.json().catch(() => ({}));
  const message = body?.message;
  if (!message || typeof message !== 'string') {
    return json({ error: 'message is required' }, 400);
  }

  const clubId = (typeof body?.clubId === 'string' && body.clubId) ||
    (await resolveClubId(supabase, user.id));
  if (!clubId) return json({ error: 'Organization context required' }, 403);

  const clubContext = await loadClubContext(supabase, clubId);
  if (!clubContext.isSailing) {
    return json(
      { error: 'Club support AI is only available in sailing workspaces.', code: 'DOMAIN_GATED' },
      403,
    );
  }

  const started = Date.now();
  try {
    const clubSummary: ClubSummary = {
      clubId,
      name: clubContext.name ?? 'the club',
    };

    const { data: historyData } = await supabase
      .from('club_ai_messages')
      .select('role, message')
      .eq('club_id', clubId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(10);

    const history = (historyData ?? [])
      .slice(-6)
      .map((entry: { role: string; message: string }) =>
        `${entry.role === 'assistant' ? 'Assistant' : 'Member'}: ${entry.message}`,
      )
      .join('\n');

    const system =
      `You help members of ${clubSummary.name}, a sailing club. Provide accurate, ` +
      `polite answers. If unsure, ask the member to contact the club office.\n` +
      `Respond ONLY with a JSON object matching exactly this shape (no markdown, no prose outside JSON):\n` +
      `{"reply": string, "suggested_action": string | null, "needs_handoff": boolean}\n` +
      `"reply" is your answer to the member. "suggested_action" is a short next step ` +
      `(or null). "needs_handoff" is true if a human at the club should follow up.`;

    const userContent = [history, `Member: ${message}`].filter(Boolean).join('\n');

    const text = await callGemini({
      system,
      messages: [{ role: 'user', parts: [{ text: userContent }] }],
      maxOutputTokens: 700,
      temperature: 0.3,
    });

    const parsed = extractJson(text);
    const reply = typeof parsed?.reply === 'string' ? parsed.reply : '';
    if (!reply) throw new Error('AI response missing reply');
    const result = {
      reply,
      suggested_action:
        typeof parsed?.suggested_action === 'string' ? parsed.suggested_action : null,
      needs_handoff: Boolean(parsed?.needs_handoff),
    };

    const { error: persistError } = await supabase.from('club_ai_messages').insert([
      { club_id: clubId, user_id: user.id, role: 'user', message },
      {
        club_id: clubId,
        user_id: user.id,
        role: 'assistant',
        message: result.reply,
        metadata: {
          suggested_action: result.suggested_action,
          needs_handoff: result.needs_handoff,
        },
      },
    ]);
    if (persistError) {
      console.error('ai-club-support persist error:', persistError.message);
    }

    await supabase.from('ai_activity_logs').insert({
      club_id: clubId,
      user_id: user.id,
      skill: 'support_chat',
      status: 'success',
      duration_ms: Date.now() - started,
      request_payload: { message },
      response_payload: { suggested_action: result.suggested_action },
    });

    return json(result, 200);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'unknown error';
    console.error('ai-club-support error:', errorMessage);
    await supabase.from('ai_activity_logs').insert({
      club_id: clubId,
      user_id: user.id,
      skill: 'support_chat',
      status: 'error',
      error_message: errorMessage,
    });
    return json({ error: 'Unable to generate reply', detail: errorMessage }, 500);
  }
});
