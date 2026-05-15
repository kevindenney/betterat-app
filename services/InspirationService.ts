/**
 * InspirationService
 *
 * Orchestrates the "Inspiration → Interest → Blueprint" pipeline.
 * 1. extract() — calls the inspiration-extract edge function
 * 2. activate() — creates interest, blueprint, playbook, and seeds content
 */

import { supabase } from '@/services/supabase';
import { createLogger } from '@/lib/utils/logger';
import { createBlueprintFromCurriculum, subscribe as subscribeToBlueprint } from '@/services/BlueprintService';
import { getOrCreatePlaybook, addInboxItem } from '@/services/PlaybookService';
import { bulkPinStepToInterests } from '@/services/TimelineStepService';
import type {
  InspirationExtractInput,
  InspirationExtraction,
  ActivateInspirationInput,
  ActivateInspirationResult,
} from '@/types/inspiration';

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
    },
    signal: options.signal,
  } as any);

  if (error) {
    logger.error('Inspiration extraction failed', error);
    throw new Error(error.message ?? 'Failed to extract inspiration');
  }

  // Edge function returns the extraction directly as JSON
  return data as InspirationExtraction;
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
  const { userId, extraction, interestEdits, editedSteps, sourceContent, sourceContentType } = input;

  // Merge user edits into the proposed interest
  const proposedInterest = {
    ...extraction.proposed_interest,
    ...interestEdits,
  };

  // Use edited steps if provided, otherwise use extraction steps
  const blueprintSteps = editedSteps ?? extraction.blueprint.steps;

  // 1. Create or reuse the interest (avoid duplicates from re-runs)
  logger.debug('Creating interest:', proposedInterest.slug);
  let interest: { id: string; slug: string };
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
    stepIds: createdSteps.map((s) => s.id),
    playbookId: playbook.id,
  };
}
