/**
 * playbook-pattern-detect
 *
 * On-demand analyzer. Input:
 *   { playbook_id: string, lookback_days?: number }
 *
 * Reads all debriefs for the playbook's interest over the lookback window
 * (default 60 days) and asks Gemini for cross-debrief correlations.
 * Each pattern becomes a `pattern_detected` suggestion.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { complete } from '../_shared/ai/provider.ts';
import {
  assertPlaybookOwnership,
  authenticate,
  corsHeaders,
  extractJson,
  insertSuggestions,
  jsonResponse,
} from '../_shared/playbook.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = await authenticate(req);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;

    const { playbook_id, lookback_days = 60 } = await req.json();
    if (!playbook_id) return jsonResponse({ error: 'playbook_id required' }, 400);

    const { interest_id } = await assertPlaybookOwnership(
      supabase,
      userId,
      playbook_id,
    );

    const since = new Date(Date.now() - lookback_days * 24 * 60 * 60 * 1000).toISOString();

    const { data: steps = [] } = await supabase
      .from('timeline_steps')
      .select('id, title, starts_at, metadata')
      .eq('user_id', userId)
      .eq('interest_id', interest_id)
      .gte('starts_at', since)
      .order('starts_at', { ascending: true })
      .limit(100);

    const withDebrief = (steps ?? []).filter(
      (s: any) => (s.metadata as Record<string, unknown>)?.review,
    );

    if (withDebrief.length < 3) {
      return jsonResponse({
        suggestions_created: 0,
        reason: 'insufficient_data',
      });
    }

    const system = `You are BetterAt's Playbook pattern detector. You identify recurring correlations across a user's practice debriefs — things like "X happens when Y" or "mistake Z appears in condition W".

Return ONLY a JSON array of 0–5 patterns:
[{
  "title": "<short headline>",
  "body_md": "<markdown: what the pattern is, the conditions, the evidence>",
  "evidence": [{"type": "step", "id": "<uuid>", "note": "<one line>"}]
}]

Be rigorous: only surface patterns with ≥2 supporting debriefs. Return [] if nothing holds up.`;

    const userPrompt = `DEBRIEFS (${withDebrief.length}):
${withDebrief.map((s: any) => `[${s.id}] ${s.starts_at?.slice(0, 10)} — ${s.title}\n${JSON.stringify(s.metadata.review)}`).join('\n\n')}`;

    const { text: aiText } = await complete({
      task: 'playbook',
      system,
      messages: [{ role: 'user', content: userPrompt }],
      maxOutputTokens: 2000,
      temperature: 0.3,
    });

    let patterns: {
      title?: string;
      body_md?: string;
      evidence?: Record<string, unknown>[];
    }[] = [];
    try {
      patterns = extractJson(aiText);
      if (!Array.isArray(patterns)) patterns = [];
    } catch {
      patterns = [];
    }

    const rows = patterns
      .filter((p) => p.title && p.body_md)
      .slice(0, 5)
      .map((p) => ({
        playbook_id,
        user_id: userId,
        kind: 'pattern_detected',
        payload: {
          title: p.title,
          body_md: p.body_md,
          evidence: p.evidence ?? [],
        },
        provenance: {
          source_step_ids: withDebrief.map((s: any) => s.id),
          model: 'gemini-2.5-flash',
        },
      }));

    const created = await insertSuggestions(supabase, rows);
    return jsonResponse({ suggestions_created: created });
  } catch (err) {
    console.error('playbook-pattern-detect error', err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
    );
  }
});
