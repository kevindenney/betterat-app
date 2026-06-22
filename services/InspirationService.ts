/**
 * InspirationService
 *
 * Orchestrates the "Inspiration → Interest → Blueprint" pipeline.
 * 1. extract() — calls the inspiration-extract edge function
 * 2. activate() — creates interest, blueprint, playbook, and seeds content
 */

import { supabase } from '@/services/supabase';
import { createLogger, serializeError } from '@/lib/utils/logger';
import { createBlueprintFromCurriculum, subscribe as subscribeToBlueprint } from '@/services/BlueprintService';
import { getOrCreatePlaybook, addInboxItem } from '@/services/PlaybookService';
import { bulkPinStepToInterests, createStep } from '@/services/TimelineStepService';
import { SeasonService } from '@/services/SeasonService';
import type {
  InspirationExtractInput,
  InspirationExtraction,
  InspirationCalendar,
  InspirationCalendarSeason,
  InspirationCalendarStep,
  ActivateInspirationInput,
  ActivateInspirationResult,
} from '@/types/inspiration';
import type { Season } from '@/types/season';

const logger = createLogger('InspirationService');

// ---------------------------------------------------------------------------
// 1. Extract — call edge function to analyze inspiring content
// ---------------------------------------------------------------------------

export async function extractInspiration(
  input: InspirationExtractInput,
  options: { signal?: AbortSignal } = {},
): Promise<InspirationExtraction> {
  // The configured Supabase client in services/supabase.ts forwards
  // options.signal into the per-request fetch via its global fetch override
  // (see services/supabase.ts:154-172). functions-js v2 destructures `signal`
  // off the invoke options and passes it to fetch (see
  // node_modules/@supabase/functions-js/dist/main/FunctionsClient.js:30). The
  // `as any` cast covers the case where the SDK's published types do not
  // expose `signal` on FunctionsInvokeOptions.
  const { data, error } = await supabase.functions.invoke('inspiration-extract', {
    body: {
      content_type: input.content_type,
      content: input.content,
      user_existing_interest_slugs: input.user_existing_interest_slugs,
      attachments: input.attachments ?? [],
      interest_id: input.interest_id ?? null,
      interest_slug: input.interest_slug ?? null,
      interest_label: input.interest_label ?? null,
      persona_vocabulary: input.persona_vocabulary ?? null,
      recurring_anchors: input.recurring_anchors ?? null,
    },
    signal: options.signal,
  } as any);

  if (error) {
    let edgeMessage: string | null = null;
    const response = (error as { context?: Response; response?: Response })?.context
      ?? (error as { context?: Response; response?: Response })?.response;
    if (response?.clone) {
      try {
        const payload = await response.clone().json();
        edgeMessage = typeof payload?.error === 'string' ? payload.error : null;
      } catch {
        // Keep the original SDK error when the response body is not JSON.
      }
    }
    // This failure is surfaced to the user in the wizard's error state.
    // Logging at error-level in React Native dev triggers the console overlay,
    // which hijacks the modal and makes a handled network/input failure feel
    // like a crash. Keep it available for debugging without promoting it to a
    // red-screen style developer error.
    logger.info('Inspiration extraction failed', { ...serializeError(error), edgeMessage });
    throw new Error(edgeMessage ?? error.message ?? 'Failed to extract inspiration');
  }

  // Edge function returns the extraction directly as JSON
  return data as InspirationExtraction;
}

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
}

function isoDateToStartsAt(value: string | null | undefined): string | null {
  return parseDateOnly(value)?.toISOString() ?? null;
}

function inferSeasonYear(season: InspirationCalendarSeason): number {
  return Number(season.start_date.slice(0, 4)) || new Date().getFullYear();
}

