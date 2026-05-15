import React from 'react';
import { OrgAdminOnboardingCard } from '../OrgAdminOnboardingCard';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  StyleSheet: {
    create: (styles: unknown) => styles,
    hairlineWidth: 1,
  },
  Text: 'Text',
  View: 'View',
}));

const flattenChildren = (node: any): any[] => {
  if (!node || typeof node !== 'object') return [];
  const children = React.Children.toArray(node.props?.children);
  return [node, ...children.flatMap(flattenChildren)];
};

const renderCard = (
  props: Partial<React.ComponentProps<typeof OrgAdminOnboardingCard>> = {},
) => {
  const onTakeTour = jest.fn();
  const onDismiss = jest.fn();
  const element = OrgAdminOnboardingCard({
    onTakeTour,
    onDismiss,
    ...props,
  }) as React.ReactElement<any>;
  return { element, nodes: flattenChildren(element), onTakeTour, onDismiss };
};

const textOf = (nodes: any[]) =>
  nodes
    .filter((n) => n?.type === 'Text')
    .flatMap((n) => React.Children.toArray(n.props?.children))
    .filter((c) => typeof c === 'string') as string[];

describe('OrgAdminOnboardingCard', () => {
  it('renders the canonical eyebrow, body copy, and action labels', () => {
    const { nodes } = renderCard();
    const texts = textOf(nodes);

    expect(texts).toEqual(
      expect.arrayContaining([
        'WELCOME TO ORG ADMIN',
        'Maybe later',
        'Take the tour →',
      ]),
    );
    expect(texts.some((t) => t.startsWith('Four minutes covers the roster'))).toBe(true);
  });

  it('greets the admin by name when adminName is provided', () => {
    const { nodes } = renderCard({ adminName: 'Patricia' });
    expect(textOf(nodes)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Welcome, Patricia\. /),
      ]),
    );
  });

  it('falls back to a nameless greeting when adminName is empty or whitespace', () => {
    expect(textOf(renderCard({ adminName: '' }).nodes)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Welcome\. /)]),
    );
    expect(textOf(renderCard({ adminName: '   ' }).nodes)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Welcome\. /)]),
    );
    expect(textOf(renderCard({ adminName: null }).nodes)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Welcome\. /)]),
    );
  });

  it('wires the primary button to onTakeTour', () => {
    const { nodes, onTakeTour } = renderCard();
    nodes
      .find((n) => n.props?.testID === 'org-admin-onboarding-take-tour')
      ?.props.onPress();
    expect(onTakeTour).toHaveBeenCalledTimes(1);
  });

  it('wires the ghost button and the X to onDismiss', () => {
    const { nodes, onDismiss } = renderCard();
    nodes
      .find((n) => n.props?.testID === 'org-admin-onboarding-maybe-later')
      ?.props.onPress();
    nodes
      .find((n) => n.props?.testID === 'org-admin-onboarding-dismiss')
      ?.props.onPress();
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});
