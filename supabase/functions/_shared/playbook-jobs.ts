/**
 * Shared, service-role-callable core for the two time-based Playbook jobs:
 * pattern detection and weekly review.
 *
 * These take an already-authorized service-role `supabase` client plus an
 * explicit `userId`/`interestId` and do NO auth or ownership checks of their
 * own — callers are responsible for that. This lets BOTH the per-user edge
 * function wrappers (which authenticate + assert ownership) and the
 * `playbook-scheduled-jobs` cron orchestrator (which iterates all eligible
 * playbooks under a shared secret) reuse identical logic.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { complete } from './ai/provider.ts';
import { extractJson, insertSuggestions } from './playbook.ts';

/**
 * Detect cross-debrief patterns over a lookback window and enqueue them as
 * `pattern_detected` suggestions. Returns `insufficient_data` when there are
 * fewer than 3 debriefs to reason over.
 */
export async function runPatternDetect(
  supabase: SupabaseClient,
  userId: string,
  playbookId: string,
  interestId: string,
  lookbackDays = 60,
): Promise<{ suggestions_created: number; reason?: string }> {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: steps = [] } = await supabase
    .from('timeline_steps')
    .select('id, title, starts_at, metadata')
    .eq('user_id', userId)
    .eq('interest_id', interestId)
    .gte('starts_at', since)
    .order('starts_at', { ascending: true })
    .limit(100);

  const withDebrief = (steps ?? []).filter(
    (s: any) => (s.metadata as Record<string, unknown>)?.review,
  );

  if (withDebrief.length < 3) {
    return { suggestions_created: 0, reason: 'insufficient_data' };
  }

  const system = `You are BetterAt's Playbook pattern detector. You identify recurring correlations across a user's practice debriefs — things like "X happens when Y" or "mistake Z appears in condition W".

Return ONLY a JSON array of 0–5 patterns:
[{
  "title": "<short headline>",
  "body_md": "<markdown: what the pattern is, the conditions, the evidence>",
  "evidence": [{"type": "step", "id": "<uuid>", "note": "<one line>"}]
}]

Be rigorous: only surface patterns with ≥2 supporting debriefs. Return [] if nothing holds up.`;

  const userPrompt = `DEBRIEFS (${withDebrief.length}):
${withDebrief.map((s: any) => `[${s.id}] ${s.starts_at?.slice(0, 10)} — ${s.title}\n${JSON.stringify(s.metadata.review)}`).join('\n\n')}`;

  const { text: aiText } = await complete({
    task: 'playbook',
    system,
    messages: [{ role: 'user', content: userPrompt }],
    maxOutputTokens: 2000,
    temperature: 0.3,
  });

  let patterns: {
    title?: string;
    body_md?: string;
    evidence?: Record<string, unknown>[];
  }[] = [];
  try {
    patterns = extractJson(aiText);
    if (!Array.isArray(patterns)) patterns = [];
  } catch {
    patterns = [];
  }

  const rows = patterns
    .filter((p) => p.title && p.body_md)
    .slice(0, 5)
    .map((p) => ({
      playbook_id: playbookId,
      user_id: userId,
      kind: 'pattern_detected',
      payload: {
        title: p.title,
        body_md: p.body_md,
        evidence: p.evidence ?? [],
      },
      provenance: {
        source_step_ids: withDebrief.map((s: any) => s.id),
        model: 'gemini-2.5-flash',
      },
    }));

  const created = await insertSuggestions(supabase, rows);
  return { suggestions_created: created };
}

/**
 * Compile a weekly review + focus suggestion + knowledge-health check and
 * enqueue them as `weekly_review` (+ optional `focus_suggestion`) suggestions.
 */
export async function runWeeklyReview(
  supabase: SupabaseClient,
  userId: string,
  playbookId: string,
  interestId: string,
  periodStart?: string,
  periodEnd?: string,
): Promise<{ suggestions_created: number }> {
  const end = periodEnd ? new Date(periodEnd) : new Date();
  const start = periodStart
    ? new Date(periodStart)
    : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  // Pull week's debriefs
  const { data: steps = [] } = await supabase
    .from('timeline_steps')
    .select('id, title, description, metadata, starts_at')
    .eq('user_id', userId)
    .eq('interest_id', interestId)
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
    .eq('playbook_id', playbookId)
    .gte('updated_at', startISO)
    .lte('updated_at', endISO);

  // New resources in the window
  const { data: resources = [] } = await supabase
    .from('playbook_resources')
    .select('id, title, created_at')
    .eq('playbook_id', playbookId)
    .gte('created_at', startISO)
    .lte('created_at', endISO);

  // Fetch ALL concept titles (no body_md) for health check — lightweight query
  const { data: allConceptTitles = [] } = await supabase
    .from('playbook_concepts')
    .select('id, title, updated_at')
    .eq('interest_id', interestId)
    .or(`playbook_id.eq.${playbookId},playbook_id.is.null`);

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
      playbook_id: playbookId,
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
      playbook_id: playbookId,
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
  return { suggestions_created: created };
}