function uniqueCalendarSteps(steps: InspirationCalendarStep[]): InspirationCalendarStep[] {
  const seen = new Set<string>();
  return steps.filter((step) => {
    const key = [
      step.title.trim().toLowerCase(),
      step.date ?? '',
      step.recurrence ?? '',
      step.season_name ?? '',
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(step.title.trim());
  });
}

async function createCalendarFromInspiration(params: {
  userId: string;
  interestId: string;
  blueprintId: string;
  calendar: InspirationCalendar | null | undefined;
}): Promise<string[]> {
  const { userId, interestId, blueprintId, calendar } = params;
  if (!calendar || !Array.isArray(calendar.steps) || calendar.steps.length === 0) return [];

  const seasonByName = new Map<string, Season>();
  const validSeasonDefs = (calendar.seasons ?? []).filter(
    (season) => season.name?.trim() && parseDateOnly(season.start_date) && parseDateOnly(season.end_date),
  );

  for (const season of validSeasonDefs) {
    try {
      const created = await SeasonService.createSeason(
        {
          name: season.name.trim(),
          year: inferSeasonYear(season),
          start_date: season.start_date,
          end_date: season.end_date,
          interest_id: interestId,
          description: 'Created from an Inspiration calendar dump.',
        },
        userId,
      );
      seasonByName.set(season.name.trim().toLowerCase(), created);
    } catch (err) {
      logger.warn('Failed to create inspiration season (non-fatal):', err);
    }
  }

  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const stepsToCreate = uniqueCalendarSteps(calendar.steps);

  const createdIds: string[] = [];
  for (let i = 0; i < stepsToCreate.length; i++) {
    const step = stepsToCreate[i];
    const date = parseDateOnly(step.date);
    const season = step.season_name
      ? seasonByName.get(step.season_name.trim().toLowerCase()) ?? null
      : null;
    const status =
      step.tense === 'past' || (date && date < todayUTC)
        ? 'completed'
        : 'pending';

    try {
      const created = await createStep({
        user_id: userId,
        interest_id: interestId,
        source_type: 'suggestion',
        source_id: blueprintId,
        title: step.title,
        description: step.source_span ?? null,
        category: step.type_label || 'general',
        status,
        starts_at: isoDateToStartsAt(step.date),
        season_id: season?.id ?? null,
        is_race: step.is_anchor && /race|regatta/i.test(`${step.type_label} ${step.title}`),
        sort_order: i + 1,
        metadata: {
          inspiration_calendar: {
            type_label: step.type_label,
            tense: step.tense,
            confidence: step.confidence,
            recurrence: step.recurrence,
            is_anchor: step.is_anchor,
            source_span: step.source_span ?? null,
          },
          source: 'inspiration_flow',
          season_name: step.season_name ?? null,
        },
      });
      createdIds.push(created.id);
    } catch (err) {
      logger.warn('Failed to create inspiration calendar step (non-fatal):', err);
    }
  }

  return createdIds;
}

// ---------------------------------------------------------------------------
// 2. Activate — create interest, blueprint, playbook, seed content
// ---------------------------------------------------------------------------

export async function activateInspiration(
  input: ActivateInspirationInput,
  proposeInterestFn: (input: {
    name: string;
    slug: string;
    description: string;
    parent_id?: string | null;
    accent_color: string;
    icon_name: string;
  }) => Promise<{ id: string; slug: string }>,
): Promise<ActivateInspirationResult> {
  const {
    userId,
    extraction,
    interestEdits,
    selectedExistingInterestId,
    editedSteps,
    calendarReview,
    sourceContent,
    sourceContentType,
  } = input;

  // Merge user edits into the proposed interest
  const proposedInterest = {
    ...extraction.proposed_interest,
    ...interestEdits,
  };

  // Use edited steps if provided, otherwise use extraction steps
  const blueprintSteps = editedSteps ?? extraction.blueprint.steps;

  // 1. Create or reuse the interest (avoid duplicates from re-runs)
  let interest: { id: string; slug: string };

  if (selectedExistingInterestId) {
    const { data: membership, error: membershipError } = await supabase
      .from('user_interests')
      .select('interest_id')
      .eq('user_id', userId)
      .eq('interest_id', selectedExistingInterestId)
      .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) {
      throw new Error('That interest is no longer available in your library.');
    }

    const { data: existingInterest, error: interestError } = await supabase
      .from('interests')
      .select('id, slug')
      .eq('id', selectedExistingInterestId)
      .single();

    if (interestError) throw interestError;

    interest = { id: existingInterest.id, slug: existingInterest.slug };
    logger.debug('Using existing interest:', interest.slug);
  } else {
    logger.debug('Creating interest:', proposedInterest.slug);
    const { data: existing } = await supabase
      .from('interests')
      .select('id, slug')
      .eq('created_by_user_id', userId)
      .ilike('name', proposedInterest.name)
      .limit(1)
      .maybeSingle();

    if (existing) {
      interest = { id: existing.id, slug: existing.slug };
      logger.debug('Reusing existing interest:', interest.slug);
    } else {
      interest = await proposeInterestFn({
        name: proposedInterest.name,
        slug: proposedInterest.slug,
        description: proposedInterest.description,
        accent_color: proposedInterest.accent_color,
        icon_name: proposedInterest.icon_name,
      });
      logger.debug('Interest created:', interest.slug);
    }
  }

  // 2. Create the blueprint with steps
  logger.debug('Creating blueprint for interest:', interest.slug);
  const { blueprint, steps: createdSteps } = await createBlueprintFromCurriculum({
    userId,
    interestSlug: interest.slug,
    interestId: interest.id,
    blueprintTitle: extraction.blueprint.title,
    blueprintDescription: extraction.blueprint.description,
    steps: blueprintSteps.map((step) => ({
      title: step.title,
      description: step.description,
      step_type: step.category,
      sub_steps: step.sub_steps,
      reasoning: step.reasoning,
      estimated_duration_days: step.estimated_duration_days,
    })),
    inspirationSourceUrl: sourceContentType === 'url' ? sourceContent : null,
    inspirationSourceText: sourceContentType !== 'url' ? sourceContent : null,
    inspirationSourceType: sourceContentType,
  });

  // 2a. Auto-subscribe the creator to their own blueprint
  try {
    await subscribeToBlueprint(userId, blueprint.id);
  } catch (err) {
    logger.warn('Failed to auto-subscribe to blueprint (non-fatal):', err);
  }

  // 2b. Auto-pin steps with cross-interest overlaps
  try {
    for (let i = 0; i < createdSteps.length; i++) {
      const stepDef = blueprintSteps[i];
      if (stepDef?.cross_interest_slugs?.length) {
        await bulkPinStepToInterests(
          createdSteps[i].id,
          userId,
          stepDef.cross_interest_slugs,
        );
      }
    }
  } catch (err) {
    logger.warn('Failed to auto-pin cross-interest steps (non-fatal):', err);
  }

  // 2c. Create the reviewed seasons and dated/undated calendar steps.
  let calendarStepIds: string[] = [];
  try {
    calendarStepIds = await createCalendarFromInspiration({
      userId,
      interestId: interest.id,
      blueprintId: blueprint.id,
      calendar: calendarReview,
    });
  } catch (err) {
    logger.warn('Failed to seed inspiration calendar (non-fatal):', err);
  }

  // 3. Create the playbook and seed source content
  logger.debug('Creating playbook for interest:', interest.id);
  const playbook = await getOrCreatePlaybook(userId, interest.id);

  try {
    const inboxKind = sourceContentType === 'url' ? 'url' : 'text';
    await addInboxItem(userId, {
      playbook_id: playbook.id,
      kind: inboxKind,
      title: sourceContentType === 'url' ? 'Inspiration source' : 'Inspiration notes',
      source_url: sourceContentType === 'url' ? sourceContent : null,
      raw_text: sourceContentType !== 'url' ? sourceContent : null,
      metadata: {
        source: 'inspiration_flow',
        summary: extraction.source_summary,
      },
    });
  } catch (err) {
    logger.warn('Failed to seed playbook inbox (non-fatal):', err);
  }

  // NOTE: Do NOT switch interest here — it re-renders the parent and unmounts
  // the wizard. The success step handles the switch on navigation.
  return {
    interestId: interest.id,
    interestSlug: interest.slug,
    blueprintId: blueprint.id,
    blueprintSlug: blueprint.slug,
    stepIds: [...createdSteps.map((s) => s.id), ...calendarStepIds],
    playbookId: playbook.id,
  };
}
