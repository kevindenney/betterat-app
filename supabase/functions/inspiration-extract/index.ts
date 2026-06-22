/**
 * inspiration-extract
 *
 * Accepts inspiring content (URL, pasted text, or free-form description)
 * and returns a structured extraction: proposed interest, blueprint steps,
 * cross-interest overlaps, and a source summary.
 *
 * Input:
 *   {
 *     content_type: 'url' | 'text' | 'description',
 *     content: string,
 *     user_existing_interest_slugs: string[],
 *     attachments?: [{ filename, mime, storage_path, public_url }]
 *   }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { complete } from '../_shared/ai/provider.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticate, extractJson } from '../_shared/playbook.ts';

type InspirationAttachment = {
  filename?: string;
  mime?: string;
  storage_path?: string;
  public_url?: string | null;
};

type CalendarSeason = {
  name?: unknown;
  start_date?: unknown;
  end_date?: unknown;
};

type CalendarStep = {
  title?: unknown;
  type_label?: unknown;
  tense?: unknown;
  date?: unknown;
  recurrence?: unknown;
  is_anchor?: unknown;
  season_name?: unknown;
  confidence?: unknown;
  source_span?: unknown;
};

// ---------------------------------------------------------------------------
// URL content fetching (reuses extract-url-metadata via internal call)
// ---------------------------------------------------------------------------

async function fetchUrlContent(
  url: string,
  authHeader: string,
): Promise<{ title: string | null; body_text: string | null }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const resp = await fetch(
    `${supabaseUrl}/functions/v1/extract-url-metadata`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({ url }),
    },
  );
  if (!resp.ok) {
    console.warn(`[inspiration-extract] URL metadata fetch failed: ${resp.status}`);
    return { title: null, body_text: null };
  }
  const meta = await resp.json();
  return {
    title: meta.title ?? null,
    body_text: meta.body_text ?? null,
  };
}

async function fetchPdfText(
  attachment: InspirationAttachment,
  authHeader: string,
): Promise<{ title: string; text: string | null; error?: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const storagePath = attachment.storage_path ?? '';
  const url =
    attachment.public_url ||
    (storagePath
      ? `${supabaseUrl}/storage/v1/object/public/documents/${encodeURI(storagePath)}`
      : null);

  if (!url) {
    return { title: attachment.filename ?? 'PDF attachment', text: null, error: 'No PDF URL available' };
  }

  const resp = await fetch(
    `${supabaseUrl}/functions/v1/extract-pdf-text`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({ url }),
    },
  );

  if (!resp.ok) {
    return {
      title: attachment.filename ?? 'PDF attachment',
      text: null,
      error: `PDF extraction failed: ${resp.status}`,
    };
  }

  const pdf = await resp.json();
  return {
    title: attachment.filename ?? 'PDF attachment',
    text: pdf?.success && pdf?.text ? String(pdf.text) : null,
    error: pdf?.error,
  };
}

function normalizeCalendar(rawCalendar: unknown) {
  const calendar = rawCalendar && typeof rawCalendar === 'object'
    ? rawCalendar as { seasons?: unknown; steps?: unknown }
    : {};
  const seasons = Array.isArray(calendar.seasons)
    ? calendar.seasons
        .map((season: CalendarSeason) => ({
          name: String(season?.name ?? '').trim(),
          start_date: String(season?.start_date ?? '').trim(),
          end_date: String(season?.end_date ?? '').trim(),
        }))
        .filter((season) =>
          season.name &&
          /^\d{4}-\d{2}-\d{2}$/.test(season.start_date) &&
          /^\d{4}-\d{2}-\d{2}$/.test(season.end_date)
        )
    : [];

  const steps = Array.isArray(calendar.steps)
    ? calendar.steps
        .map((step: CalendarStep) => {
          const tense = step?.tense === 'past' ? 'past' : 'future';
          const date = typeof step?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(step.date)
            ? step.date
            : null;
          const confidence = typeof step?.confidence === 'number'
            ? Math.max(0, Math.min(1, step.confidence))
            : 0.6;
          return {
            title: String(step?.title ?? '').trim(),
            type_label: String(step?.type_label ?? 'general').trim() || 'general',
            tense,
            date,
            recurrence: typeof step?.recurrence === 'string' && step.recurrence.trim()
              ? step.recurrence.trim()
              : null,
            is_anchor: Boolean(step?.is_anchor),
            season_name: typeof step?.season_name === 'string' && step.season_name.trim()
              ? step.season_name.trim()
              : null,
            confidence,
            source_span: typeof step?.source_span === 'string' && step.source_span.trim()
              ? step.source_span.trim()
              : null,
          };
        })
        .filter((step) => step.title)
    : [];

  return { seasons, steps };
}

// ---------------------------------------------------------------------------
// Extraction prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert skill analyst and learning plan designer.

Given inspiring content about someone's pursuit, activity, or competition, extract:

1. A proposed INTEREST (the skill/pursuit this represents)
2. A sequenced BLUEPRINT of 8–15 learning steps to develop the needed skills
3. Cross-references to the user's existing interests where skills overlap
4. A conservative CALENDAR preview of past/future dated work when the source includes real dates, seasons, or recurring anchors

IMPORTANT RULES:
- Step categories must be one of: general, nutrition, strength, cardio, hiit, sport, race_day_check, reading
- Use "general" for skills that don't fit other categories (navigation, knot-tying, gear prep, etc.)
- Use "sport" for sport-specific drills and skills
- Use "strength" or "cardio" for fitness-oriented steps
- Use "reading" for research/study steps
- Keep step titles actionable and concise (under 60 chars)
- Sub-steps should be concrete, specific actions (3–6 per step)
- Reasoning should explain WHY this step matters in the learning sequence
- Icon names must be valid Ionicons names. Pick the most SPECIFIC icon for the domain. Good examples:
  Sports/outdoors: bicycle, car-sport, boat, football, tennisball, golf, fish, trail-sign
  Fitness: barbell, fitness, body, walk, footsteps
  Creative: brush, color-palette, musical-notes, camera, film, easel
  Tech: code-slash, hardware-chip, laptop, globe, server
  Navigation: compass, map, navigate, location
  Medical: medkit, heart, pulse, bandage
  Education: school, library, book
  Food: restaurant, nutrition, cafe, wine, beer
  Music: musical-notes, headset, mic, radio
  Always prefer filled icons over outline variants for the interest icon.
- Accent colors should be hex codes evocative of the domain
- Suggested domain slug should be one of: sports-outdoors, creative-arts, healthcare, education-learning, technology, professional, music, agriculture-environment, crafts, other
- Calendar dates are optional and conservative. Extract only dates supported by the source or clearly recurring anchors.
- Do not invent fake dates for ordinary blueprint steps. Undated ordered work should use "date": null.
- If the source has a bounded term/season/series/rotation, create a season with start_date and end_date.
- Use persona-native labels: sailing has regattas/races; nursing has rotations, clinical shifts, exams; entrepreneurship has orders, market days, expenses; golf has rounds, lessons, tournaments.
- Recurrence strings must be null or "weekly:monday"..."weekly:sunday".
- Low-confidence dates should remain in the calendar with confidence below 0.72 so the user can review them.
- Keep calendar.steps concise: real dated pegs, recurring anchors, and a small number of important undated sequence items.

Respond with ONLY a JSON object matching this schema:
{
  "proposed_interest": {
    "name": "string (2-4 words)",
    "slug": "string (kebab-case)",
    "description": "string (1-2 sentences)",
    "suggested_domain_slug": "string",
    "accent_color": "#hex",
    "icon_name": "string (Ionicons)"
  },
  "blueprint": {
    "title": "string (learning plan title)",
    "description": "string (1-2 sentences)",
    "steps": [
      {
        "title": "string",
        "description": "string",
        "category": "string (from allowed list)",
        "order": 1,
        "sub_steps": ["string"],
        "reasoning": "string",
        "estimated_duration_days": 7,
        "cross_interest_slugs": ["string (only slugs from user's existing interests)"]
      }
    ]
  },
  "calendar": {
    "seasons": [
      { "name": "string", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" }
    ],
    "steps": [
      {
        "title": "string",
        "type_label": "string (persona-native type such as race, clinical shift, exam, market day, lesson)",
        "tense": "past or future",
        "date": "YYYY-MM-DD or null",
        "recurrence": "weekly:thursday or null",
        "is_anchor": true,
        "season_name": "string or null",
        "confidence": 0.9,
        "source_span": "short quote or source clue"
      }
    ]
  },
  "source_summary": "string (2-3 sentence summary of the inspiring content)",
  "existing_interest_overlaps": [
    { "slug": "string", "relevance": "string (1 sentence)" }
  ],
  "confidence": 0.9
}`;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Helper to attach CORS headers to any response
  const withCors = (resp: Response): Response => {
    const headers = new Headers(resp.headers);
    for (const [k, v] of Object.entries(corsHeaders)) {
      headers.set(k, v);
    }
    return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers });
  };

  try {
    const auth = await authenticate(req);
    if (auth instanceof Response) return withCors(auth);

    const body = await req.json();
    const {
      content_type,
      content,
      user_existing_interest_slugs = [],
      attachments = [],
      interest_slug = null,
      interest_label = null,
      persona_vocabulary = null,
      recurring_anchors = [],
    } = body;

    if (!content_type || !content) {
      return new Response(JSON.stringify({ error: 'content_type and content are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['url', 'text', 'description'].includes(content_type)) {
      return new Response(JSON.stringify({ error: 'content_type must be url, text, or description' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve content to analyzable text
    let analyzableContent = content;
    let sourceTitle: string | null = null;
    const authHeader = req.headers.get('Authorization') ?? '';

    if (content_type === 'url') {
      const urlContent = await fetchUrlContent(content, authHeader);
      sourceTitle = urlContent.title;

      if (urlContent.body_text) {
        analyzableContent = `Source URL: ${content}\nTitle: ${urlContent.title ?? 'Unknown'}\n\nContent:\n${urlContent.body_text}`;
      } else {
        // URL fetch failed — fall back to just the URL
        analyzableContent = `Source URL: ${content}\nTitle: ${urlContent.title ?? 'Unknown'}\n\n(Could not fetch full page content. Analyze based on the URL and title.)`;
      }
    }

    const pdfTexts: string[] = [];
    for (const attachment of attachments as InspirationAttachment[]) {
      if (!String(attachment?.mime ?? '').toLowerCase().includes('pdf')) continue;
      const pdf = await fetchPdfText(attachment, authHeader);
      if (pdf.text) {
        pdfTexts.push(`PDF: ${pdf.title}\n${pdf.text.slice(0, 60000)}`);
      } else {
        pdfTexts.push(`PDF: ${pdf.title}\n(Could not extract text: ${pdf.error ?? 'unknown error'})`);
      }
    }
    if (pdfTexts.length > 0) {
      analyzableContent = `${analyzableContent}\n\nAttached PDFs:\n\n${pdfTexts.join('\n\n---\n\n')}`;
    }

    // Build the user message
    const interestContext =
      user_existing_interest_slugs.length > 0
        ? `\n\nThe user's existing interests: ${user_existing_interest_slugs.join(', ')}`
        : '\n\nThe user has no existing interests yet.';
    const personaContext = `\n\nActive interest context:
- interest_slug: ${interest_slug ?? 'unknown'}
- interest_label: ${interest_label ?? 'unknown'}
- persona_vocabulary: ${JSON.stringify(persona_vocabulary ?? {})}
- recurring_anchors: ${JSON.stringify(recurring_anchors ?? [])}`;

    const userMessage = `Here is the inspiring content the user wants to learn from:\n\n---\n${analyzableContent}\n---${interestContext}${personaContext}\n\nExtract a structured learning plan and conservative calendar preview from this content.`;

    // Call AI
    const { text } = await complete({
      task: 'extraction',
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      maxOutputTokens: 8192,
      temperature: 0.2,
      responseFormat: 'json',
    });

    const extraction = extractJson(text);

    // Validate minimum structure
    if (
      !extraction ||
      typeof extraction !== 'object' ||
      !('proposed_interest' in extraction) ||
      !('blueprint' in extraction)
    ) {
      console.error('[inspiration-extract] Invalid extraction shape:', text.slice(0, 500));
      return new Response(
        JSON.stringify({ error: 'AI extraction returned invalid structure. Please try again.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Attach source title if we fetched it
    if (sourceTitle && extraction.proposed_interest) {
      (extraction as Record<string, unknown>).source_title = sourceTitle;
    }
    (extraction as Record<string, unknown>).calendar = normalizeCalendar(
      (extraction as Record<string, unknown>).calendar,
    );

    return new Response(JSON.stringify(extraction), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[inspiration-extract] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
