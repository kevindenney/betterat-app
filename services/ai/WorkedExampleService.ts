/**
 * WorkedExampleService — one-tap "worked example" for the New Step composer.
 *
 * From a rough intent ("set up the Dragon rig before racing") it returns a
 * fully-populated, scenario-real step the user can edit before saving:
 *   - title    → the WHAT
 *   - why      → the WHY (plan.why_reasoning)
 *   - how[]    → the recipe / checklist (plan.how_sub_steps) — atemporal prep
 *   - runthrough[] → clock-anchored beats (step_beats) — the timed performance
 *
 * The model self-classifies the intent:
 *   - Recipe / prep intent ("set up the rig", "build a brain sheet") → fill
 *     `how`, leave `runthrough` empty.
 *   - Timed-event intent ("race the windward-leeward", "run the day shift") →
 *     fill `runthrough` beats (each with a time label), plus a short `how` for
 *     what to do beforehand.
 * "How is the preparation; Run-through is the performance."
 *
 * Reuses the generic step-plan-suggest edge function (system + prompt → text)
 * with a race-coaching-chat fallback, mirroring StepPlanAIService.
 */

import { supabase } from '@/services/supabase';
import { AIUsageService } from '@/services/ai/AIUsageService';
import { getInterestBeatsConfig } from '@/lib/interest-config';
import {
  gatherPlaybookLayers,
  getUserCapabilityProgress,
  getUserOrgPrograms,
  getFollowedUsersActivity,
} from '@/services/ai/StepPlanAIService';
import { getSuggestedNextSteps } from '@/services/BlueprintService';

export interface WorkedExampleHowStep {
  title: string;
  body: string;
}

export interface WorkedExampleBeat {
  time_label: string | null;
  title: string;
  body: string;
}

export interface WorkedExampleResult {
  title: string;
  why: string;
  how: WorkedExampleHowStep[];
  runthrough: WorkedExampleBeat[];
  /**
   * Phase 2 — the capability this example is designed to build, when capability
   * gaps were supplied. Surfaced to the user as a "This example builds: …" chip.
   */
  buildsCapability: string | null;
}

export interface GenerateWorkedExampleParams {
  /** The rough intent the user typed into WHAT. */
  intent: string;
  interestName: string;
  interestSlug?: string | null;
  /** Optional place context so detail lands location-real where it helps. */
  location?: string | null;
  /**
   * Phase 1 personalization — the user's own context, so the example lands
   * specific to *them* (their level, vocabulary, goals) instead of a
   * generic-expert template. All optional; absent fields are simply omitted.
   */
  personalContext?: WorkedExamplePersonalContext;
  /**
   * Phase 2 — when both are present, the service additionally gathers the
   * user's capability gaps + saved playbook concepts (server-side, keyed by
   * these ids) and folds them into the practitioner block so the example
   * targets a real growth edge in their own vocabulary.
   */
  userId?: string | null;
  interestId?: string | null;
}

export interface WorkedExamplePersonalContext {
  /** The current season/campaign/rotation goal for this interest. */
  visionStatement?: string | null;
  /** The longer-horizon trajectory this interest ladders toward. */
  lifetimeVision?: string | null;
  /** Titles of recent steps the user has worked on in this interest. */
  recentStepTitles?: string[];
  /** Names of the user's other interests, for cross-domain framing. */
  otherInterests?: string[];
  /**
   * Phase 2 — competency titles the user is under-practiced on (weakest first).
   * The example is steered to build at least one. Derived from low/zero attempt
   * counts + the latest review's flagged gaps (the trustworthy gap signals).
   */
  capabilityGaps?: string[];
  /** Phase 2 — names of concepts the user has saved to their own playbook. */
  knowledgeConcepts?: string[];
  /** Phase 2 — the latest weekly review's focus suggestion, one line. */
  focusSuggestion?: string | null;
  /**
   * Phase 3 — the org programs / blueprints the user is enrolled in for this
   * interest ("Org · Program"), so the example aligns with the curriculum
   * they're actually being held to.
   */
  programContext?: string[];
  /**
   * Phase 3 — what people the user follows have recently worked on in this
   * interest ("Name: step title"), a light peer signal.
   */
  peerActivity?: string[];
  /**
   * Phase 4 — blueprints the user subscribed to for this interest, with where
   * they are in each ("Blueprint — next: step"), so the example dovetails with
   * the curriculum they've committed to following.
   */
  blueprintContext?: string[];
}

