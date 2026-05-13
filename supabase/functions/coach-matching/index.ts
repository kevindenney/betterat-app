import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@^0.32.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type CoachMatchingRequest = {
  prompt: string;
  skillId?: string | null;
  model?: string;
  temperature?: number;
  max_tokens?: number;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const anthropic = new Anthropic({ apiKey });
    const { prompt, skillId, model, temperature, max_tokens }: CoachMatchingRequest = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'prompt is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const hasSkill = typeof skillId === 'string' && skillId.length > 0;

    const response = await anthropic.beta.messages.create({
      model: model || 'claude-3-5-haiku-20241022',
      max_tokens: max_tokens ?? 2048,
      temperature: temperature ?? 0.3,
      betas: hasSkill ? ['skills-2025-10-02'] : undefined,
      ...(hasSkill && {
        container: {
          skills: [{
            type: 'custom',
            skill_id: skillId,
            version: 'latest',
          }],
        },
      }),
      messages: [{
        role: 'user',
        content: prompt,
      }],
    } as any);

    const textBlocks = (response.content as { type: string; text?: string }[])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text!.trim())
      .filter(Boolean);

    const combinedText = textBlocks.join('\n').trim();

    return new Response(
      JSON.stringify({
        text: combinedText,
        response,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('coach-matching error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
