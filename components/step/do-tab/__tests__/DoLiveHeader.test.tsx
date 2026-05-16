import React from 'react';
import TestRenderer, {
  type ReactTestInstance,
  type ReactTestRenderer,
  act,
} from 'react-test-renderer';
import { Children, type ComponentType, type ReactNode } from 'react';
import { DoLiveHeader } from '../DoLiveHeader';

// React 19's act() requires this flag; without it TestRenderer prints a noisy
// warning even though every render is wrapped.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native', () => {
  const StyleSheet = { create: (styles: unknown) => styles, hairlineWidth: 1 };
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
    StyleSheet,
    Text: 'Text',
    View: 'View',
  };
});

const render = (props: { captureCount: number; elapsedMs: number; liveLabel?: string }) => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<DoLiveHeader {...props} />);
  });
  return tree;
};

const collectText = (root: ReactTestInstance): string =>
  root
    .findAll((n: ReactTestInstance) => n.type === 'Text')
    .map((n: ReactTestInstance) => {
      const children = Children.toArray(n.props.children as ReactNode);
      return children
        .map((c: ReactNode) =>
          typeof c === 'string' || typeof c === 'number' ? String(c) : '',
        )
        .join('');
    })
    .join(' | ');

describe('DoLiveHeader — Frame 2 · A + B', () => {
  it('renders the canonical LIVE label and a pulsing dot ring (Animated.View)', () => {
    const tree = render({ captureCount: 6, elapsedMs: 0 });
    const text = collectText(tree.root);
    expect(text).toContain('Live · capturing');
    expect(tree.root.findAllByType('AnimatedView' as unknown as ComponentType)).toHaveLength(1);
  });

  it('renders the captures count and elapsed mm:ss stats', () => {
    const tree = render({ captureCount: 14, elapsedMs: 65 * 60 * 1000 + 9 * 1000 });
    const text = collectText(tree.root);
    expect(text).toContain('14');
    expect(text).toContain('Captures');
    expect(text).toContain('65:09');
    expect(text).toContain('Elapsed');
  });
});
