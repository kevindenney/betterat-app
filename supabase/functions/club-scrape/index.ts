import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@^0.32.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ScrapeRequest = {
  url: string;
  skillId?: string | null;
  model?: string;
};

const sanitizeHtml = (html: string, limit = 60000) => {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  const withoutStyles = withoutScripts.replace(/<style[\s\S]*?<\/style>/gi, " ");
  return withoutStyles.replace(/\s+/g, " ").slice(0, limit);
};

const buildPrompt = (url: string, sanitizedContent: string) => `You are onboarding a sailing club to BetterAt. Analyze the HTML content that was scraped from ${url} and extract structured data.

Return JSON with this exact shape:
{
  "club_name": string, // Extract the official club name from page title or headers
  "summary": string, // brief overview of the club and notable insights
  "venue": {
    "name": string | null, // Physical venue name (e.g., "Kellett Island", "Causeway Bay")
    "city": string | null,
    "country": string | null
  },
  "contact": {
    "email": string | null, // General club email
    "phone": string | null // General club phone
  },
  "classes": [
    {
      "name": string,
      "description": string | null,
      "fleet_page": string | null
    }
  ],
  "events": [
    {
      "name": string,
      "date": string | null,
      "location": string | null,
      "url": string | null,
      "notes": string | null
    }
  ],
  "contacts": [
    {
      "role": string,
      "name": string | null,
      "email": string | null
    }
  ]
}

Rules:
- If a field is unknown, set it to null.
- Extract the official club name from <title>, <h1>, or meta tags.
- Extract venue/location from footer, contact page, or about section.
- Only include events/classes clearly related to sailing.
- Truncate overly long descriptions to 280 characters.
- Do not include explanatory text outside of the JSON.

HTML CONTENT START
${sanitizedContent}
HTML CONTENT END`;

const extractJson = (text: string): any => {
  try {
    const trimmed = text.trim();
    if (trimmed.startsWith("{")) {
      return JSON.parse(trimmed);
    }

    const jsonMatch = trimmed.match(/```json[\s\S]*?```/i);
    if (jsonMatch) {
      const jsonBlock = jsonMatch[0].replace(/```json|```/gi, "").trim();
      return JSON.parse(jsonBlock);
    }

    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      const potentialJson = trimmed.slice(firstBrace, lastBrace + 1);
      return JSON.parse(potentialJson);
    }
  } catch (error) {
    console.error("Failed to parse JSON from Claude response", error);
  }
  return null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { url, skillId, model = "claude-3-5-haiku-20241022" }: ScrapeRequest = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "url is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalizedUrl = url.startsWith("http://") || url.startsWith("https://")
      ? url
      : `https://${url}`;

    const parsed = new URL(normalizedUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return new Response(
        JSON.stringify({ error: "Invalid URL protocol" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const pageResponse = await fetch(parsed.toString(), {
      headers: { "User-Agent": "BetterAtBot/1.0 (+https://better.at)" },
    });

    if (!pageResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch URL (status ${pageResponse.status})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const html = await pageResponse.text();
    const sanitized = sanitizeHtml(html);

    const anthropic = new Anthropic({ apiKey });
    const resolvedSkillId = skillId ?? Deno.env.get("CLAUDE_SKILL_CLUB_SCRAPE_ID") ?? null;
    const hasSkill = typeof resolvedSkillId === "string" && resolvedSkillId.length > 0;

    const prompt = buildPrompt(parsed.toString(), sanitized);

    const response = await anthropic.beta.messages.create({
      model,
      max_tokens: 2048,
      temperature: 0.2,
      betas: hasSkill ? ["skills-2025-10-02"] : undefined,
      ...(hasSkill && {
        container: {
          skills: [{
            type: "custom",
            skill_id: resolvedSkillId!,
            version: "latest",
          }],
        },
      }),
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    } as Anthropic.Beta.MessageCreateParams);

    const textBlocks = (response.content as { type: string; text?: string }[])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text!.trim())
      .filter(Boolean);

    const combinedText = textBlocks.join("\n").trim();
    const parsedJson = extractJson(combinedText);

    if (!parsedJson) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to parse Claude response",
          raw: combinedText,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: parsedJson,
        raw: combinedText,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("club-scrape error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