function buildSystemPrompt(params: {
  interestName: string;
  runThroughLabel: string;
}): string {
  const { interestName, runThroughLabel } = params;
  const currentDate = new Date().toISOString().split('T')[0];
  return `You are an expert ${interestName} coach on BetterAt. The user has typed a rough intent for something they want to work on. Produce a single, fully fleshed-out "worked example" of that step — concrete enough that a practitioner could follow it without guessing. Use real, specific detail in this domain (actual numbers, settings, tools, named techniques) the way an expert would write it for a peer, not generic placeholders.

Today's date is ${currentDate}.

A step has TWO distinct dimensions. Classify the intent and fill the right one(s):

1. "how" — the PREPARATION. An atemporal, ordered recipe/checklist: "what do I DO, in order, to pull this off?" Tick-off items. Examples of recipe/prep intents: "set up the rig", "build a brain sheet", "warm up before the round".

2. "runthrough" — the PERFORMANCE. Clock-anchored beats of ONE timed event: "WHEN, on the clock, does each moment happen?" Every beat has a time label (e.g. "-30 min", "07:00", "hole 10"). Examples of timed-event intents: "race the windward-leeward", "run the day shift", "play the round".

Rules:
- A pure prep/recipe intent → fill "how" with 5-10 steps; return "runthrough": [].
- A timed-event intent → fill "runthrough" with 6-10 beats (each with a time_label), plus a short "how" (2-4 items) for what to set up beforehand.
- Some intents warrant both. Return whichever dimensions genuinely apply; never pad an empty dimension.
- Write in this domain's native vocabulary. The timed section is called the "${runThroughLabel}".
- Each "how" step: a short imperative title plus a body carrying the concrete detail (numbers, settings, why-it-matters).
- Each beat: a time_label, a short title, and a body with what happens and what to watch.
- If an "ABOUT THIS PRACTITIONER" block is provided, use it to calibrate the example to this specific person — match their level, lean on their stated goal and trajectory, ground location/detail in their real situation, and reference their other interests for cross-domain framing only where it genuinely fits. Tailor the substance; never restate the context back verbatim.
- If "Capabilities they're still building" are listed, design the example so that following it would genuinely build at least one of them, and set "builds_capability" to that capability's exact title. If no gaps are listed, set "builds_capability" to "".
- If "Concepts from their own playbook" are listed, use that exact vocabulary and lean on those ideas rather than introducing generic synonyms.
- If a "Program / curriculum" is listed, align the example with how that program would frame and sequence the work, so it dovetails with what they're already being taught.
- If "People they follow recently worked on" is listed, you may nod to shared approaches, but keep the example squarely about THIS practitioner — never copy a peer's step.
- If "Blueprints they're following" are listed, treat them as the curriculum the practitioner has committed to: sequence and frame the example so it slots in alongside where they are in that blueprint, reinforcing rather than duplicating it.

Respond with ONLY valid JSON, no markdown fences, in this exact shape:
{
  "title": "Polished, specific step title (4-9 words)",
  "why": "1-2 sentences on why this matters / what capability it builds",
  "how": [{ "title": "Imperative step", "body": "Concrete detail with real numbers/settings" }],
  "runthrough": [{ "time_label": "-30 min", "title": "Short beat title", "body": "What happens and what to watch" }],
  "builds_capability": "Exact title of the targeted capability, or \"\" if none were provided"
}`;
}

/**
 * Render the user's own context into a compact block the model can use to
 * tailor the example. Capped so it never crowds out the actual generation —
 * recent steps and other interests are the cheapest, highest-signal inputs.
 */
