import React from 'react';
import TestRenderer, {
  type ReactTestInstance,
  type ReactTestRenderer,
  act,
} from 'react-test-renderer';
import { DoTabInterior, type DoTabInteriorProps } from '../DoTabInterior';
import { hasPlanStartingFrameContent } from '../PlanStartingFrameRow';
import type { StepPlanData } from '@/types/step-detail';

// React 19's act() requires this flag; without it TestRenderer prints a noisy
// warning even though every render is wrapped. Set after imports so eslint
// import/first stays happy.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native', () => {
  const StyleSheet = {
    create: (styles: unknown) => styles,
    hairlineWidth: 1,
    absoluteFillObject: {},
  };
  return {
    Animated: {
      Value: class {
        constructor(public v: number) {}
        interpolate() {
          return this;
        }
      },
      View: 'AnimatedView',
      timing: () => ({ start: jest.fn(), stop: jest.fn() }),
      loop: () => ({ start: jest.fn(), stop: jest.fn() }),
    },
    Image: 'Image',
    Pressable: 'Pressable',
    ScrollView: 'ScrollView',
    StyleSheet,
    Text: 'Text',
    View: 'View',
  };
});

const renderInterior = (overrides: Partial<DoTabInteriorProps> = {}) => {
  const props: DoTabInteriorProps = {
    state: 'pre_activity',
    planData: {},
    captures: [],
    ...overrides,
  };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<DoTabInterior {...props} />);
  });
  return tree;
};

const componentNames = (root: ReactTestInstance): string[] =>
  root.findAll(() => true).map((n: ReactTestInstance) => {
    const t = n.type as { name?: string; displayName?: string } | string;
    if (typeof t === 'string') return t;
    return t.displayName ?? t.name ?? '';
  });

describe('DoTabInterior — state gating', () => {
  it('mounts DoStartCard and PlanStartingFrameRow when state is pre_activity', () => {
    const tree = renderInterior({ state: 'pre_activity' });
    const names = componentNames(tree.root);
    expect(names).toContain('DoStartCard');
    expect(names).toContain('PlanStartingFrameRow');
    expect(names).not.toContain('DoLiveCard');
  });

  it('mounts DoLiveCard (Frame 2) when state is live and hides Frame 1 components', () => {
    const tree = renderInterior({ state: 'live' });
    const names = componentNames(tree.root);
    expect(names).toContain('DoLiveCard');
    expect(names).not.toContain('DoStartCard');
    expect(names).not.toContain('PlanStartingFrameRow');
  });

  it('mounts DoPostActivityCard (Frame 3) when state is post_activity and hides Frame 1/2 components', () => {
    const tree = renderInterior({ state: 'post_activity' });
    const names = componentNames(tree.root);
    expect(names).toContain('DoPostActivityCard');
    expect(names).not.toContain('DoStartCard');
    expect(names).not.toContain('PlanStartingFrameRow');
    expect(names).not.toContain('DoLiveCard');
  });
});

describe('hasPlanStartingFrameContent', () => {
  it('returns false for an empty plan', () => {
    expect(hasPlanStartingFrameContent({})).toBe(false);
  });

  it('returns true when what_will_you_do has content', () => {
    const plan: StepPlanData = { what_will_you_do: 'Start cleanly' };
    expect(hasPlanStartingFrameContent(plan)).toBe(true);
  });

  it('returns true when any how_sub_step has text', () => {
    const plan: StepPlanData = {
      how_sub_steps: [{ id: '1', text: 'Accelerate on the line', sort_order: 0, completed: false }],
    };
    expect(hasPlanStartingFrameContent(plan)).toBe(true);
  });

  it('returns true when why_reasoning has content', () => {
    expect(hasPlanStartingFrameContent({ why_reasoning: 'Current edge' })).toBe(true);
  });

  it('ignores whitespace-only fields', () => {
    expect(
      hasPlanStartingFrameContent({
        what_will_you_do: '   ',
        why_reasoning: '\n',
        how_sub_steps: [{ id: '1', text: ' ', sort_order: 0, completed: false }],
      }),
    ).toBe(false);
  });
});
