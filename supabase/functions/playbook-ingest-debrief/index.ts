/**
 * playbook-ingest-debrief
 *
 * Invoked from the client after a timeline_steps debrief save. Input:
 *   { step_id: string }
 *
 * Reads the step (debrief lives in metadata.review), looks up the user's
 * playbook for the step's interest, gathers linked concepts, and asks
 * Gemini for 0–3 concept_update suggestions. All writes land in
 * playbook_suggestions with full provenance.
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = await authenticate(req);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;

    const body = await req.json();
    const { step_id } = body;
    if (!step_id) return jsonResponse({ error: 'step_id required' }, 400);

    // Load the step
    const { data: step, error: stepErr } = await supabase
      .from('timeline_steps')
      .select('id, user_id, interest_id, title, description, metadata')
      .eq('id', step_id)
      .single();
    if (stepErr) {
      return jsonResponse({ error: stepErr.message, detail: stepErr }, 404);
    }
    if (step.user_id !== userId) return jsonResponse({ error: 'Forbidden' }, 403);

    const review = (step.metadata as Record<string, unknown>)?.review as
      | Record<string, unknown>
      | undefined;
    if (!review) {
      return jsonResponse({ suggestions_created: 0, reason: 'no_debrief' });
    }

    // Find the playbook for this (user, interest)
    const { data: playbook } = await supabase
      .from('playbooks')
      .select('id')
      .eq('user_id', userId)
      .eq('interest_id', step.interest_id)
      .maybeSingle();
    if (!playbook) {
      return jsonResponse({ suggestions_created: 0, reason: 'no_playbook' });
    }

    // Load ALL concepts visible to this playbook (personal + inherited baselines for this interest)
    const { data: allConcepts = [] } = await supabase
      .from('playbook_concepts')
      .select('id, title, body_md')
      .or(`playbook_id.eq.${playbook.id},and(playbook_id.is.null,interest_id.eq.${step.interest_id})`);
    const playbookConcepts = (allConcepts ?? []) as { id: string; title: string; body_md: string }[];

    // Also load linked concepts from step_playbook_links for extra context
    const { data: links = [] } = await supabase
      .from('step_playbook_links')
      .select('item_id')
      .eq('step_id', step_id)
      .eq('item_type', 'concept');
    const linkedIds = new Set((links ?? []).map((l) => l.item_id as string));

    const system = `You are BetterAt's Playbook coach. You compile a user's personal knowledge base from their practice debriefs.

Given a completed step's debrief and the user's playbook concepts, propose 0–3 suggestions. Each suggestion must be one of:
1. concept_update — update an existing concept with new insight. MUST include target_concept_id.
2. concept_create — create a brand new concept when the debrief reveals knowledge that doesn't fit any existing concept. Do NOT include target_concept_id.

CRITICAL: For concept_update, the body_md must MERGE new insights INTO the existing concept body:
- Preserve ALL existing content from the concept
- ADD new bullet points, paragraphs, or sections with the fresh insight from the debrief
- Use markdown formatting (headings, bullets, bold for key terms)
- The result should be richer than before, not a replacement

BACKLINKING: For each proposal, also include "related_concept_ids" — an array of existing concept UUIDs that are meaningfully related to this concept (either the target or the new one). Look for topical overlap, causal relationships, or concepts that reference similar techniques/ideas. Include 0-5 related concept IDs.

Return ONLY a JSON array. Each item:
  { "type": "concept_update"|"concept_create", "target_concept_id": "<uuid or omit for create>", "title": "<concept title>", "body_md": "<merged markdown that builds on existing content>", "rationale": "<one-sentence why>", "related_concept_ids": ["<uuid>", ...] }

If nothing meaningful was learned, return [].`;

    const userPrompt = `STEP: ${step.title}
${step.description ?? ''}

DEBRIEF:
${JSON.stringify(review, null, 2)}

PLAYBOOK CONCEPTS:
${playbookConcepts.length === 0 ? '(none — this is a new playbook with no concepts yet)' : playbookConcepts.map(c => `- [${c.id}] ${c.title}${linkedIds.has(c.id) ? ' (LINKED TO THIS STEP)' : ''}\n${c.body_md}`).join('\n\n')}`;

    const { text: aiText } = await complete({
      task: 'playbook',
      system,
      messages: [{ role: 'user', content: userPrompt }],
      maxOutputTokens: 1200,
      temperature: 0.3,
    });

    let proposals: {
      type?: string;
      target_concept_id?: string;
      title?: string;
      body_md?: string;
      rationale?: string;
      related_concept_ids?: string[];
    }[] = [];
    try {
      proposals = extractJson(aiText);
      if (!Array.isArray(proposals)) proposals = [];
    } catch {
      proposals = [];
    }
    const conceptIdSet = new Set(playbookConcepts.map((c) => c.id));
    const valid = proposals
      .filter((p) => {
        if (p.type === 'concept_create') return p.title && p.body_md;
        // concept_update — must reference an existing playbook concept
        return p.target_concept_id && conceptIdSet.has(p.target_concept_id);
      })
      .slice(0, 3);

    // Validate related_concept_ids — only keep IDs that exist in the playbook
    const validRelated = (ids: string[] | undefined) =>
      (ids ?? []).filter((id) => conceptIdSet.has(id)).slice(0, 5);

    const created = await insertSuggestions(
      supabase,
      valid.map((p) => ({
        playbook_id: playbook.id,
        user_id: userId,
        kind: p.type === 'concept_create' ? 'concept_create' : 'concept_update',
        payload: {
          ...(p.target_concept_id ? { target_concept_id: p.target_concept_id } : {}),
          title: p.title,
          body_md: p.body_md,
          rationale: p.rationale,
          related_concept_ids: validRelated(p.related_concept_ids),
        },
        provenance: {
          source_step_ids: [step_id],
          ...(p.target_concept_id ? { source_concept_ids: [p.target_concept_id] } : {}),
          model: 'gemini-2.5-flash',
        },
      })),
    );

    return jsonResponse({ suggestions_created: created });
  } catch (err) {
    console.error('playbook-ingest-debrief error', err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
    );
  }
});
