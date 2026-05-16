import React from 'react';
import { DoTabInterior, type DoTabInteriorProps } from '../DoTabInterior';
import { hasPlanStartingFrameContent } from '../PlanStartingFrameRow';
import type { StepPlanData } from '@/types/step-detail';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: {
    create: (styles: unknown) => styles,
    hairlineWidth: 1,
  },
  Text: 'Text',
  View: 'View',
}));

type RNNode = { type: unknown; props?: Record<string, unknown> };

const flatten = (node: unknown): RNNode[] => {
  if (!node || typeof node !== 'object') return [];
  const entry = node as { type?: unknown; props?: { children?: unknown } };
  if (!entry.type) return [];
  const children = React.Children.toArray(entry.props?.children);
  return [entry as RNNode, ...children.flatMap(flatten)];
};

const typeNames = (nodes: ReturnType<typeof flatten>): string[] =>
  nodes
    .map((n) => {
      const t = n.type as { name?: string; displayName?: string } | string;
      if (typeof t === 'string') return t;
      return t.displayName ?? t.name ?? '';
    })
    .filter(Boolean);

const renderInterior = (overrides: Partial<DoTabInteriorProps> = {}) => {
  const props: DoTabInteriorProps = {
    state: 'pre_activity',
    planData: {},
    captures: [],
    ...overrides,
  };
  const element = DoTabInterior(props) as React.ReactElement<unknown>;
  return { element, nodes: flatten(element) };
};

describe('DoTabInterior — Frame 1 state gating', () => {
  it('mounts DoStartCard and PlanStartingFrameRow when state is pre_activity', () => {
    const { nodes } = renderInterior({ state: 'pre_activity' });
    const names = typeNames(nodes);
    expect(names).toContain('DoStartCard');
    expect(names).toContain('PlanStartingFrameRow');
  });

  it('does NOT mount Frame 1 components when state is live (Frame 2 deferred)', () => {
    const { nodes } = renderInterior({ state: 'live' });
    const names = typeNames(nodes);
    expect(names).not.toContain('DoStartCard');
    expect(names).not.toContain('PlanStartingFrameRow');
  });

  it('does NOT mount Frame 1 components when state is post_activity (Frame 3 deferred)', () => {
    const { nodes } = renderInterior({ state: 'post_activity' });
    const names = typeNames(nodes);
    expect(names).not.toContain('DoStartCard');
    expect(names).not.toContain('PlanStartingFrameRow');
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