function buildPersonalContext(ctx: WorkedExamplePersonalContext | undefined): string {
  if (!ctx) return '';
  const lines: string[] = [];
  const vision = ctx.visionStatement?.trim();
  if (vision) lines.push(`- Current goal for this practice: ${vision}`);
  const lifetime = ctx.lifetimeVision?.trim();
  if (lifetime) lines.push(`- Longer-term trajectory: ${lifetime}`);
  const recent = (ctx.recentStepTitles ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (recent.length) {
    lines.push(`- Recent steps they've worked on: ${recent.join('; ')}`);
  }
  const others = (ctx.otherInterests ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (others.length) {
    lines.push(`- Their other interests: ${others.join(', ')}`);
  }
  const gaps = (ctx.capabilityGaps ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (gaps.length) {
    lines.push(
      `- Capabilities they're still building (bias the example to exercise one): ${gaps.join('; ')}`,
    );
  }
  const concepts = (ctx.knowledgeConcepts ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (concepts.length) {
    lines.push(`- Concepts from their own playbook to lean on: ${concepts.join('; ')}`);
  }
  const focus = ctx.focusSuggestion?.trim();
  if (focus) lines.push(`- Their current focus: ${focus}`);
  const programs = (ctx.programContext ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (programs.length) {
    lines.push(`- Program / curriculum they're enrolled in: ${programs.join('; ')}`);
  }
  const peers = (ctx.peerActivity ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 4);
  if (peers.length) {
    lines.push(`- People they follow recently worked on: ${peers.join('; ')}`);
  }
  const blueprints = (ctx.blueprintContext ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (blueprints.length) {
    lines.push(`- Blueprints they're following: ${blueprints.join('; ')}`);
  }
  if (!lines.length) return '';
  return `\n\nABOUT THIS PRACTITIONER:\n${lines.join('\n')}`;
}

function safeParse(responseText: string): WorkedExampleResult | null {
  const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
  const how: WorkedExampleHowStep[] = Array.isArray(parsed.how)
    ? parsed.how
        .map((h: any) => ({
          title: typeof h?.title === 'string' ? h.title.trim() : '',
          body: typeof h?.body === 'string' ? h.body.trim() : '',
        }))
        .filter((h: WorkedExampleHowStep) => h.title.length > 0)
    : [];
  const runthrough: WorkedExampleBeat[] = Array.isArray(parsed.runthrough)
    ? parsed.runthrough
        .map((b: any) => ({
          time_label:
            typeof b?.time_label === 'string' && b.time_label.trim()
              ? b.time_label.trim()
              : null,
          title: typeof b?.title === 'string' ? b.title.trim() : '',
          body: typeof b?.body === 'string' ? b.body.trim() : '',
        }))
        .filter((b: WorkedExampleBeat) => b.title.length > 0)
    : [];
  const buildsCapability =
    typeof parsed.builds_capability === 'string' && parsed.builds_capability.trim()
      ? parsed.builds_capability.trim()
      : null;
  return {
    title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
    why: typeof parsed.why === 'string' ? parsed.why.trim() : '',
    how,
    runthrough,
    buildsCapability,
  };
}

/**
 * Server-side gather of the signals that make the example compound over time.
 * Phase 2 — the user's growth edge: capability gaps (weakest-practiced
 * competencies), saved playbook concepts, and the latest review's focus line.
 * Phase 3 — their membership graph: org programs they're enrolled in and what
 * people they follow have recently worked on. Phase 4 — the blueprints they've
 * subscribed to and where they are in each. Cherry-picks existing gatherers
 * rather than rebuilding the queries; every fetch is defensive so a miss never
 * blocks generation.
 */
async function gatherGrowthContext(
  userId: string,
  interestId: string,
): Promise<{
  capabilityGaps: string[];
  knowledgeConcepts: string[];
  focusSuggestion: string | null;
  programContext: string[];
  peerActivity: string[];
  blueprintContext: string[];
}> {
  const empty = {
    capabilityGaps: [],
    knowledgeConcepts: [],
    focusSuggestion: null,
    programContext: [],
    peerActivity: [],
    blueprintContext: [],
  };
  try {
    // Personalization is best-effort enrichment, never a gate: if the gather
    // queries are slow (a degraded DB can leave them hanging rather than
    // rejecting, which the per-fetch .catch() can't rescue), fall back to an
    // unpersonalized example instead of blocking — or failing — generation.
    const gathered = await Promise.race([
      Promise.all([
        getUserCapabilityProgress(userId, interestId).catch(() => []),
        gatherPlaybookLayers(userId, interestId).catch(() => ({
          concepts: [],
          patterns: [],
          latestReview: null,
        })),
        getUserOrgPrograms(userId, interestId).catch(() => []),
        getFollowedUsersActivity(userId, interestId).catch(() => []),
        getSuggestedNextSteps(userId, interestId).catch(() => []),
      ]),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
    ]);
    if (!gathered) return empty;
    const [progress, playbook, programs, followed, blueprints] = gathered;

    // Weakest-practiced first; drop already-competent. attemptCount is the
    // trustworthy gap signal (the capability auto-tagging is otherwise a façade).
    const capabilityGaps = progress
      .filter((c) => c.status !== 'competent' && c.competencyTitle.trim())
      .sort((a, b) => a.attemptCount - b.attemptCount)
      .slice(0, 5)
      .map((c) => c.competencyTitle.trim());

    // User-authored concepts only (playbook_id set); settled first, then recent.
    const knowledgeConcepts = [...playbook.concepts]
      .filter((c) => c.playbook_id && c.title?.trim())
      .sort((a, b) => {
        const aSettled = a.state === 'settled' ? 1 : 0;
        const bSettled = b.state === 'settled' ? 1 : 0;
        if (aSettled !== bSettled) return bSettled - aSettled;
        return (b.updated_at ?? '').localeCompare(a.updated_at ?? '');
      })
      .slice(0, 6)
      .map((c) => c.title.trim());

    const rawFocus = playbook.latestReview?.focus_suggestion_md?.replace(/\s+/g, ' ').trim();
    const focusSuggestion = rawFocus
      ? rawFocus.length > 200
        ? `${rawFocus.slice(0, 199)}…`
        : rawFocus
      : null;

    const programContext = programs
      .map((p) => {
        const name = p.programName?.trim();
        if (!name) return '';
        return p.orgName?.trim() ? `${p.orgName.trim()} · ${name}` : name;
      })
      .filter(Boolean)
      .slice(0, 3);

    // One recent step title per followed person, so peers don't crowd out
    // the practitioner's own signal.
    const peerActivity = followed
      .map((u) => {
        const name = u.userName?.trim();
        const stepTitle = u.recentSteps.find((s) => s.title?.trim())?.title?.trim();
        if (!name || !stepTitle) return '';
        return `${name}: ${stepTitle}`;
      })
      .filter(Boolean)
      .slice(0, 4);

    // One line per subscribed blueprint (deduped), with the next step they
    // haven't adopted yet, so the model knows where they are in the curriculum.
    const seenBlueprints = new Set<string>();
    const blueprintContext = blueprints
      .filter((b) => {
        if (!b.blueprint_title?.trim() || seenBlueprints.has(b.blueprint_id)) return false;
        seenBlueprints.add(b.blueprint_id);
        return true;
      })
      .map((b) => {
        const title = b.blueprint_title.trim();
        const next = b.next_step_title?.trim();
        return next ? `${title} — next: ${next}` : title;
      })
      .slice(0, 3);

    return {
      capabilityGaps,
      knowledgeConcepts,
      focusSuggestion,
      programContext,
      peerActivity,
      blueprintContext,
    };
  } catch {
    return empty;
  }
}

export async function generateWorkedExample(
  params: GenerateWorkedExampleParams,
): Promise<WorkedExampleResult> {
  const { intent, interestName, interestSlug, location, personalContext, userId, interestId } =
    params;
  const trimmedIntent = intent.trim();
  if (!trimmedIntent) throw new Error('Intent is empty.');

  const runThroughLabel = getInterestBeatsConfig({
    interestSlug,
    interestName,
  }).sectionLabel;

  // Fold the user's compounding signals into the practitioner block when we can
  // key them to a real user + interest: their growth edge (Phase 2 — capability
  // gaps + saved concepts) and their membership graph (Phase 3 — enrolled
  // programs + what people they follow are working on).
  let mergedContext = personalContext;
  if (userId && interestId) {
    const growth = await gatherGrowthContext(userId, interestId);
    mergedContext = {
      ...personalContext,
      capabilityGaps: growth.capabilityGaps,
      knowledgeConcepts: growth.knowledgeConcepts,
      focusSuggestion: growth.focusSuggestion,
      programContext: growth.programContext,
      peerActivity: growth.peerActivity,
      blueprintContext: growth.blueprintContext,
    };
  }

  const systemPrompt = buildSystemPrompt({ interestName, runThroughLabel });
  const userMessage = `INTENT: ${trimmedIntent}${
    location ? `\nLOCATION: ${location}` : ''
  }${buildPersonalContext(mergedContext)}\n\nProduce the worked example as JSON.`;

  let responseText = '';
  try {
    const { data, error } = await supabase.functions.invoke('step-plan-suggest', {
      body: { system: systemPrompt, prompt: userMessage, max_tokens: 1536 },
    });
    if (!error && data?.text) responseText = data.text;
  } catch {
    // fall through to fallback
  }

  if (!responseText) {
    const { data, error } = await supabase.functions.invoke('race-coaching-chat', {
      body: { prompt: `${systemPrompt}\n\n${userMessage}`, max_tokens: 1536 },
    });
    if (error || !data?.text) throw new Error('AI generation failed');
    responseText = data.text;
  }

  const parsed = safeParse(responseText);
  if (!parsed || (!parsed.how.length && !parsed.runthrough.length)) {
    throw new Error('Worked example came back empty.');
  }

  void AIUsageService.recordUsage('plan_generation');
  return parsed;
}
