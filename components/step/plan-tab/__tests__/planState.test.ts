import { getPlanInteriorState, hasPlanCoreContent, isPlanReady } from '../planState';
import type { StepPlanData } from '@/types/step-detail';

const emptyPlan: StepPlanData = {};

describe('planState', () => {
  it('returns locked when read-only', () => {
    expect(getPlanInteriorState({ planData: emptyPlan, readOnly: true })).toBe('locked');
  });

  it('returns locked when Do has started', () => {
    expect(getPlanInteriorState({ planData: emptyPlan, doStarted: true })).toBe('locked');
  });

  it('returns empty when core fields are absent', () => {
    expect(getPlanInteriorState({ planData: emptyPlan })).toBe('empty');
    expect(hasPlanCoreContent(emptyPlan)).toBe(false);
  });

  it('returns partial when only some core fields exist', () => {
    expect(getPlanInteriorState({ planData: { what_will_you_do: 'Start cleanly' } })).toBe('partial');
  });

  it('returns ready when what, how, and why exist', () => {
    const planData: StepPlanData = {
      what_will_you_do: 'Start cleanly',
      how_sub_steps: [{ id: '1', text: 'Accelerate on the line', sort_order: 0 }],
      why_reasoning: 'This is the current edge.',
    };
    expect(isPlanReady(planData)).toBe(true);
    expect(getPlanInteriorState({ planData })).toBe('ready');
  });
});
