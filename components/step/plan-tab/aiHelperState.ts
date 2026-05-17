/**
 * deriveAIHelperState — maps a plan's content to the three states the
 * <AIHelperLine> renders. Pure helper, no React.
 *
 * Used by both PlanTabIOSRegisterInterior and the debug demo route.
 */

import type { StepPlanData } from '@/types/step-detail';
import type { AIHelperState } from './AIHelperLine';

export interface AIHelperStateInput {
  what?: string;
  how?: { text: string }[];
  why?: string;
}

export function deriveAIHelperState(plan: StepPlanData | AIHelperStateInput): AIHelperState {
  const what =
    (plan as StepPlanData).what_will_you_do ?? (plan as AIHelperStateInput).what ?? '';
  const how =
    (plan as StepPlanData).how_sub_steps ?? (plan as AIHelperStateInput).how ?? [];
  const why =
    (plan as StepPlanData).why_reasoning ?? (plan as AIHelperStateInput).why ?? '';

  const hasWhat = Boolean(what.trim());
  const hasHow = how.some((step) => step.text?.trim());
  const hasWhy = Boolean(why.trim());

  if (hasWhat && hasHow && hasWhy) return 'filled';
  if (hasWhat || hasHow || hasWhy) return 'partial';
  return 'empty';
}
