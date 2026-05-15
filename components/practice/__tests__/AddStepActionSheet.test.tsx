import React from 'react';
import { AddStepActionSheet } from '../AddStepActionSheet';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native', () => ({
  Modal: 'Modal',
  Pressable: 'Pressable',
  StyleSheet: {
    create: (styles: unknown) => styles,
  },
  Text: 'Text',
  View: 'View',
}));

const flattenChildren = (node: any): any[] => {
  if (!node || typeof node !== 'object') return [];
  const children = React.Children.toArray(node.props?.children);
  return [node, ...children.flatMap(flattenChildren)];
};

describe('AddStepActionSheet', () => {
  it('renders the canonical two-path sheet labels and visibility state', () => {
    const element = AddStepActionSheet({
      visible: true,
      onClose: jest.fn(),
      onBuildWithCoach: jest.fn(),
      onChooseBlueprint: jest.fn(),
    }) as React.ReactElement<any>;

    expect(element.props.visible).toBe(true);
    const nodes = flattenChildren(element);
    const labels = nodes
      .map((node) => node.props?.accessibilityLabel ?? node.props?.title)
      .filter(Boolean);

    expect(labels).toEqual(expect.arrayContaining([
      'Build with AI Coach',
      'From a Blueprint',
      'Cancel',
    ]));
    expect(labels).not.toContain('Add Race');
    expect(labels).not.toContain('Publish Blueprint');
  });

  it('wires each sheet action to the supplied callback', () => {
    const onClose = jest.fn();
    const onBuildWithCoach = jest.fn();
    const onChooseBlueprint = jest.fn();
    const element = AddStepActionSheet({
      visible: true,
      onClose,
      onBuildWithCoach,
      onChooseBlueprint,
    }) as React.ReactElement<any>;

    const nodes = flattenChildren(element);
    nodes.find((node) => node.props?.testID === 'add-step-build-with-coach')?.props.onPress();
    nodes.find((node) => node.props?.testID === 'add-step-from-blueprint')?.props.onPress();
    nodes.find((node) => node.props?.testID === 'add-step-cancel')?.props.onPress();

    expect(onBuildWithCoach).toHaveBeenCalledTimes(1);
    expect(onChooseBlueprint).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
