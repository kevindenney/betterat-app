/**
 * playbook-ingest-inbox
 *
 * Invoked from the "Ingest now" button on RawInboxCard. Input:
 *   { playbook_id: string }
 *
 * Processes every playbook_inbox_items row with status='pending':
 *   - url   → creates a playbook_resources row from source_url + title
 *   - file  → creates a resource row from raw_text/metadata
 *   - photo → creates a resource row (OCR text in raw_text if available)
 *   - text  → creates a note-type resource row
 *   - voice → reserved for v2, marked failed
 *
 * After each resource is created, asks Gemini whether it should trigger a
 * concept_update suggestion. Inbox items are flipped to 'ingested' (with
 * created_resource_id) or 'failed' (with error in metadata).
 *
 * For URL items, calls extract-url-metadata to fetch page title, description,
 * and body text. For files with raw_text, uses as-is. For photos, uses
 * Gemini vision to extract text/captions.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { complete } from '../_shared/ai/provider.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  assertPlaybookOwnership,
  authenticateUserOrService,
  extractJson,
  insertSuggestions,
  jsonResponse,
} from '../_shared/playbook.ts';

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const auth = await authenticateUserOrService(req);
    if (auth instanceof Response) return auth;
    const { userId, supabase } = auth;

    const { playbook_id } = await req.json();
    if (!playbook_id) return jsonResponse({ error: 'playbook_id required' }, 400);

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(playbook_id)) {
      return new Response(
        JSON.stringify({ error: 'playbook_id must be a valid UUID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { interest_id } = await assertPlaybookOwnership(
      supabase,
      userId,
      playbook_id,
    );

    // Load pending inbox items
    const { data: items = [], error: itemsErr } = await supabase
      .from('playbook_inbox_items')
      .select('*')
      .eq('playbook_id', playbook_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (itemsErr) throw itemsErr;

    if (!items || items.length === 0) {
      // Backfill: re-extract body_text for resources with URLs but no body_text
      const { data: staleResources = [] } = await supabase
        .from('playbook_resources')
        .select('id, url, resource_type')
        .eq('playbook_id', playbook_id)
        .is('body_text', null)
        .not('url', 'is', null)
        .limit(5);

      let backfilled = 0;
      for (const res of staleResources ?? []) {
        try {
          const urlLower = (res.url as string).toLowerCase();
          const isPdf = urlLower.endsWith('.pdf') || urlLower.includes('.pdf?') || res.resource_type === 'document';

          if (isPdf) {
            const pdfResp = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/extract-pdf-text`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: req.headers.get('Authorization') ?? '',
                },
                body: JSON.stringify({ url: res.url }),
              },
            );
            if (pdfResp.ok) {
              const pdf = await pdfResp.json();
              if (pdf.success && pdf.text) {
                await supabase
                  .from('playbook_resources')
                  .update({ body_text: (pdf.text as string).slice(0, 32000) })
                  .eq('id', res.id);
                backfilled++;
              }
            }
          } else {
            const metaResp = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/extract-url-metadata`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: req.headers.get('Authorization') ?? '',
                },
                body: JSON.stringify({ url: res.url }),
              },
            );
            if (metaResp.ok) {
              const meta = await metaResp.json();
              if (meta.body_text) {
                await supabase
                  .from('playbook_resources')
                  .update({ body_text: meta.body_text })
                  .eq('id', res.id);
                backfilled++;
              }
            }
          }
        } catch (err) {
          console.warn('Backfill failed for resource', res.id, err);
        }
      }

      return jsonResponse({ ingested: 0, failed: 0, suggestions_created: 0, backfilled });
    }

    let ingested = 0;
    let failed = 0;
    const suggestionRows: Parameters<typeof insertSuggestions>[1] = [];
    const aiPendingItems: {
      itemId: string;
      resourceId: string;
      resourceTitle: string;
      content: string;
    }[] = [];

    for (const item of items) {
      try {
        if (item.kind === 'voice') {
          await supabase
            .from('playbook_inbox_items')
            .update({
              status: 'failed',
              metadata: { ...(item.metadata ?? {}), error: 'Voice transcription ships in v2' },
            })
            .eq('id', item.id);
          failed += 1;
          continue;
        }

        // Enrich content for URL items by fetching page metadata or PDF text
        let enrichedTitle = item.title;
        let enrichedDescription = item.raw_text;
        let enrichedBodyText: string | null = item.raw_text || null;
        let enrichedMetadata = item.metadata ?? {};
        let isPdf = false;

        if (item.kind === 'url' && item.source_url) {
          // Detect PDF by URL extension or by doing a HEAD request
          const urlLower = item.source_url.toLowerCase();
          isPdf = urlLower.endsWith('.pdf') || urlLower.includes('.pdf?');

          if (!isPdf) {
            try {
              const headResp = await fetch(item.source_url, { method: 'HEAD', redirect: 'follow' });
              const ct = headResp.headers.get('content-type') ?? '';
              isPdf = ct.includes('application/pdf');
            } catch (_) {
              // HEAD failed — fall through to metadata extraction
            }
          }

          if (isPdf) {
            // Use extract-pdf-text for PDF URLs — gets full text content
            try {
              const pdfResp = await fetch(
                `${Deno.env.get('SUPABASE_URL')}/functions/v1/extract-pdf-text`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: req.headers.get('Authorization') ?? '',
                  },
                  body: JSON.stringify({ url: item.source_url }),
                },
              );
              if (pdfResp.ok) {
                const pdf = await pdfResp.json();
                if (pdf.success && pdf.text) {
                  // Derive title from URL filename
                  const rawFilename = item.source_url.split('/').pop()?.split('?')[0] ?? '';
                  let decoded = rawFilename;
                  try { decoded = decodeURIComponent(rawFilename); } catch (_) { /* keep raw */ }
                  const prettyName = decoded
                    .replace(/\.pdf$/i, '')
                    .replace(/[_-]+/g, ' ')
                    .replace(/([a-z])([A-Z])/g, '$1 $2')
                    .replace(/\b\w/g, (c: string) => c.toUpperCase())
                    .trim();
                  // Try first meaningful line from PDF text as title
                  const firstLine = (pdf.text as string).split(/\n/).find(
                    (l: string) => {
                      const t = l.trim();
                      if (t.length < 5 || t.length > 120) return false;
                      // Must be mostly letters/numbers/spaces (reject parser garbage)
                      const alphaRatio = (t.match(/[a-zA-Z0-9 ]/g) || []).length / t.length;
                      return alphaRatio > 0.7 && !/[.!?]/.test(t) && !/^\d+$/.test(t);
                    }
                  )?.trim() ?? '';
                  enrichedTitle = enrichedTitle === item.source_url
                    ? (firstLine || prettyName) || enrichedTitle
                    : enrichedTitle;
                  enrichedBodyText = pdf.text.slice(0, 32000);
                  enrichedDescription = pdf.text.slice(0, 8000);
                  enrichedMetadata = {
                    ...enrichedMetadata,
                    content_type: 'pdf',
                    pdf_pages: pdf.numPages,
                    pdf_size: pdf.pdfSize,
                    extracted_text_length: pdf.text.length,
                  };
                }
              }
            } catch (pdfErr) {
              console.warn('PDF text extraction failed (non-fatal)', pdfErr);
            }
          } else {
            // Regular URL — fetch HTML page metadata
            try {
              const metaResp = await fetch(
                `${Deno.env.get('SUPABASE_URL')}/functions/v1/extract-url-metadata`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: req.headers.get('Authorization') ?? '',
                  },
                  body: JSON.stringify({ url: item.source_url }),
                },
              );
              if (metaResp.ok) {
                const meta = await metaResp.json();
                enrichedTitle = meta.title || enrichedTitle || item.source_url;
                enrichedBodyText = meta.body_text || enrichedBodyText;
                enrichedDescription = meta.body_text?.slice(0, 4000) || meta.description || enrichedDescription;
                enrichedMetadata = {
                  ...enrichedMetadata,
                  extracted_title: meta.title,
                  extracted_description: meta.description,
                  extracted_image: meta.image,
                  extracted_author: meta.author,
                };
              }
            } catch (urlErr) {
              console.warn('URL metadata extraction failed (non-fatal)', urlErr);
            }
          }
        }

        // Create a resource row
        const resourceType =
          item.kind === 'url' && isPdf ? 'document' :
          item.kind === 'url' ? 'website' :
          item.kind === 'photo' ? 'image' :
          item.kind === 'file' ? 'document' :
          'note';

        const { data: resource, error: resErr } = await supabase
          .from('playbook_resources')
          .insert({
            playbook_id,
            user_id: userId,
            title: enrichedTitle ?? item.source_url ?? 'Untitled capture',
            url: item.source_url,
            resource_type: resourceType,
            description: (enrichedDescription ?? '').slice(0, 500) || null,
            body_text: enrichedBodyText,
            metadata: enrichedMetadata,
          })
          .select('id, title')
          .single();
        if (resErr) throw resErr;

        // Mark inbox item ingested
        await supabase
          .from('playbook_inbox_items')
          .update({
            status: 'ingested',
            ingested_at: new Date().toISOString(),
            created_resource_id: resource.id,
          })
          .eq('id', item.id);
        ingested += 1;

        // Collect content for batched AI call (runs after loop)
        const contentForAI = enrichedDescription || item.raw_text || '';
        if (contentForAI.length > 50) {
          aiPendingItems.push({
            itemId: item.id,
            resourceId: resource.id,
            resourceTitle: resource.title,
            content: contentForAI.slice(0, 4000),
          });
        }
      } catch (itemErr) {
        console.error('Inbox item failed', item.id, itemErr);
        await supabase
          .from('playbook_inbox_items')
          .update({
            status: 'failed',
            metadata: {
              ...(item.metadata ?? {}),
              error: itemErr instanceof Error ? itemErr.message : String(itemErr),
            },
          })
          .eq('id', item.id);
        failed += 1;
      }
    }

    // ── Batched AI concept-matching: 1 Gemini call for ALL ingested items ──
    if (aiPendingItems.length > 0) {
      try {
        const { data: concepts = [] } = await supabase
          .from('playbook_concepts')
          .select('id, title, body_md')
          .eq('interest_id', interest_id)
          .or(`playbook_id.eq.${playbook_id},playbook_id.is.null`)
          .limit(30);

        const hasExistingConcepts = (concepts ?? []).length > 0;
        const system = hasExistingConcepts
          ? `You are BetterAt's Playbook coach. Multiple new resources were added to the user's knowledge base. For each resource, decide whether it provides fresh, actionable insight for any existing concept.

IMPORTANT: Your job is to MERGE new insights INTO the existing concept body, not replace it. The body_md you return must:
1. Preserve ALL existing content from the concept
2. ADD new bullet points, paragraphs, or sections with fresh info from the resource
3. Use markdown formatting (headings, bullets, bold for key terms)

BACKLINKING: For each proposal, include "related_concept_ids" — an array of existing concept UUIDs that are meaningfully related. Include 0-5 related concept IDs.

Return ONLY a JSON array (possibly empty) of concept_update proposals. Include "source_index" (0-based) to indicate which resource triggered the proposal:
  [{ "source_index": 0, "target_concept_id": "<uuid>", "title": "<short concept name>", "body_md": "<merged markdown>", "rationale": "<one line>", "related_concept_ids": ["<uuid>", ...] }]
Return [] if nothing relevant.`
          : `You are BetterAt's Playbook coach. Multiple new resources were added to the user's knowledge base. The user has no existing concepts yet, so suggest 1-2 NEW concepts total from the most interesting resources.

Return ONLY a JSON array of new concept proposals with "source_index" (0-based) indicating which resource:
  [{ "source_index": 0, "title": "<short concept name>", "body_md": "<concept content in markdown>", "rationale": "<one line>" }]
Return [] if nothing worth capturing.`;

        const resourcesSummary = aiPendingItems.map((item, i) =>
          `[${i}] ${item.resourceTitle}\n${item.content}`
        ).join('\n---\n');

        const conceptsSummary = (concepts ?? []).map((c: any) =>
          `- [${c.id}] ${c.title}\n  ${(c.body_md || '(empty)').slice(0, 500)}`
        ).join('\n');

        const userPrompt = `NEW RESOURCES (${aiPendingItems.length}):
${resourcesSummary}

${hasExistingConcepts ? `EXISTING CONCEPTS:\n${conceptsSummary}` : '(No existing concepts)'}`;

        const { text: aiText } = await complete({
          task: 'playbook',
          system,
          messages: [{ role: 'user', content: userPrompt }],
          maxOutputTokens: 2000,
          temperature: 0.3,
        });

        const proposals = extractJson<Record<string, unknown>[]>(aiText);
        const conceptIdSet = new Set((concepts ?? []).map((c: any) => c.id));
        if (Array.isArray(proposals)) {
          for (const p of proposals.slice(0, 4)) {
            const sourceIdx = (p.source_index as number) ?? 0;
            const sourceItem = aiPendingItems[sourceIdx] ?? aiPendingItems[0];
            const targetId = p.target_concept_id as string | undefined;
            if (!targetId && hasExistingConcepts) continue;

            const relatedIds = ((p as any).related_concept_ids ?? [])
              .filter((id: string) => conceptIdSet.has(id))
              .slice(0, 5);
            const targetExists = targetId ? conceptIdSet.has(targetId) : false;

            suggestionRows.push({
              playbook_id,
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
                    title: (p as any).title
                      || (typeof p.body_md === 'string' && p.body_md.match(/^\*\*(.+?)\*\*/)?.[1])
                      || sourceItem.resourceTitle
                      || 'New Concept',
                    body_md: p.body_md,
                    interest_id,
                    related_concept_ids: relatedIds,
                  },
              provenance: {
                source_inbox_item_ids: [sourceItem.itemId],
                source_resource_ids: [sourceItem.resourceId],
                model: 'gemini-2.5-flash',
              },
            });
          }
        }
      } catch (aiErr) {
        console.warn('Batched inbox AI step failed (non-fatal)', aiErr);
      }
    }

    const suggestions_created = await insertSuggestions(supabase, suggestionRows);

    return jsonResponse({ ingested, failed, suggestions_created });
  } catch (err) {
    console.error('playbook-ingest-inbox error', err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
    );
  }
});
