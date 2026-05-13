import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type EvaluationLevel = 'developing' | 'proficient' | 'advanced';

interface EvaluateRequest {
  artifactId: string;
  competencyIds: string[];
}

interface ArtifactContent {
  toolValues?: Record<string,string>;
  notes?: string;
  attachments?: {id: string; type: string; label: string; uri?: string}[];
  mappedCompetencyIds?: string[];
}

interface EvaluationScore {
  competencyId: string;
  level: EvaluationLevel;
  strengths: string[];
  improvements: string[];
}

interface EvaluationResponse {
  scores: EvaluationScore[];
  nextAction: string;
  suggestedCompetencyIds?: string[];
}

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

const getLevel = (textLength: number, completedSteps: number): EvaluationLevel => {
  if (completedSteps >= 4 && textLength >= 500) return 'advanced';
  if (completedSteps >= 3 && textLength >= 220) return 'proficient';
  return 'developing';
};

const firstNonEmpty = (items: (string | undefined)[]): string | null => {
  for (const item of items) {
    if (item && item.trim().length > 0) return item.trim();
  }
  return null;
};

const buildFallbackEvaluation = (content: ArtifactContent, competencyIds: string[]): EvaluationResponse => {
  const toolValues = content.toolValues || {};
  const cues = (toolValues.cues || '').trim();
  const hypothesis = (toolValues.hypothesis || '').trim();
  const actions = (toolValues.actions || '').trim();
  const outcome = (toolValues.outcome || '').trim();
  const combined = [cues, hypothesis, actions, outcome, (content.notes || '').trim()].filter(Boolean).join('\n');
  const completedSteps = [cues, hypothesis, actions, outcome].filter((value) => value.length > 0).length;
  const level = getLevel(combined.length, completedSteps);

  const scores: EvaluationScore[] = competencyIds.map((competencyId) => ({
    competencyId,
    level,
    strengths: [
      firstNonEmpty([
        cues ? 'Captured relevant patient cues and context.' : undefined,
        actions ? 'Described actions tied to clinical priorities.' : undefined,
      ]) || 'Provided initial clinical reasoning evidence.',
    ],
    improvements: [
      firstNonEmpty([
        !hypothesis ? 'Add explicit differential considerations before action.' : undefined,
        !outcome ? 'Close the loop with outcome evaluation and what changed.' : undefined,
        'Make the reasoning chain more specific with data-to-decision links.',
      ]) || 'Increase specificity in your reasoning chain.',
    ],
  }));

  const nextAction = firstNonEmpty([
    !hypothesis ? 'Write 2 differential hypotheses and why each was considered.' : undefined,
    !outcome ? 'Add one concrete “what I would do differently next time” statement.' : undefined,
    'Map this artifact to up to 3 competencies and re-run feedback after revision.',
  ]) || 'Refine and re-submit this artifact for stronger competency evidence.';

  return {
    scores,
    nextAction,
    suggestedCompetencyIds: competencyIds.slice(0, 3),
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: jsonHeaders }
      );
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: jsonHeaders }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: jsonHeaders }
      );
    }

    const body: EvaluateRequest = await req.json();
    if (!body?.artifactId || !Array.isArray(body.competencyIds)) {
      return new Response(
        JSON.stringify({ error: 'artifactId and competencyIds are required' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const competencyIds = body.competencyIds
      .filter((id) => typeof id === 'string' && id.trim().length > 0)
      .map((id) => id.trim());

    if (competencyIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'competencyIds must include at least one id' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const { data: artifact, error: artifactError } = await adminClient
      .from('betterat_module_artifacts')
      .select('artifact_id,user_id,module_id,content')
      .eq('artifact_id', body.artifactId)
      .maybeSingle();

    if (artifactError) {
      return new Response(
        JSON.stringify({ error: 'Failed to load artifact' }),
        { status: 500, headers: jsonHeaders }
      );
    }

    if (!artifact) {
      return new Response(
        JSON.stringify({ error: 'Artifact not found' }),
        { status: 404, headers: jsonHeaders }
      );
    }

    if (artifact.user_id !== authData.user.id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: jsonHeaders }
      );
    }

    if (artifact.module_id !== 'clinical_reasoning') {
      return new Response(
        JSON.stringify({ error: 'Only clinical_reasoning is supported in v1' }),
        { status: 400, headers: jsonHeaders }
      );
    }

    const content = (artifact.content || {}) as ArtifactContent;
    const evaluation = buildFallbackEvaluation(content, competencyIds);

    return new Response(
      JSON.stringify(evaluation),
      { status: 200, headers: jsonHeaders }
    );
  } catch (error: any) {
    console.error('[clinical-reasoning-evaluate] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
