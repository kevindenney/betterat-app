/**
 * playbook-cross-interest
 *
 * Triggered on step create/edit from the client. Input:
 *   { step_id: string }
 *
 * Scans the user's *other* active Playbooks (interests other than the step's)
 * for items that might be useful for this step. Surfaces them as
 * `cross_interest_idea` suggestions with `payload.target_step_id` set.
 * The suggestion is then rendered as a "From your other Playbooks" card on
 * the step's Plan tab.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { complete } from '../_shared/ai/provider.ts';
import {
  authenticate,
  corsHeaders,
  extractJson,
  insertSuggestions,
  jsonResponse,
} from '../_shared/playbook.ts';

function keywordMatch(text: string, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
  const hay = text.toLowerCase();
  return tokens.some((t) => hay.includes(t));
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = await authenticate(req);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;

    const { step_id } = await req.json();
    if (!step_id) return jsonResponse({ error: 'step_id required' }, 400);

    // Load the step
    const { data: step, error: stepErr } = await supabase
      .from('timeline_steps')
      .select('id, user_id, interest_id, title, description')
      .eq('id', step_id)
      .single();
    if (stepErr) return jsonResponse({ error: stepErr.message }, 404);
    if (step.user_id !== userId) return jsonResponse({ error: 'Forbidden' }, 403);

    // Load the user's OTHER playbooks
    const { data: otherPlaybooks = [] } = await supabase
      .from('playbooks')
      .select('id, interest_id')
      .eq('user_id', userId)
      .neq('interest_id', step.interest_id);

    if (!otherPlaybooks || otherPlaybooks.length === 0) {
      return jsonResponse({ suggestions_created: 0, reason: 'no_other_playbooks' });
    }

    const otherIds = otherPlaybooks.map((p: any) => p.id);
    const query = `${step.title ?? ''} ${step.description ?? ''}`;

    // Pull candidate concepts + resources from other playbooks, filter by keyword overlap
    const { data: concepts = [] } = await supabase
      .from('playbook_concepts')
      .select('id, title, body_md, playbook_id')
      .in('playbook_id', otherIds)
      .limit(80);

    const { data: resources = [] } = await supabase
      .from('playbook_resources')
      .select('id, title, description, playbook_id')
      .in('playbook_id', otherIds)
      .limit(80);

    const candidates = [
      ...(concepts ?? [])
        .filter((c: any) => keywordMatch(`${c.title} ${c.body_md ?? ''}`, query))
        .map((c: any) => ({
          item_type: 'concept',
          item_id: c.id,
          source_playbook_id: c.playbook_id,
          title: c.title,
          body: c.body_md?.slice(0, 400) ?? '',
        })),
      ...(resources ?? [])
        .filter((r: any) => keywordMatch(`${r.title} ${r.description ?? ''}`, query))
        .map((r: any) => ({
          item_type: 'resource',
          item_id: r.id,
          source_playbook_id: r.playbook_id,
          title: r.title,
          body: r.description?.slice(0, 400) ?? '',
        })),
    ].slice(0, 12);

    if (candidates.length === 0) {
      return jsonResponse({ suggestions_created: 0, reason: 'no_candidates' });
    }

    const system = `You are BetterAt's cross-interest connector. Given a new step and candidate items from the user's OTHER Playbooks, pick 0–3 that would genuinely help with this step. Be selective — noise is worse than silence.

Return ONLY a JSON array:
[{ "item_type": "concept"|"resource", "item_id": "<uuid>", "target_playbook_id": "<source playbook uuid>", "rationale": "<one line>" }]`;

    const userPrompt = `STEP: ${step.title}
${step.description ?? ''}

CANDIDATES:
${candidates.map((c, i) => `[${i}] ${c.item_type} ${c.item_id} (playbook ${c.source_playbook_id}) — ${c.title}\n${c.body}`).join('\n\n')}`;

    const { text: aiText } = await complete({
      task: 'playbook',
      system,
      messages: [{ role: 'user', content: userPrompt }],
      maxOutputTokens: 800,
      temperature: 0.3,
    });

    let picks: {
      item_type?: 'concept' | 'resource';
      item_id?: string;
      target_playbook_id?: string;
      rationale?: string;
    }[] = [];
    try {
      picks = extractJson(aiText);
      if (!Array.isArray(picks)) picks = [];
    } catch {
      picks = [];
    }

    const valid = picks
      .filter((p) => p.item_id && p.item_type)
      .filter((p) =>
        candidates.some(
          (c) => c.item_id === p.item_id && c.item_type === p.item_type,
        ),
      )
      .slice(0, 3);

    // Cross-interest suggestions land on the ORIGINATING (source) playbook so
    // the accept handler can write a step_playbook_links row for the target
    // step. payload.target_step_id is the step we were called for.
    const rows = valid.map((p) => {
      const match = candidates.find(
        (c) => c.item_id === p.item_id && c.item_type === p.item_type,
      )!;
      return {
        playbook_id: match.source_playbook_id,
        user_id: userId,
        kind: 'cross_interest_idea',
        payload: {
          target_step_id: step_id,
          item_type: p.item_type,
          item_id: p.item_id,
          rationale: p.rationale,
        },
        provenance: {
          source_step_ids: [step_id],
          model: 'gemini-2.5-flash',
        },
      };
    });

    const created = await insertSuggestions(supabase, rows);
    return jsonResponse({ suggestions_created: created });
  } catch (err) {
    console.error('playbook-cross-interest error', err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
    );
  }
});
