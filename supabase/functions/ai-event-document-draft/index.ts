/**
 * AI Event Document Draft edge function.
 *
 * Ported from the (paused) Vercel route api/ai/events/[id]/documents/draft.ts.
 * Drafts a sailing event document (NOR / SI / amendment) with Gemini Flash and
 * records it in ai_generated_documents + ai_activity_logs.
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

type DocumentType = 'nor' | 'si' | 'amendment';

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
  const eventId = body?.eventId;
  if (!eventId || typeof eventId !== 'string') {
    return json({ error: 'eventId is required' }, 400);
  }
  const documentType: DocumentType = (['nor', 'si', 'amendment'] as const).includes(body?.document_type)
    ? body.document_type
    : 'nor';

  const userClubId = await resolveClubId(supabase, user.id);
  if (!userClubId) return json({ error: 'Organization context required' }, 403);
  if (!(await loadClubContext(supabase, userClubId)).isSailing) {
    return json(
      { error: 'Event document drafting is only available in sailing workspaces.', code: 'DOMAIN_GATED' },
      403,
    );
  }

  const started = Date.now();
  try {
    const { data: event, error: eventError } = await supabase
      .from('club_events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();
    if (eventError || !event) throw new Error('Event not found');

    const clubId = event.club_id as string;
    const clubName = (await loadClubContext(supabase, clubId)).name ?? 'the club';

    const { data: previousDocuments } = await supabase
      .from('ai_generated_documents')
      .select('document_type, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(5);

    const previous =
      (previousDocuments ?? [])
        .map((doc: { document_type: string; created_at: string }) =>
          `- ${doc.document_type.toUpperCase()} (created ${doc.created_at})`,
        )
        .join('\n') || 'None';

    const system =
      `You are assisting ${clubName} with race documentation. ` +
      `Use a professional, concise tone.\n` +
      `Respond ONLY with a JSON object matching exactly this shape (no markdown fences, no prose outside JSON):\n` +
      `{"title": string, "markdown": string, "sections": [{"heading": string, "body": string}], "confidence": number}\n` +
      `"markdown" must be valid Markdown with clear headings. "confidence" is 0-1.`;

    const userContent = [
      `Club: ${clubName}`,
      `Event: ${event.title}`,
      `Dates: ${event.start_date} – ${event.end_date}`,
      `Location: ${event.location_name ?? 'TBD'}`,
      `Document type: ${documentType.toUpperCase()}`,
      `Previous AI documents:\n${previous}`,
      documentType === 'nor'
        ? 'Include sections for eligibility, schedule of races, fees, and communications.'
        : documentType === 'si'
          ? 'Provide marks, courses, penalties, scoring, and safety instructions.'
          : 'Describe the amendment clearly with change tracking and effective time.',
    ].join('\n\n');

    const text = await callGemini({
      system,
      messages: [{ role: 'user', parts: [{ text: userContent }] }],
      maxOutputTokens: 1800,
      temperature: 0.4,
    });

    const parsed = extractJson(text);
    const result = {
      title: typeof parsed?.title === 'string' ? parsed.title : event.title,
      markdown: typeof parsed?.markdown === 'string' ? parsed.markdown : '',
      sections: Array.isArray(parsed?.sections) ? parsed.sections : [],
      confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : null,
    };
    if (!result.markdown) throw new Error('AI response missing markdown');

    await supabase.from('ai_generated_documents').insert({
      club_id: clubId,
      created_by: user.id,
      event_id: eventId,
      document_type: documentType,
      draft_text: result.markdown,
      metadata: { title: result.title, sections: result.sections },
      confidence: result.confidence,
    });

    await supabase.from('ai_activity_logs').insert({
      club_id: clubId,
      user_id: user.id,
      skill: 'event_document_draft',
      status: 'success',
      duration_ms: Date.now() - started,
      request_payload: { eventId, documentType },
      response_payload: { documentTitle: result.title },
    });

    return json(result, 200);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'unknown error';
    console.error('ai-event-document-draft error:', errorMessage);
    await supabase.from('ai_activity_logs').insert({
      club_id: userClubId,
      user_id: user.id,
      skill: 'event_document_draft',
      status: 'error',
      error_message: errorMessage,
    });
    return json({ error: 'Unable to generate document', detail: errorMessage }, 500);
  }
});
