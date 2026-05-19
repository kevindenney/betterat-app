import { supabase } from './supabase';
import { logger } from '@/lib/logger';
import type { StepActData, StepPlanData } from '@/types/step-detail';

export interface ReflectSynthesisInput {
  stepTitle: string;
  interestName?: string | null;
  plan?: StepPlanData;
  act?: StepActData;
}

export async function draftReflectSynthesis(input: ReflectSynthesisInput): Promise<string> {
  const fallback = buildLocalDraft(input);
  try {
    const { data, error } = await supabase.functions.invoke('step-plan-suggest', {
      body: {
        mode: 'reflect_synthesis',
        step_title: input.stepTitle,
        interest_name: input.interestName,
        plan: input.plan ?? {},
        act: input.act ?? {},
      },
    });
    if (error) throw error;
    const text =
      typeof data?.draft === 'string'
        ? data.draft
        : typeof data?.text === 'string'
          ? data.text
          : null;
    return text?.trim() || fallback;
  } catch (err) {
    logger.warn('Reflect synthesis service unavailable; using local draft', err);
    return fallback;
  }
}

function buildLocalDraft(input: ReflectSynthesisInput): string {
  const observations = input.act?.observations ?? [];
  const firstObservation = observations.find((obs) => obs.text?.trim())?.text?.trim();
  const plan = input.plan?.what_will_you_do?.trim();
  if (firstObservation && plan) {
    return `I came in trying to ${plan}. The clearest evidence from the session was: ${firstObservation}`;
  }
  if (firstObservation) {
    return `The clearest thing I noticed was: ${firstObservation}`;
  }
  if (plan) {
    return `I practiced against the plan: ${plan}`;
  }
  return `I finished ${input.stepTitle}. The useful reflection starts with what changed during the work.`;
}
