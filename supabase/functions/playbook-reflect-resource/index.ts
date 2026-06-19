/**
 * playbook-reflect-resource
 *
 * Backs the Telegram bot's `reflect_on_resource` tool. When a user shares what
 * they took away from a playbook resource (article, video, etc.), this:
 *   1. Stores the reflection text on the resource (metadata.reflections[]).
 *   2. Asks Gemini whether the reflection yields a concept_update (merge into an
 *      existing concept) or a concept_create proposal.
 *   3. Enqueues those as `pending` playbook_suggestions.
 *
 * Like the other playbook jobs it only ENQUEUES suggestions — materialization
 * into playbook_concepts stays a user-curated step (acceptSuggestion).
 *
 * Auth: this is NOT user-JWT authenticated. The bot calls it server-to-server
 * with `Authorization: Bearer <service-role key>` and an `x-user-id` header
 * naming the acting user. We do NOT string-compare the bearer against the
 * function's injected SUPABASE_SERVICE_ROLE_KEY — those can legitimately differ
 * (the platform now injects a new-format secret key into edge functions while
 * callers still hold the legacy JWT service key). Instead we use the incoming
 * bearer AS the Supabase client credential: a genuine service key bypasses RLS
 * and reads/writes succeed; a forged or non-service token fails every query, so
 * combined with the x-user-id ownership check this is self-securing. Deploy with
 * `--no-verify-jwt`.
 *
 * Body: { resource_id: string, reflection_text: string }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { complete } from '../_shared/ai/provider.ts';
import { corsHeaders, extractJson, insertSuggestions, jsonResponse } from '../_shared/playbook.ts';

interface ResourceRow {
  id: string;
  user_id: string;
  playbook_id: string | null;
  title: string | null;
  description: string | null;
  body_text: string | null;
  metadata: Record<string, unknown> | null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // The incoming bearer IS the service credential (see header comment). We use
  // it as the client key rather than string-matching it; ownership is asserted
  // via x-user-id below, and RLS naturally blocks anything but a real service key.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    return jsonResponse({ error: 'Server not configured' }, 500);
  }
  const bearer = req.headers.get('Authorization')?.replace('Bearer ', '')?.trim();
  if (!bearer) {
    return jsonResponse({ error: 'Missing authorization' }, 401);
  }
  const userId = req.headers.get('x-user-id');
  if (!userId) {
    return jsonResponse({ error: 'Missing x-user-id' }, 400);
  }

  let resource_id: string | undefined;
  let reflection_text: string | undefined;
  try {
    const body = await req.json();
    resource_id = body?.resource_id;
    reflection_text = typeof body?.reflection_text === 'string' ? body.reflection_text.trim() : undefined;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  if (!resource_id) return jsonResponse({ error: 'resource_id required' }, 400);
  if (!reflection_text) return jsonResponse({ error: 'reflection_text required' }, 400);

  const supabase = createClient(supabaseUrl, bearer);

  // Load + assert ownership.
  const { data: resource, error: resErr } = await supabase
    .from('playbook_resources')
    .select('id, user_id, playbook_id, title, description, body_text, metadata')
    .eq('id', resource_id)
    .maybeSingle<ResourceRow>();
  if (resErr) return jsonResponse({ error: `Resource fetch failed: ${resErr.message}` }, 500);
  if (!resource) return jsonResponse({ error: 'Resource not found' }, 404);
  if (resource.user_id !== userId) return jsonResponse({ error: 'Forbidden: not your resource' }, 403);

  // 1. Persist the reflection onto the resource (append to metadata.reflections).
  const existingMeta = (resource.metadata ?? {}) as Record<string, unknown>;
  const existingReflections = Array.isArray(existingMeta.reflections)
    ? (existingMeta.reflections as unknown[])
    : [];
  const reflectionEntry = { text: reflection_text, created_at: new Date().toISOString() };
  const { error: updErr } = await supabase
    .from('playbook_resources')
    .update({
      metadata: { ...existingMeta, reflections: [...existingReflections, reflectionEntry] },
    })
    .eq('id', resource_id);
  if (updErr) return jsonResponse({ error: `Failed to save reflection: ${updErr.message}` }, 500);

  // 2. Resolve the resource's playbook + interest for concept proposals.
  let suggestions_created = 0;
  if (resource.playbook_id) {
    try {
      const { data: playbook } = await supabase
        .from('playbooks')
        .select('id, interest_id')
        .eq('id', resource.playbook_id)
        .maybeSingle<{ id: string; interest_id: string }>();

      if (playbook?.interest_id) {
        const interest_id = playbook.interest_id;
        const { data: concepts = [] } = await supabase
          .from('playbook_concepts')
          .select('id, title, body_md')
          .eq('interest_id', interest_id)
          .or(`playbook_id.eq.${playbook.id},playbook_id.is.null`)
          .limit(30);

        const hasExistingConcepts = (concepts ?? []).length > 0;
        const system = hasExistingConcepts
          ? `You are BetterAt's Playbook coach. The user just reflected on a resource they saved. Decide whether the reflection provides fresh, actionable insight worth folding into one of their existing concepts.

IMPORTANT: Your job is to MERGE the new insight INTO the existing concept body, not replace it. The body_md you return must:
1. Preserve ALL existing content from the concept
2. ADD new bullet points, paragraphs, or sections capturing the user's reflection
3. Use markdown formatting (headings, bullets, bold for key terms)

BACKLINKING: include "related_concept_ids" — an array of 0-5 existing concept UUIDs that are meaningfully related.

Return ONLY a JSON array (possibly empty):
  [{ "target_concept_id": "<uuid>", "title": "<short concept name>", "body_md": "<merged markdown>", "rationale": "<one line>", "related_concept_ids": ["<uuid>", ...] }]
Return [] if the reflection adds nothing worth capturing.`
          : `You are BetterAt's Playbook coach. The user just reflected on a resource they saved, and has no existing concepts yet. If the reflection is substantive, suggest ONE new concept that captures the insight.

Return ONLY a JSON array (possibly empty):
  [{ "title": "<short concept name>", "body_md": "<concept content in markdown>", "rationale": "<one line>" }]
Return [] if there is nothing worth capturing.`;

        const resourceContext = [
          resource.title ? `Resource: ${resource.title}` : '',
          resource.description ? `Description: ${resource.description}` : '',
          resource.body_text ? `Content: ${resource.body_text.slice(0, 2000)}` : '',
        ].filter(Boolean).join('\n');

        const conceptsSummary = (concepts ?? []).map((c: { id: string; title: string; body_md: string | null }) =>
          `- [${c.id}] ${c.title}\n  ${(c.body_md || '(empty)').slice(0, 500)}`
        ).join('\n');

        const userPrompt = `${resourceContext}

USER REFLECTION:
${reflection_text}

${hasExistingConcepts ? `EXISTING CONCEPTS:\n${conceptsSummary}` : '(No existing concepts)'}`;

        const { text: aiText } = await complete({
          task: 'playbook',
          system,
          messages: [{ role: 'user', content: userPrompt }],
          maxOutputTokens: 1500,
          temperature: 0.3,
        });

        const proposals = extractJson<Record<string, unknown>[]>(aiText);
        const conceptIdSet = new Set((concepts ?? []).map((c: { id: string }) => c.id));
        const suggestionRows: {
          playbook_id: string;
          user_id: string;
          kind: string;
          payload: Record<string, unknown>;
          provenance: Record<string, unknown>;
        }[] = [];

        if (Array.isArray(proposals)) {
          for (const p of proposals.slice(0, 2)) {
            const targetId = p.target_concept_id as string | undefined;
            if (!targetId && hasExistingConcepts) continue;
            const relatedIds = ((p.related_concept_ids as string[]) ?? [])
              .filter((id) => conceptIdSet.has(id))
              .slice(0, 5);
            const targetExists = targetId ? conceptIdSet.has(targetId) : false;

            suggestionRows.push({
              playbook_id: playbook.id,
              user_id: userId,
              kind: targetExists ? 'concept_update' : 'concept_create',
              payload: targetExists
                ? {
                    target_concept_id: targetId,
                    body_md: p.body_md,
                    rationale: p.rationale,
                    related_concept_ids: relatedIds,
                  }
                : {
                    title: (p.title as string)
                      || (typeof p.body_md === 'string' && p.body_md.match(/^\*\*(.+?)\*\*/)?.[1])
                      || resource.title
                      || 'New Concept',
                    body_md: p.body_md,
                    interest_id,
                    related_concept_ids: relatedIds,
                  },
              provenance: {
                source_resource_ids: [resource.id],
                source: 'reflection',
                model: 'gemini-2.5-flash',
              },
            });
          }
        }

        suggestions_created = await insertSuggestions(supabase, suggestionRows);
      }
    } catch (aiErr) {
      // Non-fatal: the reflection is already saved; concept proposals are best-effort.
      console.warn('reflect-resource concept step failed (non-fatal)', aiErr);
    }
  }

  return jsonResponse({ saved: true, resource_id, suggestions_created });
});
