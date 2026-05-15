import type { StepPlanData } from '@/types/step-detail';

export type PlanInteriorState = 'empty' | 'partial' | 'ready' | 'locked';

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasSubStep(planData: StepPlanData): boolean {
  return Boolean(
    planData.how_sub_steps?.some((step) => hasText(step.text)),
  );
}

export function hasPlanCoreContent(planData: StepPlanData): boolean {
  return hasText(planData.what_will_you_do) || hasSubStep(planData) || hasText(planData.why_reasoning);
}

export function isPlanReady(planData: StepPlanData): boolean {
  return hasText(planData.what_will_you_do) && hasSubStep(planData) && hasText(planData.why_reasoning);
}

export function getPlanInteriorState(input: {
  planData: StepPlanData;
  readOnly?: boolean;
  doStarted?: boolean;
}): PlanInteriorState {
  if (input.readOnly === true || input.doStarted === true) {
    return 'locked';
  }

  if (isPlanReady(input.planData)) {
    return 'ready';
  }

  if (!hasPlanCoreContent(input.planData)) {
    return 'empty';
  }

  return 'partial';
}
