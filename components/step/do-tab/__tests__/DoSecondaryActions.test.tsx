import React from 'react';
import TestRenderer, {
  type ReactTestInstance,
  type ReactTestRenderer,
  act,
} from 'react-test-renderer';
import { DoSecondaryActions, type DoSecondaryActionsProps } from '../DoSecondaryActions';

// React 19's act() requires this flag; without it TestRenderer prints a noisy warning.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('react-native', () => {
  const StyleSheet = { create: (styles: unknown) => styles, hairlineWidth: 1 };
  return {
    Pressable: 'Pressable',
    StyleSheet,
    Text: 'Text',
    View: 'View',
  };
});

const render = (props: DoSecondaryActionsProps = {}) => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(<DoSecondaryActions {...props} />);
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

describe('DoSecondaryActions — Frame 3 · G', () => {
  it('renders canonical labels for both actions', () => {
    const tree = render();
    const text = allText(tree.root);
    expect(text).toContain('Add another capture');
    expect(text).toContain('Discard activity');
  });

  it('fires both callbacks on press when enabled', () => {
    const onAddAnotherCapture = jest.fn();
    const onDiscardActivity = jest.fn();
    const tree = render({ onAddAnotherCapture, onDiscardActivity });
    const pressables = tree.root.findAll(
      (n: ReactTestInstance) => typeof n.type === 'string' && n.type === 'Pressable',
    );
    expect(pressables).toHaveLength(2);
    pressables.forEach((p: ReactTestInstance) => {
      const onPress = p.props.onPress as (() => void) | undefined;
      onPress?.();
    });
    expect(onAddAnotherCapture).toHaveBeenCalledTimes(1);
    expect(onDiscardActivity).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons when readOnly is true', () => {
    const onAddAnotherCapture = jest.fn();
    const onDiscardActivity = jest.fn();
    const tree = render({ readOnly: true, onAddAnotherCapture, onDiscardActivity });
    const pressables = tree.root.findAll(
      (n: ReactTestInstance) => typeof n.type === 'string' && n.type === 'Pressable',
    );
    pressables.forEach((p: ReactTestInstance) => {
      expect(p.props.disabled).toBe(true);
      expect(p.props.onPress).toBeUndefined();
    });
    expect(onAddAnotherCapture).not.toHaveBeenCalled();
    expect(onDiscardActivity).not.toHaveBeenCalled();
  });
});
