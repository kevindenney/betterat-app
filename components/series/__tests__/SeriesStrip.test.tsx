import React from 'react';
import { SeriesStrip } from '../SeriesStrip';

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

const flatten = (node: any): any[] => {
  if (!node || typeof node !== 'object') return [];
  const children = React.Children.toArray(node.props?.children);
  return [node, ...children.flatMap(flatten)];
};

const renderStrip = (
  props: Partial<React.ComponentProps<typeof SeriesStrip>> = {},
) => {
  const onPress = jest.fn();
  const element = SeriesStrip({
    label: 'Season',
    name: 'Winter 2025–2026',
    currentIndex: 6,
    totalSteps: 14,
    progress: 6 / 14,
    onPress,
    ...props,
  }) as React.ReactElement<any>;
  return { element, nodes: flatten(element), onPress };
};

const textOf = (nodes: any[]) =>
  nodes
    .filter((n) => n?.type === 'Text')
    .flatMap((n) => React.Children.toArray(n.props?.children))
    .filter((c) => typeof c === 'string') as string[];

const findByTestID = (nodes: any[], id: string) =>
  nodes.find((n) => n.props?.testID === id);

describe('SeriesStrip', () => {
  it('uppercases the label into the eyebrow', () => {
    const { nodes } = renderStrip({ label: 'Season' });
    const eyebrow = findByTestID(nodes, 'series-strip-eyebrow');
    expect(eyebrow).toBeDefined();
    const eyebrowText = React.Children
      .toArray(eyebrow.props.children)
      .filter((c) => typeof c === 'string');
    expect(eyebrowText).toContain('SEASON');
  });

  it('reflects the per-interest label when vocabulary changes', () => {
    const sailing = renderStrip({ label: 'Season' });
    const nursing = renderStrip({ label: 'Term' });
    expect(textOf(sailing.nodes)).toEqual(expect.arrayContaining(['SEASON']));
    expect(textOf(nursing.nodes)).toEqual(expect.arrayContaining(['TERM']));
  });

  it('renders the name and "current of total steps" count', () => {
    const { nodes } = renderStrip();
    expect(textOf(nodes)).toEqual(expect.arrayContaining(['Winter 2025–2026']));
    const countNode = findByTestID(nodes, 'series-strip-count');
    const countText = React.Children
      .toArray(countNode.props.children)
      .map((c) => String(c))
      .join('');
    expect(countText).toBe('6 of 14 steps');
  });

  it('progress fill width matches the progress fraction', () => {
    const { nodes } = renderStrip({ progress: 6 / 14 });
    const fill = findByTestID(nodes, 'series-strip-progress');
    const widthStyle = (fill.props.style as any[]).find(
      (s: any) => s && typeof s.width === 'string',
    );
    expect(widthStyle.width).toBe(`${(6 / 14) * 100}%`);
  });

  it('clamps progress to [0, 1] for out-of-range or non-finite values', () => {
    const overflowFill = findByTestID(
      renderStrip({ progress: 2 }).nodes,
      'series-strip-progress',
    );
    const overflowWidth = (overflowFill.props.style as any[]).find(
      (s: any) => s && typeof s.width === 'string',
    ).width;
    expect(overflowWidth).toBe('100%');

    const negativeFill = findByTestID(
      renderStrip({ progress: -0.5 }).nodes,
      'series-strip-progress',
    );
    const negativeWidth = (negativeFill.props.style as any[]).find(
      (s: any) => s && typeof s.width === 'string',
    ).width;
    expect(negativeWidth).toBe('0%');

    const nanFill = findByTestID(
      renderStrip({ progress: Number.NaN }).nodes,
      'series-strip-progress',
    );
    const nanWidth = (nanFill.props.style as any[]).find(
      (s: any) => s && typeof s.width === 'string',
    ).width;
    expect(nanWidth).toBe('0%');
  });

  it('hides the step count when totalSteps is zero', () => {
    const { nodes } = renderStrip({ currentIndex: 0, totalSteps: 0 });
    expect(textOf(nodes)).not.toEqual(
      expect.arrayContaining(['0 of 0 steps']),
    );
  });

  it('calls onPress when the row is tapped', () => {
    const { nodes, onPress } = renderStrip();
    findByTestID(nodes, 'series-strip')?.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
