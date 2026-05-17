import { deriveAIHelperState } from '@/components/step/plan-tab/aiHelperState';

describe('deriveAIHelperState', () => {
  it('returns "empty" when nothing is filled', () => {
    expect(deriveAIHelperState({})).toBe('empty');
  });

  it('returns "partial" when only WHAT is filled', () => {
    expect(deriveAIHelperState({ what_will_you_do: 'Run a clean lane' })).toBe('partial');
  });

  it('returns "partial" when only one sub-step has text', () => {
    expect(
      deriveAIHelperState({
        how_sub_steps: [
          { id: 'a', text: 'first', sort_order: 0, completed: false },
        ],
      }),
    ).toBe('partial');
  });

  it('returns "filled" when WHAT + HOW + WHY are all populated', () => {
    expect(
      deriveAIHelperState({
        what_will_you_do: 'Run a clean lane',
        how_sub_steps: [
          { id: 'a', text: 'set up', sort_order: 0, completed: false },
        ],
        why_reasoning: 'Right side is favored',
      }),
    ).toBe('filled');
  });

  it('treats whitespace-only fields as unfilled', () => {
    expect(
      deriveAIHelperState({
        what_will_you_do: '   ',
        why_reasoning: '\n',
        how_sub_steps: [{ id: 'a', text: '  ', sort_order: 0, completed: false }],
      }),
    ).toBe('empty');
  });
});
