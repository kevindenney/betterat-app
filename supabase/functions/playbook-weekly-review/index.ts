/**
 * playbook-weekly-review
 *
 * Invoked from a "Generate weekly review" button (or on Playbook open if
 * >7 days since the last review). Input:
 *   { playbook_id: string, period_start?: string, period_end?: string }
 *
 * If period bounds are omitted, defaults to the last 7 days. Reads the
 * week's debriefs (timeline_steps.metadata.review), new/updated concepts,
 * and new resources, and asks Gemini to compile:
 *   - one weekly_review suggestion (summary_md + updated_pages)
 *   - one focus_suggestion (next week's focus)
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

    const { playbook_id, period_start, period_end } = await req.json();
    if (!playbook_id) return jsonResponse({ error: 'playbook_id required' }, 400);

    const { interest_id } = await assertPlaybookOwnership(
      supabase,
      userId,
      playbook_id,
    );

    const end = period_end ? new Date(period_end) : new Date();
    const start = period_start
      ? new Date(period_start)
      : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    // Pull week's debriefs
    const { data: steps = [] } = await supabase
      .from('timeline_steps')
      .select('id, title, description, metadata, starts_at')
      .eq('user_id', userId)
      .eq('interest_id', interest_id)
      .gte('starts_at', startISO)
      .lte('starts_at', endISO)
      .order('starts_at', { ascending: true });

    const stepsWithDebrief = (steps ?? []).filter(
      (s: any) => (s.metadata as Record<string, unknown>)?.review,
    );

    // Concept edits in the window — fetch body_md only for these (relevant context)
    const { data: concepts = [] } = await supabase
      .from('playbook_concepts')
      .select('id, title, body_md, updated_at')
      .eq('playbook_id', playbook_id)
      .gte('updated_at', startISO)
      .lte('updated_at', endISO);

    // New resources in the window
    const { data: resources = [] } = await supabase
      .from('playbook_resources')
      .select('id, title, created_at')
      .eq('playbook_id', playbook_id)
      .gte('created_at', startISO)
      .lte('created_at', endISO);

    // Fetch ALL concept titles (no body_md) for health check — lightweight query
    const { data: allConceptTitles = [] } = await supabase
      .from('playbook_concepts')
      .select('id, title, updated_at')
      .eq('interest_id', interest_id)
      .or(`playbook_id.eq.${playbook_id},playbook_id.is.null`);

    // Identify stale concepts (not updated in 60+ days)
    const sixtyDaysAgo = new Date(end.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const staleConcepts = (allConceptTitles ?? [])
      .filter((c: any) => c.updated_at < sixtyDaysAgo)
      .map((c: any) => ({ id: c.id, title: c.title, updated_at: c.updated_at }));

    const system = `You are BetterAt's Playbook coach. Compile a concise weekly review AND a knowledge health check for the user's practice.

Return ONLY a JSON object:
{
  "summary_md": "<markdown: 3-5 bullet summary of what happened and what was learned>",
  "focus_md": "<markdown: 1-3 focus areas for next week, grounded in the week's data>",
  "updated_pages": [{"type": "concept"|"resource", "id": "<uuid>", "note": "<one line>"}],
  "knowledge_health": {
    "contradictions": [{"concept_ids": ["<uuid>", "<uuid>"], "description": "<what contradicts>"}],
    "gaps": [{"topic": "<missing topic>", "description": "<what the playbook should cover but doesn't>"}]
  }
}

For knowledge_health:
- contradictions: Look at ALL concepts and flag any where the content conflicts (different advice on the same topic, outdated vs current info)
- gaps: Look at the debriefs and resources — are there topics the user is actively practicing that don't have a concept yet?
- Both can be empty arrays if nothing is found. Only flag genuine issues.`;

    const userPrompt = `WINDOW: ${startISO.slice(0, 10)} → ${endISO.slice(0, 10)}

DEBRIEFS (${stepsWithDebrief.length}):
${stepsWithDebrief.map((s: any) => `- ${s.title}\n  ${JSON.stringify(s.metadata.review)}`).join('\n')}

CONCEPTS EDITED THIS WEEK (${concepts?.length ?? 0}):
${(concepts ?? []).map((c: any) => `- [${c.id}] ${c.title}\n  ${(c.body_md || '').slice(0, 400)}`).join('\n')}

RESOURCES ADDED (${resources?.length ?? 0}):
${(resources ?? []).map((r: any) => `- [${r.id}] ${r.title}`).join('\n')}

ALL CONCEPT TITLES (${(allConceptTitles ?? []).length} total — for gap/contradiction analysis):
${(allConceptTitles ?? []).map((c: any) => `- [${c.id}] ${c.title}`).join('\n')}

STALE CONCEPTS (not updated in 60+ days):
${staleConcepts.length > 0 ? staleConcepts.map((c: any) => `- [${c.id}] ${c.title} (last updated: ${c.updated_at.slice(0, 10)})`).join('\n') : '(none)'}`;

    const { text: aiText } = await complete({
      task: 'playbook',
      system,
      messages: [{ role: 'user', content: userPrompt }],
      maxOutputTokens: 2500,
      temperature: 0.3,
    });

    const parsed = extractJson<{
      summary_md?: string;
      focus_md?: string;
      updated_pages?: Record<string, unknown>[];
      knowledge_health?: {
        contradictions?: { concept_ids: string[]; description: string }[];
        gaps?: { topic: string; description: string }[];
      };
    }>(aiText);

    const summary_md = parsed.summary_md ?? '(AI returned no summary.)';
    const updated_pages = parsed.updated_pages ?? [];

    // Build health check results — combine AI findings with programmatic stale check
    const knowledge_health = {
      contradictions: parsed.knowledge_health?.contradictions ?? [],
      gaps: parsed.knowledge_health?.gaps ?? [],
      stale_concepts: staleConcepts.map((c: any) => ({
        concept_id: c.id,
        title: c.title,
        last_updated: c.updated_at,
      })),
    };

    const rows: Parameters<typeof insertSuggestions>[1] = [
      {
        playbook_id,
        user_id: userId,
        kind: 'weekly_review',
        payload: {
          period_start: startISO,
          period_end: endISO,
          summary_md,
          focus_suggestion_md: parsed.focus_md ?? null,
          updated_pages,
          knowledge_health,
        },
        provenance: {
          source_step_ids: stepsWithDebrief.map((s: any) => s.id),
          source_concept_ids: (concepts ?? []).map((c: any) => c.id),
          source_resource_ids: (resources ?? []).map((r: any) => r.id),
          model: 'gemini-2.5-flash',
        },
      },
    ];

    if (parsed.focus_md) {
      rows.push({
        playbook_id,
        user_id: userId,
        kind: 'focus_suggestion',
        payload: { focus_md: parsed.focus_md },
        provenance: {
          source_step_ids: stepsWithDebrief.map((s: any) => s.id),
          model: 'gemini-2.5-flash',
        },
      });
    }

    const created = await insertSuggestions(supabase, rows);
    return jsonResponse({ suggestions_created: created });
  } catch (err) {
    console.error('playbook-weekly-review error', err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
    );
  }
});
