/**
 * AI Race Comms Draft edge function.
 *
 * Ported from the (paused) Vercel route api/ai/races/[id]/comms/draft.ts.
 * Drafts race committee communications (SMS / email / notice board) with Gemini
 * Flash and records them in ai_notifications + ai_activity_logs.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { callGemini } from '../_shared/gemini.ts';
import { isSailingWorkspace, resolveClubId, extractJson } from '../_shared/clubAuth.ts';

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
  const raceId = body?.raceId;
  if (!raceId || typeof raceId !== 'string') {
    return json({ error: 'raceId is required' }, 400);
  }
  const updateType = body?.update_type ?? body?.topic ?? 'general update';

  const userClubId = await resolveClubId(supabase, user.id);
  if (!userClubId) return json({ error: 'Organization context required' }, 403);
  if (!(await isSailingWorkspace(supabase, userClubId))) {
    return json(
      { error: 'Race communications are only available in sailing workspaces.', code: 'DOMAIN_GATED' },
      403,
    );
  }

  const started = Date.now();
  try {
    const { data: race, error: raceError } = await supabase
      .from('club_races')
      .select('*')
      .eq('id', raceId)
      .maybeSingle();
    if (raceError || !race) throw new Error('Race not found');

    const clubId = race.club_id as string;

    const { data: regatta } = await supabase
      .from('club_events')
      .select('id, title, start_date, end_date')
      .eq('id', race.event_id)
      .maybeSingle();

    const system =
      `You draft concise race committee communications for a sailing club.\n` +
      `Respond ONLY with a JSON object matching exactly this shape (no markdown fences, no prose outside JSON):\n` +
      `{"urgency": "low" | "medium" | "high", "sms": string, "email": string, "notice_board": string, "suggested_send_time": string | null}\n` +
      `"sms" is a short text-message version. "email" is a fuller version. ` +
      `"notice_board" is a posting for the club notice board.`;

    const userContent = [
      `Race: ${race.name ?? race.id}`,
      `Scheduled start: ${race.start_time ?? 'TBD'}`,
      regatta ? `Regatta: ${regatta.title}` : '',
      `Update type: ${updateType}`,
    ]
      .filter(Boolean)
      .join('\n');

    const text = await callGemini({
      system,
      messages: [{ role: 'user', parts: [{ text: userContent }] }],
      maxOutputTokens: 700,
      temperature: 0.2,
    });

    const parsed = extractJson(text);
    const urgency = ['low', 'medium', 'high'].includes(parsed?.urgency) ? parsed.urgency : 'medium';
    const result = {
      urgency,
      sms: typeof parsed?.sms === 'string' ? parsed.sms : '',
      email: typeof parsed?.email === 'string' ? parsed.email : '',
      notice_board: typeof parsed?.notice_board === 'string' ? parsed.notice_board : '',
      suggested_send_time:
        typeof parsed?.suggested_send_time === 'string' ? parsed.suggested_send_time : null,
    };
    if (!result.email && !result.sms) throw new Error('AI response missing communications');

    await supabase.from('ai_notifications').insert({
      club_id: clubId,
      created_by: user.id,
      race_id: raceId,
      topic: updateType,
      audience: body?.audience ?? null,
      channels: body?.channels ?? ['email', 'sms'],
      message: result.email,
      suggested_send_at: result.suggested_send_time,
      metadata: { sms: result.sms, notice_board: result.notice_board, urgency: result.urgency },
    });

    await supabase.from('ai_activity_logs').insert({
      club_id: clubId,
      user_id: user.id,
      skill: 'race_comms_draft',
      status: 'success',
      duration_ms: Date.now() - started,
      request_payload: { raceId, updateType },
      response_payload: { urgency: result.urgency, suggested_send: result.suggested_send_time },
    });

    return json(result, 200);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'unknown error';
    console.error('ai-race-comms-draft error:', errorMessage);
    await supabase.from('ai_activity_logs').insert({
      club_id: userClubId,
      user_id: user.id,
      skill: 'race_comms_draft',
      status: 'error',
      error_message: errorMessage,
    });
    return json({ error: 'Unable to generate communications', detail: errorMessage }, 500);
  }
});
