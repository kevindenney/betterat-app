/**
 * playbook-qa
 *
 * Synchronous Q&A against a Playbook. Input:
 *   { playbook_id: string, question: string }
 *
 * Retrieves top-k snippets across concepts, resources, and recent debriefs
 * using simple `ilike` keyword match (no pgvector in this repo). Hands the
 * snippets + question to Gemini and returns { answer_md, sources } to the
 * client. The client chooses whether to pin it → playbook_qa row.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { complete } from '../_shared/ai/provider.ts';
import {
  assertPlaybookOwnership,
  authenticate,
  corsHeaders,
  jsonResponse,
} from '../_shared/playbook.ts';

function extractKeywords(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 6);
}

/**
 * Extract the most relevant sections from a long body_text based on keywords.
 * Splits into paragraphs, scores each by keyword density, returns top chunks.
 */
function extractRelevantSections(
  bodyText: string,
  keywords: string[],
  maxChars: number,
): string {
  if (!bodyText || bodyText.length <= maxChars) return bodyText || '';

  // Split into paragraph-like chunks (~200 chars each)
  const chunks: string[] = [];
  const sentences = bodyText.split(/(?<=[.!?\n])\s+/);
  let current = '';
  for (const s of sentences) {
    if (current.length + s.length > 250 && current.length > 50) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += ' ' + s;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // Score each chunk by keyword matches
  const lower = keywords.map((k) => k.toLowerCase());
  const scored = chunks.map((chunk) => {
    const cl = chunk.toLowerCase();
    let score = 0;
    for (const kw of lower) {
      // Count occurrences (not just boolean match)
      const matches = cl.split(kw).length - 1;
      score += matches;
    }
    return { chunk, score };
  });

  // Take top-scoring chunks, maintaining original order
  scored.forEach((s, i) => (s as any).idx = i);
  const topChunks = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  // Re-sort by original order for coherence
  topChunks.sort((a, b) => (a as any).idx - (b as any).idx);

  // Also include the first chunk for context (intro)
  const firstChunk = chunks[0] || '';
  let result = firstChunk;

  for (const tc of topChunks) {
    if (result.length + tc.chunk.length > maxChars) break;
    if (!result.includes(tc.chunk)) {
      result += '\n...\n' + tc.chunk;
    }
  }

  return result.slice(0, maxChars);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = await authenticate(req);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;

    const { playbook_id, question } = await req.json();
    if (!playbook_id || !question) {
      return jsonResponse({ error: 'playbook_id and question required' }, 400);
    }

    const { interest_id } = await assertPlaybookOwnership(
      supabase,
      userId,
      playbook_id,
    );

    const keywords = extractKeywords(question);
    const orQuery = (col: string) =>
      keywords.length > 0
        ? keywords.map((k) => `${col}.ilike.%${k}%`).join(',')
        : `${col}.ilike.%${question.slice(0, 40)}%`;

    // Concepts (owned + baselines in this interest) — keyword match
    const { data: concepts = [] } = await supabase
      .from('playbook_concepts')
      .select('id, title, body_md, origin, related_concept_ids')
      .eq('interest_id', interest_id)
      .or(`playbook_id.eq.${playbook_id},playbook_id.is.null`)
      .or(orQuery('title') + ',' + orQuery('body_md'))
      .limit(8);

    // Follow backlinks: gather related concept IDs from matched concepts
    const matchedIds = new Set((concepts ?? []).map((c: any) => c.id));
    const relatedIds = new Set<string>();
    for (const c of concepts ?? []) {
      for (const rid of (c as any).related_concept_ids ?? []) {
        if (!matchedIds.has(rid)) relatedIds.add(rid);
      }
    }

    // Fetch backlinked concepts that weren't in the keyword results
    let backlinkConcepts: any[] = [];
    if (relatedIds.size > 0) {
      const ids = Array.from(relatedIds).slice(0, 5);
      const { data: linked = [] } = await supabase
        .from('playbook_concepts')
        .select('id, title, body_md, origin')
        .in('id', ids);
      backlinkConcepts = linked ?? [];
    }

    // Merge: keyword matches first, then backlinked (deduped)
    const allConcepts = [...(concepts ?? [])];
    for (const bc of backlinkConcepts) {
      if (!matchedIds.has(bc.id)) allConcepts.push(bc);
    }

    // Resources — search title, description, and body_text
    const { data: resources = [] } = await supabase
      .from('playbook_resources')
      .select('id, title, description, body_text, url, resource_type')
      .eq('playbook_id', playbook_id)
      .or(orQuery('title') + ',' + orQuery('description') + ',' + orQuery('body_text'))
      .limit(8);

    // Recent debriefs (last 20 steps with debriefs)
    const { data: recentSteps = [] } = await supabase
      .from('timeline_steps')
      .select('id, title, metadata, starts_at')
      .eq('user_id', userId)
      .eq('interest_id', interest_id)
      .order('starts_at', { ascending: false })
      .limit(20);

    const stepSnippets = (recentSteps ?? [])
      .filter((s: any) => (s.metadata as Record<string, unknown>)?.review)
      .slice(0, 6)
      .map((s: any) => ({
        id: s.id,
        title: s.title,
        review: s.metadata.review,
      }));

    const system = `You are the user's personal Playbook — a compiled knowledge base of their practice in one interest area. Answer the user's question thoroughly using the snippets provided. Synthesize information across ALL sources (concepts, resources, debriefs) to give a comprehensive answer. Cite sources inline like [C1], [R2], [D3] where C=concept, R=resource, D=debrief.

IMPORTANT: If resources contain detailed technical information relevant to the question, include that detail in your answer. Don't just say "the resource mentions X" — extract and present the specific actionable information.

COMPOUNDING: After answering, check if the conversation reveals NEW knowledge that should be added to an existing concept. If the answer synthesizes information in a novel way, connects ideas that weren't connected before, or fills in gaps, suggest concept updates. Also flag if the question reveals a knowledge gap — a topic the user asked about but the playbook doesn't cover well.

Return ONLY a JSON object:
{
  "answer_md": "<markdown answer with inline citations — be specific and actionable>",
  "sources": [{"type": "concept"|"resource"|"debrief", "id": "<uuid>", "label": "<display title>"}],
  "concept_updates": [{"concept_id": "<uuid>", "title": "<concept title>", "new_insight": "<1-2 sentence insight to add>"}],
  "knowledge_gaps": [{"topic": "<missing topic>", "description": "<what the user asked about that isn't well covered>"}]
}

concept_updates and knowledge_gaps can be empty arrays. Only include them when genuinely useful.
If the snippets don't contain enough information, say so honestly in answer_md and return an empty sources array.`;

    const sourceBlocks: string[] = [];
    allConcepts.forEach((c: any, i: number) => {
      const backlinkNote = matchedIds.has(c.id) ? '' : ' (via backlink)';
      sourceBlocks.push(`[C${i + 1}] CONCEPT ${c.id} — ${c.title}${backlinkNote}\n${c.body_md?.slice(0, 1200) ?? ''}`);
    });
    (resources ?? []).forEach((r: any, i: number) => {
      // Extract keyword-relevant sections from body_text (not just first N chars)
      const content = r.body_text
        ? extractRelevantSections(r.body_text, keywords, 4000)
        : r.description?.slice(0, 400) || '';
      const urlLine = r.url ? `\nURL: ${r.url}` : '';
      sourceBlocks.push(`[R${i + 1}] RESOURCE ${r.id} — ${r.title} (${r.resource_type ?? 'unknown'})${urlLine}\n${content}`);
    });
    stepSnippets.forEach((s: any, i: number) => {
      sourceBlocks.push(`[D${i + 1}] DEBRIEF ${s.id} — ${s.title}\n${JSON.stringify(s.review).slice(0, 600)}`);
    });

    const userPrompt = `QUESTION: ${question}

SNIPPETS:
${sourceBlocks.join('\n\n')}`;

    const { text: aiText } = await complete({
      task: 'playbook',
      system,
      messages: [{ role: 'user', content: userPrompt }],
      maxOutputTokens: 2000,
      temperature: 0.3,
    });

    // Extract JSON (tolerant)
    let parsed: {
      answer_md?: string;
      sources?: unknown[];
      concept_updates?: { concept_id: string; title: string; new_insight: string }[];
      knowledge_gaps?: { topic: string; description: string }[];
    } = {};
    try {
      const cleaned = aiText.replace(/```(?:json)?\s*/g, '').replace(/```$/g, '').trim();
      const first = cleaned.indexOf('{');
      const last = cleaned.lastIndexOf('}');
      if (first !== -1 && last !== -1) {
        parsed = JSON.parse(cleaned.slice(first, last + 1));
      }
    } catch {
      parsed = { answer_md: aiText, sources: [] };
    }

    return jsonResponse({
      answer_md: parsed.answer_md ?? aiText,
      sources: parsed.sources ?? [],
      concept_updates: parsed.concept_updates ?? [],
      knowledge_gaps: parsed.knowledge_gaps ?? [],
    });
  } catch (err) {
    console.error('playbook-qa error', err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
    );
  }
});
