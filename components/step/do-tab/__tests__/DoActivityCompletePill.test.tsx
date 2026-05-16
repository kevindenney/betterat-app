import React from 'react';
import TestRenderer, {
  type ReactTestInstance,
  type ReactTestRenderer,
  act,
} from 'react-test-renderer';
import { DoActivityCompletePill } from '../DoActivityCompletePill';

// React 19's act() requires this flag; without it TestRenderer prints a noisy warning.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('react-native', () => {
  const StyleSheet = { create: (styles: unknown) => styles, hairlineWidth: 1 };
  return { StyleSheet, Text: 'Text', View: 'View' };
});

const render = (props: { label?: string } = {}) => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<DoActivityCompletePill {...props} />);
  });
  return tree;
};

const allText = (root: ReactTestInstance): string =>
  root
    .findAll((n: ReactTestInstance) => n.type === 'Text')
    .map((n: ReactTestInstance) => {
      const children = React.Children.toArray(n.props.children as React.ReactNode);
      return children
        .map((c: React.ReactNode) =>
          typeof c === 'string' || typeof c === 'number' ? String(c) : '',
        )
        .join('');
    })
    .join(' | ');

describe('DoActivityCompletePill — Frame 3 · A', () => {
  it('renders the canonical "Activity complete" label and a tick (no Animated.View)', () => {
    const tree = render();
    expect(allText(tree.root)).toContain('Activity complete');
    // No coral pulse — verify no Animated.View component anywhere in the tree.
    expect(
      tree.root.findAll(
        (n: ReactTestInstance) => typeof n.type === 'string' && n.type === 'AnimatedView',
      ),
    ).toHaveLength(0);
  });

  it('renders an Ionicons checkmark inside the tick disc', () => {
    const tree = render();
    const icons = tree.root.findAll(
      (n: ReactTestInstance) => typeof n.type === 'string' && n.type === 'Ionicons',
    );
    expect(icons.length).toBeGreaterThan(0);
    expect(icons.some((i: ReactTestInstance) => i.props.name === 'checkmark')).toBe(true);
  });

  it('accepts a custom label override', () => {
    const tree = render({ label: 'Run logged' });
    expect(allText(tree.root)).toContain('Run logged');
  });
});
